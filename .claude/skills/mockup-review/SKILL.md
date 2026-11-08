---
name: "mockup-review"
description: "Use inside scope-then-design after user stories are written — makes polished, brand-locked mockups of every screen a story shows, gets Kiko's approval screen by screen, and saves the approved versions so the build copies them exactly."
---

# Mockup review

Kiko asked for this on 29 Oct 2026: polished mockups from the start, one uniform Blank Space look across everything,
shown to him before anything is built.

## Brand lock

- Use only the approved Blank Space brand system: its colors, fonts, spacing and components. Never improvise a color,
  font or component.
- The canonical brand system is the **Blank Space Events** design system:
  https://claude.ai/artifact/4sHJEJj9Nin3eyh1bUgyo8, version 2.0 of 5 November 2026 (Kiko, Question 1 = A: the live Canvas
  look is the official brand). Read its `project/README.md` and `project/tokens.json` before every mockup; take every
  color, font, spacing and radius from there. Palette: purple #23006F, pink #F000AA, orange #F06A25, yellow #F4F12C,
  electric blue #2810DC, ink #16151B, white. Display font Archivo Black (one display moment per screen), everything else
  DM Sans. Default ground is Paper (lavender #F6F2FC) with white cards and a purple menu rail.
- Canvas's current `src/Brand.html` (§13, Website look) is the live form of version 2.0. Version 1.0 (29 Oct 2026: deep
  purple #2B0169, card navy, Steagal and Quicksand) is retired from app screens.
- Keep the design system's own rules: one display moment per screen, the gradient only for the Home greeting, heroes and covers, never
  yellow on white, and status always shown with words, never colour alone.
- The brand rules are the "Brand lock for Canvas and Cue screens" section of `scope-then-design` (colour roles, fonts,
  alignment). Also copy the target app's live tokens into the mockup (Canvas: `src/Brand.html`; Cue: `src/IndexStyle.html`
  and `src/CueStyle.gs`), using `ui-consistency:finding-patterns`, so the mockup looks like the app Kiko compares it with.
  Where the live stylesheet and design system 2.0 differ, follow 2.0 and list the difference in the design plan, or check
  `brand-ui-check/references/known-gaps.md` (observation 0034).
- Before building, list the colour role of every filled element (buttons, tabs, tags, highlights) in the design plan
  and check each against the Brand lock's colour roles (observation 0034).
- Load `frontend-design` for craft, and tell it the brand lock overrides its own style choices.

## What to make

- **One screen, no flow** (a card, a form, a page): a polished image.
- **A process across several steps** (sign-up, pay, approve, sign): a clickable HTML mockup that walks through every
  step.
- Every screen shows its real states: filled, empty, loading, error, and phone width. Use realistic Blank Space
  examples (real-looking project names, amounts in ₱), never lorem ipsum.
- When the ask is "show X" or "let me edit X", mock the working screen (filter, list, viewer, edit state) built from
  the real source data and assets, not a document about it. Organise it by the source's own codes or ordering
  (observation 0032).
- Before calling anything in a source missing, read the source in full and count its entries. Never list it through
  `head`, `tail` or any other cut (observation 0032).
- Label each screen with its story ID.

## Showing Kiko

1. Publish clickable mockups as a private page; send images in the chat.
2. Ask one question per screen with `ask-kiko`: "A. Approve / B. Change (tell me what) / C. Drop this screen".
3. Kiko is the only reviewer. Approval is per screen.
4. A changed screen goes back to him; never treat a change request as approval.

## Saving

- Save each approved screen in CanvasWorkspace at `docs/mockups/<story-id>/` with the date and "Approved by Kiko".
- Link the folder from the story card on the Feature Board.
- The approved mockup becomes part of the story's acceptance criteria: the built screen must match it.
- A change after approval goes through this review again.
