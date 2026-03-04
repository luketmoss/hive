// Mock API layer for demo mode.
// Mirrors the function signatures of ../api/sheets.ts but operates
// entirely in-memory using @preact/signals. No HTTP requests are made.

import { signal } from '@preact/signals';
import type { Item, ItemWithRow, Owner, Label } from '../api/types';
import { MOCK_ITEMS, MOCK_OWNERS, MOCK_LABELS } from './mock-data';

// In-memory state — deep-clone from static data so writes don't mutate the originals.
const mockItemsState = signal<ItemWithRow[]>(structuredClone(MOCK_ITEMS));

/** Reset in-memory state back to the original mock data (for page refresh behavior). */
export function resetMockState(): void {
  mockItemsState.value = structuredClone(MOCK_ITEMS);
}

// --- Read operations ---

export async function fetchAllItems(_token: string): Promise<ItemWithRow[]> {
  return mockItemsState.value;
}

export async function fetchOwners(_token: string): Promise<Owner[]> {
  return MOCK_OWNERS;
}

export async function fetchLabels(_token: string): Promise<Label[]> {
  return MOCK_LABELS;
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
  _name: string,
  _email: string,
  _token: string
): Promise<boolean> {
  // No-op in demo mode — mock data already has owners.
  return false;
}
