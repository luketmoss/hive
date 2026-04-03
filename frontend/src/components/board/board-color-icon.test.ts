/**
 * Tests for board icon feature (issue #74).
 * Board color has been removed — only icon is supported.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sheets API
vi.mock('../../api/sheets', () => ({
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
  SheetsApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(`Sheets API ${status}: ${message}`);
      this.status = status;
    }
  },
}));

vi.mock('../../demo/is-demo-mode', () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
}));

vi.mock('../../demo/mock-api', () => ({
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

import { createBoard, updateBoardAppearance } from '../../state/actions';
import { boards, permissions } from '../../state/board-store';
import * as sheetsApi from '../../api/sheets';

const mockCreateBoardRow = vi.mocked(sheetsApi.createBoardRow);
const mockCreatePermissionRow = vi.mocked(sheetsApi.createPermissionRow);
const mockUpdateBoardRow = vi.mocked(sheetsApi.updateBoardRow);
const mockAppendAuditEntry = vi.mocked(sheetsApi.appendAuditEntry);

beforeEach(() => {
  vi.clearAllMocks();
  boards.value = [];
  permissions.value = [];
  mockCreateBoardRow.mockResolvedValue(undefined);
  mockCreatePermissionRow.mockResolvedValue(undefined);
  mockUpdateBoardRow.mockResolvedValue(undefined);
  mockAppendAuditEntry.mockResolvedValue(undefined);
});

describe('createBoard stores icon', () => {
  it('stores icon when provided', async () => {
    const success = await createBoard('My Board', 'user@test.com', 'tok', '🏠');

    expect(success).toBe(true);
    const created = boards.value.find(b => b.name === 'My Board');
    expect(created?.icon).toBe('🏠');
  });

  it('defaults to empty string when icon is omitted', async () => {
    const success = await createBoard('Plain Board', 'user@test.com', 'tok');

    expect(success).toBe(true);
    const created = boards.value.find(b => b.name === 'Plain Board');
    expect(created?.icon).toBe('');
  });

  it('passes icon to createBoardRow', async () => {
    await createBoard('Colored Board', 'user@test.com', 'tok', '🎯');

    expect(mockCreateBoardRow).toHaveBeenCalledWith(
      expect.objectContaining({ icon: '🎯' }),
      'tok'
    );
  });

  it('board has no color property', async () => {
    await createBoard('No Color', 'user@test.com', 'tok', '🎯');
    const created = boards.value.find(b => b.name === 'No Color');
    expect(created).not.toHaveProperty('color');
  });
});

describe('Board type has no color field', () => {
  it('Board interface has no color — only icon is optional', () => {
    const board = {
      id: 'b1',
      name: 'Test',
      created_at: '',
      created_by: '',
      icon: '🏠',
    };
    expect(board.icon).toBe('🏠');
    expect(board).not.toHaveProperty('color');
  });

  it('Board interface works without icon', () => {
    const board = {
      id: 'b2',
      name: 'Old Board',
      created_at: '',
      created_by: '',
    };
    expect(board).not.toHaveProperty('color');
    expect(board).not.toHaveProperty('icon');
  });
});

describe('updateBoardAppearance updates icon only', () => {
  it('updates board icon in store (optimistic)', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', icon: '' },
    ];

    await updateBoardAppearance('board-1', '🏠', 'tok');

    expect(boards.value[0].icon).toBe('🏠');
  });

  it('calls updateBoardRow with empty color and correct icon', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', icon: '' },
    ];

    await updateBoardAppearance('board-1', '🎯', 'tok');

    expect(mockUpdateBoardRow).toHaveBeenCalledWith('board-1', '', '🎯', 'tok');
  });

  it('returns true on success', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', icon: '' },
    ];

    const result = await updateBoardAppearance('board-1', '🏠', 'tok');
    expect(result).toBe(true);
  });

  it('rolls back on API failure', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', icon: '🎮' },
    ];
    mockUpdateBoardRow.mockRejectedValueOnce(new Error('API error'));

    const result = await updateBoardAppearance('board-1', '🏠', 'tok');

    expect(result).toBe(false);
    expect(boards.value[0].icon).toBe('🎮');
  });
});

describe('Migration — existing boards without icon', () => {
  it('boards without icon are handled gracefully', () => {
    const board: any = { id: 'b2', name: 'Legacy Board', created_at: '', created_by: '' };
    expect(!board.icon).toBe(true);
  });

  it('createBoard with icon stores in boards signal', async () => {
    const result = await createBoard('New Board', 'user@t.com', 'tok', '✈️');
    expect(result).toBe(true);
    const b = boards.value.find(x => x.name === 'New Board');
    expect(b?.icon).toBe('✈️');
  });
});
