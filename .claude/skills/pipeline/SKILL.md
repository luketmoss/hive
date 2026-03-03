---
name: pipeline
description: Run the full development pipeline autonomously — from raw idea to merged PR. Spawns specialized agents (idea, PM, UX, dev, QA, review) as independent sub-agents that challenge each other's work. Pauses only for your final approval before merging.
argument-hint: [describe your idea]
allowed-tools: Bash, Read, Grep, Glob, Task, TodoWrite, AskUserQuestion
---

# Pipeline Orchestrator

You are a **thin coordinator** that routes work between specialized agents. You do NOT do the work yourself — you spawn independent sub-agents for each stage using the **Task tool**, passing them their skill instructions and context. Each agent brings a different perspective and may push back on previous agents' work.

**Do not ask the user for permission or confirmation between stages** — work autonomously until the approval gate. The ONLY exception: if agents cannot resolve a disagreement after 2 attempts, escalate to the user.

## Portability
<!-- To adapt for another repo, update OWNER, REPO, and PROJECT_NUMBER below -->

## Configuration

- **Owner:** `luketmoss`
- **Repo:** `luketmoss/hive`
- **Project number:** `2`

## Input

The user's idea: $ARGUMENTS

## How to Spawn Agents

For each stage, use the **Task tool** with `subagent_type: "general-purpose"`. Read the corresponding skill file and pass its full content as part of the prompt, along with the specific context (issue number, PR number, prior agent outputs, etc.).

```
Task:
  subagent_type: general-purpose
  prompt: |
    <contents of .claude/skills/<agent>/SKILL.md>

    Context from the pipeline:
    - Issue number: #N
    - Previous stage output: <summary>
    - Specific instructions: <what to do>

    When done, respond with a structured summary of what you did and the results.
```

Each agent runs independently with its own perspective. The Dev agent doesn't know what the QA agent will check. The QA agent genuinely tries to find problems in the Dev's work.

---

## Pipeline Stages

### Stage 1: Idea Agent

**Spawn:** Read `.claude/skills/idea/SKILL.md` and pass it to a Task sub-agent.

**Input to agent:** The user's raw idea from `$ARGUMENTS`.

**Note:** If the idea is vague, the Idea agent will need to ask clarifying questions. Since sub-agents can't ask the user directly, handle this: if the idea seems clear enough, pass it through. If it's genuinely too vague to classify (single word, no context), ask the user 1-2 clarifying questions BEFORE spawning the Idea agent. This is the only point before the approval gate where you may ask the user questions.

**Collect from agent:** Issue number, title, classification (bug/enhancement/feature/chore).

---

### Stage 2: PM Agent + UX Consultation

**Spawn two agents in parallel:**

1. **PM Agent:** Read `.claude/skills/pm/SKILL.md` and pass it to a Task sub-agent with the issue number.
2. **UX Agent:** Read `.claude/skills/ux/SKILL.md` and pass it to a Task sub-agent. Ask it to review the current app state and provide UX recommendations relevant to the issue (not a full audit — just focused input on the area being changed).

**After both return:** Review the PM's acceptance criteria alongside the UX agent's recommendations. If the UX agent identified concerns not reflected in the ACs, spawn the PM agent again with the UX findings and ask it to incorporate them. The PM should push back if a UX recommendation is out of scope — that tension is valuable.

**Collect from agents:** Refined issue with acceptance criteria, scope, technical notes.

---

### Stage 3: Dev Agent

**Spawn:** Read `.claude/skills/dev/SKILL.md` and pass it to a Task sub-agent with the issue number.

**Input to agent:** The issue number and a note to read the acceptance criteria from the issue body (the PM already updated it).

**Collect from agent:** Branch name, PR number, list of files changed, list of tests added, build/test results.

---

### Stage 4: QA Agent

**Spawn:** Read `.claude/skills/qa/SKILL.md` and pass it to a Task sub-agent with the issue number.

**Input to agent:** The issue number. The QA agent will independently read the acceptance criteria from the issue and the code from the PR. It does NOT receive the Dev agent's summary — it forms its own assessment.

**Collect from agent:** QA verdict (PASS/FAIL), AC verification results, edge case findings.

### Conflict Resolution: QA Fails

If the QA agent returns FAIL:

