# Domain docs

How the engineering skills read this repo's domain documentation. Layout: single-context.

## Before exploring, read these

- **`docs/business-rules.md`** and **`docs/decisions.md`**: this repo's decision record. They play the role ADRs play in other
  repos. Keep their rule and question IDs, exact answers and source dates as written.
- **`AGENTS.md`** and the nested guide for the files being changed.
- **`GLOSSARY.md`** at the repo root, if it exists. It does not exist yet; create it only when a term is actually settled.
- **`docs/adr/`**, if it exists. It does not exist yet; decisions keep going into `docs/decisions.md` unless Kiko says otherwise.

If a file is missing, carry on without flagging it.

## Use the project's vocabulary

When output names a domain concept (a card title, a spec, a test name), use the term as it appears in the business rules,
decisions or glossary. Do not drift to synonyms.

## Flag conflicts

If output contradicts a recorded decision or business rule, say so plainly and name it. Never override it silently, and never
change a rule without Kiko's approval (CLAUDE.md, "Never").
