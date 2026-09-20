import { describe, it, expect, afterEach, vi } from 'vitest';
import type { ItemWithRow } from '../api/types';

/**
 * #240: deep-link to an item by URL. Covers the `item` query param end to end —
 * writing it on selection, resolving it on cold load, and the graceful failure
 * path for an id that cannot be reached.
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
    { id: 'board-3', name: 'Secret', created_at: '', created_by: '' },
  ];
  store.currentUserEmail.value = 'user@test.com';
  store.permissions.value = [
    { board_id: 'board-1', user_email: 'user@test.com', role: 'owner', sheetRow: 2 },
    { board_id: 'board-2', user_email: 'user@test.com', role: 'owner', sheetRow: 3 },
    { board_id: 'board-3', user_email: 'other@test.com', role: 'owner', sheetRow: 4 },
  ] as any;
  store.items.value = [
    makeItem({ id: 'item-a', title: 'Buy milk', board_id: 'board-1' }),
    makeItem({ id: 'item-b', title: 'File taxes', board_id: 'board-2' }),
    makeItem({ id: 'item-secret', title: 'Hidden', board_id: 'board-3' }),
  ];
  store.activeBoardId.value = 'board-1';
  store.activeView.value = 'board';
  store.selectedItemId.value = null;
  store.toastMessage.value = null;
  return store;
}

const params = () => new URLSearchParams(window.location.search);
const itemParam = () => params().get('item');

afterEach(() => {
  window.history.replaceState(null, '', window.location.pathname);
});

describe('#240 AC1: opening an item puts it in the URL', () => {
  it('selectItem writes ?item= and sets the document title', async () => {
    const { selectItem, selectedItemId } = await setup();

    selectItem('item-a');

    expect(selectedItemId.value).toBe('item-a');
    expect(itemParam()).toBe('item-a');
    expect(document.title).toBe('Hive — Buy milk');
  });

  it('keeps existing board and view params alongside item', async () => {
    const { selectItem } = await setup();
    window.history.replaceState(null, '', '?board=board-1&view=upcoming');

    selectItem('item-a');

    expect(params().get('board')).toBe('board-1');
    expect(params().get('view')).toBe('upcoming');
    expect(params().get('item')).toBe('item-a');
  });

  it('round-trips: a written param reopens the same item on init', async () => {
    const store = await setup();
    store.selectItem('item-b');
    const url = window.location.search;

    // Simulate a reload: clear selection, re-run init against the same URL
    store.selectedItemId.value = null;
    window.history.replaceState(null, '', url);
    store.initSelectedItemFromUrl();

    expect(store.selectedItemId.value).toBe('item-b');
  });

  it('does not add a history entry', async () => {
    const { selectItem, clearSelectedItem } = await setup();
    const spy = vi.spyOn(window.history, 'pushState');

    selectItem('item-a');
    clearSelectedItem();

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('#240 AC2: a cold item URL lands on the item board', () => {
  it('activates the item own board when the board param names another', async () => {
    const { initSelectedItemFromUrl, activeBoardId, selectedItemId } = await setup();
    window.history.replaceState(null, '', '?board=board-1&item=item-b');

    initSelectedItemFromUrl();

    expect(activeBoardId.value).toBe('board-2');
    expect(selectedItemId.value).toBe('item-b');
    expect(params().get('board')).toBe('board-2');
  });

  it('resolves the board when the board param is absent', async () => {
    const { initSelectedItemFromUrl, activeBoardId } = await setup();
    window.history.replaceState(null, '', '?item=item-b');

    initSelectedItemFromUrl();

    expect(activeBoardId.value).toBe('board-2');
  });

  it('sets the document title to the item, reverting to the board on close', async () => {
    const { initSelectedItemFromUrl, clearSelectedItem } = await setup();
    window.history.replaceState(null, '', '?item=item-b');

    initSelectedItemFromUrl();
    expect(document.title).toBe('Hive — File taxes');

    clearSelectedItem();
    expect(document.title).toBe('Hive — Work');
  });

  it('leaves the user on the item board after closing', async () => {
    const { initSelectedItemFromUrl, clearSelectedItem, activeBoardId } = await setup();
    window.history.replaceState(null, '', '?item=item-b');

    initSelectedItemFromUrl();
    clearSelectedItem();

    expect(activeBoardId.value).toBe('board-2');
    expect(params().get('board')).toBe('board-2');
  });

  it('is a no-op when no item param is present', async () => {
    const { initSelectedItemFromUrl, selectedItemId, toastMessage, activeBoardId } = await setup();
    window.history.replaceState(null, '', '?board=board-1');

    initSelectedItemFromUrl();

    expect(selectedItemId.value).toBeNull();
    expect(toastMessage.value).toBeNull();
    expect(activeBoardId.value).toBe('board-1');
  });
});

describe('#240 AC3: closing the detail clears the param', () => {
  it('clearSelectedItem removes item but leaves board and view', async () => {
    const { selectItem, clearSelectedItem, selectedItemId } = await setup();
    window.history.replaceState(null, '', '?board=board-1&view=upcoming');
    selectItem('item-a');

    clearSelectedItem();

    expect(selectedItemId.value).toBeNull();
    expect(params().get('item')).toBeNull();
    expect(params().get('board')).toBe('board-1');
    expect(params().get('view')).toBe('upcoming');
  });

  it('switchBoard drops the item param along with the selection', async () => {
    const { selectItem, switchBoard, selectedItemId } = await setup();
    selectItem('item-a');

    switchBoard('board-2');

    expect(selectedItemId.value).toBeNull();
    expect(itemParam()).toBeNull();
    expect(params().get('board')).toBe('board-2');
  });
});

describe('#240 AC4: an unresolvable item degrades gracefully', () => {
  it('clears the param and toasts for an id that does not exist', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?board=board-2&item=does-not-exist');

    // The real init sequence: board first, then the item deep link
    store.initActiveBoardFromUrl();
    store.initSelectedItemFromUrl();

    expect(store.selectedItemId.value).toBeNull();
    expect(itemParam()).toBeNull();
    expect(store.activeBoardId.value).toBe('board-2');
    expect(store.toastMessage.value?.text).toBe(store.ITEM_UNAVAILABLE_MESSAGE);
  });

  it('uses the identical message for an item on an inaccessible board', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?item=item-secret');

    store.initSelectedItemFromUrl();

    expect(store.selectedItemId.value).toBeNull();
    expect(itemParam()).toBeNull();
    expect(store.toastMessage.value?.text).toBe(store.ITEM_UNAVAILABLE_MESSAGE);
  });

  it('reveals nothing about the unreachable item and does not switch board', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?item=item-secret');

    store.initSelectedItemFromUrl();

    expect(store.toastMessage.value?.text).not.toContain('Hidden');
    expect(store.toastMessage.value?.text).not.toContain('Secret');
    expect(store.activeBoardId.value).toBe('board-1');
    expect(document.title).not.toContain('Hidden');
  });

  it('throws nothing when items have not loaded', async () => {
    const store = await setup();
    store.items.value = [];
    window.history.replaceState(null, '', '?item=item-a');

    expect(() => store.initSelectedItemFromUrl()).not.toThrow();
    expect(store.selectedItemId.value).toBeNull();
    expect(itemParam()).toBeNull();
  });
});

describe('#240 AC5: upcoming view keeps its context', () => {
  it('opens the item over Upcoming without forcing a board view', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?view=upcoming&item=item-b');
    store.initActiveViewFromUrl();

    store.initSelectedItemFromUrl();

    expect(store.activeView.value).toBe('upcoming');
    expect(store.selectedItemId.value).toBe('item-b');
    // Board resolved for state only - the board param stays absent
    expect(params().get('board')).toBeNull();
    expect(store.activeBoardId.value).toBe('board-2');
  });

  it('returns to Upcoming with view=upcoming intact on close', async () => {
    const store = await setup();
    window.history.replaceState(null, '', '?view=upcoming&item=item-b');
    store.initActiveViewFromUrl();
    store.initSelectedItemFromUrl();

    store.clearSelectedItem();

    expect(params().get('view')).toBe('upcoming');
    expect(params().get('item')).toBeNull();
    expect(store.activeView.value).toBe('upcoming');
    expect(document.title).toBe('Hive — Upcoming');
  });
});
