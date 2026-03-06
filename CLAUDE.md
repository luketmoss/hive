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

## Architecture Notes
- Frontend uses direct `fetch()` to Google Sheets REST API (not gapi.client)
- Auth: Google Identity Services (GIS) token model
- State: @preact/signals
- Drag and drop: @dnd-kit/dom (NOT @dnd-kit/react — Preact compat issues)
- Business rules are duplicated in `apps-script/src/rules.ts` and `frontend/src/state/rules.ts` — keep in sync
- CSS Modules + custom properties for styling (no CSS framework)

## Data Model
Google Sheet "Hive Board" with 4 tabs: Items, Owners, Labels, Audit Log.
See the spec at the project root or the plan file for full column definitions.

## Agent Routing

When the user's request matches a custom skill, invoke it automatically — no slash command needed:
- Bug report, feature idea, or new request → `/idea`
- Refine an issue or write acceptance criteria → start the **Refinement Pipeline** below
- Implement an issue or write code for a ticket → `/dev`
- Run QA or verify acceptance criteria → `/qa`
- Review a PR → `/review`
- UX or accessibility audit → `/ux`
- CI/CD or deployment issue → `/devops`
- Process all children of a parent issue → `/orchestrator`
- "Take this issue all the way" or full pipeline request → start the **Full Pipeline** below

## Pipeline Orchestration

**You (the main Claude instance) are the orchestrator.** You invoke skills in order, pass results between them, and ensure no step is skipped. Individual skills do their one job and return results to you. They do NOT call each other.

### Refinement Pipeline

Use this when the user wants an issue refined and ready for development.

1. **Invoke `/pm`** with the issue number. Collect the acceptance criteria and scope.
2. **Invoke `/ux`** with the issue number and the ACs from step 1. Ask it to review the proposed UX for usability and accessibility gaps.
3. **Return to PM**: If UX flagged issues, invoke `/pm` again with the UX findings and ask it to update the ACs on the issue. If UX had no concerns, skip this step.
4. Present the final ACs to the user and confirm the issue is ready.

### Full Pipeline

Use this when the user wants an issue taken from its current board state through to completion (or when they explicitly ask for the full pipeline).

1. **Check board state**: Look up the issue's current column to determine where to start.
2. **Refinement** (if in To Do/Refining): Run the Refinement Pipeline above.
3. **Development** (if in Ready/In Development): Invoke `/dev` with the issue number.
4. **QA** (if in Testing): Invoke `/qa` with the issue number.
   - If QA **fails**: Invoke `/dev` with the QA failure report. Then re-invoke `/qa`. If it fails a second time, **stop and tell the user** — do not loop further.
5. **Code Review** (if in In Review): Invoke `/review` with the issue number. Tell the review agent **not to merge** — only post its verdict.
   - If review **requests changes**: Invoke `/dev` with the review feedback. Then re-invoke `/review`. If it requests changes a second time, **stop and tell the user**.
6. **Approval Gate**: Present a summary of all agent results to the user. Wait for explicit approval before merging.
7. **Merge** (after user approves):
   ```
   gh pr review <pr> --repo luketmoss/hive --approve --body "All agents passed, user approved."
   gh pr merge <pr> --repo luketmoss/hive --squash --delete-branch
   ```
   Move the issue to **Done**.

### Conflict Resolution — Hard Limits

You get exactly **2 attempts** per failing stage. Track this as a count:
- Attempt 1: Send back to Dev, re-run the failing agent.
- Attempt 2 (fails again): **STOP.** Post a comment on the issue explaining what's stuck, and tell the user. Do NOT run a third attempt.
