import { describe, it, expect } from 'vitest';
import { loadReadPath, type CellValue } from './apps-script-sandbox';

// Drives the real `getItems()` from `apps-script/src/items.js` through the
// sandboxed loader (#241) with fixture rows behind the Items sheet. The
// previous version of this file declared its own copy of the filter and
// asserted against that, which is how #241's bug stayed green — see #243.
//
// `main-getitems-dispatch.test.ts` covers the same filters over `doGet`;
// these are the unit-level assertions on the filter itself.

/** Build an Items row (14 columns) from the fields a test cares about. */
function itemRow(fields: { id: string; due_date?: string; sort_order?: number }): CellValue[] {
  return [
    fields.id,
    'Item ' + fields.id,
    '', // description
    'To Do',
    '', // owner
    fields.due_date ?? '',
    '', // labels
    '', // parent_id
    '', // created_at
    '', // updated_at
    '', // completed_at
    fields.sort_order ?? 0,
    '', // created_by
    'board-1',
  ];
}

const ROWS = [
  itemRow({ id: '1', due_date: '2026-03-25', sort_order: 1 }),
  itemRow({ id: '2', due_date: '2026-03-28', sort_order: 2 }),
  itemRow({ id: '3', due_date: '2026-04-01', sort_order: 3 }),
  itemRow({ id: '4', due_date: '2026-04-10', sort_order: 4 }),
  itemRow({ id: '5', due_date: '', sort_order: 5 }), // no due date
];

function filterItems(filters: { due_after?: string; due_before?: string } | undefined) {
  const sandbox = loadReadPath(ROWS);
  return sandbox.getItems(filters).map((i: { id: string }) => i.id);
}

describe('getItems date filtering', () => {
  it('filters items with due_after only, inclusive of the boundary', () => {
    expect(filterItems({ due_after: '2026-03-28' })).toEqual(['2', '3', '4']);
  });

  it('filters items with due_before only, inclusive of the boundary', () => {
    expect(filterItems({ due_before: '2026-03-28' })).toEqual(['1', '2']);
  });

  it('filters items with both due_after and due_before', () => {
    expect(filterItems({ due_after: '2026-03-28', due_before: '2026-04-01' })).toEqual(['2', '3']);
  });

  it('excludes items with an empty due_date', () => {
    expect(filterItems({ due_after: '2026-01-01' })).not.toContain('5');
  });

  it('returns every item when no date filters are applied', () => {
    expect(filterItems({})).toEqual(['1', '2', '3', '4', '5']);
  });

  it('returns every item when no filters object is given at all', () => {
    expect(filterItems(undefined)).toEqual(['1', '2', '3', '4', '5']);
  });
});
