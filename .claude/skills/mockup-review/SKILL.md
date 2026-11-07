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
- The brand rules are the "Brand lock for Canvas and Cue screens" section of `scope-then-design` (colour roles, fonts,
  alignment) and the target app's live stylesheet. First copy the target app's live tokens into the mockup (Canvas:
  `src/Brand.html`; Cue: `src/IndexStyle.html` and `src/CueStyle.gs`), using `ui-consistency:finding-patterns`. Use the
  Blank Space Events design system (https://claude.ai/artifact/4sHJEJj9Nin3eyh1bUgyo8) only where the app has no style
  for an element, or where Kiko has approved a restyle (observation 0034).
- Body font Quicksand, even where a live stylesheet still loads DM Sans (a known gap). Cue screens follow the live Cue
  look (Kiko, 7 Nov 2026).
- Before building, list the colour role of every filled element (buttons, tabs, tags, highlights) in the design plan
  and check each against the Brand lock's colour roles (observation 0034).
- Keep the design system's own rules: one highlight per view, the spectrum gradient only for heroes and covers, never
  yellow on white, and the font credit wherever Steagal appears.
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
