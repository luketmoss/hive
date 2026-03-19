---
name: orchestrator
model: sonnet
description: Batch-process all children of a parent issue through the development pipeline. Use when the user wants to process multiple sub-issues at once (e.g., "#3 children" or "process all children of #3").
argument-hint: [#parent-number children]
allowed-tools: Bash, Read, Grep, Glob, Task, TodoWrite, AskUserQuestion
---

# Batch Orchestrator

Batch coordinator that processes all sub-issues of a parent through the pipeline. For single-issue orchestration, the main Claude instance handles that via CLAUDE.md — this skill is only for batch operations.

## Config

- **Repo:** `luketmoss/hive`
- **Input:** $ARGUMENTS — parse parent issue number

## Board Movement

Never call `gh project list` or `gh project field-list` — IDs are hardcoded.

```bash
# Get item ID
gh project item-list 2 --owner luketmoss --limit 100 --format json --jq '.items[] | select(.content.number == <ISSUE_NUMBER>) | .id'
# Move column
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "PVT_kwHOAJR9ys4BQe_8" itemId: "ITEM_ID" fieldId: "PVTSSF_lAHOAJR9ys4BQe_8zg-lvnE" value: { singleSelectOptionId: "OPTION_ID" } }) { projectV2Item { id } } }'
```

| Column | Option ID |
|--------|-----------|
| To Do | `2ed3c08e` |
| In Development | `cedf160f` |
| Testing | `1bd1ca27` |
| Code Review | `2e7d4fd2` |
| Done | `2aaa3a20` |
| Refined | `9e0d0478` |
| Pick Up | `b9d77a66` |

## How to Spawn Agents

Use **Task tool** with `subagent_type: "general-purpose"`. Read the corresponding skill file and pass its full content as the prompt, plus specific context (issue number, instructions).

## Process

1. **Fetch sub-issues:**
```bash
gh api graphql -f query='query { repository(owner: "luketmoss", name: "hive") { issue(number: <N>) { title subIssues(first: 50) { nodes { number title state } } } } }'
```

2. **Get board state** for each child: `gh project item-list 2 --owner luketmoss --limit 100 --format json --jq '.items[] | select(.content.number == <N>) | .status'`

3. **Sort:** Skip Done/CLOSED. Sort by pipeline proximity: In Review > Testing > In Development > Ready > Refining > To Do. Create TodoWrite checklist.

4. **Process each child sequentially** from its current board state:
   - **To Do / Refining**: PM → UX → PM (negotiate) → mark refined
   - **Ready / In Development**: Dev agent
   - **Testing**: QA. If FAIL → Dev + QA retry. 2nd fail → mark stuck, move on
   - **In Review**: Review (no merge). If CHANGES REQUESTED → Dev + Review retry. 2nd fail → mark stuck, move on

5. **Batch approval gate** — present summary table of completed/stuck/skipped. Ask user: approve all, approve specific, or request changes.

6. **Batch merge** (for each approved):
```bash
gh pr review <pr> --repo luketmoss/hive --approve --body "Batch: all agents passed, user approved."
gh pr merge <pr> --repo luketmoss/hive --squash --delete-branch
git checkout main && git pull origin main
```

7. **Close parent** if all children merged. If some stuck, leave parent open and report.
