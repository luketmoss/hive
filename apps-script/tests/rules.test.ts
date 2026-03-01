import { describe, it, expect, vi, beforeEach } from 'vitest';

// Since Apps Script concatenates all files into a global scope and doesn't
// support ES modules, we replicate the pure functions here for testing.
// These must stay in sync with apps-script/src/rules.ts and apps-script/src/types.ts.

type ItemStatus = 'To Do' | 'In Progress' | 'Done';

interface Item {
  id: string;
  title: string;
  description: string;
  status: ItemStatus;
  owner: string;
  due_date: string;
  scheduled_date: string;
  labels: string;
  parent_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  sort_order: number;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// --- Copied from rules.ts (pure logic, no Apps Script deps) ---

function validateStatusTransition(
  item: Item,
  newStatus: ItemStatus,
  allItems: Item[]
): ValidationResult {
  if (item.status === newStatus) {
    return { valid: true };
  }

  if (item.status === 'To Do' && newStatus === 'In Progress') {
    if (!item.owner) {
      return { valid: false, error: 'Cannot move to In Progress: owner must be assigned' };
    }
  }

  if (newStatus === 'Done') {
    const children = allItems.filter(i => i.parent_id === item.id);
    const incompleteChildren = children.filter(i => i.status !== 'Done');
    if (incompleteChildren.length > 0) {
      const names = incompleteChildren.map(c => c.title).join(', ');
      return {
        valid: false,
        error: `Cannot mark as Done: ${incompleteChildren.length} sub-task(s) not complete (${names})`,
      };
    }
  }

  return { valid: true };
}

function checkParentCompletion(item: Item, allItems: Item[]): string | null {
  if (!item.parent_id) return null;
  const siblings = allItems.filter(i => i.parent_id === item.parent_id);
  const allDone = siblings.every(i => i.status === 'Done');
  return allDone ? item.parent_id : null;
}

// --- Test helpers ---

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: '',
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
    completed_at: '',
    sort_order: 1,
    ...overrides,
  };
}

// --- Tests ---

describe('validateStatusTransition', () => {
  it('allows same-status no-op', () => {
    const item = makeItem({ status: 'To Do' });
    const result = validateStatusTransition(item, 'To Do', []);
    expect(result.valid).toBe(true);
  });

  it('blocks To Do → In Progress without owner', () => {
    const item = makeItem({ status: 'To Do', owner: '' });
    const result = validateStatusTransition(item, 'In Progress', []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('owner must be assigned');
  });

  it('allows To Do → In Progress with owner', () => {
    const item = makeItem({ status: 'To Do', owner: 'Luke' });
    const result = validateStatusTransition(item, 'In Progress', []);
    expect(result.valid).toBe(true);
  });

  it('blocks move to Done when children are incomplete', () => {
    const parent = makeItem({ id: 'parent', status: 'In Progress', owner: 'Luke' });
    const child1 = makeItem({ id: 'child-1', title: 'Child 1', parent_id: 'parent', status: 'Done' });
    const child2 = makeItem({ id: 'child-2', title: 'Child 2', parent_id: 'parent', status: 'In Progress' });
    const allItems = [parent, child1, child2];

    const result = validateStatusTransition(parent, 'Done', allItems);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('1 sub-task(s) not complete');
    expect(result.error).toContain('Child 2');
  });

  it('allows move to Done when all children are Done', () => {
    const parent = makeItem({ id: 'parent', status: 'In Progress', owner: 'Luke' });
    const child1 = makeItem({ id: 'child-1', parent_id: 'parent', status: 'Done' });
    const child2 = makeItem({ id: 'child-2', parent_id: 'parent', status: 'Done' });
    const allItems = [parent, child1, child2];

    const result = validateStatusTransition(parent, 'Done', allItems);
    expect(result.valid).toBe(true);
  });

  it('allows move to Done when item has no children', () => {
    const item = makeItem({ status: 'In Progress', owner: 'Luke' });
    const result = validateStatusTransition(item, 'Done', [item]);
    expect(result.valid).toBe(true);
  });

  it('allows reopening: Done → To Do', () => {
    const item = makeItem({ status: 'Done', owner: 'Luke', completed_at: '2025-01-02T00:00:00.000Z' });
    const result = validateStatusTransition(item, 'To Do', [item]);
    expect(result.valid).toBe(true);
  });

  it('allows reopening: Done → In Progress', () => {
    const item = makeItem({ status: 'Done', owner: 'Luke', completed_at: '2025-01-02T00:00:00.000Z' });
    const result = validateStatusTransition(item, 'In Progress', [item]);
    expect(result.valid).toBe(true);
  });

  it('allows To Do → Done with no children', () => {
    const item = makeItem({ status: 'To Do', owner: 'Luke' });
    const result = validateStatusTransition(item, 'Done', [item]);
    expect(result.valid).toBe(true);
  });
});

describe('checkParentCompletion', () => {
  it('returns null for root items', () => {
    const item = makeItem({ parent_id: '' });
    expect(checkParentCompletion(item, [item])).toBeNull();
  });

  it('returns parent ID when all siblings are Done', () => {
    const child1 = makeItem({ id: 'c1', parent_id: 'parent', status: 'Done' });
    const child2 = makeItem({ id: 'c2', parent_id: 'parent', status: 'Done' });
    const allItems = [child1, child2];

    expect(checkParentCompletion(child1, allItems)).toBe('parent');
  });

  it('returns null when some siblings are not Done', () => {
    const child1 = makeItem({ id: 'c1', parent_id: 'parent', status: 'Done' });
    const child2 = makeItem({ id: 'c2', parent_id: 'parent', status: 'In Progress' });
    const allItems = [child1, child2];

    expect(checkParentCompletion(child1, allItems)).toBeNull();
  });
});
