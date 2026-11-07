---
name: "scope-then-design"
description: "Use at the start of any new task, feature, build or project for Canvas, Cue or Blank Space work, or when picking the next item from the Feature Board backlog — runs backlog pick, discovery, stress-test, stories and rules, mockups, spec and design, plan, and build and test in order, with a quality gate after each phase and Kiko's approval before any code."
---

# Scope then design

One entry point for turning an ask into an approved design before anything is built, then building and testing it. It chains skills that already exist; it adds no new tooling. Kiko asked for it on 27 Oct 2026 ("a more structured way of defining requirements and understanding of the asks. Structurally design solutions before coding and implementing").

Extended on 29 Oct 2026 at Kiko's request: epics and user stories on the Feature Board, business rules confirmed before building, polished brand-locked mockups he approves screen by screen, plain-language spec explanations, a quality gate after every phase, and clear question cards so he always knows what is being asked.

Extended again on 29 Oct 2026 at Kiko's request: the `frontend-design` skill is loaded directly for every screen (Phases 4 and 6), and the fonts for Canvas and Cue are fixed in "Brand lock" below.

Extended on 3 Nov 2026 at Kiko's request: assumptions instead of question floods, a file written at every phase, a Definition of Done record per ask, brand and voice checks on screens, and a build-and-test phase.

Extended on 5 Nov 2026 at Kiko's request: every screen is checked against the Brand Guidelines with `brand-ui-check` (Phases 4 and 8).

Extended on 7 Nov 2026 from Kiko's review of logged failures: one capped round of discovery questions, live checks before a design is approved, independent review before release, Quicksand as the body font and money columns centred.

Canonical copy: `kikodacanay14/CanvasWorkspace/.claude/skills/scope-then-design/SKILL.md`. The copy in `kikodacanay14/Cue` and the one saved to Kiko's Claude account mirror it. Change the canonical copy first, then the others.

## Where it applies

- A new task, feature, build or project in Canvas, Cue or Blank Space operations.
- Not for: a quick question, a bug with a known cause, or work whose spec Kiko has already approved (go to Resume).

## Resume first

Before Phase 1, look for this ask's existing spec, design or plan: the repo's `work-board.md` row, `handoffs/`, the project files, open branches (`git for-each-ref --sort=-committerdate refs/remotes`). Skip every phase whose output Kiko already approved, and start at the first one he has not. Never re-ask an answered question. Carry every answer Kiko already gave forward as settled.

- Before telling Kiko that something is new, not built, in testing or not possible, search `deploy-queue.md` SHIPPED entries, the specs, the release descriptions and the Feature Board by name or ID, and cite what you found. Before drafting copy that Kiko says a document governs, fetch that document (observation 0023).
- For "build only the gap" work on a rule that matches live data, run the live code over a read-only snapshot of the live sheets and list every change it makes before deciding what the gap is (observation 0020).

## Size the work first (Kiko, 29 Oct 2026: scale the checking to the size of the job)

Before Phase 1, name the size in one line and follow it:

| Size | What counts | Phases | Stage gate |
|---|---|---|---|
| **Small** | One page or one function, a wording, layout or bug fix, no new rule, no change to money, data or sheets | Discovery (short) and Plan. A screen change gets one mockup image and one brand check | Once, at the end, by the same Claude |
| **Medium** | Several screens or one sheet, no money or new rule | Every phase | After each phase, by the same Claude |
| **Large** | A new feature or flow, money, payments, new or changed rules, the bridge, several sheets, or anything for clients, crew or suppliers | Every phase | After each phase, in a separate agent |

Anything that touches money, a rule, people's data or a send to someone outside BSE is never Small. When unsure, take the bigger size. Kiko can change the size at any time.

## Always, in every phase

- Every question to Kiko goes through `ask-kiko` (question card at the end of the reply). Never bury a question in a long reply.
- Assumptions first. Where the sources or Kiko's answers leave a gap, state it as an assumption ("I'm assuming X, Y, Z: strike any that are wrong") rather than a question. Ask only what no assumption can settle, and never ask what Kiko already answered. Kiko's strikes and answers are recorded in the spec folder so later phases do not re-ask them.
- Question cap (Kiko, 7 Nov 2026): one discovery round of at most five questions per ask. Every other open point, including a stage-gate finding that is a default rather than a rule, becomes a numbered assumption in the spec file that Kiko approves or corrects by number. Business rules (a block, a refusal, money, what data is kept or removed, who may act) are always asked through Phase 3, never decided by Claude, even when the answer looks obvious (observation 0030).
- Run `stage-gate` as the size says. A **Stopped** gate means the next phase does not start. The gate checks that the phase's file exists and, from Phase 8, that the tests pass and `brand-ui-check` is clean; it checks the file, not just the reply.
- Every output is written to a file before the phase stops: the Feature Board, `work-board.md`, the spec file or `docs/`. Never only to chat. A phase is not complete until its file exists at its path.
- Caveman mode, if on, applies to chat replies only. Spec, design, mockup and any other file text is written in full sentences.

