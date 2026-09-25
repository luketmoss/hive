import { describe, it, expect } from 'vitest';
import {
  loadAuditPath,
  callDoGet,
  type AuditEntry,
  type CellValue,
} from './apps-script-sandbox';

// #265 — getAuditLog decorates every row with the item's title and board_id,
// joined from Items (live items) or the item's last `deleted` row (removed
// items), without changing the seven fields the log already returns.

const API_KEY = 'test-key';

/** Build an Audit Log row (7 columns). */
function auditRow(fields: {
  timestamp: string;
  item_id?: string;
  action?: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  actor?: string;
}): CellValue[] {
  return [
    fields.timestamp,
    fields.item_id ?? 'item-1',
    fields.action ?? 'status_changed',
    fields.field ?? 'status',
    fields.old_value ?? 'To Do',
    fields.new_value ?? 'Done',
    fields.actor ?? 'web',
  ];
}

/** Build an Items row (14 columns): id, title, ..., board_id at the end. */
function itemRow(id: string, title: string, boardId: string): CellValue[] {
  return [
    id,          // ID
    title,       // TITLE
    '',          // DESCRIPTION
    'Done',      // STATUS
    '',          // OWNER
    '',          // DUE_DATE
    '',          // LABELS
    '',          // PARENT_ID
    '2026-09-01T00:00:00.000Z', // CREATED_AT
    '2026-09-12T00:00:00.000Z', // UPDATED_AT
    '2026-09-12T00:00:00.000Z', // COMPLETED_AT
    1,           // SORT_ORDER
    '',          // CREATED_BY
    boardId,     // BOARD_ID
  ];
}

function query(
  auditRows: CellValue[][],
  itemRows: CellValue[][],
  params: Record<string, string | undefined>,
) {
  const { sandbox, itemsReadCount } = loadAuditPath(auditRows, itemRows, API_KEY);
  const res = callDoGet<AuditEntry[]>(sandbox, { action: 'getAuditLog', key: API_KEY, ...params });
  return { res, itemsReadCount };
}

describe('#265 AC1: rows for existing items carry title and board', () => {
  it('adds the item\'s current title and board_id to its row', () => {
    const { res } = query(
      [auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'x', action: 'completed' })],
      [itemRow('x', 'Buy milk', 'B1')],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe('Buy milk');
    expect(res.data[0].board_id).toBe('B1');
  });

  it('uses the item\'s current title, not its title when the event was logged', () => {
    // old_value/new_value on this row describe a status change, not a title
    // at the time — the row's title comes from the live Items row regardless.
    const { res } = query(
      [auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'x', action: 'completed', old_value: 'In Progress', new_value: 'Done' })],
      [itemRow('x', 'Buy oat milk', 'B1')],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data[0].title).toBe('Buy oat milk');
    expect(res.data[0].old_value).toBe('In Progress');
    expect(res.data[0].new_value).toBe('Done');
  });

  it('gives every row for the same item the same title and board_id', () => {
    const { res } = query(
      [
        auditRow({ timestamp: '2026-09-12T15:00:00.000Z', item_id: 'x', action: 'status_changed' }),
        auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'x', action: 'completed' }),
      ],
      [itemRow('x', 'Buy milk', 'B1')],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data).toHaveLength(2);
    expect(res.data[0].title).toBe('Buy milk');
    expect(res.data[0].board_id).toBe('B1');
    expect(res.data[1].title).toBe('Buy milk');
    expect(res.data[1].board_id).toBe('B1');
  });

  it('leaves the other seven fields exactly as before', () => {
    const { res } = query(
      [auditRow({
        timestamp: '2026-09-12T15:00:00.000Z',
        item_id: 'x',
        action: 'completed',
        field: 'status',
        old_value: 'In Progress',
        new_value: 'Done',
        actor: 'luke@example.com',
      })],
      [itemRow('x', 'Buy milk', 'B1')],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data[0]).toEqual({
      timestamp: '2026-09-12T15:00:00.000Z',
      item_id: 'x',
      action: 'completed',
      field: 'status',
      old_value: 'In Progress',
      new_value: 'Done',
      actor: 'luke@example.com',
      title: 'Buy milk',
      board_id: 'B1',
    });
  });
});

