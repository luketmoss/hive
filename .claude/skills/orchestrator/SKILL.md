---
name: orchestrator
description: Coordinate specialized agents through the development pipeline. Can start from a new idea or resume any issue from its current board position. Spawns independent sub-agents (idea, PM, UX, dev, QA, review) that challenge each other. Posts disagreements to the issue so stuck items are visible on the board.
argument-hint: [new idea OR #issue-number to resume]
allowed-tools: Bash, Read, Grep, Glob, Task, TodoWrite, AskUserQuestion
---

# Orchestrator

You are a **thin coordinator** that routes work between specialized agents. You do NOT do the work yourself — you spawn independent sub-agents for each stage using the **Task tool**, passing them their skill instructions and context. Each agent brings a different perspective and may push back on previous agents' work.

## Core Principles

1. **The board is the source of truth.** The issue's board column tells you where it is in the pipeline. Issue comments contain the full history of agent work and disagreements.
2. **Agents are independent.** Each agent reads the issue and codebase fresh. The QA agent does NOT receive the Dev agent's summary — it forms its own assessment.
3. **Work autonomously.** Do not ask the user for permission between stages. The only pauses are: clarifying a vague idea, escalating stuck conflicts, and the final approval gate.
4. **Conflicts are documented on the issue.** When agents disagree and can't resolve it, the issue stays in its column (visible on the board) and a detailed comment explains why.

## Portability
<!-- To adapt for another repo, update OWNER, REPO, and PROJECT_NUMBER below -->

## Configuration

- **Owner:** `luketmoss`
- **Repo:** `luketmoss/hive`
- **Project number:** `2`

## Input

$ARGUMENTS — this can be:

1. **A new idea** (freeform text) — start from Stage 1 (Idea)
2. **An issue number** (e.g., `#4` or `4`) — read the board and resume from the current stage

### Resuming from Board State

If given an issue number, determine where it is:

```bash
gh project item-list 2 --owner luketmoss --format json | jq -r '.items[] | select(.content.number == <NUMBER>) | .status'
```

Then resume from the corresponding stage:

| Board Column | Resume From |
|---|---|
| **To Do** | Stage 2 (PM Refinement) |
| **Refining** | Stage 2 (PM — continue or restart) |
| **Ready** | Stage 3 (Dev) |
| **In Development** | Stage 3 (Dev — check if PR exists, continue or restart) |
| **Testing** | Stage 4 (QA) |
| **In Review** | Stage 5 (Code Review) |
| **Done** | Nothing to do — inform the user |

Before resuming, read the issue body and recent comments (`gh issue view <number> --comments`) to understand the current state. If there are conflict/escalation comments from a previous run, read them to understand what was tried and what the user may have changed.

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

## Board Movement Helper

```bash
PROJECT_ID=$(gh project list --owner luketmoss --format json | jq -r '.projects[] | select(.number == 2) | .id')
FIELD_ID=$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .id')
ITEM_ID=$(gh project item-list 2 --owner luketmoss --format json | jq -r '.items[] | select(.content.number == <ISSUE_NUMBER>) | .id')
OPTION_ID=$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "<COLUMN_NAME>") | .id')
gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" --field-id "$FIELD_ID" --single-select-option-id "$OPTION_ID"
```

---

## Stage 1: Idea Agent

**When:** Starting from a new idea (not an issue number).

**Spawn:** Read `.claude/skills/idea/SKILL.md` and pass it to a Task sub-agent with the user's idea.

**Note:** If the idea is genuinely too vague to classify (single word, no context), ask the user 1-2 clarifying questions BEFORE spawning the agent.

**Collect:** Issue number, title, classification.

---

## Stage 2: PM Agent + UX Consultation

**When:** Issue is in **To Do** or **Refining**.

**Spawn two agents in parallel:**

1. **PM Agent:** Read `.claude/skills/pm/SKILL.md`, pass with the issue number.
2. **UX Agent:** Read `.claude/skills/ux/SKILL.md`, pass with the issue number. Ask for focused UX input on the area being changed (not a full audit).

**After both return:** If the UX agent identified concerns not reflected in the PM's acceptance criteria, spawn the PM agent again with the UX findings. The PM may push back if a UX recommendation is out of scope — that tension is valuable.

**Board state after:** Issue in **Ready**.

---

## Stage 3: Dev Agent

**When:** Issue is in **Ready** or **In Development**.

**Spawn:** Read `.claude/skills/dev/SKILL.md`, pass with the issue number.

If resuming from **In Development**, check if a branch/PR already exists and tell the Dev agent to continue from where it left off.

**Collect:** Branch name, PR number, files changed, tests added, build/test results.

**Board state after:** Issue in **Testing**.

---

## Stage 4: QA Agent

**When:** Issue is in **Testing**.

**Spawn:** Read `.claude/skills/qa/SKILL.md`, pass with the issue number.

The QA agent independently reads the acceptance criteria and PR code. It does NOT receive the Dev agent's summary.

**Collect:** QA verdict (PASS/FAIL), AC verification, edge case findings.

**Board state after:** Issue in **In Review** (if PASS).

---

## Stage 5: Code Review Agent

**When:** Issue is in **In Review**.

**Spawn:** Read `.claude/skills/review/SKILL.md`, pass with the issue/PR number. **Tell the Review agent NOT to merge** — only post its review verdict. Merging happens after user approval.

The Review agent independently reads the diff. It does NOT receive Dev or QA summaries.

**Collect:** Review verdict (APPROVE/CHANGES REQUESTED), findings.

**Board state after:** Stays in **In Review** until user approves.

---

## Conflict Resolution

When agents disagree, manage up to **2 resolution attempts**. If unresolved, the issue stays in its current column (visible on the board) with a detailed comment explaining the disagreement.

### Pattern (applies to both QA and Review conflicts)

**Attempt 1:** Move issue to **In Development**. Spawn Dev with the failure report. Dev fixes, updates PR, re-runs tests. Move issue back. Spawn the failing agent again.

**Attempt 2:** If it fails again, repeat the cycle one more time.

**Escalate (after 2 failed attempts):**

1. Leave the issue in its current column — it's now visibly stuck on the board.
2. Post a detailed comment on the issue:
   ```bash
   gh issue comment <number> --repo luketmoss/hive --body "$(cat <<'EOF'
   ## 🔴 Orchestrator: Stuck — <Agent A> vs <Agent B>

   This issue could not be resolved automatically after 2 attempts.

   ### What <Failing Agent> Found
   <latest findings from the failing agent>

   ### What Dev Tried
   <summary of Dev's fix attempts>

   ### Resolution Needed
   - Review the findings and the current PR
   - Make manual changes, update the acceptance criteria, or override
   - Run `/orchestrator #<number>` to resume from the current board position
   EOF
   )"
   ```
3. Notify the user in the session:
   > Issue #N is stuck in **<Column>**. The details are posted on the issue. When you've addressed it, run `/orchestrator #N` to resume.

