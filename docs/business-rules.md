# Cue business rules — source-based first pass

> **From 25 Nov 2026:** new decisions and approved rule changes are recorded on the Delivery Board's Decisions tab
> (https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP, collection `decisions`), as the "BSE development instructions" section of `AGENTS.md` requires. This file keeps
> the earlier record and stays the reference for it. Kiko, 25 Nov 2026: "all md files being referenced and used by agents need to be updated".

Status on main (checked 3 Nov 2026; CUE-046 and CUE-047 added 6 Nov 2026): brought onto main from PR #294 as written there. It reads Cue main (snapshot 3080b1c).
Cue main and the live line have split: branch `claude/project-thread-y5l4x9-rel1285fix` (live, Version 191) has 256 commits main lacks,
so a rule here can differ from what is live until main is reconciled with that line. The Canvas catalog is
CanvasWorkspace `docs/business-rules.md`.

**Version correction:** The original catalog below is an older main snapshot. See [Newer-release correction](#newer-release-correction-p-statuses-and-operating-processes) for updated P0–P9 behavior, C2/accreditation processes, HubSpot removal and unresolved coexistence/runtime differences.

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
| CUE-030 | Documented scoped automatic exception + implemented, deployment unverified: Messenger sign-link send requires token, known recipient, unsigned document and valid inbound age under 24 hours. Marker supports report retries. Relay security not fully audited. Message on FB exception (Cue 1.28.47, live V227, 7 Nov 2026; Kiko 10:55Z to 10:59Z asks, "build" 15:23Z, "deploy" 16:16:25Z): when Canvas lists a paper with `now_at` (staff tapped Message on FB in Resources), Cue sends it once more even if it went on Messenger before; the same token, recipient, unsigned and 24-hour checks apply; the mark's request id adds `now_at` (`msgr:<doc>:<id>:<now_at>`), so each ask is marked once and a retry after a delivered send only reports. Acceptance: `test/features/91-msgr-now.js` MN1 to MN3; live delivery not yet tested. Canvas rule: CanvasWorkspace docs/business-rules.md, RES-DOC-MENU-2026-11-07. [CueMessenger](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueMessenger.gs). | Missing token, future timestamp or expired window means no send. |

## Branding and documentation discipline

Mandatory repository instructions and their source map belong in root/subdirectory guides. Do not convert code's current fonts/colors into approved brand policy. See [decisions](decisions.md) for known drift. FEATURE-MAP.md is generated with tools/map.mjs and checked by test/features/48-feature-map.js; do not hand-edit it.

Existing requirement: three panes (chat, threads, viewer), no Widgets page, no Due/Priority/Remind row, thread name opens it, cards minimize. New presentation changes still require current canonical brand guidance and applicable approval.

## Coverage / explicit unknowns

Inspected project instructions and feature map; relevant bridge/owner guards, route registry, mail approval/RFP outbox, phased intake, expense validation/write paths, readiness/follow-ups, scheduling/chasing, contacts, HubSpot, CRM logging, mail types and Messenger send gates.

Not exhaustive: every route, chaser plugin, CE-cost workflow, frontend/extension, full relay security, Canvas backend enforcement or every test. Not verified: deployed equivalence, Script Properties/Rules sheets, standing approvals, actual mailbox/CRM/ledger records, or runtime/end-to-end correctness. Acceptance examples are a proposed regression inventory, not an execution report.

When changed code alters a rule: update its stable ID, source evidence, approval status, exception, regression example and coverage; add the decision history without deleting old reasoning. Do not assert behavior approved merely because it exists.

## Newer-release correction: P statuses and operating processes

Updated 2026-11-03 (Asia/Manila), after Kiko identified recent Cue changes. This section qualifies the older main-based CUE-025/CUE-028 descriptions; it does not silently replace their historical evidence. Inspected release branch `claude/project-thread-y5l4x9-rel12790` at [fe2987aaa1d604f9e621b1f3887f4889bd2116ef](https://github.com/kikodacanay14/Cue/tree/fe2987aaa1d604f9e621b1f3887f4889bd2116ef), separate from main 3080b1c and this documentation branch.

The release [CHANGELOG.md](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/CHANGELOG.md) describes Cue 1.28.3 as LIVE Version 189, dated 2026-11-02 06:15Z. That is repository release documentation, not a live endpoint/deployment verification. Do not infer that main, preview, scheduled trigger code and live /exec are identical. No live settings, enabled schedules or actual production run were inspected for this correction.

### CUE-031: Company priority is a status, not a universal action authorization

The newer [src/CueFunnel.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueFunnel.gs#L28-L30) labels and [src/CueFunnel.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueFunnel.gs#L93-L135) processing distinguish these stages:

| P status | Meaning / process in the inspected newer release | What it does not establish |
|---|---|---|
| P0 | Prospecting/validation. Read valid company rows from P0 master and count companies/contacts. | No automatic first-contact permission or P0-to-P1 transition inferred. |
| P1 | Intro email sent. Count follow-up due when LastOutreachDate is valid and not future, no response marker is recognized, and at least three weekdays elapsed. | A due count is not an email, verified current conversation review or stage change. |
| P2 | Following up every three business days. Same due calculation as P1. | This does not mean every P2 company enters the C2 quiet-inquiry chaser. |
| P3 | Parking lot. Count/report the stage, exclude from the newer P1/P2 due count. | No automatic winback or automatic parking transition inferred. |
| P4 | Accreditation in progress. Count open accreditations; the accreditation collector below can gather matching incoming mail. | Collection is not accreditation approval, automatic chasing or a P4-to-P5 transition. |
| P5 | Accredited, waiting RFP. Count/report stage. | Do not relabel every P5 company dormant or assume inactivity. Legacy account-research behavior remains separate. |
| P6 | Receiving RFPs. Count/report RFP-stage companies. | The funnel report itself does not register projects or set P6. |
| P7 | Project won/active. Count/report won-stage companies. | Report does not award a project or move a company back after an event. |
| P8 | Project at risk. Include company in risk reporting. | No issue creation, automatic escalation or inferred send authority. |
| P9 | Escalated/has issues. Include company in risk reporting, distinct from P8. | No automatic clearance or overwrite of manual escalation. |

Company Priority List meanings were cross-checked earlier in [Summary](https://docs.google.com/spreadsheets/d/1PBpIi7tu4Tziuhivpd7IYdC9tZyF_cls1Mn2H3RqTBE/edit#gid=1298602881), A4:C14. That earlier cross-source check is distinct from this fresh code inspection: P0 means found/not contacted, P1 intro sent, P2 three-business-day follow-up, P3 parking, P4 accreditation in progress, P5 accredited awaiting RFP, P6 receiving RFPs, P7 won/active, P8 risk, P9 escalation/issues. No spreadsheet edits were made.

### CUE-032: Funnel reporting and movement detection

Implemented: `cueFunnelP_` reads the P0 company master; P1/P2 due recognition uses LastOutreachDate and response text matching reply/response, with no/not-reply exclusions. `cueFunnelPmap_` / previous-map / moves helpers compare snapshots and describe new companies and changed stages. **Detecting a transition is not executing a transition.**

Process: scheduled funnel run → company/contact counts and due checks → compare prior stage snapshot → add bounded Canvas deal checks → produce a plain-language update. [src/CueSchedule.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueSchedule.gs#L159-L187) defines `sys-funnel` weekdays 13:15 to feed the 2PM update; Monday funnel review is off by default. These are code defaults, not proof of enabled runtime settings.

[src/CueFunnel.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueFunnel.gs#L136-L159) reports P1/P2 due, Canvas follow-ups due tomorrow, deals waiting on award/gone quiet and P8/P9 risks. Additional checks in [src/CueFunnel.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueFunnel.gs#L171) flag qualifying incoming mail waiting on Kiko for at least one weekday, events today/within fourteen days not won, and missing amount/date/contact or past event dates on open deals. Coverage is bounded (up to forty deals; newest three mail metadata records within 120 days, automated messages filtered), not exhaustive evidence review. These are deterministic checks, not an AI policy decision.

Acceptance examples: P3 does not enter the newer P1/P2 due count; changing a fixture P1 to P2 produces a reported movement without a stage-write operation; a truncated deal review is explicitly limited.

### CUE-033: C2 quiet-inquiry follow-up is not the P2 company status

The newer chaser work in [PR271](https://github.com/kikodacanay14/Cue/pull/271) is Cue 1.27.92. [src/CueSweepFunnel.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueSweepFunnel.gs#L39-L76) selects a quiet **Inquiry with an email address**, not all P2 companies. Registered C2 timing is two follow-ups, three working days apart, with the C2 template and sendAllowed enabled. [src/CueSweep.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueSweep.gs) supplies the chase gates; enabling send capability is not itself approval to send.

Process (corrected 2026-11-03): eligible inquiry → due/mute/dedup/max gates → chase choices presented in the 2PM update → selection prepares a draft → Kiko approves that individual message → permitted send path. The earlier documentation said 8AM; PR270's final merged 1.27.93/94 changes moved chasers to 2PM and made numbered selection draft-only. That superseded wording is retained here as history, not current behavior (CUE-037/038, CUE-D18). PR271 documents flagging the item for parking after the two follow-ups; automatic Canvas stage parking was deferred to a later part, not implemented by this registration. Winback was removed from registration even though old helper functions remain. C4 accreditation-status chasing was deferred; it is not the accreditation-mail collector.

Acceptance examples: a P2 company without an eligible Inquiry is not a C2 item merely because of P2; no third C2 follow-up is assumed; flag-to-park does not write P3; preparation and actual contact remain distinct (CUE-D04).

### CUE-034: Accreditation mail gathering is a separate workflow

[src/CueAccred.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueAccred.gs) collects matching accreditation mail every thirty minutes within the five-minute tick. It considers P4 companies and accreditation/vendor-registration/supplier-registration/enrollment subject keywords; matching company identity uses company domain or exact personal email and excludes own/BSE addresses. The scan is bounded to three days and forty messages.

Process: match new incoming evidence → deduplicate message identity → create/update one “Accreditation · company” Cue thread → mark Needs you; later new mail can reopen a Done thread. It writes Cue's internal thread state, not Gmail/Canvas records, and does not send email or approve accreditation. Acceptance: repeated message does not duplicate; genuinely new reply reopens; another company sharing no verified identity is not silently attached.

### CUE-035: Canvas owns CRM transitions; Cue can trigger its tick

[src/CueCrmTick.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueCrmTick.gs) calls the signed Canvas bridge `crm_tick` every fifteen minutes. Canvas owns the backend CRM transition logic. “The Cue funnel does not write stages” must not be misread as “Cue cannot trigger Canvas CRM work.”

Earlier Canvas inspection reported Inquiry→P6, Won→P7, return to P6 two weeks after the event, Issue (not Risk alone)→P8 and preservation of manual P9. Those are earlier cross-source findings, not a fresh verification of the currently deployed Canvas backend. Verify the actual Canvas version, its contract, authorization and test evidence before treating these as live transition guarantees.

### CUE-036: HubSpot removal and version-specific coverage

[PR275](https://github.com/kikodacanay14/Cue/pull/275), Cue 1.27.96, removed HubSpot from the newer Cue release (cleanup, pipeline, task list and Add to HubSpot). CUE-028 above describes old main evidence only and is **not a statement that HubSpot remains a current newer-release workflow**. [PR277](https://github.com/kikodacanay14/Cue/pull/277), Cue 1.27.97, added the three funnel checks described above. Both belong to the newer release history, not the inspected old main snapshot.

### Unresolved timing and runtime differences

1. **Legacy follow-ups still coexist.** Newer-release [src/CueGptTasks.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueGptTasks.gs#L372-L374) still contains P1 last contact +15 calendar days, P2 first contact +one month or last contact +15 calendar days, and P4 last contact +two calendar days; recorded NextFollowup may override category timing. The old follow-up definition/route remains. The schedule off-migration does not include that follow-up task. Its actual enabled state and whether users still invoke it are unverified. Do not present either implementation as the sole global rule.
2. **“Business days” is not implemented uniformly.** [src/CueDates.gs](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueDates.gs#L13-L40) `cueAddWork_` excludes weekends, fixed Philippine holidays and configured CUE_HOLIDAYS for C2. `cuePipeWorkDays_`, used for P1/P2 funnel due counts, counts weekdays only. Holiday-adjacent results can differ.
3. **Legacy account research is not a canonical P5 meaning.** CueGptTasks can select P5 or not-accredited companies and describe dormancy without proving inactivity. Keep that discrepancy separate from the P5 definition.
4. **Approval and live state remain separate evidence.** This documentation update records observed code, release notes and unresolved conflicts; it approves no sends, stage changes, schedules or deployment. Feature Board mapping remains unsynced.

Tests inspected, not executed for this correction: [test/features/63-funnel-p-stages.js](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/test/features/63-funnel-p-stages.js) (P1/P2 timing, P3 exclusion, read-only funnel, movement reporting); [test/features/66-client-accreditation.js](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/test/features/66-client-accreditation.js) (identity, dedup/no-send, reopen, thirty-minute gate); [test/features/74-chaser-templates.js](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/test/features/74-chaser-templates.js) (working-day/holiday helpers). Proposed next regression cases: same holiday-crossing dates across funnel and C2; simultaneous old follow-up/new funnel eligibility; stale/false response markers; P2 without Inquiry; two completed C2 follow-ups without an automatic P3 write. Passing documentation-branch CI would not establish newer-release or live behavior.


## Requested PR audit: 270, 274 and 277 (2026-11-03)

These are merged historical changes, not certification of a currently deployed app. PR titles, initial descriptions and author-attributed approval must be reconciled with final diffs. Documentation publication approval does not approve undocumented assumptions or implement fixes.

| PR | Final inspected head / chronology | Scope and evidence status |
|---|---|---|
| [270](https://github.com/kikodacanay14/Cue/pull/270) | [78667a0b5ea52be83009b80005c6b8955e3015af](https://github.com/kikodacanay14/Cue/tree/78667a0b5ea52be83009b80005c6b8955e3015af); merged 2026-11-01 02:55Z into claude/cue-canvas-look | Title describes 1.27.91; final merged changes also contain 1.27.92–94. Initial immediate-send / morning-chaser wording is superseded within the PR. |
| [274](https://github.com/kikodacanay14/Cue/pull/274) | [ec726aa0447aadb8240886d8f283025621724684](https://github.com/kikodacanay14/Cue/tree/ec726aa0447aadb8240886d8f283025621724684); merged 2026-11-01 04:47Z into claude/project-thread-y5l4x9-rel12790 | 1.27.95 tracker/timeline input. PR/code attribute answers to Kiko; attribution is not independent access to the original conversation. |
| [277](https://github.com/kikodacanay14/Cue/pull/277) | [db19062530b55fb94bf1835b5f97070a5ae3e2e5](https://github.com/kikodacanay14/Cue/tree/db19062530b55fb94bf1835b5f97070a5ae3e2e5); merged 2026-11-01 07:30Z into claude/project-thread-y5l4x9-rel12790 | 1.27.97 deterministic three-check funnel addition after HubSpot removal; complements CUE-032/036 rather than reinstating HubSpot. |

### CUE-037: Separate 8AM work summary from 2PM chasers

Observed final PR270 behavior: weekday 8AM combines today's focus, opportunities and clients; chasers belong in the 2PM update. Omit empty sections. When the consolidated update is enabled, routine background-job posts are quiet in the main chat, but failures remain visible; disabling consolidation restores the old routine-post behavior. Configuration defaults do not prove enabled live jobs.

Evidence: [CueMorning](https://github.com/kikodacanay14/Cue/blob/78667a0b5ea52be83009b80005c6b8955e3015af/src/CueMorning.gs), [schedule](https://github.com/kikodacanay14/Cue/blob/78667a0b5ea52be83009b80005c6b8955e3015af/src/CueSchedule.gs), [morning tests](https://github.com/kikodacanay14/Cue/blob/78667a0b5ea52be83009b80005c6b8955e3015af/test/features/73-morning-update.js). Acceptance: no chase selection in 8AM; quiet mode must not suppress a failure.

### CUE-038: Numbered selections prepare drafts, not sends

Observed final PR270 behavior: even a numbered instruction such as “send 1,3” selects and prepares drafts; each message still requires its own Send action. A reply to a specific update must use that update's choices, including on a later day, rather than reinterpret numbers against today's latest update. This documents Cue's implementation, not permission for this assistant to send.

Template tailoring uses the latest email to adjust the middle while preserving the greeting and ending. Invalid AI tailoring falls back to the original template; an invalid requested rewrite is rejected. The inspected validator checks the greeting/ending; do not infer that every semantic or branding constraint is mechanically enforced.

Evidence: [morning tests](https://github.com/kikodacanay14/Cue/blob/78667a0b5ea52be83009b80005c6b8955e3015af/test/features/73-morning-update.js), [reply tests](https://github.com/kikodacanay14/Cue/blob/78667a0b5ea52be83009b80005c6b8955e3015af/test/features/75-reply-bids-card.js), [templates](https://github.com/kikodacanay14/Cue/blob/78667a0b5ea52be83009b80005c6b8955e3015af/src/CueTemplates.gs). Acceptance: selection alone produces zero sends; a stale-card reply cannot target a different item.

### CUE-039: Undecided opportunities and contacts are not silently declined

Observed PR270 behavior: detailed bid cards expose source/agency, ABC, closing date, reference, requirements, missing information and document links, with View, Ask agency, Decline and Start intake actions. Scrolling past is not decline; an undecided bid remains until closing. The former Decide later action was removed. New contacts remain candidates until Add or Decline; failing to select them does not discard them.

Evidence: [bid/reply regression cases](https://github.com/kikodacanay14/Cue/blob/78667a0b5ea52be83009b80005c6b8955e3015af/test/features/75-reply-bids-card.js). These actions retain their own approval/validation boundaries; a displayed link is not proof its document was read.

### CUE-040: 8AM work groups come from the tracker and ongoing projects

Observed PR274 behavior: read Shared Task Tracker Tasks plus Canvas client_status for ongoing projects' timeline/open TRI. The ongoing-project selection follows the Friday-status list. Produce separate Critical today, Overdue, Assigned to you, Needs review, Nudge team, Blocked, Key milestones (next three days), and Personal groups. Team nudges cover overdue, today and tomorrow items. Personal work stays separate.

Completed is based on done status and the relevant updated period; Moved compares due dates with the previous 8AM snapshot. Missing or failed source reads must disclose the gap while retaining usable independent sections. This grouping is deterministic, not an AI judgment. The final inspected release limits each displayed group to eight entries plus a remaining-count line; upstream source bounds remain a separate limitation.

Evidence: [PR274 work gathering/grouping](https://github.com/kikodacanay14/Cue/blob/ec726aa0447aadb8240886d8f283025621724684/src/CueMorning.gs#L121-L195), [regression cases](https://github.com/kikodacanay14/Cue/blob/ec726aa0447aadb8240886d8f283025621724684/test/features/76-k0-tracker-timeline.js), [later inspected grouping](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueMorning.gs#L145-L195). The tomorrow-as-critical and upstream TRI-cap discrepancies below mean the labels cannot be treated as fully verified scheduling guarantees.

### CUE-041: Three bounded Canvas funnel checks, not sales decisions

This supplements CUE-032/036 with PR277's exact boundaries. For open Inquiry or CE sent projects:
1. Flag waiting for your reply when the latest qualifying incoming email is at least one working day old.
2. Flag an event from today through fourteen days ahead as soon but not won.
3. Flag a past event still open, or missing amount, event date or contact, for correction in Canvas.

This is a deterministic report, not an email send, award, stage change or new permission. The implementation examines at most forty projects ordered by event date and up to three recent metadata messages per contact in a 120-day lookback, filtering automated messages. It does not establish full-thread/attachment coverage. Missing amount is flagged when priced is explicitly false; an unknown priced value is not equivalent to a confirmed missing amount. At least one available contact name/email satisfies the inspected contact check, not a guarantee the contact is current or verified.

Evidence: [PR277 code](https://github.com/kikodacanay14/Cue/blob/db19062530b55fb94bf1835b5f97070a5ae3e2e5/src/CueFunnel.gs#L160-L220), [regression cases](https://github.com/kikodacanay14/Cue/blob/db19062530b55fb94bf1835b5f97070a5ae3e2e5/test/features/54-sales-funnel.js#L126-L151). Acceptance: do not label bounded coverage exhaustive, or interpret an event date as an award.

### Discrepancy register for this PR audit

- **CUE-D18, documentation corrected:** CUE-033 previously said 8AM. PR270 final merged behavior separates 8AM summary from 2PM draft-first chasers. The old PR title/body is not the final contract.
- **CUE-D19, unresolved implementation defect:** tomorrow's assigned-to-Kiko task can enter Critical today. The inspected grouping uses overdue versus all other eligible dates, rather than a distinct tomorrow classification. [Review](https://github.com/kikodacanay14/Cue/pull/274#discussion_r4434436237); [still present in inspected later source](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueMorning.gs#L183-L193). No code fix made; deployed behavior unverified.
- **CUE-D20, unresolved upstream coverage risk:** client_status can cap TRI rows at twelve before priority sorting, potentially omitting a later urgent item. [Review](https://github.com/kikodacanay14/Cue/pull/274#discussion_r4434436234); [inspected Cue bridge fixture](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/test/fixtures/ZapBridge.gs#L1310-L1387). The fixture is evidence of an expected contract, not verification of the deployed Canvas backend.
- **CUE-D21, bounded funnel evidence:** PR277's forty-project / three-message metadata limits and explicit-false amount test can miss an actionable item or unresolved price. Report those limits rather than claiming exhaustive coverage; confirm current requirements before proposing implementation changes.
- **Existing CUE-D12/D14/D17 remain open:** legacy timing coexistence, weekday-versus-holiday counting and unverified deployment/configuration are already recorded above. Do not duplicate them as newly answered policy or silently resolve them through this documentation edit.

Verification: final PR metadata, diffs, discussions, selected source and test assertions were inspected. Tests were not executed in this documentation audit. No application code, test, schedule, Feature Board, merge or deployment changed.

## Cue Admin › Templates (Cue 1.28.12, PR #308, 2026-11-03)

### CUE-042: Templates come only from the doc; Save writes one template back after Kiko's tap

Intended policy: spec #391 (CanvasWorkspace `docs/specs/message-templates-from-doc.md`, approved by Kiko 1 Nov 2026) makes the
"BSE Message Templates Revised" doc the only source of message wording. On 3 Nov 2026 Kiko chose "Give info@ Editor on the doc" so edits
save from the page (Feature Board card `cue-admin-templates-page`, qa entry 1).

Implemented in `src/CueMsgTemplates.gs` and `src/IndexPages.html`:
1. The page reads every template through Canvas (`message_templates`) and keeps no copy of any wording. If Canvas or the doc cannot be read,
   the list is empty and the error is shown.
2. The preview is Canvas's render in draft mode (`message_render`). Fill-ins stay as `{{name}}`.
3. Send me a test goes from Kiko's Gmail to the signed-in user only, subject "[Test] …", Email channel only. It is not logged in Canvas's
   Template Sends, because it is not a send to a recipient.
4. Edit first re-reads the template from the doc, so the editor starts from the doc as it reads at that moment.
5. Save to doc is Kiko's tap. It sends Canvas one claimed bridge write (`message_template_save`, plan plus payload hash) with the key, the
   subject and the message as blocks: paragraphs split by a blank line, and a paragraph written `[Words](link)` becomes the button. The
   inbox, CC and attachments are not sent (Canvas does not accept them). Canvas reads the template back, and a read-back that differs is
   shown as an error. An empty message, more than 60 paragraphs, or a paragraph over 5,000 characters is refused before anything reaches
   Canvas (the bridge's own limits).
6. When Canvas answers a save with Uncertain (the write ran but did not read back the same, seen on /dev 3 Nov 2026 when a button
   lost its format), the page never says "Not saved". It says the doc was written but not confirmed, closes the editor and reloads
   the list, so Kiko sees what the doc holds now.

Evidence: `test/features/84-templates-page.js` (MT1 to MT7). Manual gap: the live check on /dev against the live Canvas release (list,
preview, test email, one Save and its read-back) is still owed. Acceptance: no wording is shown when the doc cannot be read; a test email
reaches only Kiko; a Save changes only that template's Subject, message and button paragraphs.

- **CUE-D22, decision needed:** Save has no revision check. If the doc is changed after Edit re-reads it and before Save, the Save
  overwrites that change (last save wins, as in Canvas `message_template_save`). Adding a refusal is a new rule and needs Kiko's yes; it is
  asked on the Feature Board card.
- **CUE-D23, decision needed:** spec #391 says "No AI writes any part" of a templated message, while the 2 PM chaser tailoring (CUE-038)
  has AI adjust the middle sentences ("go with both", 1 Nov 2026). This build changes neither. It matters when Cue's emails switch to the doc.


## Cue 1.28.19.1 and 1.28.20 (PRs #319, #320, #321, shipped together as Version 199 and Version 200)

### CUE-043: GitHub Actions cost is typed in by hand and only displayed (code tag `GH-ACTIONS-COST`)

Intended policy: Kiko asked on 4 Nov 2026 at 13:05Z: "can you add in the page where we compute possible AI usage and cost". At 13:10Z
he added: "im upgrading to pro github". The release went live after Kiko said "ship" on 5 Nov 2026 at 03:42Z. This is a display. It is
not a guard: it blocks nothing and calls nothing.

Implemented in `src/CueUsage.gs` (`cueUsageGh_`, `cueUsageGhView_`) and `src/IndexPages.html`, under Settings › AI usage and cost:
1. Cue reads nothing from GitHub. Five figures are typed in under Prices used (editable) and saved in script property `CUE_AI_PRICES`,
   key `gh`: used so far, the "as of" date, included each month, budget cap and plan fee. A blank, negative or non-numeric value keeps
   the old figure.
2. Billed so far = used minus included, never below 0 and never above the cap. The likely month end uses the same daily rate. The day
   the cap runs out is shown when it falls inside the month.
3. When the "as of" date is in an earlier month, the card flags the figures as old and shows no projection.

Verified versus assumed:
- Verified: US$18 of Actions is included each month on GitHub Pro (docs.github.com, "GitHub Actions billing", read 4 Nov 2026).
- Unverified: the US$4 Pro plan fee, which is not on github.com/pricing (read 4 Nov 2026). It is editable.
- Kiko's own settings, not GitHub facts: the US$10 cap and the 4 Nov figure of US$15.81 used. Kiko set them on 4 Nov 2026.

Evidence: `test/features/32-usage-github.js`, GA1 to GA4, which use synthetic figures. Manual gap: nobody has yet opened the card on
live Version 200.

### CUE-044: A Messenger sender who is not linked as crew gets one reply and leaves one Ask Cue line (code tag `CUE-MSGR-NO-FLOOD-2026-11-04`)

Intended policy: Kiko wrote on 4 Nov 2026 at 14:58Z: "i feel this is gonna cause me some flooding....". At 14:59Z he added: "if its a
customer inquiry... i want it". The fix went live as Version 199 on 4 Nov 2026 at 15:09Z.

Implemented in `src/CueMessenger.gs`:
1. When someone not linked as crew messages the Page, Cue sends the polite "for our crew" reply once.
2. Cue also posts one Ask Cue line with their first 200 characters.
3. Cue then sets script property `MSGR_TOLD_<psid>`. Their later messages stay only in the Page inbox. Each new person gets their own
   line.
4. The three-button triage (crew, event inquiry, client) is not built. It comes with the crew Messenger build.

Evidence: `test/features/80-messenger.js`, MS10. Manual gap: no one has checked on live that a second message from the same sender adds
no new line.

### Messenger setting buttons show their error (PR #320, display only)

Connect Facebook, Finish, Make key and Save in Settings › Connections now send a server error to the chat through `alertErr`. Before,
they only re-enabled the button. No rule changed.

## Cue 1.28.21 (PR #322, with Canvas V452)

### CUE-045: A sent Friday status email keeps one copy in Canvas Weekly Reports

Intended policy: on 4 Nov 2026 at 16:22Z Kiko asked for Reports › Weekly Reports on the Canvas Projects page, "to see copies of it". At
16:28Z he approved it ("yup") together with assumption A14: Cue saves a copy of each Friday email to Canvas through the bridge when the
email is sent, and earlier emails are not back-filled. On 5 Nov 2026 at 03:54Z Kiko said "yes" to the deploy.

Implemented in `src/CueStatus.gs` (`cueStCopy_`):
1. After Gmail sends the email, Cue sends Canvas one bridge action, `status_copy`. It carries the subject, To, the send time, the HTML
   and the text, keyed by the Gmail message id.
2. The email has already gone, so a failed copy never blocks or undoes it. When Canvas refuses, the sent line says the copy was not
   saved and gives the reason.
3. When Canvas does not have `status_copy`, the sent line says nothing about a copy.
4. A failed send keeps no copy. Earlier emails are not back-filled.

Evidence: `test/features/63-friday-status.js`, ST2b, checked against the `test/fixtures/ZapBridge.gs` schema from CanvasWorkspace PR #498.
Manual gap: the first real Friday send has not yet been checked under Weekly Reports on live Canvas V452.

## Cue 1.28.35 (PR #336) and its time-limit follow-up

### CUE-046: A bid lead Canvas is too busy to save is sent again until it is in the CRM (code tag `LEAD-RETRY-2026-11-06`)

Intended policy: on 6 Nov 2026 at 01:07Z Kiko asked for the bid leads lost to Canvas save clashes to be recovered ("Recover those coz i
cant ask them to do it again!!@!") and asked "What if those are clients lost?". At 01:17Z Kiko said "Yes to deploy". No new business rule
was asked for or approved: this is a retry and recovery of what the bid check already sends (each new bid notice becomes one Canvas CRM
lead, source Bid finder, request_id `bid:<key>`).

Implemented in `src/CueBridge.gs` (`cueBridgeWaves_`) and `src/CueBids.gs` (`cueBidsLeads_`, `cueBidsLeadsCatchUp_`,
`cueBidsLeadsBacklogNow_`):
1. The commands of a claimed plan go to Canvas 3 at a time. An answer that says Canvas is busy is sent again after 5 seconds with the same
   command_id, up to 3 tries. Canvas's crm_lead returns the deal it already made for a request_id, so a repeat never makes a second deal.
2. No new wave starts once 150 seconds have gone. The leads not sent stay open on the run, so an Apps Script run never ends before it
   records what is left (added after the Codex review on PR #336).
3. Leads still open are sent by a later bid check as a Canvas recovery task (`<task>-recovery-1`, `recovers: <task>`). Canvas marks the
   old plan Superseded, which closes its stuck Claimed ledger rows. Only deals created by that push count as added.
4. Once, after 1.28.35 shipped, the background resume recovers the three bid checks that lost leads before the fix (30 Oct, 5 Nov, 6 Nov)
   and posts one line in each run's thread. It starts no new old run after 2 minutes; a resume at least 10 minutes later sends the rest.
   When none is left it sets `CUE_BIDS_LEAD_BACKLOG_DONE` and never runs again.

Technical limits chosen by Claude, not Kiko-approved policy: 3 at a time, 3 tries, the 150-second and 2-minute budgets, and at most 3
recovery attempts per run. They change no business outcome; a lead that still fails after 3 recoveries stays listed on its run.

Evidence: `test/features/86-bid-lead-retry.js`, LR1 to LR9. A dry run on the real stored runs and ledger (6 Nov) gave 21 Bid finder deals
before and 36 after, 15 new, no duplicate. Manual gap: live CRM Deals is being checked after Version 216 went live (6 Nov 01:23Z).

### CUE-047: Messenger crew who wrote before tapping "I'm crew" go on Canvas's Link list once (code tag `CREW-RESTORE-2026-11-06`)

Intended policy: on 6 Nov 2026 at 02:04Z Kiko wrote "these people messaged this what i want you to rtestore" and "i cant find whjere to
approve or link them" about the King's Day crew who messaged the BSE Page at 8:00 Manila. On the decision card at 02:05Z Kiko picked "Add to
Canvas list, you tap Link". Deploy yes 02:28Z ("Yes"). The Canvas side is CanvasWorkspace `docs/business-rules.md`, CREW-RESTORE-2026-11-06.

Implemented in `src/CueMessenger.gs` (`cueMsgrCrewRestore_`), called from `cueResume` in `src/Cue.gs`:
1. Once, it reads every saved Messenger chat (`MSGR_TRI_<psid>`) still at "asked" (never tapped "I'm crew") or at "crew" with no match
   state yet (tapped, never typed details), and not yet restored.
2. Each one is sent to Canvas's `crew_wait` with its typed details, or else its first message, and request_id `crewwait:<psid>`. The result
   is saved on the chat as `restored`, so a person is sent once.
3. It posts one main-chat line naming the people put on the list. Nobody is messaged.
4. When nothing failed it sets `CUE_CREW_RESTORE_DONE` and never runs again; a failure is tried again on a later resume.

Left out on purpose: chats with a match state (code, wait, locked, unsure). Those people typed details and went through `crew_match`, which
already handled them: a code was sent (code, locked), a "No contact" row waits for Link (wait), or a "No match" row waits for staff (unsure).

Claude's reading, not Kiko's words: which saved states count as "messaged but never listed", and the one-time boundary.

Evidence: `test/features/87-crew-restore.js`, CRW1 and CRW2 (synthetic chats and a fake bridge). Live since Cue 1.28.39 (Version 220,
6 Nov 2026 02:45Z, rollback 219) with Canvas V483. Manual gap: the live Messenger Waiting rows are checked after the first resume.

## RFQ draft rules (intake-real-check, 7 Nov 2026)

### CUE-048: An RFQ to a supplier never names the client, never states a price or budget, and never mentions other suppliers

Intended policy, in Kiko's own answers on 7 Nov 2026 (thread "Pick and scope next backlog feature"):
- R1 and R2. Asked: "Do you approve the two RFQ rules that are already in the code? An RFQ to a supplier never names the client and never
  states a price or budget." Kiko at 13:37Z: "1. yes". At 13:38Z he tapped "RFQ rules yes, no inquiry yet" on the card that confirmed
  which answer went with which question.
- R3. Asked: "Approve rule R3: an RFQ never mentions other suppliers?" Kiko at 13:59Z, decision card: "Yes".

Before 7 Nov 2026 these three limits existed only in the RFQ prompts and had no approval on record. This entry records the approval;
it adds no block.

Implemented: the RFQ prompts tell GPT the three limits (`src/CueIntake.gs` `CUE_R_SYSTEM_`, `src/CueVendor.gs` `CUE_VQ_SYSTEM_`).
Nothing in Cue stops a draft that breaks them. Kiko reads every draft before Send (CUE-012). The cloud check
`test/checks/intake-real.check.mjs` reports any break, using `test/checks/intake-rules.cjs`. Price means a peso amount written as PHP, ₱,
P with a thousands comma or 4 or more digits, "50k pesos" or "5,000 pesos", or the word budget. Client means the full name or its first
distinctive word.

Evidence: `test/features/63-intake-real-check.js`, IR7 to IR9.

### CUE-049: an RFQ goes only to a named supplier, never to a kind of business (8 Nov 2026)

**Status: APPROVED by Kiko, 10 Nov 2026 04:16:01Z**, his own tap on the decision card "Should Cue skip RFQs to a kind of business
instead of a named supplier?": "Yes, skip and note them" (thread "Watchdog: RFQ skip rule shipped on an inferred yes"). Until then
it was not approved (watchdog finding W1): from 8 Nov to 10 Nov this entry wrongly recorded the 06:33Z message below as Kiko's yes.
That message asked for the overall plan and did not answer the card.

- Question (decision card in the "Pick and scope next backlog feature" thread, 7 Nov 2026 14:3xZ): "Should Cue skip RFQs to supplier
  categories instead of named suppliers?" Options: "Yes, flag and skip them" (recommended) or "No, keep as is".
- Kiko's answer, 8 Nov 2026 06:33Z, in the same thread while this card was open: "maybe you should tell me what is the overall plan so
  youre not asking me what i want next. coz definitely i want all." This was wrongly read as Yes on this card; see the status line above.
- Evidence: Check Cue intake-real runs 2 and 3 (7 Nov 2026). Phase 4 drafted RFQs to "Licensed electrical contractors (Metro Manila)",
  "Pasay City LGU / Grand View Tower building admin", "LightAndSoundRental (rates blog)" and others: 8 of 20 RFQs in one inquiry.
- Built: `cueIsCategory_` in `src/CueIntake.gs` leaves such research entries out of the line's suppliers, the card notes what was left
  out, and the research prompt asks for real companies only. Canvas Supplier Database names are never filtered. Tests IR12 and IR13.
- Also (not a rule, a note): when web research finds no suppliers at all, the card says so (check run 3 found none with no note).

## Deploy management (Kiko, 8 Nov 2026)

### CUE-050: Deploy Cue never puts live a branch that lacks code already live (G1), and warns from 180 saved versions (G4)

Intended policy: Kiko at 01:22Z on 8 Nov 2026 replied "G1, G2, G3, G4, G5, L1" to the plan "Deploy management across projects"
(https://claude.ai/artifact/5mrvX4bk48EfHuuGazFtMh). G1 there reads: Deploy Cue refuses to deploy a branch that does not contain the
code of the Version that is live. G4: warn before the 200 saved-version limit. Why (observed): on 5 Nov 2026 V202, built on V200,
wiped the triage release live as V201.

Implemented (`tools/base-guard.cjs`, `tools/deploy.mjs`):
- The live Version's description names its commit ("Cue <sha>"). The branch passes when that commit is an ancestor, or when every
  hunk the live commit changed since the shared base, run backwards, applies to the branch (a squash merge passes).
- The `const CUE_VERSION_ = ...` declaration never blocks: a hunk that changes only it is skipped, and in a hunk that also changes
  real code the declaration is replaced by the branch's own before the check. Any other line, including one that uses
  `CUE_VERSION_`, is checked.
  The same holds when the declaration is only an unchanged context line beside a live change.
- Only the files Deploy Cue pushes (`.gs`, `.html`, `.json` in `src/`) are compared, and a renamed file counts as a delete
  plus an add, so a renamed template is checked.
- When the commit is not found, every live file must be one the branch's history has held.
- `mode=check` prints a `BASE` line; `mode=deploy` stops before pushing and names the files. The script fetches full history itself.
- From 180 saved versions the run shows a warning and a job-summary line. It never stops the run (Kiko 28 Oct 2026: "warn me at 180").

Known limits (Codex review on PR #355, 10 Nov 2026, left as they are): the check reverse-applies each live hunk with one line
of context. (a) If the same few lines also exist elsewhere in the file, a branch that lost the live change can still pass.
(b) If the branch also edited a line right next to a live change, it is refused even though it holds the change; rebuilding
on the live Version clears it. Both need the same code near a live change, which no Cue release so far has hit.

Evidence: `test/features/92-deploy-base.js`, BG1 to BG13 (real git in a temp repo). Live check run 42434987571 on the branch printed
"BASE OK" against live Version 227 and "saved versions: 180 of 200". Manual gap: a refused `mode=deploy` has not been run live.

## Team inbox (Kiko, 11 Nov 2026)

### CUE-051: Send sends a Question at once; then that chat takes no new Question for 3 minutes

**Status: APPROVED by Kiko, 11 Nov 2026**, in the "Team Inbox" thread: "maybe lets not do a countdown... let the user press send",
then, offered A (send 2 minutes after Send, with Cancel), B (send at once) or C (30 seconds): "lets do B but lets pause so that theres
not constant mesasging may 3 minutes before it can send again". This replaces decision D2 (a Question sends 2 minutes after its
fields are filled, Cancel stops it; Kiko 11 Nov 2026, CanvasWorkspace ADR-0161), which stays on record as superseded.

- Send on a Question sends it at once (one AI call). Then the same chat refuses a new Question until 3 minutes after the last one;
  the server says how many seconds are left and the Send button reads "Next Question in m:ss".
- Per chat: another chat can take a Question at once. Assumption stated to Kiko and not contradicted.
- Not paused: Confirm and Request access (they go to the role chats for a decision). Assumption stated to Kiko and not contradicted.
- The pause check and the new message row are one locked step, so two open tabs cannot both pass it (Codex review on Cue PR #372).
- Built: Cue 1.28.61 (`cueInboxSend_` in `src/CueInbox.gs`, `src/Inbox.html`); the lock in 1.28.62.

Evidence: `test/features/94-inbox-countdown.js` T24 (page has no countdown, shows the pause on Send) and T25 (second Question in the
same chat refused with the seconds left; another chat, a Confirm and a Question after 3 minutes all go; three AI calls), T26 (the
check runs inside the lock). Manual gap: not yet tried on the live Inbox in Kiko's browser.

### CUE-052: Agents post to the team inbox only through the Cue sheet's Team Requests tab, sent by Cue every 5 minutes

**Status: APPROVED by Kiko, 11 Nov 2026**, in the "Team Inbox" thread: "the goal is for things to run without me", then "go" to
shipping "the Inbox connection so chats can post and read the Inbox themselves" (step 1 of the plan shown to him).

- Scope: an agent (a Claude chat or session holding Kiko's Google Sheets connector) appends one row to the Cue sheet's "Inbox
  Requests" tab: Request ID, Chat (name or Chat ID), Kind, Tool, Message, From. No other path: Cue's web app stays open to Kiko's
  Google account only, and no new web route, doPost or key was added.
- Lifecycle: every 5 minutes `cueResume` (as the script owner) claims new rows one at a time under the lock, right before each is sent (State Sending, written
  before any AI call; at most 5 per run), then sends each exactly as the Inbox page would (`cueInboxSendCore_`: same checks, CUE-051 pause, role-chat
  routing). The row ends Sent with the Message ID and status, Refused with the reason, or back to New while the 3-minute pause
  holds. A row left at Sending (a run that died mid-send) is never sent again; rows the run had not reached stay New.
- A chat name that matches more than one active chat is refused with their Chat IDs; it is never guessed.
- The agent reads the reply or decision from that Message ID's row in "Inbox Messages". Nothing runs on a decision (scope Q3 B).
- What it does not grant: no Canvas write, no email, no action. Anyone who can edit the Cue sheet can post (today only Kiko's
  account and the connectors acting as him).

Evidence: `test/features/97-inbox-agents.js` A1 to A8 (send and routing, Question reply, refusals, pause, 5-row cap, claim before
send under overlap, ambiguous names, a killed run strands only the row in flight). Manual gap: not yet run on live with a real connector-written row.

### CUE-053: Everything that needs Kiko goes to the For Kiko tab of the Cue sheet, and he answers there

**Status: APPROVED by Kiko, 11 Nov 2026**, in the "Team Inbox" thread: "why cant they just also send a message for me in the google
sheet? add another tab and those are all the things that require Kiko".

- Every 5 minutes `cueResume` adds one row per Confirm or Request access that the role chats did not settle (Contested, Waiting
  after a failed role call, or a tool other than Google Drive), once the message is a minute old and at most once per message.
- An agent may append its own row with no Message ID for anything only Kiko can answer, and read Your answer back.
- Kiko types in Your answer. On a row with a Message ID, the whole answer "Approve" or "Reject" (any case; "Approved" and "Rejected" too) is recorded as his decision exactly like
  the Inbox page (decided by "Kiko (For Kiko tab)") and the row turns Done; other text gets a Note asking for Approve or Reject.
  A message decided elsewhere turns its row Done. A row with no Message ID turns Answered when he writes anything.
- Nothing runs on a decision (scope Q3 B).

- The whole sync runs under the lock shared with the Inbox page's Approve and Reject, so items are added at most once and a decision made on the page is kept (the row turns Done). The sync writes only the State and Note cells, never Your answer.

Evidence: `test/features/97-inbox-agents.js` K1 to K7. Manual gap: not yet run on live.

### CUE-054: The AI team runs without Kiko: the Account Manager has the final say, and each role does a daily job

**Status: APPROVED by Kiko, 11 Nov 2026**, in the "Team Inbox" thread: "the goal is for things to run without me", "change that....
do not include me in any step there", "okay lets do that" to the flow shown to him (each role wakes on a schedule, asks the other
roles through the sheet, the Account Manager's decision is final, nothing waits for him), then "do it in a new spreadsheet".

- Every Confirm and every Request access (any tool) goes to the Tech Lead, then on Escalate to the Account Manager, whose decision is
  final: its answer schema allows only Approve or Reject. This replaces the routing of D4 (Drive only to the Tech Lead, other tools
  to Kiko) and D5 (Contested to Kiko). The For Kiko tab still lists anything left undecided (for example, no Tech Lead chat), as a view.
- Daily jobs: once a day after 08:00 Manila, `cueResume` runs one job per role (Canvas PO and Account Manager read the Canvas project
  board; Cue PO and QA read the last 24 hours of failed Cue jobs; the Tech Lead reads the last 24 hours of decisions), at most 2 per
  run. Each writes a note on Team Daily and may send up to 2 Questions or Confirms to other roles on Team Requests. Charter PO and
  Chase PO have no data source in Cue yet, so no daily job.
- The team's tabs (Team Requests, Team Daily, For Kiko) live in their own spreadsheet "BSE AI Team", made by Cue in Kiko's Drive
  (Script Property CUE_TEAM_SHEET_ID). Team Requests rows get the answer and who decided on the same row.
- Limit kept (Kiko's standing rule): nothing the team decides sends email, spends money or changes Canvas. The only Canvas call is the
  read-only project board.

Evidence: `test/features/96-inbox-roles.js` R5, R6; `test/features/97-inbox-agents.js` A1, A2, A11, D1, D2. Manual gap: not yet run live.


### CUE-055: Finished team rows move to a Closed tab

**Status: APPROVED by Kiko, 11 Nov 2026**, in the "Team Inbox" thread: "add another tab - automatically moves items that are
Closed to that tab".

- Every cueResume run moves a Team Requests row whose State is Sent (once its message has a reply, a decision or has expired) or
  Refused, and a For Kiko row whose State is Done or Answered, to the Closed tab of the BSE AI Team spreadsheet. The moved row keeps
  its ID, chat, kind, request text, answer, state, note, sender and Message ID, plus the time it moved and the tab it came from.
- Assumption (not asked): "Closed" means those finished states; open rows (New, Sending, Open, still-undecided Sent) stay put.

### CUE-056: Everything Kiko types in an agent's thread is a message to that agent; Cue never acts on it

**Status: APPROVED by Kiko, 14 Nov 2026**, in the "Let agents read Kiko's replies" thread: 08:44:34Z "Yes. How do we go about agents
cant read replies"; decision card 15:36:53Z "No, all goes to the agent" (question: can you talk to Cue inside an agent's thread?);
mockup card 16:46:11Z "Approve, build it". CanvasWorkspace ADR-0183 and rule R-AGD11 hold the Canvas side.

- In an agent's thread (a thread of kind `agentdraft`), every line Kiko sends goes to that agent and nothing else runs: no word
  checks, no GPT call, no intake, mail or other task. Cue saves it once in Canvas through the bridge action `agent_message` and
  shows "Saved for <agent> · it reads it on its next run", or "Not saved: <why>." with Try again.
- A Reply in the main chat on a Cue bubble about an agent's thread goes to that agent the same way.
- An update card takes as many replies as Kiko sends (1.28.68 allowed one); each is also a message to the agent, and the card lists
  them under "Your replies".
- Files in an agent's thread are not sent (agents can't open them); the thread says so and nothing is saved.
- Each message has one id, made once and reused by every retry (Try again, or sending the same text again after a failed send), so
  Canvas saves it once. Try again resends the message that failed, never a later one (Codex review on Cue PR #386, fixed in 1.28.70).
- Agents read the messages with `draft_status` (agent, since = newest message_id read); Canvas V540 and V541.

Evidence: `test/features/99-agent-replies.js` AGR1 to AGR6. Built: Cue 1.28.69 (live as Version 248, 14 Nov 2026 17:21Z), review
fixes in 1.28.70 (live as Version 249, 17:52Z). Manual gap: not yet run live in Kiko's browser, and no agent has read a message yet.

### CUE-057: A main-chat message that starts with @ and an agent's name goes to that agent only

**Status: APPROVED by Kiko, 15 Nov 2026**, in the "Scope @-tag routing to agents in Cue" thread: 08:30:07Z "is it possible for me to
type in the new Cue and tag the agent name like @ Account Specialist and Cue sends the message to the Account Specialist agent";
scope and mockup (project files `agent-tags/scope.md`, `agent-tags/mockup/`) approved on the decision card 09:24:50Z "Approve, one
agent per message"; "build" 11:26:04Z (build on /dev only; going live needs a separate yes). Builds on CUE-056.

- In the main chat, "@" as the first character opens a list of the agents that have a thread in Cue, newest draft first. Picking
  one writes "@<agent> " in the box.
- A message whose first word is "@" and an agent's name (capitals and spaces do not matter, the longest name wins) goes to that
  agent exactly as CUE-056 describes: saved once in Canvas with `agent_message`, shown in the agent's thread, and nothing else runs.
  The main chat shows Kiko's line with the agent as a tag, then "Saved for <agent> · it reads it on its next run · Open thread" or
  "Not saved: <why>." with Try again. Cue's assistant never reads these lines.
- Only the start of the message counts: an @ later in a line (an email address, "@ 5 PM") is plain text, and untagged messages work
  as before. One agent per message: a second @ in the same message is plain text.
- A name that is no agent sends nothing: the words stay in the box with "No agent is called "<name>". Pick one from the list, or
  delete the @ to ask Cue. Nothing was sent." A tag with no words after it asks for the message.
- Files with a tag are not sent (CUE-056). A tag wins over a Reply on a Cue bubble.

Evidence: `test/features/99-agent-tag.js` TAG1 to TAG5. Built: Cue 1.28.71 (live as Version 250, 15 Nov 2026 12:46Z). Manual gap: not yet
run live in Kiko's browser.

### CUE-058: The FSA reminder starts 3 days after the FSA goes out

**Status: APPROVED by Kiko, 16 Nov 2026**, in the "Confirm FSA reminder start timing" thread: 02:50:02Z "FSA (the initial
notification) / FSA Reminder - Automatic: Start - 3 days after initial, (when does the chaser start)"; "yes" 03:44:20Z; "ship"
03:57:37Z. Changes the start of the R5/R6 signature chaser (Kiko 21 Oct 2026 08:08Z) for FSAs only. CanvasWorkspace ADR-0185.

- An unsigned FSA is chased from 3 days after its Generated date in Canvas, then every 2 days, at most 3. Each reminder is a draft
  Kiko approves; Canvas sends it from freelancers@.
- An FSA with no Generated date keeps the old start (the day after the event's last day). AR reminders are unchanged.
- Before the event the line reads "FSA sent <date>. Event ends <date>."

Evidence: `test/features/20-signature-chasers.js` G6. Built: Cue 1.28.72 (live as Version 251, 16 Nov 2026 03:58Z). Manual gap: no
live reminder seen yet.
