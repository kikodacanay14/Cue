---
name: ask-kiko
description: Use every time Claude needs an answer, choice or approval from Kiko — writes a clear question card (numbered headline, plain meaning, why it matters, options with pros and cons, recommendation) as the last part of the reply so it never gets buried.
---

# Ask Kiko

Kiko asked for this on 29 Oct 2026: he often does not recognise that something is a question, or what it asks him to
do. Every question to him follows this card. No exceptions, including one-line yes/no checks.

## The question card

1. **Headline**: `QUESTION n of N: <the question in one plain line>`.
2. **What it means**: plain words, no internal terms (no task IDs, file names, "bridge", "spec", "gate"), and one real
   example from Blank Space work.
3. **Why it matters**: what changes for Kiko depending on his answer.
4. **Options**: two to four, lettered A, B, C. Each has one line of pros and one line of cons.
5. **Recommendation**: the letter and one sentence why.
6. **How to reply**: "Reply with the letter, or type your own answer."

## Where the card goes

1. In the chat, in full, as the last part of the reply, under a bold headline, so he sees it where he is reading.
   Nothing else comes after it.
2. When the question belongs to a Feature Board card, also put it on that card, so it shows up in his
   "Questions for Kiko" chat (skill `questions-for-kiko`): add `{q, a: "", s: "Open"}` to the card's `qa` list and set
   `doer` to `"Kiko"` (`work-board.md`, "Feature Board fields").

(Kiko had the side panel and the pinned Questions page removed on 29 Oct 2026; neither worked for him. He chose a
regular Questions chat that reads the Feature Board instead.)

## Rules

- Ask only what needs Kiko: a business decision, a rule, an approval, missing business facts, or an action only he can
  take. Decide routine technical choices yourself and say what you decided. A choice is routine only when nothing Kiko
  or a user can see changes. A change to what is deleted, kept, blocked or sent, or to who may act, is a rule: put it
  on a card as an open question, never as "a routine call I'm making" (observation 0029).
- Before drafting any card, check its subject. A sign-in, a typed OK, a code, a setting change or a copy-paste is not a
  question for Kiko, however small the tap: Kiko takes no such tasks. Write the exact steps for IT in HANDOVER and
  carry on (observation 0093).
- Ask about an action Claude would take for him as "May Claude do X? You don't do anything. Yes = Claude does it.
  No = nothing changes." (Feature Board rule, Kiko 27 Oct 2026.)
- One idea per question. Never fold two decisions into one question. A design choice and a go-ahead never share a
  card: an option label or consequence about scope or design never says "I build it". An approval card's label names
  the exact action it approves (observations 0090, 0092).
- An answer covers only the question it answers. "1 yes" to question 1, or a tap on one design option, approves that
  question alone, never the rest of the scope, the build, a merge or a deploy.
- Never guess his answer. If his reply is unclear or lands in the wrong place, restate what you understood as a new
  card with "A. Yes, that's right / B. No" and wait.
- Never invent options he must accept: always allow "type your own answer".
