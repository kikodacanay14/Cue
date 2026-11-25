---
name: "scope-then-design"
description: "Use at the start of any new task, feature, build or project for Canvas, Cue or Blank Space work, or when picking the next item from the Feature Board backlog — runs backlog pick, discovery, stress-test, stories and rules, mockups, spec and design, and plan in order, with a quality gate after each phase and Kiko's approval before any code."
---

# Scope then design

One entry point for turning an ask into an approved design before anything is built. It chains skills that already
exist; it adds no new tooling. Kiko asked for it on 27 Oct 2026 ("a more structured way of defining requirements and
understanding of the asks. Structurally design solutions before coding and implementing").

Extended on 29 Oct 2026 at Kiko's request: epics and user stories on the Feature Board, business rules confirmed before
building, polished brand-locked mockups he approves screen by screen, plain-language spec explanations, a quality gate
after every phase, and clear question cards so he always knows what is being asked.

Extended again on 29 Oct 2026 at Kiko's request: the `frontend-design` skill is loaded directly for every screen
(Phases 4 and 6), and the fonts for Canvas and Cue are fixed in "Brand lock" below.

Canonical copy: `kikodacanay14/CanvasWorkspace/.claude/skills/scope-then-design/SKILL.md`. The copy in
`kikodacanay14/Cue` and the one saved to Kiko's Claude account mirror it. Change the canonical copy first, then the others.

## Where it applies

- A new task, feature, build or project in Canvas, Cue or Blank Space operations.
- Not for: a quick question, a bug with a known cause, or work whose spec Kiko has already approved (go to Resume).

## Triage first (Kiko, 25 Nov 2026, ADR-0257)

Before Phase 0 or 1, set the ask's type (rules R-TRI1 to R-TRI10 in CanvasWorkspace `docs/business-rules.md`). Kiko's
definitions, 25 Nov 2026 02:55:07Z:

- **Bug**: "an expected action that was deployed in Production does not operate like how it should be". Not for this skill.
  Set `type` Bug and `severity` P1/P2/P3 (P1: money, a client, crew or an event is blocked, or data is lost or wrong, and Kiko
  is told at once; P2: wrong with a workaround; P3: cosmetic). Start it in For Development and fix it end to end without
  asking (answer 2 = A).
- **Incident**: "an unplanned service disruption". Not for this skill. Set `type` Incident and tell Kiko at once; how it is
  handled waits for his yes (R-TRI10).
- **Feature**: "an expected action is not what the build was made to do", including "works as built but wanted different" and
  anything that needs a new rule. Set `type` Feature, start it in For Scope Definition and Design, and run every phase below. A
  new rule always goes to Kiko as a yes/no.
- Plain tasks (record a payment, send a file, answer a question) are not triaged and get no card.

## Resume first

Before Phase 1, look for this ask's existing spec, design or plan: the repo's `work-board.md` row, `handoffs/`, the
project files, open branches (`git for-each-ref --sort=-committerdate refs/remotes`). Skip every phase whose output Kiko
already approved, and start at the first one he has not. Never re-ask an answered question.

## Size the work first (Kiko, 29 Oct 2026: scale the checking to the size of the job)

Before Phase 1, name the size in one line and follow it:

| Size | What counts | Phases | Stage gate |
|---|---|---|---|
| **Small** | One page or one function, a wording, layout or bug fix, no new rule, no change to money, data or sheets | Discovery (short) and Plan. A screen change gets one mockup image | Once, at the end, by the same Claude |
| **Medium** | Several screens or one sheet, no money or new rule | Every phase | After each phase, by the same Claude |
| **Large** | A new feature or flow, money, payments, new or changed rules, the bridge, several sheets, or anything for clients, crew or suppliers | Every phase | After each phase, in a separate agent |

Anything that touches money, a rule, people's data or a send to someone outside BSE is never Small. When unsure,
take the bigger size. Kiko can change the size at any time.

## Always, in every phase

- Every question to Kiko goes through `ask-kiko` (question card at the end of the reply). Never bury a question in a long reply.
- Run `stage-gate` as the size says. A **Stopped** gate means the next phase does not start.
- Every output is written to the Feature Board, `work-board.md`, the spec file or `docs/`, never only to chat.

## Brand lock for Canvas and Cue screens

Every screen, mockup and component in Canvas, Cue and the Feature Board uses the Blank Space Events design system
(https://claude.ai/artifact/4sHJEJj9Nin3eyh1bUgyo8): its colour tokens, spacing, radii and the fonts below. Canvas's
current Brand.html styling is not the reference. When `frontend-design` pushes for a distinctive look, the brand wins:
use its judgement for layout, hierarchy and restraint, never to pick new colours or new fonts.

### Fonts

| Role | Font | Where | Rules |
|---|---|---|---|
| Display | Steagal (W01 Regular) | Screen titles, page heroes, one big number on a dashboard | 24px or larger. One display line per screen. Never on buttons, labels, tables, forms or body text: it has one light weight. |
| UI and body | Quicksand | Everything else: navigation, buttons, labels, forms, tables, cards, messages | Body 14 to 16px at weight 500; labels and buttons 600; section headings 700. Nothing smaller than 12px. |
| Numbers, money, IDs | Quicksand with `font-variant-numeric: tabular-nums` | Amounts, CE lines, quantities, Project IDs (S-25506500TR), REQ/SCP/ENT IDs | In tables, centre number cells (money, counts, percents) and centre every header (Kiko, 29 Oct 2026 14:32Z: "UI rule - for tables where the table values are numbers - align center. Headers are always aligned center"). Kiko 14:51Z added "middle align tables for short columns and the headers": a column whose filled cells are all 12 characters or fewer (status, P-stage, date, yes/no, code) is centred too. Long text keeps its alignment. If the digits do not line up in the mockup, raise it with Kiko as a question card; do not swap in another font on your own. |
| Not used in apps | Steagal Rough | Marketing, party themes and social posts only | Never in Canvas, Cue or the Feature Board. |

Fallback stacks: display `Steagal, Quicksand, "Trebuchet MS", sans-serif`; UI `Quicksand, Nunito, "Trebuchet MS", sans-serif`.

Loading:

- Quicksand: Google Fonts link in the page head (Canvas is an Apps Script HtmlService app; Google Fonts loads there).
- Steagal: embed the font file from the design system's `fonts/` folder as a base64 `@font-face` in the shared stylesheet
  include. Never hotlink onlinewebfonts.com.
- Credit: Steagal is CC BY 4.0 from OnlineWebFonts.com and needs credit. Put "Fonts by OnlineWebFonts.com (CC BY 4.0)" in
  the app's footer or About panel.
- Cue: any screen Cue renders itself (web view, approval page, email) follows the same table. Text Cue sends into
  ChatGPT or Claude cannot carry fonts; there only the wording and structure apply.

Adding or replacing a font is Kiko's decision. Ask with `ask-kiko`.

## Phases

Each phase names the skill to load. Load it by the name the session's skill listing shows (for example
`superpowers:brainstorming` in Claude Code, a plugin-prefixed name such as `frontend-design:frontend-design` in
claude.ai). If a skill is not installed, do that phase by hand with the same output.

### Phase 0: Backlog pick (only when Kiko asks what to work on next)

Source: the Feature Board's Backlog column. Kiko is the product manager and picks by need. Claude never picks.
Rank up to four candidates and present them as one `ask-kiko` card: for each, the business need it meets, what it
unblocks, its size (small, medium, large), and anything it waits on. Recommend one. Move the chosen card to
"For Scope Definition and Design" and start Phase 1.

### Phase 1: Discovery

Skill: brainstorming (superpowers). Read the sources in Kiko's order first: canonical docs, master tracker, approved
specs, Drive files, code, then the conversation. Then reply with:

1. **What I understand**: the objective in two sentences.
2. **Clarifying questions**: 3 to 5 specific questions on edge cases, constraints, users and missing data. Never guess
   business, operational or financial facts.
3. **Proposed Definition of Done**: a checklist of what the finished work must include.

Stop. Wait for Kiko's answers.

### Phase 2: Stress-test

Skill: grill-me. Run it on Kiko's answers to surface gaps and conflicts. Ask only what changes the design, batched in one
message. Stop until answered.

### Phase 3: Stories and rules

Skill: stories-and-rules. Break the ask into Epics and User Stories on the Feature Board, and pull every business rule
into the Rules register as Waiting for Kiko. Stop until every rule a story needs is Approved or Kiko has dropped it.

### Phase 4: Mockups

Skills: frontend-design (load it directly, every time), then mockup-review if it is installed. Follow frontend-design's
two passes: write a short design plan (colour from the brand tokens, type from the Brand lock table, layout, principles),
check it against the brief, then build. Polished, brand-locked mockups of every screen the stories show: images for
single screens, clickable HTML for processes. Use real Blank Space content (real project names, ID formats, peso amounts)
rather than filler. Take a screenshot and critique each screen before showing it. Kiko approves each screen. Skip only
when no story shows anything to a person.

### Phase 5: Spec

Skill: write-spec (product-management). Write the requirements, scope and out-of-scope, and acceptance criteria tied to
the story IDs and approved mockups. Before writing, read `work-board.md` in CanvasWorkspace and follow its rules (overlap check, add the card).
Save the spec where the repo's CLAUDE.md says specs live (Cue: `canvas-integration/specs/` in the project files;
handoffs between Cue and Canvas: `handoffs/` in CanvasWorkspace). If no location is named, ask Kiko once.

