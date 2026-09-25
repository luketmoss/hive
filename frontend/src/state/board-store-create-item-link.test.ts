import { describe, it, expect, afterEach, vi } from 'vitest';
import type { ItemWithRow } from '../api/types';

/**
 * #263: deep-link to create an item with its due date filled in. Covers the
 * `new`+`due` query params end to end — opening the modal pre-filled on cold
 * load, the malformed-date fallback, the `board` toast, `item` taking
 * priority (AC5), and stripping the params on close.
 */

function makeItem(overrides: Partial<ItemWithRow>): ItemWithRow {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: 'Mom',
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

async function setup() {
  const store = await import('./board-store');
  store.boards.value = [
    { id: 'board-1', name: 'Family', created_at: '', created_by: '' },
    { id: 'board-2', name: 'Work', created_at: '', created_by: '' },
  ];
  store.currentUserEmail.value = 'user@test.com';
  store.permissions.value = [
    { board_id: 'board-1', user_email: 'user@test.com', role: 'owner', sheetRow: 2 },
    { board_id: 'board-2', user_email: 'user@test.com', role: 'owner', sheetRow: 3 },
  ] as any;
  store.items.value = [
    makeItem({ id: 'item-a', title: 'Buy milk', board_id: 'board-1' }),
  ];
  store.activeBoardId.value = 'board-1';
  store.activeView.value = 'board';
  store.selectedItemId.value = null;
  store.showCreateModal.value = false;
  store.createModalInitialDueDate.value = null;
  store.toastMessage.value = null;
  return store;
}

const params = () => new URLSearchParams(window.location.search);

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname);
});

describe('#263 AC1: new=1 + due opens the modal with the date set', () => {
  it('sets createModalInitialDueDate and opens the modal', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?new=1&due=2026-09-24');

    store.initCreateItemFromUrl();

    expect(store.showCreateModal.value).toBe(true);
    expect(store.createModalInitialDueDate.value).toBe('2026-09-24');
  });
});

describe('#263 AC2: board decides the target board', () => {
  it('does not toast when the named board is accessible', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?board=board-2&new=1&due=2026-09-24');
    store.initActiveBoardFromUrl();

    store.initCreateItemFromUrl();

    expect(store.toastMessage.value).toBeNull();
    expect(store.showCreateModal.value).toBe(true);
  });

  it('still opens the modal with no board param, falling back silently', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?new=1&due=2026-09-24');
    store.initActiveBoardFromUrl();

    store.initCreateItemFromUrl();

    expect(store.toastMessage.value).toBeNull();
    expect(store.showCreateModal.value).toBe(true);
    expect(store.activeBoardId.value).toBe('board-1');
  });

  it('toasts BOARD_UNAVAILABLE_MESSAGE when the board param names a nonexistent board, but still opens the modal', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?board=does-not-exist&new=1&due=2026-09-24');
    store.initActiveBoardFromUrl();

    store.initCreateItemFromUrl();

    expect(store.toastMessage.value?.text).toBe(store.BOARD_UNAVAILABLE_MESSAGE);
    expect(store.showCreateModal.value).toBe(true);
    expect(store.createModalInitialDueDate.value).toBe('2026-09-24');
    // Silent fallback still applies (AC2's own text)
    expect(store.activeBoardId.value).toBe('board-1');
  });

  it('uses the identical message for a board the user cannot access', async () => {
    const store = await setup();
    store.boards.value = [
      ...store.boards.value,
      { id: 'board-secret', name: 'Secret', created_at: '', created_by: '' },
    ];
    window.history.replaceState(null, '', '?board=board-secret&new=1&due=2026-09-24');
    store.initActiveBoardFromUrl();

    store.initCreateItemFromUrl();

    expect(store.toastMessage.value?.text).toBe(store.BOARD_UNAVAILABLE_MESSAGE);
  });

  it('does not toast for a bad board param on a plain load (no new=1)', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?board=does-not-exist');
    store.initActiveBoardFromUrl();

    store.initCreateItemFromUrl();

    expect(store.toastMessage.value).toBeNull();
    expect(store.showCreateModal.value).toBe(false);
  });
});

describe('#263 AC4: a missing or malformed due still opens the modal', () => {
  it.each([
    ['missing', null],
    ['empty', ''],
    ['single-digit month', '2026-9-24'],
    ['non-date word', 'tomorrow'],
    ['invalid day (Feb 30)', '2026-02-30'],
    ['invalid month (13)', '2026-13-01'],
  ])('opens with an empty due date for %s due param', async (_label, badValue) => {
    const store = await setup();
    const qs = badValue === null ? '?new=1' : `?new=1&due=${encodeURIComponent(badValue)}`;
    window.history.replaceState(null, '', qs);

    store.initCreateItemFromUrl();

    expect(store.showCreateModal.value).toBe(true);
    expect(store.createModalInitialDueDate.value).toBe('');
    expect(store.toastMessage.value).toBeNull();
  });

  it('accepts a well-formed date in the past', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?new=1&due=2020-01-01');

    store.initCreateItemFromUrl();

    expect(store.createModalInitialDueDate.value).toBe('2020-01-01');
  });
});

describe('#263 AC5: params that do not ask for the modal', () => {
  it('is a no-op for due without new', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?due=2026-09-24');

    store.initCreateItemFromUrl();

    expect(store.showCreateModal.value).toBe(false);
    expect(store.createModalInitialDueDate.value).toBeNull();
  });

  it('lets the item deep link win over new+due, and strips new/due', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?item=item-a&new=1&due=2026-09-24');
    store.initActiveBoardFromUrl();
    store.initSelectedItemFromUrl();

    store.initCreateItemFromUrl();

    expect(store.selectedItemId.value).toBe('item-a');
    expect(store.showCreateModal.value).toBe(false);
    expect(params().get('new')).toBeNull();
    expect(params().get('due')).toBeNull();
  });

  it('treats new with a value other than 1 as absent', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?new=true&due=2026-09-24');

    store.initCreateItemFromUrl();

    expect(store.showCreateModal.value).toBe(false);
  });
});

describe('#263 AC3: clearCreateItemUrlParams', () => {
  it('removes new and due but leaves board, view and demo', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?board=board-1&view=upcoming&demo=true&new=1&due=2026-09-24');

    store.clearCreateItemUrlParams();

    expect(params().get('new')).toBeNull();
    expect(params().get('due')).toBeNull();
    expect(params().get('board')).toBe('board-1');
    expect(params().get('view')).toBe('upcoming');
    expect(params().get('demo')).toBe('true');
  });

  it('does not add a history entry', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?new=1&due=2026-09-24');
    const spy = vi.spyOn(window.history, 'pushState');

    store.clearCreateItemUrlParams();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
