---
name: finish
description: Run a refined Hive issue through the full delivery chain — development, QA, code review, merge. Use when the user says to finish, build out, ship, deliver, or complete an issue.
argument-hint: [issue-number]
---

# /finish

The delivery run. Takes an issue from Refined to Done **without stopping**.

## Precondition

The issue must be in **Refined**. If it is in To Do, PM Refining or UX, it
hasn't been through the design gate — stop and say so. Running the refinement
chain and the delivery chain back to back skips the only review of the spec,
which is the point of having two runs.

If the issue is already partway down the chain, start from where it actually is
rather than from the top:

| Current column | Resume at |
|---|---|
| Refined | `/dev` |
| In Development | `/dev` |
| Testing | `/qa` |
| Code Review | `/review` |
| Ready to Ship | `/ship` |

```bash
node .hive/board.mjs show <issue>
```

## Sequence

1. **`/dev`** — branch, tests, code, draft PR
2. **`/qa`** — verify against the acceptance criteria, take the PR out of draft
3. **`/review`** — review the diff, confirm CI
4. **`/ship`** — Results, merge, delete the branch, clean up the local branch

Each step is the real skill. Read and follow `.claude/skills/<step>/SKILL.md` at
each stage rather than approximating it.

Run the steps back to back in one pass. A stage returning is not a checkpoint —
do not ask the user whether to proceed between stages, and do not stop to report
progress. The only things that end this run early are the halt conditions below.

**Step 4 is `/ship` itself, not a merge written out again here.** `/review`
leaves the issue in Ready to Ship, which is the state `/ship` already requires,
so it runs against exactly what it expects — with its refusal conditions and its
Results section intact. The only irreversible operation in the system is written
down once.

## The AC_PROBLEM loop

`/qa` has a third verdict beyond PASS and FAIL. **AC_PROBLEM** means the
implementation is fine and the *criterion* is wrong — it asks for something that
contradicts the app, the data model, or a decision made since refinement.

On AC_PROBLEM the issue stays in Testing. Re-read `.claude/skills/pm/SKILL.md`
and renegotiate that one criterion: amend it in the issue body, say in a comment
what changed and why, then `/dev` and `/qa` again. It counts as one of the two
attempts.

If the renegotiation would need the user's judgment rather than yours — a real
product question, not a wording fix — that is a halt. Say what the criterion
got wrong and what you would replace it with, and stop.

## Halting

The run stops early if:

- the issue is underspecified in a way that matters — `/dev` stops with the
  branch in place and says what's missing, rather than inventing the answer
- a criterion fails and the fix isn't clear, or fixing it would exceed the Out
  of Scope section
- `/qa` cannot verify a criterion here at all — name it, don't pass it silently
- an AC_PROBLEM needs a product decision rather than a rewording
- `/review` finds something blocking — the issue returns to In Development
- `/ship` refuses: a draft PR, checks failing, pending or absent, or a conflict.
  The issue **stays in Ready to Ship**, which is what that column means — not a
  queue to rubber-stamp, but the ones that could not finish on their own

Two attempts at a failing stage. After the second, stop, comment on the issue
saying where it stuck, and hand back.

**A halted run is a success.** Report where it stopped and why, and that nothing
merged. Do not work around a gate.

## Deferred items

Anything worth doing that is out of scope becomes its own issue via `/idea` —
never a raw `gh issue create`. Comment on the original:
`Deferred to #<new>: <description>`.

## Report

When the run merges:

- issue and PR with URLs, and the commit on `main`
- what changed, in a few lines
- which acceptance criteria were verified and how
- anything `/review` noted that didn't block
- any deferred issues created
- any judgment call that could reasonably have gone the other way

When it stopped instead, say where, why, and that nothing merged.
