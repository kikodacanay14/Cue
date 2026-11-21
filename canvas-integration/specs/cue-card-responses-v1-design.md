# Cue card responses v1 design

## Component boundaries

The four changes reuse separate existing surfaces:

- **Project Confirmation:** `src/CueIntakePhases.gs` phase 1 and `src/IndexCards.html#phCardHtml`.
- **Project Requirements:** existing requirements review code in `src/CueIntakePhases.gs`, `src/CueAgentDrafts.gs`, and `src/IndexCards.html`; it remains separate from confirmation.
- **Email Intake Reroute:** `src/CueAgentDrafts.gs` and `src/IndexCards.html#agdIntakeHtml`.
- **Project Update:** existing read-only update rendering in `src/CueAgentDrafts.gs` and `src/IndexCards.html`.

The design does not merge these surfaces into one implementation or one approval action.

## Project Confirmation data flow

1. Read and validate Client, Account, Event Name, Event Date, Type, theme owner and deliverables.
2. Run duplicate/incomplete checks before creation.
3. Show one confirmation step.
4. Submit the existing project creation request with an idempotent request ID.
5. On success, classify in-house/outsourced work and route only the selected design outputs to MM and outsourced work to Procurement.
6. Reject records no write and no handoff.

## Reroute data flow

1. Receive mailbox, exact email ID, skip/flag reason and proposed destination.
2. Refuse unavailable reroutes if mailbox or exact email ID is missing.
3. Reuse the open card keyed by mailbox plus email ID.
4. Explicit Save builds one stable handoff request ID.
5. Existing agent handoff records Saved in Cue, waiting for Email Intake.
6. A receiver-confirmed acknowledgement changes it to Received by Email Intake.
7. Failure changes it to Couldn't deliver.
8. Retry reuses the original request ID and cannot create a second handoff.

## Requirements data flow

- Rows render folded.
- Expanded row state is local UI state.
- Edits remain attached to row IDs.
- Approval collects only checked eligible rows and their validated quantity/occurrences.
- Reject freezes pending rows on the card.
- Split is a preview-only request until AS is connected and tested.

## Update data flow

- Update data is read-only.
- All/Selected view changes only filter the rendered rows.
- No approval or send action is rendered or handled.

## Safety

No design document authorizes deployment or production use. Synthetic fixtures stay local. Live handoffs are future gaps.

## Approval state

- Spec: Approved by Kiko on 21 Nov 2026.
- Design: Approved by Kiko on 21 Nov 2026.
