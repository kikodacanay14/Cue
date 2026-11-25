---
name: stage-gate
description: Use at the end of every scope-then-design phase, before moving to the next one — checks the phase's output for completeness and accuracy, stops on big problems, notes small ones, and records the result.
---

# Stage gate

Kiko asked for this on 29 Oct 2026: an observer on every step of the process that ensures completeness and accuracy,
so problems are caught before building instead of causing rebuilds and bug fixes. Kiko chose: stop on big problems,
note small ones.

How hard to check follows the size set in `scope-then-design` (Kiko, 29 Oct 2026, to keep usage down):

- **Small**: one check at the end, by the same Claude, against the big-problem list only.
- **Medium**: after each phase, by the same Claude, the full checklist.
- **Large**: after each phase, in a separate agent that did not write the work, so the work does not grade itself.
  Give it the phase output and this checklist only.

## Big problems: stop

The next phase does not start until each is fixed or Kiko decides it:

- A rule the work depends on is not **Approved** in the Delivery Board's Decisions tab or the Rules register.
- A required approval from Kiko is missing (spec, design, a mockup screen, a rule).
- A business, operational or financial fact was guessed rather than taken from a canonical source.
- Two sources disagree and the work silently picked one.
- A story has no acceptance criteria, or a criterion cannot be checked by looking at the screen or sheet.
- A screen in a story has no approved mockup, or a mockup screen maps to no story.
- The work overlaps another project's card on the Delivery Board and Kiko has not said who owns it.
- The work changes something Kiko did not ask for.

## Small problems: note and continue

- Wording, typos, unclear labels.
- A missing example or edge case that does not change what gets built.
- Formatting of docs or cards.

Fix small problems in place when the fix is within scope; list them in the gate record either way.

## Per-phase checklist

| Phase | Check |
|---|---|
| Discovery | Objective in two sentences; questions cover edge cases, users, constraints, missing data; Definition of Done drafted. |
| Stress-test | Every gap found has an answer or an open `ask-kiko` card. |
| Stories and rules | Every story has all fields from `stories-and-rules`; every rule has a register status; dependencies form no loop; the story's unit and edge-case test cases are in the app's Application QA File. |
| Mockups | Every screen of every story has an approved mockup in `docs/mockups/<story-id>/`; brand lock respected. |
| Spec and design | Every requirement traces to a story; the `explain-spec` explanation exists; Kiko's approval is recorded. |
| Plan | Every task traces to a story and has an ID, dependencies and a check. |

## Gate record

Write the result on the story cards (Delivery Board) or next to the spec file, never only in chat:
date, phase, **Pass** or **Stopped**, each big problem with what it needs, each small problem with whether it was fixed.

When stopped, tell Kiko only what needs him, as `ask-kiko` cards: the exact blocker, the decision needed, the impact of
waiting, and what work continues meanwhile.
