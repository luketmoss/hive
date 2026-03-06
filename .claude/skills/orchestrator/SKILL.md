---
name: orchestrator
description: Batch-process all children of a parent issue through the development pipeline. Use when the user wants to process multiple sub-issues at once (e.g., "#3 children" or "process all children of #3").
argument-hint: [#parent-number children]
allowed-tools: Bash, Read, Grep, Glob, Task, TodoWrite, AskUserQuestion
---

# Batch Orchestrator

You are a **batch coordinator** that processes all sub-issues of a parent issue through the development pipeline. For single-issue orchestration, the main Claude instance handles that via CLAUDE.md pipeline rules — this skill is only for batch operations.

## Configuration

- **Owner:** `luketmoss`
- **Repo:** `luketmoss/hive`
- **Project number:** `2`

## Input

$ARGUMENTS — must match a pattern like `#3 children`, `children of #3`, or `#3 all`.

Parse the parent issue number from the input.

## Board Movement Helper

Use this single command to move an issue to a board column. Replace `<ISSUE_NUMBER>` and `<COLUMN_NAME>`. The command starts with `gh project` so it matches the pre-approved permission pattern — do NOT rewrite it as separate variable assignments.

```bash
gh project item-edit \
  --id "$(gh project item-list 2 --owner luketmoss --format json | jq -r '.items[] | select(.content.number == <ISSUE_NUMBER>) | .id')" \
  --project-id "$(gh project list --owner luketmoss --format json | jq -r '.projects[] | select(.number == 2) | .id')" \
  --field-id "$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .id')" \
  --single-select-option-id "$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "<COLUMN_NAME>") | .id')"
```

## How to Spawn Agents

For each stage, use the **Task tool** with `subagent_type: "general-purpose"`. Read the corresponding skill file and pass its full content as part of the prompt, along with the specific context.

```
Task:
  subagent_type: general-purpose
  prompt: |
    <contents of .claude/skills/<agent>/SKILL.md>

    Context from the orchestrator:
    - Issue number: #N
    - Specific instructions: <what to do>

    When done, respond with a structured summary of what you did and the results.
```

---

## Step 1: Fetch sub-issues

```bash
gh api graphql -f query='query {
  repository(owner: "luketmoss", name: "hive") {
    issue(number: <PARENT_NUMBER>) {
      title
      subIssues(first: 50) {
        nodes {
          number
          title
          state
        }
      }
    }
  }
}'
```

## Step 2: Get board state for each child

For each sub-issue, look up its board column:

```bash
gh project item-list 2 --owner luketmoss --format json | jq -r '.items[] | select(.content.number == <CHILD_NUMBER>) | .status'
```

## Step 3: Sort and filter

1. **Skip** children in **Done** or with state `CLOSED`.
2. **Sort** remaining children by pipeline order so the closest-to-done items finish first:
   - In Review > Testing > In Development > Ready > Refining > To Do
3. Use **TodoWrite** to create a checklist of all children with their current board state so progress is visible.

## Step 4: Process each child sequentially

For each child (in sorted order):
1. Update the TodoWrite to mark the current child as `in_progress`.
2. Run the child through the pipeline from its current board state:
   - **To Do / Refining**: Spawn PM agent, then UX agent for review, then PM again if UX had feedback.
   - **Ready / In Development**: Spawn Dev agent.
   - **Testing**: Spawn QA agent. If FAIL, spawn Dev with the report, then QA again. If it fails a second time, mark as stuck and move on.
   - **In Review**: Spawn Review agent (tell it NOT to merge). If CHANGES REQUESTED, spawn Dev with the feedback, then Review again. If it fails a second time, mark as stuck and move on.
3. **If the child gets stuck** (conflict after 2 attempts), note it and move on to the next child.
4. **If the child completes review**, collect its summary and continue to the next child.

## Step 5: Batch Approval Gate

After all children have been processed (or stuck), present a **batch summary**:

```
## Batch Summary — Children of #<PARENT>

### Parent: <parent title>

### Completed (ready to merge)
| Issue | Title | PR | QA | Review |
|---|---|---|---|---|
| #5 | <title> | #20 | PASS | APPROVE |
| #6 | <title> | #21 | PASS | APPROVE |

### Stuck (needs attention)
| Issue | Title | Column | Reason |
|---|---|---|---|
| #7 | <title> | Testing | QA failed after 2 attempts |

### Skipped (already done)
| Issue | Title |
|---|---|
| #8 | <title> |

### Links
- **Parent issue:** #<PARENT>
- **PRs to review:** #20, #21
```

Then ask:

> **Ready to merge?** Review the PR diffs above. Reply:
> - **approve all** — merge all completed PRs
> - **approve #5, #6** — merge specific PRs
> - **changes #5: <feedback>** — request changes on a specific issue

## Step 6: Batch Merge

For each approved PR, merge one at a time:

```bash
gh pr review <pr-number> --repo luketmoss/hive --approve --body "Batch orchestrator: all agents passed, user approved."
gh pr merge <pr-number> --repo luketmoss/hive --squash --delete-branch
git checkout main && git pull origin main
```

Pull main between each merge to avoid conflicts.

## Step 7: Close the Parent

After all children are merged (no stuck items remaining), move the **parent issue** to **Done** and close it:

```bash
gh issue close <PARENT_NUMBER> --repo luketmoss/hive --comment "All child issues completed and merged."
```

Then move the parent to **Done** using the Board Movement Helper.

If some children are still stuck, do NOT close the parent. Instead note which children remain and leave the parent in its current column.

---

## Definition of Done

- [ ] All non-stuck children have passed QA and code review
- [ ] User approved the batch
- [ ] Approved PRs merged, branches deleted, issues in "Done"
- [ ] Parent closed (if all children complete) or status reported (if some stuck)
