import { describe, it, expect, vi, beforeEach } from 'vitest';

// #288: archive / unarchive. Only the two Sheets writes are mocked; the store
// is real, so accessibleBoards, archivedBoards and Upcoming are exercised as
// the app runs them.

const mockSetBoardArchivedAt = vi.fn().mockResolvedValue(undefined);
const mockAppendAuditEntry = vi.fn().mockResolvedValue(undefined);

vi.mock('../api/sheets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/sheets')>()),
  setBoardArchivedAt: (...args: unknown[]) => mockSetBoardArchivedAt(...args),
  appendAuditEntry: (...args: unknown[]) => mockAppendAuditEntry(...args),
}));
vi.mock('../demo/is-demo-mode', () => ({ isDemoMode: () => false }));

import { archiveBoard, unarchiveBoard } from './actions';
import {
  boards, permissions, items, activeBoardId, currentUserEmail, toastMessage,
  accessibleBoards, archivedBoards, upcomingBuckets, upcomingFilterBoards, activeView,
  showArchivedBoardsDialog,
} from './board-store';
import type { ItemWithRow } from '../api/types';

const ME = 'owner@test.com';

function item(id: string, boardId: string, status: string, dueDate: string): ItemWithRow {
  return {
    id, title: id, description: '', status, owner: '', due_date: dueDate, labels: '',
    parent_id: '', created_at: '', updated_at: '', completed_at: '', sort_order: 1,
    created_by: '', board_id: boardId, sheetRow: 2,
  };
}

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  mockSetBoardArchivedAt.mockResolvedValue(undefined);
  currentUserEmail.value = ME;
  boards.value = [
    { id: 'home', name: 'Home', created_at: '', created_by: '' },
    { id: 'garage', name: 'Garage', created_at: '', created_by: '' },
  ];
  permissions.value = [
    { board_id: 'home', user_email: ME, role: 'owner' },
    { board_id: 'garage', user_email: ME, role: 'owner' },
  ];
  items.value = [
    item('g-todo', 'garage', 'To Do', tomorrow),
    item('g-doing', 'garage', 'In Progress', tomorrow),
    item('h-todo', 'home', 'To Do', tomorrow),
  ];
  upcomingFilterBoards.value = new Set(['home', 'garage']);
  activeView.value = 'board';
  activeBoardId.value = 'garage';
  toastMessage.value = null;
});

function upcomingIds() {
  return upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
}

describe('archiveBoard (AC1, AC2)', () => {
  it('writes an archived_at timestamp and an audit row, and nothing else', async () => {
    expect(await archiveBoard('garage', ME, 'tok')).toBe(true);

    expect(mockSetBoardArchivedAt).toHaveBeenCalledTimes(1);
    const [boardId, archivedAt] = mockSetBoardArchivedAt.mock.calls[0];
    expect(boardId).toBe('garage');
    expect(new Date(archivedAt).toISOString()).toBe(archivedAt);
    expect(mockAppendAuditEntry).toHaveBeenCalledWith('garage', 'board_archived', 'archived_at', '', archivedAt, ME, 'tok');
    // Items are untouched: still in the store, same statuses.
    expect(items.value.map(i => [i.id, i.status])).toEqual([
      ['g-todo', 'To Do'], ['g-doing', 'In Progress'], ['h-todo', 'To Do'],
    ]);
  });

  it('switches to the first remaining board and toasts with Undo', async () => {
    await archiveBoard('garage', ME, 'tok');
    expect(activeBoardId.value).toBe('home');
    expect(toastMessage.value?.text).toBe('Garage archived');
    expect(toastMessage.value?.action?.label).toBe('Undo');
  });

  it('drops the board from accessibleBoards and its items from Upcoming, whatever their status', async () => {
    expect(upcomingIds()).toEqual(expect.arrayContaining(['g-todo', 'g-doing']));
    await archiveBoard('garage', ME, 'tok');
    expect(accessibleBoards.value.map(b => b.id)).toEqual(['home']);
    expect(archivedBoards.value.map(b => b.id)).toEqual(['garage']);
    expect(upcomingIds()).toEqual(['h-todo']);
  });

  it('Undo restores the board and goes back to it', async () => {
    await archiveBoard('garage', ME, 'tok');
    await toastMessage.value!.action!.fn();
    await Promise.resolve();
    expect(mockSetBoardArchivedAt).toHaveBeenLastCalledWith('garage', '', 'tok');
    expect(accessibleBoards.value.map(b => b.id)).toEqual(['home', 'garage']);
    expect(activeBoardId.value).toBe('garage');
  });

  it('rolls back and stays on the board when the write fails', async () => {
    mockSetBoardArchivedAt.mockRejectedValueOnce(new Error('boom'));
    expect(await archiveBoard('garage', ME, 'tok')).toBe(false);
    expect(accessibleBoards.value.map(b => b.id)).toEqual(['home', 'garage']);
    expect(activeBoardId.value).toBe('garage');
    expect(toastMessage.value).toMatchObject({ type: 'error' });
    expect(mockAppendAuditEntry).not.toHaveBeenCalled();
  });
});

describe('unarchiveBoard (AC3)', () => {
  beforeEach(() => {
    boards.value = boards.value.map(b => (b.id === 'garage' ? { ...b, archived_at: '2026-10-01T00:00:00.000Z' } : b));
    upcomingFilterBoards.value = new Set(['home']);
    activeBoardId.value = 'home';
  });

  it('clears archived_at, audits it, and brings the items back to Upcoming', async () => {
    expect(await unarchiveBoard('garage', ME, 'tok')).toBe(true);
    expect(mockSetBoardArchivedAt).toHaveBeenCalledWith('garage', '', 'tok');
    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      'garage', 'board_unarchived', 'archived_at', '2026-10-01T00:00:00.000Z', '', ME, 'tok'
    );
    expect(archivedBoards.value).toEqual([]);
    expect(upcomingIds()).toEqual(expect.arrayContaining(['g-todo', 'g-doing', 'h-todo']));
  });

  it('toasts "restored" with an Open action that switches to the board and closes the dialog', async () => {
    showArchivedBoardsDialog.value = true;
    await unarchiveBoard('garage', ME, 'tok');
    expect(toastMessage.value?.text).toBe('Garage restored');
    expect(activeBoardId.value).toBe('home');
    expect(showArchivedBoardsDialog.value).toBe(true);
    toastMessage.value!.action!.fn();
    expect(activeBoardId.value).toBe('garage');
    expect(showArchivedBoardsDialog.value).toBe(false);
  });
});

describe('archivedBoards ordering (AC3)', () => {
  it('lists the most recently archived first and hides boards the user cannot access', () => {
    boards.value = [
      { id: 'a', name: 'A', created_at: '', created_by: '', archived_at: '2026-01-01T00:00:00.000Z' },
      { id: 'b', name: 'B', created_at: '', created_by: '', archived_at: '2026-06-01T00:00:00.000Z' },
      { id: 'c', name: 'C', created_at: '', created_by: '', archived_at: '2026-09-01T00:00:00.000Z' },
    ];
    permissions.value = [
      { board_id: 'a', user_email: ME, role: 'owner' },
      { board_id: 'b', user_email: '*', role: 'member' },
    ];
    expect(archivedBoards.value.map(b => b.id)).toEqual(['b', 'a']);
  });
});
