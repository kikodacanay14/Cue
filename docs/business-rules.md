# Cue business rules — source-based first pass

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
| CUE-030 | Documented scoped automatic exception + implemented, deployment unverified: Messenger sign-link send requires token, known recipient, unsigned document and valid inbound age under 24 hours. Marker supports report retries. Relay security not fully audited. [CueMessenger](https://github.com/kikodacanay14/Cue/blob/3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20/src/CueMessenger.gs). | Missing token, future timestamp or expired window means no send. |

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

Process: eligible inquiry → due/mute/dedup/max gates → prepared chase presented in the 8AM update → Kiko approves that message → permitted send path. PR271 documents flagging the item for parking after the two follow-ups; automatic Canvas stage parking was deferred to a later part, not implemented by this registration. Winback was removed from registration even though old helper functions remain. C4 accreditation-status chasing was deferred; it is not the accreditation-mail collector.

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
