import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../auth/reauth', () => ({
  attemptReauth: vi.fn(),
  ReauthFailedError: class ReauthFailedError extends Error {},
}));

import { deleteAllBoardStatuses, deleteAllBoardLabels } from './sheets';

const mockFetch = vi.fn() as Mock;
globalThis.fetch = mockFetch;

function ok(body: any) {
  return { ok: true, status: 200, json: async () => body, text: async () => '' };
}

/** Wire fetch: values GET returns `rows`, metadata GET returns the sheet, POSTs succeed. */
function wire(tab: string, rows: any[][]) {
  mockFetch.mockImplementation(async (url: string, init?: any) => {
    if (init?.method === 'POST') return ok({});
    if (String(url).includes('/values/')) return ok({ values: rows });
    return ok({ sheets: [{ properties: { title: tab, sheetId: 42 } }] });
  });
}

function deletedStartIndexes(): number[] {
  return mockFetch.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(init.body).requests[0].deleteDimension.range.startIndex);
}

beforeEach(() => mockFetch.mockReset());

describe('deleteAllBoardStatuses (#292)', () => {
  it('deletes only the board rows, bottom-to-top, looking up the sheet once', async () => {
    wire('Statuses', [
      ['s1', 'b1', 'To Do', 1, '', false],
      ['s2', 'b2', 'To Do', 1, '', false],
      ['s3', 'b1', 'Done', 2, '', true],
      ['s4', 'b1', 'Mid', 3, '', false],
    ]);
    await deleteAllBoardStatuses('b1', 'tok');
    // data rows 0,2,3 -> sheet rows 2,4,5 -> zero-based startIndex 1,3,4; descending
    expect(deletedStartIndexes()).toEqual([4, 3, 1]);
    const metaCalls = mockFetch.mock.calls.filter(([u, i]) => !i?.method && !String(u).includes('/values/'));
    expect(metaCalls).toHaveLength(1);
  });

  it('does nothing when the board has no rows', async () => {
    wire('Statuses', [['s2', 'b2', 'To Do', 1, '', false]]);
    await deleteAllBoardStatuses('b1', 'tok');
    expect(deletedStartIndexes()).toEqual([]);
  });
});

describe('deleteAllBoardLabels (#292)', () => {
  it('deletes only the board rows, bottom-to-top', async () => {
    wire('Labels', [
      ['a', '#fff', 'b1'],
      ['b', '#fff', 'b2'],
      ['c', '#fff', 'b1'],
    ]);
    await deleteAllBoardLabels('b1', 'tok');
    expect(deletedStartIndexes()).toEqual([3, 1]);
  });
});
