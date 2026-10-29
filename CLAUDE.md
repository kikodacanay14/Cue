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
3. **PC check**: changes to intake, Canvas writes or routing are checked on /dev in Kiko's Chrome by the "Live Cue testing on
   PC" thread (Preview, Save drafts and Reject taps only; irreversible taps stay Kiko's).
4. **Live (/exec)**: only the "Cue and Canvas deploys" thread runs Deploy Cue `mode=deploy`, and only after the PC check passes
   and Kiko says go. Other threads hand their build to it. Never ship main live while it carries a change that failed or has not
   had its check: cut a release branch from the last live commit plus the tested commits instead.
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
- Don't hold a Cue release for a Canvas release. Ship a Canvas release only when a Cue feature needs it.

## Working style

- Kiko approves a spec before any build. Specs live in the project files under `canvas-integration/specs/`.
- While an approval about new access to people's data (mail, files, accounts) or a new standing job is pending, write
  none of that access code. Prepare only the parts that grant nothing (UI copy, the spec, read-side filtering).
- Any price in a spec comes from the vendor's own pricing page (WebSearch, then WebFetch). A figure from anywhere else is
  marked unverified in the spec itself. BSE uses Google Workspace Business Standard.
- Kiko watches usage cost: keep AI calls per feature low (a major function makes 3 to 5 calls and finishes within 3 minutes),
  batch questions, and keep idle threads quiet.
- Tables (Kiko, 29 Oct 2026 14:32Z: "UI rule - for tables where the table values are numbers - align center. Headers are
  always aligned center"; 14:51Z: "middle align tables for short columns and the headers"): centre every table header, every
  number cell (amount, count, percent) and every short column (each filled cell 12 characters or fewer: status, P-stage, date,
  yes/no, code), on pages, Cue Admin, emails, reports and mockups. Long text keeps its own alignment, and every cell sits in
  the middle of its row.
- UI rules: three panes (chat, threads, viewer), no Widgets page, no Due/Priority/Remind row, a thread's name opens it, and cards
  minimize to a bar above the chatbox.

## Always-on skills

- Every session: follow the caveman skill (terse replies; docs, commits and tracker records stay in full prose).
- Code and build work: invoke superpowers:using-superpowers before the first step.
- New task, feature or build: invoke scope-then-design (`.claude/skills/scope-then-design/SKILL.md`) before any code.
