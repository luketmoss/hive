import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchAllItems,
  fetchOwners,
  fetchLabels,
  createItemRow,
  updateItemRow,
  deleteItemRow,
  appendAuditEntry,
  resetMockState,
} from './mock-api';
import { MOCK_ITEMS, MOCK_OWNERS, MOCK_LABELS } from './mock-data';
import type { Item } from '../api/types';

// Scenario 5: Write operations work in-memory only

describe('Mock API layer (AC5)', () => {
  beforeEach(() => {
    resetMockState();
  });

  it('fetchAllItems returns mock items', async () => {
    const items = await fetchAllItems('demo-token');
    expect(items.length).toBe(MOCK_ITEMS.length);
    expect(items[0].id).toBe('demo-001');
  });

  it('fetchOwners returns mock owners', async () => {
    const owners = await fetchOwners('demo-token');
    expect(owners).toEqual(MOCK_OWNERS);
  });

  it('fetchLabels returns mock labels', async () => {
    const labels = await fetchLabels('demo-token');
    expect(labels).toEqual(MOCK_LABELS);
  });

  it('createItemRow adds an item in-memory', async () => {
    const before = await fetchAllItems('demo-token');
    const newItem: Item = {
      id: 'demo-new',
      title: 'New test item',
      description: '',
      status: 'To Do',
      owner: '',
      due_date: '',
      scheduled_date: '',
      labels: '',
      parent_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: '',
      sort_order: 100,
    };
    await createItemRow(newItem, 'demo-token');
    const after = await fetchAllItems('demo-token');
    expect(after.length).toBe(before.length + 1);
    expect(after.find(i => i.id === 'demo-new')).toBeTruthy();
  });

  it('updateItemRow modifies an item in-memory', async () => {
    const items = await fetchAllItems('demo-token');
    const item = items.find(i => i.id === 'demo-001')!;
    const updated: Item = { ...item, title: 'Updated title' };
    await updateItemRow(item.sheetRow, updated, 'demo-token');
    const after = await fetchAllItems('demo-token');
    const found = after.find(i => i.id === 'demo-001')!;
    expect(found.title).toBe('Updated title');
  });

  it('deleteItemRow removes an item in-memory', async () => {
    const items = await fetchAllItems('demo-token');
    const item = items.find(i => i.id === 'demo-001')!;
    await deleteItemRow(item.sheetRow, 'demo-token');
    const after = await fetchAllItems('demo-token');
    expect(after.find(i => i.id === 'demo-001')).toBeUndefined();
    expect(after.length).toBe(items.length - 1);
  });

  it('appendAuditEntry is a no-op (does not throw)', async () => {
    await expect(
      appendAuditEntry('demo-001', 'test', 'field', 'old', 'new', 'actor', 'demo-token')
    ).resolves.toBeUndefined();
  });

  it('resetMockState restores original data (simulates page refresh)', async () => {
    // Make a change
    const items = await fetchAllItems('demo-token');
    await deleteItemRow(items[0].sheetRow, 'demo-token');
    const afterDelete = await fetchAllItems('demo-token');
    expect(afterDelete.length).toBe(items.length - 1);

    // Reset
    resetMockState();
    const afterReset = await fetchAllItems('demo-token');
    expect(afterReset.length).toBe(MOCK_ITEMS.length);
    expect(afterReset[0].id).toBe('demo-001');
  });

  it('no HTTP requests are made (fetch is not called)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await fetchAllItems('demo-token');
    await fetchOwners('demo-token');
    await fetchLabels('demo-token');
    const newItem: Item = {
      id: 'test-http', title: 'Test', description: '', status: 'To Do',
      owner: '', due_date: '', scheduled_date: '', labels: '', parent_id: '',
      created_at: '', updated_at: '', completed_at: '', sort_order: 0,
    };
    await createItemRow(newItem, 'demo-token');
    await updateItemRow(2, newItem, 'demo-token');
    await deleteItemRow(2, 'demo-token');
    await appendAuditEntry('x', 'y', 'z', '', '', '', 'demo-token');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
