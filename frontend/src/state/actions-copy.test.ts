import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the sheets API module before importing actions
vi.mock('../api/sheets', () => ({
  fetchAllItems: vi.fn().mockResolvedValue([]),
  fetchOwners: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  createItemRow: vi.fn().mockResolvedValue(undefined),
  updateItemRow: vi.fn().mockResolvedValue(undefined),
  deleteItemRow: vi.fn().mockResolvedValue(undefined),
  appendAuditEntry: vi.fn().mockResolvedValue(undefined),
  createLabelRow: vi.fn().mockResolvedValue(undefined),
  updateLabelRow: vi.fn().mockResolvedValue(undefined),
  deleteLabelRow: vi.fn().mockResolvedValue(undefined),
  fetchLabelsWithRows: vi.fn().mockResolvedValue([]),
  cascadeLabelUpdate: vi.fn().mockResolvedValue(undefined),
  cascadeOwnerUpdate: vi.fn().mockResolvedValue(undefined),
  upsertOwner: vi.fn().mockResolvedValue(false),
  fetchBoards: vi.fn().mockResolvedValue([]),
  createBoardRow: vi.fn().mockResolvedValue(undefined),
  updateBoardRow: vi.fn().mockResolvedValue(undefined),
  renameBoardRow: vi.fn().mockResolvedValue(undefined),
  fetchPermissions: vi.fn().mockResolvedValue([]),
  createPermissionRow: vi.fn().mockResolvedValue(undefined),
  deletePermissionRow: vi.fn().mockResolvedValue(undefined),
  deleteBoardRow: vi.fn().mockResolvedValue(undefined),
  deleteAllBoardPermissions: vi.fn().mockResolvedValue(undefined),
  updateItemBoardId: vi.fn().mockResolvedValue(undefined),
  fetchStatuses: vi.fn().mockResolvedValue([]),
  createStatusRow: vi.fn().mockResolvedValue(undefined),
  updateStatusRow: vi.fn().mockResolvedValue(undefined),
  deleteStatusRow: vi.fn().mockResolvedValue(undefined),
  fetchStatusesWithRows: vi.fn().mockResolvedValue([]),
  cascadeStatusRename: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
}));

vi.mock('../demo/mock-api', () => ({
  fetchAllItems: vi.fn().mockResolvedValue([]),
  fetchOwners: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  createItemRow: vi.fn().mockResolvedValue(undefined),
  updateItemRow: vi.fn().mockResolvedValue(undefined),
  deleteItemRow: vi.fn().mockResolvedValue(undefined),
  appendAuditEntry: vi.fn().mockResolvedValue(undefined),
  createLabelRow: vi.fn().mockResolvedValue(undefined),
  updateLabelRow: vi.fn().mockResolvedValue(undefined),
  deleteLabelRow: vi.fn().mockResolvedValue(undefined),
  fetchLabelsWithRows: vi.fn().mockResolvedValue([]),
  cascadeLabelUpdate: vi.fn().mockResolvedValue(undefined),
  cascadeOwnerUpdate: vi.fn().mockResolvedValue(undefined),
  upsertOwner: vi.fn().mockResolvedValue(false),
  fetchBoards: vi.fn().mockResolvedValue([]),
  createBoardRow: vi.fn().mockResolvedValue(undefined),
  updateBoardRow: vi.fn().mockResolvedValue(undefined),
  renameBoardRow: vi.fn().mockResolvedValue(undefined),
  fetchPermissions: vi.fn().mockResolvedValue([]),
  createPermissionRow: vi.fn().mockResolvedValue(undefined),
  deletePermissionRow: vi.fn().mockResolvedValue(undefined),
  deleteBoardRow: vi.fn().mockResolvedValue(undefined),
  deleteAllBoardPermissions: vi.fn().mockResolvedValue(undefined),
  updateItemBoardId: vi.fn().mockResolvedValue(undefined),
  fetchStatuses: vi.fn().mockResolvedValue([]),
  createStatusRow: vi.fn().mockResolvedValue(undefined),
  updateStatusRow: vi.fn().mockResolvedValue(undefined),
  deleteStatusRow: vi.fn().mockResolvedValue(undefined),
  fetchStatusesWithRows: vi.fn().mockResolvedValue([]),
  cascadeStatusRename: vi.fn().mockResolvedValue(undefined),
}));

