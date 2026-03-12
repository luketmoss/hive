import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserInfo } from '../api/types';

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
  SheetsApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(`Sheets API ${status}: ${message}`);
      this.status = status;
    }
  },
}));

// Mock demo mode to return false (real API mode)
vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
}));

// Mock the mock-api module (required by actions.ts import)
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
}));

import { loadBoard, NotAllowedError, deleteSubtask, reorderSubtasks, createItemWithSubtasks, reorderItem, moveItem } from './actions';
import { owners, loading, items, activeBoardId, permissions, currentUserEmail, toastMessage } from './board-store';
import * as sheetsApi from '../api/sheets';
import type { ItemWithRow } from '../api/types';

const mockFetchOwners = vi.mocked(sheetsApi.fetchOwners);
const mockFetchAllItems = vi.mocked(sheetsApi.fetchAllItems);
const mockFetchLabels = vi.mocked(sheetsApi.fetchLabels);
const mockDeleteItemRow = vi.mocked(sheetsApi.deleteItemRow);
const mockUpdateItemRow = vi.mocked(sheetsApi.updateItemRow);
const mockAppendAuditEntry = vi.mocked(sheetsApi.appendAuditEntry);

describe('loadBoard owner allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAllItems.mockResolvedValue([]);
    mockFetchLabels.mockResolvedValue([]);
  });

  it('loads the board when user email is in the Owners sheet', async () => {
    mockFetchOwners.mockResolvedValue([
      { name: 'Luke', google_account: 'luke@example.com' },
    ]);

    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };
    await loadBoard('test-token', user);

    expect(owners.value).toHaveLength(1);
    expect(loading.value).toBe(false);
  });

  it('throws NotAllowedError when user email is not in Owners sheet', async () => {
    mockFetchOwners.mockResolvedValue([
      { name: 'Luke', google_account: 'luke@example.com' },
    ]);

    const user: UserInfo = { name: 'Stranger', email: 'stranger@example.com', picture: '' };
    await expect(loadBoard('test-token', user)).rejects.toThrow(NotAllowedError);
    expect(loading.value).toBe(false);
  });

  it('matches email case-insensitively', async () => {
    mockFetchOwners.mockResolvedValue([
      { name: 'Luke', google_account: 'Luke@Example.COM' },
    ]);

    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };
    await loadBoard('test-token', user);

    expect(owners.value).toHaveLength(1);
    expect(loading.value).toBe(false);
  });

  it('skips allowlist check when no user is provided', async () => {
    mockFetchOwners.mockResolvedValue([]);

    await loadBoard('test-token');

    // No error thrown even though owners list is empty
    expect(loading.value).toBe(false);
  });
});

// --- Helper to create test items ---
function makeItem(overrides: Partial<ItemWithRow> = {}): ItemWithRow {
  return {
    id: 'item-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: 'Luke',
    due_date: '',
    labels: '',
    parent_id: '',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    completed_at: '',
    sort_order: 1,
    created_by: 'luke@example.com',
    board_id: '',
    sheetRow: 2,
    ...overrides,
  };
}

describe('deleteSubtask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes sub-task from items optimistically and calls deleteItemRow + audit log', async () => {
    const parent = makeItem({ id: 'parent-1', title: 'Parent Task', sheetRow: 2 });
    const subtask = makeItem({ id: 'sub-1', title: 'Sub Task 1', parent_id: 'parent-1', sheetRow: 3 });
    items.value = [parent, subtask];

    // First call to fetchAllItems (inside deleteSubtask) returns fresh data WITH the subtask still present
    // Second call (refreshItems) returns without it
    mockFetchAllItems
      .mockResolvedValueOnce([parent, subtask])
      .mockResolvedValueOnce([parent]);

    await deleteSubtask('sub-1', 'web', 'test-token');

    // Optimistic: sub-task should be removed
    expect(items.value.find(i => i.id === 'sub-1')).toBeUndefined();
    // deleteItemRow should have been called
    expect(mockDeleteItemRow).toHaveBeenCalled();
    // Audit log should record the deletion
    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      'sub-1', 'deleted', '', 'Sub Task 1', '', 'web', 'test-token'
    );
  });

  it('does nothing if item does not exist', async () => {
    items.value = [];

    await deleteSubtask('non-existent', 'web', 'test-token');

    expect(mockDeleteItemRow).not.toHaveBeenCalled();
    expect(mockAppendAuditEntry).not.toHaveBeenCalled();
  });

  it('rolls back on API failure', async () => {
    const parent = makeItem({ id: 'parent-1', title: 'Parent Task', sheetRow: 2 });
    const subtask = makeItem({ id: 'sub-1', title: 'Sub Task 1', parent_id: 'parent-1', sheetRow: 3 });
    items.value = [parent, subtask];

    mockFetchAllItems.mockRejectedValue(new Error('Network error'));

    await deleteSubtask('sub-1', 'web', 'test-token');

    // Should roll back to original state
    expect(items.value).toHaveLength(2);
    expect(items.value.find(i => i.id === 'sub-1')).toBeDefined();
  });
});

