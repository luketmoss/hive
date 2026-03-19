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

From conversation context: pipeline flow/order, unintended stops between stages, user interventions, command failures, skill output quality, handoff problems.

From GitHub: `gh issue view <N> --comments`, `gh pr view <PR> --comments`, board state via `gh project item-list`.

Reference: `CLAUDE.md` (Pipeline Orchestration) and `.claude/skills/*/SKILL.md`.

## Finding Types

- **STALL** — pipeline stopped, user had to nudge
- **SKIPPED** — stage should have run but didn't
- **INCOMPLETE** — stage ran but output missing required elements
- **DEVIATION** — contradicts CLAUDE.md or skill instructions
- **QUALITY GAP** — something pipeline should have caught
- **EFFICIENCY** — redundant work or wasted effort
- **ERROR** — command/tool failure and how it was handled
- **PATTERN** — recurring issue from previous retros

## Process

1. **Review session** — analyze flow, stops, errors, interventions from conversation context
2. **Verify GitHub artifacts** — spot-check: PM (ACs in issue body), UX (comment), Dev (PR with Closes #N), QA (report comment), Review (comment)
3. **Read expected behavior** — CLAUDE.md pipeline section + relevant skill files
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
