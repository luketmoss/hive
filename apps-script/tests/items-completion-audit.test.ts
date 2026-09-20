import { describe, it, expect } from 'vitest';
import {
  loadSources,
  makeWritableSheet,
  makeUtilities,
  type CellValue,
  type Sandbox,
} from './apps-script-sandbox';

// #239 AC1/AC2, Apps Script side — `updateItem` must emit a `completed` or
// `reopened` audit row alongside the existing `status_changed` row, for the
// item and for every child cascaded by #162.
//
// Driven through the real `items.js` + `rules.js` + `audit.js` sources in the
// sandbox (#243). The one seam is `getSpreadsheet`, so `getSheet` and
// `getStatuses` both resolve through the same fake spreadsheet.

interface AuditRow {
  timestamp: string;
  item_id: string;
  action: string;
  field: string;
  old_value: string;
  new_value: string;
  actor: string;
}

function itemRow(fields: {
  id: string;
  status?: string;
  parent_id?: string;
  completed_at?: string;
  board_id?: string;
}): CellValue[] {
  return [
    fields.id,
    'Item ' + fields.id,
    '', // description
    fields.status ?? 'To Do',
    '', // owner
    '', // due_date
    '', // labels
    fields.parent_id ?? '',
    '', // created_at
    '', // updated_at
    fields.completed_at ?? '',
    1, // sort_order
    '', // created_by
    fields.board_id ?? 'board-1',
  ];
}

function statusRow(name: string, sortOrder: number, isTerminal: boolean): CellValue[] {
  return ['st-' + name, 'board-1', name, sortOrder, '#ccc', isTerminal, ''];
}

// Two terminal columns on one board, so "terminal to terminal" is expressible.
const STATUS_ROWS = [
  statusRow('To Do', 1, false),
  statusRow('In Progress', 2, false),
  statusRow('Done', 3, true),
  statusRow('Shipped', 4, true),
];

interface Harness {
  sandbox: Sandbox;
  /** The Audit Log as appended, in order — read after the call under test. */
  readonly audit: AuditRow[];
  /** The live Items rows, so a test can assert what was persisted. */
  itemRows: CellValue[][];
}

function harness(rows: CellValue[][]): Harness {
  const sandbox = loadSources(
    ['types.js', 'utils.js', 'rules.js', 'audit.js', 'statuses.js', 'items.js'],
    { Utilities: makeUtilities(), Date: globalThis.Date },
  );

  const itemRows = rows.map((r) => [...r]);
  const items = makeWritableSheet(itemRows, sandbox.ITEM_COLUMN_COUNT);
  const auditRows: CellValue[][] = [];
  const auditSheet = makeWritableSheet(auditRows, sandbox.AUDIT_COLUMN_COUNT);
  const statuses = makeWritableSheet(STATUS_ROWS.map((r) => [...r]), sandbox.STATUS_COLUMN_COUNT);

  const sheets: Record<string, unknown> = {
    Items: items,
    'Audit Log': auditSheet,
    Statuses: statuses,
  };
  sandbox.getSpreadsheet = () => ({
    getSheetByName: (name: string) => sheets[name] ?? null,
  });

  return {
    sandbox,
    itemRows,
    // A live view over the append-only rows, in append order.
    get audit(): AuditRow[] {
      return auditRows.map((r) => ({
        timestamp: String(r[0]),
        item_id: String(r[1]),
        action: String(r[2]),
        field: String(r[3]),
        old_value: String(r[4]),
        new_value: String(r[5]),
        actor: String(r[6]),
      }));
    },
  };
}

/** Actions logged for one item, in append order. */
function actionsFor(audit: AuditRow[], itemId: string) {
  return audit.filter((a) => a.item_id === itemId).map((a) => a.action);
}

