// Google Sheets REST API wrapper using direct fetch.
// No gapi.client dependency — smaller, more control.

import type { Item, ItemWithRow, Owner, Label } from './types';

const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID;
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

class SheetsApiError extends Error {
  constructor(public status: number, message: string) {
    super(`Sheets API ${status}: ${message}`);
    this.name = 'SheetsApiError';
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
    scheduled_date: row[6] || '',
    labels: row[7] || '',
    parent_id: row[8] || '',
    created_at: row[9] || '',
    updated_at: row[10] || '',
    completed_at: row[11] || '',
    sort_order: Number(row[12]) || 0,
  };
}

function itemToRow(item: Item): any[] {
  return [
    item.id, item.title, item.description, item.status,
    item.owner, item.due_date, item.scheduled_date, item.labels,
    item.parent_id, item.created_at, item.updated_at, item.completed_at,
    item.sort_order,
  ];
}

// --- Public API ---

export async function fetchAllItems(token: string): Promise<ItemWithRow[]> {
  const rows = await sheetsGet('Items!A2:M', token);
  return rows.map((row, i) => ({
    ...rowToItem(row),
    sheetRow: i + 2, // 1-based, header is row 1
  }));
}

export async function fetchOwners(token: string): Promise<Owner[]> {
  const rows = await sheetsGet('Owners!A2:B', token);
  return rows.map(row => ({
    name: row[0] || '',
    google_account: row[1] || '',
  }));
}

export async function fetchLabels(token: string): Promise<Label[]> {
  const rows = await sheetsGet('Labels!A2:B', token);
  return rows.map(row => ({
    label: row[0] || '',
    color: row[1] || '',
  }));
}

export async function createItemRow(item: Item, token: string): Promise<void> {
  await sheetsAppend('Items!A:M', [itemToRow(item)], token);
}

export async function updateItemRow(sheetRow: number, item: Item, token: string): Promise<void> {
  await sheetsUpdate(`Items!A${sheetRow}:M${sheetRow}`, [itemToRow(item)], token);
}

export async function deleteItemRow(sheetRow: number, token: string): Promise<void> {
  // Get the Items sheet ID (gid). We need it for batchUpdate.
  const url = `${BASE}/${SPREADSHEET_ID}?fields=sheets.properties`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const itemsSheet = data.sheets?.find(
    (s: any) => s.properties.title === 'Items'
  );
  const sheetId = itemsSheet?.properties?.sheetId ?? 0;
  await sheetsDeleteRow(sheetId, sheetRow, token);
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
  const rows = await sheetsGet('Owners!A2:B', token);

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
    await sheetsUpdate(`Owners!A${sheetRow}:B${sheetRow}`, [[name, email]], token);
    return true;
  }

  // Email not found — append new row
  await sheetsAppend('Owners!A:B', [[name, email]], token);
  return true;
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
  await sheetsAppend('Audit Log!A:G', [[
    new Date().toISOString(), itemId, action, field, oldValue, newValue, actor,
  ]], token);
}

export { SheetsApiError };
