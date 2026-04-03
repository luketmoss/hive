import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ItemWithRow, BoardStatus } from '../api/types';

const TEST_BOARD_ID = 'test-board';

const DEFAULT_STATUSES: BoardStatus[] = [
  { id: 's1', board_id: TEST_BOARD_ID, name: 'To Do', sort_order: 1, color: '#e3f2fd', is_terminal: false, created_at: '' },
  { id: 's2', board_id: TEST_BOARD_ID, name: 'In Progress', sort_order: 2, color: '#fff3e0', is_terminal: false, created_at: '' },
  { id: 's3', board_id: TEST_BOARD_ID, name: 'Done', sort_order: 3, color: '#e8f5e9', is_terminal: true, created_at: '' },
];

function makeItem(overrides: Partial<ItemWithRow>): ItemWithRow {
  return {
    id: 'item-' + Math.random().toString(36).slice(2),
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    labels: '',
    parent_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: '',
    sort_order: 1,
    created_by: 'test@test.com',
    board_id: TEST_BOARD_ID,
    sheetRow: 2,
    ...overrides,
  };
}

/** Helper to set up default statuses and activeBoardId after dynamic import. */
async function setupBoardStatuses() {
  const store = await import('./board-store');
  store.statuses.value = DEFAULT_STATUSES;
  store.activeBoardId.value = TEST_BOARD_ID;
  return store;
}

describe('Column sort — AC1: Default sort mode is custom', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults all columns to custom when localStorage is empty', async () => {
    const store = await setupBoardStatuses();
    const modes = store.loadColumnSortModes();
    expect(modes['To Do']).toBe('custom');
    expect(modes['In Progress']).toBe('custom');
    expect(modes['Done']).toBe('custom');
  });

  it('columns computed uses sort_order by default', async () => {
    const store = await setupBoardStatuses();
    store.columnSortModes.value = { 'To Do': 'custom', 'In Progress': 'custom', 'Done': 'custom' };
    store.items.value = [
      makeItem({ id: 'c', status: 'To Do', sort_order: 3 }),
      makeItem({ id: 'a', status: 'To Do', sort_order: 1 }),
      makeItem({ id: 'b', status: 'To Do', sort_order: 2 }),
    ];
    expect(store.columns.value['To Do'].map(i => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('Column sort — AC2: Sort by due date (earliest first, nulls last)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('sorts items by due_date ascending, nulls last', async () => {
    const store = await setupBoardStatuses();
    store.columnSortModes.value = { 'To Do': 'due_date', 'In Progress': 'custom', 'Done': 'custom' };
    store.items.value = [
      makeItem({ id: 'no-date', status: 'To Do', due_date: '', sort_order: 1 }),
      makeItem({ id: 'late', status: 'To Do', due_date: '2025-12-31', sort_order: 2 }),
      makeItem({ id: 'early', status: 'To Do', due_date: '2025-01-01', sort_order: 3 }),
    ];
    expect(store.columns.value['To Do'].map(i => i.id)).toEqual(['early', 'late', 'no-date']);
  });

  it('places multiple undated items after all dated items', async () => {
    const store = await setupBoardStatuses();
    store.columnSortModes.value = { 'To Do': 'due_date', 'In Progress': 'custom', 'Done': 'custom' };
    store.items.value = [
      makeItem({ id: 'no-date-1', status: 'To Do', due_date: '', sort_order: 1 }),
      makeItem({ id: 'dated', status: 'To Do', due_date: '2025-06-01', sort_order: 2 }),
      makeItem({ id: 'no-date-2', status: 'To Do', due_date: '', sort_order: 3 }),
    ];
    const ids = store.columns.value['To Do'].map(i => i.id);
    expect(ids[0]).toBe('dated');
    expect(ids.slice(1)).toEqual(expect.arrayContaining(['no-date-1', 'no-date-2']));
  });
});

describe('Column sort — AC3: Sort by creation date (oldest first)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('sorts items by created_at ascending', async () => {
    const store = await setupBoardStatuses();
    store.columnSortModes.value = { 'To Do': 'custom', 'In Progress': 'created', 'Done': 'custom' };
    store.items.value = [
      makeItem({ id: 'newest', status: 'In Progress', created_at: '2025-03-10T10:00:00Z', sort_order: 1 }),
      makeItem({ id: 'oldest', status: 'In Progress', created_at: '2025-01-01T00:00:00Z', sort_order: 2 }),
      makeItem({ id: 'middle', status: 'In Progress', created_at: '2025-02-01T00:00:00Z', sort_order: 3 }),
    ];
    expect(store.columns.value['In Progress'].map(i => i.id)).toEqual(['oldest', 'middle', 'newest']);
  });
});

