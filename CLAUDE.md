# Cue: rules for Claude

Cue is Kiko's personal command center: one Google Apps Script web app (`src/`), a Chrome bubble (`extension/`) and local
tests (`test/`). Canvas (repo kikodacanay14/CanvasWorkspace) is BSE's company app; Cue talks to it only through the signed
bridge (`src/CueBridge.gs`, schema copy in `test/fixtures/ZapBridge.gs`).

## Test

- `node test/cue.test.js` runs every test in about 6 s. Run it before every commit; CI (Test Cue) runs it on every PR and push to main.
- A new feature gets tests in `test/features/` (its own numbered file; `test/cue.test.js` loads them all). Bridge calls must match `test/fixtures/ZapBridge.gs`; refresh that copy
  from Canvas `src/ZapBridge.gs` whenever a Canvas release changes the bridge.
- `node tools/map.mjs --check` checks the generated `FEATURE-MAP.md`. Never hand-edit the map; `node tools/map.mjs`
  regenerates it.
- `node relay/messenger-worker.test.mjs` checks the Cloudflare Worker relay (`relay/`) with mocked requests.

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

## Delivery Board, formerly Feature Board (Kiko, 3 Nov 2026; renamed 25 Nov 2026)

Kiko's words: "fix the Feature board - i expect every development will update the feature board".

- The Delivery Board (named Feature Board until 25 Nov 2026) is the artifact https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP (collection `features`, written with
  the `ArtifactData` tool, `if_version` on every write to an existing card). Card fields and columns: CanvasWorkspace
  `work-board.md`, "Feature Board fields".
- Every piece of development work, bug fixes included, has a card, and the work is not done until the card shows where it
  stands. Move it in the same turn its status changes. A release that goes live moves its card to **For Testing (live)**
  with `liveAt` and `ref` (for example `Cue 1.28.3, Version 189`); no card yet means make one.
- **Triage first (Kiko, 25 Nov 2026: "implement a ticketing system after a triage - to identity if bug or for new feature";
  answers 1A to 5A; definitions 02:55:07Z).** Before writing a card for any software change, set its `type` (rules R-TRI1 to
  R-TRI12 in CanvasWorkspace `docs/business-rules.md`, ADR-0257):
  - **Bug**: "an expected action that was deployed in Production does not operate like how it should be". Gets `severity`
    P1/P2/P3 (P1 is told to Kiko at once), starts in For Development and needs no scope approval (the release steps under
    "How code reaches Kiko" still apply).
  - **Incident**: "an unplanned service disruption". Tell Kiko at once, roll back to the last good Version
    through the normal release steps, then log the cause as a Bug card (R-TRI10, Kiko 25 Nov 2026 05:06:01Z).
  - **Feature**: "an expected action is not what the build was made to do", including anything that needs a new rule. Starts
    in For Scope Definition and Design, and Kiko approves the spec first.
  Set `triage` {by, at, why} on the card. Plain tasks get no card.
- Every PR fills in the "Feature Board" line of `.github/pull_request_template.md`, or says why no card applies.

## Working style

- Kiko approves a spec before any build. Specs live in the project files under `canvas-integration/specs/`.
- While an approval about new access to people's data (mail, files, accounts) or a new standing job is pending, write
  none of that access code. Prepare only the parts that grant nothing (UI copy, the spec, read-side filtering).
- Any price in a spec comes from the vendor's own pricing page (WebSearch, then WebFetch). A figure from anywhere else is
  marked unverified in the spec itself. BSE uses Google Workspace Business Standard.
- Usage rule (Kiko, 2 Nov 2026: "Hold off any UI or UX improvements if Usage is lower than 30$"): no UI or UX improvement while
  Kiko's remaining Claude usage is under $30. Claude cannot see the balance, so it asks Kiko before starting UI or UX work; bug fixes
  and requested features are not held.
- Kiko watches usage cost: keep AI calls per feature low (a major function makes 3 to 5 calls and finishes within 3 minutes),
  batch questions, and keep idle threads quiet.
