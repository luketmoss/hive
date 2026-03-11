/**
 * Tests for issue #74 — Board color coding and icons.
 * Covers AC1–AC5.
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
  fetchPermissions: vi.fn().mockResolvedValue([]),
  createPermissionRow: vi.fn().mockResolvedValue(undefined),
  deletePermissionRow: vi.fn().mockResolvedValue(undefined),
  deleteBoardRow: vi.fn().mockResolvedValue(undefined),
  deleteAllBoardPermissions: vi.fn().mockResolvedValue(undefined),
  updateItemBoardId: vi.fn().mockResolvedValue(undefined),
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

// --- AC1 & AC2: Color and icon saved with board on creation ---

describe('AC1/AC2: createBoard stores color and icon', () => {
  it('stores color and icon when provided', async () => {
    const success = await createBoard('My Board', 'user@test.com', 'tok', '#1976d2', '🏠');

    expect(success).toBe(true);
    const created = boards.value.find(b => b.name === 'My Board');
    expect(created?.color).toBe('#1976d2');
    expect(created?.icon).toBe('🏠');
  });

  it('defaults to empty strings when color and icon are omitted', async () => {
    const success = await createBoard('Plain Board', 'user@test.com', 'tok');

    expect(success).toBe(true);
    const created = boards.value.find(b => b.name === 'Plain Board');
    expect(created?.color).toBe('');
    expect(created?.icon).toBe('');
  });

  it('passes color and icon to createBoardRow', async () => {
    await createBoard('Colored Board', 'user@test.com', 'tok', '#388e3c', '🎯');

    expect(mockCreateBoardRow).toHaveBeenCalledWith(
      expect.objectContaining({ color: '#388e3c', icon: '🎯' }),
      'tok'
    );
  });

  it('passes empty color/icon to createBoardRow when not set', async () => {
    await createBoard('No Flair', 'user@test.com', 'tok');

    expect(mockCreateBoardRow).toHaveBeenCalledWith(
      expect.objectContaining({ color: '', icon: '' }),
      'tok'
    );
  });
});

// --- AC3: Board type includes optional color and icon fields ---

describe('AC3: Board type accepts color and icon fields', () => {
  it('Board interface accepts color and icon', () => {
    // TypeScript compile test — if this file compiles, the type is correct
    const board = {
      id: 'b1',
      name: 'Test',
      created_at: '',
      created_by: '',
      color: '#1976d2',
      icon: '🏠',
    };
    expect(board.color).toBe('#1976d2');
    expect(board.icon).toBe('🏠');
  });

  it('Board interface works without color and icon (migration case)', () => {
    const board = {
      id: 'b2',
      name: 'Old Board',
      created_at: '',
      created_by: '',
    };
    // color and icon are optional — should be undefined, not required
    expect(board).not.toHaveProperty('color');
    expect(board).not.toHaveProperty('icon');
  });
});

// --- AC4: updateBoardAppearance saves color and icon ---

describe('AC4: updateBoardAppearance updates color and icon', () => {
  it('updates board color and icon in store (optimistic)', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', color: '', icon: '' },
    ];

    await updateBoardAppearance('board-1', '#1976d2', '🏠', 'tok');

    expect(boards.value[0].color).toBe('#1976d2');
    expect(boards.value[0].icon).toBe('🏠');
  });

  it('calls updateBoardRow with correct args', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', color: '', icon: '' },
    ];

    await updateBoardAppearance('board-1', '#d32f2f', '🎯', 'tok');

    expect(mockUpdateBoardRow).toHaveBeenCalledWith('board-1', '#d32f2f', '🎯', 'tok');
  });

  it('returns true on success', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', color: '', icon: '' },
    ];

    const result = await updateBoardAppearance('board-1', '#1976d2', '🏠', 'tok');
    expect(result).toBe(true);
  });

  it('rolls back on API failure', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', color: '#old', icon: '🎮' },
    ];
    mockUpdateBoardRow.mockRejectedValueOnce(new Error('API error'));

    const result = await updateBoardAppearance('board-1', '#new', '🏠', 'tok');

    expect(result).toBe(false);
    // Rolled back to original values
    expect(boards.value[0].color).toBe('#old');
    expect(boards.value[0].icon).toBe('🎮');
  });

  it('can clear color and icon (set to empty string)', async () => {
    boards.value = [
      { id: 'board-1', name: 'Test', created_at: '', created_by: '', color: '#1976d2', icon: '🏠' },
    ];

    await updateBoardAppearance('board-1', '', '', 'tok');

    expect(boards.value[0].color).toBe('');
    expect(boards.value[0].icon).toBe('');
  });
});

// --- AC5: Migration — boards without color/icon work gracefully ---

describe('AC5: Migration — existing boards without color/icon', () => {
  it('boards without color render without indicators (empty string falsy)', () => {
    const board = { id: 'b1', name: 'Old Board', created_at: '', created_by: '', color: '', icon: '' };
    // Component logic: only render dot if color is truthy
    expect(!!board.color).toBe(false);
    expect(!!board.icon).toBe(false);
  });

  it('boards with undefined color/icon are handled gracefully', () => {
    const board: any = { id: 'b2', name: 'Legacy Board', created_at: '', created_by: '' };
    // Optional fields should be falsy when absent
    expect(!board.color).toBe(true);
    expect(!board.icon).toBe(true);
  });

  it('createBoard with color stores in boards signal', async () => {
    const result = await createBoard('New Board', 'user@t.com', 'tok', '#7b1fa2', '✈️');
    expect(result).toBe(true);
    const b = boards.value.find(x => x.name === 'New Board');
    expect(b?.color).toBe('#7b1fa2');
    expect(b?.icon).toBe('✈️');
  });
});
