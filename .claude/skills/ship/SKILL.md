---
name: ship
description: Merge a reviewed Hive PR, closing its issue and deploying to GitHub Pages. Use when the user explicitly asks to ship, merge, approve, or land an issue.
argument-hint: [issue-number]
---

# /ship

Merges. **The only irreversible action in the system.**

## Two ways in

`/finish` runs this as its fourth step, so the delivery run merges rather than
parking. Standalone is for the issues that *didn't* — the ones sitting in Ready
to Ship because a check was red, a PR had a conflict, or a review found
something — once whatever stopped them is fixed. "Approve #42" means this skill.

Merging to `main` triggers the GitHub Pages deploy, so merged is live and there
is nobody between here and production. The refusals below stand in for the
person who would otherwise be. None is a judgment call: each is a fact about the
PR, and each leaves the issue in Ready to Ship for a human rather than
proceeding.

## Preconditions

```bash
node .hive/board.mjs show <issue>
gh pr view <pr> --repo luketmoss/hive --json number,isDraft,mergeable,statusCheckRollup,headRefName
```

Refuse, and say why, if:

- the issue is not in **Ready to Ship** — it hasn't been reviewed
- the PR is still a draft
- checks are failing, pending, or absent — a check that never ran is not a check
  that passed
- the PR has conflicts

Don't work around any of these. Report and stop, leaving the issue in Ready to
Ship: inside `/finish` that is the run parking rather than merging, and the
column exists to be looked at.

`mergeable` often comes back `UNKNOWN` right after checks finish — GitHub
computes it asynchronously. That is not a conflict; wait a few seconds and
re-query rather than refusing on it.

Note that the Pages workflow only fires on changes under `frontend/**`. A PR
that touches nothing there will merge without a deploy, which is correct — say
so rather than waiting for a run that will never start.

## Write the Results first

Before merging, add a `## Results` section to the issue body — what actually
happened, what surprised you, what you'd do differently. Draw on the whole run:
what `/pm` assumed, what `/qa` found, what `/review` flagged, anything deferred.

This has to happen before the merge, because the merge closes the issue.

It is the highest-value habit in the pipeline and the easiest to skip. Months
from now the Results section is the only part of the issue anyone reads. Write
something worth reading — "done" is not that.

## Merge

Do **not** run `gh pr review --approve`. GitHub rejects approving your own PR,
and this is a single-author repo. `/review` already recorded its verdict as a
comment; the merge is the approval.

```bash
gh issue edit <issue> --repo luketmoss/hive --body-file <path>
gh pr merge <pr> --repo luketmoss/hive --squash --delete-branch
git checkout main && git pull origin main && git branch -D <headRefName>
```

Squash — one issue, one commit on `main`. `--delete-branch` only deletes the
remote, which is why the local branch is deleted by hand; skipping it is how a
repo ends up with sixty stale branches.

## Apps Script does not deploy itself

If the PR changed anything under `apps-script/`, merging did **not** ship it.
Say so explicitly in the report: `clasp push --force` and a new version cut in
the Apps Script editor UI are both still needed, and the second one is the
user's to click.

## Closing the issue

`Closes #<issue>` in the PR body closes the issue, and the board's
*Item closed → Done* workflow moves the card. Those are two separate mechanisms.
If the card doesn't move:

```bash
gh issue view <issue> --repo luketmoss/hive --json state
```

**Still open** — the PR body was missing `Closes #<issue>`. Close it by hand,
set the card, and say so: that one is `/dev` not doing its job.

**Closed, card didn't move** — the board workflow is off. Ask the user to enable
*Item closed → Done* at
`https://github.com/users/luketmoss/projects/2/workflows`; it is theirs to click
and it fixes every future merge at once.

`node .hive/board.mjs set <issue> --status Done` rescues a stranded card. It is
not the remedy and it isn't the first move — reach for it only after the check
above, so using it always means you looked.

## Report

What merged, the commit on `main`, and that Pages is deploying (or that it
isn't, and why). Note anything `/review` raised that didn't block, and anything
still needed by hand for Apps Script.
