#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.HIVE_API_URL;
const API_KEY = process.env.HIVE_API_KEY;
const DEFAULT_OWNER = process.env.HIVE_DEFAULT_OWNER || "";

if (!API_URL) {
  console.error("HIVE_API_URL environment variable is required");
  process.exit(1);
}
if (!API_KEY) {
  console.error("HIVE_API_KEY environment variable is required");
  process.exit(1);
}

// --- API helpers ---

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  url.searchParams.set("key", API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { redirect: "follow" });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiWrite(action, payload) {
  const url = new URL(API_URL);
  // Apps Script redirects break POST for anonymous callers,
  // so write operations use GET with a URL-encoded payload param.
  const params = new URLSearchParams();
  params.set("action", action);
  params.set("key", API_KEY);
  params.set("payload", JSON.stringify(payload));
  const fullUrl = `${url.origin}${url.pathname}?${params.toString()}`;
  const res = await fetch(fullUrl, { redirect: "follow" });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function resolveBoard(boardName) {
  const result = await apiGet("getBoards");
  if (!result.success) throw new Error(result.error || "Failed to fetch boards");
  const boards = result.data;
  if (!boards.length) throw new Error("No boards found. Create a board in the Hive app first.");

  const lower = boardName.toLowerCase();
  const match = boards.find((b) => b.name.toLowerCase() === lower);
  if (match) return match;

  // Fuzzy: check if board name is contained in any board name
  const partial = boards.find((b) => b.name.toLowerCase().includes(lower));
  if (partial) return partial;

  const names = boards.map((b) => b.name).join(", ");
  throw new Error(`Board "${boardName}" not found. Available boards: ${names}`);
}

// --- Position helpers ---

async function resolvePosition(boardId, status, position) {
  if (position === undefined) return undefined;

  const result = await apiGet("getItems", { board_id: boardId, status });
  const items = result.success ? result.data : [];
  items.sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity));

  if (position === "top") return items.length ? (items[0].sort_order ?? 1) - 1 : 1;
  if (position === "bottom" || position === undefined) return items.length ? (items[items.length - 1].sort_order ?? 1) + 1 : 1;

  // Numeric index (1-based): insert at that position
  const idx = Math.max(1, Math.min(Number(position), items.length + 1));
  if (idx === 1) return items.length ? (items[0].sort_order ?? 1) - 1 : 1;
  if (idx > items.length) return (items[items.length - 1].sort_order ?? 1) + 1;
  // Place between idx-1 and idx
  const before = items[idx - 2].sort_order ?? idx - 1;
  const after = items[idx - 1].sort_order ?? idx;
  return (before + after) / 2;
}

// --- MCP Server ---

const server = new McpServer({
  name: "hive",
  version: "1.0.0",
});

