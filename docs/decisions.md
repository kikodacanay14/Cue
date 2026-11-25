# Cue decisions and unresolved differences

> **From 25 Nov 2026:** new decisions and approved rule changes are recorded on the Delivery Board's Decisions tab
> (https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP, collection `decisions`), as the "BSE development instructions" section of `AGENTS.md` requires. This file keeps
> the earlier record and stays the reference for it. Kiko, 25 Nov 2026: "all md files being referenced and used by agents need to be updated".

Status on main (checked 3 Nov 2026): brought onto main from PR #294 as written there. It reads Cue main (snapshot 3080b1c).
Cue main and the live line have split: branch `claude/project-thread-y5l4x9-rel1285fix` (live, Version 191) has 256 commits main lacks,
so a rule here can differ from what is live until main is reconciled with that line. The Canvas decisions file is
CanvasWorkspace `docs/decisions.md`.

This is the repository evidence/decision snapshot, not a second operational question queue. The existing Feature Board is the required operational register for its stories. No Google Sheet is planned unless Kiko explicitly requests one later. Board access and actual card mapping remain unverified; the findings below are unsynced proposals, not saved board records.

**2026-11-03 correction:** The initial findings and proposed board mapping below refer to older main. Read the newer-release reconciliation at the end before acting, especially historical CUE-D10/028 (HubSpot removed in the newer release). No existing answers are overwritten and no Feature Board records were changed.

## Evidence conventions
- User statement: quote or faithful paraphrase with supported date/source/scope.
- Author-stated rationale: repository author/comment attribution, not independent approval verification.
- Code inference: describe implementation and risk; do not invent why it was built.
- Answered, approved, implemented, deployed and verified are different states.
- Keep superseded decisions and permanent IDs. Resolve an existing question rather than making a duplicate queue.

## Review findings (not operational question cards)
Snapshot: main 3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20, 2026-11-02. Review findings, not new policy or newly created operational question cards. Reconcile against existing question IDs before asking anything.

| ID | Evidence / discrepancy | Decision needed / risk if unresolved | State |
|---|---|---|---|
| CUE-D01 | CUE-017: personal-expense comments say exact reference; executable comparison uses normalized substring. | Confirm exact transaction identity rule; avoid false duplicate matches. | Unresolved; no implementation change. |
| CUE-D02 | CUE-019: selected preclassified duplicate can bypass normal duplicate guard. | Is intentional override allowed, and what reason/evidence must be recorded? | Unresolved. |
| CUE-D03 | CUE-018: unavailable project checks noted; Personal Expense can remain default. | Which uncertain classification/cross-check conditions must stop recording? | Unresolved; absence of evidence is not personal proof. |
| CUE-D04 | CUE-025: draft-only approval advances chase count/next date. | Should preparation consume contact/chase allowance or should sent contact be separate? | Unresolved. |
| CUE-D05 | CUE-024/029/030: blanket approval wording coexists with documented RFP outbox, CRM metadata and Messenger sign-link exceptions. | Reconcile exact current standing authorization and runtime enablement; never generalize exceptions. | Repository intent observed, current approval/configuration not independently verified. |
| CUE-D06 | CUE-022: readiness can propose a configured reply-by date. | How must proposed dates be marked and approved so they are not mistaken for commitments? | Unresolved. |
| CUE-D07 | CUE-007/026: fuzzy recipient ranking and missing-thread fallback. | Which ambiguities require explicit recipient/thread selection? | Unresolved. |
| CUE-D08 | CUE-009: Cue One line/Ignore removes UNREAD; dot automation preserves it. | Preserve app-specific scopes; no shared global permission inferred. | Boundary recorded; not an instruction to change either app. |
| CUE-D09 | Canonical Brand lock and current CSS differ; historical handoffs also describe brand decisions. | Use the canonical current guidelines and establish approved migration scope before changing existing presentation. | Drift recorded; no CSS/font change authorized here. |
| CUE-D10 | CUE-028: pipeline description says every open deal while code caps inspection. | Retain explicit partial-coverage language; decide if exhaustive review is required. | Coverage limitation documented. |
| CUE-D11 | CUE-008/012/030: external sends precede local result persistence. | Define recovery for uncertain send outcomes; do not promise exactly-once or blindly resend. | Known uncertainty; no recovery implementation changed. |

## Required Feature Board workflow

