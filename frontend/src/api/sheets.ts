// Google Sheets REST API wrapper using direct fetch.
// No gapi.client dependency — smaller, more control.

import type { Item, ItemWithRow, Owner, Label, Board, BoardPermission } from './types';
import { attemptReauth } from '../auth/reauth';

const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

class SheetsApiError extends Error {
  constructor(public status: number, message: string) {
    super(`Sheets API ${status}: ${message}`);
    this.name = 'SheetsApiError';
  }
}

/**
 * Wrap a Sheets API call with 401 retry logic.
 * On 401: attempt silent re-auth, then retry once with the new token.
 * The `callFn` receives a token and performs the actual API call.
 */
async function withReauth<T>(token: string, callFn: (t: string) => Promise<T>): Promise<T> {
  try {
    return await callFn(token);
  } catch (err) {
    if (err instanceof SheetsApiError && err.status === 401) {
      // Attempt silent re-auth and retry once
      const newToken = await attemptReauth();
      return callFn(newToken);
    }
    throw err;
  }
}

async function sheetsGet(range: string, token: string): Promise<any[][]> {
  const url = `${BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new SheetsApiError(401, 'Token expired');
  if (!res.ok) throw new SheetsApiError(res.status, await res.text());
  const data = await res.json();
  return data.values || [];
}

async function sheetsUpdate(range: string, values: any[][], token: string): Promise<void> {
  const url = `${BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  if (res.status === 401) throw new SheetsApiError(401, 'Token expired');
  if (!res.ok) throw new SheetsApiError(res.status, await res.text());
}

async function sheetsAppend(range: string, values: any[][], token: string): Promise<void> {
  const url = `${BASE}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  if (res.status === 401) throw new SheetsApiError(401, 'Token expired');
  if (!res.ok) throw new SheetsApiError(res.status, await res.text());
}

async function sheetsDeleteRow(sheetId: number, rowIndex: number, token: string): Promise<void> {
  const url = `${BASE}/${SPREADSHEET_ID}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-based
            endIndex: rowIndex,
          },
        },
      }],
    }),
  });
  if (res.status === 401) throw new SheetsApiError(401, 'Token expired');
  if (!res.ok) throw new SheetsApiError(res.status, await res.text());
}

// --- Column mapping ---

function rowToItem(row: any[]): Item {
  return {
    id: row[0] || '',
    title: row[1] || '',
    description: row[2] || '',
    status: (row[3] || 'To Do') as Item['status'],
    owner: row[4] || '',
    due_date: row[5] || '',
    labels: row[6] || '',
    parent_id: row[7] || '',
    created_at: row[8] || '',
    updated_at: row[9] || '',
    completed_at: row[10] || '',
    sort_order: Number(row[11]) || 0,
    created_by: row[12] || '',
    board_id: row[13] || '',
  };
}

function itemToRow(item: Item): any[] {
  return [
    item.id, item.title, item.description, item.status,
    item.owner, item.due_date, item.labels,
    item.parent_id, item.created_at, item.updated_at, item.completed_at,
    item.sort_order, item.created_by, item.board_id,
  ];
}

// --- Public API ---

export async function fetchAllItems(token: string): Promise<ItemWithRow[]> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Items!A2:N', t);
    return rows.map((row, i) => ({
      ...rowToItem(row),
      sheetRow: i + 2, // 1-based, header is row 1
    }));
  });
}

export async function fetchOwners(token: string): Promise<Owner[]> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Owners!A2:B', t);
    return rows.map(row => ({
      name: row[0] || '',
      google_account: row[1] || '',
    }));
  });
}

export async function fetchLabels(token: string): Promise<Label[]> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Labels!A2:C', t);
    return rows.map(row => ({
      label: row[0] || '',
      color: row[1] || '',
      board_id: row[2] || '',
    }));
  });
}

export async function createItemRow(item: Item, token: string): Promise<void> {
  return withReauth(token, (t) => sheetsAppend('Items!A:N', [itemToRow(item)], t));
}