describe('reorderSubtasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('swaps sort_order between two sub-tasks optimistically', async () => {
    const parent = makeItem({ id: 'parent-1', title: 'Parent', sheetRow: 2 });
    const subA = makeItem({ id: 'sub-a', title: 'Sub A', parent_id: 'parent-1', sort_order: 1, sheetRow: 3 });
    const subB = makeItem({ id: 'sub-b', title: 'Sub B', parent_id: 'parent-1', sort_order: 2, sheetRow: 4 });
    items.value = [parent, subA, subB];

    mockFetchAllItems.mockResolvedValue([parent, { ...subA, sort_order: 2 }, { ...subB, sort_order: 1 }]);

    await reorderSubtasks('sub-a', 'sub-b', 'web', 'test-token');

    // After reorder, sort_orders should be swapped
    const updatedA = items.value.find(i => i.id === 'sub-a');
    const updatedB = items.value.find(i => i.id === 'sub-b');
    expect(updatedA!.sort_order).toBe(2);
    expect(updatedB!.sort_order).toBe(1);

    // updateItemRow should have been called for both items
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(2);
    // Audit log should record the reorder
    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      'sub-a', 'reordered', 'sort_order', '1', '2', 'web', 'test-token'
    );
  });

  it('does nothing if either item does not exist', async () => {
    const subA = makeItem({ id: 'sub-a', title: 'Sub A', sort_order: 1, sheetRow: 3 });
    items.value = [subA];

    await reorderSubtasks('sub-a', 'non-existent', 'web', 'test-token');

    expect(mockUpdateItemRow).not.toHaveBeenCalled();
  });

  it('rolls back on API failure', async () => {
    const parent = makeItem({ id: 'parent-1', title: 'Parent', sheetRow: 2 });
    const subA = makeItem({ id: 'sub-a', title: 'Sub A', parent_id: 'parent-1', sort_order: 1, sheetRow: 3 });
    const subB = makeItem({ id: 'sub-b', title: 'Sub B', parent_id: 'parent-1', sort_order: 2, sheetRow: 4 });
    items.value = [parent, subA, subB];

    mockUpdateItemRow.mockRejectedValue(new Error('Network error'));

    await reorderSubtasks('sub-a', 'sub-b', 'web', 'test-token');

    // Should roll back to original sort orders
    const rolledBackA = items.value.find(i => i.id === 'sub-a');
    const rolledBackB = items.value.find(i => i.id === 'sub-b');
    expect(rolledBackA!.sort_order).toBe(1);
    expect(rolledBackB!.sort_order).toBe(2);
  });
});