describe('#265 AC2: rows for deleted items are named from their deleted row', () => {
  it('names a completed row from the deleted row even when no Items row exists', () => {
    const { res } = query(
      [
        auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'y', action: 'completed' }),
        auditRow({ timestamp: '2026-09-20T10:00:00.000Z', item_id: 'y', action: 'deleted', old_value: 'Old task', new_value: '' }),
      ],
      [], // no Items row — y was deleted
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data).toHaveLength(1);
    expect(res.data[0].title).toBe('Old task');
    expect(res.data[0].board_id).toBe('');
  });

  it('finds the deleted row anywhere in the log, not only inside from/to', () => {
    // The deleted row (the 20th) falls outside the requested range (the
    // 12th) and must still be found and used to name the completion.
    const { res } = query(
      [
        auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'y', action: 'completed' }),
        auditRow({ timestamp: '2026-09-20T10:00:00.000Z', item_id: 'y', action: 'deleted', old_value: 'Old task', new_value: '' }),
      ],
      [],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data.map((e) => e.action)).toEqual(['completed']);
    expect(res.data[0].title).toBe('Old task');
  });

  it('uses the last deleted row in the log when there is more than one', () => {
    const { res } = query(
      [
        auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'y', action: 'completed' }),
        auditRow({ timestamp: '2026-09-15T10:00:00.000Z', item_id: 'y', action: 'deleted', old_value: 'First delete title', new_value: '' }),
        auditRow({ timestamp: '2026-09-20T10:00:00.000Z', item_id: 'y', action: 'deleted', old_value: 'Second delete title', new_value: '' }),
      ],
      [],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data[0].title).toBe('Second delete title');
  });

  it('returns empty title and board_id for an id with neither an Items row nor a deleted row', () => {
    // Models a board-level row (item_id holds a board id) or a hand-removed
    // record — no Items row, and no `deleted` row anywhere in the log.
    const { res } = query(
      [auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'board-created-id', action: 'board_created' })],
      [],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data[0].title).toBe('');
    expect(res.data[0].board_id).toBe('');
  });
});

describe('#265 AC3: existing fields, filters and order are unchanged', () => {
  it('keeps the same rows, in the same order, under from/to/audit_action filters', () => {
    const rows = [
      auditRow({ timestamp: '2026-09-11T18:00:00.000Z', item_id: 'a', action: 'completed' }),
      auditRow({ timestamp: '2026-09-12T15:00:00.000Z', item_id: 'b', action: 'status_changed' }),
      auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'b', action: 'completed' }),
      auditRow({ timestamp: '2026-09-13T15:00:00.000Z', item_id: 'c', action: 'updated', field: 'title' }),
    ];
    const items = [itemRow('a', 'A', 'B1'), itemRow('b', 'B', 'B1'), itemRow('c', 'C', 'B2')];

    const all = query(rows, items, { from: '2026-09-11', to: '2026-09-13' });
    expect(all.res.data.map((e) => e.item_id)).toEqual(['a', 'b', 'b', 'c']);

    const filtered = query(rows, items, { from: '2026-09-11', to: '2026-09-13', audit_action: 'completed' });
    expect(filtered.res.data.map((e) => e.item_id)).toEqual(['a', 'b']);
  });

  it('only adds the two new keys — the original seven are untouched', () => {
    const { res } = query(
      [auditRow({ timestamp: '2026-09-12T15:00:00.000Z', item_id: 'a', action: 'completed', old_value: 'To Do', new_value: 'Done', actor: 'web' })],
      [itemRow('a', 'A', 'B1')],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(Object.keys(res.data[0]).sort()).toEqual(
      ['action', 'actor', 'board_id', 'field', 'item_id', 'new_value', 'old_value', 'timestamp', 'title'].sort(),
    );
  });
});

describe('#265 AC4: the Items sheet is read at most once per call', () => {
  it('reads Items once for a response covering many rows and many items', () => {
    const rows = [
      auditRow({ timestamp: '2026-09-12T15:00:00.000Z', item_id: 'a', action: 'completed' }),
      auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'b', action: 'completed' }),
      auditRow({ timestamp: '2026-09-12T17:00:00.000Z', item_id: 'c', action: 'completed' }),
    ];
    const items = [itemRow('a', 'A', 'B1'), itemRow('b', 'B', 'B1'), itemRow('c', 'C', 'B2')];

    const { itemsReadCount } = query(rows, items, { from: '2026-09-12', to: '2026-09-12' });
    expect(itemsReadCount()).toBe(1);
  });

  it('does not read Items at all when no rows match the filters', () => {
    const rows = [auditRow({ timestamp: '2026-09-12T15:00:00.000Z', item_id: 'a', action: 'completed' })];
    const items = [itemRow('a', 'A', 'B1')];

    const { res, itemsReadCount } = query(rows, items, { from: '2026-09-20', to: '2026-09-20' });
    expect(res.data).toEqual([]);
    expect(itemsReadCount()).toBe(0);
  });
});
