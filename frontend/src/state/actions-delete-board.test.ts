import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteBoard } from './actions';

// Mock board-store signals
const mockBoards = { current: [
  { id: 'board-1', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
  { id: 'board-2', name: 'Work Board', created_at: '', created_by: '', color: '', icon: '' },
] };
const mockPerms = { current: [
  { board_id: 'board-1', user_email: 'owner@test.com', role: 'owner' as const },
  { board_id: 'board-1', user_email: '*', role: 'member' as const },
  { board_id: 'board-2', user_email: 'owner@test.com', role: 'owner' as const },
] };
const mockItems = { current: [] as any[] };
const mockActiveBoardId = { current: 'board-1' };
const mockToast = { current: null as any };
const mockStatuses = { current: [] as any[] };
const mockLabels = { current: [] as any[] };

vi.mock('./board-store', () => ({
  boards: { get value() { return mockBoards.current; }, set value(v: any) { mockBoards.current = v; } },
  permissions: { get value() { return mockPerms.current; }, set value(v: any) { mockPerms.current = v; } },
  items: { get value() { return mockItems.current; }, set value(v: any) { mockItems.current = v; } },
  activeBoardId: { get value() { return mockActiveBoardId.current; }, set value(v: any) { mockActiveBoardId.current = v; } },
  currentUserEmail: { value: 'owner@test.com' },
  loading: { value: false },
  owners: { value: [] },
  labels: { get value() { return mockLabels.current; }, set value(v: any) { mockLabels.current = v; } },
  statuses: { get value() { return mockStatuses.current; }, set value(v: any) { mockStatuses.current = v; } },
  showToast: (text: string, type?: string) => { mockToast.current = { text, type: type || 'success' }; },
  initActiveBoardFromUrl: vi.fn(),
  accessibleBoards: { get value() { return mockBoards.current; } },
  switchBoard: vi.fn(),
}));

// Mock API layer
const mockDeleteBoardRow = vi.fn().mockResolvedValue(undefined);
const mockDeleteAllBoardPermissions = vi.fn().mockResolvedValue(undefined);
const mockDeleteAllBoardStatuses = vi.fn().mockResolvedValue(undefined);
const mockDeleteAllBoardLabels = vi.fn().mockResolvedValue(undefined);
const mockDeleteItemRow = vi.fn().mockResolvedValue(undefined);
const mockUpdateItemBoardId = vi.fn().mockResolvedValue(undefined);
const mockAppendAuditEntry = vi.fn().mockResolvedValue(undefined);
const mockFetchBoards = vi.fn().mockResolvedValue([]);
const mockFetchPermissions = vi.fn().mockResolvedValue([]);
const mockFetchAllItems = vi.fn().mockResolvedValue([]);

vi.mock('../api/sheets', () => ({
  fetchAllItems: (...args: any[]) => mockFetchAllItems(...args),
  fetchOwners: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  createItemRow: vi.fn(),
  updateItemRow: vi.fn(),
  deleteItemRow: (...args: any[]) => mockDeleteItemRow(...args),
  appendAuditEntry: (...args: any[]) => mockAppendAuditEntry(...args),
  createLabelRow: vi.fn(),
  updateLabelRow: vi.fn(),
  deleteLabelRow: vi.fn(),
  fetchLabelsWithRows: vi.fn().mockResolvedValue([]),
  cascadeLabelUpdate: vi.fn(),
  cascadeOwnerUpdate: vi.fn(),
  upsertOwner: vi.fn(),
  fetchBoards: (...args: any[]) => mockFetchBoards(...args),
  createBoardRow: vi.fn(),
  updateBoardRow: vi.fn(),
  renameBoardRow: vi.fn().mockResolvedValue(undefined),
  fetchPermissions: (...args: any[]) => mockFetchPermissions(...args),
  createPermissionRow: vi.fn(),
  deletePermissionRow: vi.fn(),
  deleteBoardRow: (...args: any[]) => mockDeleteBoardRow(...args),
  setBoardArchivedAt: vi.fn().mockResolvedValue(undefined),
  deleteAllBoardPermissions: (...args: any[]) => mockDeleteAllBoardPermissions(...args),
  deleteAllBoardStatuses: (...args: any[]) => mockDeleteAllBoardStatuses(...args),
  deleteAllBoardLabels: (...args: any[]) => mockDeleteAllBoardLabels(...args),
  updateItemBoardId: (...args: any[]) => mockUpdateItemBoardId(...args),
  fetchStatuses: vi.fn().mockResolvedValue([]),
  createStatusRow: vi.fn().mockResolvedValue(undefined),
  updateStatusRow: vi.fn().mockResolvedValue(undefined),
  deleteStatusRow: vi.fn().mockResolvedValue(undefined),
  fetchStatusesWithRows: vi.fn().mockResolvedValue([]),
  cascadeStatusRename: vi.fn().mockResolvedValue(undefined),
  SheetsApiError: class extends Error { status: number; constructor(s: number, m: string) { super(m); this.status = s; } },
}));

vi.mock('../demo/mock-api', () => ({
  fetchAllItems: vi.fn().mockResolvedValue([]),
  fetchOwners: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  createItemRow: vi.fn(),
  updateItemRow: vi.fn(),
  deleteItemRow: vi.fn(),
  appendAuditEntry: vi.fn(),
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
  renameBoardRow: vi.fn().mockResolvedValue(undefined),
  fetchPermissions: vi.fn().mockResolvedValue([]),
  createPermissionRow: vi.fn(),
  deletePermissionRow: vi.fn(),
  deleteBoardRow: vi.fn(),
  setBoardArchivedAt: vi.fn().mockResolvedValue(undefined),
  deleteAllBoardPermissions: vi.fn(),
  deleteAllBoardStatuses: vi.fn(),
  deleteAllBoardLabels: vi.fn(),
  updateItemBoardId: vi.fn(),
  fetchStatuses: vi.fn().mockResolvedValue([]),
  createStatusRow: vi.fn().mockResolvedValue(undefined),
  updateStatusRow: vi.fn().mockResolvedValue(undefined),
  deleteStatusRow: vi.fn().mockResolvedValue(undefined),
  fetchStatusesWithRows: vi.fn().mockResolvedValue([]),
  cascadeStatusRename: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../demo/is-demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('../auth/reauth', () => ({ ReauthFailedError: class extends Error {} }));

beforeEach(() => {
  vi.clearAllMocks();
  mockBoards.current = [
    { id: 'board-1', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
    { id: 'board-2', name: 'Work Board', created_at: '', created_by: '', color: '', icon: '' },
  ];
  mockPerms.current = [
    { board_id: 'board-1', user_email: 'owner@test.com', role: 'owner' as const },
    { board_id: 'board-2', user_email: 'owner@test.com', role: 'owner' as const },
  ];
  mockItems.current = [];
  mockActiveBoardId.current = 'board-1';
  mockToast.current = null;
  mockStatuses.current = [
    { id: 's1', board_id: 'board-1', name: 'To Do' },
    { id: 's2', board_id: 'board-1', name: 'Done' },
    { id: 's3', board_id: 'board-2', name: 'To Do' },
  ];
  mockLabels.current = [
    { label: 'a', color: '#fff', board_id: 'board-1' },
    { label: 'b', color: '#fff', board_id: 'board-2' },
  ];
  mockFetchBoards.mockResolvedValue([{ id: 'board-2', name: 'Work Board' }]);
  mockFetchPermissions.mockResolvedValue([{ board_id: 'board-2', user_email: 'owner@test.com', role: 'owner' }]);
  mockFetchAllItems.mockResolvedValue([]);
});

describe('deleteBoard action (Issue #120)', () => {
  it('deletes an empty board (AC1)', async () => {
    const result = await deleteBoard('board-1', null, null, 'owner@test.com', 'token');
    expect(result).toBe(true);
    expect(mockDeleteAllBoardPermissions).toHaveBeenCalledWith('board-1', 'token');
    expect(mockDeleteBoardRow).toHaveBeenCalledWith('board-1', 'token');
    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      'board-1', 'board_deleted', '', 'Family Board', '', 'owner@test.com', 'token'
    );
  });

  it('migrates items to target board (AC2)', async () => {
    mockItems.current = [
      { id: 'item-1', board_id: 'board-1', sheetRow: 2, parent_id: '' },
      { id: 'item-2', board_id: 'board-1', sheetRow: 3, parent_id: 'item-1' },
    ];

    const result = await deleteBoard('board-1', 'migrate', 'board-2', 'owner@test.com', 'token');
    expect(result).toBe(true);
    expect(mockUpdateItemBoardId).toHaveBeenCalledTimes(2);
    expect(mockUpdateItemBoardId).toHaveBeenCalledWith(2, 'board-2', 'token');
    expect(mockUpdateItemBoardId).toHaveBeenCalledWith(3, 'board-2', 'token');
    expect(mockDeleteItemRow).not.toHaveBeenCalled();
  });

  it('discards all items on the board (AC3)', async () => {
    mockItems.current = [
      { id: 'item-1', board_id: 'board-1', sheetRow: 2, parent_id: '' },
      { id: 'item-2', board_id: 'board-1', sheetRow: 3, parent_id: 'item-1' },
    ];

    const result = await deleteBoard('board-1', 'discard', null, 'owner@test.com', 'token');
    expect(result).toBe(true);
    // Should delete from bottom to top
    expect(mockDeleteItemRow).toHaveBeenCalledTimes(2);
    expect(mockDeleteItemRow.mock.calls[0][0]).toBe(3); // bottom first
    expect(mockDeleteItemRow.mock.calls[1][0]).toBe(2);
  });

  it('returns false for non-existent board', async () => {
    const result = await deleteBoard('nonexistent', null, null, 'owner@test.com', 'token');
    expect(result).toBe(false);
    expect(mockDeleteBoardRow).not.toHaveBeenCalled();
  });

  it('shows success toast with migrate info (AC2)', async () => {
    mockItems.current = [
      { id: 'item-1', board_id: 'board-1', sheetRow: 2, parent_id: '' },
    ];
    mockFetchBoards.mockResolvedValue([{ id: 'board-2', name: 'Work Board' }]);

    await deleteBoard('board-1', 'migrate', 'board-2', 'owner@test.com', 'token');
    expect(mockToast.current.text).toContain('Family Board deleted');
    expect(mockToast.current.text).toContain('1 item moved to Work Board');
  });

  it.each([
    ['empty', null, null],
    ['migrate', 'migrate', 'board-2'],
    ['discard', 'discard', null],
  ] as const)('deletes the board\'s columns and labels in %s mode (#292 AC1, AC2, AC4)', async (_n, mode, target) => {
    mockItems.current = [{ id: 'item-1', board_id: 'board-1', sheetRow: 2, parent_id: '' }];
    const result = await deleteBoard('board-1', mode as any, target as any, 'owner@test.com', 'token');
    expect(result).toBe(true);
    expect(mockDeleteAllBoardStatuses).toHaveBeenCalledWith('board-1', 'token');
    expect(mockDeleteAllBoardLabels).toHaveBeenCalledWith('board-1', 'token');
    expect(mockDeleteAllBoardStatuses).not.toHaveBeenCalledWith('board-2', expect.anything());
  });

  it('optimistically removes only the deleted board\'s columns and labels (#292)', async () => {
    let seen: any;
    mockDeleteBoardRow.mockImplementationOnce(async () => {
      seen = { statuses: [...mockStatuses.current], labels: [...mockLabels.current] };
    });
    await deleteBoard('board-1', null, null, 'owner@test.com', 'token');
    expect(seen.statuses.map((s: any) => s.id)).toEqual(['s3']);
    expect(seen.labels.map((l: any) => l.label)).toEqual(['b']);
  });

  it('restores columns and labels on error (#292)', async () => {
    mockDeleteAllBoardLabels.mockRejectedValueOnce(new Error('boom'));
    await deleteBoard('board-1', null, null, 'owner@test.com', 'token');
    expect(mockStatuses.current).toHaveLength(3);
    expect(mockLabels.current).toHaveLength(2);
    expect(mockDeleteBoardRow).not.toHaveBeenCalled();
  });

  it('rolls back on error', async () => {
    mockDeleteAllBoardPermissions.mockRejectedValue(new Error('Network error'));
    const originalBoards = [...mockBoards.current];

    await deleteBoard('board-1', null, null, 'owner@test.com', 'token');
    expect(mockBoards.current).toEqual(originalBoards);
    expect(mockToast.current.text).toContain('Failed to delete board');
    expect(mockToast.current.type).toBe('error');
  });
});
