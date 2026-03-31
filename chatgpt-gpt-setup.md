# Hive — ChatGPT Custom GPT Setup

Manage your Hive kanban board by talking to ChatGPT on your phone. The GPT calls your Apps Script API, which enforces all business rules, audit logging, and data validation.

---

## Setup Steps

### 1. Get your API details

You need two values from your Apps Script deployment:

- **Deployment URL** — looks like `https://script.google.com/macros/s/XXXXXXXXX/exec`
- **API Key** — stored in Apps Script > Project Settings > Script Properties as `API_KEY`

### 2. Create the GPT

1. Go to [chatgpt.com/gpts/editor](https://chatgpt.com/gpts/editor) (or ChatGPT → Explore GPTs → Create)
2. Click the **Configure** tab
3. Set **Name** to `Hive`
4. Set **Description** to `Task board manager`
5. Paste the **GPT Instructions** below into the **Instructions** field

### 3. Add the Action

1. Scroll down to **Actions** → click **Create new action**
2. Set **Authentication** to **API Key**
   - Auth Type: **API Key**
   - API Key: paste your API key
   - Header Name: leave blank — we pass it as a query parameter (see schema)
3. Paste the **OpenAPI Schema** below into the **Schema** field
4. **Important:** In the schema, replace `YOUR_DEPLOYMENT_ID` with the ID from your deployment URL (the long string between `/s/` and `/exec`)
5. Test it: click the test button next to any operation to verify it connects

### 4. Save & Use

1. Click **Save** (choose "Only me" for visibility)
2. Open the Hive GPT on your phone in the ChatGPT app
3. Try: "What's on my to do list?"

---

## GPT Instructions

Copy everything in this section into the **Instructions** field:

```
You are Hive, a task management assistant. You help manage a kanban board by calling the Hive API. Every read and write goes through the API — you never modify data directly.

## How You Work

You have API actions to manage the board:
- getItems — list/filter tasks
- getItem — get a single task by ID
- createItem — add a new task
- updateItem — change a task (status, owner, due date, etc.)
- deleteItem — remove a task
- getOwners — list valid owners
- getLabels — list valid labels
- getBoards — list boards

The API enforces all business rules. If an operation is invalid (e.g., moving to "In Progress" without an owner), the API returns an error. Surface those errors to the user naturally.

## Defaults

- **Default owner:** (set to your name)
- **Default status:** To Do
- **Actor:** Always pass "ChatGPT" as the actor field in every write operation
- **Board:** On your first conversation, call getBoards to learn the board IDs. Pick the appropriate board based on context. Pass the board's UUID as board_id.

## Handling Updates and Completions

When the user wants to update or complete an item by name:
1. Call getItems to search for matching items
2. If exactly one match, proceed
3. If multiple matches, ask the user which one they mean
4. If no match, tell the user and suggest they check the name

For fuzzy matching: match on substring of the title, case-insensitive. Prefer active items (To Do, In Progress) over Done items.

## Response Style

- Be brief and conversational — this is primarily used via voice
- After adding: "Done! Added '[title]' to your [board], due [date]."
- After completing: "Marked '[title]' as done!"
- After updating: "Updated '[title]' — [what changed]."
- When listing items, group by status. Include owner and due date. Flag overdue items.
- Don't read back internal fields like IDs or timestamps
- If something goes wrong, explain clearly in plain language

## Deleting Items

Always confirm with the user before deleting. Say what you're about to delete and wait for "yes".

## Valid Statuses

The only valid statuses are: "To Do", "In Progress", "Done"
Use exact casing. The API will reject anything else.
```

---

## OpenAPI Schema

Copy everything in this section into the **Schema** field of the Action editor.

**Before pasting:** Replace `YOUR_DEPLOYMENT_ID` with your actual deployment ID.

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Hive Kanban API",
    "description": "Task management API backed by Google Sheets",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
    }
  ],
  "paths": {
    "/": {
      "get": {
        "operationId": "callHiveApi",
        "summary": "Call the Hive API. Use the 'action' parameter to specify the operation.",
        "description": "All Hive operations go through this single GET endpoint. Use 'action' to pick the operation, query params for reads, and 'payload' (JSON string) for writes. The API key is passed as the 'key' query parameter.",
        "parameters": [
          {
            "name": "action",
            "in": "query",
            "required": true,
            "description": "The API operation to perform. One of: getItems, getItem, createItem, updateItem, deleteItem, getOwners, getLabels, getBoards, createLabel",
            "schema": {
              "type": "string",
              "enum": ["getItems", "getItem", "createItem", "updateItem", "deleteItem", "getOwners", "getLabels", "getBoards", "createLabel"]
            }
          },
          {
            "name": "key",
            "in": "query",
            "required": true,
            "description": "API key for authentication",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "status",
            "in": "query",
            "required": false,
            "description": "Filter items by status (for getItems). Values: 'To Do', 'In Progress', 'Done'",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "owner",
            "in": "query",
            "required": false,
            "description": "Filter items by owner name (for getItems)",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "label",
            "in": "query",
            "required": false,
            "description": "Filter items by label (for getItems)",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "board_id",
            "in": "query",
            "required": false,
            "description": "Filter items by board UUID (for getItems)",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "roots_only",
            "in": "query",
            "required": false,
            "description": "If 'true', only return items without a parent (for getItems)",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "id",
            "in": "query",
            "required": false,
            "description": "Item UUID (for getItem)",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "payload",
            "in": "query",
            "required": false,
            "description": "JSON string for write operations. For createItem: {\"data\":{\"title\":\"...\",\"owner\":\"...\",\"status\":\"...\",\"due_date\":\"...\",\"labels\":\"...\",\"description\":\"...\",\"board_id\":\"...\"},\"actor\":\"ChatGPT\"}. For updateItem: {\"id\":\"uuid\",\"changes\":{\"status\":\"Done\",...},\"actor\":\"ChatGPT\"}. For deleteItem: {\"id\":\"uuid\",\"actor\":\"ChatGPT\"}. For createLabel: {\"label\":\"name\",\"color\":\"#hex\"}.",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "API response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean"
                    },
                    "data": {
                      "description": "Response data (items array, single item, owners, labels, or boards)"
                    },
                    "error": {
                      "type": "string",
                      "description": "Error message when success is false"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Testing Checklist

After creating the GPT, test these commands:

| Say this | Expected API call | Verify in sheet |
|----------|------------------|-----------------|
| "What's on my to do list?" | `getItems?status=To+Do` | — |
| "Add pick up bananas, due today" | `createItem` with title, due_date, owner | New row in Items tab |
| "Mark bananas as done" | `getItems` → find match → `updateItem` status=Done | Status + Completed At updated |
| "Assign science fair to Alice" | `getItems` → find match → `updateItem` owner=Alice | Owner updated |
| "What's overdue?" | `getItems` → filter by due_date < today | — |

---

## Troubleshooting

**"I couldn't connect to the server"**
- Check that the deployment URL is correct (test it in a browser: append `?action=getOwners&key=YOUR_KEY`)
- Make sure the Apps Script is deployed as "Anyone" (not "Anyone with a Google account")

**"Invalid or missing API key"**
- Verify the API key in the Action settings matches the one in Apps Script > Project Settings > Script Properties

**"Unknown action"**
- The action parameter is case-sensitive: `getItems` not `GetItems`

**Actions require confirmation every time**
- This is normal for new GPTs. ChatGPT asks you to confirm API calls. After a few uses it may stop asking, or you can toggle "Always allow" in the GPT settings.

**Apps Script redirect issues**
- If calls fail, the deployment URL may have changed. Re-deploy in the Apps Script editor and update the URL in the OpenAPI schema.
