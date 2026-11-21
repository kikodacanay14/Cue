# Cue card responses v1

## Scope

Four independent card changes:

1. Project Confirmation / New Inquiry
2. Email Intake Reroute
3. Project Requirements
4. Project Update

Each change has separate implementation, tests, acceptance evidence and real-handoff gaps.

## Project Confirmation / New Inquiry

The card uses the title **New project inquiry** and shows its source.

- The original message expands inline and includes inline images and source-file links.
- Editable fields are Client, Account, Event Name and Event Date. There is no project ID entry.
- The card preserves New Project and Reject.
- New Project is blocked by a duplicate result or incomplete required fields.
- Reject starts no project work.
- Retry uses the existing idempotent request outcome and cannot create a duplicate.
- Type accepts Event, Fabrication and Pass Through; at least one is required.
- Theme / Concept is editable.
- BSE to propose and Client to provide are mutually exclusive radios and neither is selected initially.
- A known theme is allowed with neither theme-owner radio selected.
- Client to provide waits for client direction.
- Deliverables Needed has exactly Pitch Deck, Venue Layout, Event Styling, Pub Mats, Event Collaterals, Wayfinders and Stage Layout.
- At least one deliverable is required for design work.
- Pass Through only requires no deliverable and bypasses Multimedia.
- After New Project approval, classify in-house versus outsourced work, send selected design outputs to Multimedia, and route outsourced work to Procurement.
- Selecting or clearing checkboxes/radios does not start work.

## Email Intake Reroute

- Show the original email, skip/flag reason and destination.
- Saving corrections requires explicit Save corrections action.
- State only as Saved in Cue, waiting for Email Intake; Received by Email Intake; or Couldn't deliver.
- Received appears only after receiver confirmation.
- The reroute key is original mailbox plus exact email ID.
- Reuse an existing open card with the same key.
- Missing exact email ID makes reroute unavailable and explains why.
- Same-subject emails remain separate.
- Retry sends a single handoff for the same key/request ID.
- Failure returns Couldn't deliver and allows a retry.
- Double-click cannot produce a second handoff.

## Project Requirements

- Requirements is a separate card surface from Project Confirmation.
- Requirement rows are folded initially.
- Expanding a row shows images/details.
- Editable values are quantity and occurrences.
- Each row has an optional row note.
- Split into scopes is preview-only until AS connection and test evidence exist.
- A split request includes scope count and comment.
- One approval button reads Approve selected or Approve all, based on the selected eligible rows.
- The card also provides Reject.
- An optional project comment accompanies approved requirements.
- There is no Send comments only action.
- Only ticked rows are approved.
- One edited row with a note, all rows, and Reject on a fresh card are acceptance cases.

## Project Update

- Read-only status card.
- Shows project, change and decision needed.
- Rows expand to status, blocker, owner and next step.
- Supports All requirements and Selected requirements views.
- Selected and all views are visibly labelled.
- No approval and no client-send controls.

## Synthetic preview boundary

Synthetic data means test-only fixtures for local UI and behavior verification. It may include fake email IDs, mailbox names, projects, rows and receiver names. It must not:

- replay or read the live inbox;
- send real email;
- push to Apps Script or `/dev`;
- create a deployment;
- create a real project or real handover;
- perform a live AS, MM or Procurement handoff;
- write test or real records to production.

Local inspection and rendering of `docs/mockups/cue-card-responses-v1/Cue-Card-Previews-v5.html` and local synthetic tests prove UI/local state behavior only.

## Future live handoff gaps

The following are future checks, not performed by this task:

- authorized project creation and handovers;
- real Email Intake reroute and receiver-confirmed acknowledgement;
- AS receipt of Split into scopes;
- live Project Update source and read-only output.

## Acceptance criteria

- Four card changes are independently implemented and tested.
- The local preview proves no real side effects occur.
- Project confirmation blocks duplicate/incomplete requests and duplicate retries.
- Pass Through bypasses Multimedia and requires no deliverable.
- Email reroutes distinguish exact emails with the same subject.
- Requirement approval cannot approve unchecked rows.
- Project Update has no action that approves or sends.