1. **Attempt 1:** Spawn the Dev agent again with the QA report. Tell it to fix the issues identified by QA, update the PR, and re-run tests. Then spawn QA again to re-verify.

2. **Attempt 2:** If QA fails again, spawn the Dev agent one more time with both QA reports.

3. **Escalate:** If QA fails a third time, stop and present the situation to the user:
   > "The Dev and QA agents couldn't resolve these issues after 2 attempts. Here's what QA is finding: [summary]. Here's what Dev tried: [summary]. How would you like to proceed?"

---

### Stage 5: Code Review Agent

**Spawn:** Read `.claude/skills/review/SKILL.md` and pass it to a Task sub-agent with the issue/PR number.

**Input to agent:** The issue number or PR number. Like QA, the Review agent independently reads the diff and forms its own assessment. It does NOT receive the Dev or QA summaries — it reviews the code fresh.

**Collect from agent:** Review verdict (APPROVE/CHANGES REQUESTED), findings.

### Conflict Resolution: Review Requests Changes

If the Review agent requests changes:

1. **Attempt 1:** Spawn the Dev agent with the review feedback. It fixes the issues, updates the PR. Spawn the Review agent again.

2. **Attempt 2:** Same cycle one more time.

3. **Escalate:** If the Review agent still requests changes after 2 Dev fix attempts, escalate to the user with both sides.

---

## APPROVAL GATE — Stop Here and Wait

**This is the only point where you pause for user input** (unless escalating a conflict).

Compile results from all agents into a comprehensive summary:

```
## Pipeline Summary for Issue #N

### Idea
- **Title:** ...
- **Type:** bug / enhancement / feature / chore
- **Original idea:** (what the user asked for)

### Requirements (PM Agent)
- **Acceptance Criteria:**
  - AC1: ...
  - AC2: ...
- **UX Input:** (what the UX agent recommended, what was incorporated)
- **Scope:** in: ... / out: ...

### Implementation (Dev Agent)
- **Branch:** ...
- **Files changed:** (list)
- **Tests added:** (list)

### QA Results (QA Agent)
- **Verdict:** PASS
- **AC Verification:** (pass/fail each)
- **Edge cases tested:** (summary)
- **Attempts:** (1 if clean, or note if fixes were needed)

### Code Review (Review Agent)
- **Verdict:** APPROVE
- **Highlights:** (what the reviewer noted)
- **Attempts:** (1 if clean, or note if changes were needed)

### Links
- **Issue:** #N (link)
- **PR:** #X (link)
- **Full diff:** `gh pr diff X --repo luketmoss/hive`
```

Then ask the user:

> **Ready to merge?** Review the PR diff at the link above. Reply **approve** to merge, or describe what changes you'd like.

**Wait for the user's response before proceeding.**

---

## Post-Approval: Merge

**Only execute after the user approves.**

1. Approve the PR:
   ```bash
   gh pr review <pr-number> --repo luketmoss/hive --approve --body "Pipeline review complete. All agents passed."
   ```
2. Merge (this will prompt for confirmation since `gh pr merge` is not pre-approved):
   ```bash
   gh pr merge <pr-number> --repo luketmoss/hive --squash --delete-branch
   ```
3. Move issue to **"Done"** using the board movement helper:
   ```bash
   PROJECT_ID=$(gh project list --owner luketmoss --format json | jq -r '.projects[] | select(.number == 2) | .id')
   FIELD_ID=$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .id')
   ITEM_ID=$(gh project item-list 2 --owner luketmoss --format json | jq -r '.items[] | select(.content.number == <ISSUE_NUMBER>) | .id')
   OPTION_ID=$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "Done") | .id')
   gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" --field-id "$FIELD_ID" --single-select-option-id "$OPTION_ID"
   ```

---

## If the User Requests Changes

If the user replies with change requests instead of approving:

1. Spawn the Dev agent with the user's feedback to make the changes.
2. Spawn QA again to re-verify.
3. Spawn Review again for a fresh look.
4. Return to the approval gate with an updated summary.

---

## Definition of Done

- [ ] Idea agent created and classified the issue
- [ ] PM agent wrote acceptance criteria with UX input
- [ ] Dev agent implemented with tests matching every AC
- [ ] QA agent independently verified and passed
- [ ] Review agent independently reviewed and approved
- [ ] User approved the final result
- [ ] PR merged, branch deleted, issue in "Done"