---

## APPROVAL GATE — Stop Here and Wait

**This is the only point where you pause for user input** (unless escalating a conflict).

Compile results from all agents into a summary:

```
## Orchestrator Summary for Issue #N

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
- **Resolution rounds:** (1 if clean, or note if fixes were needed)

### Code Review (Review Agent)
- **Verdict:** APPROVE
- **Highlights:** (what the reviewer noted)
- **Resolution rounds:** (1 if clean, or note if changes were needed)

### Links
- **Issue:** #N
- **PR:** #X
- **Full diff:** `gh pr diff X --repo luketmoss/hive`
```

Then ask:

> **Ready to merge?** Review the PR diff at the link above. Reply **approve** to merge, or describe what changes you'd like.

---

## Post-Approval: Merge

**Only execute after the user approves.**

1. Approve the PR:
   ```bash
   gh pr review <pr-number> --repo luketmoss/hive --approve --body "Orchestrator: all agents passed, user approved."
   ```
2. Merge (will prompt for confirmation since `gh pr merge` is not pre-approved):
   ```bash
   gh pr merge <pr-number> --repo luketmoss/hive --squash --delete-branch
   ```
3. Move issue to **"Done"**.

---

## If the User Requests Changes at the Gate

1. Post the user's feedback as a comment on the issue.
2. Move issue to **In Development**.
3. Spawn Dev with the user's feedback.
4. Re-run QA and Review stages.
5. Return to the approval gate with an updated summary.

---

## Definition of Done

- [ ] Issue exists and is classified on the board
- [ ] PM agent wrote acceptance criteria with UX input
- [ ] Dev agent implemented with tests matching every AC
- [ ] QA agent independently verified and passed
- [ ] Review agent independently reviewed and approved
- [ ] User approved the final result
- [ ] PR merged, branch deleted, issue in "Done"