describe('createItemWithSubtasks', () => {
  const mockCreateItemRow = vi.mocked(sheetsApi.createItemRow);

  beforeEach(() => {
    vi.clearAllMocks();
    items.value = [];
    activeBoardId.value = 'board-1';
    mockFetchAllItems.mockResolvedValue([]);
  });

  it('creates parent and children, adds all to items optimistically', async () => {
    await createItemWithSubtasks(
      { title: 'Grocery shopping', owner: 'Mom', created_by: 'mom@test.com' },
      [{ title: 'Buy milk', owner: 'Mom' }, { title: 'Buy eggs', owner: 'Dad' }],
      'Mom',
      'test-token'
    );

    // createItemRow called 3 times (parent + 2 children)
    expect(mockCreateItemRow).toHaveBeenCalledTimes(3);

    // appendAuditEntry called 3 times
    expect(mockAppendAuditEntry).toHaveBeenCalledTimes(3);

    // Parent created first
    const parentCall = mockCreateItemRow.mock.calls[0][0];
    expect(parentCall.title).toBe('Grocery shopping');
    expect(parentCall.owner).toBe('Mom');
    expect(parentCall.parent_id).toBe('');

    // Children reference parent
    const child1 = mockCreateItemRow.mock.calls[1][0];
    const child2 = mockCreateItemRow.mock.calls[2][0];
    expect(child1.title).toBe('Buy milk');
    expect(child1.parent_id).toBe(parentCall.id);
    expect(child1.owner).toBe('Mom');
    expect(child2.title).toBe('Buy eggs');
    expect(child2.parent_id).toBe(parentCall.id);
    expect(child2.owner).toBe('Dad');
  });

  it('assigns sequential sort_order to children', async () => {
    await createItemWithSubtasks(
      { title: 'Parent', created_by: '' },
      [{ title: 'A', owner: '' }, { title: 'B', owner: '' }, { title: 'C', owner: '' }],
      'web',
      'test-token'
    );

    const child1 = mockCreateItemRow.mock.calls[1][0];
    const child2 = mockCreateItemRow.mock.calls[2][0];
    const child3 = mockCreateItemRow.mock.calls[3][0];
    expect(child1.sort_order).toBe(1);
    expect(child2.sort_order).toBe(2);
    expect(child3.sort_order).toBe(3);
  });

  it('filters out blank-titled subtasks', async () => {
    await createItemWithSubtasks(
      { title: 'Parent', created_by: '' },
      [{ title: 'Valid', owner: '' }, { title: '   ', owner: '' }, { title: '', owner: '' }],
      'web',
      'test-token'
    );

    // Only parent + 1 valid child
    expect(mockCreateItemRow).toHaveBeenCalledTimes(2);
  });

  it('children inherit board_id from active board', async () => {
    activeBoardId.value = 'my-board-42';

    await createItemWithSubtasks(
      { title: 'Parent', created_by: '' },
      [{ title: 'Child', owner: '' }],
      'web',
      'test-token'
    );

    const parent = mockCreateItemRow.mock.calls[0][0];
    const child = mockCreateItemRow.mock.calls[1][0];
    expect(parent.board_id).toBe('my-board-42');
    expect(child.board_id).toBe('my-board-42');
  });

  it('rolls back all items on API failure', async () => {
    mockCreateItemRow
      .mockResolvedValueOnce(undefined) // parent succeeds
      .mockRejectedValueOnce(new Error('Network error')); // first child fails

    await createItemWithSubtasks(
      { title: 'Parent', created_by: '' },
      [{ title: 'Child', owner: '' }],
      'web',
      'test-token'
    );

    // All items (parent + child) should be rolled back
    expect(items.value).toHaveLength(0);
  });

  it('does nothing if title is empty', async () => {
    await createItemWithSubtasks(
      { title: '  ', created_by: '' },
      [{ title: 'Child', owner: '' }],
      'web',
      'test-token'
    );

    expect(mockCreateItemRow).not.toHaveBeenCalled();
  });

  it('children default to "To Do" status', async () => {
    await createItemWithSubtasks(
      { title: 'Parent', created_by: '' },
      [{ title: 'Child', owner: '' }],
      'web',
      'test-token'
    );

    const child = mockCreateItemRow.mock.calls[1][0];
    expect(child.status).toBe('To Do');
  });
});

