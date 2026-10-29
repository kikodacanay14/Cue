---
name: ask-kiko
description: Use every time Claude needs an answer, choice or approval from Kiko — puts the question in a clear question card (numbered headline, plain meaning, why it matters, options with pros and cons, recommendation) in his floating Questions panel so it never gets buried.
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

- If the tool `mcp__kiko-questions__ask` is available, put every card there. Then say in the chat, in one line, that a
  question is waiting in the Questions panel. After Kiko answers in chat, call `mcp__kiko-questions__resolve` with the
  question id and his answer. Answers he presses in the panel resolve themselves.
- If the tool is not available, write the card in the chat in full prose, with the headline in bold, and put it last in
  the message so it is not buried under other text.
- On the Feature Board, a card assigned to Kiko uses the same card in its question text.

## Rules

- Ask only what needs Kiko: a business decision, a rule, an approval, missing business facts, or an action only he can
  take. Decide routine technical choices yourself and say what you decided.
- Ask about an action Claude would take for him as "May Claude do X? You don't do anything. Yes = Claude does it.
  No = nothing changes." (Feature Board rule, Kiko 27 Oct 2026.)
- One idea per question. Never fold two decisions into one question.
- Never guess his answer. If his reply is unclear or lands in the wrong place, restate what you understood as a new
  card with "A. Yes, that's right / B. No" and wait.
- Never invent options he must accept: always allow "type your own answer".
