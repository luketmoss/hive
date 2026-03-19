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

// --- #177: Text search and due date filter ---

describe('#177 AC2/AC3: Text search filter', () => {
  it('filterSearch filters by title (case-insensitive)', async () => {
    const store = await import('./board-store');
    store.items.value = [
      makeItem({ id: 'a', title: 'Grocery shopping', status: 'To Do', parent_id: '' }),
      makeItem({ id: 'b', title: 'Fix bike', status: 'To Do', parent_id: '' }),
    ];
    store.filterSearch.value = 'grocery';
    const roots = store.rootItems.value;
    expect(roots.map(i => i.id)).toEqual(['a']);
    store.filterSearch.value = '';
  });

  it('filterSearch filters by description', async () => {
    const store = await import('./board-store');
    store.items.value = [
      makeItem({ id: 'a', title: 'Task A', description: 'Buy organic milk', status: 'To Do', parent_id: '' }),
      makeItem({ id: 'b', title: 'Task B', description: 'Clean house', status: 'To Do', parent_id: '' }),
    ];
    store.filterSearch.value = 'milk';
    expect(store.rootItems.value.map(i => i.id)).toEqual(['a']);
    store.filterSearch.value = '';
  });

  it('filterSearch filters by labels', async () => {
    const store = await import('./board-store');
    store.items.value = [
      makeItem({ id: 'a', title: 'Task A', labels: 'Urgent, Home', status: 'To Do', parent_id: '' }),
      makeItem({ id: 'b', title: 'Task B', labels: 'Work', status: 'To Do', parent_id: '' }),
    ];
    store.filterSearch.value = 'urgent';
    expect(store.rootItems.value.map(i => i.id)).toEqual(['a']);
    store.filterSearch.value = '';
  });

  it('AC3: search matches sub-item title, shows parent', async () => {
    const store = await import('./board-store');
    store.items.value = [
      makeItem({ id: 'parent', title: 'Groceries', status: 'To Do', parent_id: '' }),
      makeItem({ id: 'child', title: 'Buy milk', status: 'To Do', parent_id: 'parent' }),
      makeItem({ id: 'other', title: 'Fix bike', status: 'To Do', parent_id: '' }),
    ];
    store.filterSearch.value = 'milk';
    const roots = store.rootItems.value;
    expect(roots.map(i => i.id)).toEqual(['parent']);
    store.filterSearch.value = '';
  });
});

