# Hive

A Kanban board app powered by Google Sheets. Manage tasks through a visual board with drag-and-drop, filtering, and sub-task tracking — all backed by a shared Google Sheet.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (`.nvmrc` included — run `nvm use`)
- npm
- Git
- Google account (only needed for full setup, not demo mode)

## Quick Start (Demo Mode)

See the app running in under 2 minutes — no Google account or API setup needed.

```bash
git clone https://github.com/luketmoss/hive.git
cd hive/frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173/hive/?demo=true — you'll see the board with mock data. No sign-in required.

> Demo mode uses a fake user and sample data. Changes are not persisted. See [Demo Mode](#demo-mode) for details.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Static Web App │────▶│ Google Sheets API │────▶│  Google Sheets   │
│  (GitHub Pages) │     │ (via OAuth)       │     │  (Data Layer)    │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│  MCP Worker     │────▶│ Google Apps Script│──────────────┘
│  (Claude)       │     │ (REST API)       │
└─────────────────┘     └──────────────────┘
```

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Data | Google Sheets | Google |
| API | Google Apps Script | Google |
| Frontend | Preact + Vite | GitHub Pages |
| Auth | Google OAuth 2.0 (GIS) | Google Cloud |
| AI | MCP Worker (in Keel) | Cloudflare |

## Features

- **Multi-board support** — create separate boards per team, project, or context; share boards with other users
- Three-column Kanban board (To Do, In Progress, Done) with drag-and-drop and business rule enforcement
- **Upcoming view** — cross-board timeline of items due today, this week, and later
- Card detail panel with inline editing
- Sub-task support with progress tracking
- Filter by owner or label
- Swimlane grouping by owner or label
- Board customization (icon picker)
- Real-time sync via 30-second polling
- Audit log of all changes

## Project Structure

```
hive/
├── apps-script/              # Google Apps Script REST API (clasp-managed)
│   ├── src/                  # Source files (.js) pushed to Google
│   └── tests/                # Unit tests + smoke test script
├── frontend/                 # Preact SPA
│   ├── src/
│   │   ├── api/              # Google Sheets REST API wrapper
│   │   ├── auth/             # Google OAuth (GIS token model)
│   │   ├── components/       # UI components (board, upcoming view, header, shared)
│   │   │   ├── board/        # Kanban board, board switcher, sharing
│   │   │   ├── upcoming/     # Upcoming cross-board timeline view
│   │   │   ├── header/       # App header, control bar, view toggle
│   │   │   └── shared/       # Reusable components (labels, icons, modals)
│   │   ├── demo/             # Demo mode (mock data, no auth)
│   │   └── state/            # Preact signals store + business rules
│   └── public/
└── .github/workflows/        # GitHub Pages deployment
```

## Full Setup (Google Sheets Backend)

Follow these steps to connect to a real Google Sheet instead of demo mode.

### 1. Google Sheet

Create a Google Sheet named **"Hive Board"** with six tabs:

| Tab | Headers (Row 1) |
|-----|----------------|
| **Items** | id, title, description, status, owner, due_date, labels, parent_id, created_at, updated_at, completed_at, sort_order, created_by, board_id |
| **Owners** | name, google_account |
| **Labels** | label, color, board_id |
| **Boards** | id, name, created_at, created_by, color, icon |
| **Permissions** | board_id, user_email, role |
| **Audit Log** | timestamp, item_id, action, field, old_value, new_value, actor |

The app creates the **Boards** and **Permissions** tabs automatically on first use if they don't exist. Add rows to **Owners** with your team members. Labels are managed per-board through the app UI.

### 2. Google Cloud Project

1. Create a GCP project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable: **Google Sheets API**, **Google Apps Script API**, **Google Drive API**
3. Configure **OAuth consent screen** (External, Testing mode, add your accounts as test users)
4. Create an **OAuth client ID** (Web application) with authorized JavaScript origins:
   - `http://localhost:5173` (local dev)
   - `https://<username>.github.io` (production)

