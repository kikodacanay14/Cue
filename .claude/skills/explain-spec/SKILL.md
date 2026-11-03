---
name: explain-spec
description: Use whenever a spec, design, plan or story set is shown to Kiko for approval — explains it in plain business language with a worked example, what changes for each person, edge cases, and what he is approving.
---

# Explain a spec to Kiko

Kiko asked for this on 29 Oct 2026: Claude must explain specifications better. Kiko is the only reader of these
explanations. He is the Business Lead, not a developer.

## The explanation, in this order

1. **In one sentence**: what this does for the business.
2. **Walk through one real example**: a named-looking project, person and amount, step by step, as Kiko would see it
   happen ("Jay-ar opens the link on his phone, sees his FSA, signs, and Canvas marks it Signed").
3. **Who it changes things for**: one line each for Kiko, staff, crew, suppliers and clients, only those affected.
4. **What happens when things go wrong**: the edge cases in plain words, each with what Canvas does about it.
5. **The rules it uses**: each in plain words, with its status (Approved or still waiting for Kiko).
6. **What it does not do**: the out-of-scope list.
7. **A picture** when the process has more than three steps or more than two people: a simple flow diagram.
8. **What you are approving**: one closing line, followed by the approval question as an `ask-kiko` card.

## Language rules

- No internal terms: no task IDs, file names, function names, "bridge", "gate", "endpoint", "schema". If one is
  unavoidable, explain it in the same sentence.
- Short sentences, active voice, real Blank Space examples.
- Never hide a cost, risk or open question at the end; put it where it applies.
- The full technical spec still lives in its file for the builder. This explanation is extra, not a replacement.