describe('reorderItem (Issue #115)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC1: reorders items within a column and renumbers sort_order densely', async () => {
    const itemA = makeItem({ id: 'a', title: 'Item A', sort_order: 1, sheetRow: 2, status: 'To Do' });
    const itemB = makeItem({ id: 'b', title: 'Item B', sort_order: 2, sheetRow: 3, status: 'To Do' });
    const itemC = makeItem({ id: 'c', title: 'Item C', sort_order: 3, sheetRow: 4, status: 'To Do' });
    items.value = [itemA, itemB, itemC];
    mockUpdateItemRow.mockResolvedValue(undefined);
    mockFetchAllItems.mockResolvedValue([itemA, itemB, itemC]);

    // Move item C to position 0 (before A) → new order: C(1), A(2), B(3)
    await reorderItem('c', 0, [itemA, itemB, itemC], 'web', 'test-token');

    // updateItemRow called for all 3 items with correct sort_order
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(3);

    // First call: C at position 1 (sheetRow 4)
    expect(mockUpdateItemRow.mock.calls[0][0]).toBe(4); // C's sheetRow
    expect(mockUpdateItemRow.mock.calls[0][1].sort_order).toBe(1);
    expect(mockUpdateItemRow.mock.calls[0][1].id).toBe('c');

    // Second call: A at position 2 (sheetRow 2)
    expect(mockUpdateItemRow.mock.calls[1][0]).toBe(2); // A's sheetRow
    expect(mockUpdateItemRow.mock.calls[1][1].sort_order).toBe(2);
    expect(mockUpdateItemRow.mock.calls[1][1].id).toBe('a');

    // Third call: B at position 3 (sheetRow 3)
    expect(mockUpdateItemRow.mock.calls[2][0]).toBe(3); // B's sheetRow
    expect(mockUpdateItemRow.mock.calls[2][1].sort_order).toBe(3);
    expect(mockUpdateItemRow.mock.calls[2][1].id).toBe('b');
  });

  it('AC1: returns true and does nothing when item is already at the target index', async () => {
    const itemA = makeItem({ id: 'a', title: 'Item A', sort_order: 1, sheetRow: 2, status: 'To Do' });
    const itemB = makeItem({ id: 'b', title: 'Item B', sort_order: 2, sheetRow: 3, status: 'To Do' });
    items.value = [itemA, itemB];
    mockFetchAllItems.mockResolvedValue([itemA, itemB]);

    const result = await reorderItem('a', 0, [itemA, itemB], 'web', 'test-token');

    expect(result).toBe(true);
    expect(mockUpdateItemRow).not.toHaveBeenCalled();
  });

  it('AC5: shows toast with position announcement after reorder', async () => {
    const itemA = makeItem({ id: 'a', title: 'Item A', sort_order: 1, sheetRow: 2, status: 'To Do' });
    const itemB = makeItem({ id: 'b', title: 'Item B', sort_order: 2, sheetRow: 3, status: 'To Do' });
    items.value = [itemA, itemB];
    mockUpdateItemRow.mockResolvedValue(undefined);
    mockFetchAllItems.mockResolvedValue([itemA, itemB]);

    const result = await reorderItem('b', 0, [itemA, itemB], 'web', 'test-token');
    expect(result).toBe(true);
  });

  it('returns false if item is not found in columnItems', async () => {
    items.value = [];
    const result = await reorderItem('non-existent', 0, [], 'web', 'test-token');
    expect(result).toBe(false);
    expect(mockUpdateItemRow).not.toHaveBeenCalled();
  });

  it('rolls back items on API failure', async () => {
    const itemA = makeItem({ id: 'a', title: 'Item A', sort_order: 1, sheetRow: 2, status: 'To Do' });
    const itemB = makeItem({ id: 'b', title: 'Item B', sort_order: 2, sheetRow: 3, status: 'To Do' });
    items.value = [itemA, itemB];

    mockUpdateItemRow.mockRejectedValue(new Error('Network error'));

    const result = await reorderItem('b', 0, [itemA, itemB], 'web', 'test-token');

    expect(result).toBe(false);
    // Should roll back to original sort orders
    const rolledBackA = items.value.find(i => i.id === 'a');
    const rolledBackB = items.value.find(i => i.id === 'b');
    expect(rolledBackA!.sort_order).toBe(1);
    expect(rolledBackB!.sort_order).toBe(2);
  });

  it('logs audit entry with old and new positions (1-based)', async () => {
    const itemA = makeItem({ id: 'a', title: 'Item A', sort_order: 1, sheetRow: 2, status: 'To Do' });
    const itemB = makeItem({ id: 'b', title: 'Item B', sort_order: 2, sheetRow: 3, status: 'To Do' });
    items.value = [itemA, itemB];
    mockUpdateItemRow.mockResolvedValue(undefined);
    mockFetchAllItems.mockResolvedValue([itemA, itemB]);

    // Move b from index 1 to index 0
    await reorderItem('b', 0, [itemA, itemB], 'web', 'test-token');

    // oldIndex=1 → position 2, newIndex=0 → position 1
    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      'b', 'reordered', 'sort_order', '2', '1', 'web', 'test-token'
    );
  });
});

