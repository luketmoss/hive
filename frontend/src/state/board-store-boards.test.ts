import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ItemWithRow, Board } from '../api/types';

function makeItem(overrides: Partial<ItemWithRow>): ItemWithRow {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: 'Mom',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: '',
    sort_order: 1,
    created_by: 'test@test.com',
    board_id: 'board-1',
    sheetRow: 2,
    ...overrides,
  };
}

describe('AC2: Items scoped to a board', () => {
  it('boardItems returns only items for the active board', async () => {
    const { items, boards, activeBoardId, boardItems } = await import('./board-store');

    boards.value = [
      { id: 'board-1', name: 'Family', created_at: '', created_by: '' },
      { id: 'board-2', name: 'Work', created_at: '', created_by: '' },
    ];
    activeBoardId.value = 'board-1';

    items.value = [
      makeItem({ id: 'a', board_id: 'board-1' }),
      makeItem({ id: 'b', board_id: 'board-2' }),
      makeItem({ id: 'c', board_id: 'board-1' }),
    ];

    expect(boardItems.value.map(i => i.id)).toEqual(['a', 'c']);
  });

  it('boardItems includes children whose parent is on the active board', async () => {
    const { items, boards, activeBoardId, boardItems } = await import('./board-store');

    boards.value = [{ id: 'board-1', name: 'Family', created_at: '', created_by: '' }];
    activeBoardId.value = 'board-1';

    items.value = [
      makeItem({ id: 'parent', board_id: 'board-1', parent_id: '' }),
      makeItem({ id: 'child', board_id: 'board-1', parent_id: 'parent' }),
    ];

    expect(boardItems.value.map(i => i.id)).toEqual(['parent', 'child']);
  });

  it('returns all items when no active board is set', async () => {
    const { items, activeBoardId, boardItems } = await import('./board-store');

    activeBoardId.value = '';
    items.value = [
      makeItem({ id: 'a', board_id: 'board-1' }),
      makeItem({ id: 'b', board_id: 'board-2' }),
    ];

    expect(boardItems.value.length).toBe(2);
  });
});

describe('AC3: switchBoard resets filters but not view mode', () => {
  it('resets filters and selection when switching boards', async () => {
    const { boards, activeBoardId, filterOwner, filterLabel, selectedItemId, switchBoard } = await import('./board-store');

    boards.value = [
      { id: 'board-1', name: 'Family', created_at: '', created_by: '' },
      { id: 'board-2', name: 'Work', created_at: '', created_by: '' },
    ];
    activeBoardId.value = 'board-1';
    filterOwner.value = 'Mom';
    filterLabel.value = 'Home';
    selectedItemId.value = 'some-item';

    switchBoard('board-2');

    expect(activeBoardId.value).toBe('board-2');
    expect(filterOwner.value).toBeNull();
    expect(filterLabel.value).toBeNull();
    expect(selectedItemId.value).toBeNull();
  });

  it('does NOT reset view mode when switching boards', async () => {
    const { boards, activeBoardId, viewMode, setViewMode, switchBoard } = await import('./board-store');

    boards.value = [
      { id: 'board-1', name: 'Family', created_at: '', created_by: '' },
      { id: 'board-2', name: 'Work', created_at: '', created_by: '' },
    ];
    activeBoardId.value = 'board-1';
    setViewMode('list');

    switchBoard('board-2');

    expect(viewMode.value).toBe('list');
  });

  it('updates document title when switching boards', async () => {
    const { boards, activeBoardId, switchBoard } = await import('./board-store');

    boards.value = [
      { id: 'board-1', name: 'Family Board', created_at: '', created_by: '' },
      { id: 'board-2', name: 'Work Projects', created_at: '', created_by: '' },
    ];
    activeBoardId.value = 'board-1';

    switchBoard('board-2');

    expect(document.title).toBe('Hive \u2014 Work Projects');
  });
});

describe('AC3: initActiveBoardFromUrl reads board from URL', () => {
  afterEach(() => {
    // Reset URL
    window.history.replaceState(null, '', window.location.pathname);
  });

  it('selects board from URL ?board= param', async () => {
    const { boards, activeBoardId, initActiveBoardFromUrl } = await import('./board-store');

    boards.value = [
      { id: 'board-1', name: 'Family', created_at: '', created_by: '' },
      { id: 'board-2', name: 'Work', created_at: '', created_by: '' },
    ];

    window.history.replaceState(null, '', '?board=board-2');
    initActiveBoardFromUrl();

    expect(activeBoardId.value).toBe('board-2');
  });

  it('falls back to first board when URL param is invalid', async () => {
    const { boards, activeBoardId, initActiveBoardFromUrl } = await import('./board-store');

    boards.value = [
      { id: 'board-1', name: 'Family', created_at: '', created_by: '' },
      { id: 'board-2', name: 'Work', created_at: '', created_by: '' },
    ];

    window.history.replaceState(null, '', '?board=nonexistent');
    initActiveBoardFromUrl();

    expect(activeBoardId.value).toBe('board-1');
  });
});

describe('activeBoard computed', () => {
  it('returns the currently active board object', async () => {
    const { boards, activeBoardId, activeBoard } = await import('./board-store');

    boards.value = [
      { id: 'board-1', name: 'Family', created_at: '', created_by: '' },
      { id: 'board-2', name: 'Work', created_at: '', created_by: '' },
    ];
    activeBoardId.value = 'board-2';

    expect(activeBoard.value?.name).toBe('Work');
  });

  it('returns null when no board matches', async () => {
    const { boards, activeBoardId, activeBoard } = await import('./board-store');

    boards.value = [];
    activeBoardId.value = 'nonexistent';

    expect(activeBoard.value).toBeNull();
  });
});
