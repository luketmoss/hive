# Hive - Kanban Board

## Project Overview
Task management system using Google Sheets as data layer.
- **apps-script/**: Google Apps Script API (deployed via clasp) — serves voice/AI agents
- **frontend/**: Preact SPA (built with Vite) — deployed to GitHub Pages, reads/writes Sheets API directly

## Key Commands
- `cd apps-script && npm test` — run Apps Script unit tests (vitest)
- `cd apps-script && clasp push` — deploy Apps Script code
- `cd frontend && npm run dev` — start Vite dev server (localhost:5173)
- `cd frontend && npm run build` — production build to frontend/dist/
- `cd frontend && npm test` — run frontend tests (vitest)

## Environment
- **Windows machine** — `jq` is NOT available. Use `gh` built-in `--jq` flags. Never pipe to standalone `jq`.

## Architecture Notes
- Frontend uses direct `fetch()` to Google Sheets REST API (not gapi.client)
- Auth: Google Identity Services (GIS) token model
- State: @preact/signals
- Drag and drop: HTML5 native drag-and-drop (no library)
- Business rules duplicated in `apps-script/src/rules.js` and `frontend/src/state/rules.ts` — keep in sync
- CSS custom properties in `global.css` (no CSS framework)
- Apps Script uses `.js` (not TypeScript) — all ops through `doGet()` with `payload` query param

## Preview & Demo Mode
- For preview testing, use **demo mode**: `http://localhost:5173/hive/?demo=true`
- After `preview_start`, check URL with `preview_eval` and navigate to demo if needed
- Demo mode: fake user, no Google auth, changes not persisted

## Data Model
Google Sheet "Hive Board" with 4 tabs: Items, Owners, Labels, Audit Log.

## Agent Routing

**Issue tracker: GitHub only.** All issue references mean GitHub issues in `luketmoss/hive`. Never use Atlassian/Jira MCP tools — use `gh` CLI exclusively.

Auto-invoke skills when request matches:
- Bug/feature/idea → `/idea` · UX audit → `/ux` · CI/CD issue → `/devops` · Batch children → `/orchestrator`

**When user references an issue number** → always start the Full Pipeline (checks board state, picks up from right stage). Only exception: user explicitly invokes a slash command or says to skip stages.

**When user says "approve #N"** → find PR, approve + squash-merge + delete branch + move to Done.

## Board Columns

| Column | Option ID |
|---|---|
| To Do | `2ed3c08e` |
| PM Refining | `60b38b8d` |
| UX | `0c810f0f` |
| Refined | `9e0d0478` |
| Pick Up | `b9d77a66` |
| In Development | `cedf160f` |
| Testing | `1bd1ca27` |
| Code Review | `2e7d4fd2` |
| Done | `2aaa3a20` |

```bash
# Move issue (replace ITEM_ID and OPTION_ID)
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: { projectId: "PVT_kwHOAJR9ys4BQe_8" itemId: "ITEM_ID" fieldId: "PVTSSF_lAHOAJR9ys4BQe_8zg-lvnE" value: { singleSelectOptionId: "OPTION_ID" } }) { projectV2Item { id } } }'
```

## Pipeline Orchestration

**You are the orchestrator.** Invoke skills in order, pass results between them. Skills do their one job and return — they do NOT call each other.

### Board State Routing

- **To Do / PM Refining / UX** → Refinement Pipeline (pauses at Refined for user review)
- **Refined / Pick Up / In Development / Testing / Code Review** → Dev Pipeline (fully autonomous)

### Refinement Pipeline

Steps 1–4 autonomous. Only pause: presenting final ACs at step 5.

1. Move to **PM Refining**. Invoke `/pm`. Collect ACs.
2. Move to **UX**. Invoke `/ux` with ACs. Post findings as issue comment.
3. Invoke `/pm` again with UX findings (accept/defer/reject).
4. Move to **Refined**.
5. Present final ACs to user (**design gate**).

### Dev Pipeline

Fully autonomous. Auto-merges on pass. Resumes from any mid-flight column.

1. **Dev**: Move to In Development. Invoke `/dev`. Do NOT verify visually — that's QA's job.
2. **QA**: Move to Testing. Invoke `/qa`. If FAIL → `/dev` + `/qa` retry. If AC_PROBLEM → `/pm` negotiate, then `/dev` + `/qa`. 2nd fail → stop.
3. **Review**: Move to Code Review. Invoke `/review` (verdict only, no merge). If CHANGES REQUESTED → `/dev` + `/review` retry. 2nd fail → stop.
4. **Merge**: `gh pr review --approve`, `gh pr merge --squash --delete-branch`, `gh issue close`. Move to Done.
5. **Post final report** to issue: Dev summary, QA results, Review verdict, Deferred items, Links.

### Deferred Items

Use `/idea` to create deferred issues. Comment on original: `Deferred to #<new>: <desc>`.

### Conflict Resolution

2 attempts per failing stage max. After 2nd failure → stop, post comment, tell user.

### Context Compaction Recovery

If context compacted mid-pipeline, continue invoking skills normally. Do NOT run stages inline.
