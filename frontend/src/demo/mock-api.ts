// Mock API layer for demo mode.
// Mirrors the function signatures of ../api/sheets.ts but operates
// entirely in-memory using @preact/signals. No HTTP requests are made.

import { signal } from '@preact/signals';
import type { Item, ItemWithRow, Owner, Label, Board } from '../api/types';
import { MOCK_ITEMS, MOCK_OWNERS, MOCK_LABELS, MOCK_BOARDS } from './mock-data';

// In-memory state — deep-clone from static data so writes don't mutate the originals.
const mockItemsState = signal<ItemWithRow[]>(structuredClone(MOCK_ITEMS));
const mockLabelsState = signal<Array<Label & { sheetRow: number }>>(
  structuredClone(MOCK_LABELS).map((l, i) => ({ ...l, sheetRow: i + 2 }))
);
const mockBoardsState = signal<Board[]>(structuredClone(MOCK_BOARDS));

/** Reset in-memory state back to the original mock data (for page refresh behavior). */
export function resetMockState(): void {
  mockItemsState.value = structuredClone(MOCK_ITEMS);
  mockLabelsState.value = structuredClone(MOCK_LABELS).map((l, i) => ({ ...l, sheetRow: i + 2 }));
  mockBoardsState.value = structuredClone(MOCK_BOARDS);
}

// --- Read operations ---

export async function fetchAllItems(_token: string): Promise<ItemWithRow[]> {
  return mockItemsState.value;
}

export async function fetchOwners(_token: string): Promise<Owner[]> {
  return MOCK_OWNERS;
}

export async function fetchLabels(_token: string): Promise<Label[]> {
  return mockLabelsState.value.map(({ label, color }) => ({ label, color }));
}

// --- Write operations (in-memory only) ---

export async function createItemRow(item: Item, _token: string): Promise<void> {
  const maxRow = mockItemsState.value.reduce((max, i) => Math.max(max, i.sheetRow), 1);
  const newItem: ItemWithRow = { ...item, sheetRow: maxRow + 1 };
  mockItemsState.value = [...mockItemsState.value, newItem];
}

export async function updateItemRow(sheetRow: number, item: Item, _token: string): Promise<void> {
  mockItemsState.value = mockItemsState.value.map(i =>
    i.sheetRow === sheetRow ? { ...item, sheetRow } : i
  );
}

export async function deleteItemRow(sheetRow: number, _token: string): Promise<void> {
  mockItemsState.value = mockItemsState.value.filter(i => i.sheetRow !== sheetRow);
}

export async function appendAuditEntry(
  _itemId: string,
  _action: string,
  _field: string,
  _oldValue: string,
  _newValue: string,
  _actor: string,
  _token: string
): Promise<void> {
  // No-op in demo mode — audit log is not displayed in the UI.
}

export async function upsertOwner(
  name: string,
  _email: string,
  _token: string
): Promise<boolean> {
  // In demo mode, just return true to signal success.
  return true;
}

export async function cascadeOwnerUpdate(
  oldName: string,
  newName: string,
  _token: string
): Promise<void> {
  mockItemsState.value = mockItemsState.value.map(item => {
    if (item.owner !== oldName) return item;
    return { ...item, owner: newName };
  });
}

// --- Label CRUD (in-memory) ---

export async function createLabelRow(label: string, color: string, _token: string): Promise<void> {
  const maxRow = mockLabelsState.value.reduce((max, l) => Math.max(max, l.sheetRow), 1);
  mockLabelsState.value = [...mockLabelsState.value, { label, color, sheetRow: maxRow + 1 }];
}

export async function updateLabelRow(sheetRow: number, label: string, color: string, _token: string): Promise<void> {
  mockLabelsState.value = mockLabelsState.value.map(l =>
    l.sheetRow === sheetRow ? { label, color, sheetRow } : l
  );
}

export async function deleteLabelRow(sheetRow: number, _token: string): Promise<void> {
  mockLabelsState.value = mockLabelsState.value.filter(l => l.sheetRow !== sheetRow);
}

export async function fetchLabelsWithRows(_token: string): Promise<Array<{ label: string; color: string; sheetRow: number }>> {
  return mockLabelsState.value;
}

export async function cascadeLabelUpdate(
  oldName: string,
  newName: string,
  _token: string
): Promise<void> {
  // Update items in-memory: rename or remove the label from all items that reference it.
  mockItemsState.value = mockItemsState.value.map(item => {
    const labelsList = item.labels.split(',').map(l => l.trim()).filter(Boolean);
    if (!labelsList.includes(oldName)) return item;

    let updated: string[];
    if (newName) {
      updated = labelsList.map(l => l === oldName ? newName : l);
    } else {
      updated = labelsList.filter(l => l !== oldName);
    }
    return { ...item, labels: updated.join(', ') };
  });
}

// --- Board operations (in-memory) ---

export async function fetchBoards(_token: string): Promise<Board[]> {
  return mockBoardsState.value;
}

export async function createBoardRow(board: Board, _token: string): Promise<void> {
  mockBoardsState.value = [...mockBoardsState.value, board];
}
