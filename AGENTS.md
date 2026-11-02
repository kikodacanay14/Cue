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

Read docs/decisions.md and linked Feature Board/spec records before asking an answered question again. Preserve existing question IDs, exact supported answers, dates, scope and source. Log assumptions as explicit user statement, author-stated rationale or code inference, with evidence and risk if wrong. Answered does not mean implemented or verified. Keep superseded history. Do not create a second operational question queue. The proposed Google Sheet review master is not yet created; future snapshots must share IDs, link their source, show refresh date and state that synchronization is manual.
