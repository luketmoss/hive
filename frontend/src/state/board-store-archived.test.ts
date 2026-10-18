import { describe, it, expect, beforeEach } from 'vitest';
import {
  boards, permissions, items, activeBoardId, currentUserEmail, toastMessage, selectedItemId,
  accessibleBoards, initActiveBoardFromUrl, initSelectedItemFromUrl, ITEM_UNAVAILABLE_MESSAGE,
} from './board-store';
import type { ItemWithRow } from '../api/types';

// #288 AC2: an archived board is unreachable by deep link — it behaves like a
// board the user has no access to.

const ME = 'me@test.com';

function item(id: string, boardId: string): ItemWithRow {
  return {
    id, title: id, description: '', status: 'To Do', owner: '', due_date: '', labels: '',
    parent_id: '', created_at: '', updated_at: '', completed_at: '', sort_order: 1,
    created_by: '', board_id: boardId, sheetRow: 2,
  };
}

function setUrl(search: string) {
  window.history.replaceState(null, '', '/hive/' + search);
}

beforeEach(() => {
  currentUserEmail.value = ME;
  boards.value = [
    { id: 'garage', name: 'Garage', created_at: '', created_by: '', archived_at: '2026-10-01T00:00:00.000Z' },
    { id: 'home', name: 'Home', created_at: '', created_by: '' },
  ];
  permissions.value = [
    { board_id: 'garage', user_email: ME, role: 'owner' },
    { board_id: 'home', user_email: ME, role: 'owner' },
  ];
  items.value = [item('g1', 'garage'), item('h1', 'home')];
  activeBoardId.value = '';
  selectedItemId.value = null;
  toastMessage.value = null;
});

describe('#288 AC2: archived boards are hidden from navigation', () => {
  it('accessibleBoards (switcher, Ctrl+1–9, Move to board) leaves the archived board out', () => {
    expect(accessibleBoards.value.map(b => b.id)).toEqual(['home']);
  });

  it('?board=<archived> falls back to the first active board', () => {
    setUrl('?board=garage');
    initActiveBoardFromUrl();
    expect(activeBoardId.value).toBe('home');
  });

  it('a cold load with no board param skips an archived first board', () => {
    setUrl('');
    initActiveBoardFromUrl();
    expect(activeBoardId.value).toBe('home');
  });

  it('?item=<archived-board item> shows the unavailable toast and opens nothing', () => {
    setUrl('?item=g1');
    initSelectedItemFromUrl();
    expect(selectedItemId.value).toBeNull();
    expect(toastMessage.value?.text).toBe(ITEM_UNAVAILABLE_MESSAGE);
  });
});