## Approval state

- Stories/rules: Approved by Kiko on 21 Nov 2026: the four proposed stories and CCR-R01 through CCR-R20.
- Feature Board: Mapping unsynced. The existing board was not accessible, so no cards or IDs were created or updated.
- Mockups: Approved by Kiko on 21 Nov 2026 for all four screens listed above.
- Spec: Approved by Kiko on 21 Nov 2026.
- Design: Approved by Kiko on 21 Nov 2026.

## Proposed stories and rules for review

These are prepared review materials, not saved Feature Board cards and not approved rules. The existing Feature Board and work-board are not available in this checkout, so no card ID or epic ID is invented.

### Epic CCR-A: Review and confirm project inquiries

#### Proposed story CCR-A1: Review a new project inquiry

**As** Kiko, **I want** one clear confirmation card that lets me verify a new project inquiry before work starts, **so that** duplicate, incomplete or wrong project requests are not created.

**Acceptance criteria**
- Given an inquiry card, when the source and editable fields are shown, then Client, Account, Event Name and Event Date are editable and no project ID is requested.
- Given no project type, when I try to confirm, then confirmation is refused.
- Given Pass Through, when I confirm, then no deliverable is required and Multimedia is not included.
- Given Event or Fabrication, when I confirm, then at least one deliverable is required.
- Given mutually exclusive theme-owner choices, when neither is selected and the theme is known, then confirmation may continue.
- Given Client to provide, when I confirm, then the card waits for client direction.
- Given duplicate or incomplete results, when I retry or confirm, then no second project is created.
- Given Reject, then no project work or handoff starts.

**Screens:** Project Confirmation / New Inquiry.
**Data:** Existing inquiry request and project-creation records; no new sheet contract is approved.
**Rules:** CCR-R01 through CCR-R07, below.
**Depends on:** None.
**Out of scope:** Live project creation, live MM/Procurement handoffs, and a new bridge payload contract.

### Epic CCR-B: Correct Email Intake routing safely

#### Proposed story CCR-B1: Save and review an Email Intake reroute

**As** Kiko, **I want** to correct an Email Intake route for one exact email and save it explicitly, **so that** the same-subject email is not mixed up with another email.

**Acceptance criteria**
- Given an original mailbox and exact email ID, when reroute details are shown, then both identify the exact email.
- Given a missing mailbox or exact email ID, then reroute is unavailable with an explanation.
- Given an existing open card with the same mailbox and email ID, then it is reused rather than duplicated.
- Given Kiko has not tapped Save, then no reroute handoff is sent.
- Given Save, then the card records Saved in Cue, waiting for Email Intake.
- Given receiver confirmation, then the card records Received by Email Intake.
- Given delivery failure, then the card records Couldn't deliver and allows one retry.
- Given a double tap or retry, then the exact email has only one handoff request.

**Screens:** Email Intake Reroute.
**Data:** Original mailbox, exact email ID, skip/flag reason, destination and handoff status; no live inbox replay is permitted.
**Rules:** CCR-R08 through CCR-R12, below.
**Depends on:** None.
**Out of scope:** Live Gmail replay, live Email Intake acknowledgement and live receiver handoff.

### Epic CCR-C: Approve project requirements precisely

#### Proposed story CCR-C1: Review and approve selected requirements

**As** Kiko, **I want** to expand requirement rows, edit selected values and approve only the rows I tick, **so that** approvals match my exact decisions.

**Acceptance criteria**
- Given a requirements card, then rows start folded.
- Given a row, when it expands, then details, images and row note are available.
- Given selected quantity or occurrences, then only the edited eligible row carries those values.
- Given unchecked or ineligible rows, then they are not included in approval.
- Given an approved or rejected decision, then the card records it without changing an unchecked row.
- Given a split request, then it remains preview-only until Account Specialist receipt is approved and tested.
- Given no checked eligible row, then the card does not present or perform a comments-only approval.

