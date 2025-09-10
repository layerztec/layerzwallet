#!/usr/bin/env bash

# Helpful reading on the compromise:
# https://www.aikido.dev/blog/npm-debug-and-chalk-packages-compromised
# https://news.ycombinator.com/item?id=45169794
# https://x.com/P3b7_/status/1965094840959410230
# https://news.ycombinator.com/item?id=45169657 

# NOTE: Requires `jq` and `rg`
# Both can be installed with brew:
# `brew install jq`
# `brew install rg`

set -euo pipefail
[[ "${DEBUG:-0}" == "1" ]] && set -x

TOOL="${TOOL:-npm}"

# Watchlist lines can be: "name" or "name<tab/space>compromised_version"
WATCHLIST="$(cat <<'EOF'
backslash	0.2.1
chalk-template	1.1.1
supports-hyperlinks	4.1.1
has-ansi	6.0.1
simple-swizzle	0.2.3
color-string	2.1.1
error-ex	1.3.3
color-name	2.0.1
is-arrayish	0.3.3
slice-ansi	7.1.1
color-convert	3.1.1
wrap-ansi	9.0.1
ansi-regex	6.2.1
supports-color	10.2.1
strip-ansi	7.1.1
chalk	5.6.1
debug	4.4.2
ansi-styles	6.2.2
color	5.0.1
EOF
)"

command -v jq >/dev/null || { echo "[x] jq not found"; exit 1; }
[[ -f package.json ]] || { echo "[x] No package.json here"; exit 1; }

TMPDIR="$(mktemp -d)"
DEPS_JSON="$TMPDIR/deps.json"
MAP_JSON="$TMPDIR/name_map.json"

echo "[*] Collecting dependency tree."

if [[ "$TOOL" == "bun" ]]; then
  bun pm ls --json > "$DEPS_JSON"
else
  npm ls --all --json > "$DEPS_JSON" || true
fi

