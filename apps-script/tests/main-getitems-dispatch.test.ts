import { describe, it, expect } from 'vitest';
import { loadReadPath, callDoGet, type ApiItem, type ApiResponse } from './apps-script-sandbox';

// #241 — `getItems()` implements due_after/due_before, but the `getItems` case
// in `doGet` did not forward them, so the filter was unreachable over the API.
// These tests drive the real `main.js` + `items.js` sources through the
// sandboxed loader, so deleting the forwarding again makes them fail.

const API_KEY = 'test-key';

/** Build an Items row (14 columns) from the fields a test cares about. */
function itemRow(fields: {
  id: string;
  title?: string;
  status?: string;
  owner?: string;
  due_date?: string;
  labels?: string;
  parent_id?: string;
  sort_order?: number;
  board_id?: string;
}) {
  return [
    fields.id,
    fields.title ?? 'Item ' + fields.id,
    '', // description
    fields.status ?? 'To Do',
    fields.owner ?? '',
    fields.due_date ?? '',
    fields.labels ?? '',
    fields.parent_id ?? '',
    '', // created_at
    '', // updated_at
    '', // completed_at
    fields.sort_order ?? 0,
    '', // created_by
    fields.board_id ?? 'board-1',
  ];
}

const ROWS = [
  itemRow({ id: '1', due_date: '2026-08-31', sort_order: 1 }),
  itemRow({ id: '2', due_date: '2026-09-01', sort_order: 2, owner: 'Luke', labels: 'home' }),
  itemRow({ id: '3', due_date: '2026-09-15', sort_order: 3, owner: 'Sam', status: 'In Progress' }),
  itemRow({ id: '4', due_date: '2026-09-30', sort_order: 4, owner: 'Luke', parent_id: '3' }),
  itemRow({ id: '5', due_date: '2026-10-01', sort_order: 5 }),
  itemRow({ id: '6', due_date: '', sort_order: 6, owner: 'Luke' }),
];

function ids(response: ApiResponse) {
  return response.data.map((i) => i.id);
}

function getItemsRequest(params: Record<string, string | undefined> = {}) {
  const sandbox = loadReadPath(ROWS, API_KEY);
  return callDoGet(sandbox, { action: 'getItems', key: API_KEY, ...params });
}

describe('AC1: due_after/due_before reach the filter through doGet', () => {
  it('returns only items inside an inclusive range', () => {
    const res = getItemsRequest({ due_after: '2026-09-01', due_before: '2026-09-30' });
    expect(res.success).toBe(true);
    expect(ids(res)).toEqual(['2', '3', '4']);
  });

  it('honours due_after on its own, inclusive of the boundary', () => {
    expect(ids(getItemsRequest({ due_after: '2026-09-15' }))).toEqual(['3', '4', '5']);
  });

  it('honours due_before on its own, inclusive of the boundary', () => {
    expect(ids(getItemsRequest({ due_before: '2026-09-01' }))).toEqual(['1', '2']);
  });

  it('excludes items with an empty due_date', () => {
    const res = getItemsRequest({ due_after: '2026-01-01' });
    expect(ids(res)).not.toContain('6');
  });
});

describe('AC2: absent date parameters change nothing', () => {
  it('returns every item, in sort_order, when no date range is given', () => {
    const res = getItemsRequest();
    expect(res.success).toBe(true);
    expect(ids(res)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('matches the unfiltered shape field for field', () => {
    const res = getItemsRequest();
    expect(res.data[1]).toEqual({
      id: '2',
      title: 'Item 2',
      description: '',
      status: 'To Do',
      owner: 'Luke',
      due_date: '2026-09-01',
      labels: 'home',
      parent_id: '',
      created_at: '',
      updated_at: '',
      completed_at: '',
      sort_order: 2,
      created_by: '',
      board_id: 'board-1',
    });
  });
});

describe('AC3: date filters compose with the existing six', () => {
  it('intersects with owner', () => {
    const res = getItemsRequest({ due_after: '2026-09-01', due_before: '2026-09-30', owner: 'Luke' });
    expect(ids(res)).toEqual(['2', '4']);
  });

  it('intersects with status', () => {
    const res = getItemsRequest({ due_after: '2026-09-01', status: 'In Progress' });
    expect(ids(res)).toEqual(['3']);
  });

  it('intersects with label', () => {
    const res = getItemsRequest({ due_before: '2026-09-30', label: 'home' });
    expect(ids(res)).toEqual(['2']);
  });

  it('intersects with parent_id', () => {
    const res = getItemsRequest({ due_after: '2026-09-01', parent_id: '3' });
    expect(ids(res)).toEqual(['4']);
  });

  it('intersects with board_id', () => {
    const res = getItemsRequest({ due_after: '2026-10-01', board_id: 'board-1' });
    expect(ids(res)).toEqual(['5']);
    expect(ids(getItemsRequest({ due_after: '2026-10-01', board_id: 'board-2' }))).toEqual([]);
  });

  it('intersects with roots_only', () => {
    const res = getItemsRequest({ due_after: '2026-09-01', due_before: '2026-09-30', roots_only: 'true' });
    expect(ids(res)).toEqual(['2', '3']);
  });
});

describe('AC4: the test drives the real dispatch layer', () => {
  it('rejects a bad API key before reaching the filter', () => {
    const sandbox = loadReadPath(ROWS, API_KEY);
    const res = callDoGet(sandbox, { action: 'getItems', key: 'wrong', due_after: '2026-09-01' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/API key/);
  });

  it('loads the real sources rather than a transcription', () => {
    // If the loader silently failed to evaluate a source file, every other
    // assertion here would be vacuous. Pin the seam: doGet and getItems are
    // real functions from src/, and getItems reaches the stubbed sheet.
    const sandbox = loadReadPath(ROWS, API_KEY);
    expect(typeof sandbox.doGet).toBe('function');
    expect(typeof sandbox.getItems).toBe('function');
    expect(sandbox.ITEM_COLUMN_COUNT).toBe(14);
    const filtered = sandbox.getItems({ due_after: '2026-10-01' }) as ApiItem[];
    expect(filtered.map((i) => i.id)).toEqual(['5']);
  });
});
