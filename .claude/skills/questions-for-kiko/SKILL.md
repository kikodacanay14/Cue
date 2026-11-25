---
name: questions-for-kiko
description: Use when Kiko asks what is waiting for him, what Claude needs from him, or opens his "Questions for Kiko" chat — gathers every Delivery Board card assigned to him across Cue and Canvas, shows each as a plain question card, and writes his answers back to the right card.
---

# Questions for Kiko

Kiko asked for this on 29 Oct 2026: one regular chat where he can see and answer everything any project needs from
him. A chat cannot receive messages from other chats, so this skill reads the shared Delivery Board (formerly the Feature Board), where every project
already assigns cards to him when it needs him (`work-board.md`, "Feature Board fields").

## Read what is waiting

1. Query the Delivery Board (https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP) with the `ArtifactData` tool:
   `action: "query"`, `collection: "features"`, `query: {"where": [["doer", "==", "Kiko"]]}`.
2. On each card, the open questions are the `qa` entries with `s: "Open"`. A card assigned to Kiko with no open `qa`
   entry still needs him: its `next` field says what. Treat that as one question.
3. Also list approval requests still waiting in Concord (`concord-handover` `list_inbox`), since approvals and
   questions now go there first (Kiko, 25 Nov 2026). Show each one once, even when a card carries the same question.
4. If nothing is waiting, say so in one line and stop.

## Show them

- Start with one line: how many questions, from which projects.
- Show at most four at a time, oldest card first, each as an `ask-kiko` question card, numbered for this chat.
- Rewrite each question in plain words from the card's `name`, `desc`, `next` and the `qa` text. Keep its meaning
  exactly. Add the project ("Cue", "Canvas") and the feature name to the headline so he knows where it came from.
- If a board question is unclear or is really an internal question for Claude, say so plainly and offer to send it back
  to the project without an answer.
- After four, end with "Reply to these, then say 'next' for the rest."

## Record his answers

For each answer:

1. Read the card again (`action: "get"`), so you have its current `version`.
2. `action: "update"` with `if_version`:
   - in `qa`, set that entry's `a` to his answer in his own words and `s` to `"Answered"` (send the whole `qa` list
     back, every other entry unchanged);
   - set `doer` back to the project: `"Cue"` when `app` is `Cue`, otherwise `"Claude (Canvas)"`;
   - set `handedAt` to the current time (ISO), so the project's next session treats it as handed back.
3. If the answer approves a rule change, add one row to the Delivery Board's Decisions tab (collection `decisions`:
   project, topic, decision, status, by, date, source) and read it back.
4. Confirm in one line per card: what you recorded and which project it went back to.

## Rules

- Record only. Never carry out the action itself (no deploy, no send, no merge) from this chat: the project that owns
  the card does that when it next runs.
- Never guess an answer or fill one in from a recommendation. If his reply is unclear, ask again with `ask-kiko`.
- Never delete a card or a `qa` entry. Change only `qa`, `doer` and `handedAt`.
