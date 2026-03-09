# Hive MCP Server

Local MCP server that lets Claude Desktop manage Hive kanban boards via natural language.

## Setup

1. Install dependencies:
   ```
   cd mcp-server
   npm install
   ```

2. Add to Claude Desktop config (`claude_desktop_config.json`):

   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "hive": {
         "command": "node",
         "args": ["<path-to-repo>/mcp-server/index.js"],
         "env": {
           "HIVE_API_URL": "<apps-script-deployment-url>",
           "HIVE_API_KEY": "<api-key>",
           "HIVE_DEFAULT_OWNER": "Luke"
         }
       }
     }
   }
   ```

3. Restart Claude Desktop.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HIVE_API_URL` | Yes | Apps Script web app deployment URL |
| `HIVE_API_KEY` | Yes | API key (must match `API_KEY` script property) |
| `HIVE_DEFAULT_OWNER` | No | Default owner for new items (e.g., "Luke") |

## Tools

| Tool | Description |
|------|-------------|
| `hive_list_boards` | List all boards |
| `hive_list_items` | List items on a board, optionally filtered by status |
| `hive_add_item` | Create a new item (supports sub-tasks via parent_id) |
| `hive_update_item` | Update an existing item's fields |
| `hive_list_owners` | List valid owners |
| `hive_list_labels` | List valid labels |
