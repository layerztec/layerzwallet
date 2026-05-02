# RGB VSS backup-failure handling

## Why this exists

VSS is the only durable record of an RGB wallet's state. The local sled DB
holds the truth on this device, but a reinstall, a wipe, or a new device
gets state strictly from VSS. Any window where local mutations have happened
and VSS hasn't been updated is a window where tokens can disappear on
recovery. Today that window is silent, unbounded, and indistinguishable
(from the user's POV) from a healthy wallet.

This doc captures the failure modes, the design that addresses them, and
the implementation steps. Comments in the code touching `init()` /
`tryBackup` / the new probe should reference this file by path so the
reasoning isn't lost.

## The four failure modes

**A. Backup fails *after* a state-changing op.**
`tryBackup()` swallows the error today. The mutation (transfer / issue /
createUtxos) succeeded locally — the local sled DB has the truth — but VSS
is stale. If the user reinstalls or moves devices before the next mutation,
the recovered state is missing whatever happened since the last successful
backup. Tokens look gone.

**B. VSS unreachable during *restore*.**
`restoreFromVss` throws something `isVssBackupMissing()` correctly does
*not* classify as missing, so init re-throws. The user sees a generic
error. Good news: we don't currently silently overwrite — but the UX is
opaque, and the only thing standing between us and disaster is one regex
in `isVssBackupMissing`.

**C. Fresh install + valid mnemonic + transient VSS outage = silent overwrite risk.**
The fragile path. Today this *probably* works because we rethrow on
non-"missing". But if `isVssBackupMissing` is ever broadened (e.g., adding
a network-error case "to be helpful"), a user restoring during an outage
gets a fresh empty wallet — and the next mutation calls `vssBackup` which
**overwrites the real backup** with empty state. Loss is permanent.

**D. No user-visible "synced" state.**
After a transfer the user has no signal whether their state is durably
backed up. Today's "swallow + log" behavior is invisible — only the
developer sees `handleError`.

## Design (three ideas)

### 1. A "wallet has been used before on this device" flag

`STORAGE_KEY_RGB_INITIALIZED_<network>` set after the first successful
`init()` per network. This flag distinguishes:

- **First-ever creation on this device** — backup-missing is expected;
  create fresh wallet.
- **Restore from existing seed on a new device or fresh install** — flag
  absent. Backup-missing here is a yellow flag: could be genuine first
  creation, OR could be a server outage classified as missing. We add a
  probe (see #2).
- **Same device, after any successful init** — flag present.
  Backup-missing here is a *red* flag — we previously had backup, now
  it's gone? Refuse to silently recreate (`RgbBackupLostError`).

### 2. A VSS health probe before "missing" decisions

Use `sdk().vssBackupInfo()` before deciding to fall back to fresh wallet.
Three outcomes:

- `backupExists: true` → restore should have worked; the original error
  was real, rethrow.
- `backupExists: false` and probe succeeded → genuinely no backup; safe
  to create fresh.
- Probe itself throws → server is unreachable. **Do not create fresh
  wallet.** Throw a typed `RgbBackupServerUnreachableError`.

This eliminates the silent-overwrite risk in mode C.

**Critical assumption:** `vssBackupInfo()` must be cheap and side-effect
free (HTTP HEAD / version probe), not a full backup fetch. Verify before
implementing the probe-before-restore step. If it's actually heavy,
swap to a TCP-level reachability check.

### 3. Per-wallet backup ledger + UI surface

Track on `RgbWallet`:

- `_lastBackupAt: number | null`
- `_pendingMutationsSinceBackup: number` — incremented before any
  `tryBackup`, decremented on success.
- `_lastBackupError: { kind: 'network' | 'auth' | 'unknown', at: number } | null`

Persist a small subset (`{ pendingMutations, lastBackupError }`) to
storage so a force-quit can't hide the warning.

Expose via a hook `useRgbBackupStatus(network)` returning
`{ status: 'synced' | 'pending' | 'failed', pendingCount, lastBackupAt, lastError }`.

UI surface:

- **Persistent banner** on RGB home when `status !== 'synced'`. Tap →
  "Retry backup" button + plain-language explanation ("your last N
  changes haven't been saved to backup; we'll keep retrying, or tap to
  retry now").
- **Send-confirm screen**: if a transfer would push the wallet further
  out-of-sync (i.e., we already have pending unbacked changes and the
  network looks bad), show a soft-warning before submission, *not* a
  hard block.
- **Receive screen**: same treatment — receiving is also a state change.

## Implementation steps

1. **`shared/class/wallets/rgb-wallet.ts`**
   - Add the three tracking fields. Persist
     `{ pendingMutations, lastBackupError }` via a new storage key per
     network/account.
   - Replace `tryBackup` with `tryBackup({ critical?: boolean })`:
     - Pre-increments `_pendingMutationsSinceBackup` and persists.
     - Calls `vssBackup`, on success decrements counter, sets
       `_lastBackupAt`, persists.
     - On failure classifies error (network vs auth vs schema), persists
       `_lastBackupError`, returns `false`.
     - Optional `critical: true` for issue/transfer flows: if backup
       fails, throw a typed `RgbBackupFailedError` so the caller can show
       a confirm-anyway dialog. Default stays non-throwing for
       `createUtxos` / `prepareWallet` background work.
   - In `init()`: when `restoreFromVss` throws, *before* falling through
     to `createWallet`, call `sdk().vssBackupInfo()`. Only create fresh
     wallet if `backupExists === false` AND the probe succeeded. On probe
     throw, throw `RgbBackupServerUnreachableError`. If
     `STORAGE_KEY_RGB_INITIALIZED_<network>` is set and probe says
     `backupExists === false`, throw `RgbBackupLostError`.
   - On every successful `init()`, set
     `STORAGE_KEY_RGB_INITIALIZED_<network>` = `'true'`.

2. **`shared/types/rgb-adapter.ts`** — `vssBackupInfo` is already in the
   Pick allow-list. No change.

3. **`shared/hooks/useRgbBackupStatus.ts`** (new) — SWR-driven; reads from
   the wallet via `BackgroundExecutor.getRgbBackupStatus(network)`. Polls
   every 30s; revalidates on app foreground.

4. **`mobile/src/modules/background-executor.ts`** (and `ext/` mirror) —
   add `getRgbBackupStatus(network)` / `retryRgbBackup(network)` RPCs.

5. **UI**
   - `mobile/components/RgbBackupBanner.tsx` (new) — sticky banner on RGB
     home + send/receive flows.
   - `mobile/app/send/send-confirm.tsx` — inline warning when
     `status !== 'synced'`.
   - Settings screen "Backup status" entry — last backup time + "Force
     backup now".

6. **Restore-from-seed gate** — on TOS/unlock flow, if user is restoring
   (not creating new), surface a "verifying backup..." step that calls
   `vssBackupInfo`. If unreachable, present "Skip RGB for now" / "Retry"
   buttons. Only proceed to `lazyInitWallet(NETWORK_RGB_*)` when the probe
   succeeds. Non-RGB networks proceed regardless.

7. **Tests** (`shared/tests/unit-vi/rgb-wallet.test.ts`)
   - `init` with restore failure + probe success(missing) → creates fresh
     wallet.
   - `init` with restore failure + probe failure → throws
     `RgbBackupServerUnreachableError`.
   - `init` with restore failure + probe success(exists) → rethrows
     original error (don't silently fresh-create).
   - `init` with `RGB_INITIALIZED` flag set + probe success(missing) →
     throws `RgbBackupLostError`.
   - `tryBackup` failure path increments pending counter, persists error.
   - `tryBackup({ critical: true })` failure path throws.

## What is *not* in scope

- **Hard-blocking the user on every backup failure.** Bad UX for
  transient blips; persistent banner + retry covers the long tail.
- **Encrypting the local sled DB to tolerate backup loss.** Doesn't
  address the cross-device case.
- **Building our own backup retry queue.** rgb-lib already has a
  `backupRequired` flag — we just surface and retry it.
- **Auto-failing transfers when out-of-sync.** A user with a stale backup
  can still successfully transfer; the data risk is on the recovery path,
  not the immediate operation.

## Files to add a comment pointing here

When implementing, the following sites should carry a short comment
ending in `See tasks/rgb-backup-failure-handling.md`:

- `RgbWallet.init()` — the probe + flag logic.
- `RgbWallet.tryBackup()` — the ledger semantics.
- `useRgbBackupStatus()` — what the three states mean.
- The restore-from-seed gate in the unlock flow.
- The home banner — why it's persistent until cleared.
