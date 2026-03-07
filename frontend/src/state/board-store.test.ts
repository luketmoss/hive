import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ItemWithRow } from '../api/types';

function makeItem(overrides: Partial<ItemWithRow>): ItemWithRow {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    title: 'Test Item',
    description: '',
    status: 'Done',
    owner: 'Dad',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    sort_order: 1,
    created_by: 'test@test.com',
    board_id: '',
    sheetRow: 2,
    ...overrides,
  };
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('Done column 7-day filter (AC1)', () => {
  it('recentDoneItems includes only items completed within last 7 days', async () => {
    const { items, recentDoneItems, allDoneItems } = await import('./board-store');

    items.value = [
      makeItem({ id: 'recent-1', completed_at: daysAgoISO(1), sort_order: 1 }),
      makeItem({ id: 'recent-2', completed_at: daysAgoISO(5), sort_order: 2 }),
      makeItem({ id: 'old-1', completed_at: daysAgoISO(10), sort_order: 3 }),
      makeItem({ id: 'old-2', completed_at: daysAgoISO(30), sort_order: 4 }),
    ];

    expect(recentDoneItems.value.map(i => i.id)).toEqual(['recent-1', 'recent-2']);
    expect(allDoneItems.value.length).toBe(4);
  });

  it('excludes items with no completed_at from the Done column', async () => {
    const { items, recentDoneItems } = await import('./board-store');

    items.value = [
      makeItem({ id: 'no-date', completed_at: '', sort_order: 1 }),
      makeItem({ id: 'has-date', completed_at: daysAgoISO(2), sort_order: 2 }),
    ];

    expect(recentDoneItems.value.map(i => i.id)).toEqual(['has-date']);
  });

  it('columns.Done uses recentDoneItems, not all Done items', async () => {
    const { items, columns } = await import('./board-store');

    items.value = [
      makeItem({ id: 'recent', completed_at: daysAgoISO(3), sort_order: 1 }),
      makeItem({ id: 'old', completed_at: daysAgoISO(14), sort_order: 2 }),
      makeItem({ id: 'todo', status: 'To Do', completed_at: '', sort_order: 1 }),
    ];

    expect(columns.value['Done'].map(i => i.id)).toEqual(['recent']);
    expect(columns.value['To Do'].map(i => i.id)).toEqual(['todo']);
  });

  it('excludes subtasks (items with parent_id) from Done column', async () => {
    const { items, recentDoneItems } = await import('./board-store');

    items.value = [
      makeItem({ id: 'root', parent_id: '', completed_at: daysAgoISO(1), sort_order: 1 }),
      makeItem({ id: 'child', parent_id: 'root', completed_at: daysAgoISO(1), sort_order: 1 }),
    ];

    expect(recentDoneItems.value.map(i => i.id)).toEqual(['root']);
  });
});

describe('Archive link visibility (AC2)', () => {
  it('hasArchivedItems is true when older Done items exist', async () => {
    const { items, hasArchivedItems } = await import('./board-store');

    items.value = [
      makeItem({ id: 'recent', completed_at: daysAgoISO(2), sort_order: 1 }),
      makeItem({ id: 'old', completed_at: daysAgoISO(14), sort_order: 2 }),
    ];

    expect(hasArchivedItems.value).toBe(true);
  });

  it('hasArchivedItems is false when all Done items are recent', async () => {
    const { items, hasArchivedItems } = await import('./board-store');

    items.value = [
      makeItem({ id: 'recent-1', completed_at: daysAgoISO(1), sort_order: 1 }),
      makeItem({ id: 'recent-2', completed_at: daysAgoISO(3), sort_order: 2 }),
    ];

    expect(hasArchivedItems.value).toBe(false);
  });
});

describe('Archive dialog sorting (AC3)', () => {
  it('allDoneItemsSorted returns items sorted by completed_at descending', async () => {
    const { items, allDoneItemsSorted } = await import('./board-store');

    items.value = [
      makeItem({ id: 'old', completed_at: daysAgoISO(20), sort_order: 1 }),
      makeItem({ id: 'recent', completed_at: daysAgoISO(1), sort_order: 2 }),
      makeItem({ id: 'mid', completed_at: daysAgoISO(5), sort_order: 3 }),
    ];

    expect(allDoneItemsSorted.value.map(i => i.id)).toEqual(['recent', 'mid', 'old']);
  });
});

// We need to test the actual store, not a mock.
// To do this, we need to re-import the module for each test group
// since the signal is created at module load time.

describe('viewMode persistence (AC4)', () => {
  let originalGetItem: typeof Storage.prototype.getItem;
  let originalSetItem: typeof Storage.prototype.setItem;

  beforeEach(() => {
    originalGetItem = Storage.prototype.getItem;
    originalSetItem = Storage.prototype.setItem;
    vi.resetModules();
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
    Storage.prototype.setItem = originalSetItem;
    localStorage.removeItem('hive-view-mode');
  });

  it('defaults to "board" when localStorage has no stored value', async () => {
    localStorage.removeItem('hive-view-mode');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('board');
  });

  it('loads "list" from localStorage when previously stored', async () => {
    localStorage.setItem('hive-view-mode', 'list');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('list');
  });

  it('loads "board" from localStorage when previously stored', async () => {
    localStorage.setItem('hive-view-mode', 'board');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('board');
  });

  it('defaults to "board" when localStorage has an invalid value', async () => {
    localStorage.setItem('hive-view-mode', 'invalid');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('board');
  });

  it('persists preference to localStorage when setViewMode is called', async () => {
    localStorage.removeItem('hive-view-mode');
    const store = await import('./board-store');

    store.setViewMode('list');
    expect(store.viewMode.value).toBe('list');
    expect(localStorage.getItem('hive-view-mode')).toBe('list');

    store.setViewMode('board');
    expect(store.viewMode.value).toBe('board');
    expect(localStorage.getItem('hive-view-mode')).toBe('board');
  });

  it('handles localStorage errors gracefully on read', async () => {
    Storage.prototype.getItem = () => { throw new Error('quota exceeded'); };
    const store = await import('./board-store');
    // Should default to 'board' without throwing
    expect(store.viewMode.value).toBe('board');
  });

  it('handles localStorage errors gracefully on write', async () => {
    localStorage.removeItem('hive-view-mode');
    const store = await import('./board-store');
    Storage.prototype.setItem = () => { throw new Error('quota exceeded'); };
    // Should not throw
    expect(() => store.setViewMode('list')).not.toThrow();
    expect(store.viewMode.value).toBe('list');
  });
});
