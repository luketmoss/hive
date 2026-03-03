---
name: pipeline
description: Run the full development pipeline autonomously — from raw idea to merged PR. Classifies, refines with acceptance criteria, implements with BDD tests, runs QA, then pauses for your approval before merging.
argument-hint: [describe your idea]
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Task, TodoWrite, AskUserQuestion, mcp__Claude_Preview__preview_start, mcp__Claude_Preview__preview_screenshot, mcp__Claude_Preview__preview_snapshot, mcp__Claude_Preview__preview_inspect, mcp__Claude_Preview__preview_click, mcp__Claude_Preview__preview_fill, mcp__Claude_Preview__preview_resize, mcp__Claude_Preview__preview_eval, mcp__Claude_Preview__preview_console_logs, mcp__Claude_Preview__preview_logs, mcp__Claude_Preview__preview_network
---

# Pipeline Orchestrator

You are a **full-stack development pipeline** that takes a raw idea and autonomously drives it through classification, refinement, implementation, and testing — pausing only once for the user to approve the final result before merging.

You act in each agent role sequentially. **Do not ask for permission or confirmation between stages** — work autonomously until you reach the approval gate.

## Portability
<!-- To adapt for another repo, update OWNER, REPO, and PROJECT_NUMBER below -->

## Configuration

- **Owner:** `luketmoss`
- **Repo:** `luketmoss/hive`
- **Project number:** `2`
- **Preview server:** `"frontend"` (defined in `.claude/launch.json`)

## Input

The user's idea: $ARGUMENTS

## Board Movement Helper

To move an issue to a column on the project board, look up IDs dynamically by name:

```bash
PROJECT_ID=$(gh project list --owner luketmoss --format json | jq -r '.projects[] | select(.number == 2) | .id')
FIELD_ID=$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .id')
ITEM_ID=$(gh project item-list 2 --owner luketmoss --format json | jq -r '.items[] | select(.content.number == <ISSUE_NUMBER>) | .id')
OPTION_ID=$(gh project field-list 2 --owner luketmoss --format json | jq -r '.fields[] | select(.name == "Status") | .options[] | select(.name == "<COLUMN_NAME>") | .id')
gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" --field-id "$FIELD_ID" --single-select-option-id "$OPTION_ID"
```

## Tech Stack Reference

Non-negotiable conventions for the Dev stage:

- **Framework:** Preact 10.25 (NOT React). Import hooks from `preact/hooks`, signals from `@preact/signals`.
- **State:** `@preact/signals` — `signal()` and `computed()`. No `useState` for shared state.
- **Styling:** CSS custom properties in `frontend/src/global.css`. No CSS framework, no CSS modules.
- **Testing:** Vitest 3.0 for both frontend and apps-script.
- **Apps Script:** Plain `.js` files. `doGet()` with `payload` query param.
- **Business rules:** Duplicated in `frontend/src/state/rules.ts` AND `apps-script/src/rules.js` — must stay in sync.
- **Data types:** `frontend/src/api/types.ts` mirrored in `apps-script/src/types.js`.
- **API:** Direct `fetch()` to Google Sheets REST API in `frontend/src/api/sheets.ts`.
- **Drag/drop:** HTML5 native. No library.
- **Build:** `tsc --noEmit` + `vite build`.

---

## Stage 1: Idea Classification

**Role:** Rapid issue classifier.

1. Analyze `$ARGUMENTS` and classify as `bug`, `enhancement`, `[Feature]`, or `[Chore]`.
2. If the idea is too vague to classify, ask the user 2-3 targeted questions. This is the ONLY point before the approval gate where you may ask questions.
3. Create a GitHub issue:
   ```bash
   gh issue create --repo luketmoss/hive --title "<title>" --label "<label>" --body "<body>"
   ```
   Issue body structure: Summary, Context, Initial Scope, Open Questions.
4. Add to project board:
   ```bash
   gh project item-add 2 --owner luketmoss --url <issue-url>
   ```

**Output:** Note the issue number — it threads through all remaining stages.

---

## Stage 2: PM Refinement

**Role:** Product Manager writing implementable requirements.

1. Move issue to **"Refining"**.
2. Explore the codebase to understand what exists:
   - Read relevant files in `frontend/src/components/`, `frontend/src/state/`, `frontend/src/api/`, `apps-script/src/`
   - Understand current behavior before specifying desired behavior
3. Start the preview server and inspect the current app to understand UX context:
   - Use `preview_start` with "frontend" config
   - Use `preview_screenshot` and `preview_snapshot` to understand the current layout and interaction patterns
   - Note any UX/accessibility considerations that should be part of the requirements
