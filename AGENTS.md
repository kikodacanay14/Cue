# Instructions for ChatGPT and Codex

Read `CLAUDE.md` in this repo first. Its rules apply to every AI working here, not only Claude.

## New task, feature or build

Before writing any code, follow the phases in `.claude/skills/scope-then-design/SKILL.md` by hand: backlog pick, discovery,
stress-test, stories and rules, mockups, spec, design, plan. Kiko approves the spec before any build. Write each output to the shared files that file names, not
only to the chat, so Claude and Codex see the same state.

## Working map

Cue is Google Apps Script (.gs/HtmlService), a Chrome Manifest V3 extension and a Cloudflare Worker relay. There is no established root npm build/test script. src/ contains the application; test/ contains synthetic regression tests; extension/ and relay/ have separate runtime boundaries. Read CLAUDE.md, the approved scope/spec, docs/business-rules.md, docs/decisions.md and applicable nested guides before changes.

## Checks

- `node test/cue.test.js` is the full local synthetic suite.
- `node tools/map.mjs --check` checks generated FEATURE-MAP.md; `node tools/map.mjs` regenerates it when authorized. Never hand-edit the generated map.
- `node relay/messenger-worker.test.mjs` checks the relay with mocked requests.
- Record actual commands/results, tested commit and gaps. These do not prove live Apps Script, browser, webhook or messaging behavior. Check Cue creates a temporary deployment and may write bounded test data: it is not a read-only local test.

## Never rules

Never invent business policy, approvals or release authorization. Preserve permanent identities, manual decisions, bridge/schema contracts, deduplication and audit history. Do not turn a narrowly documented automatic action into general authority to send or write; preserve the specific CueCrmLog metadata and CueMessenger signing-link exceptions exactly as documented, subject to current authorization. Never send real messages, alter production records or deploy just to run a test. Never expose credentials or bank details in URLs or fixtures. Never replace current files with stale release copies or weaken tests to hide a regression. Main updates can trigger automatic preview deployment after tests; branch/draft-PR work does not authorize merge, publish or live deployment.

## Branding and rule documentation

