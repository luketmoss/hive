# Hive - Family Kanban Board

## Project Overview
Family task management system using Google Sheets as data layer.
- **apps-script/**: Google Apps Script API (deployed via clasp) — serves voice/AI agents
- **frontend/**: Preact SPA (built with Vite) — deployed to GitHub Pages, reads/writes Sheets API directly

## Key Commands
- `cd apps-script && npm test` — run Apps Script unit tests (vitest)
- `cd apps-script && clasp push` — deploy Apps Script code
- `cd apps-script && clasp deploy` — create new Apps Script web app version
- `cd frontend && npm run dev` — start Vite dev server (localhost:5173)
- `cd frontend && npm run build` — production build to frontend/dist/
- `cd frontend && npm test` — run frontend tests (vitest)

## Environment
- **Windows machine** — `jq` is NOT available. For JSON parsing in shell commands, use `gh` built-in `--jq` flags (e.g., `gh project item-list ... --format json --jq '...'` or `gh api ... --jq '...'`). Never pipe to a standalone `jq` command.

## Architecture Notes
- Frontend uses direct `fetch()` to Google Sheets REST API (not gapi.client)
- Auth: Google Identity Services (GIS) token model
- State: @preact/signals
- Drag and drop: @dnd-kit/dom (NOT @dnd-kit/react — Preact compat issues)
- Business rules are duplicated in `apps-script/src/rules.ts` and `frontend/src/state/rules.ts` — keep in sync
- CSS Modules + custom properties for styling (no CSS framework)

## Preview & Demo Mode
- The app requires Google OAuth to function. For preview testing (QA, UX agents), use **demo mode** by navigating to `http://localhost:5173/hive/?demo=true` after starting the dev server.
- `preview_start` with the "frontend" config starts the Vite dev server but does NOT automatically navigate to the demo URL. After `preview_start`, always run `preview_eval` with `window.location.href` to check the current URL, and if it's not on `?demo=true`, use `preview_eval` with `window.location.href = 'http://localhost:5173/hive/?demo=true'` to navigate there.
- Demo mode provides a fake user ("Demo User" / demo@hive.local) and skips Google auth entirely. Changes are not persisted to any sheet.

## Data Model
Google Sheet "Hive Board" with 4 tabs: Items, Owners, Labels, Audit Log.
See the spec at the project root or the plan file for full column definitions.

## Agent Routing

**Issue tracker: GitHub only.** All issue references (#N or bare numbers) mean GitHub issues in `luketmoss/hive`. Never use Atlassian/Jira MCP tools for issue lookups, board management, or project queries — use `gh` CLI exclusively.

When the user's request matches a custom skill, invoke it automatically — no slash command needed:
- Bug report, feature idea, or new request → `/idea`
- UX or accessibility audit (no issue context) → `/ux`
- CI/CD or deployment issue → `/devops`
- Process all children of a parent issue → `/orchestrator`

**When the user references an issue number** (e.g., "implement #29", "work on 29", "refine #29", "take #29 all the way"), **always start the Full Pipeline**. The pipeline checks the issue's board state and picks up from the right stage — do NOT skip ahead to `/dev`, `/qa`, or `/review` directly. The only exceptions are when the user explicitly invokes a slash command (e.g., `/dev #29`) or explicitly says to skip stages.

## Pipeline Orchestration

**You (the main Claude instance) are the orchestrator.** You invoke skills in order, pass results between them, and ensure no step is skipped. Individual skills do their one job and return results to you. They do NOT call each other.

**Context passing:** Read the issue once at the start of the pipeline. When invoking each skill, include the current ACs and scope in your prompt so the skill has immediate context. Skills may still read the issue for verification, but this reduces redundant API calls.

### Refinement Pipeline

Use this when the user wants an issue refined and ready for development.

**Steps 1-3 are autonomous — do NOT stop or wait for the user between them. Continue immediately from one step to the next.**

1. **Invoke `/pm`** with the issue number. Collect the acceptance criteria and scope.
2. **Immediately invoke `/ux`** with the issue number and the ACs from step 1. Ask it to review the proposed UX for usability and accessibility gaps. **Tell it to post its findings as a comment on the GitHub issue.**
3. **Immediately invoke `/pm` again** with the UX findings (PM + UX negotiation). PM reviews each UX recommendation and decides:
   - **Accept**: update the ACs on the issue to incorporate the feedback.
   - **Defer**: the item is valid but out of scope for this issue. You (the orchestrator) create a new backlog issue for it (see **Deferred Items** below).
   - **Reject**: PM explains why the recommendation doesn't apply. No action needed.
4. Present the final ACs to the user and confirm the issue is ready. **This is the only pause point in refinement.**

### Full Pipeline

Use this when the user wants an issue taken from its current board state through to completion (or when they explicitly ask for the full pipeline).

**Steps 1-5 are autonomous — do NOT stop or wait for the user between them. The only pause point is the Approval Gate at step 6.**

1. **Check board state**: Look up the issue's current column to determine where to start.
2. **Refinement** (if in To Do/Refining): Run the Refinement Pipeline above.
3. **Development** (if in Ready/In Development): Invoke `/dev` with the issue number.
4. **QA** (if in Testing): Invoke `/qa` with the issue number. **Tell it to post its QA report as a comment on the GitHub issue (in addition to the PR).**
   - If QA **fails with code issues**: Invoke `/dev` with the QA failure report. Then re-invoke `/qa`. If it fails a second time, **stop and tell the user**.
   - If QA **flags AC problems** (ACs are ambiguous, contradictory, or don't match real behavior): Invoke `/pm` with the QA + Dev findings to negotiate AC updates. PM decides what to accept, defer, or reject (same as refinement). Then re-invoke `/dev` and `/qa` with the updated ACs.
5. **Code Review** (if in In Review): Invoke `/review` with the issue number. Tell the review agent **not to merge** — only post its verdict.
   - If review **requests changes**: Invoke `/dev` with the review feedback. Then re-invoke `/review`. If it requests changes a second time, **stop and tell the user**.
6. **Approval Gate**: Present a structured summary to the user using this format, then wait for explicit approval before merging:

   ```
   ## Pipeline Summary — Issue #N: <title>

   ### Requirements (PM)
   - <number> acceptance criteria defined
   - Scope: <one-line scope summary>
   - Complexity: <small/medium/large>

   ### UX Review
   - <accepted count> accepted, <deferred count> deferred, <rejected count> rejected
   - Key changes: <brief list of UX-driven AC updates>

   ### Implementation (Dev)
   - Branch: `<branch-name>`
   - Files changed: <count> | Tests added: <count>
   - Key changes: <brief summary of what was built>

   ### QA Results
   - Verdict: **PASS** / **FAIL**
   - <X/Y> acceptance criteria verified
   - Automated tests: frontend <pass>/<total>, apps-script <pass>/<total>
   - Edge cases tested: <brief list>

   ### Code Review
   - Verdict: **APPROVED** / **CHANGES REQUESTED**
   - Security: <clean / issues found>
   - Conventions: <clean / issues found>

   ### Deferred Items
   - <list of deferred issues with links, or "None">

   ### Links
   - Issue: #<number>
   - PR: #<pr-number>

   **Ready to merge?** Reply **approve** to squash-merge, or provide feedback.
   ```

   Omit sections for stages that were skipped (e.g., if the issue started in Testing, omit Requirements and UX Review).
7. **Merge** (after user approves):
   ```
   gh pr review <pr> --repo luketmoss/hive --approve --body "All agents passed, user approved."
   gh pr merge <pr> --repo luketmoss/hive --squash --delete-branch
   ```
   Move the issue to **Done**.

### Deferred Items

When PM decides to defer a UX recommendation or a QA-discovered issue to a later iteration:

1. Create a new issue with `/idea`, describing the deferred item and its origin.
2. Add a comment on the **original issue** linking to the new one:
   ```
   gh issue comment <original> --repo luketmoss/hive --body "Deferred to #<new>: <one-line description>"
   ```
3. The new issue lands in **To Do** on the board automatically.

This ensures deferred items are visible on the backlog with a clear trail back to where they came from.

### Context Compaction Recovery

If the conversation context is compacted mid-pipeline, **continue invoking skills normally**. Do NOT run remaining stages inline as the orchestrator — always delegate to the appropriate skill (`/qa`, `/review`, `/dev`, etc.) even after compaction. The conversation summary provides enough context for skill invocation. Doing work inline wastes orchestrator context and bypasses skill-specific guardrails.

### Conflict Resolution — Hard Limits

You get exactly **2 attempts** per failing stage. Track this as a count:
- Attempt 1: Send back to Dev, re-run the failing agent.
- Attempt 2 (fails again): **STOP.** Post a comment on the issue explaining what's stuck, and tell the user. Do NOT run a third attempt.
