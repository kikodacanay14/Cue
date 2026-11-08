# Cue: rules for Claude

Cue is Kiko's personal command center: one Google Apps Script web app (`src/`), a Chrome bubble (`extension/`) and local
tests (`test/`). Canvas (repo kikodacanay14/CanvasWorkspace) is BSE's company app; Cue talks to it only through the signed
bridge (`src/CueBridge.gs`, schema copy in `test/fixtures/ZapBridge.gs`).

## Test

- `node test/cue.test.js` runs every test in about 6 s. Run it before every commit; CI (Test Cue) runs it on every PR and push to main.
- A new feature gets tests in `test/features/` (its own numbered file; `test/cue.test.js` loads them all). Bridge calls must match `test/fixtures/ZapBridge.gs`; refresh that copy
  from Canvas `src/ZapBridge.gs` whenever a Canvas release changes the bridge.

## How code reaches Kiko

1. **main**: tested changes merge to main right away (PR, Test Cue green, merge). Don't park finished work on branches.
2. **/dev (preview)**: when Test Cue passes on main, Deploy Cue runs `mode=preview` by itself and puts main on the /dev test
   link. Repo variable `CUE_AUTO_PREVIEW = off` pauses this (set it while a PC check must not see new code). Apps Script
   triggers run the head code, so the 07:00 jobs and schedules run main's code once it is previewed.
