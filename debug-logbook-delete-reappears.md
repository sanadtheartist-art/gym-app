[OPEN]

# Session
- Session ID: `logbook-delete-reappears`
- Started: `2026-06-22`

# Problem
- Actual: deleting a logbook item shows the countdown, the item disappears, then it comes back again.
- Expected: after delete finishes, the item stays deleted.

# Repro
1. Open Logbook.
2. Delete one exercise/workout entry.
3. Wait for the countdown to finish.
4. Observe the row disappears and then reappears.

# Notes
- Previous static fix did not solve the issue.
- Runtime evidence showed the delete request itself succeeded.
- Cross-browser verification showed the deleted row was not present in Supabase after delete.
- Likely root cause narrowed to browser-local stale cache or stale refresh data rehydrating the workout after delete.

# Hypotheses
- A: Supabase delete fails. Status: Rejected. Evidence: delete success event was recorded and cross-browser state did not show the row.
- B: Refresh reloads stale data into the current browser. Status: Likely.
- C: Offline/local cache merges deleted data back in. Status: Likely.
- D: Wrong row id is being deleted in UI only. Status: Rejected by successful delete evidence.
- E: Another local refresh path rewrites stale workouts cache. Status: Likely.

# Fix
- Added delete tombstones in the workouts cache layer.
- `loadWorkouts()` now filters stale cached and stale fetched workouts that match deleted identities.
- Logbook delete now records the deleted workout identity so stale local copies cannot resurrect it during refresh.

# Verification
- Current debug run uses `runId=post-fix`.
- Post-fix logs were not emitted from the affected browser profile, which suggests that profile may still be using stale browser-local persisted state or stale loaded code.
- Added a stronger iteration fix by moving the app to a fresh IndexedDB namespace: `JexiOfflineDBv2`.
- This keeps Supabase data untouched while isolating the affected browser from old stale local workout cache data.
- Next step: reload the app in the affected browser so it opens the new local DB, then reproduce delete again.
