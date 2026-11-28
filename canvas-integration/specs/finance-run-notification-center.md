# Finance run notifications in Cue

Status: Proposed for Kiko's approval. Not implemented in Cue. November 28, 2026.

## Goal
After a Finance scan finishes, put one compact alert in Cue's dedicated Notification Center, not in Messages. Opening the alert shows the related transaction cards in order, together, without repeating the run summary.

## Confirmed requirements
- Notification: status icon, Finance run and Manila date/time, one line with files found, number actually read, and how many items await confirmation. Indicate incomplete coverage rather than reporting false zeroes. Group by source and Manila date; ordinary scan alerts do not trigger phone pop-ups.
- Card: Transaction Confirmation Request for proposed matches, Transaction Review for unclear evidence. Show project, scanned details, and possible matches with request, description, supplier or payee, request amount, and reason when known. Distinguish scanned and requested amounts. Suppress already-linked matches; do not invent missing data.
- Evidence: labeled Open proof that opens the permissioned original. No raw URLs. Use authenticated image previews or a PDF tile when supported; otherwise keep the original link. Never broaden sharing.
- This release does not change Finance posting, approvals, supplier/client communication, payment allocation or OCR policy. No working Approve button until a separately verified approval contract exists.

## Discovery and options
The existing Finance workflow sends agent updates at file discovery through Canvas. Cue imports these updates into agent threads (CueAgentDrafts.gs). Existing phone alerts are a separate push service and are not an in-app inbox. The current Cue source has no dedicated Finance receiving path. The n8n finish-gated handoff is tested against synthetic data only.

Recommended: extend the existing authorized Canvas-to-Cue transport with an explicitly typed, bounded Finance scan result. Cue reads it through the existing authenticated sync and classifies it before creating any Messages entry. Persist one alert by run ID and link its review-only cards by stable evidence ID. Avoid a new public ingress or a phone push fallback. Alternative: send shorter updates through Messages. That is smaller but does not meet the Notification Center or grouping requirements.

## Build and acceptance
1. Confirm the exact existing bridge contract on both sides and introduce a validated typed record if needed. Do not smuggle JSON through summary fields. Preserve old message and action handling for unrelated updates.
2. In an isolated branch, add the owner-only Notification Center view and group view. Follow existing brand and accessibility rules. Reuse approved proof links; add previews only through the existing authenticated file path.
3. Connect a single report after every selected file has settled, including no-selected-files and skipped/blocked/failed items. Preserve completed/failed/blocked distinctions. Retries must not duplicate the alert or cards. If delivery fails, keep the batch retryable without reporting success.
4. Run Cue regression tests and n8n replay. Verify on Cue /dev: one alert from an actual test batch, no Messages copy, two cards in order, proof opens, restricted evidence stays restricted, retry creates no duplicates, and nothing posts or approves a payment. Hand to the designated release workflow; do not test by changing production records.

Feature Board: matching entry not verified or updated from this session; proposed spec remains unsynced.

## Reuse review and isolated preview
Kiko approved proceeding with the missing pieces after checking for reusable cards. Reuse the Finance Check expandable layout and the authenticated Drive file viewer (`agdCheckHtml`, `viewOpen`). Do not reuse the invoice-missing classification or the message thread. The unmerged `claude/ei07-cue-evidence` branch provides a reference for file handling, but its Link/Unlink path can change records and is outside this read-only scope. It is not a drop-in review card.
The checked-in candidate is not live. The companion HTML preview uses synthetic data, shows one run alert and ordered review cards, and opens a sample proof. Standalone interaction checks passed. The approved production extension still needs the typed Canvas-to-Cue payload, a real finished-scan signal, and an authenticated preview test. Current Canvas main `agent_update` does not accept a typed Finance-run field. Do not repurpose generic reply or approval actions.

## Match response
Kiko approved a match response and asked to see Requirement and Scope the same way he identifies them in Record Project Expense. Each option names the requirement and scope (with verified IDs where available), payee, requested amount and match reason. Keep the scanned amount separate. Show verified Canvas associations only; a missing scope must stay unverified, not be guessed. Selecting a radio option is not a decision until Confirm match. Neither explicitly leaves the item unmatched. Opening proof or dismissing an alert does neither. The standalone preview demonstrates the response with sample data in page memory only. No live reply, payment approval, posting or record write is implemented in this preview.

## Canvas read contract and regression cases (Nov 28)
Use the existing read-only expense_evidence contract. Confirm that response.project.id is the intended project; discard matches with a different pid. Join match.id to requests.id and split requests.scopes on commas (Canvas emits a joined string, not just a single scope). Join each scope ID to scopes.id and each scope.requirement_id to requirements.id. Preserve request ID and each verified Requirement/Scope pair. Treat an absent join as unverified: Canvas caps scopes at 80 and returns only the last 60 requests, so absence is not proof the relationship does not exist. Supply payment stage if independently verified from payment_followups; request ID still distinguishes options if no stage is available. Do not assume high scores, exact amounts, or a single matching scope authorize a save. Keep the original permission-aware Open proof link; do not store expiring Drive thumbnail URLs.

Regression cases:
- A scoped read returns an amount-only candidate from another project: omit it.
- One request contains several comma-separated scope IDs: show all verified pairs, with no implied split or payment.
- A candidate or join falls outside the result caps: visibly unverified, no guessed pair.
- Two same-amount requests against one requirement/scope: show separate IDs and available stages. For the known already recorded KLM aggregate proof, do not force selection of either installment or ask to record it again.
- Distinct transport and tollgate scopes under one logistics requirement stay distinct. Use synthetic equivalents in automated tests; no real payment records should change.

## Isolated implementation checkpoint
The feature branch has local server-side validation, one-record-per-run persistence and explicit idempotent per-card decisions, plus a read-only Canvas candidate mapper. Amounts at this boundary are integer centavos; unknown remains null. Local tests cover deduplication, stale or invalid selections, Neither, readback, other-project candidates, missing joins, installments, and already-recorded proof. The storage adapter is simulated in the tests. No app endpoint, live trigger, or production workflow calls this code yet. Before connecting durable storage, use the app's lock and owner boundary and define bounded retention without deleting pending decisions. Build the two-sided typed bridge and authenticate its end-to-end test before claiming readiness.

### Pilot verification
An actual n8n execution used a temporary, isolated SQLite database with no live credentials or workflow activation. Its sanitized report fixture was replayed through the opt-in Cue server methods in a simulated Apps Script runtime: same run accepted once, rejected for a non-owner at the UI boundary, exact AP/Requirement/Scope decision saved and read back. The assembled Cue page includes a distinct owner-only Notifications dialog. This is not a signed-in Apps Script verification: there is not yet a wired Canvas producer/receiver, a live proof, or a staged browser readback. No production records or workflow were changed. Cue's full regression run still has Windows line-ending-related source-slice failures (at least BD6 and TC18), which were not skipped. The targeted pilot and the generated-map check pass.

### Authenticated Check Cue preparation
Prepared the key-locked Finance Notifications browser check. It uses the synthetic n8n fixture, a run-scoped cache, no proof IDs, no payment, and no writes to Canvas or Cue Messages. Local isolation, duplicate, and readback tests pass. The complete Cue suite passed 995/995 when run from a fresh LF-only copy (CI line endings); no tests skipped. The GitHub CLI on KKD returned HTTP 401, so the authenticated workflow was not dispatched. Nothing was pushed, merged, or deployed. The live scan transport is separate and still not wired.