describe('#177 AC4/AC5: Due date filter', () => {
  function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function tomorrowStr(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function nextWeekStr(): string {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('AC4: filterDue="today" shows only items due today', async () => {
    const store = await import('./board-store');
    store.items.value = [
      makeItem({ id: 'today', title: 'Due today', due_date: todayStr(), status: 'To Do', parent_id: '' }),
      makeItem({ id: 'tomorrow', title: 'Due tomorrow', due_date: tomorrowStr(), status: 'To Do', parent_id: '' }),
      makeItem({ id: 'nodate', title: 'No due', due_date: '', status: 'To Do', parent_id: '' }),
    ];
    store.filterDue.value = 'today';
    expect(store.rootItems.value.map(i => i.id)).toEqual(['today']);
    store.filterDue.value = null;
  });

  it('AC5: filterDue="this-week" shows items due today through Sunday', async () => {
    const store = await import('./board-store');
    store.items.value = [
      makeItem({ id: 'today', title: 'Due today', due_date: todayStr(), status: 'To Do', parent_id: '' }),
      makeItem({ id: 'tomorrow', title: 'Due tomorrow', due_date: tomorrowStr(), status: 'To Do', parent_id: '' }),
      makeItem({ id: 'far', title: 'Due next week', due_date: nextWeekStr(), status: 'To Do', parent_id: '' }),
    ];
    store.filterDue.value = 'this-week';
    const roots = store.rootItems.value;
    // Today and tomorrow should be within this week (10 days out should not)
    expect(roots.some(i => i.id === 'today')).toBe(true);
    expect(roots.some(i => i.id === 'far')).toBe(false);
    store.filterDue.value = null;
  });
});

describe('#177 AC6: Filters combine (AND)', () => {
  it('search + label + due all combine', async () => {
    const store = await import('./board-store');
    const today = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    store.items.value = [
      makeItem({ id: 'match', title: 'Grocery run', labels: 'Urgent', due_date: today, status: 'To Do', parent_id: '' }),
      makeItem({ id: 'no-label', title: 'Grocery run', labels: 'Home', due_date: today, status: 'To Do', parent_id: '' }),
      makeItem({ id: 'no-search', title: 'Fix bike', labels: 'Urgent', due_date: today, status: 'To Do', parent_id: '' }),
      makeItem({ id: 'no-due', title: 'Grocery run', labels: 'Urgent', due_date: '', status: 'To Do', parent_id: '' }),
    ];
    store.filterSearch.value = 'grocery';
    store.filterLabel.value = 'Urgent';
    store.filterDue.value = 'today';
    expect(store.rootItems.value.map(i => i.id)).toEqual(['match']);
    store.filterSearch.value = '';
    store.filterLabel.value = null;
    store.filterDue.value = null;
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

// ---- Theme persistence (AC1, AC3, AC4) ----

describe('theme persistence (AC1, AC3, AC4)', () => {
  let originalGetItem: typeof Storage.prototype.getItem;
  let originalSetItem: typeof Storage.prototype.setItem;

  beforeEach(() => {
    originalGetItem = Storage.prototype.getItem;
    originalSetItem = Storage.prototype.setItem;
    vi.resetModules();
    // Reset the data-theme attribute between tests
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
    Storage.prototype.setItem = originalSetItem;
    localStorage.removeItem('hive-theme');
    document.documentElement.removeAttribute('data-theme');
  });

  // AC1: No stored value → default to 'system'
  it('defaults to "system" when localStorage has no stored value', async () => {
    localStorage.removeItem('hive-theme');
    const store = await import('./board-store');
    expect(store.loadTheme()).toBe('system');
  });

  // AC4: Stored 'dark' survives re-read
  it('loads "dark" from localStorage when previously stored', async () => {
    localStorage.setItem('hive-theme', 'dark');
    const store = await import('./board-store');
    expect(store.loadTheme()).toBe('dark');
  });

  it('loads "light" from localStorage when previously stored', async () => {
    localStorage.setItem('hive-theme', 'light');
    const store = await import('./board-store');
    expect(store.loadTheme()).toBe('light');
  });

  it('loads "system" from localStorage when previously stored', async () => {
    localStorage.setItem('hive-theme', 'system');
    const store = await import('./board-store');
    expect(store.loadTheme()).toBe('system');
  });

  // AC4: Invalid value falls back to 'system'
  it('falls back to "system" when localStorage has an invalid value', async () => {
    localStorage.setItem('hive-theme', 'invalid');
    const store = await import('./board-store');
    expect(store.loadTheme()).toBe('system');
  });

  // AC3: setTheme persists to localStorage and updates signal
  it('persists theme to localStorage when setTheme is called', async () => {
    localStorage.removeItem('hive-theme');
    const store = await import('./board-store');

    store.setTheme('dark');
    expect(store.theme.value).toBe('dark');
    expect(localStorage.getItem('hive-theme')).toBe('dark');

    store.setTheme('light');
    expect(store.theme.value).toBe('light');
    expect(localStorage.getItem('hive-theme')).toBe('light');

    store.setTheme('system');
    expect(store.theme.value).toBe('system');
    expect(localStorage.getItem('hive-theme')).toBe('system');
  });

  // AC3: cycleTheme cycles Light → Dark → System → Light
  it('cycleTheme cycles Light → Dark → System → Light', async () => {
    const store = await import('./board-store');

    store.setTheme('light');
    store.cycleTheme();
    expect(store.theme.value).toBe('dark');

    store.cycleTheme();
    expect(store.theme.value).toBe('system');

    store.cycleTheme();
    expect(store.theme.value).toBe('light');
  });

  // AC4: localStorage errors handled gracefully on read
  it('handles localStorage errors gracefully on read', async () => {
    Storage.prototype.getItem = () => { throw new Error('quota exceeded'); };
    const store = await import('./board-store');
    expect(store.loadTheme()).toBe('system');
  });

  // AC4: localStorage errors handled gracefully on write
  it('handles localStorage errors gracefully on write', async () => {
    localStorage.removeItem('hive-theme');
    const store = await import('./board-store');
    Storage.prototype.setItem = () => { throw new Error('quota exceeded'); };
    expect(() => store.setTheme('dark')).not.toThrow();
    expect(store.theme.value).toBe('dark');
  });
});