Present it to Kiko with explain-spec, then stop. Kiko approves the spec before any build.

### Phase 6: Design

Skill: system-design (engineering), plus frontend-design and ui-consistency:design for anything the end user sees.
Record the components, data flow, bridge calls, data each part reads and writes, and the decisions with their
trade-offs. For screens, record the type scale and font loading from the Brand lock. Put the design in the spec file or
next to it, never only in chat.

Present it with explain-spec. Stop. Kiko approves the design.

### Phase 7: Plan

Skill: writing-plans (superpowers). Turn the approved design into ordered tasks with IDs and dependencies in the
project's tracker. Move each ready story to "For Development". Then hand off to the build workflow already in
the repo's CLAUDE.md.

## Rules this skill carries (all are Kiko's own)

- No code before Kiko approves the spec (Cue CLAUDE.md, "Working style").
- Discovery answer first, deliverable after his answers (Kiko's account preferences).
- Never invent a new rule, guard or block; ask Kiko yes/no first (CanvasWorkspace CLAUDE.md, "Never").
- Durable outputs go to shared files that Claude and ChatGPT/Codex both read, not chat.
- Questions to Kiko are question cards: headline, plain meaning, why it matters, options with pros and cons,
  recommendation (Kiko, 29 Oct 2026).
- Stop on big problems, note small ones (Kiko's choice for the stage gate, 29 Oct 2026).
- All UI uses the Blank Space design system and the Brand lock fonts; frontend-design is loaded for every screen
  (Kiko, 29 Oct 2026).

## For ChatGPT and Codex

They cannot load Claude skills. `AGENTS.md` at the repo root points them to this file; they follow the phases by hand,
including the Brand lock table.
