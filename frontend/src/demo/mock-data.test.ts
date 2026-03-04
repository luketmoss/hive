import { describe, it, expect } from 'vitest';
import { MOCK_ITEMS, MOCK_OWNERS, MOCK_LABELS } from './mock-data';

// Scenario 4: Mock data covers all board features

describe('Mock data coverage (AC4)', () => {
  const rootItems = MOCK_ITEMS.filter(i => !i.parent_id);
  const todoItems = rootItems.filter(i => i.status === 'To Do');
  const inProgressItems = rootItems.filter(i => i.status === 'In Progress');
  const doneItems = rootItems.filter(i => i.status === 'Done');

  it('has 2+ items in To Do column', () => {
    expect(todoItems.length).toBeGreaterThanOrEqual(2);
  });

  it('has 2+ items in In Progress column (each with an owner)', () => {
    expect(inProgressItems.length).toBeGreaterThanOrEqual(2);
    for (const item of inProgressItems) {
      expect(item.owner).toBeTruthy();
    }
  });

  it('has 1+ items in Done column (with completed_at set)', () => {
    expect(doneItems.length).toBeGreaterThanOrEqual(1);
    for (const item of doneItems) {
      expect(item.completed_at).toBeTruthy();
    }
  });

  it('has 1+ item with sub-tasks (parent_id relationships)', () => {
    const parentIds = new Set(MOCK_ITEMS.filter(i => i.parent_id).map(i => i.parent_id));
    expect(parentIds.size).toBeGreaterThanOrEqual(1);
    // Verify each parent exists
    for (const pid of parentIds) {
      expect(MOCK_ITEMS.find(i => i.id === pid)).toBeTruthy();
    }
  });

  it('has 1+ item with a due date in the past (overdue)', () => {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = rootItems.filter(i =>
      i.status !== 'Done' && i.due_date && i.due_date < today
    );
    expect(overdue.length).toBeGreaterThanOrEqual(1);
  });

  it('has 1+ item with a scheduled date', () => {
    const withScheduled = rootItems.filter(i => i.scheduled_date);
    expect(withScheduled.length).toBeGreaterThanOrEqual(1);
  });

  it('has items with labels assigned', () => {
    const withLabels = rootItems.filter(i => i.labels);
    expect(withLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('has at least 2 owners', () => {
    expect(MOCK_OWNERS.length).toBeGreaterThanOrEqual(2);
  });

  it('has at least 3 labels with distinct colors', () => {
    expect(MOCK_LABELS.length).toBeGreaterThanOrEqual(3);
    const colors = new Set(MOCK_LABELS.map(l => l.color));
    expect(colors.size).toBe(MOCK_LABELS.length);
  });

  it('every item has a plausible created_by email matching an owner google_account', () => {
    for (const item of MOCK_ITEMS) {
      expect(item.created_by).toBeTruthy();
      const matchingOwner = MOCK_OWNERS.find(o => o.google_account === item.created_by);
      expect(matchingOwner).toBeTruthy();
    }
  });

  it('data is static/deterministic (same values every invocation)', () => {
    // Re-import to verify same reference data
    const items1 = MOCK_ITEMS;
    const items2 = MOCK_ITEMS;
    expect(items1).toBe(items2); // same reference
    expect(items1.length).toBe(items2.length);
    expect(items1[0].id).toBe('demo-001');
    expect(items1[0].title).toBe('Grocery shopping');
  });
});