Use verified BSE guidelines for every user-facing screen, email, approval document and message, respecting the applicable medium and documented exceptions. Canonical cross-product [Brand lock](https://github.com/kikodacanay14/CanvasWorkspace/blob/fce30f0a449c3001a281a26ac3f1dab4b9ec0bb0/.claude/skills/scope-then-design/SKILL.md#L57-L84) lives in CanvasWorkspace; recheck its current revision. It explicitly rejects current Canvas Brand.html as design authority. Current Cue CSS is implementation evidence, not evidence of approval to replace fonts or other brand decisions. Record drift and seek the missing decision before resolving an actual conflict.

Keep full rules in docs/business-rules.md, with short rule-ID/doc-path comments for non-obvious code behavior or exceptions when code changes are authorized. A behavior change must update its rule and acceptance evidence in the same change, with regression tests where feasible and explicit manual gaps otherwise. Distinguish intended policy, observed behavior, author-stated rationale and inference; never invent rationale or approval.

## Questions and decisions

The existing [Feature Board](https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP) is the required operational question-and-answer register for work on its stories. Read the relevant existing card and its qa before asking or implementing a decision-dependent change. Reuse card ID plus the exact question; do not invent a question-ID field or create a duplicate queue. Use existing q/a/s fields: label unconfirmed assumptions explicitly in q, leave a blank and s Open until Kiko answers; preserve exact answers, other questions and manual statuses. Read the current version before an authorized update, use if_version and verify saved contents. If access is unavailable, mark proposed mapping unsynced and report the gap; stop only changes dependent on the unresolved decision, continuing independent authorized work. docs/decisions.md is a dated source-linked snapshot, not a substitute board, and is not automatically synchronized. Do not create a Google Sheet unless Kiko requests it later.

Preserve supported answers, dates, scope and sources. Distinguish user statements, author-stated rationale and code inference. Answered does not mean implemented or verified. Keep superseded history.

## BSE development instructions (Kiko, 25 Nov 2026)

Kiko's words (25 Nov 2026 04:04Z): "these are the things i want to add". He then answered the scoping questions (04:32Z):
Impeccable "needs to be installed"; the rules go "where its necessary so everyone uses it"; "we will use the Feature Board
moving forward. Same with Decision Log - all in the Delivery Board". The Delivery Board is the Feature Board artifact,
renamed; collection `features` is unchanged. These rules apply to every BSE development chat,
Claude and Codex alike. Read the applicable nested AGENTS.md files for app-specific rules. Where an existing rule in this
repository is stricter (approvals, releases, proof), the stricter rule wins.

### Skills

- **Impeccable** (`.claude/skills/impeccable/`, Codex: `.agents/skills/impeccable/`) for UI design work. Follow the approved BSE brand guidelines: DM Sans, the current plum and role tokens,
  and the table and label rules. Where Impeccable's own taste conflicts with the brand guidelines, the brand wins. Use it
  with `mockup-review` and `brand-ui-check`.
- **Caveman** (`caveman:caveman`) for concise replies, and **Humanizer** (`humanizer:humanizer`) when editing prose for a
  natural voice. Keep exact technical details, and keep questions and approvals clear.
- **Ponytail** (`ponytail`) for coding: the simplest change that fulfills the approved scope and its QA requirements.
- Load the matching skill for the work at hand. If a skill is missing from the chat, say which one and follow the
  matching instructions in this section instead.

### Scoping and communication

1. Start development by checking the BSE Apps & Systems shared Drive
   (https://drive.google.com/drive/u/0/folders/0AE_qEZv4inXlUk9PVA) for current system and app updates. Find the app's
   folder and its Application QA File.
2. Use Superpowers (`superpowers:writing-plans`) to write a high-level plan, broken into executable steps with a check for
   each step. Reuse approved scope and design when they already cover the work.
3. Scope with `scope-then-design` and ask Kiko through `ask-kiko`. Check existing decisions on the Delivery Board before
   asking. Use Impeccable for design work, within the brand guidelines.
4. Communicate with Caveman and Humanizer, following the needs-flag, talk-to-Kiko and proof-of-done rules.

### Coding

- Before coding, and whenever a business-process question comes up, check the decisions recorded on the Delivery Board
  (https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP): the card's Questions, answers and business rules, and the
  project's decisions link. Apply the latest approved decision. The older Google Sheet decision log is history only.
- Use `ponytail` and `scope-then-design`. Keep the repository's own approval and release requirements.
- If Drive or the Delivery Board cannot be read, record what could not be checked and continue the authorized work that
  does not depend on it. Leave decisions about the affected behaviour open.

### Testing

1. During scoping and planning, write the unit and edge-case test cases for the feature or function into the app's
   Application QA File (BSE Apps & Systems Drive, app folder). Create the QA file in that folder if it is missing. Write
   the runnable failing tests in the app's test runner once Kiko has approved the scope, and before the implementation.
   Link the exact test files and commands in the QA file so another chat can rerun them.
2. Cover happy paths, null and empty inputs, boundary values and expected errors. Run the tests before implementation and
   confirm they fail for the intended missing behaviour. Implement, then rerun the relevant suite until it passes.
3. For a changed API endpoint or service, add integration tests. Mock outside third-party calls, and use the real test
   database or module boundaries where available. Check status codes, response shapes and error payloads.
4. For auth flows, endpoints or input handlers, add security and negative tests where they apply: unauthorized access,
   expired or malformed tokens, wrong types, injection, over-privileged input. Flag weaknesses found in existing code and
   keep the assertions that expose them.
5. Record the failing and passing runs, exact commands, revision and remaining gaps in the Application QA File. If the
   app folder or QA file cannot be reached, say the QA record is pending and run the authorized repository tests.

### Updating and proof

- The Delivery Board is the tracker. The Superpowers plan tracks steps inside a chat; move the card in the same turn
  its status changes. Record blockers and continue independent work.
- Record every business-rule or app-rule change on the Delivery Board card (the rule, the app, the source decision and
  the evidence), only after Kiko has approved the rule, and check the saved entry. Keep the repository's rule documents
  in step.
- Show proof before calling a task done, as the "Proof of done" rule requires: proof Kiko can open himself (merged PR,
  screenshot, QA record, deployment receipt, record ID). Say what ran, what failed or is unverified, and which
  environment was checked. No such proof means "Reported", not "Done".