## Brand lock for Canvas and Cue screens

Every screen, mockup and component in Canvas, Cue and the Feature Board uses the Blank Space Events design system (https://claude.ai/artifact/4sHJEJj9Nin3eyh1bUgyo8) and Brand Guidelines v2.0: its colour tokens, colour roles, spacing, radii, alignment rules and the fonts below. On 5 Nov 2026 Kiko made the live Canvas look (the 11 Oct "Website look" in Brand.html §13) the official brand, so the design system and Brand.html now agree. When `frontend-design` pushes for a distinctive look, the brand wins: use its judgement for layout, hierarchy and restraint, never to pick new colours or new fonts.

Voice: copy on screens and in emails or messages Canvas or Cue send follows the Blank Space voice set in the brand-voice guidelines (`brand-voice:brand-voice-enforcement`). Where the voice is not yet generated, use the wording already in Canvas and flag the gap as an assumption.

Brand check: `anthropic-skills:brand-ui-check` tests each rendered screen for field alignment, font styling, header colours, table fit and link anchors. It reports; it does not fix.

### Colour roles

Use the role, not the raw colour: selected menu item yellow #F4F12C with ink #16151B text; primary action ink #16151B with white text, blue #2810DC on hover; links, focus and selected tabs blue #2810DC; headings and table headers purple #23006F; menu rail purple #23006F; status always with words (good #1E7A46 on #E5F3EA, warn #8A5300 on #FBF0D9, crit #B3261E on #FBE9E7, info #2810DC on #ECEAFD). Pink #F000AA, yellow and orange #F06A25 are decoration only. Page ground lavender #F6F2FC, cards white, lines #E3DDD0.

### Fonts

| Role | Font | Where | Rules |
|---|---|---|---|
| Display | Archivo Black | The Home greeting, announcements, document covers | Display moments only, one per screen. Never on buttons, labels, tables, forms or body text. |
| UI and body | Quicksand (Kiko, 7 Nov 2026) | Everything else: page titles, navigation, buttons, labels, forms, tables, cards, messages | Page title 34px/400; section headers 16px/700 purple; body 14px at 400 to 500; labels and buttons 700. Nothing smaller than 12px. |
| Numbers, money, IDs | Quicksand with `font-variant-numeric: tabular-nums` | Amounts, CE lines, quantities, Project IDs (S-25506500TR), REQ/SCP/ENT IDs | In tables, centre number cells (money, counts, percents) and centre every header (Kiko, 29 Oct 2026 14:32Z: "UI rule - for tables where the table values are numbers - align center. Headers are always aligned center"). Kiko 14:51Z added "middle align tables for short columns and the headers": a column whose filled cells are all 12 characters or fewer (status, P-stage, date, yes/no, code) is centred too. Long text keeps its alignment. Cells are middle-aligned. If the digits do not line up in the mockup, raise it with Kiko as a question card; do not swap in another font on your own (observation 0063). |
| Print and patterns only | Steagal, Steagal Rough | Kept in the design system for print pieces and pattern artwork | Never on Canvas, Cue or Feature Board screens. Where Steagal appears, keep the credit "Fonts by OnlineWebFonts.com (CC BY 4.0)". |

Fallback stacks: display `"Archivo Black", Quicksand, system-ui, sans-serif`; UI `Quicksand, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

Cue screens follow the live Cue look (Kiko, 7 Nov 2026): take colours, fonts and components from Cue's own stylesheet (`src/IndexStyle.html` and `src/CueStyle.gs` in kikodacanay14/Cue) before the design system, and use the design system only where Cue has no style for an element or Kiko has approved a restyle (observation 0034).

Known gaps: the app-wide gaps that exist today (for example Canvas still loads DM Sans as its body font in `src/Brand.html`) are accepted as a known baseline and listed in `brand-ui-check/references/known-gaps.md`. They are not re-reported as new findings on each screen.

Loading:

- Quicksand and Archivo Black: Google Fonts link in the page head (Canvas is an Apps Script HtmlService app; Google Fonts loads there), or the files in the design system's `fonts/` folder.
- Emails: email clients do not load web fonts, so email HTML uses `Quicksand, Arial, Helvetica, sans-serif` and is checked as it renders in Arial.
- Cue: any screen Cue renders itself (web view, approval page, email) follows the same table. Text Cue sends into ChatGPT or Claude cannot carry fonts; there only the wording and structure apply.
- Cue emails follow Kiko's BSE Message Templates Revised Google Doc (approved 6 Nov 2026): one banner layout for every audience, used as the image files in the design system Email group (client cyan #55D7E5 with black logo, supplier orange #CD5023 and crew magenta #B00C98 with white logo). Body white, 600px, 15px/1.55 ink. Action button: yellow #E9D151 pill, bold ink text, label from the doc, linking to the recipient's authorised Canvas record. "Step into Canvas": bold magenta #B00C98 link. Wording, subjects, variables and sign-offs come from the doc exactly.

### Patterns

Kiko, 5 Nov 2026: keep the patterns. The disc texture stays in the empty lower part of the menu rail, the diamond row stays in document headers, and the email banner keeps its planned diamond-and-orbit pattern. Reading surfaces (menu items, page header, tables, forms, windows) stay solid: no pattern behind text.

Adding or replacing a font or colour is Kiko's decision. Ask with `ask-kiko`.

## Phases

Each phase names the skill to load. Load it by the name the session's skill listing shows (for example `superpowers:brainstorming` in Claude Code, a plugin-prefixed name such as `frontend-design:frontend-design` in claude.ai). If a skill is not installed, do that phase by hand with the same output.

### Phase 0: Backlog pick (only when Kiko asks what to work on next)

Source: the Feature Board's Backlog column. Kiko is the product manager and picks by need. Claude never picks. Rank up to four candidates and present them as one `ask-kiko` card: for each, the business need it meets, what it unblocks, its size (small, medium, large), and anything it waits on. Recommend one. Move the chosen card to "For Scope Definition and Design" and start Phase 1.

### Phase 1: Discovery

Skill: brainstorming (superpowers). Read the sources in Kiko's order first: canonical docs, master tracker, approved specs, Drive files, code, then the conversation. Then reply with:

1. **What I understand**: the objective in two sentences. When the ask is a short complaint ("change that"), state the pain separately from the fix it proposes. Reproduce the pain against the live behaviour first; if the current design is meant to prevent that pain, treat it as a bug in that mechanism before reversing the design, and say so here (observation 0037).
2. **Assumptions**: the gaps the sources do not settle, each stated as an assumption Kiko can strike.
3. **Open questions**: only what no assumption can settle, at most five, each in a question card. This is the one discovery round (see "Question cap").
4. **Source probe**: for every external source the feature will read, fetch it once the way the production reader will (same client, no sign-in unless the feature has one) and record the status, the final URL after redirects, and whether the wanted data is in the response. A source that redirects to sign-in or returns no data is flagged here, with a search for a public equivalent (observation 0031).
5. **Proposed Definition of Done**: a checklist of what the finished work must include.

Write the output to the spec folder file for this ask (see Phase 5). Stop. Wait for Kiko's answers and strikes.

### Phase 2: Stress-test

Skill: grill-me. Run it on Kiko's answers and struck assumptions to surface gaps and conflicts. Do not open a second question round: each finding becomes a numbered assumption in the spec file, except a business rule, which goes to Phase 3. Write the result to the same file. Stop until Kiko approves or corrects the assumptions by number.

### Phase 3: Stories and rules

Skill: stories-and-rules. Break the ask into Epics and User Stories on the Feature Board, and pull every business rule into the Rules register as Waiting for Kiko. Stop until every rule a story needs is Approved or Kiko has dropped it.

### Phase 4: Mockups

Skills: frontend-design (load it directly, every time), then mockup-review if it is installed. Check each mockup against the brand with `design:design-system` (colour, type and spacing from the Brand lock table), check copy against the brand voice with `brand-voice:brand-voice-enforcement`, and run `anthropic-skills:brand-ui-check` on each rendered mockup at the three default widths. Follow frontend-design's two passes: write a short design plan (colour from the brand tokens, type from the Brand lock table, layout, principles), check it against the brief, then build. Polished, brand-locked mockups of every screen the stories show: images for single screens, clickable HTML for processes. Use real Blank Space content (real project names, ID formats, peso amounts) rather than filler. Take a screenshot and critique each screen before showing it. Save the mockups, the brand-check report and the brand-voice result to the spec folder. Kiko approves each screen. Skip only when no story shows anything to a person.

### Phase 5: Spec

Skill: write-spec (product-management). Write the requirements, scope and out-of-scope, and acceptance criteria tied to the story IDs and approved mockups. Write each rule by copying the approved card's option text verbatim, then re-read card against rule line by line (observation 0019). A rule that matches text or amounts against live data is dry-run read-only over today's live data before the spec is called done, and the hit list goes to Kiko (observation 0020). Before writing, read `work-board.md` in CanvasWorkspace and follow its rules (overlap check, add the card). Save the spec where the repo's CLAUDE.md says specs live (Cue: `canvas-integration/specs/` in the project files; handoffs between Cue and Canvas: `handoffs/` in CanvasWorkspace). If no location is named, ask Kiko once.

Present it to Kiko with explain-spec, then stop. Kiko approves the spec before any build.

### Phase 6: Design

Skill: system-design (engineering), plus frontend-design and ui-consistency:design for anything the end user sees. Record the components, data flow, bridge calls, data each part reads and writes, and the decisions with their trade-offs. For each data source the design reads, read its writer in the code and the sheet (what writes it, when, and whether a formula shifts it) before Kiko approves the design (observation 0020). For screens, record the type scale and font loading from the Brand lock. Put the design in the spec file or next to it, never only in chat.

Present it with explain-spec. Stop. Kiko approves the design.

### Phase 7: Plan

Skill: writing-plans (superpowers). Turn the approved design into ordered tasks with IDs and dependencies in the project's tracker. Move each ready story to "For Development". Then hand off to Phase 8.

### Phase 8: Build and test

Run in Claude Code on Kiko's PC. Skills: ponytail (minimal-change edits, after-reply summaries), then the build workflow already in the repo's CLAUDE.md. Build one task at a time in dependency order; each task's output is written to the tracker and the spec before the next task starts.

Test the build with `engineering:testing-strategy` for the test plan and coverage, and `agent-protocols:browser-testing-with-devtools` for every screen. Run `anthropic-skills:brand-ui-check` on every changed screen; any fail is fixed in the build and re-checked. A task is not done until its tests pass, its brand check is clean, and its acceptance criteria in the spec are checked off, with `anthropic-skills:verify-before-done` run before any "done" claim. Failures are debugged in the build, not handed back to Kiko unless a decision is needed. Before release, test the change at every entry point (every call that reads or changes a session, access, money or bank data, not only the page's main call) with fixtures built from the real field names and real-shaped data, and run one independent review agent given the code and the spec but not your conclusions (observation 0017). Record the results in the tracker and the Definition of Done record.

### Definition of Done record

One file per ask in the spec folder, updated at every phase: task ID and title, objective and scope, decisions with trade-offs, assumptions and Kiko's answers to them, acceptance criteria, brand-check result, dependencies, artifact or PR, verification performed and result, known limitations, unresolved risks, completion date, next-task handoff. Chat messages alone do not count as documentation.

## Rules this skill carries (all are Kiko's own)

- No code before Kiko approves the spec (Cue CLAUDE.md, "Working style").
- Discovery answer first, deliverable after his answers (Kiko's account preferences).
- Never invent a new rule, guard or block; ask Kiko yes/no first (CanvasWorkspace CLAUDE.md, "Never").
- Durable outputs go to shared files that Claude and ChatGPT/Codex both read, not chat.
- Questions to Kiko are question cards: headline, plain meaning, why it matters, options with pros and cons, recommendation (Kiko, 29 Oct 2026).
- Stop on big problems, note small ones (Kiko's choice for the stage gate, 29 Oct 2026).
- All UI uses the Blank Space design system and the Brand lock fonts; frontend-design is loaded for every screen (Kiko, 29 Oct 2026).
- List assumptions rather than asking many questions; do not repeat answered questions (Kiko's account preferences, 3 Nov 2026).
- One discovery round of at most five questions; everything else is a stated assumption; business rules are always asked (Kiko, 7 Nov 2026).
- Body font Quicksand; Cue screens follow the live Cue look; today's app-wide gaps are a known baseline (Kiko, 7 Nov 2026).

## For ChatGPT and Codex

They cannot load Claude skills. `AGENTS.md` at the repo root points them to this file; they follow the phases by hand, including the Brand lock table and the brand-ui-check steps.
