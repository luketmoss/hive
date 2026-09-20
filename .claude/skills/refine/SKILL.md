---
name: refine
description: Run a Hive issue through the full refinement chain — PM Refining, UX, stopping at Refined. Use when the user says to get an issue refined, ready for dev, spec'd out, or groomed, or asks for a new idea to be created and refined in one go.
argument-hint: [issue-number or a description of the idea]
---

# /refine

The refinement run. Takes an issue from To Do to Refined **without stopping**,
then hands to the user at the design gate.

## Sequence

1. **`/idea`** — only if the issue doesn't exist yet. "New idea for X, get it
   ready for dev" starts here; "refine #42" does not.
2. **`/pm`** — always.
3. **`/ux`** — unless the issue has no user-facing surface (a refactor, an Apps
   Script change, rules-sync work, build tooling). `/pm` owns that call and
   states it.
4. **`/pm` again** — only if `/ux` returned Must Fix items, to fold them into the
   ACs as accept / defer / reject.
5. Stop. The issue is in **Refined**.

Each step is the real skill. Read and follow `.claude/skills/<step>/SKILL.md` at
each stage rather than approximating what it would have done.

Run the steps back to back in one pass. A stage returning is not a checkpoint —
do not ask the user whether to continue between stages, and do not report
progress and wait. The only things that end this run early are the halt
conditions below.

## Board

`/pm` moves the issue to PM Refining on entry and to Refined on exit; `/ux`
moves it through UX. This run does not move cards itself.

```bash
node .hive/board.mjs show <issue>
```

## Halting

The run stops early, without advancing, if:

- `/pm` hits a product question that genuinely needs the user's judgment — the
  issue stays in PM Refining with `## Open Questions` filled in
- the issue is large enough to want splitting — it stays in PM Refining with the
  proposed split written down
- the issue turns out not to describe a real problem, or is already fixed — say
  so and propose closing it
- an AC would contradict a UX Design Decision or an invariant in CLAUDE.md —
  those are non-negotiable, so the issue stays put and the conflict gets named

**A halted run is a success.** Report where it stopped and why. Do not work
around the blocker, and do not guess at an answer to a question you raised.

## Report

Give the user what they need to work the design gate:

- issue number, title, URL
- **the acceptance criteria in full** — this is what they're approving
- complexity, whether rules sync is needed, and the UX verdict if `/ux` ran
- anything you decided that could reasonably have gone the other way

That last point matters. The user is reviewing your judgment, not just your
output, and decisions buried silently in a spec are the ones that produce the
wrong thing three stages later.

Do not advance past Refined. The user runs `/finish` when they agree.