export async function updateItemRow(sheetRow: number, item: Item, token: string): Promise<void> {
  return withReauth(token, (t) => sheetsUpdate(`Items!A${sheetRow}:N${sheetRow}`, [itemToRow(item)], t));
}

export async function deleteItemRow(sheetRow: number, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    // Get the Items sheet ID (gid). We need it for batchUpdate.
    const url = `${BASE}/${SPREADSHEET_ID}?fields=sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = await res.json();
    const itemsSheet = data.sheets?.find(
      (s: any) => s.properties.title === 'Items'
    );
    const sheetId = itemsSheet?.properties?.sheetId ?? 0;
    await sheetsDeleteRow(sheetId, sheetRow, t);
  });
}

/**
 * Upsert an owner row in the Owners sheet.
 * - If the email already exists and the name matches, does nothing (returns false).
 * - If the email exists but the name differs, updates the name (returns true).
 * - If the email is not found, appends a new row (returns true).
 * Returns true if a write occurred (caller should re-fetch owners).
 */
export async function upsertOwner(
  name: string,
  email: string,
  token: string
): Promise<boolean> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Owners!A2:B', t);

    // Find existing row by email (column B)
    const existingIndex = rows.findIndex(
      row => (row[1] || '').toLowerCase() === email.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Email already exists — check if name needs updating
      const existingName = rows[existingIndex][0] || '';
      if (existingName === name) {
        return false; // No change needed
      }
      // Update the name in the existing row (row index + 2 because header is row 1, data starts at row 2)
      const sheetRow = existingIndex + 2;
      await sheetsUpdate(`Owners!A${sheetRow}:B${sheetRow}`, [[name, email]], t);
      return true;
    }

    // Email not found — append new row
    await sheetsAppend('Owners!A:B', [[name, email]], t);
    return true;
  });
}

export async function appendAuditEntry(
  itemId: string,
  action: string,
  field: string,
  oldValue: string,
  newValue: string,
  actor: string,
  token: string
): Promise<void> {
  return withReauth(token, (t) => sheetsAppend('Audit Log!A:G', [[
    new Date().toISOString(), itemId, action, field, oldValue, newValue, actor,
  ]], t));
}

// --- Label CRUD ---

export async function createLabelRow(label: string, color: string, boardId: string, token: string): Promise<void> {
  return withReauth(token, (t) => sheetsAppend('Labels!A:C', [[label, color, boardId]], t));
}

export async function updateLabelRow(sheetRow: number, label: string, color: string, boardId: string, token: string): Promise<void> {
  return withReauth(token, (t) => sheetsUpdate(`Labels!A${sheetRow}:C${sheetRow}`, [[label, color, boardId]], t));
}

export async function deleteLabelRow(sheetRow: number, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    // Get the Labels sheet ID (gid) for batchUpdate row deletion.
    const url = `${BASE}/${SPREADSHEET_ID}?fields=sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = await res.json();
    const labelsSheet = data.sheets?.find(
      (s: any) => s.properties.title === 'Labels'
    );
    const sheetId = labelsSheet?.properties?.sheetId ?? 0;
    await sheetsDeleteRow(sheetId, sheetRow, t);
  });
}

/**
 * Fetch labels with their sheet row numbers for update/delete operations.
 */
export async function fetchLabelsWithRows(token: string): Promise<Array<{ label: string; color: string; board_id: string; sheetRow: number }>> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Labels!A2:C', t);
    return rows.map((row, i) => ({
      label: row[0] || '',
      color: row[1] || '',
      board_id: row[2] || '',
      sheetRow: i + 2, // 1-based, header is row 1
    }));
  });
}

/**
 * Cascade rename or remove a label from all Items that reference it.
 * Scans the labels column (H) in Items, replacing `oldName` with `newName`
 * (or removing it entirely if `newName` is empty).
 */
