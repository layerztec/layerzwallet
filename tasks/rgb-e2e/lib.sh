#!/bin/bash
# RGB on-chain e2e helpers — codified from the manual 2026-10 signet runs.
# Usage: source tasks/rgb-e2e/lib.sh   (bash; zsh works if you `setopt shwordsplit`)
# See tasks/rgb-test-plan.md for the case matrix and the traps list.
#
# Conventions: every wait is BOUNDED (caller passes a timeout, default sane);
# functions echo progress lines and return non-zero on timeout/failure so a
# driver (human or subagent) can stop and investigate instead of re-waiting.

set -u

RGB_E2E_SIM="${RGB_E2E_SIM:-597E4F02-2EE7-45D7-A185-266F99631F4B}"
RGB_E2E_AVD="${RGB_E2E_AVD:-Pixel_API_29_AOSP}"
RGB_E2E_APPID="com.layerzwallet.mobile"
RGB_E2E_FAUCET="https://rln-signet.utexo.com/faucet"
RGB_E2E_ESPLORA="https://esplora-api.utexo.com"
RGB_E2E_FAUCET_CLI="${RGB_E2E_FAUCET_CLI:-/Users/limp/z/rgb-faucet/bin/faucet-http.js}"

# ── shared ────────────────────────────────────────────────────────────────

e2e_log() { echo "[$(date +%H:%M:%S)] $*"; }

# faucet_sendbtc <address> [sats]  → prints txid
faucet_sendbtc() {
  curl -sS -X POST "$RGB_E2E_FAUCET/sendbtc" -H 'Content-Type: application/json' \
    -d "{\"address\":\"$1\",\"amount\":${2:-30000},\"fee_rate\":2,\"skip_sync\":false}" |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["txid"])'
}

# faucet_getasset <invoice> [amountBaseUnits] → prints txid
faucet_getasset() {
  node "$RGB_E2E_FAUCET_CLI" getasset "$1" "${2:-}" | sed -n 's/^DONE — txid: //p'
}

faucet_refresh() {
  curl -sS -X POST "$RGB_E2E_FAUCET/refreshtransfers" -H 'Content-Type: application/json' \
    -d '{"filter":[],"skip_sync":false}' >/dev/null 2>&1
}

# wait_confirmed <txid> [timeout_s]  — refreshtransfers-loop until esplora
# confirms (covers the sendrgb-broadcasts-on-refresh trap).
wait_confirmed() {
  local tx="$1" deadline=$((SECONDS + ${2:-1500}))
  while [ $SECONDS -lt $deadline ]; do
    faucet_refresh
    local st
    st=$(curl -sS "$RGB_E2E_ESPLORA/tx/$tx/status" 2>/dev/null | head -c 60)
    e2e_log "confirm $tx: $st"
    case "$st" in *'"confirmed":true'*) return 0 ;; esac  # NB: must match :true — bare *confirmed* also matches "confirmed":false
    sleep 60
  done
  e2e_log "TIMEOUT waiting confirm $tx"; return 1
}

# ── android (requires AOSP emulator; adb root for log reads) ──────────────

and_wipe_install() { # <apk>
  adb uninstall "$RGB_E2E_APPID" >/dev/null 2>&1
  adb install "$1" | tail -1
  adb root >/dev/null 2>&1
}

and_launch() { adb shell am start -n "$RGB_E2E_APPID/.MainActivity" >/dev/null; sleep 20; }

and_dump() { adb exec-out uiautomator dump /dev/tty 2>/dev/null; }

