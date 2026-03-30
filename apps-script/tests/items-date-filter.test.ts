import { describe, it, expect } from 'vitest';

// Replicate the date filtering logic from items.js for unit testing.
// Apps Script uses global scope (no ES modules), so we replicate the filter here.

interface Item {
  id: string;
  due_date: string;
  [key: string]: any;
}

function applyDateFilters(items: Item[], filters: { due_after?: string; due_before?: string }): Item[] {
  let result = items;
  if (filters.due_after) {
    const dueAfter = filters.due_after;
    result = result.filter(i => i.due_date && i.due_date >= dueAfter);
  }
  if (filters.due_before) {
    const dueBefore = filters.due_before;
    result = result.filter(i => i.due_date && i.due_date <= dueBefore);
  }
  return result;
}

describe('AC7: Apps Script date filtering', () => {
  const items: Item[] = [
    { id: '1', due_date: '2026-03-25' },
    { id: '2', due_date: '2026-03-28' },
    { id: '3', due_date: '2026-04-01' },
    { id: '4', due_date: '2026-04-10' },
    { id: '5', due_date: '' }, // no due date
  ];

  it('filters items with due_after only', () => {
    const result = applyDateFilters(items, { due_after: '2026-03-28' });
    expect(result.map(i => i.id)).toEqual(['2', '3', '4']);
  });

  it('filters items with due_before only', () => {
    const result = applyDateFilters(items, { due_before: '2026-03-28' });
    expect(result.map(i => i.id)).toEqual(['1', '2']);
  });

  it('filters items with both due_after and due_before', () => {
    const result = applyDateFilters(items, { due_after: '2026-03-28', due_before: '2026-04-01' });
    expect(result.map(i => i.id)).toEqual(['2', '3']);
  });

  it('excludes items with empty due_date', () => {
    const result = applyDateFilters(items, { due_after: '2026-01-01' });
    expect(result.map(i => i.id)).not.toContain('5');
  });

  it('returns all items when no date filters applied', () => {
    const result = applyDateFilters(items, {});
    expect(result).toEqual(items);
  });
});