describe('moveItem AC3: cross-column places at bottom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets sort_order to max+1 of target column when moving between columns', async () => {
    const todoItem = makeItem({ id: 'moving', title: 'Moving', sort_order: 1, sheetRow: 2, status: 'To Do' });
    const inProgressA = makeItem({ id: 'ip-a', title: 'IP A', sort_order: 5, sheetRow: 3, status: 'In Progress' });
    const inProgressB = makeItem({ id: 'ip-b', title: 'IP B', sort_order: 10, sheetRow: 4, status: 'In Progress', owner: 'Luke' });
    items.value = [todoItem, inProgressA, inProgressB];
    mockFetchAllItems.mockResolvedValue([todoItem, inProgressA, inProgressB]);

    await moveItem('moving', 'In Progress', 'web', 'test-token');

    // updateItemRow should have been called with sort_order = 11 (max In Progress sort_order=10 + 1)
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(1);
    const updatedItem = mockUpdateItemRow.mock.calls[0][1];
    expect(updatedItem.sort_order).toBe(11);
    expect(updatedItem.status).toBe('In Progress');
  });

  it('sets sort_order to 1 when target column is empty', async () => {
    const todoItem = makeItem({ id: 'moving', title: 'Moving', sort_order: 5, sheetRow: 2, status: 'To Do' });
    items.value = [todoItem];
    mockFetchAllItems.mockResolvedValue([todoItem]);

    await moveItem('moving', 'In Progress', 'web', 'test-token');

    // updateItemRow should have been called with sort_order = 1
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(1);
    const updatedItem = mockUpdateItemRow.mock.calls[0][1];
    expect(updatedItem.sort_order).toBe(1);
    expect(updatedItem.status).toBe('In Progress');
  });
});

// --- #162: Status cascade tests ---

