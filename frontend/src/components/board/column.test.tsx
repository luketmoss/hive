import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { Column } from './column';
import type { ItemWithRow } from '../../api/types';

afterEach(() => {
  cleanup();
});

// Mock board-store for Card dependency
vi.mock('../../state/board-store', () => ({
  selectedItemId: { value: null },
  labels: { value: [] },
  getChildCount: () => ({ done: 0, total: 0 }),
}));

function makeItem(overrides: Partial<ItemWithRow> = {}): ItemWithRow {
  return {
    id: 'test-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    completed_at: '',
    sort_order: 1,
    sheetRow: 2,
    ...overrides,
  };
}

describe('Column ARIA roles (Issue #7)', () => {
  // AC4: Columns have region roles
  describe('AC4: Columns have region roles', () => {
    it('has role="region"', () => {
      const { container } = render(
        <Column status="To Do" items={[]} onDrop={vi.fn()} />
      );
      const column = container.querySelector('.column') as HTMLElement;
      expect(column.getAttribute('role')).toBe('region');
    });

    it('has aria-label with status and item count (plural)', () => {
      const items = [
        makeItem({ id: '1', title: 'Task 1' }),
        makeItem({ id: '2', title: 'Task 2' }),
        makeItem({ id: '3', title: 'Task 3' }),
      ];
      const { container } = render(
        <Column status="To Do" items={items} onDrop={vi.fn()} />
      );
      const column = container.querySelector('.column') as HTMLElement;
      expect(column.getAttribute('aria-label')).toBe('To Do column, 3 items');
    });

    it('has aria-label with singular "item" for 1 item', () => {
      const items = [makeItem({ id: '1', title: 'Task 1' })];
      const { container } = render(
        <Column status="In Progress" items={items} onDrop={vi.fn()} />
      );
      const column = container.querySelector('.column') as HTMLElement;
      expect(column.getAttribute('aria-label')).toBe('In Progress column, 1 item');
    });

    it('has aria-label with 0 items', () => {
      const { container } = render(
        <Column status="Done" items={[]} onDrop={vi.fn()} />
      );
      const column = container.querySelector('.column') as HTMLElement;
      expect(column.getAttribute('aria-label')).toBe('Done column, 0 items');
    });
  });
});