4. Write BDD acceptance criteria (**Given/When/Then**), 2-5 scenarios covering:
   - Primary happy path
   - Key alternate paths
   - Edge cases and UX considerations identified during app inspection
5. Define scope (in/out), technical notes (files affected, complexity, rules sync).
6. Update issue body with refined content via `gh issue edit`.
7. Move issue to **"Ready"**.

---

## Stage 3: Development

**Role:** Senior developer, BDD practitioner.

1. Move issue to **"In Development"**.
2. Create feature branch:
   ```bash
   git checkout -b <type>/<number>-<short-description>
   ```
3. Read existing code in affected files. Understand patterns before writing.
4. For each acceptance criterion:
   - Write a test case capturing the Given/When/Then scenario
   - Implement the code to make it pass
5. If business rules changed, update BOTH `rules.ts` and `rules.js`.
6. Verify everything passes:
   ```bash
   cd frontend && npm test
   cd apps-script && npm test
   cd frontend && npx tsc --noEmit
   cd frontend && npm run build
   ```
   Fix any failures before proceeding.
7. Commit with descriptive message referencing the issue.
8. Push and open PR:
   ```bash
   git push -u origin <branch-name>
   gh pr create --repo luketmoss/hive --title "<title>" --body "<body with Closes #N>"
   ```
9. Move issue to **"Testing"**.

---

## Stage 4: QA Verification

**Role:** Meticulous tester verifying acceptance criteria are met.

1. Run automated tests on the feature branch (both frontend and apps-script).
2. For each acceptance criterion:
   - Find the corresponding test case
   - Verify it asserts the correct behavior (not just a shallow assertion)
3. Start preview server and visually inspect:
   - `preview_screenshot` for current state
   - `preview_snapshot` for element structure
   - `preview_resize` at desktop, tablet, mobile
   - Test interactions with `preview_click` and `preview_fill`
4. Test edge cases: empty states, long content, special characters, error states.
5. Check business rules sync if applicable.
6. Post QA report as a PR comment with:
   - AC verification checklist (pass/fail each)
   - Test results
   - Edge cases tested
   - Verdict: PASS or FAIL

**If QA FAILS:** Fix the issues in the Dev stage (update code, re-run tests, update PR), then re-run QA. Do NOT proceed to the approval gate until QA passes.

7. Move issue to **"In Review"**.

---

## APPROVAL GATE — Stop Here and Wait

**This is the only point where you pause for user input.**

Present a comprehensive summary:

```
## Pipeline Summary for Issue #N

### Idea
- **Title:** ...
- **Type:** bug / enhancement / feature / chore
- **Original idea:** (what the user asked for)

### Requirements (PM)
- **Acceptance Criteria:**
  - AC1: ...
  - AC2: ...
- **Scope:** in: ... / out: ...

### Implementation (Dev)
- **Branch:** ...
- **Files changed:** (list)
- **Tests added:** (list)

### QA Results
- **Verdict:** PASS
- **AC Verification:** all passing
- **Edge cases:** (summary)

### Links
- **Issue:** #N
- **PR:** #X (link)
- **Full diff:** `gh pr diff X`
```

Then ask the user:

> **Ready to merge?** Review the PR at the link above. Reply **approve** to merge, or describe what changes you'd like.

**Wait for the user's response before proceeding.**

---

## Stage 5: Review & Merge (post-approval)

**Only execute this stage after the user approves.**

1. Perform a code review of the PR diff:
   - Code quality, security (OWASP basics, Sheets formula injection), test coverage
   - Project conventions (Preact not React, signals, CSS custom properties)
   - Business rules sync
2. Post a review comment on the PR summarizing the review.
3. Approve the PR:
   ```bash
   gh pr review <pr-number> --repo luketmoss/hive --approve --body "<review summary>"
   ```
4. Merge (this will prompt the user for confirmation since `gh pr merge` is not pre-approved):
   ```bash
   gh pr merge <pr-number> --repo luketmoss/hive --squash --delete-branch
   ```
5. Move issue to **"Done"**.

---

## If the User Requests Changes

If the user replies with change requests instead of approving:

1. Move issue back to **"In Development"**.
2. Implement the requested changes on the same branch.
3. Re-run tests and verify builds pass.
4. Update the PR.
5. Re-run QA (abbreviated — focus on the changes).
6. Return to the approval gate with an updated summary.

---

## Definition of Done

- [ ] Issue created and classified on the board
- [ ] Acceptance criteria written and issue refined
- [ ] Feature implemented with tests matching every AC
- [ ] All tests pass, types clean, build succeeds
- [ ] QA report posted with PASS verdict
- [ ] User has approved the final result
- [ ] PR merged, branch deleted, issue in "Done"
