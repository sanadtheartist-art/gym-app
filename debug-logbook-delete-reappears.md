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
- Next step is instrumentation only, no business-logic changes yet.
