# Temporary incoming Messenger cadence

## Approved scope and revisit note (8 November 2026)
Kiko asked for hourly incoming Messenger polling on normal days and every minute from seven days before through the event day, while preserving outgoing. After the concrete branch/code/tests approval request, he reconfirmed: "i asked you to change it. can you?"
Revisit push-based Messenger delivery when developing Cue. No billing change, credentials change, public ingress, outgoing wording or payment/sign-link schedule is part of this change.

## Discovery and design
Both cueRfpKick (one minute) and cueResume (five minutes) call cueMsgrPull_. The existing lease only excludes simultaneous runs. The Worker lists KV on every /events request, including an empty queue.
The shared incoming gate now remembers attempted pulls under the existing lease. Failed pulls also wait for the chosen interval, preventing retry storms. Triggers themselves are unchanged.

Authoritative dates: signed Canvas get_project_board, sourced from Admin Directory Event Date (M/d/yyyy; ISO dates also accepted). Only valid dates and real project IDs qualify. Explicit Not Awarded, Cancelled/Canceled and On Hold in either status field are excluded. A conflicting phase does not override those fields. Overlapping events use the faster cadence. Unknown dates do not establish a fast window.
The board has one recorded event date, no multi-day end date. This implementation does not invent an end date.

Canvas dates refresh at most once an hour. The cache stores only distinct eligible dates, not names or whole project records. Fast mode is recalculated at each pull using the Manila calendar date, so cached fast mode cannot extend past midnight after the event. A missing/failed board defaults to hourly polling, retries the board after an hour, and records CUE_MSGR_CADENCE_ERROR plus a console diagnostic. Thus date/status amendments can take up to an hour to affect cadence.

## Acceptance plan
- Both incoming trigger paths share the interval; normal day is hourly, event window is one minute.
- Inclusive day-minus-seven and event-day boundaries, Manila midnight, overlap, changed/invalid dates, excluded statuses.
- Lease, missing setup and failed relay attempts remain bounded.
- Outgoing payment/sign-link cadence and immediate Worker tap responses unchanged.
- Full synthetic suite and relay suite; generated map checked.
- No live sends or production changes used as tests.

## Remaining limitations and release gates
One-minute polling alone is 1,440 KV LIST/day and can still exhaust the free 1,000/day allowance during event weeks. Hourly normal days reduce that component to about24/day. This is temporary capacity mitigation, not an event-week quota fix or latency guarantee.
No multi-day end field is exposed by the current board. Unknown/stale project dates require correction at the authoritative Directory, not guessed overrides.
Feature Board mapping is unsynced: its ArtifactData tool is unavailable. No replacement tracker or duplicate card was created.
Changes must pass Test Cue and the existing release workflow. Local tests do not establish live Apps Script or Cloudflare version/behavior. No billing/security settings were changed.

## Review correction
A code expires after ten minutes in Canvas. Hourly polling would break that flow, so a code_sent response opens a bounded ten-minute one-minute polling window. Canvas verification expiry/attempt limits are unchanged. Moved and Complete/Completed rows are also excluded. The existing50-events-per-pull limit remains; high normal-day backlog can add hours. Date failure diagnostics are console/script-property only, not a user notification.
