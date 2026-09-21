# Hive — Family Kanban Board

## Project Overview
Task management for two people, using a Google Sheet as the data layer.
- **frontend/**: Preact SPA (Vite) — deployed to GitHub Pages, reads/writes the Sheets REST API directly
- **apps-script/**: Google Apps Script API (clasp) — a second door into the same sheet, for voice and AI agents that have no browser OAuth token

Business rules live in both places and must agree: `frontend/src/state/rules.ts`
and `apps-script/src/rules.js`, `frontend/src/api/types.ts` and
`apps-script/src/types.js`. Change them together or the two doors disagree about
what a move means.

## Key Commands
- `cd frontend && npm run dev` — Vite dev server (localhost:5173/hive/)
- `cd frontend && npm test` — frontend tests (vitest)
- `cd frontend && npx tsc --noEmit` — type check
- `cd frontend && npm run build` — production build to `frontend/dist/`
- `cd apps-script && npm test` — Apps Script unit tests (vitest)
- `cd apps-script && clasp push --force` — push to Google. A push alone does not move the deployment; follow it with
  `clasp redeploy AKfycbwR-PP8Mg41pVEoMsLxYDMMMmr3yufaApRlymItvBv37-ZKRmdPm03R_eVzr_G2Lnza --description "..."`,
  which cuts a new version on the live deployment and keeps its URL. Roll back with `-V <previous version>`.
  The user's terminal is PowerShell 5.1 — no `&&`; use `;` or separate commands

## Apps Script Deployment
- **Live project: "Hive API"**, script ID `11J1aR_JwYWmobNTj8w1kbFCac3mAKrUt4sRdgcrIhUB5ROCSQn4whU08`.
  `apps-script/.clasp.json` is gitignored, so this line is the only committed record of it
- Access must be **"Anyone" (`ANYONE_ANONYMOUS`)**, executing as the deployer. The MCP server (`mcp-server/`) calls
  with a plain `fetch` and an API key, no Google sign-in; "Anyone with a Google account" 302s it to a login page.
  The `webapp` block in `src/appsscript.json` is what keeps this — `clasp push --force` overwrites the server
  manifest with the local one, so it must stay there
- Consumers of the URL: the MCP server's `HIVE_API_URL` (Claude desktop config), `.claude/settings.local.json`

## Environment
- **Windows machine** — `jq` is NOT available. Use `gh`'s built-in `--jq` flag. Never pipe to a standalone `jq`.
- Node 20+, npm

## Architecture Notes
- Frontend uses direct `fetch()` to the Sheets REST API (not gapi.client)
- Auth: Google Identity Services (GIS) token model; `withReauth()` wraps every Sheets call and retries once on an expired token
- State: @preact/signals — module-level `signal()`/`computed()`. `useState` only for component-local state
- Demo mode is gated at the app/state layer (`frontend/src/demo/`, `app.tsx`, `auth-provider.tsx`, `state/actions-*`), **not** inside each API function
- Drag and drop: HTML5 native, no library
- Styling: CSS custom properties in `global.css`. No framework, no CSS modules. Breakpoints at 768px, 600px and 480px; `data-theme="dark"` for dark mode
- Apps Script is `.js`, not TypeScript — clasp's transpilation was unreliable. All operations go through `doGet()` with a `payload` query param, because POST is broken for anonymous callers
- Always online, no offline cache. 30-second poll for sync (`app.tsx`), which is enough for two users

## Preview & Demo Mode
`preview_start` with the **`frontend`** launch config, then navigate to
`http://localhost:5173/hive/?demo=true`.

Demo mode needs both `VITE_DEMO_MODE=true` (build-time, already in
`.env.local`) and `?demo=true` (runtime). Both are checked in
`is-demo-mode.ts`, which is why leaving the env var on permanently is safe.

It auto-authenticates — no login screen, no OAuth popup. Changes are not
persisted; reloading restores the original demo set.

### Driving the preview
- Prefer `read_page` or `javascript_tool` over screenshots when checking a specific element or a computed value — a screenshot cannot tell you a contrast ratio
- `computer` clicks are unreliable on signal-driven components; use `javascript_tool` with `.click()` instead
- Native input value setters do not trigger signal updates; use `form_input`
- Batch DOM checks into one `javascript_tool` IIFE rather than many calls
- `computer` with `action: "screenshot"` for visual evidence, `resize_window` for the 375px breakpoint
- Enumerating CSS media queries from JS fails under Vite's bundling — read the CSS instead

## Data Model
Google Sheet "Hive Board", 7 tabs. Row 1 is headers everywhere; reads start at
`A2`. Every entity carries the `sheetRow` it came from, which is how updates and
deletes find it again.

- **Items** (`A:N`, 14 columns): id, title, description, status, owner, due_date,
  labels, parent_id, created_at, updated_at, completed_at, sort_order,
  created_by, board_id
- **Owners** (`A:B`): name, email
- **Labels** (`A:C`): label, color, board_id
- **Boards** (`A:F`): ID, Name, Created At, Created By, Color, Icon
- **Permissions** (`A:C`): Board ID, User Email, Role
- **Statuses** (`A:G`): id, board_id, name, sort_order, color, is_terminal, created_at
- **Audit Log** (`A:G`, append-only): timestamp, item_id, action, field, old_value, new_value, actor

### Invariants
- **Row deletion runs bottom-to-top.** Deleting top-down shifts every row beneath
  it and the next delete hits the wrong record. `sheets.ts` sorts descending
  before deleting — keep it that way.
- **Columns are per-board rows in `Statuses`, not an enum.** The `VALID_STATUSES`
  constant and `STATUS_COL` comment in `apps-script/src/types.js` say
  "deprecated"; the sheet is still read and written at `Statuses!A2:G` and is the
  live source. Treat the comment as stale, not the tab.
- **`completed_at` is driven by `is_terminal`, never by a column's name.**
  `applyStatusSideEffects` sets it entering a terminal column and clears it
  leaving one. A board can call its terminal column anything.
- **The Audit Log is append-only** and nothing reads it in the frontend today.
  That is a deliberate forensic trail, not dead weight to be tidied away. Issue
  #239 is the read path.
- **`parent_id` makes sub-items**, and a sub-item lives in the same `Items` tab
  as its parent. There is no separate sheet.
- **No formula-injection sanitizer exists yet.** Nothing prefixes `'` to input
  starting with `=`, `+`, `-`, `@` or tab. Issue #87 tracks hardening. Do not
  block a PR for missing a convention the project does not have — raise it on
  #87 instead.

## UX Design Decisions
Respected by every agent. Add to this list when a decision gets made, so it
stops being re-litigated three issues later.

- **Desktop-first Kanban**, responsive down to 375px — the inverse of a
  mobile-first app, because the board is the primary surface
- **Native HTML5 drag and drop** on desktop; touch drag is a separate concern
  (#122) and not a reason to add a library
- **Touch targets ≥ 44×44px** — WCAG 2.5.5
- **Light and dark** via `data-theme`; every new color goes through a custom
  property in `global.css`, never a literal
- **Grouping is one menu**, not a view toggle (#230)
- **Per-board columns** — boards define their own statuses (#218)

## The Board

**Issue tracker: GitHub only.** Every issue reference means a GitHub issue in
`luketmoss/hive`; use the `gh` CLI. Never use Atlassian/Jira MCP tools.
Project #2, `https://github.com/users/luketmoss/projects/2`.

**All board writes go through `node .hive/board.mjs`** — never hand-write
GraphQL against the project, and never call `gh project field-list`. IDs live in
`.hive/board.json`; `board.mjs sync` refreshes them if a column is added or
renamed.

```bash
node .hive/board.mjs show <issue>
node .hive/board.mjs set <issue> --status "In Development"
node .hive/board.mjs list --status Refined
node .hive/board.mjs children <issue>
```

| Stage | Skill | Gate |
|---|---|---|
| To Do | `/idea` | |
| PM Refining | `/pm` | |
| UX | `/ux` | |
| Refined | — | **agree with the spec?** |
| In Development | `/dev` | |
| Testing | `/qa` | |
| Code Review | `/review` | |
| Ready to Ship | `/ship` | **agree with the implementation?** |
| Done | — | |

Each skill owns its own column moves. A stage skill is a step, not a stopping
point — each one names the skill that moves the work on.

## The Two Runs

Work moves through the board in **runs**, not stage by stage. A run chains its
stages back to back in one pass and does not check in between them.

- **`/refine`** — To Do → Refined. "Get #42 ready for dev", "refine this",
  "spec it out". Chains `/idea` (if the issue doesn't exist) → `/pm` → `/ux` →
  `/pm`, and stops at the design gate.
- **`/finish`** — Refined → Done. "Finish #42", "ship it", "build it out".
  Chains `/dev` → `/qa` → `/review` → `/ship`, resuming from whatever column the
  issue is actually in.

The two runs are deliberately separate. Running them back to back skips the
design gate, which is the only review of the spec.

**Do not chain the stages by hand.** If the request is a run, invoke the run
skill; it owns the sequence, the halt conditions, and the report. When the user
names an issue number without naming a stage, read the board and start the run
that column belongs to.

Outside the runs: `/orchestrator` to take a parent issue's children through the
runs in a batch, `/devops` for CI/CD and deployment problems, `/ux` on its own
for a standalone audit, `/retro` at the end of a session that ran a pipeline.

## Halting

A run stops early only for the conditions its skill lists — an open product
question, a failed criterion with no clear fix, a blocking review, a red check.
Two attempts at a failing stage, then stop.

**A halted run is a success.** Report where it stopped and why; do not work
around a gate, and do not guess at an answer to a question you raised.

## Deferred Items

Anything worth doing that is out of scope becomes its own issue via `/idea` —
never a raw `gh issue create`, which skips classification, dedup and the board.
Comment on the original: `Deferred to #<new>: <description>`.

## Context Compaction

If the context is compacted mid-run, keep invoking skills. Do **not** finish the
remaining stages inline in the main conversation — a stage run by hand skips the
skill's checks and its board move, and the retro will find it.