import { copyItem } from './actions';
import { items, toastMessage } from './board-store';
import * as sheetsApi from '../api/sheets';
import type { ItemWithRow } from '../api/types';

const mockCreateItemRow = vi.mocked(sheetsApi.createItemRow);
const mockAppendAuditEntry = vi.mocked(sheetsApi.appendAuditEntry);
const mockFetchAllItems = vi.mocked(sheetsApi.fetchAllItems);

function makeItem(overrides: Partial<ItemWithRow> = {}): ItemWithRow {
  return {
    id: 'item-1',
    title: 'Test Item',
    description: 'A test description',
    status: 'To Do',
    owner: 'Luke',
    due_date: '2026-05-01',
    labels: 'bug, urgent',
    parent_id: '',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    completed_at: '',
    sort_order: 1,
    created_by: 'Luke',
    board_id: 'board-1',
    sheetRow: 2,
    ...overrides,
  };
}

describe('copyItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    items.value = [];
    toastMessage.value = null;
    // By default, refreshItems returns whatever is currently in items.value
    // (simulates the API returning the persisted state after writes)
    mockFetchAllItems.mockImplementation(async () => items.value);
  });

  // AC2: Copying a task duplicates it with correct fields
  describe('AC2: Duplicates with correct fields', () => {
    it('creates a copy with "(Copy)" suffix in title', async () => {
      const original = makeItem();
      items.value = [original];
      const newId = await copyItem('item-1', 'Luke', 'token');

      expect(newId).toBeTruthy();
      const copy = items.value.find(i => i.id === newId);
      expect(copy).toBeDefined();
      expect(copy!.title).toBe('Test Item (Copy)');
    });

    it('copies description, labels, owner, due_date, status, and board_id', async () => {
      const original = makeItem();
      items.value = [original];
      const newId = await copyItem('item-1', 'Luke', 'token');

      const copy = items.value.find(i => i.id === newId);
      expect(copy!.description).toBe('A test description');
      expect(copy!.labels).toBe('bug, urgent');
      expect(copy!.owner).toBe('Luke');
      expect(copy!.due_date).toBe('2026-05-01');
      expect(copy!.status).toBe('To Do');
      expect(copy!.board_id).toBe('board-1');
    });

    it('assigns new UUID, sets created_by to actor', async () => {
      const original = makeItem();
      items.value = [original];
      const newId = await copyItem('item-1', 'Alice', 'token');

      expect(newId).not.toBe('item-1');
      const copy = items.value.find(i => i.id === newId);
      expect(copy!.created_by).toBe('Alice');
    });

    it('sets completed_at to empty regardless of original', async () => {
      const original = makeItem({ completed_at: '2025-06-01T00:00:00Z', status: 'Done' });
      items.value = [original];
      const newId = await copyItem('item-1', 'Luke', 'token');

      const copy = items.value.find(i => i.id === newId);
      expect(copy!.completed_at).toBe('');
    });

    it('sets parent_id to empty (copy is always root-level)', async () => {
      const original = makeItem();
      items.value = [original];
      const newId = await copyItem('item-1', 'Luke', 'token');

      const copy = items.value.find(i => i.id === newId);
      expect(copy!.parent_id).toBe('');
    });

    it('places copy after the original in sort order', async () => {
      const item1 = makeItem({ id: 'item-1', sort_order: 1 });
      const item2 = makeItem({ id: 'item-2', sort_order: 2, title: 'Item 2' });
      items.value = [item1, item2];
      const newId = await copyItem('item-1', 'Luke', 'token');

      const copy = items.value.find(i => i.id === newId);
      expect(copy!.sort_order).toBeGreaterThan(1);
      expect(copy!.sort_order).toBeLessThan(2);
    });
  });

  // AC3: Subtasks are copied with the new parent
  describe('AC3: Subtasks are copied', () => {
    it('duplicates all subtasks with new parent_id', async () => {
      const parent = makeItem({ id: 'parent-1', title: 'Parent' });
      const child1 = makeItem({
        id: 'child-1', title: 'Child 1', parent_id: 'parent-1',
        sort_order: 1, owner: 'Alice',
      });
      const child2 = makeItem({
        id: 'child-2', title: 'Child 2', parent_id: 'parent-1',
        sort_order: 2, owner: 'Bob',
      });
      items.value = [parent, child1, child2];
      const newId = await copyItem('parent-1', 'Luke', 'token');

      const copiedChildren = items.value.filter(i => i.parent_id === newId);
      expect(copiedChildren).toHaveLength(2);
      expect(copiedChildren[0].title).toBe('Child 1');
      expect(copiedChildren[1].title).toBe('Child 2');
    });

    it('gives subtasks new IDs and sets created_by to actor', async () => {
      const parent = makeItem({ id: 'parent-1', title: 'Parent' });
      const child = makeItem({
        id: 'child-1', title: 'Child', parent_id: 'parent-1',
        created_by: 'OldUser',
      });
      items.value = [parent, child];
      const newId = await copyItem('parent-1', 'NewUser', 'token');

      const copiedChildren = items.value.filter(i => i.parent_id === newId);
      expect(copiedChildren).toHaveLength(1);
      expect(copiedChildren[0].id).not.toBe('child-1');
      expect(copiedChildren[0].created_by).toBe('NewUser');
    });

    it('sets completed_at to empty on subtask copies', async () => {
      const parent = makeItem({ id: 'parent-1', title: 'Parent' });
      const child = makeItem({
        id: 'child-1', title: 'Child', parent_id: 'parent-1',
        completed_at: '2025-06-01T00:00:00Z',
      });
      items.value = [parent, child];
      const newId = await copyItem('parent-1', 'Luke', 'token');

      const copiedChildren = items.value.filter(i => i.parent_id === newId);
      expect(copiedChildren[0].completed_at).toBe('');
    });
  });

  // API calls
  describe('API interactions', () => {
    it('calls createItemRow for parent and each child', async () => {
      const parent = makeItem({ id: 'parent-1', title: 'Parent' });
      const child = makeItem({ id: 'child-1', title: 'Child', parent_id: 'parent-1' });
      items.value = [parent, child];

      await copyItem('parent-1', 'Luke', 'token');

      // 1 parent + 1 child = 2 createItemRow calls
      expect(mockCreateItemRow).toHaveBeenCalledTimes(2);
    });

    it('calls appendAuditEntry for each created item', async () => {
      const parent = makeItem({ id: 'parent-1', title: 'Parent' });
      const child = makeItem({ id: 'child-1', title: 'Child', parent_id: 'parent-1' });
      items.value = [parent, child];

      await copyItem('parent-1', 'Luke', 'token');

      // 1 parent audit + 1 child audit
      expect(mockAppendAuditEntry).toHaveBeenCalledTimes(2);
    });
  });

  // Error handling
  describe('Error handling', () => {
    it('returns null and rolls back on API failure', async () => {
      const original = makeItem();
      items.value = [original];
      mockCreateItemRow.mockRejectedValue(new Error('Network error'));

      const newId = await copyItem('item-1', 'Luke', 'token');

      expect(newId).toBeNull();
      // Only original item remains
      expect(items.value).toHaveLength(1);
      expect(items.value[0].id).toBe('item-1');
    });

    it('returns null when item not found', async () => {
      items.value = [];

      const newId = await copyItem('nonexistent', 'Luke', 'token');

      expect(newId).toBeNull();
    });
  });
});
