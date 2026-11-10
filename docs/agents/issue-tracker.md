# Issue tracker: Feature Board

Issues, specs and tickets for this repo live as cards on the Feature Board, not in GitHub Issues (Kiko chose this on 8 Nov 2026).
The rules for the board are in `CLAUDE.md` ("Feature Board") and `AGENTS.md` ("Questions and decisions"); this file only maps
the engineering skills' operations onto them and adds no rule of its own.

- Board: https://claude.ai/artifact/VDVXsxnpX36S91w8PXEauP
- Storage: the artifact's database, collection `features`, read and written with the `ArtifactData` tool. Pass `if_version`
  on every write to an existing card.
- Fields and columns: CanvasWorkspace `work-board.md`, "Feature Board fields".

## Conventions

- **Create a ticket**: check existing cards first (AGENTS.md: no duplicate cards or questions). Then `ArtifactData` "set" a new
  document in `features` with the card fields, in the column that matches its state (usually Backlog or For Scope Definition
  and Design).
- **Read a ticket**: `ArtifactData` "get" on `features` with the card id.
- **List tickets**: `ArtifactData` "query" or "list" on `features`, filtered by column, epic (`area`) or Assigned To (`doer`).
- **Comment / record a question**: add it to the card's question fields as AGENTS.md describes (exact question text, answer left
  blank until Kiko answers).
- **Change state**: move the card to the matching column in the same turn its status changes.
- **Close**: a shipped item moves to For Testing (live) with `liveAt` and `ref`, then For Release after the live test. Nothing
  is deleted.

Sub-tickets: use an epic (`area`) to group related user stories; there is no parent/child link between cards.

## When a skill says "publish to the issue tracker"

Create or update a Feature Board card as above. Never open a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read the card by id from `features`. Kiko will normally name the card id or its title.

## If the board cannot be reached

Report the exact unsynced items and leave them open (AGENTS.md). Do not file them anywhere else instead.

## Pull requests

PRs are not a request surface. Each PR fills in the "Feature Board" line of `.github/pull_request_template.md`.