describe('Column sort — AC4: Sort preference persists across reloads', () => {
  let originalGetItem: typeof Storage.prototype.getItem;
  let originalSetItem: typeof Storage.prototype.setItem;

  beforeEach(() => {
    originalGetItem = Storage.prototype.getItem;
    originalSetItem = Storage.prototype.setItem;
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
    Storage.prototype.setItem = originalSetItem;
    localStorage.clear();
  });

  it('persists sort mode to localStorage via setColumnSortMode', async () => {
    const { setColumnSortMode } = await import('./board-store');
    setColumnSortMode('To Do', 'due_date');
    expect(localStorage.getItem('hive-sort-to-do')).toBe('due_date');
  });

  it('restores sort mode from localStorage on load', async () => {
    localStorage.setItem('hive-sort-to-do', 'due_date');
    localStorage.setItem('hive-sort-in-progress', 'created');
    const store = await setupBoardStatuses();
    const modes = store.loadColumnSortModes();
    expect(modes['To Do']).toBe('due_date');
    expect(modes['In Progress']).toBe('created');
    expect(modes['Done']).toBe('custom');
  });

  it('ignores invalid localStorage values', async () => {
    localStorage.setItem('hive-sort-to-do', 'invalid-value');
    const store = await setupBoardStatuses();
    const modes = store.loadColumnSortModes();
    expect(modes['To Do']).toBe('custom');
  });

  it('handles localStorage errors gracefully on read', async () => {
    Storage.prototype.getItem = () => { throw new Error('quota exceeded'); };
    const { loadColumnSortModes } = await import('./board-store');
    expect(() => loadColumnSortModes()).not.toThrow();
    // With storage error and no statuses loaded, modes will be empty — just verify no throw
  });

  it('handles localStorage errors gracefully on write', async () => {
    const { setColumnSortMode } = await import('./board-store');
    Storage.prototype.setItem = () => { throw new Error('quota exceeded'); };
    expect(() => setColumnSortMode('To Do', 'due_date')).not.toThrow();
  });

  it('setColumnSortMode updates the signal', async () => {
    const { setColumnSortMode, columnSortModes } = await import('./board-store');
    setColumnSortMode('In Progress', 'created');
    expect(columnSortModes.value['In Progress']).toBe('created');
  });
});

describe('Column sort — Done column always uses completion date', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('columns.Done is always recentDoneItems regardless of sort mode signal', async () => {
    const store = await setupBoardStatuses();
    // Set Done to a non-custom mode (should be ignored for Done column)
    store.columnSortModes.value = { 'To Do': 'custom', 'In Progress': 'custom', 'Done': 'due_date' };
    const now = new Date().toISOString();
    store.items.value = [
      { ...makeItem({ id: 'done1', status: 'Done', completed_at: now, sort_order: 2 }) },
      { ...makeItem({ id: 'done2', status: 'Done', completed_at: now, sort_order: 1 }) },
    ];
    // Done column comes from recentDoneItems (sorted by sort_order), not the sort signal
    const doneIds = store.columns.value['Done'].map(i => i.id);
    expect(doneIds).toContain('done1');
    expect(doneIds).toContain('done2');
  });
});