# and_tap_text <exact text>  — taps the element's center; fails if absent.
and_tap_text() {
  local b
  b=$(and_dump | python3 -c "
import re,sys
d=sys.stdin.read()
m=re.search(r'(?:text|content-desc)=\"$1\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', d)
print((int(m.group(1))+int(m.group(3)))//2,(int(m.group(2))+int(m.group(4)))//2) if m else print('')")
  [ -n "$b" ] || { e2e_log "and_tap_text: '$1' not found"; return 1; }
  adb shell input tap $b
}

# and_import_seed "<12 words>"  — from the onboarding Create/Import screen.
# Types in two chunks (input text truncates ~67 chars).
and_import_seed() {
  and_tap_text "Import Wallet" || return 1; sleep 5
  local f
  f=$(and_dump | python3 -c "
import re,sys
m=re.search(r'class=\"android.widget.EditText\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"', sys.stdin.read())
print((int(m.group(1))+int(m.group(3)))//2,(int(m.group(2))+int(m.group(4)))//2) if m else print('')")
  [ -n "$f" ] || { e2e_log "seed field not found"; return 1; }
  adb shell input tap $f; sleep 2
  local w=($1) first="${1%% ${w[7]} *}"
  adb shell input text "$(echo "${w[0]} ${w[1]} ${w[2]} ${w[3]} ${w[4]} ${w[5]} ${w[6]}" | sed 's/ /\\ /g')"; sleep 1
  adb shell input text "$(echo " ${w[7]} ${w[8]} ${w[9]} ${w[10]} ${w[11]}" | sed 's/ /\\ /g')"; sleep 1
  and_tap_text "Import" || return 1
}

# and_wait_gate [timeout_s]  — waits out "Importing…"/"Verifying RGB backup…"
# until the success screen; fails on timeout (possible #58-class hang).
and_wait_gate() {
  local deadline=$((SECONDS + ${1:-900}))
  while [ $SECONDS -lt $deadline ]; do
    local s
    s=$(and_dump | grep -oE 'text="(Importing wallet...|Verifying RGB backup…|Wallet created[^"]*)"' | head -1)
    e2e_log "gate: $s"
    case "$s" in *created*) return 0 ;; esac
    sleep 25
  done
  e2e_log "GATE TIMEOUT (check LDK log for 'Delaying monitor unlock')"; return 1
}

# and_finish_onboarding — the two checkboxes + Let's go (positions stable on
# the 1080x1920 AVD; re-derive via and_dump if the AVD changes).
and_finish_onboarding() {
  adb shell input tap 120 1133; sleep 1
  adb shell input tap 120 1395; sleep 1
  adb shell input tap 540 1668; sleep 6
}

# and_set_rgb_testnet — writes AsyncStorage directly (UI network switcher is
# not reliably scriptable). App must be STOPPED when this runs.
and_set_rgb_testnet() {
  adb shell am force-stop "$RGB_E2E_APPID"; sleep 2
  adb shell "sqlite3 /data/data/$RGB_E2E_APPID/databases/RKStorage \
    \"UPDATE catalystLocalStorage SET value=replace(value,'\\\"showTestnets\\\":\\\"OFF\\\"','\\\"showTestnets\\\":\\\"ON\\\"') WHERE key='STORAGE_KEY_SETTINGS'; \
      INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES('STORAGE_SELECTED_NETWORK','rgb_testnet');\""
}

# and_wait_text <regex> [timeout_s]  — polls the UI dump for a text match.
and_wait_text() {
  local deadline=$((SECONDS + ${2:-420}))
  while [ $SECONDS -lt $deadline ]; do
    local r
    r=$(and_dump | grep -oE "text=\"$1\"" | head -1)
    e2e_log "wait '$1': ${r:-...}"
    [ -n "$r" ] && return 0
    sleep 25
  done
  return 1
}

# and_deadlock_count — grep the LDK log for the #58 signature (must be 0).
and_deadlock_count() {
  local l
  l=$(adb shell "ls /data/data/$RGB_E2E_APPID/files/rgb/testnet/*/.ldk/logs/logs.txt 2>/dev/null" | head -1 | tr -d '\r')
  if [ -n "$l" ]; then adb shell "grep -c 'Delaying monitor unlock' '$l'" | tr -d '\r'; else echo "-"; fi
}

# ── ios (simulator; idb for UI, simctl for lifecycle) ─────────────────────

ios_els() { # label | type | x,y   per line
  idb ui describe-all --udid "$RGB_E2E_SIM" 2>/dev/null | python3 -c "
import json,sys
for e in json.load(sys.stdin):
    label=(e.get('AXLabel') or e.get('AXValue') or '').strip()
    f=e.get('frame') or {}
    x=int(f.get('x',0)+f.get('width',0)/2); y=int(f.get('y',0)+f.get('height',0)/2)
    t=e.get('type') or ''
    if label or t not in ('Other','Group'): print(f'{label} | {t} | {x},{y}')"
}

ios_wipe_install() { # <path/to/LayerzWallet.app>
  xcrun simctl terminate "$RGB_E2E_SIM" "$RGB_E2E_APPID" 2>/dev/null
  xcrun simctl uninstall "$RGB_E2E_SIM" "$RGB_E2E_APPID"
  xcrun simctl install "$RGB_E2E_SIM" "$1"
}

# ios_launch — retries past the occasional cold-start Rive SIGSEGV.
ios_launch() {
  local i
  for i in 1 2 3; do
    xcrun simctl launch "$RGB_E2E_SIM" "$RGB_E2E_APPID" >/dev/null 2>&1; sleep 14
    ios_els | grep -qE "Import Wallet|Create Wallet|Rgb|Bitcoin" && return 0
    e2e_log "launch try $i crashed (Rive?), retrying"
  done
  return 1
}

ios_tap() { idb ui tap "$1" "$2" --udid "$RGB_E2E_SIM" >/dev/null 2>&1; }

# ios_import_seed "<12 words>" — single `idb ui text` call carries the whole
# seed; a tap into the field REPLACES its content (quirk we rely on).
# Verifies the typed value: the sim sometimes reverts to a RU hardware
# layout (types cyrillic); if so, fix the keyboard pref and retry once:
#   PlistBuddy Delete+Add AppleKeyboards = ["en_GB@sw=QWERTY;hw=Automatic"]
# in the sim's .GlobalPreferences.plist, then relaunch the app.
ios_import_seed() {
  ios_tap 201 788; sleep 4           # Import Wallet
  local try
  for try in 1 2; do
    ios_tap 201 295; sleep 2         # seed TextArea (tap replaces content)
    idb ui text "$1" --udid "$RGB_E2E_SIM"; sleep 2
    local v
    v=$(idb ui describe-all --udid "$RGB_E2E_SIM" 2>/dev/null | python3 -c "
import json,sys
for e in json.load(sys.stdin):
    if e.get('type')=='TextArea': print((e.get('AXValue') or '').strip())")
    [ "$v" = "$1" ] && { ios_tap 235 772; return 0; }   # Import
    e2e_log "seed mismatch (layout?): [$v] — fixing keyboard pref"
    local p=~/Library/Developer/CoreSimulator/Devices/$RGB_E2E_SIM/data/Library/Preferences/.GlobalPreferences.plist
    /usr/libexec/PlistBuddy -c "Delete :AppleKeyboards" "$p" 2>/dev/null
    /usr/libexec/PlistBuddy -c "Add :AppleKeyboards array" -c "Add :AppleKeyboards:0 string 'en_GB@sw=QWERTY;hw=Automatic'" "$p"
    xcrun simctl terminate "$RGB_E2E_SIM" "$RGB_E2E_APPID" 2>/dev/null; sleep 2
    ios_launch; ios_tap 201 788; sleep 4
  done
  e2e_log "ios_import_seed: keyboard still broken"; return 1
}

ios_wait_gate() {
  local deadline=$((SECONDS + ${1:-900}))
  while [ $SECONDS -lt $deadline ]; do
    local s
    s=$(ios_els | grep -oE "Importing wallet|Verifying RGB backup|Wallet created" | head -1)
    e2e_log "gate: $s"
    [ "$s" = "Wallet created" ] && return 0
    sleep 25
  done
  e2e_log "GATE TIMEOUT"; return 1
}

ios_finish_onboarding() { ios_tap 60 586; sleep 1; ios_tap 60 688; sleep 1; ios_tap 201 792; sleep 8; }

# ios_set_rgb_testnet — edits the AsyncStorage manifest; app must be stopped.
ios_set_rgb_testnet() {
  xcrun simctl terminate "$RGB_E2E_SIM" "$RGB_E2E_APPID" 2>/dev/null; sleep 2
  local c m
  c=$(xcrun simctl get_app_container "$RGB_E2E_SIM" "$RGB_E2E_APPID" data)
  m=$(find "$c" -name manifest.json -path "*AsyncLocalStorage*" 2>/dev/null | head -1)
  python3 - "$m" <<'PYEOF'
import json,sys
p=sys.argv[1]; d=json.load(open(p))
s=json.loads(d.get('STORAGE_KEY_SETTINGS','{}')); s['showTestnets']='ON'
d['STORAGE_KEY_SETTINGS']=json.dumps(s); d['STORAGE_SELECTED_NETWORK']='rgb_testnet'
json.dump(d,open(p,'w'))
PYEOF
}

# ios_wait_label <regex> [timeout_s]
ios_wait_label() {
  local deadline=$((SECONDS + ${2:-420}))
  while [ $SECONDS -lt $deadline ]; do
    local r
    r=$(ios_els | grep -oE "$1" | head -1)
    e2e_log "wait '$1': ${r:-...}"
    [ -n "$r" ] && return 0
    sleep 25
  done
  return 1
}

ios_deadlock_count() {
  local f
  f=$(find ~/Library/Developer/CoreSimulator/Devices/"$RGB_E2E_SIM"/data/Containers/Data/Application \
      -path "*rgb/testnet*" -name logs.txt -newer /tmp 2>/dev/null | head -1)
  [ -z "$f" ] && f=$(find ~/Library/Developer/CoreSimulator/Devices/"$RGB_E2E_SIM"/data/Containers/Data/Application \
      -path "*rgb/testnet*" -name logs.txt 2>/dev/null | head -1)
  if [ -n "$f" ]; then grep -c "Delaying monitor unlock" "$f"; true; else echo "-"; fi
}
