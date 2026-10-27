---
name: scope-then-design
description: Use at the start of any new task, feature, build or project for Canvas, Cue or Blank Space work — runs discovery, stress-test, spec, design and plan in order, with Kiko's approval before any code.
---

# Scope then design

One entry point for turning an ask into an approved design before anything is built. It chains skills that already
exist; it adds no new tooling. Kiko asked for it on 27 Oct 2026 ("a more structured way of defining requirements and
understanding of the asks. Structurally design solutions before coding and implementing").

Canonical copy: `kikodacanay14/CanvasWorkspace/.claude/skills/scope-then-design/SKILL.md`. The copy in
`kikodacanay14/Cue` and the one saved to Kiko's Claude account mirror it. Change the canonical copy first, then the others.

## Where it applies

- A new task, feature, build or project in Canvas, Cue or Blank Space operations.
- Not for: a quick question, a bug with a known cause, or work whose spec Kiko has already approved (go to Resume).

## Resume first

Before Phase 1, look for this ask's existing spec, design or plan: the repo's `work-board.md` row, `handoffs/`, the
project files, open branches (`git for-each-ref --sort=-committerdate refs/remotes`). Skip every phase whose output Kiko
already approved, and start at the first one he has not. Never re-ask an answered question.

## Phases

Each phase names the skill to load. Load it by the name the session's skill listing shows (for example
`superpowers:brainstorming` in Claude Code, a plugin-prefixed name in claude.ai). If a skill is not installed, do that
phase by hand with the same output.

### Phase 1: Discovery

Skill: brainstorming (superpowers). Read the sources in Kiko's order first: canonical docs, master tracker, approved
specs, Drive files, code, then the conversation. Then reply with:

1. **What I understand**: the objective in two sentences.
2. **Clarifying questions**: 3 to 5 specific questions on edge cases, constraints, users and missing data. Never guess
   business, operational or financial facts.
3. **Proposed Definition of Done**: a checklist of what the finished work must include.

Stop. Wait for Kiko's answers.

### Phase 2: Stress-test

Skill: grill-me. Run it on Kiko's answers to surface gaps and conflicts. Ask only what changes the design, batched in one
message. Stop until answered.

### Phase 3: Spec

Skill: write-spec (product-management). Write the requirements, scope and out-of-scope, and acceptance criteria tied to
task IDs. Before writing, read `work-board.md` in CanvasWorkspace and follow its rules (overlap check, add the card).
Save the spec where the repo's CLAUDE.md says specs live (Cue: `canvas-integration/specs/` in the project files;
handoffs between Cue and Canvas: `handoffs/` in CanvasWorkspace). If no location is named, ask Kiko once.

Stop. Kiko approves the spec before any build.

### Phase 4: Design

Skill: system-design (engineering), plus ui-consistency:design for anything the end user sees. Record the components,
data flow, bridge calls, data each part reads and writes, and the decisions with their trade-offs. Put the design in the
spec file or next to it, never only in chat.

Stop. Kiko approves the design.

### Phase 5: Plan

Skill: writing-plans (superpowers). Turn the approved design into ordered tasks with IDs and dependencies in the
project's tracker. Then hand off to the build workflow already in the repo's CLAUDE.md.

## Rules this skill carries (all are Kiko's own)

- No code before Kiko approves the spec (Cue CLAUDE.md, "Working style").
- Discovery answer first, deliverable after his answers (Kiko's account preferences).
- Never invent a new rule, guard or block; ask Kiko yes/no first (CanvasWorkspace CLAUDE.md, "Never").
- Durable outputs go to shared files that Claude and ChatGPT/Codex both read, not chat.

## For ChatGPT and Codex

They cannot load Claude skills. `AGENTS.md` at the repo root points them to this file; they follow the phases by hand.
