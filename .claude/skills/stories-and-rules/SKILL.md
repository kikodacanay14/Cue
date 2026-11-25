---
name: stories-and-rules
description: Use inside scope-then-design to break an approved ask into Epics and User Stories on the Feature Board, and to pull every business rule out of them into the Rules register as Waiting for Kiko before anything is built.
---

# Stories and rules

Kiko asked for this on 29 Oct 2026: break each ask into small documented pieces, form epics and user stories properly,
and confirm process and business rules before building.

## Where things live

- **Stories**: the Feature Board (https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP), mirrored in `work-board.md`. One
  card is one User Story; its Epic is the card's `area` field (`work-board.md`, "Feature Board fields"). Never start a
  second tracker.
- **Rules**: `docs/system-reference/` in CanvasWorkspace. A rule is locked only when its status is **Approved** there
  (`docs/system-reference/README.md`).

## Step 1: Epics

Group the ask into Epics: one Epic per business outcome Kiko would recognise ("Crew sign their FSA on their phone"), not
per technical layer. Check `work-board.md` for an existing Epic first and reuse it. If the ask touches another project's
card, stop and ask Kiko which project owns it (`ask-kiko`).

## Step 2: User Stories

Write each story small enough to build, test and show in one sitting. Each story has:

- **ID**: the next free ID in the board's own format.
- **Story**: "As a <real Blank Space role>, I want <one thing>, so that <business reason>."
- **Acceptance criteria**: Given / When / Then lines, each one checkable by looking at the screen or the sheet.
- **Screens**: the screens it shows or changes (these become mockups).
- **Data**: the sheet, tab and columns it reads or writes (from `docs/system-reference/`, never guessed).
- **Rules**: the rule IDs it depends on (Step 3).
- **Depends on**: other story IDs.
- **Out of scope**: what this story does not do.

Split any story whose criteria need more than one screen flow or touch more than one sheet for writing.

## Step 3: Rules

A rule is any block, guard, check, refusal, "can't" or "must first" condition, limit, threshold or automatic decision
(CLAUDE.md, "Never invent your own rules").

1. List every rule each story needs, in plain words, with one example.
2. Look each one up in `docs/system-reference/generated/rules-register.md` and the page chapters.
   - **Approved**: cite it. Done.
   - **Waiting for Kiko / Not reviewed**: it is not usable yet. Add it to this ask's rule list.
   - **Not there**: it is new. Write it into the register as **Waiting for Kiko**, with the story ID that needs it.
3. Ask Kiko about the open rules in one batch with `ask-kiko`, one card per rule, at most four cards at a time. Group
   rules by page so he answers related ones together.
4. Record each answer in the register with the date and his words: Approved, Kiko said remove, or changed wording.
5. A story whose rules are not all Approved stays in "For Scope Definition and Design". It never moves to
   "For Development".

## Step 4: Write it back

Update each card on the Feature Board and its row in `work-board.md` (through a docs-only PR, per the board's rules).
Nothing in this step lives only in chat.
