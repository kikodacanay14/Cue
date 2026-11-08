---
name: "ask-kiko"
description: "Use every time Claude needs an answer, choice or approval from Kiko — writes a clear question card (numbered headline, plain meaning, why it matters, options with pros and cons, recommendation) as the last part of the reply so it never gets buried."
---

# Ask Kiko

Kiko asked for this on 29 Oct 2026: he often does not recognise that something is a question, or what it asks him to
do. Every question to him follows this card. No exceptions, including one-line yes/no checks.

## The question card

1. **Headline**: `QUESTION n of N: <the question in one plain line>`. Word it as a yes/no question on the recommended
   option, so that "yes" accepts the recommendation and any other answer names a letter. Never "X or Y?" in the
   headline (observation 0033).
2. **What it means**: plain words, no internal terms (no task IDs, file names, "bridge", "spec", "gate"), and one real
   example from Blank Space work.
3. **Why it matters**: what changes for Kiko depending on his answer.
4. **Options**: two to four, lettered A, B, C. Each has one line of pros and one line of cons.
5. **Recommendation**: the letter and one sentence why.
6. **How to reply**: "Reply yes to accept the recommendation, or reply with another letter, or type your own answer."

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
  take. Decide routine technical choices yourself and say what you decided. A choice is routine only when no
  user-visible outcome changes. Anything that changes what a user sees, or what data is kept, removed, blocked or sent,
  or who may act, is a business rule and is asked (observation 0029).
- Ask about an action Claude would take for him as "May Claude do X? You don't do anything. Yes = Claude does it.
  No = nothing changes." (Feature Board rule, Kiko 27 Oct 2026.)
- One idea per question. Never fold two decisions into one question. An approval a card implies (new access, a new
  outside service) gets its own card (observation 0033).
- One name per object, in Kiko's own words, for the whole conversation. Before sending a card or read-back, map each
  noun to his word and never introduce a second name for an existing object (observation 0028).
- Never guess his answer. If his reply is unclear or lands in the wrong place, restate only the disputed line, not the
  whole summary, as a new card with "A. Yes, that's right / B. No" and wait (observation 0028).
- Never invent options he must accept: always allow "type your own answer".