### 3. Apps Script API

```bash
npm i -g @google/clasp
clasp login

cd apps-script
npm install
clasp create --title "Hive API" --type standalone --rootDir ./src
# Set SPREADSHEET_ID in Apps Script > Project Settings > Script Properties
clasp push --force
# Deploy via Apps Script editor: Deploy > New deployment > Web app > Anyone
```

> Note: `.clasp.json` is gitignored — each developer runs `clasp create` to generate their own.

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in VITE_GOOGLE_CLIENT_ID and VITE_SPREADSHEET_ID in .env.local
npm run dev
```

Open http://localhost:5173/hive/ and sign in with Google.

> `VITE_DEMO_MODE=true` is the default in `.env.example` and is safe to leave set — demo mode only activates when the `?demo=true` URL param is also present.

### 5. GitHub Pages (Production)

1. Set GitHub Pages source to **GitHub Actions** in repo settings
2. Add repository secrets:
   - `VITE_GOOGLE_CLIENT_ID` — your OAuth client ID
   - `VITE_SPREADSHEET_ID` — your Google Sheet ID
3. Push to `main` — the workflow builds and deploys automatically

### Daily snapshots (Apps Script)

A time-driven trigger copies the sheet to a dated file in a Drive folder once a day and keeps the newest 60 (older ones go to Drive's trash). Google's own version history only reaches back about 30 days, so a snapshot is what makes a bad write recoverable after that.

1. In the Drive of the account that deploys the Apps Script, create a folder (e.g. "Hive snapshots") and **do not share it**. Each snapshot holds the whole family board, and each counts against that account's storage: check the sheet's size times 60.
2. In Apps Script > Project Settings > Script Properties, set `SNAPSHOT_FOLDER_ID` to the folder's ID (the last part of its URL).
3. `clasp push --force`, then in the Apps Script editor run `installSnapshotTrigger` once and accept the new **Drive** permission. Do this **before** `clasp redeploy`: a deployed version using Drive blocks the web app until the permission is granted.
4. Then `clasp redeploy <deployment ID> --description "..."`.

`installSnapshotTrigger` is safe to run again (it leaves one trigger); `removeSnapshotTrigger` removes it. It fires at about 03:00 America/Denver and writes `Hive snapshot YYYY-MM-DD`; running `takeSnapshot` by hand the same day does nothing. If `SNAPSHOT_FOLDER_ID` is unset or not writable the run fails, and Apps Script emails the failure to the account that ran `installSnapshotTrigger`.

**Restoring a value:** open the snapshot spreadsheet from the folder, find the cell or rows, and copy them back into the live sheet by hand.

## Running Tests

```bash
# All tests (apps-script + frontend)
npm test

# Individual suites
npm run test:apps-script
npm run test:frontend
```

## Demo Mode

Demo mode lets you use the app without Google auth or a real spreadsheet. It requires two conditions (defense in depth):

1. `VITE_DEMO_MODE=true` set in `.env.local` at build time
2. `?demo=true` query parameter in the URL at runtime

Both must be true for demo mode to activate. This means:
- `cp .env.example .env.local` enables the build-time flag by default
- Navigate to `http://localhost:5173/hive/?demo=true` to activate
- Navigate to `http://localhost:5173/hive/` (without the param) to use real Google auth

Demo mode provides a fake user and sample board data. Changes are not persisted.

## AI Integration

- **MCP Server (Claude, phone and desktop)** — Natural language board management through a remote MCP connector (`/hive/mcp`), served by the Worker in Keel (`luketmoss/keel` → `mcp/`). See that project's `CLAUDE.md` for setup.

## Business Rules

| Transition | Rule |
|---|---|
| To Do → In Progress | Owner must be assigned |
| In Progress → Done | All sub-tasks must be Done |
| Done → To Do / In Progress | Always allowed (reopening) |