- Tables (Kiko, 29 Oct 2026 14:32Z: "UI rule - for tables where the table values are numbers - align center. Headers are
  always aligned center"; 14:51Z: "middle align tables for short columns and the headers"): centre every table header, every
  number cell (amount, count, percent) and every short column (each filled cell 12 characters or fewer: status, P-stage, date,
  yes/no, code), on pages, Cue Admin, emails, reports and mockups. Long text keeps its own alignment, and every cell sits in
  the middle of its row.
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
- BSE development instructions (Kiko, 25 Nov 2026): follow the "BSE development instructions" section of `AGENTS.md` (skills, Drive and Application QA File, Delivery Board decisions, testing, proof).

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

The Delivery Board (formerly Feature Board) is the required operational question/answer register for its stories. Follow the AGENTS.md Questions and decisions workflow: check existing cards first, preserve card ID plus exact question and existing q/a/s fields, leave unconfirmed answers blank, and verify authorized updates. Unavailable access means unsynced, not completed mapping. Do not create a Google Sheet without a later explicit request.

## Facts from a fresh read (Kiko, 17 Nov 2026)

Never state a status, count, role, permission, version or any other fact from memory, from a summary or from an earlier
turn. Read it fresh in this session (the tracker, the live branch, the code path that decides it, the check run) and cite
that read in the claim. If it cannot be read, say so instead of stating it. Source: observations 0023, 0059, 0064 and 0066
in the task-observer log; the same rule is in the `verify-before-done` skill ("Claims to Kiko").

After a context compaction, skills loaded earlier are not loaded: `.claude/hooks/after-compact.mjs` reminds the session to
call them again (observations 0027 and 0105).

## Skills for facts, done and questions (Kiko, 17 Nov 2026)

Kiko named these on 17 Nov 2026 ("superpowers:verification-before-completion, agent-protocols:source-driven-development,
caveman:investigate-first, verify then done"; "and matt pockok skills"; "add ask-kiko and stories-and-rules").

- Before stating a fact or claiming anything is done: `superpowers:verification-before-completion`,
  `agent-protocols:source-driven-development`, `caveman:investigate-first` and `verify-before-done`.
- Matt Pocock skills (adapted from github.com/mattpocock/skills): `grill-me` to stress-test a plan or decision before
  acting on it, `improve-codebase-architecture` when reviewing a repo's architecture, and `setup-matt-pocock-skills` once
  per repo before the other two.
- `ask-kiko` for every question, choice or approval for Kiko.
- `stories-and-rules` to break an approved ask into Epics and User Stories and pull its business rules out for Kiko's
  approval before anything is built.

## Updated skills (Kiko saved 17 Nov 2026)

Kiko saved these skill updates on 17 Nov 2026 and asked for them in every CLAUDE.md ("please include the updated skills
... in all repos and in both computers"). Load the skill before the work it covers; the skill text wins over this summary.
Source: the skill observer cleanup, observations 0023 to 0106 in the task-observer log.

- **scope-then-design**: tables centre money, counts, percents, short columns and headers. Canvas and Cue screens use
  DM Sans; a newer design document that names other fonts does not replace that unless Kiko says so (0073). Before
  calling anything new or unbuilt, search the trackers and the live branch (0023, 0043).
- **mockup-review**: before drawing, read the source table and specs in full, use the approved logo file byte for byte,
  and start from the live app's stylesheet (0032, 0034, 0077, 0105, 0106). For a see or edit ask, the mockup is the
  working screen, not a sketch (0032).
- **brand-ui-check**: money columns centred (0063); a logo check against the approved asset (0077); the report opens
  with `design-critique` and `ui-consistency:verifying` loaded or skipped (why), and splits findings into "caused by this
  change" and "known baseline gaps" (0065).
- **verify-before-done** ("Claims to Kiko"): numbers and status from a fresh read (0064, 0023, 0043); roles and
  permissions from the code path that decides them, overrides included (0059, 0066); check access to outside resources
  (0046); test the real target, not a fake (0058); diagnose the code that actually ran (0060); a gate claim covers every
  step of the gate (0072); walk stateful screens step by step (0081); merge and deploy gates read main's checks after the
  merge (0094, 0097); acceptance cases come from the governing row (0076).

## How to flag what needs Kiko (Kiko, 18 Nov 2026)

Kiko's words (18 Nov 2026 06:12Z): "Can you make the things you need very obvious like ALL CAPS if first like QUESTION,
ACTION NEEDED, etc then list it down, provide options if possible. General Rule please apply to all chats. Also make sure
that coordinator sends it. I dont have to go through each thread. Link the threads where you want me to reply".

- When Kiko must do something, start that part with an ALL CAPS label: QUESTION, ACTION NEEDED, DECISION, APPROVAL NEEDED,
  BLOCKED.
- Under the label, list each item as its own bullet. Give options (A/B/C) with a one-line consequence each and mark the
  recommended one.
- Link the exact place (thread, PR, file) where Kiko must reply or act.
- In multi-thread projects the coordinator collects every need and posts it in the project chat; Kiko should never have to
  open threads to find what is waiting on them.

## How to talk to Kiko (Kiko, 18 Nov 2026)

Kiko's words (18 Nov 2026 06:57Z), after a thread answered "data yes, agent access no" with function names and line
numbers: "omg why dont you just say that?"

- Answer first, in plain business words, in 1-3 lines. Kiko is not reading code.
- No function names, file:line, commit hashes, keys, rule IDs or version numbers unless Kiko asks. Put technical detail at
  the end under "Details", or leave it out.
- Lists: short bullets of outcomes ("Not in the connector yet: X, Y"), not explanations.
- Never say "nothing needed" in a post that asks anything. Restate any question in full; never point to "above".
- "Redo X" means re-send X corrected in the same format.
- Mistake: one line "Fixed:" plus the corrected output. No apology paragraph.
- Mark status as Verified (read this session) or Reported (from a thread).

## Proof of done (Kiko, 18 Nov 2026)

Kiko's words (18 Nov 2026 10:07Z), asking for this rule: "should be part of default instructions for every project".

- Never say "done" without proof Kiko can open himself: merged PR link, screenshot of the live screen, n8n run result, or
  a record ID he can find.
- Say what was checked and when. No proof = mark it Reported, not Done.
- When relaying a thread's "done", pass its proof along; if the thread gave none, ask for it before telling Kiko.
