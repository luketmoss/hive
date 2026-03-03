import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import type { ItemWithRow } from '../../api/types';

// Use vi.hoisted so these are available in the vi.mock factory
const { mockItemsRef, mockSelectedItemId } = vi.hoisted(() => ({
  mockItemsRef: { current: [] as any[] },
  mockSelectedItemId: { value: null as string | null },
}));

vi.mock('../../state/board-store', () => ({
  columns: {
    get value() {
      return {
        'To Do': mockItemsRef.current.filter((i: any) => i.status === 'To Do' && !i.parent_id),
        'In Progress': mockItemsRef.current.filter((i: any) => i.status === 'In Progress' && !i.parent_id),
        'Done': mockItemsRef.current.filter((i: any) => i.status === 'Done' && !i.parent_id),
      };
    },
  },
  selectedItemId: mockSelectedItemId,
  labels: { value: [] },
  getChildCount: () => ({ done: 0, total: 0 }),
}));

import { ListView } from './list-view';

function makeItem(overrides: Partial<ItemWithRow> = {}): ItemWithRow {
  return {
    id: 'item-1',
    title: 'Test Task',
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

afterEach(() => {
  cleanup();
  mockItemsRef.current = [];
  mockSelectedItemId.value = null;
});

describe('ListView (Issue #13)', () => {
  // AC2: List view shows items grouped by status
  describe('AC2: Items grouped by status headers', () => {
    it('renders three status sections: To Do, In Progress, Done', () => {
      mockItemsRef.current = [];
      const { container } = render(<ListView />);
      const sections = container.querySelectorAll('.list-section');
      expect(sections.length).toBe(3);

      const headers = container.querySelectorAll('.list-section-header h2');
      expect(headers[0].textContent).toBe('To Do');
      expect(headers[1].textContent).toBe('In Progress');
      expect(headers[2].textContent).toBe('Done');
    });

    it('renders cards under the correct status section', () => {
      mockItemsRef.current = [
        makeItem({ id: '1', title: 'Task A', status: 'To Do' }),
        makeItem({ id: '2', title: 'Task B', status: 'In Progress' }),
        makeItem({ id: '3', title: 'Task C', status: 'Done' }),
      ];
      const { container } = render(<ListView />);

      const sections = container.querySelectorAll('.list-section');
      // To Do section should have Task A
      expect(sections[0].querySelector('.card-title')!.textContent).toBe('Task A');
      // In Progress section should have Task B
      expect(sections[1].querySelector('.card-title')!.textContent).toBe('Task B');
      // Done section should have Task C
      expect(sections[2].querySelector('.card-title')!.textContent).toBe('Task C');
    });

    it('shows item count in each section header', () => {
      mockItemsRef.current = [
        makeItem({ id: '1', status: 'To Do' }),
        makeItem({ id: '2', status: 'To Do' }),
        makeItem({ id: '3', status: 'In Progress' }),
      ];
      const { container } = render(<ListView />);

      const counts = container.querySelectorAll('.list-section-count');
      expect(counts[0].textContent).toBe('2');  // To Do
      expect(counts[1].textContent).toBe('1');  // In Progress
      expect(counts[2].textContent).toBe('0');  // Done
    });

    it('shows "No items" for empty status sections', () => {
      mockItemsRef.current = [];
      const { container } = render(<ListView />);

      const empties = container.querySelectorAll('.list-section-empty');
      expect(empties.length).toBe(3);
      empties.forEach(el => {
        expect(el.textContent).toBe('No items');
      });
    });

    it('renders in single-column vertical layout (has list-view class)', () => {
      mockItemsRef.current = [];
      const { container } = render(<ListView />);
      const listView = container.querySelector('.list-view');
      expect(listView).not.toBeNull();
    });
  });

  // AC3: List view cards are tappable
  describe('AC3: Cards are tappable to open detail panel', () => {
    it('opens detail panel when a card is clicked', () => {
      mockItemsRef.current = [makeItem({ id: 'tap-test' })];
      const { container } = render(<ListView />);

      const card = container.querySelector('.card') as HTMLElement;
      expect(card).not.toBeNull();

      fireEvent.click(card);
      expect(mockSelectedItemId.value).toBe('tap-test');
    });

    it('opens detail panel when Enter is pressed on a card', () => {
      mockItemsRef.current = [makeItem({ id: 'enter-test' })];
      const { container } = render(<ListView />);

      const card = container.querySelector('.card') as HTMLElement;
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockSelectedItemId.value).toBe('enter-test');
    });
  });
});
