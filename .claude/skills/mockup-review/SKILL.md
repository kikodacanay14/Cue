---
name: mockup-review
description: Use inside scope-then-design after user stories are written — makes polished, brand-locked mockups of every screen a story shows, gets Kiko's approval screen by screen, and saves the approved versions so the build copies them exactly.
---

# Mockup review

Kiko asked for this on 29 Oct 2026: polished mockups from the start, one uniform Blank Space look across everything,
shown to him before anything is built.

## Brand lock

- Use only the approved Blank Space brand system: its colors, fonts, spacing and components. Never improvise a color,
  font or component.
- The canonical brand system is the **Blank Space Events** design system:
  https://claude.ai/artifact/4sHJEJj9Nin3eyh1bUgyo8 (Kiko, 29 Oct 2026). Read its `project/README.md` and
  `project/tokens.json` before every mockup; take every color, font, spacing and radius from there. Official palette:
  deep purple #2B0169, magenta #B00C98, orange #CD5023, yellow #E9D151, sky blue #559FEF, white. Display font Steagal,
  body Quicksand. Default ground is Night (card navy); Paper for documents.
- Canvas's current `src/Brand.html` uses a different set (hot pink, electric blue, Archivo Black). It is not the brand
  system; the "Restyle Canvas and the Feature Board" epic moves it onto the canonical one.
- Keep the design system's own rules: one highlight per view, the spectrum gradient only for heroes and covers, never
  yellow on white, and the required font credit.
- Load `frontend-design` for craft, and tell it the brand lock overrides its own style choices.

## What to make

- **One screen, no flow** (a card, a form, a page): a polished image.
- **A process across several steps** (sign-up, pay, approve, sign): a clickable HTML mockup that walks through every
  step.
- Every screen shows its real states: filled, empty, loading, error, and phone width. Use realistic Blank Space
  examples (real-looking project names, amounts in ₱), never lorem ipsum.
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