export async function cascadeLabelUpdate(
  oldName: string,
  newName: string,
  token: string,
  boardId?: string
): Promise<void> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Items!A2:N', t);
    for (let i = 0; i < rows.length; i++) {
      // Scope to board if provided
      if (boardId && (rows[i][13] || '') !== boardId) continue;

      const labelsStr = rows[i][6] || '';
      const labelsList = labelsStr.split(',').map((l: string) => l.trim()).filter(Boolean);
      if (!labelsList.includes(oldName)) continue;

      let updated: string[];
      if (newName) {
        updated = labelsList.map((l: string) => l === oldName ? newName : l);
      } else {
        updated = labelsList.filter((l: string) => l !== oldName);
      }
      const newLabelsStr = updated.join(', ');
      if (newLabelsStr !== labelsStr) {
        const sheetRow = i + 2;
        // Update only the labels column (G = column 7)
        await sheetsUpdate(`Items!G${sheetRow}`, [[newLabelsStr]], t);
      }
    }
  });
}

/**
 * Cascade rename an owner across all Items that reference the old name.
 * Updates the owner column (E) for each matching row.
 */
export async function cascadeOwnerUpdate(
  oldName: string,
  newName: string,
  token: string
): Promise<void> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Items!A2:N', t);
    for (let i = 0; i < rows.length; i++) {
      const owner = rows[i][4] || '';
      if (owner !== oldName) continue;
      const sheetRow = i + 2;
      // Update only the owner column (E = column 5)
      await sheetsUpdate(`Items!E${sheetRow}`, [[newName]], t);
    }
  });
}

// --- Board operations ---

export async function fetchBoards(token: string): Promise<Board[]> {
  try {
    return await withReauth(token, async (t) => {
      const rows = await sheetsGet('Boards!A2:F', t);
      return rows.map(row => ({
        id: row[0] || '',
        name: row[1] || '',
        created_at: row[2] || '',
        created_by: row[3] || '',
        icon: row[5] || '',
      }));
    });
  } catch (err) {
    // Boards tab may not exist yet — return empty array so the app works without it
    if (err instanceof SheetsApiError && err.status === 400) return [];
    throw err;
  }
}

/** Create the Boards tab with a header row if it doesn't exist yet. */
async function ensureBoardsTab(token: string): Promise<void> {
  const url = `${BASE}/${SPREADSHEET_ID}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: 'Boards' } } }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    // If the tab already exists, that's fine — ignore the error
    if (text.includes('already exists')) return;
    throw new SheetsApiError(res.status, text);
  }
  // Add header row
  await sheetsUpdate('Boards!A1:F1', [['ID', 'Name', 'Created At', 'Created By', 'Color', 'Icon']], token);
}

export async function createBoardRow(board: Board, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    try {
      await sheetsAppend('Boards!A:F', [[
        board.id, board.name, board.created_at, board.created_by,
        '', board.icon || '',
      ]], t);
    } catch (err) {
      // If Boards tab doesn't exist, create it and retry
      if (err instanceof SheetsApiError && err.status === 400) {
        await ensureBoardsTab(t);
        await sheetsAppend('Boards!A:F', [[
          board.id, board.name, board.created_at, board.created_by,
          '', board.icon || '',
        ]], t);
        return;
      }
      throw err;
    }
  });
}

/**
 * Update the color and icon for an existing board.
 * Finds the board row by ID, then writes only columns E and F.
 */
export async function updateBoardRow(boardId: string, color: string, icon: string, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Boards!A2:A', t);
    const rowIndex = rows.findIndex(row => (row[0] || '') === boardId);
    if (rowIndex < 0) return; // Board not found — no-op
    const sheetRow = rowIndex + 2; // 1-based + header
    await sheetsUpdate(`Boards!E${sheetRow}:F${sheetRow}`, [[color, icon]], t);
  });
}

/**
 * Update the name for an existing board.
 * Finds the board row by ID, then writes only column B.
 */
export async function renameBoardRow(boardId: string, name: string, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    const rows = await sheetsGet('Boards!A2:A', t);
    const rowIndex = rows.findIndex(row => (row[0] || '') === boardId);
    if (rowIndex < 0) return; // Board not found — no-op
    const sheetRow = rowIndex + 2; // 1-based + header
    await sheetsUpdate(`Boards!B${sheetRow}`, [[name]], t);
  });
}

// --- Permissions operations ---

export async function fetchPermissions(token: string): Promise<BoardPermission[]> {
  try {
    return await withReauth(token, async (t) => {
      const rows = await sheetsGet('Permissions!A2:C', t);
      return rows.map(row => ({
        board_id: row[0] || '',
        user_email: row[1] || '',
        role: (row[2] || 'member') as BoardPermission['role'],
      }));
    });
  } catch (err) {
    // Permissions tab may not exist yet — return empty so the app works without it
    if (err instanceof SheetsApiError && err.status === 400) return [];
    throw err;
  }
}

/** Create the Permissions tab with a header row if it doesn't exist yet. */
async function ensurePermissionsTab(token: string): Promise<void> {
  const url = `${BASE}/${SPREADSHEET_ID}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: 'Permissions' } } }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes('already exists')) return;
    throw new SheetsApiError(res.status, text);
  }
  await sheetsUpdate('Permissions!A1:C1', [['Board ID', 'User Email', 'Role']], token);
}

