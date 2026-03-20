# Hive

A family Kanban board powered by Google Sheets. Manage household tasks through a visual board with drag-and-drop, filtering, and sub-task tracking — all backed by a shared Google Sheet.

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
│  Voice / AI     │────▶│ Google Apps Script│──────────────┘
│  (ChatGPT, MCP) │     │ (REST API)       │
└─────────────────┘     └──────────────────┘
```

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Data | Google Sheets | Google |
| API | Google Apps Script | Google |
| Frontend | Preact + Vite | GitHub Pages |
| Auth | Google OAuth 2.0 (GIS) | Google Cloud |
| Voice / AI | ChatGPT Custom GPT + MCP Server | ChatGPT / Local |

## Features

- Three-column Kanban board (To Do, In Progress, Done)
- Drag-and-drop cards between columns with business rule enforcement
- Card detail panel with inline editing
- Sub-task support with progress tracking
- Filter by owner or label
- Swimlane grouping by owner or label
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
│   │   ├── components/       # UI components
│   │   ├── demo/             # Demo mode (mock data, no auth)
│   │   └── state/            # Preact signals store + business rules
│   └── public/
├── mcp-server/               # MCP server for Claude Desktop integration
├── chatgpt-gpt-setup.md      # ChatGPT Custom GPT configuration guide
└── .github/workflows/        # GitHub Pages deployment
```

## Full Setup (Google Sheets Backend)

Follow these steps to connect to a real Google Sheet instead of demo mode.

### 1. Google Sheet

Create a Google Sheet named **"Hive Board"** with four tabs:

| Tab | Headers (Row 1) |
|-----|----------------|
| **Items** | id, title, description, status, owner, due_date, scheduled_date, labels, parent_id, created_at, updated_at, completed_at, sort_order |
| **Owners** | name, google_account |
| **Labels** | label, color |
| **Audit Log** | timestamp, item_id, action, field, old_value, new_value, actor |

Add rows to **Owners** and **Labels** with your family members and preferred label categories.

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

## Voice & AI Integrations

- **ChatGPT Custom GPT** — Manage the board by voice via the ChatGPT mobile app. See [chatgpt-gpt-setup.md](chatgpt-gpt-setup.md) for setup.
- **MCP Server (Claude Desktop)** — Natural language board management via Claude Desktop. See [mcp-server/README.md](mcp-server/README.md) for setup.

## Business Rules

| Transition | Rule |
|---|---|
| To Do → In Progress | Owner must be assigned |
| In Progress → Done | All sub-tasks must be Done |
| Done → To Do / In Progress | Always allowed (reopening) |

## License

Private — for family use.
