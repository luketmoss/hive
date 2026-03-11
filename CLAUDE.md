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

**When the user says "approve #N"**: find the open PR for that issue, run the merge step from the Full Pipeline (approve + squash-merge + delete branch + move to Done). No need to re-run any other pipeline stages.

## Board Columns

| Column | Option ID | Description |
|---|---|---|
| To Do | `2ed3c08e` | New issues awaiting refinement |
| PM Refining | `60b38b8d` | PM skill writing ACs — pass-through, do not disturb |
| UX | `0c810f0f` | UX skill reviewing; PM reconciling — pass-through, do not disturb |
| Refined | `9e0d0478` | Requirements complete — **your design gate**: review ACs then move to Pick Up or start a session |
| Pick Up | `b9d77a66` | Approved and queued for autonomous dev pipeline |
| In Development | `cedf160f` | Dev skill is building |
| Testing | `1bd1ca27` | QA skill verifying acceptance criteria |
| Code Review | `2e7d4fd2` | Review skill checking code quality and conventions |
| Done | `2aaa3a20` | Shipped |

Use this GraphQL mutation to move an issue (replace `ITEM_ID` and `OPTION_ID`):
```
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "PVT_kwHOAJR9ys4BQe_8" itemId: "ITEM_ID" fieldId: "PVTSSF_lAHOAJR9ys4BQe_8zg-lvnE" value: { singleSelectOptionId: "OPTION_ID" } }) { projectV2Item { id } } }'
```

## Pipeline Orchestration

**You (the main Claude instance) are the orchestrator.** You invoke skills in order, pass results between them, and ensure no step is skipped. Individual skills do their one job and return results to you. They do NOT call each other.

**Context passing:** Read the issue once at the start of the pipeline. When invoking each skill, include the current ACs and scope in your prompt so the skill has immediate context. Skills may still read the issue for verification, but this reduces redundant API calls.

### Board State Routing

When the user references an issue number, check its column and route accordingly:

- **To Do / PM Refining / UX** → run the **Refinement Pipeline** (pauses at Refined for user review)
- **Refined / Pick Up / In Development / Testing / Code Review** → run the **Dev Pipeline** (fully autonomous, auto-merges)

### Refinement Pipeline

**Your design gate. Steps 1–4 are fully autonomous — no pauses. The only stop is presenting the final ACs to the user at step 5.**

1. Move issue to **PM Refining**. Invoke `/pm` with the issue number. Collect the acceptance criteria and scope.
2. Move issue to **UX**. Invoke `/ux` with the issue number and the ACs from step 1. Ask it to review the proposed UX for usability and accessibility gaps. **Tell it to post its findings as a comment on the GitHub issue.**
3. Invoke `/pm` again with the UX findings (PM + UX negotiation). PM reviews each UX recommendation and decides:
   - **Accept**: update the ACs on the issue to incorporate the feedback.
   - **Defer**: valid but out of scope — create a new backlog issue (see **Deferred Items** below).
   - **Reject**: PM explains why the recommendation doesn't apply. No action needed.
4. Move issue to **Refined**.
5. Present the final ACs to the user. **This is the only pause point — your design gate.** Once you review and are satisfied, move the issue to Pick Up for autonomous dev, or start a session to run the Dev Pipeline interactively.

### Dev Pipeline

**Fully autonomous. No approval gate. Auto-merges on passing QA and Code Review. Posts a final report to the GitHub issue on completion.**

Runs when an issue is in Refined (interactive session) or Pick Up (watcher). Also resumes correctly from In Development, Testing, or Code Review if the pipeline is restarted mid-flight.

1. **Start dev**: If in Pick Up or Refined, move issue to **In Development**. Invoke `/dev` with the issue number.
   - After dev completes, **do not perform visual verification inline** — that is QA's job. Immediately move to step 2.
   - If a preview stop-hook fires after dev, satisfy it by invoking QA (which will start the preview server as part of its process).
2. **QA**: Move issue to **Testing**. Invoke `/qa` with the issue number. **Tell it to post its QA report as a comment on the GitHub issue.**
   - If QA **fails with code issues**: Invoke `/dev` with the failure report. Re-invoke `/qa`. If it fails a second time, **stop — post a comment on the issue and tell the user**.
   - If QA **flags AC problems** (ambiguous, contradictory, or don't match real behaviour): Invoke `/pm` to negotiate AC updates (accept/defer/reject). Re-invoke `/dev` and `/qa` with updated ACs.
3. **Code Review**: Move issue to **Code Review**. Invoke `/review` with the issue number. Tell it **not to merge** — verdict only.
   - If review **requests changes**: Invoke `/dev` with the feedback. Re-invoke `/review`. If it requests changes a second time, **stop — post a comment on the issue and tell the user**.
4. **Auto-merge**:
   ```
   gh pr review <pr> --repo luketmoss/hive --approve --body "All pipeline stages passed."
   gh pr merge <pr> --repo luketmoss/hive --squash --delete-branch
   ```
   Move issue to **Done**.
5. **Post final report** to the GitHub issue as a comment:

   ```
   ## Pipeline Complete — Issue #N: <title>

   ### Implementation (Dev)
   - Branch: `<branch-name>` (merged)
   - Files changed: <count> | Tests added: <count>
   - Key changes: <brief summary of what was built>

   ### QA Results
   - Verdict: **PASS**
   - <X/Y> acceptance criteria verified
   - Automated tests: frontend <pass>/<total>, apps-script <pass>/<total>
   - Edge cases tested: <brief list>

   ### Code Review
   - Verdict: **APPROVED**
   - Security: <clean / issues found>
   - Conventions: <clean / issues found>

   ### Deferred Items
   - <list of deferred issues with links, or "None">

   ### Links
   - Issue: #<number>
   - PR: #<pr-number> (merged)
   ```

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