export async function createPermissionRow(perm: BoardPermission, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    try {
      await sheetsAppend('Permissions!A:C', [[perm.board_id, perm.user_email, perm.role]], t);
    } catch (err) {
      if (err instanceof SheetsApiError && err.status === 400) {
        await ensurePermissionsTab(t);
        await sheetsAppend('Permissions!A:C', [[perm.board_id, perm.user_email, perm.role]], t);
        return;
      }
      throw err;
    }
  });
}

export async function deletePermissionRow(boardId: string, userEmail: string, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    // Find the row to delete
    const rows = await sheetsGet('Permissions!A2:C', t);
    const rowIndex = rows.findIndex(
      row => row[0] === boardId && (row[1] || '').toLowerCase() === userEmail.toLowerCase()
    );
    if (rowIndex < 0) return;

    // Get Permissions sheet ID
    const url = `${BASE}/${SPREADSHEET_ID}?fields=sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = await res.json();
    const permSheet = data.sheets?.find(
      (s: any) => s.properties.title === 'Permissions'
    );
    const sheetId = permSheet?.properties?.sheetId ?? 0;
    await sheetsDeleteRow(sheetId, rowIndex + 2, t); // +2: 1-based + header
  });
}

export async function deleteBoardRow(boardId: string, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    // Find the board row by ID
    const rows = await sheetsGet('Boards!A2:A', t);
    const rowIndex = rows.findIndex(row => (row[0] || '') === boardId);
    if (rowIndex < 0) return;

    // Get Boards sheet ID
    const url = `${BASE}/${SPREADSHEET_ID}?fields=sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = await res.json();
    const boardsSheet = data.sheets?.find(
      (s: any) => s.properties.title === 'Boards'
    );
    const sheetId = boardsSheet?.properties?.sheetId ?? 0;
    await sheetsDeleteRow(sheetId, rowIndex + 2, t); // +2: 1-based + header
  });
}

export async function deleteAllBoardPermissions(boardId: string, token: string): Promise<void> {
  return withReauth(token, async (t) => {
    // Find all permission rows for this board (delete from bottom to top)
    const rows = await sheetsGet('Permissions!A2:C', t);
    const indices = rows
      .map((row, i) => (row[0] === boardId ? i : -1))
      .filter(i => i >= 0)
      .sort((a, b) => b - a); // bottom-to-top to avoid row shifting

    if (indices.length === 0) return;

    // Get Permissions sheet ID
    const url = `${BASE}/${SPREADSHEET_ID}?fields=sheets.properties`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = await res.json();
    const permSheet = data.sheets?.find(
      (s: any) => s.properties.title === 'Permissions'
    );
    const sheetId = permSheet?.properties?.sheetId ?? 0;

    for (const idx of indices) {
      await sheetsDeleteRow(sheetId, idx + 2, t); // +2: 1-based + header
    }
  });
}

export async function updateItemBoardId(sheetRow: number, newBoardId: string, token: string): Promise<void> {
  return withReauth(token, (t) =>
    sheetsUpdate(`Items!N${sheetRow}`, [[newBoardId]], t)
  );
}

export { SheetsApiError };
