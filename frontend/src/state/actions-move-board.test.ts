import { describe, it, expect, vi, beforeEach } from 'vitest';
import { moveItemToBoard } from './actions';

// Mock board-store signals
const mockBoards = { current: [
  { id: 'board-1', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
  { id: 'board-2', name: 'Work Board', created_at: '', created_by: '', color: '', icon: '' },
] };
const mockItems = { current: [] as any[] };
const mockSelectedItemId = { current: null as string | null };
const mockToast = { current: null as any };

vi.mock('./board-store', () => ({
  boards: { get value() { return mockBoards.current; }, set value(v: any) { mockBoards.current = v; } },
  items: { get value() { return mockItems.current; }, set value(v: any) { mockItems.current = v; } },
  selectedItemId: { get value() { return mockSelectedItemId.current; }, set value(v: any) { mockSelectedItemId.current = v; } },
  activeBoardId: { value: 'board-1' },
  currentUserEmail: { value: 'test@example.com' },
  loading: { value: false },
  owners: { value: [] },
  labels: { value: [] },
  permissions: { value: [] },
  showToast: (text: string, type?: string) => { mockToast.current = { text, type: type || 'success' }; },
  initActiveBoardFromUrl: vi.fn(),
  accessibleBoards: { get value() { return mockBoards.current; } },
  switchBoard: vi.fn(),
}));

// Mock API layer
const mockUpdateItemBoardId = vi.fn().mockResolvedValue(undefined);
const mockAppendAuditEntry = vi.fn().mockResolvedValue(undefined);
const mockFetchAllItems = vi.fn().mockResolvedValue([]);

vi.mock('../api/sheets', () => ({
  fetchAllItems: (...args: any[]) => mockFetchAllItems(...args),
  fetchOwners: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  createItemRow: vi.fn(),
  updateItemRow: vi.fn(),
  deleteItemRow: vi.fn(),
  appendAuditEntry: (...args: any[]) => mockAppendAuditEntry(...args),
  createLabelRow: vi.fn(),
  updateLabelRow: vi.fn(),
  deleteLabelRow: vi.fn(),
  fetchLabelsWithRows: vi.fn().mockResolvedValue([]),
  cascadeLabelUpdate: vi.fn(),
  cascadeOwnerUpdate: vi.fn(),
  upsertOwner: vi.fn(),
  fetchBoards: vi.fn().mockResolvedValue([]),
  createBoardRow: vi.fn(),
  updateBoardRow: vi.fn(),
  fetchPermissions: vi.fn().mockResolvedValue([]),
  createPermissionRow: vi.fn(),
  deletePermissionRow: vi.fn(),
  deleteBoardRow: vi.fn(),
  deleteAllBoardPermissions: vi.fn(),
  updateItemBoardId: (...args: any[]) => mockUpdateItemBoardId(...args),
  SheetsApiError: class extends Error { status: number; constructor(s: number, m: string) { super(m); this.status = s; } },
}));

vi.mock('../demo/mock-api', () => ({}));
vi.mock('../demo/is-demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('../auth/reauth', () => ({ ReauthFailedError: class extends Error {} }));

function makeItem(overrides: Record<string, any> = {}) {
  return {
    id: 'item-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: 'Tester',
    due_date: '',
    labels: '',
    parent_id: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    completed_at: '',
    sort_order: 1,
    created_by: 'test@example.com',
    board_id: 'board-1',
    sheetRow: 2,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBoards.current = [
    { id: 'board-1', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
    { id: 'board-2', name: 'Work Board', created_at: '', created_by: '', color: '', icon: '' },
  ];
  mockItems.current = [];
  mockSelectedItemId.current = null;
  mockToast.current = null;
  mockFetchAllItems.mockResolvedValue([]);
  mockUpdateItemBoardId.mockResolvedValue(undefined);
  mockAppendAuditEntry.mockResolvedValue(undefined);
});

describe('moveItemToBoard', () => {
  // AC1: Happy path — item and subtasks move to target board
  it('moves item to target board and shows success toast', async () => {
    const item = makeItem();
    mockItems.current = [item];
    mockSelectedItemId.current = 'item-1';

    const result = await moveItemToBoard('item-1', 'board-2', 'Tester', 'token');

    expect(result).toBe(true);
    expect(mockUpdateItemBoardId).toHaveBeenCalledWith(2, 'board-2', 'token');
    expect(mockToast.current).toEqual({ text: 'Item moved to Work Board', type: 'success' });
  });

  // AC1: Detail panel closes after move
  it('closes the detail panel after successful move', async () => {
    const item = makeItem();
    mockItems.current = [item];
    mockSelectedItemId.current = 'item-1';

    await moveItemToBoard('item-1', 'board-2', 'Tester', 'token');

    expect(mockSelectedItemId.current).toBe(null);
  });

  // AC4: Subtasks move with the parent
  it('updates board_id for all subtasks as well', async () => {
    const parent = makeItem({ id: 'parent-1', sheetRow: 2 });
    const sub1 = makeItem({ id: 'sub-1', parent_id: 'parent-1', sheetRow: 3, title: 'Subtask 1' });
    const sub2 = makeItem({ id: 'sub-2', parent_id: 'parent-1', sheetRow: 4, title: 'Subtask 2' });
    mockItems.current = [parent, sub1, sub2];

    await moveItemToBoard('parent-1', 'board-2', 'Tester', 'token');

    // Should call updateItemBoardId for parent + 2 subtasks = 3 calls
    expect(mockUpdateItemBoardId).toHaveBeenCalledTimes(3);
    expect(mockUpdateItemBoardId).toHaveBeenCalledWith(2, 'board-2', 'token');
    expect(mockUpdateItemBoardId).toHaveBeenCalledWith(3, 'board-2', 'token');
    expect(mockUpdateItemBoardId).toHaveBeenCalledWith(4, 'board-2', 'token');
  });

  // AC4: Optimistic update changes board_id for subtasks immediately
  it('optimistically updates board_id for item and subtasks', async () => {
    const parent = makeItem({ id: 'parent-1', sheetRow: 2 });
    const sub1 = makeItem({ id: 'sub-1', parent_id: 'parent-1', sheetRow: 3 });
    mockItems.current = [parent, sub1];

    // Make the API call hang so we can check optimistic state
    mockUpdateItemBoardId.mockImplementation(() => new Promise(() => {}));

    // Don't await — check optimistic state
    moveItemToBoard('parent-1', 'board-2', 'Tester', 'token');

    // Allow microtask queue to flush
    await new Promise(r => setTimeout(r, 0));

    expect(mockItems.current.find((i: any) => i.id === 'parent-1')?.board_id).toBe('board-2');
    expect(mockItems.current.find((i: any) => i.id === 'sub-1')?.board_id).toBe('board-2');
  });

  // AC8: Audit log records the move
  it('writes audit log entry with board_moved action', async () => {
    const item = makeItem();
    mockItems.current = [item];

    await moveItemToBoard('item-1', 'board-2', 'Tester', 'token');

    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      'item-1', 'board_moved', 'board_id', 'board-1', 'board-2', 'Tester', 'token'
    );
  });

  // Edge case: returns false if item not found
  it('returns false when item does not exist', async () => {
    mockItems.current = [];
    const result = await moveItemToBoard('nonexistent', 'board-2', 'Tester', 'token');
    expect(result).toBe(false);
  });

  // Edge case: returns false if target is same as current board
  it('returns false when target board is the same as current', async () => {
    const item = makeItem();
    mockItems.current = [item];
    const result = await moveItemToBoard('item-1', 'board-1', 'Tester', 'token');
    expect(result).toBe(false);
    expect(mockUpdateItemBoardId).not.toHaveBeenCalled();
  });

  // Error handling: rollback on failure
  it('rolls back on API failure and shows error toast', async () => {
    const item = makeItem();
    mockItems.current = [item];
    mockSelectedItemId.current = 'item-1';
    mockUpdateItemBoardId.mockRejectedValueOnce(new Error('Network error'));

    const result = await moveItemToBoard('item-1', 'board-2', 'Tester', 'token');

    expect(result).toBe(false);
    // Item should be rolled back to original board
    expect(mockItems.current.find((i: any) => i.id === 'item-1')?.board_id).toBe('board-1');
    // selectedItemId should be restored
    expect(mockSelectedItemId.current).toBe('item-1');
    expect(mockToast.current?.type).toBe('error');
  });
});
