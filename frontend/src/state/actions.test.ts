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
}));

import { loadBoard, NotAllowedError, deleteSubtask, reorderSubtasks, createItemWithSubtasks } from './actions';
import { owners, loading, items, activeBoardId } from './board-store';
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
    scheduled_date: '',
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
