import { describe, it, expect } from 'vitest';
import {
  loadSources,
  makeSheet,
  makeContentService,
  makePropertiesService,
  makeUtilities,
  callDoGet,
  type AuditEntry,
  type CellValue,
  type Sandbox,
} from './apps-script-sandbox';

// #239 AC3/AC4 — the `getAuditLog` read path, driven through the real
// `main.js` + `audit.js` sources in the sandbox (#243). Nothing here
// transcribes the filter logic: deleting the `doGet` case or the Denver
// conversion makes these fail.

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

function loadAuditPath(rows: CellValue[][]): Sandbox {
  const sandbox = loadSources(['types.js', 'utils.js', 'auth.js', 'audit.js', 'main.js'], {
    ContentService: makeContentService(),
    PropertiesService: makePropertiesService({ API_KEY, SPREADSHEET_ID: 'sheet-id' }),
    Utilities: makeUtilities(),
    Date: globalThis.Date,
  });

  // #265: getAuditLog joins Items to add title/board_id. No item rows here —
  // these tests are about the filter/range behaviour, not the join — so every
  // id resolves to title: '', board_id: '' (asserted below).
  const sheet = makeSheet(rows, sandbox.AUDIT_COLUMN_COUNT);
  const itemsSheet = makeSheet([], sandbox.ITEM_COLUMN_COUNT);
  sandbox.getSheet = (name: string) => {
    if (name === 'Audit Log') return sheet;
    if (name === 'Items') return itemsSheet;
    throw new Error('Sheet "' + name + '" not stubbed');
  };

  return sandbox;
}

function query(rows: CellValue[][], params: Record<string, string | undefined>) {
  return callDoGet<AuditEntry[]>(loadAuditPath(rows), { action: 'getAuditLog', key: API_KEY, ...params });
}