describe('moveItem #162: parent status cascades to children', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toastMessage.value = null;
  });

  // AC1: Parent moved to In Progress cascades to children
  it('AC1: cascades In Progress status to all children', async () => {
    const parent = makeItem({ id: 'parent', title: 'Grocery Shopping', status: 'To Do', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Buy milk', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    const child2 = makeItem({ id: 'c2', title: 'Buy eggs', status: 'To Do', parent_id: 'parent', sheetRow: 4 });
    const child3 = makeItem({ id: 'c3', title: 'Buy bread', status: 'To Do', parent_id: 'parent', sheetRow: 5 });
    items.value = [parent, child1, child2, child3];
    mockFetchAllItems.mockResolvedValue([parent, child1, child2, child3]);

    await moveItem('parent', 'In Progress', 'web', 'test-token');

    // Parent + 3 children = 4 updateItemRow calls
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(4);

    // Children should be updated to In Progress
    const child1Update = mockUpdateItemRow.mock.calls[1][1];
    const child2Update = mockUpdateItemRow.mock.calls[2][1];
    const child3Update = mockUpdateItemRow.mock.calls[3][1];
    expect(child1Update.status).toBe('In Progress');
    expect(child2Update.status).toBe('In Progress');
    expect(child3Update.status).toBe('In Progress');

    // Audit entries: 1 for parent + 3 for children = 4
    expect(mockAppendAuditEntry).toHaveBeenCalledTimes(4);
    expect(mockAppendAuditEntry).toHaveBeenCalledWith('c1', 'status_changed', 'status', 'To Do', 'In Progress', 'web', 'test-token');

    // updated_at should be set on children
    expect(child1Update.updated_at).toBeTruthy();
  });

  it('AC1: toast includes cascade count', async () => {
    const parent = makeItem({ id: 'parent', title: 'Grocery Shopping', status: 'To Do', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Buy milk', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    const child2 = makeItem({ id: 'c2', title: 'Buy eggs', status: 'To Do', parent_id: 'parent', sheetRow: 4 });
    const child3 = makeItem({ id: 'c3', title: 'Buy bread', status: 'To Do', parent_id: 'parent', sheetRow: 5 });
    items.value = [parent, child1, child2, child3];
    mockFetchAllItems.mockResolvedValue([parent, child1, child2, child3]);

    await moveItem('parent', 'In Progress', 'web', 'test-token');

    expect(toastMessage.value?.text).toBe('Grocery Shopping moved to In Progress (3 sub-tasks updated)');
  });

  // AC2: Parent moved to Done cascades to children (mixed statuses)
  it('AC2: cascades Done status to children in mixed statuses and sets completed_at', async () => {
    const parent = makeItem({ id: 'parent', title: 'Project', status: 'In Progress', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Task A', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    const child2 = makeItem({ id: 'c2', title: 'Task B', status: 'In Progress', parent_id: 'parent', sheetRow: 4 });
    const child3 = makeItem({ id: 'c3', title: 'Task C', status: 'Done', parent_id: 'parent', sheetRow: 5, completed_at: '2025-01-01T00:00:00Z' });
    items.value = [parent, child1, child2, child3];
    mockFetchAllItems.mockResolvedValue([parent, child1, child2, child3]);

    await moveItem('parent', 'Done', 'web', 'test-token');

    // Parent + 2 children that aren't already Done = 3 updateItemRow calls
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(3);

    // Children should now be Done with completed_at set
    const child1Update = mockUpdateItemRow.mock.calls[1][1];
    const child2Update = mockUpdateItemRow.mock.calls[2][1];
    expect(child1Update.status).toBe('Done');
    expect(child1Update.completed_at).toBeTruthy();
    expect(child2Update.status).toBe('Done');
    expect(child2Update.completed_at).toBeTruthy();

    // Toast should say 2 (not 3, since child3 was already Done)
    expect(toastMessage.value?.text).toBe('Project moved to Done (2 sub-tasks updated)');
  });

  // AC3: Parent moved backward resets children
  it('AC3: cascading back to To Do clears completed_at on children', async () => {
    const parent = makeItem({ id: 'parent', title: 'Task', status: 'Done', owner: 'Luke', sheetRow: 2, completed_at: '2025-01-01T00:00:00Z' });
    const child1 = makeItem({ id: 'c1', title: 'Sub A', status: 'Done', parent_id: 'parent', sheetRow: 3, completed_at: '2025-01-01T00:00:00Z' });
    const child2 = makeItem({ id: 'c2', title: 'Sub B', status: 'Done', parent_id: 'parent', sheetRow: 4, completed_at: '2025-01-01T00:00:00Z' });
    items.value = [parent, child1, child2];
    mockFetchAllItems.mockResolvedValue([parent, child1, child2]);

    await moveItem('parent', 'To Do', 'web', 'test-token');

    // Parent + 2 children = 3 updateItemRow calls
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(3);

    // Children should be To Do with cleared completed_at
    const child1Update = mockUpdateItemRow.mock.calls[1][1];
    const child2Update = mockUpdateItemRow.mock.calls[2][1];
    expect(child1Update.status).toBe('To Do');
    expect(child1Update.completed_at).toBe('');
    expect(child2Update.status).toBe('To Do');
    expect(child2Update.completed_at).toBe('');

    expect(toastMessage.value?.text).toBe('Task moved to To Do (2 sub-tasks updated)');
  });

  // AC4: No cascade when moving a child item directly
  it('AC4: moving a child item does not cascade to siblings', async () => {
    const parent = makeItem({ id: 'parent', title: 'Parent', status: 'To Do', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Sub A', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    const child2 = makeItem({ id: 'c2', title: 'Sub B', status: 'To Do', parent_id: 'parent', sheetRow: 4 });
    items.value = [parent, child1, child2];
    mockFetchAllItems.mockResolvedValue([parent, child1, child2]);

    await moveItem('c1', 'Done', 'web', 'test-token');

    // Only the child itself should be updated, not the parent or sibling
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(1);
    expect(mockUpdateItemRow.mock.calls[0][1].id).toBe('c1');
    expect(mockUpdateItemRow.mock.calls[0][1].status).toBe('Done');

    // Only 1 audit entry for the child
    expect(mockAppendAuditEntry).toHaveBeenCalledTimes(1);
    expect(mockAppendAuditEntry).toHaveBeenCalledWith('c1', 'status_changed', 'status', 'To Do', 'Done', 'web', 'test-token');
  });

  // AC5: Toast omits cascade count when parent has no children
  it('AC5: toast has no cascade count for items without children', async () => {
    const item = makeItem({ id: 'solo', title: 'Solo Task', status: 'To Do', owner: 'Luke', sheetRow: 2 });
    items.value = [item];
    mockFetchAllItems.mockResolvedValue([item]);

    await moveItem('solo', 'In Progress', 'web', 'test-token');

    expect(toastMessage.value?.text).toBe('Solo Task moved to In Progress');
  });

  // AC6: Audit log records child cascades
  it('AC6: writes audit entries for each cascaded child', async () => {
    const parent = makeItem({ id: 'parent', title: 'Parent', status: 'To Do', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Sub A', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    const child2 = makeItem({ id: 'c2', title: 'Sub B', status: 'To Do', parent_id: 'parent', sheetRow: 4 });
    items.value = [parent, child1, child2];
    mockFetchAllItems.mockResolvedValue([parent, child1, child2]);

    await moveItem('parent', 'In Progress', 'web', 'test-token');

    // Parent audit entry
    expect(mockAppendAuditEntry).toHaveBeenCalledWith('parent', 'status_changed', 'status', 'To Do', 'In Progress', 'web', 'test-token');
    // Child audit entries
    expect(mockAppendAuditEntry).toHaveBeenCalledWith('c1', 'status_changed', 'status', 'To Do', 'In Progress', 'web', 'test-token');
    expect(mockAppendAuditEntry).toHaveBeenCalledWith('c2', 'status_changed', 'status', 'To Do', 'In Progress', 'web', 'test-token');
  });

  it('optimistically updates children in items signal so progress bar recomputes', async () => {
    const parent = makeItem({ id: 'parent', title: 'Parent', status: 'In Progress', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Sub A', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    const child2 = makeItem({ id: 'c2', title: 'Sub B', status: 'In Progress', parent_id: 'parent', sheetRow: 4 });
    items.value = [parent, child1, child2];

    // Don't resolve fetchAllItems immediately — check optimistic state first
    let resolveFetch: (value: any) => void;
    mockFetchAllItems.mockReturnValue(new Promise(r => { resolveFetch = r; }));

    const promise = moveItem('parent', 'Done', 'web', 'test-token');

    // Before API calls resolve, children should already be updated optimistically
    expect(items.value.find(i => i.id === 'c1')!.status).toBe('Done');
    expect(items.value.find(i => i.id === 'c2')!.status).toBe('Done');
    expect(items.value.find(i => i.id === 'parent')!.status).toBe('Done');

    resolveFetch!([parent, child1, child2]);
    await promise;
  });

  it('rolls back children on API failure', async () => {
    const parent = makeItem({ id: 'parent', title: 'Parent', status: 'To Do', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Sub A', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    items.value = [parent, child1];

    mockUpdateItemRow.mockRejectedValue(new Error('Network error'));

    await moveItem('parent', 'In Progress', 'web', 'test-token');

    // Should roll back to original state
    expect(items.value.find(i => i.id === 'parent')!.status).toBe('To Do');
    expect(items.value.find(i => i.id === 'c1')!.status).toBe('To Do');
  });

  it('cascade works with targetIndex (drag-and-drop specific position)', async () => {
    mockUpdateItemRow.mockResolvedValue(undefined); // reset after rollback test's mockRejectedValue
    const parent = makeItem({ id: 'parent', title: 'Parent', status: 'To Do', owner: 'Luke', sheetRow: 2 });
    const child1 = makeItem({ id: 'c1', title: 'Sub A', status: 'To Do', parent_id: 'parent', sheetRow: 3 });
    const existing = makeItem({ id: 'existing', title: 'Existing', status: 'In Progress', owner: 'Luke', sheetRow: 6, sort_order: 1 });
    items.value = [parent, child1, existing];
    mockFetchAllItems.mockResolvedValue([parent, child1, existing]);

    await moveItem('parent', 'In Progress', 'web', 'test-token', 0);

    // updateItemRow: 2 for column renumber (parent + existing) + 1 for cascaded child = 3
    expect(mockUpdateItemRow).toHaveBeenCalledTimes(3);

    // Child should be cascaded
    const childCall = mockUpdateItemRow.mock.calls[2][1];
    expect(childCall.id).toBe('c1');
    expect(childCall.status).toBe('In Progress');
  });
});
