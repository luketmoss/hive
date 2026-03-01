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
