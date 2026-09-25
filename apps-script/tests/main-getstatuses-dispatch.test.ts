import { describe, it, expect } from 'vitest';
import { loadStatusesPath, callDoGet, type ApiStatus, type ApiResponse } from './apps-script-sandbox';

// #266 — `?action=getStatuses` with no `board_id` returns every board's
// statuses in one flat array, so almanac (luketmoss/keel#353) can skip a
// getBoards call plus one getStatuses call per board. The single-board form
// is unchanged, and an empty `board_id` stays an error — only an *absent*
// parameter means "all boards". These tests drive the real `main.js` +
// `statuses.js` sources through the sandboxed loader.

const API_KEY = 'test-key';

/** Build a Statuses row (7 columns) from the fields a test cares about. */
function statusRow(fields: {
  id: string;
  board_id: string;
  name?: string;
  sort_order?: number;
  color?: string;
  is_terminal?: boolean;
  created_at?: string;
}) {
  return [
    fields.id,
    fields.board_id,
    fields.name ?? 'Status ' + fields.id,
    fields.sort_order ?? 0,
    fields.color ?? '',
    fields.is_terminal ?? false,
    fields.created_at ?? '',
  ];
}

// Board B's rows are interleaved with board A's in the sheet, so the ordering
// assertions actually exercise "first appearance" grouping rather than
// happening to match sheet order for free.
const ROWS = [
  statusRow({ id: 'a2', board_id: 'A', name: 'In Progress', sort_order: 2 }),
  statusRow({ id: 'b1', board_id: 'B', name: 'To Do', sort_order: 1 }),
  statusRow({ id: 'a1', board_id: 'A', name: 'To Do', sort_order: 1 }),
  statusRow({ id: 'a3', board_id: 'A', name: 'Done', sort_order: 3, is_terminal: true }),
  statusRow({ id: 'b2', board_id: 'B', name: 'Done', sort_order: 2, is_terminal: true }),
];

function ids(response: ApiResponse<ApiStatus[]>) {
  return response.data.map((s) => s.id);
}

// `rows` has no default: AC4's "sheet doesn't exist" case needs to pass
// `undefined` explicitly, which a default parameter can't distinguish from
// "omitted".
function getStatusesRequest(params: Record<string, string | undefined>, rows: any[] | undefined) {
  const sandbox = loadStatusesPath(rows, API_KEY);
  return callDoGet<ApiStatus[]>(sandbox, { action: 'getStatuses', key: API_KEY, ...params });
}

describe('AC1: no board_id returns every board\'s statuses', () => {
  it('returns a flat array covering every row in the sheet', () => {
    const res = getStatusesRequest({}, ROWS);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(5);
  });

  it('groups by board_id in first-appearance order, sort_order ascending within a board', () => {
    const res = getStatusesRequest({}, ROWS);
    // Board A's first row (a2) is the sheet's first row, board B's first row
    // (b1) is its second — so A's whole group precedes B's, even though A's
    // and B's rows are interleaved in the sheet and a2 isn't A's lowest
    // sort_order.
    expect(ids(res)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
  });

  it('each row carries the same fields as the single-board form', () => {
    const res = getStatusesRequest({}, ROWS);
    const a1 = res.data.find((s) => s.id === 'a1');
    expect(a1).toEqual({
      id: 'a1',
      board_id: 'A',
      name: 'To Do',
      sort_order: 1,
      color: '',
      is_terminal: false,
      created_at: '',
    });
  });
});

describe('AC2: the single-board form is unchanged', () => {
  it('returns only that board\'s rows, sorted by sort_order', () => {
    const res = getStatusesRequest({ board_id: 'A' }, ROWS);
    expect(res.success).toBe(true);
    expect(ids(res)).toEqual(['a1', 'a2', 'a3']);
  });

  it('returns an empty array for an unknown board_id', () => {
    const res = getStatusesRequest({ board_id: 'unknown-board' }, ROWS);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });
});

describe('AC3: an empty board_id is still an error', () => {
  it('rejects an empty-string board_id', () => {
    const res = getStatusesRequest({ board_id: '' }, ROWS);
    expect(res.success).toBe(false);
    expect(res.error).toBe('board_id must not be empty');
    expect(res.data).toBeUndefined();
  });

  it('rejects a whitespace-only board_id', () => {
    const res = getStatusesRequest({ board_id: '   ' }, ROWS);
    expect(res.success).toBe(false);
    expect(res.error).toBe('board_id must not be empty');
  });

  it('only an absent parameter means "all boards"', () => {
    // Sanity check the two are actually distinguishable through doGet: an
    // absent board_id key vs. one present with an empty value.
    const absent = getStatusesRequest({}, ROWS);
    const empty = getStatusesRequest({ board_id: '' }, ROWS);
    expect(absent.success).toBe(true);
    expect(empty.success).toBe(false);
  });
});

describe('AC4: an empty sheet', () => {
  it('returns an empty array when the sheet has only a header row', () => {
    const res = getStatusesRequest({}, []);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('returns an empty array when the Statuses sheet does not exist', () => {
    const res = getStatusesRequest({}, undefined);
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });
});

describe('dispatch layer sanity', () => {
  it('rejects a bad API key before reaching getAllStatuses', () => {
    const sandbox = loadStatusesPath(ROWS, API_KEY);
    const res = callDoGet(sandbox, { action: 'getStatuses', key: 'wrong' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/API key/);
  });

  it('loads the real sources rather than a transcription', () => {
    const sandbox = loadStatusesPath(ROWS, API_KEY);
    expect(typeof sandbox.doGet).toBe('function');
    expect(typeof sandbox.getStatuses).toBe('function');
    expect(typeof sandbox.getAllStatuses).toBe('function');
    expect(sandbox.STATUS_COLUMN_COUNT).toBe(7);
    const all = sandbox.getAllStatuses() as ApiStatus[];
    expect(all.map((s) => s.id)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2']);
  });
});
