import { describe, it, expect, beforeEach } from 'vitest';
import type { ItemWithRow } from '../api/types';

function makeItem(overrides: Partial<ItemWithRow>): ItemWithRow {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: 'Dad',
    due_date: '',
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

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

describe('AC2: Upcoming view time buckets', () => {
  beforeEach(async () => {
    const store = await import('./board-store');
    store.items.value = [];
    store.upcomingFilterSearch.value = '';
    store.upcomingFilterLabel.value = null;
    store.upcomingFilterBoards.value = new Set(['board-1', 'board-2']);
  });

  it('groups items into overdue, this-week, next-week, later buckets', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'overdue-1', due_date: daysAgo(3) }),
      makeItem({ id: 'today-1', due_date: daysFromNow(0) }),
      makeItem({ id: 'later-1', due_date: daysFromNow(30) }),
    ];

    const buckets = store.upcomingBuckets.value;
    const keys = buckets.map(b => b.key);

    // Overdue should appear
    expect(keys).toContain('overdue');
    // Today falls in "this-week"
    expect(keys).toContain('this-week');
    // 30 days out is "later"
    expect(keys).toContain('later');

    const overdueItems = buckets.find(b => b.key === 'overdue')!.items;
    expect(overdueItems.map(i => i.id)).toContain('overdue-1');
  });

  it('excludes Done items from upcoming view', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'done-1', status: 'Done', due_date: daysFromNow(1) }),
      makeItem({ id: 'todo-1', status: 'To Do', due_date: daysFromNow(1) }),
    ];

    const allItemIds = store.upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
    expect(allItemIds).not.toContain('done-1');
    expect(allItemIds).toContain('todo-1');
  });

  it('sorts items within each bucket by due_date ascending', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'later-b', due_date: daysFromNow(20) }),
      makeItem({ id: 'later-a', due_date: daysFromNow(15) }),
      makeItem({ id: 'later-c', due_date: daysFromNow(25) }),
    ];

    const laterBucket = store.upcomingBuckets.value.find(b => b.key === 'later');
    expect(laterBucket).toBeDefined();
    expect(laterBucket!.items.map(i => i.id)).toEqual(['later-a', 'later-b', 'later-c']);
  });

  it('hides empty buckets', async () => {
    const store = await import('./board-store');

    // Only overdue items
    store.items.value = [
      makeItem({ id: 'overdue-only', due_date: daysAgo(5) }),
    ];

    const buckets = store.upcomingBuckets.value;
    expect(buckets.length).toBe(1);
    expect(buckets[0].key).toBe('overdue');
  });

  it('shows bucket item counts', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'o1', due_date: daysAgo(1) }),
      makeItem({ id: 'o2', due_date: daysAgo(2) }),
    ];

    const overdueBucket = store.upcomingBuckets.value.find(b => b.key === 'overdue');
    expect(overdueBucket!.items.length).toBe(2);
  });

  it('excludes items with no due date', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'no-date', due_date: '' }),
      makeItem({ id: 'has-date', due_date: daysFromNow(1) }),
    ];

    const allIds = store.upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
    expect(allIds).not.toContain('no-date');
    expect(allIds).toContain('has-date');
  });
});

describe('AC3: Parent items with qualifying children', () => {
  beforeEach(async () => {
    const store = await import('./board-store');
    store.items.value = [];
    store.upcomingFilterSearch.value = '';
    store.upcomingFilterLabel.value = null;
    store.upcomingFilterBoards.value = new Set(['board-1']);
  });

  it('includes parent without due_date when child has qualifying due_date', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'parent-1', due_date: '', parent_id: '' }),
      makeItem({ id: 'child-1', due_date: daysAgo(2), parent_id: 'parent-1' }),
    ];

    const allIds = store.upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
    expect(allIds).toContain('parent-1');
  });

  it('places parent in earliest bucket of its qualifying children', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'parent-1', due_date: '', parent_id: '' }),
      makeItem({ id: 'child-1', due_date: daysFromNow(20), parent_id: 'parent-1' }), // later
      makeItem({ id: 'child-2', due_date: daysAgo(1), parent_id: 'parent-1' }),       // overdue
    ];

    const overdueBucket = store.upcomingBuckets.value.find(b => b.key === 'overdue');
    expect(overdueBucket).toBeDefined();
    expect(overdueBucket!.items.map(i => i.id)).toContain('parent-1');
  });
});

describe('AC5: Upcoming view filters', () => {
  beforeEach(async () => {
    const store = await import('./board-store');
    store.items.value = [];
    store.upcomingFilterSearch.value = '';
    store.upcomingFilterLabel.value = null;
    store.upcomingFilterBoards.value = new Set(['board-1', 'board-2']);
  });

  it('filters by search text', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'match', title: 'Grocery shopping', due_date: daysFromNow(1) }),
      makeItem({ id: 'nomatch', title: 'Fix faucet', due_date: daysFromNow(1) }),
    ];

    store.upcomingFilterSearch.value = 'grocery';
    const allIds = store.upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
    expect(allIds).toContain('match');
    expect(allIds).not.toContain('nomatch');
  });

  it('filters by label', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'labeled', labels: 'Errands', due_date: daysFromNow(1) }),
      makeItem({ id: 'other', labels: 'Home', due_date: daysFromNow(1) }),
    ];

    store.upcomingFilterLabel.value = 'Errands';
    const allIds = store.upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
    expect(allIds).toContain('labeled');
    expect(allIds).not.toContain('other');
  });

  it('filters by board', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'b1', board_id: 'board-1', due_date: daysFromNow(1) }),
      makeItem({ id: 'b2', board_id: 'board-2', due_date: daysFromNow(1) }),
    ];

    store.upcomingFilterBoards.value = new Set(['board-1']);
    const allIds = store.upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
    expect(allIds).toContain('b1');
    expect(allIds).not.toContain('b2');
  });

  it('applies all filters together', async () => {
    const store = await import('./board-store');

    store.items.value = [
      makeItem({ id: 'perfect', title: 'Grocery', labels: 'Errands', board_id: 'board-1', due_date: daysFromNow(1) }),
      makeItem({ id: 'wrong-board', title: 'Grocery', labels: 'Errands', board_id: 'board-2', due_date: daysFromNow(1) }),
      makeItem({ id: 'wrong-label', title: 'Grocery', labels: 'Home', board_id: 'board-1', due_date: daysFromNow(1) }),
      makeItem({ id: 'wrong-search', title: 'Fix faucet', labels: 'Errands', board_id: 'board-1', due_date: daysFromNow(1) }),
    ];

    store.upcomingFilterSearch.value = 'grocery';
    store.upcomingFilterLabel.value = 'Errands';
    store.upcomingFilterBoards.value = new Set(['board-1']);

    const allIds = store.upcomingBuckets.value.flatMap(b => b.items.map(i => i.id));
    expect(allIds).toEqual(['perfect']);
  });
});

describe('AC1: activeView routing', () => {
  it('defaults to board view', async () => {
    const store = await import('./board-store');
    expect(store.activeView.value).toBe('board');
  });

  it('switches to upcoming view', async () => {
    const store = await import('./board-store');
    store.switchToUpcoming();
    expect(store.activeView.value).toBe('upcoming');
  });

  it('switches back to board view', async () => {
    const store = await import('./board-store');
    store.switchToUpcoming();
    store.switchToBoard();
    expect(store.activeView.value).toBe('board');
  });
});
