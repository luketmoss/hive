import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/sheets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/sheets')>()),
  fetchAllItems: vi.fn(),
}));

vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
}));

import { refreshItems } from './actions';
import { items, pendingDeleteIds } from './board-store';
import { fetchAllItems } from '../api/sheets';

const mk = (id: string, parent_id = '') =>
  ({ id, title: id, parent_id, sheetRow: 2 } as any);

describe('refreshItems with a pending delete (#276)', () => {
  beforeEach(() => {
    pendingDeleteIds.clear();
    items.value = [];
  });

  it('keeps a pending-delete item and its sub-items out of the refreshed list', async () => {
    vi.mocked(fetchAllItems).mockResolvedValue([mk('a'), mk('b'), mk('b1', 'b')]);
    pendingDeleteIds.add('b');
    await refreshItems('t');
    expect(items.value.map(i => i.id)).toEqual(['a']);
  });

  it('shows the item again once it is no longer pending (undo or failure)', async () => {
    vi.mocked(fetchAllItems).mockResolvedValue([mk('a'), mk('b')]);
    pendingDeleteIds.add('b');
    await refreshItems('t');
    pendingDeleteIds.delete('b');
    await refreshItems('t');
    expect(items.value.map(i => i.id)).toEqual(['a', 'b']);
  });
});