**Screens:** Project Requirements.
**Data:** Requirement row ID, description, quantity, occurrences, row note, eligibility, selection and status.
**Rules:** CCR-R13 through CCR-R17, below.
**Depends on:** None.
**Out of scope:** Live AS split receipt and live MM/Procurement routing from requirement approval.

### Epic CCR-D: Communicate project status without creating decisions

#### Proposed story CCR-D1: Review a read-only project update

**As** Kiko, **I want** to see a project update with status, blocker, owner and next step, **so that** I can review it without accidentally approving or sending it.

**Acceptance criteria**
- Given All or Selected requirements, then the card visibly labels and renders only that view.
- Given an expanded row, then status, blocker, owner and next step are visible.
- Given a waiting-for-approval update, then it remains read-only and shows no approval or client-send action.
- Given no live update source, then synthetic data cannot be represented as a live project result.

**Screens:** Project Update.
**Data:** Project, change, decision needed, row status, blocker, owner and next step.
**Rules:** CCR-R18 through CCR-R20, below.
**Depends on:** None.
**Out of scope:** Live update source, approval actions and client sending.

## Proposed rules — Waiting for Kiko

| Proposed rule | Plain meaning | Example | Depends on |
|---|---|---|---|
| CCR-R01 | At least one project type is required. | Event or Fabrication may continue; no type cannot. | CCR-A1 |
| CCR-R02 | Pass Through requires no deliverable and bypasses Multimedia. | A Pass Through inquiry may confirm with no design deliverable. | CCR-A1 |
| CCR-R03 | Event or Fabrication requires at least one deliverable. | An Event with no deliverable is refused. | CCR-A1 |
| CCR-R04 | BSE to propose and Client to provide are exclusive; neither may already be selected. | One theme-owner choice only. | CCR-A1 |
| CCR-R05 | A known theme does not require a theme-owner choice, but an unknown theme and no choice waits for direction. | Known Garden Launch may continue; unknown concept cannot. | CCR-A1 |
| CCR-R06 | Reject starts no project work and no handoff. | Reject records no project creation. | CCR-A1 |
| CCR-R07 | A retry cannot create a duplicate project. | The same request retried returns the existing successful result. | CCR-A1 |
| CCR-R08 | Reroute identity is original mailbox plus exact email ID. | Mailbox Kiko and email 101 are separate from email 102. | CCR-B1 |
| CCR-R09 | Missing mailbox or exact email ID makes reroute unavailable. | A same-subject email with no exact ID cannot be rerouted. | CCR-B1 |
| CCR-R10 | Received status requires receiver acknowledgement. | Saving is not proof that Email Intake received the email. | CCR-B1 |
| CCR-R11 | Save, retry and double click produce one handoff request for the same key. | A second tap uses the existing request. | CCR-B1 |
| CCR-R12 | Delivery failure is Couldn't deliver and permits retry. | A service failure does not report success or create another card. | CCR-B1 |
| CCR-R13 | Only ticked eligible requirement rows enter approval. | Unticked Photo Wall stays unchanged. | CCR-C1 |
| CCR-R14 | Quantity and occurrences must be valid before selected approval. | Blank or invalid quantity blocks that row. | CCR-C1 |
| CCR-R15 | One approval button approves selected eligible rows, or all eligible rows when all are selected; Reject remains separate. | Reject does not approve any row. | CCR-C1 |
| CCR-R16 | The card has no comments-only approval. | Notes alone cannot send an approval. | CCR-C1 |
| CCR-R17 | Split into scopes is preview-only until receipt and testing. | A preview split does not send work to Account Specialist. | CCR-C1 |
| CCR-R18 | A project update is read-only. | It has no approve or send controls. | CCR-D1 |
| CCR-R19 | All and Selected are display filters only. | Switching views does not change a decision. | CCR-D1 |
| CCR-R20 | Synthetic update data is not live status. | Test data may not imply a real project was read or sent. | CCR-D1 |