describe('#239 AC1: completing an item writes a `completed` audit row', () => {
  it('writes `completed` alongside `status_changed`', () => {
    const h = harness([itemRow({ id: 'a', status: 'In Progress' })]);
    h.sandbox.updateItem('a', { status: 'Done' }, 'luke@example.com');
    expect(actionsFor(h.audit, 'a')).toEqual(['status_changed', 'completed']);
  });

  it('carries the same item id and actor as the `status_changed` row beside it', () => {
    const h = harness([itemRow({ id: 'a', status: 'In Progress' })]);
    h.sandbox.updateItem('a', { status: 'Done' }, 'luke@example.com');
    const [changed, completed] = h.audit;
    expect(completed.item_id).toBe(changed.item_id);
    expect(completed.actor).toBe(changed.actor);
    expect(completed.actor).toBe('luke@example.com');
    expect(completed.old_value).toBe('In Progress');
    expect(completed.new_value).toBe('Done');
  });

  it('writes one `completed` row per cascaded child (#162)', () => {
    const h = harness([
      itemRow({ id: 'p', status: 'In Progress' }),
      itemRow({ id: 'c1', status: 'To Do', parent_id: 'p' }),
      itemRow({ id: 'c2', status: 'In Progress', parent_id: 'p' }),
    ]);
    h.sandbox.updateItem('p', { status: 'Done' }, 'api');
    expect(actionsFor(h.audit, 'p')).toEqual(['status_changed', 'completed']);
    expect(actionsFor(h.audit, 'c1')).toEqual(['status_changed', 'completed']);
    expect(actionsFor(h.audit, 'c2')).toEqual(['status_changed', 'completed']);
  });

  it('is driven by is_terminal, not by the column being named Done', () => {
    const h = harness([itemRow({ id: 'a', status: 'In Progress' })]);
    h.sandbox.updateItem('a', { status: 'Shipped' }, 'api');
    expect(actionsFor(h.audit, 'a')).toEqual(['status_changed', 'completed']);
  });

  it('writes no completion row for a move between two non-terminal columns', () => {
    const h = harness([itemRow({ id: 'a', status: 'To Do' })]);
    h.sandbox.updateItem('a', { status: 'In Progress' }, 'api');
    expect(actionsFor(h.audit, 'a')).toEqual(['status_changed']);
  });
});

describe('#239 AC2: reopening writes a `reopened` audit row', () => {
  it('writes `reopened` alongside `status_changed` when leaving a terminal column', () => {
    const h = harness([
      itemRow({ id: 'a', status: 'Done', completed_at: '2026-09-12T16:00:00.000Z' }),
    ]);
    h.sandbox.updateItem('a', { status: 'In Progress' }, 'api');
    expect(actionsFor(h.audit, 'a')).toEqual(['status_changed', 'reopened']);
  });

  it('reads completed_at from before applyStatusSideEffects clears it', () => {
    // The ordering trap: `item` is reassigned over by applyStatusSideEffects,
    // which blanks completed_at. Taking the verdict afterwards silently loses
    // every `reopened` row.
    const h = harness([
      itemRow({ id: 'a', status: 'Done', completed_at: '2026-09-12T16:00:00.000Z' }),
    ]);
    h.sandbox.updateItem('a', { status: 'To Do' }, 'api');
    expect(actionsFor(h.audit, 'a')).toContain('reopened');
    // ...and the clearing still happened, per AC5.
    expect(h.itemRows[0][10]).toBe('');
  });

  it('writes no `reopened` row between two non-terminal columns', () => {
    const h = harness([itemRow({ id: 'a', status: 'To Do', completed_at: '' })]);
    h.sandbox.updateItem('a', { status: 'In Progress' }, 'api');
    expect(actionsFor(h.audit, 'a')).toEqual(['status_changed']);
  });

  it('writes `completed` again between two terminal columns', () => {
    const h = harness([
      itemRow({ id: 'a', status: 'Done', completed_at: '2026-09-12T16:00:00.000Z' }),
    ]);
    h.sandbox.updateItem('a', { status: 'Shipped' }, 'api');
    expect(actionsFor(h.audit, 'a')).toEqual(['status_changed', 'completed']);
  });

  it('writes `reopened` for cascaded children that were completed', () => {
    const h = harness([
      itemRow({ id: 'p', status: 'Done', completed_at: '2026-09-12T16:00:00.000Z' }),
      itemRow({ id: 'c1', status: 'Done', parent_id: 'p', completed_at: '2026-09-12T16:00:00.000Z' }),
      itemRow({ id: 'c2', status: 'To Do', parent_id: 'p' }),
    ]);
    h.sandbox.updateItem('p', { status: 'In Progress' }, 'api');
    expect(actionsFor(h.audit, 'p')).toEqual(['status_changed', 'reopened']);
    expect(actionsFor(h.audit, 'c1')).toEqual(['status_changed', 'reopened']);
    // c2 was never completed, so nothing was reopened.
    expect(actionsFor(h.audit, 'c2')).toEqual(['status_changed']);
  });
});

describe('#239 AC5: nothing that exists today changes', () => {
  it('still writes status_changed, and still sets completed_at', () => {
    const h = harness([itemRow({ id: 'a', status: 'To Do' })]);
    h.sandbox.updateItem('a', { status: 'Done' }, 'api');
    const changed = h.audit.find((e) => e.action === 'status_changed')!;
    expect(changed).toMatchObject({
      item_id: 'a', field: 'status', old_value: 'To Do', new_value: 'Done', actor: 'api',
    });
    expect(h.itemRows[0][10]).toBeTruthy(); // completed_at set
  });

  it('writes no completion row for a non-status field change', () => {
    const h = harness([itemRow({ id: 'a', status: 'To Do' })]);
    h.sandbox.updateItem('a', { title: 'Renamed' }, 'api');
    expect(actionsFor(h.audit, 'a')).toEqual(['updated']);
  });
});