3. **PC check**: changes to intake, Canvas writes or routing are checked on /dev in Kiko's Chrome by a Claude session
   (Preview, Save drafts and Reject taps only; irreversible taps stay Kiko's). This is Claude's own safety step, not a step
   for Kiko.
4. **Live (/exec)**: the session that built and tested the release runs Deploy Cue `mode=deploy` itself, once the PC check
   (when one applies) passes. Kiko is not asked for a go once he has approved the scope and design (Kiko 8 Nov 2026 01:03Z:
   "whats important for me is that requirements are properly scoped, that you get to ask necessary questions to understand
   the requirements, and that the design follows business rules, UI and UX logic and business branding guidelines. Once those
   conditions are met, i am okay not having to say yes in the rest of deployment process"; applied to Cue at 01:06Z and
   confirmed on a decision card at 01:08Z). Work that skipped scoping, or was built differently from the approved design,
   still needs Kiko's yes before it goes live. Record the release in CanvasWorkspace `deploy-queue.md`. Never ship main live
   while it carries a change that failed or has not had its check: cut a release branch from the last live commit plus the
   tested commits instead.
5. Every release gets a block at the top of `CHANGELOG.md` ("## Cue X.Y.Z: what changed (not deployed)", who asked and when,
   what changed, test count). Update `README.md` when a file, command or flow it describes changes.

## Never

- Never run `clasp push` or `clasp deploy` yourself, and never edit the Apps Script project in the browser. Code goes live only
  through the Deploy Cue workflow.
- Never change `deploy.json`, `.deploy/` or `.github/workflows/` without Kiko's approval. `.claude/hooks/guard.mjs` asks first.
- No production change and no outgoing email without Kiko's explicit approval. Approve = send, per message.
- RFQs and CEs go from Kiko's own Gmail, never from info@. GPT and Claude never write to Canvas; Canvas writes only after
  Kiko approves, through the bridge, once.
- Never put bank details in a link, and never store Kiko's e-signature in Canvas or info@ Drive.
- Don't hold a Cue release for a Canvas release, and don't hold a Canvas release for a Cue feature (Kiko 7 Nov 2026).

## Feature Board (Kiko, 3 Nov 2026)

Kiko's words: "fix the Feature board - i expect every development will update the feature board".

- The Feature Board is the artifact https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP (collection `features`, written with
  the `ArtifactData` tool, `if_version` on every write to an existing card). Card fields and columns: CanvasWorkspace
  `work-board.md`, "Feature Board fields".
- Every piece of development work, bug fixes included, has a card, and the work is not done until the card shows where it
  stands. Move it in the same turn its status changes. A release that goes live moves its card to **For Testing (live)**
  with `liveAt` and `ref` (for example `Cue 1.28.3, Version 189`); no card yet means make one.
- Every PR fills in the "Feature Board" line of `.github/pull_request_template.md`, or says why no card applies.

## Working style

- Kiko approves a spec before any build. Specs live in the project files under `canvas-integration/specs/`.
- Terms and decisions: the glossary (`docs/glossary.md`) and the decision records (`docs/adr/`, indexed in
  `docs/adr/README.md`) for Canvas and Cue live in CanvasWorkspace (Kiko, 8 Nov 2026: "can you make me a glossary and ADR",
  then "Yes" to keeping them current). A Cue change that records a new Kiko decision adds its ADR there, and one that
  introduces a new term adds its glossary entry there, in a CanvasWorkspace PR opened with the Cue PR. A replaced decision
  is marked Superseded, never deleted.
- While an approval about new access to people's data (mail, files, accounts) or a new standing job is pending, write
  none of that access code. Prepare only the parts that grant nothing (UI copy, the spec, read-side filtering).
- Any price in a spec comes from the vendor's own pricing page (WebSearch, then WebFetch). A figure from anywhere else is
  marked unverified in the spec itself. BSE uses Google Workspace Business Standard.
- Kiko watches usage cost: keep AI calls per feature low (a major function makes 3 to 5 calls and finishes within 3 minutes),
  batch questions, and keep idle threads quiet.

## UI rules

- Tables (Kiko, 29 Oct 2026 14:32Z: "UI rule - for tables where the table values are numbers - align center. Headers are
  always aligned center"; 14:51Z: "middle align tables for short columns and the headers"): centre every table header, every
  number cell (amount, count, percent) and every short column (each filled cell 12 characters or fewer: status, P-stage, date,
  yes/no, code, days, labels), on pages, Cue Admin, emails, reports and mockups. Long text stays left (its own alignment), and
  every cell sits in the middle of its row.
- UI rules: three panes (chat, threads, viewer), no Widgets page, no Due/Priority/Remind row, a thread's name opens it, and cards
  minimize to a bar above the chatbox.
- UI rules for every card and table (Kiko, 30 Oct 2026 06:12Z: "Tables: Headers are always aligned Center. Columns with
  Financial values are alignes Center. All rows are aligned in the middle. Table headers have darker colors on in bold or a size
  bigger than the values. Overall: Headers are either in bold, darker colors or a size bigger than the value. Value should be
  lighter, never in bold, a size smaller than the header. Buttons - aligned bottom right. Labels - should never look like buttons.
  Icons with Labels - always aligned middle"). Headers and field names dark, bold, 14px; values regular, 13px; card buttons at the
  bottom right; tags flat with square corners; icons middle. They live in the UI-RULES block of `src/IndexStyle.html` (tests in
  `test/features/70-ui-rules.js`) and match Canvas Brand.html `style#bs-uirules`.
- Labels (Kiko, 29 Oct 2026 14:48Z and 14:49Z: "make your label same - and make it a global UI", "make it a standard UI....
  dont just make up"): every label, badge or status pill is the Canvas Brand.html pill. In Cue that is `.tag` (src/IndexStyle.html,
  same shape and colours): plain = accent, `new` = warn, `pref` = good, `flag` = crit. Never style a label per page. A label that
  marks what a mockup or release changes says only New, Changed or Removed, with no counts like "+5".

## Always-on skills

- Every session: follow the caveman skill (terse replies; docs, commits and tracker records stay in full prose).
- Code and build work: invoke superpowers:using-superpowers before the first step.
- New task, feature or build: invoke scope-then-design (`.claude/skills/scope-then-design/SKILL.md`) before any code.
- Any question, choice or approval for Kiko: use the ask-kiko skill (`.claude/skills/ask-kiko/SKILL.md`) for every one, including one-line yes/no checks. The question card goes last in the reply (Kiko, 7 Nov 2026, approving this line).

## Task observer

Kiko's task-observer log for cloud sessions lives in a separate repo, kikodacanay14/Canvas (default branch), not in this
one. Never create `skill-observations/` or `skill-updates/` here: a second log would split the record.

1. Before the first tool call of a session, attach kikodacanay14/Canvas (add_repo) and clone it to `/home/user/Canvas`. Then
   invoke the task-observer skill and run its Session Start Protocol with the workspace root pinned to `/home/user/Canvas`.
   Follow the "Task observer (cloud sessions)" section of `/home/user/Canvas/CLAUDE.md` for every path and command.
2. If Canvas cannot be attached or cloned, say so in one line before the answer and carry observations in the final report.
   Never write them into this repo instead.
3. Commit and push each observation to the Canvas repo's default branch in the same turn. Observation commits never go into
   this repo (Cue), and Canvas has no deploy, so logging never touches a release.
4. On Kiko's PC the log stays at `C:\Users\kiko\Documents\Claude\skill-observations`; this section applies only to cloud
   sessions.

## Rule documentation navigation

Also read AGENTS.md and the applicable nested guide. Consult docs/business-rules.md and docs/decisions.md for rule evidence, exact decisions and assumptions. Preserve source IDs/dates; neither a snapshot nor an instruction file proves a change was approved, deployed or verified.

Feature Board is the required operational question/answer register for its stories. Follow the AGENTS.md Questions and decisions workflow: check existing cards first, preserve card ID plus exact question and existing q/a/s fields, leave unconfirmed answers blank, and verify authorized updates. Unavailable access means unsynced, not completed mapping. Do not create a Google Sheet without a later explicit request.

## Agent skills

### Issue tracker

Tickets live as Feature Board cards (collection `features`), not GitHub Issues. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `docs/business-rules.md` and `docs/decisions.md` are the decision record. See `docs/agents/domain.md`.