describe('#239 AC3: getAuditLog returns entries for a Denver-local date range', () => {
  // All midday UTC, so each falls on the same local date as its UTC date and
  // the range logic can be read without the timezone in the way. AC4 covers
  // the cases where the two dates differ.
  const ROWS = [
    auditRow({ timestamp: '2026-09-11T18:00:00.000Z', item_id: 'a', action: 'completed' }),
    auditRow({ timestamp: '2026-09-12T15:00:00.000Z', item_id: 'b', action: 'status_changed' }),
    auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'b', action: 'completed' }),
    auditRow({ timestamp: '2026-09-13T15:00:00.000Z', item_id: 'c', action: 'updated', field: 'title' }),
    auditRow({ timestamp: '2026-09-14T15:00:00.000Z', item_id: 'd', action: 'completed' }),
  ];

  it('returns a single local day, inclusive at both ends', () => {
    const res = query(ROWS, { from: '2026-09-12', to: '2026-09-12' });
    expect(res.success).toBe(true);
    expect(res.data.map((e) => e.action)).toEqual(['status_changed', 'completed']);
  });

  it('is inclusive at both ends of a multi-day range', () => {
    const res = query(ROWS, { from: '2026-09-11', to: '2026-09-13' });
    expect(res.data.map((e) => e.item_id)).toEqual(['a', 'b', 'b', 'c']);
  });

  it('returns each row with its stored fields', () => {
    const res = query(
      [auditRow({
        timestamp: '2026-09-12T15:00:00.000Z',
        item_id: 'item-7',
        action: 'completed',
        field: 'status',
        old_value: 'In Progress',
        new_value: 'Shipped',
        actor: 'luke@example.com',
      })],
      { from: '2026-09-12', to: '2026-09-12' },
    );
    expect(res.data[0]).toEqual({
      timestamp: '2026-09-12T15:00:00.000Z',
      item_id: 'item-7',
      action: 'completed',
      field: 'status',
      old_value: 'In Progress',
      new_value: 'Shipped',
      actor: 'luke@example.com',
      title: '',
      board_id: '',
    });
  });

  it('filters to one action type when audit_action is given', () => {
    const res = query(ROWS, { from: '2026-09-11', to: '2026-09-14', audit_action: 'completed' });
    expect(res.data.map((e) => e.item_id)).toEqual(['a', 'b', 'd']);
  });

  it('returns every action type when audit_action is omitted', () => {
    const res = query(ROWS, { from: '2026-09-11', to: '2026-09-14' });
    expect(new Set(res.data.map((e) => e.action))).toEqual(
      new Set(['completed', 'status_changed', 'updated']),
    );
  });

  it('returns rows exactly as logged — no dedup, no netting', () => {
    // Completed, reopened and completed again, all on one local day. The
    // consumer resolves the sequence; Hive returns all three.
    const sameDay = [
      auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'x', action: 'completed' }),
      auditRow({ timestamp: '2026-09-12T20:00:00.000Z', item_id: 'x', action: 'reopened' }),
      auditRow({ timestamp: '2026-09-12T22:00:00.000Z', item_id: 'x', action: 'completed' }),
    ];
    const res = query(sameDay, { from: '2026-09-12', to: '2026-09-12' });
    expect(res.data.map((e) => e.action)).toEqual(['completed', 'reopened', 'completed']);
  });

  it('returns two completed rows for an item completed twice in one day', () => {
    const twice = [
      auditRow({ timestamp: '2026-09-12T16:00:00.000Z', item_id: 'x', action: 'completed' }),
      auditRow({ timestamp: '2026-09-12T17:00:00.000Z', item_id: 'x', action: 'reopened' }),
      auditRow({ timestamp: '2026-09-12T18:00:00.000Z', item_id: 'x', action: 'completed' }),
    ];
    const res = query(twice, { from: '2026-09-12', to: '2026-09-12' });
    expect(res.data.filter((e) => e.action === 'completed')).toHaveLength(2);
  });

  it('returns rows in append order, which is chronological', () => {
    const res = query(ROWS, { from: '2026-09-11', to: '2026-09-14' });
    const stamps = res.data.map((e) => e.timestamp);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('returns an empty list for a day with no entries', () => {
    const res = query(ROWS, { from: '2026-09-20', to: '2026-09-20' });
    expect(res.success).toBe(true);
    expect(res.data).toEqual([]);
  });

  it('skips rows with no timestamp', () => {
    const res = query([auditRow({ timestamp: '' }), ...ROWS], { from: '2026-09-11', to: '2026-09-14' });
    expect(res.data).toHaveLength(5);
  });

  it('rejects a request with a bad API key', () => {
    const res = callDoGet<AuditEntry[]>(loadAuditPath(ROWS), {
      action: 'getAuditLog',
      key: 'wrong',
      from: '2026-09-12',
      to: '2026-09-12',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/API key/);
  });
});

describe('#239 AC4: the date boundary is Denver-local, not UTC', () => {
  // 18:30 on 12 September Denver (MDT, UTC-6) is 00:30 on the 13th UTC —
  // which is what gets stored. Slicing the ISO string would file it to the
  // 13th, losing roughly the evening quarter of every day.
  const MDT_EVENING = auditRow({
    timestamp: '2026-09-13T00:30:00.000Z',
    item_id: 'evening',
    action: 'completed',
  });

  it('files an 18:30 MDT completion to the local date, not the UTC one', () => {
    const res = query([MDT_EVENING], { from: '2026-09-12', to: '2026-09-12' });
    expect(res.data.map((e) => e.item_id)).toEqual(['evening']);
  });

  it('does not return it for the following UTC date', () => {
    const res = query([MDT_EVENING], { from: '2026-09-13', to: '2026-09-13' });
    expect(res.data).toEqual([]);
  });

  it('holds across the MST transition — 18:30 local files the same either side', () => {
    // January is MST (UTC-7): 18:30 local on the 12th is 01:30 UTC on the 13th.
    const mstEvening = auditRow({
      timestamp: '2026-01-13T01:30:00.000Z',
      item_id: 'winter',
      action: 'completed',
    });
    expect(query([mstEvening], { from: '2026-01-12', to: '2026-01-12' }).data).toHaveLength(1);
    expect(query([mstEvening], { from: '2026-01-13', to: '2026-01-13' }).data).toHaveLength(0);

    // The July counterpart (MDT, UTC-6) files to its local date the same way.
    const mdtEvening = auditRow({
      timestamp: '2026-07-13T00:30:00.000Z',
      item_id: 'summer',
      action: 'completed',
    });
    expect(query([mdtEvening], { from: '2026-07-12', to: '2026-07-12' }).data).toHaveLength(1);
    expect(query([mdtEvening], { from: '2026-07-13', to: '2026-07-13' }).data).toHaveLength(0);
  });

  it('keeps an early-morning UTC entry on the previous local day', () => {
    // 2026-09-12T05:00Z is 23:00 on the 11th in Denver.
    const row = auditRow({ timestamp: '2026-09-12T05:00:00.000Z', item_id: 'late' });
    expect(query([row], { from: '2026-09-11', to: '2026-09-11' }).data).toHaveLength(1);
    expect(query([row], { from: '2026-09-12', to: '2026-09-12' }).data).toHaveLength(0);
  });

  it('does not slice the ISO timestamp anywhere in the read path', () => {
    // A guard on the contract itself: the sources must convert, not substring.
    const source = loadAuditPath([]).auditLocalDate as (t: string) => string;
    expect(source('2026-09-13T00:30:00.000Z')).toBe('2026-09-12');
  });
});