The existing [Feature Board](https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP) is the required operational question-and-answer register for work on its stories. Read the relevant existing card and its qa before asking or implementing a decision-dependent change. Reuse card ID plus the exact question; do not invent a question-ID field or create a duplicate queue. Use existing q/a/s fields: label unconfirmed assumptions explicitly in q, leave a blank and s Open until Kiko answers; preserve exact answers, other questions and manual statuses. Read the current version before an authorized update, use if_version and verify saved contents. If access is unavailable, mark proposed mapping unsynced and report the gap; stop only changes dependent on the unresolved decision, continuing independent authorized work. docs/decisions.md is a dated source-linked snapshot, not a substitute board, and is not automatically synchronized. Do not create a Google Sheet unless Kiko requests it later.

## Existing question source and decision record template

The [historical Feature Board reference](https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP) is repository-verified in CanvasWorkspace's questions-for-kiko skill, but live access/content was not verified. Do not claim it currently provides an accessible authoritative log or synchronized state.

For a real decision record preserve the existing card ID plus the exact question; no separate question-ID field is assumed. Record status (Open/Decided/Implemented/Verified/Superseded), Manila asked time, applies-to scope, exact question and why, assumptions with User-stated/Author-stated/Code-inferred basis and evidence/risk/state, exact supported answer/date/source, interpretation separately, limits/unresolved items, affected rule/code/doc/test references, implementation commit, verification result/date/gaps and append-only supersession history. Reconcile against the existing card's q/a/s records; do not invent operational IDs or claim a mapping until it is saved and read back.

## Branding authority and drift