echo "[*] Building name→{versions,roots} map…"
jq '
  def walkdeps(root):
    (.dependencies // {}) | to_entries[] as $e
    | ($e.value | {name:$e.key, version:(.version // ""), root:(root // $e.key)})
    , ($e.value | walkdeps(root // $e.key));

  reduce (walkdeps(null)) as $n
    ({}; 
      if ($n.version|type)=="string" and ($n.version|length)>0 then
        .[$n.name] |= ( . // {versions:[], roots:[]} ) |
        .[$n.name].versions += [$n.version] |
        .[$n.name].roots    += [$n.root]
      else . end
    )
  | with_entries(
      .value.versions |= (unique|sort) |
      .value.roots    |= (unique|sort)
    )
' "$DEPS_JSON" > "$MAP_JSON"

if [[ "$(jq 'length' "$MAP_JSON")" -eq 0 ]]; then
  echo "[!] Dependency map is empty. Did you run npm/bun install?"
fi

echo "[*] Checking watchlist (any version)…"

# Collect all table data first to calculate column widths
declare -a table_data=()
declare -a col1_data=() col2_data=() col3_data=() col4_data=() col5_data=()

# Add header row
col1_data+=("package")
col2_data+=("compromised version")
col3_data+=("present?")
col4_data+=("versions found")
col5_data+=("matches compromised?")

found_any=false

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  # name = first field, compromised = second field if present
  name="$(awk '{print $1}' <<<"$line")"
  compromised="$(awk 'NF>1{print $2}' <<<"$line")"
  [[ -z "${compromised:-}" ]] && compromised="-"

  has=$(jq -r --arg n "$name" 'has($n)' "$MAP_JSON")

  if [[ "$has" == "true" ]]; then
    versions_csv=$(jq -r --arg n "$name" '.[$n].versions | join(", ")' "$MAP_JSON")
    match="-"
    if [[ "$compromised" != "-" ]]; then
      # exact version match?
      matched=$(jq -r --arg n "$name" --arg v "$compromised" '
        (.[$n].versions // []) | index($v) | if .==null then "no" else "yes" end
      ' "$MAP_JSON")
      match="$matched"
    fi
    col1_data+=("$name")
    col2_data+=("$compromised")
    col3_data+=("yes")
    col4_data+=("$versions_csv")
    col5_data+=("$match")
    found_any=true
  else
    col1_data+=("$name")
    col2_data+=("$compromised")
    col3_data+=("no")
    col4_data+=("-")
    col5_data+=("-")
  fi
done <<< "$WATCHLIST"

# Calculate maximum width for each column
max_col1=0; max_col2=0; max_col3=0; max_col4=0; max_col5=0

for i in "${!col1_data[@]}"; do
  [[ ${#col1_data[i]} -gt $max_col1 ]] && max_col1=${#col1_data[i]}
  [[ ${#col2_data[i]} -gt $max_col2 ]] && max_col2=${#col2_data[i]}
  [[ ${#col3_data[i]} -gt $max_col3 ]] && max_col3=${#col3_data[i]}
  [[ ${#col4_data[i]} -gt $max_col4 ]] && max_col4=${#col4_data[i]}
  [[ ${#col5_data[i]} -gt $max_col5 ]] && max_col5=${#col5_data[i]}
done

# Print the formatted table
echo
for i in "${!col1_data[@]}"; do
  printf "| %-*s | %-*s | %-*s | %-*s | %-*s |\n" \
    $max_col1 "${col1_data[i]}" \
    $max_col2 "${col2_data[i]}" \
    $max_col3 "${col3_data[i]}" \
    $max_col4 "${col4_data[i]}" \
    $max_col5 "${col5_data[i]}"
  
  # Print separator line after header
  if [[ $i -eq 0 ]]; then
    printf "|"
    printf "%*s" $((max_col1 + 2)) "" | tr ' ' '-'
    printf "|"
    printf "%*s" $((max_col2 + 2)) "" | tr ' ' '-'
    printf "|"
    printf "%*s" $((max_col3 + 2)) "" | tr ' ' '-'
    printf "|"
    printf "%*s" $((max_col4 + 2)) "" | tr ' ' '-'
    printf "|"
    printf "%*s" $((max_col5 + 2)) "" | tr ' ' '-'
    printf "|\n"
  fi
done

if [[ "$found_any" == false ]]; then
  echo -e "\n[!] None of the watchlist packages were found in your dependency tree."
else
  echo -e "\n[*] Done. See table above."
fi

echo
echo "[*] Scanning for malicious code patterns..."

# Check if ripgrep is available
if command -v rg >/dev/null 2>&1; then
  echo "[*] Using ripgrep to scan for obfuscated malware patterns..."
  
  # Patterns from the NPM supply chain attack
  # Focus on unique obfuscated malware signatures to avoid false positives
  malicious_patterns=(
    "_0x112fa8"
    "checkethereumw"
  )
  
  malware_found=false
  
  # Search in node_modules for suspicious patterns
  if [[ -d "node_modules" ]]; then
    for pattern in "${malicious_patterns[@]}"; do
      echo "[*] Scanning for pattern: $pattern"
      
      # Use ripgrep with options to search through node_modules
      # -u: don't respect .gitignore (search node_modules)
      # --max-columns=80: limit output width
      # -n: show line numbers
      # -H: show filenames
      # -i: case insensitive
      matches=$(rg -u --max-columns=80 -n -H -i "$pattern" node_modules/ 2>/dev/null || true)
      
      if [[ -n "$matches" ]]; then
        echo "[!] MALICIOUS CODE DETECTED - Pattern '$pattern' found:"
        echo "$matches" | head -10  # Show first 10 matches to avoid overwhelming output
        [[ $(echo "$matches" | wc -l) -gt 10 ]] && echo "... (showing first 10 matches, more found)"
        echo
        malware_found=true
      fi
    done
    
    if [[ "$malware_found" == true ]]; then
      echo "[!] ⚠️  SECURITY ALERT: Potential malicious code detected in dependencies!"
      echo "[!] Please review the matches above and consider:"
      echo "[!] 1. Removing affected packages immediately"
      echo "[!] 2. Checking package-lock.json for compromised versions"
      echo "[!] 3. Using package.json overrides to pin to safe versions"
      echo "[!] 4. Running a full security audit"
    else
      echo "[✓] No malicious code patterns detected in node_modules"
    fi
  else
    echo "[!] node_modules directory not found. Run npm/bun install first."
  fi
else
  echo "[!] ripgrep (rg) not found. Install with: brew install ripgrep"
  echo "[!] Skipping malicious code pattern scanning."
fi

echo "[i] Debug JSON kept at: $TMPDIR"