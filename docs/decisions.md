# Cue decisions and unresolved differences

This is the repository evidence/decision register, not a second operational question queue. Read existing Feature Board/spec answers first. The separately proposed Google Sheet review master is pending creation; until its verified URL is recorded here, do not claim a sheet exists or is synchronized. Future sheet/repository snapshots must preserve IDs and disclose manual synchronization and refresh time.

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

## Existing question source and decision record template

The [historical Feature Board reference](https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP) is repository-verified in CanvasWorkspace's questions-for-kiko skill, but live access/content was not verified. Do not claim it currently provides an accessible authoritative log or synchronized state.

For a real decision record preserve the existing card/question ID. Record status (Open/Decided/Implemented/Verified/Superseded), Manila asked time, applies-to scope, exact question and why, assumptions with User-stated/Author-stated/Code-inferred basis and evidence/risk/state, exact supported answer/date/source, interpretation separately, limits/unresolved items, affected rule/code/doc/test references, implementation commit, verification result/date/gaps and append-only supersession history. Only assign a new operational question ID after confirming it does not duplicate existing records.

## Branding authority and drift

Read [canonical cross-product Brand lock](https://github.com/kikodacanay14/CanvasWorkspace/blob/fce30f0a449c3001a281a26ac3f1dab4b9ec0bb0/.claude/skills/scope-then-design/SKILL.md#L57-L84) and recheck its current revision before changing branding. Do not modify this skill as part of this documentation package.

The canonical guidance rejects existing Canvas Brand.html as design authority. Current Cue CSS is implementation evidence, not evidence that a different font/color system was approved. The 2026-10-30 Canvas handoff and current styles must be reconciled against the canonical guidance, not silently substituted. Medium-specific document, email and message rules must be checked in the authoritative source map when available. No new fonts, colors or brand policy are invented here.

## Documentation package authorization (2026-11-02)

Kiko approved saving the described documentation package on separate CanvasWorkspace and Cue branches and opening draft pull requests. Scope: root instructions, applicable nested guides, business-rule and decision documents, plus Canvas guideline-source map. Nothing merged or deployed; no application code, existing skills, Feature Board records or automated tests changed. This authorizes documentation publication, not resolution of the open business-policy questions above.

## Maintenance

For each resolved item add supported answer, source/date, scope, affected rule IDs, implementation reference and verification state. If source permission is unavailable, preserve the question as unresolved. Never mark an answer implemented just because it is written here.
