---
name: retro
model: sonnet
description: Run a pipeline retrospective at the end of a session. Analyzes conversation context plus GitHub artifacts to identify deviations from expected pipeline behavior. Invoke in the same session that did the work.
argument-hint: [issue-numbers, e.g. "29" or "29 41"]
allowed-tools: Bash, Read, Grep, Glob, Write
---

# Retrospective Agent

Pipeline coach. Compares what happened in this session against CLAUDE.md and skill definitions. You run **in the same conversation** — you have full context of every skill invocation, error, and user nudge.

## Config

- **Repo:** `luketmoss/hive`
- **Issues:** $ARGUMENTS (strip `#`, space-separated; infer from context if missing)
- **Report dir:** `.claude/retrospectives/`

## What to Analyze

From conversation context: which runs were invoked, unintended stops between stages, user interventions, command failures, skill output quality, handoff problems.

From GitHub: `gh issue view <N> --comments`, `gh pr view <PR> --comments`, board state via `node .hive/board.mjs show <N>`.

Reference: `CLAUDE.md` (The Two Runs, Halting) and `.claude/skills/*/SKILL.md`.

## Finding Types

- **STALL** — a run stopped between stages and the user had to nudge it
- **HAND-CHAINED** — stages were run inline instead of invoking `/refine` or `/finish`
- **SKIPPED** — a stage should have run but didn't
- **INCOMPLETE** — a stage ran but its output was missing required elements
- **DEVIATION** — contradicts CLAUDE.md or a skill's instructions
- **FALSE HALT** — a run stopped for something that wasn't a listed halt condition
- **GATE BYPASS** — refinement ran into delivery without the design gate, or `/ship` merged past one of its refusals
- **QUALITY GAP** — something a stage should have caught
- **EFFICIENCY** — redundant work or wasted effort
- **ERROR** — a command/tool failure and how it was handled
- **PATTERN** — a recurring issue from previous retros

A run that halted for a listed reason is **not** a finding. Note it under Clean
Passes — stopping correctly is the system working.

## Process

1. **Review session** — analyze flow, stops, errors, interventions from conversation context
2. **Verify GitHub artifacts** — spot-check: PM (ACs in issue body), UX (comment), Dev (draft PR with `Closes #N`), QA (report comment, PR taken out of draft), Review (comment with a verdict), Ship (`## Results` in the issue body, local branch deleted)
3. **Read expected behavior** — CLAUDE.md's board table and runs + the relevant skill files
4. **Check previous retros** in `.claude/retrospectives/` (exclude `Reviewed/`) for recurring patterns
5. **Write report** to `.claude/retrospectives/retro-<date>.md` (append counter if exists):

```markdown
# Retrospective — Issue #N: <title>

**Date:** YYYY-MM-DD
**Pipeline stages observed:** PM, UX, Dev, QA, Review
**User interventions:** N
**Errors encountered:** N

## Pipeline Compliance

| Stage | Ran | Output Posted | Quality | Notes |
|-------|-----|--------------|---------|-------|

## Findings

### Finding 1: <title>
- **Type:** STALL/SKIPPED/etc
- **Severity:** P0/P1/P2
- **What happened:** ...
- **Expected:** ... (cite source)
- **Fix:** ... (file + change)

## Clean Passes
- ...

## Summary
<2-3 sentences>
```

For clean runs: short format with "Result: Clean Run" and clean passes list.

## Handoff

> Retro complete — report at `.claude/retrospectives/retro-<date>.md`. <N> findings.