Read [canonical cross-product Brand lock](https://github.com/kikodacanay14/CanvasWorkspace/blob/fce30f0a449c3001a281a26ac3f1dab4b9ec0bb0/.claude/skills/scope-then-design/SKILL.md#L57-L84) and recheck its current revision before changing branding. Do not modify this skill as part of this documentation package.

The canonical guidance rejects existing Canvas Brand.html as design authority. Current Cue CSS is implementation evidence, not evidence that a different font/color system was approved. The 2026-10-30 Canvas handoff and current styles must be reconciled against the canonical guidance, not silently substituted. Medium-specific document, email and message rules are indexed in the [Canvas branding and guideline source map](https://github.com/kikodacanay14/CanvasWorkspace/blob/c6f6a862c99df8d59adbb7cb124396ddc4b3fd56/docs/system-reference/branding-and-guideline-sources.md), read back at that pinned commit. This map belongs to unmerged draft Canvas PR #414; it is a source-based documentation snapshot, not a new approval, deployment or visual-compliance certification. Read its original authorities and coverage gaps before applying it. No new fonts, colors or brand policy are invented here.

## Documentation package authorization (2026-11-02)

Kiko approved saving the described documentation package on separate CanvasWorkspace and Cue branches and opening draft pull requests. Scope: root instructions, applicable nested guides, business-rule and decision documents, plus Canvas guideline-source map. Nothing merged or deployed; no application code, existing skills, Feature Board records or automated tests changed. This authorizes documentation publication, not resolution of the open business-policy questions above.

## Maintenance

For each resolved item add supported answer, source/date, scope, affected rule IDs, implementation reference and verification state. If source permission is unavailable, preserve the question as unresolved. Never mark an answer implemented just because it is written here.

## Decision history — Feature Board preference

2026-11-02: Kiko confirmed using the existing Feature Board for gathered questions and assumptions after the proposal to check it first and record questions, assumptions and answers there, with repository logs linking back. This supersedes the earlier proposed Google Sheet review-master direction, preserved in Git history. Approval to map does not establish that a mapping has been saved. Current extraction findings remain unsynced pending live card access and identity verification; no existing answers, IDs or statuses are invented.

## Prepared Feature Board mapping — not imported

Live Feature Board access is blocked; no actual cards or qa entries were read, deduplicated or updated. The feature areas below are proposed search targets, not verified card titles or IDs. D references are extraction findings only. All answer cells are deliberately blank. Before import, find the existing card and exact question, preserve existing answers/manual statuses and resolve duplicates. If existing policy already answers a question, record an implementation gap rather than ask it again.

| Finding | Proposed existing feature area to locate | Proposed q / treatment after existing-answer check | a |
|---|---|---|---|
| CUE-D01 / CUE-017 | Personal expense deduplication | Existing dot instructions require a full reference with corroborating transaction details. Treat substring matching as a possible implementation gap. Only if Cue policy remains unresolved: “Is an exact complete reference, with corroborating transaction details, required to identify the same transaction?” | |
| CUE-D02 / CUE-019 | Personal expense duplicate review | “May a reviewed duplicate warning be overridden, and what evidence/reason must be retained before treating it as a distinct transaction?” Unconfirmed override policy. | |
| CUE-D03 / CUE-018 | Personal/project expense classification | Known policy: unknown spending is not automatically personal. Map that implementation gap first. Residual question: “If the project cross-check is unavailable, should the item remain pending until evidence resolves classification?” | |
| CUE-D04 / CUE-025 | Follow-up/chase accounting | “Should preparing an unsent draft consume a chase count or move the next-contact date, or should those advance only after a confirmed send?” Unconfirmed draft-equals-contact assumption. | |
| CUE-D05 / CUE-024,029,030 | Separate RFP outbox, CRM metadata logging and Messenger sign-link stories | Verify original approval and runtime scope separately. Only if missing: “What existing standing approval covers this specific automatic action and its limits?” Not a blanket new approval request. | |
| CUE-D06 / CUE-022 | Readiness follow-up dates | “Should a generated reply-by date remain a proposed date requiring approval before sending?” Do not invent a deadline or commitment. | |
| CUE-D07 / CUE-007,026 | Recipient selection and reply threading | “If the intended recipient or reply thread cannot be verified, should Cue require an explicit selection instead of starting a new email?” Split recipient/thread into separate existing questions where decisions differ. | |
| CUE-D10 / CUE-028 | Pipeline review coverage | “Is an exhaustive open-deal review required, or is a clearly labeled bounded review acceptable for this Cue feature?” Dot's Thursday complete-count requirement remains explicit and unchanged. | |
| CUE-D11 / CUE-008,012,030 | Separate RFP, RFQ and Messenger send-recovery stories | “When delivery may have occurred but no local result exists, what evidence must resolve the outcome before any retry?” Never blindly resend; match the actual existing stories. | |

CUE-D08 records the app-specific read-state boundary, not a new question. CUE-D09 records canonical brand authority and implementation drift, not a request to reapprove fonts. Migration scope may require its own existing decision check.

Evidence: [source-pinned rule catalog](https://github.com/kikodacanay14/Cue/blob/dbe01638f45021595cd3909387592c8f6f9549b5/docs/business-rules.md); underlying code snapshot 3080b1cb1f2dcafacf41e3b60ccd79fe8fb83b20. User-policy boundaries are preserved as operational constraints; no unseen Feature Board answer is inferred.

Import only through an authorized supported route: read current board/card version, reconcile exact questions, use existing q/a/s fields and if_version, leave unconfirmed a blank and s Open, then read back saved content/version. If blocked, retain this unsynced proposal and continue independent work; do not claim import, deduplication or synchronization succeeded.

Match by application, story scope and source references, not title keywords alone. Read candidate qa and approved specs. No unique card match means unresolved mapping: do not create a card or invent IDs. For a genuinely unmatched question on a verified card, append only {q: clear question including the unconfirmed assumption, a: '', s: 'Open'} while preserving all existing qa. On version conflict reread and reconcile. Do not add fields, fabricated answers, deleted history, doer/handedAt/status changes or role handoffs in this mapping run.

## Decision history — newer Cue release and P-status processes (2026-11-03)

Kiko corrected that recent Cue versions updated these rules, then requested: “Add those details in the business rules and processes” (Sentinel_b2499833ea1c81918dab083369351df1). This authorizes the documentation correction, not selection of a preferred timing implementation, code changes, merges, deployments or Feature Board writes.

[Business rules CUE-031–036](business-rules.md#newer-release-correction-p-statuses-and-operating-processes) now describe release fe2987aaa1d604f9e621b1f3887f4889bd2116ef, distinct from old main 3080b1c. Preserve the older findings as history. CUE-D10's old HubSpot mapping must not be imported as a current newer-release feature: PR275 removed it. Reconcile any real board story and current source first.

| Extraction finding | Evidence and required reconciliation | Current state |
|---|---|---|
| CUE-D12 | CUE-031/032: newer funnel counts P1/P2 due at three weekdays; legacy CueGptTasks P1/P2/P4 timing remains and may use NextFollowup. Check actual active schedule/entry point and existing approved story before deciding whether old behavior should be retired. | Unresolved coexistence; no timing policy invented. |
| CUE-D13 | CUE-033: C2 means quiet Inquiry with email, not P2. Two three-working-day follow-ups precede flag-to-park; automatic parking and C4 chasing were deferred. | Observed implementation/release scope recorded; no automatic transition approved. |
| CUE-D14 | CUE-032/033: funnel weekday counter differs from C2 Philippine-holiday/configured-holiday-aware helper. Check approved business-day definition and align only under authorized implementation scope. | Unresolved holiday discrepancy, not silently normalized. |
| CUE-D15 | CUE-035: reporting observes movements; Cue's fifteen-minute crm_tick can trigger Canvas-owned transition work. Verify both deployed versions/contract and standing authority. | Source ownership established; actual live transition behavior unverified. |
| CUE-D16 | CUE-034: P4 incoming-mail collector is not accreditation approval/chasing. Preserve three-day/forty-message limits, domain/exact-personal identity and internal-only thread writes. | Process documented; runtime enablement unverified. |
| CUE-D17 | Release CHANGELOG says 1.28.3 LIVE Version189; main, preview, trigger-head and live may differ. A release note alone cannot certify current deployment. | Live version/configuration unresolved; no remote test or deployment performed. |

These D references are extraction references only, not invented Feature Board card/question IDs. Proposed feature areas to locate later are company-priority funnel, legacy follow-ups, C2 chasers, accreditation collection and Canvas CRM tick. Actual cards and qa were not read or mapped in this correction. Reuse any existing answered question; do not ask Kiko to reapprove settled P meanings. Leave unconfirmed answers blank and preserve manual statuses if an authorized later import is possible.

No newer-release tests were run by this documentation correction. Source tests were inspected as listed in the rules. Documentation-branch CI cannot validate the release branch or deployed Apps Script. No code, live schedule, spreadsheet, Feature Board, external message or deployment changes are part of this update.


## Decision history — requested PR270/274/277 extraction (2026-11-03)

Kiko approved the proposal to add the missing rules and unresolved discrepancies to the existing draft documentation PRs: “Yes. Add and list the discrepancies.” (Sentinel_773aff21fa688191bc6335fb98dd8718). Scope is documentation only. This is not approval to resolve a disputed implementation, change application code, merge, deploy, edit schedules or import Feature Board records.

The [requested PR audit](business-rules.md#requested-pr-audit-270-274-and-277-2026-11-03) adds CUE-037–041. It distinguishes final merged code from initial PR wording and repository author-attributed user answers. No inaccessible Claude conversation or missing Feature Board answer is claimed as independently reviewed.

| Finding | Evidence / consequence | Status and next permitted treatment |
|---|---|---|
| CUE-D18 | CUE-033 previously placed chasers in 8AM. PR270's final 1.27.93/94 changes use 2PM and draft-only numbered selection with per-message Send. | Documentation corrected; old wording retained as superseded history. No application or schedule change. |
| CUE-D19 | PR274 groups an assigned-to-Kiko task due tomorrow into Critical today. [Review](https://github.com/kikodacanay14/Cue/pull/274#discussion_r4434436237); [later inspected source](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/src/CueMorning.gs#L183-L193). | Unresolved code defect relative to the label. Proposed regression: tomorrow must not be Critical today; retain overdue/today/team behavior. Implementation approval remains separate. |
| CUE-D20 | Upstream client_status TRI rows may be capped at twelve before urgency sorting. [Review](https://github.com/kikodacanay14/Cue/pull/274#discussion_r4434436234); [Cue fixture](https://github.com/kikodacanay14/Cue/blob/fe2987aaa1d604f9e621b1f3887f4889bd2116ef/test/fixtures/ZapBridge.gs#L1310-L1387). | Coverage risk; actual deployed Canvas contract unverified. Proposed regression: urgent thirteenth input is not silently omitted. Verify backend/version before selecting a fix. |
| CUE-D21 | PR277 uses bounded project and mail metadata evidence; unknown priced is not flagged as explicitly missing, and a named contact is not necessarily a verified current recipient. [Code](https://github.com/kikodacanay14/Cue/blob/db19062530b55fb94bf1835b5f97070a5ae3e2e5/src/CueFunnel.gs#L160-L220). | Disclose coverage and uncertainty. Do not treat the report as exhaustive, a sending decision or proof of award. Any scope expansion needs its own decision. |

Reused, not duplicated: CUE-D12 (legacy timing), CUE-D14 (holiday counting), CUE-D17 (release/runtime identity), CUE-D04 (draft versus actual-contact accounting). They remain unresolved. CUE-D10 remains an older HubSpot finding, not a current newer-release feature.

The feature areas for later board reconciliation are consolidated daily updates, draft/send approval, bid/contact retention, tracker/timeline summary and Canvas funnel checks. These are search targets only, not verified card names or new IDs. No board import, synchronization, manual-status change or operational resolution is claimed. Source tests were read, not run; documentation-branch CI cannot verify release or deployed behavior.