server.tool(
  "hive_list_boards",
  "List all Hive kanban boards",
  {},
  async () => {
    const result = await apiGet("getBoards");
    if (!result.success) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    const boards = result.data;
    if (!boards.length) return { content: [{ type: "text", text: "No boards found." }] };
    const text = boards
      .map((b) => `- **${b.name}** (id: ${b.id}${b.color ? `, color: ${b.color}` : ""})`)
      .join("\n");
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "hive_list_owners",
  "List valid owners for Hive board items",
  {},
  async () => {
    const result = await apiGet("getOwners");
    if (!result.success) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    const text = result.data.map((o) => `- ${o.name} (${o.google_account})`).join("\n");
    return { content: [{ type: "text", text: text || "No owners found." }] };
  }
);

server.tool(
  "hive_list_labels",
  "List valid labels for Hive board items",
  {},
  async () => {
    const result = await apiGet("getLabels");
    if (!result.success) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    const text = result.data.map((l) => `- ${l.label}${l.color ? ` (${l.color})` : ""}`).join("\n");
    return { content: [{ type: "text", text: text || "No labels found." }] };
  }
);

server.tool(
  "hive_list_items",
  "List items on a Hive kanban board, optionally filtered by status",
  {
    board: z.string().describe("Board name (e.g., 'Work', 'Family')"),
    status: z
      .enum(["To Do", "In Progress", "Done"])
      .optional()
      .describe("Filter by status"),
  },
  async ({ board, status }) => {
    const resolved = await resolveBoard(board);
    const params = { board_id: resolved.id };
    if (status) params.status = status;
    const result = await apiGet("getItems", params);
    if (!result.success) return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    const items = result.data;
    if (!items.length)
      return {
        content: [{ type: "text", text: `No items found on "${resolved.name}"${status ? ` with status "${status}"` : ""}.` }],
      };
    const text = items
      .map((i) => {
        const parts = [`- [${i.status}] **${i.title}** (id: ${i.id})`];
        if (i.owner) parts.push(`(${i.owner})`);
        if (i.due_date) parts.push(`due: ${i.due_date}`);
        if (i.labels) parts.push(`labels: ${i.labels}`);
        return parts.join(" ");
      })
      .join("\n");
    return { content: [{ type: "text", text: `**${resolved.name}** board:\n${text}` }] };
  }
);

server.tool(
  "hive_add_item",
  "Add a new item to a Hive kanban board. Status defaults to 'To Do'.",
  {
    board: z.string().describe("Board name (e.g., 'Work', 'Family')"),
    title: z.string().describe("Item title"),
    description: z.string().optional().describe("Item description"),
    owner: z.string().optional().describe("Owner name (must match an existing owner)"),
    due_date: z.string().optional().describe("Due date in ISO format (YYYY-MM-DD)"),
    labels: z.string().optional().describe("Comma-separated labels"),
    status: z
      .enum(["To Do", "In Progress", "Done"])
      .optional()
      .describe("Status (defaults to 'To Do')"),
    parent_id: z.string().optional().describe("ID of parent item (for creating sub-tasks)"),
    position: z
      .union([z.enum(["top", "bottom"]), z.coerce.number()])
      .optional()
      .describe("Position in column: 'top', 'bottom', or a 1-based index (default: bottom)"),
  },
  async ({ board, title, description, owner, due_date, labels, status, parent_id, position }) => {
    const resolved = await resolveBoard(board);
    const itemOwner = owner || DEFAULT_OWNER;
    const itemStatus = status || "To Do";
    const sort_order = await resolvePosition(resolved.id, itemStatus, position);

    const payload = {
      data: {
        title,
        description: description || "",
        owner: itemOwner,
        due_date: due_date || "",
        labels: labels || "",
        board_id: resolved.id,
        status: itemStatus,
        parent_id: parent_id || "",
        ...(sort_order !== undefined && { sort_order }),
      },
      actor: "hive-mcp",
    };

    const result = await apiWrite("createItem", payload);
    if (!result.success)
      return { content: [{ type: "text", text: `Error creating item: ${result.error}` }] };

    const item = result.data;
    const parts = [`Added to **${resolved.name}** board:`, `- **${item.title}**`];
    parts.push(`- Status: ${item.status}`);
    if (item.owner) parts.push(`- Owner: ${item.owner}`);
    if (item.due_date) parts.push(`- Due: ${item.due_date}`);
    if (item.labels) parts.push(`- Labels: ${item.labels}`);
    parts.push(`- ID: ${item.id}`);
    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

server.tool(
  "hive_update_item",
  "Update an existing item on a Hive kanban board. Only provide fields you want to change.",
  {
    item_id: z.string().describe("ID of the item to update"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["To Do", "In Progress", "Done"])
      .optional()
      .describe("New status"),
    owner: z.string().optional().describe("New owner name"),
    due_date: z.string().optional().describe("New due date in ISO format (YYYY-MM-DD)"),
    labels: z.string().optional().describe("New comma-separated labels (replaces existing)"),
    parent_id: z.string().optional().describe("New parent item ID"),
    position: z
      .union([z.enum(["top", "bottom"]), z.coerce.number()])
      .optional()
      .describe("Position in column: 'top', 'bottom', or a 1-based index"),
  },
  async ({ item_id, title, description, status, owner, due_date, labels, parent_id, position }) => {
    const changes = {};
    if (title !== undefined) changes.title = title;
    if (description !== undefined) changes.description = description;
    if (status !== undefined) changes.status = status;
    if (owner !== undefined) changes.owner = owner;
    if (due_date !== undefined) changes.due_date = due_date;
    if (labels !== undefined) changes.labels = labels;
    if (parent_id !== undefined) changes.parent_id = parent_id;

    // Resolve position — need board_id from the existing item if changing position
    if (position !== undefined) {
      // Fetch current item to get board_id and status
      const itemResult = await apiGet("getItems", {});
      const allItems = itemResult.success ? itemResult.data : [];
      const current = allItems.find((i) => i.id === item_id);
      if (current) {
        const targetStatus = status || current.status;
        const sort_order = await resolvePosition(current.board_id, targetStatus, position);
        if (sort_order !== undefined) changes.sort_order = sort_order;
      }
    }

    if (Object.keys(changes).length === 0) {
      return { content: [{ type: "text", text: "No changes provided." }] };
    }

    const payload = { id: item_id, changes, actor: "hive-mcp" };
    const result = await apiWrite("updateItem", payload);
    if (!result.success)
      return { content: [{ type: "text", text: `Error updating item: ${result.error}` }] };

    const item = result.data;
    const parts = [`Updated **${item.title}**:`];
    parts.push(`- Status: ${item.status}`);
    if (item.owner) parts.push(`- Owner: ${item.owner}`);
    if (item.due_date) parts.push(`- Due: ${item.due_date}`);
    if (item.labels) parts.push(`- Labels: ${item.labels}`);
    parts.push(`- ID: ${item.id}`);
    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
