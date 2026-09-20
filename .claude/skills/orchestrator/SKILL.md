---
name: orchestrator
model: sonnet
description: Batch-process all children of a parent issue through the refinement and delivery runs. Use when the user wants to process multiple sub-issues at once (e.g., "#3 children" or "process all children of #3").
argument-hint: [#parent-number children]
allowed-tools: Bash, Read, Grep, Glob, Task, TodoWrite, AskUserQuestion
---

# Batch Orchestrator

Takes every sub-issue of a parent through the runs. It is a loop around
`/refine` and `/finish`, not a third pipeline — it does not chain stages itself
and it does not merge. For a single issue, invoke the run directly; this skill
is only for batches.

## Config

- **Repo:** `luketmoss/hive`
- **Input:** $ARGUMENTS — parse the parent issue number

## Board

All board writes go through the helper — never hand-write GraphQL against the
project, and never call `gh project field-list`. IDs live in `.hive/board.json`.

```bash
node .hive/board.mjs children <parent>   # sub-issues with their board status
node .hive/board.mjs show <issue>
```

The runs move the cards. This skill does not.

## Process

1. **List the children** with `board.mjs children <parent>`. Skip anything
   CLOSED or in Done.

2. **Sort by pipeline proximity** — closest to Done first: Ready to Ship >
   Code Review > Testing > In Development > Refined > UX > PM Refining > To Do.
   Finishing what's nearly done first means a context blowout costs the least.
   Put them in a TodoWrite checklist.

3. **Refine everything that needs it.** For each child at or before UX, invoke
   `/refine`. Do not stop between issues — a halted `/refine` is one line in the
   summary, not a reason to end the batch.

4. **One design gate for the batch.** Present a table: issue, title, complexity,
   AC count, and any that halted with the reason. Then ask — approve all,
   approve a subset, or send some back. This is the same gate `/refine` stops
   at, asked once instead of N times.

5. **Deliver the approved ones.** For each, invoke `/finish`. It resumes from
   whatever column the issue is in and merges through `/ship`. An issue that
   halts stays where it stopped; note it and continue to the next.

6. **Report:** a table of merged / halted / skipped, with the reason for each
   halt and the PR or issue link. Close the parent only if every child merged;
   otherwise leave it open and say what's left.

## Context budget

Three or more issues through the full delivery run will exhaust the context
window — this is the failure mode the retros keep finding. Prefer one of:

- refine the whole batch in this session, then deliver them one per session
- or deliver at most two per session and hand the rest back with a list

Say which you chose in the report. Running out of context mid-`/finish` is worse
than stopping early on purpose, because it can strand an issue between a merge
and its board move.

## What this skill does not do

- It does not run stages inline. Every issue goes through `/refine` or `/finish`
- It does not merge. `/ship`, inside `/finish`, is the only thing that merges
- It never runs `gh pr review --approve` — GitHub rejects approving your own PR
- It does not create issues directly. Deferred work goes through `/idea`
