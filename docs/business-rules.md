# Cue business rules — source-based first pass

Snapshot: [main 3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20](https://github.com/kikodacanay14/Cue/tree/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20), inspected 2026-11-02. Includes changes described as not deployed; this is not a live-runtime certification.

**Labels:** Implemented = inspected executable behavior; Documented = repository requirement/comment; Decision needed = discrepancy requiring review. Approval to save this documentation is not approval of every extracted behavior. Code is evidence, not authority to expand access or change business policy. Acceptance examples below are proposed checks, not claims that tests passed.

All source links pin the inspected snapshot. Runtime configuration, deployed code and current approval evidence must be checked before operational use.

## Security, architecture and routing

| ID | Rule, evidence and status | Acceptance example |
|---|---|---|
| CUE-001 | Documented: Cue is Kiko's personal command center; Canvas owns company/project records. AI must not directly write Canvas; approved operations use the signed bridge. [CLAUDE](../CLAUDE.md), [bridge](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueBridge.gs). | Proposed edits do not execute merely because AI generated them. |
| CUE-002 | Implemented: owner checks compare nonempty active/effective user emails; explicit internal scheduler/check flags bypass this guard. Not a complete endpoint audit. [cueOwner_](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/Cue.gs#L72-L78). | Another interactive user cannot execute owner actions. |
| CUE-003 | Implemented: bridge validates configured Apps Script /exec URL, signs timestamp/body, uses fixed command identities and payload hashes for claimed plans. Server enforcement/live configuration unverified. [CueBridge](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueBridge.gs). | A changed payload cannot masquerade as the original approved command. |
| CUE-004 | Documented: no bank details in links; no Kiko e-signature in Canvas/info@ Drive. Production and sending have separate approval gates. Scoped automatic exceptions below do not create general permission. [CLAUDE](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/CLAUDE.md). | Record-edit approval does not authorize email or deployment. |
| CUE-005 | Implemented: ordered first-match command routing. Broad keyword changes can intercept existing flows. [CueCommands](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueCommands.gs), [generated feature map](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/FEATURE-MAP.md). | A pending-flow reply resumes its flow rather than starting generic intake. |

## Drafts, messages and intake

| ID | Rule, evidence and status | Acceptance example |
|---|---|---|
| CUE-006 | Implemented: mail approval needs Needs you plus a draft; validated edits precede draft creation. Sending needs send selection; stored draft/sent IDs support retry. [CueMail](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueMail.gs#L116-L145). | Draft-only does not send; recorded sent ID is not resent. |
| CUE-007 | Implemented: missing reply thread can fall back to new email with a note; multiple named recipients become To recipients. Confirmation policy for ambiguous recipient/thread fallback needs decision. [CueMail](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueMail.gs#L73-L90). | Missing original thread is not represented as verified reply. |
| CUE-008 | Implemented: RFP outbox sends previously queued items as Kiko with lock/lease and batch limits. Persistent send markers allow Canvas-report retry without resend. Crash after Gmail send but before marker remains uncertain, not guaranteed exactly once. [CueRfpSend](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueRfpSend.gs). | Recorded send + Canvas outage causes report retry only. |
| CUE-009 | Implemented: mail categories have Own chat/One line/Ignore defaults; known sender/domain rules precede AI. One line/Ignore may remove UNREAD; project-ID mail retains unread for Team Cue. This differs from dot's preserve-read-state automation and cannot override it. [CueMailTypes](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueMailTypes.gs). | Test read state per application/category, not a universal rule. |
| CUE-010 | Implemented: separate approvals for project registration, scope lines without costs, costs/prices, and individual RFQs. Unknown date becomes TBC; missing folders are reported. [CueIntakePhases](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueIntakePhases.gs#L316-L388). | Scope approval cannot send RFQs. |
| CUE-011 | Implemented: cost approval strips unrelated quantity/status/removal/event/client/RFQ changes. Server saved=false with revised numbers returns for reapproval. [cost phase](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueIntakePhases.gs#L316-L388). | Changed costs cannot reuse approval of an older version. |
| CUE-012 | Implemented: RFQ send/draft/cancel checks phase/state, busy guard and recipient; failed Canvas logging does not undo a sent email. External-send/local-save crash window still exists. [RFQ action](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueIntakePhases.gs#L442-L478). | Report sent/logging failed accurately after partial success. |

## Project and personal expenses

| ID | Rule, evidence and status | Acceptance example |
|---|---|---|
| CUE-013 | Implemented: project expense routes are existing request, existing scope, new scope, cannot record. IDs come from selected-project evidence; new scope requires an existing CE requirement. [CueExpense](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueExpense.gs#L176-L215). | Valid-looking ID from another project is rejected. |
| CUE-014 | Implemented: paid requires date; proof requires file; amount positive. Guessed project, duplicate and award conflicts become doubts. Existing awarded quotes are not silently moved. [validation](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueExpense.gs#L176-L215). | Ambiguous project/proof is not cleanly recorded without resolution. |
| CUE-015 | Implemented: approval checks doubts/IDs/file hashes, stable request identity and server verification; partial steps persist. Done differs from Done/check Canvas. Recording is not payment. [approval](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueExpense.gs#L228-L270). | Changed evidence bytes require review; partial stop is not total success. |
| CUE-016 | Implemented: internal transfers/incoming/refunds excluded from ordinary expense selection; receipt-only may save evidence without paid amount; unknown numbers remain blank. [CuePersonal](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CuePersonal.gs), cuePeCheck_/cuePeWrite_. | Unpaid receipt does not inflate paid spending. |
| CUE-017 | Decision needed: comments describe exact reference but code uses normalized substring matching for references at least six characters. Possible-duplicate fallback uses date/amount/payee word overlap only if at least one reference missing. [cuePeCheck_](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CuePersonal.gs#L155). | Decide whether ABC123 and XABC123Y must be distinct before asserting exact-match behavior. |
| CUE-018 | Implemented, policy risk: project matching uses reference containment or amount/payee overlap; unavailable BSE sheet checks are noted, not universal stop. New items may default Personal Expense. [CuePersonal](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CuePersonal.gs). | Missing project evidence is not proof of personal classification; define blocking cases. |
| CUE-019 | Implemented: locked writes reread references, skip saved rows, preserve detected formula columns, keep reference/account text and verify readback. Exception: selecting an already-classified duplicate can bypass normal duplicate guard. [approval/write](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CuePersonal.gs#L199). | A duplicate override needs an explicit auditable reason if retained. |
| CUE-020 | Implemented: bank proof, merchant confirmation, receipt-only and Kiko-message evidence have distinct status wording. Merchant confirmation does not claim bank settlement. [CuePersonal](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CuePersonal.gs), cuePeWrite_. | Two evidence documents for one purchase do not automatically become two purchases. |

## Readiness, schedules and follow-ups

| ID | Rule, evidence and status | Acceptance example |
|---|---|---|
| CUE-021 | Implemented: Canvas checklist/counts are authoritative; AI adds analysis/evidence hints, not readiness rescores. AI IDs are filtered to supplied evidence. [CueReady](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueReady.gs). | AI cannot mark an absent approval met. |
| CUE-022 | Implemented: readiness follow-ups require waiting-on-others item and found mail; deduplicate recipient; approval replies in thread. Bounded snippets/metadata search does not verify every attachment. Configured generated reply-by dates are proposals, not commitments. [CueReady](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueReady.gs). | State unchecked attachment/deadline assumptions explicitly. |
| CUE-023 | Implemented: Manila schedules process bounded due jobs; next/last advanced before execution; no unlimited replay backlog. This is not guaranteed successful completion of every occurrence. [CueSchedule](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueSchedule.gs). | Error is recorded; failed business work is not marked complete. |
| CUE-024 | Documented wording conflict: scheduler “never sends” has an explicit RFP outbox exception for previously approved sends. Defaults are not proof of currently enabled schedules. [CueSchedule](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueSchedule.gs). | Ordinary review jobs cannot borrow the outbox's send authority. |
| CUE-025 | Implemented: per-kind configurable chase timing, dedup/mute/next-date/max/cap gates. Draft-only can increment chase count and advance next chase without actual contact. Defaults differ from dot's five-business-day rule. [CueSweep](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueSweep.gs#L317-L374). | Distinguish prepared drafts from sent follow-ups; decide whether a draft consumes chase allowance. |

## Contacts, CRM and Messenger

| ID | Rule, evidence and status | Acceptance example |
|---|---|---|
| CUE-026 | Implemented: P0 then bounded Gmail contact lookup; fuzzy names/ranking are supported, not exhaustive or guaranteed identity verification. [CueContacts](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueContacts.gs). | Two plausible same-name people are not silently called verified. |
| CUE-027 | Implemented: signature scan proposes blank title/company/phone fills from bounded recent evidence. Values match cited signature; phones validated; BSE own values excluded. Approved exact fills use bridge/server results. [CueContactScan](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueContactScan.gs). | Preserve existing manually supplied contact title. |
| CUE-028 | Implemented: HubSpot fixes selected/bounded; pipeline review read-only. Header says every open deal but implementation caps fetched/AI-reviewed evidence and reports truncation. [Hubspot](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueHubspot.gs), [Pipeline](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CuePipeline.gs). | Truncated review cannot claim complete coverage. |
| CUE-029 | Documented scoped automatic exception + implemented: known-client email metadata log, not bodies, bounded hours/batches; thread/email/day identity and bridge requests support dedup. Current standing approval unverified. [CueCrmLog](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueCrmLog.gs). | Repeat identity does not create a second log; no general automatic CRM editing. |
| CUE-030 | Documented scoped automatic exception + implemented, deployment unverified: Messenger sign-link send requires token, known recipient, unsigned document and valid inbound age under 24 hours. Marker supports report retries. Relay security not fully audited. [CueMessenger](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueMessenger.gs). | Missing token, future timestamp or expired window means no send. |

## Branding and documentation discipline

Mandatory repository instructions and their source map belong in root/subdirectory guides. Do not convert code's current fonts/colors into approved brand policy. See [decisions](decisions.md) for known drift. FEATURE-MAP.md is generated with tools/map.mjs and checked by test/features/48-feature-map.js; do not hand-edit it.

Existing requirement: three panes (chat, threads, viewer), no Widgets page, no Due/Priority/Remind row, thread name opens it, cards minimize. New presentation changes still require current canonical brand guidance and applicable approval.

## Coverage / explicit unknowns

Inspected project instructions and feature map; relevant bridge/owner guards, route registry, mail approval/RFP outbox, phased intake, expense validation/write paths, readiness/follow-ups, scheduling/chasing, contacts, HubSpot, CRM logging, mail types and Messenger send gates.

Not exhaustive: every route, chaser plugin, CE-cost workflow, frontend/extension, full relay security, Canvas backend enforcement or every test. Not verified: deployed equivalence, Script Properties/Rules sheets, standing approvals, actual mailbox/CRM/ledger records, or runtime/end-to-end correctness. Acceptance examples are a proposed regression inventory, not an execution report.

When changed code alters a rule: update its stable ID, source evidence, approval status, exception, regression example and coverage; add the decision history without deleting old reasoning. Do not assert behavior approved merely because it exists.
