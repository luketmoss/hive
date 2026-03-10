import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { Column } from './column';
import type { ItemWithRow } from '../../api/types';

// vi.hoisted runs before vi.mock hoisting, so cardMock is available in the factory
const cardMock = vi.hoisted(() => ({
  currentDragStatus: null as string | null,
  Card: ({ item }: { item: ItemWithRow }) => (
    <div class="card" data-item-id={item.id}>{item.title}</div>
  ),
}));

// Mock board-store for Card dependency
vi.mock('../../state/board-store', () => ({
  selectedItemId: { value: null },
  openDetailWithTitleEdit: { value: false },
  labels: { value: [] },
  getChildCount: () => ({ done: 0, total: 0 }),
}));

// Controllable mock for the card module so tests can set currentDragStatus
vi.mock('./card', () => cardMock);

afterEach(() => {
  cleanup();
});

function makeItem(overrides: Partial<ItemWithRow> = {}): ItemWithRow {
  return {
    id: 'test-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    labels: '',
    parent_id: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    completed_at: '',
    sort_order: 1,
    created_by: '',
    board_id: '',
    sheetRow: 2,
    ...overrides,
  };
}

describe('Column reorder (Issue #115)', () => {
  it('wraps cards in .card-wrapper elements', () => {
    const items = [
      makeItem({ id: '1', title: 'Task 1' }),
      makeItem({ id: '2', title: 'Task 2' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} />
    );
    const wrappers = container.querySelectorAll('.card-wrapper');
    expect(wrappers.length).toBe(2);
  });

  it('passes onReorder prop and renders cards', () => {
    const onReorder = vi.fn();
    const items = [makeItem({ id: '1', title: 'Task 1' })];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={onReorder} />
    );
    const cards = container.querySelectorAll('.card');
    expect(cards.length).toBe(1);
  });
});

describe('Column drop indicator (Issue #115 AC2)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  it('does NOT show drop indicator when dragging from a different column (cross-column drag)', async () => {
    // Simulate a card from "In Progress" being dragged over the "To Do" column
    cardMock.currentDragStatus = 'In Progress';

    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} />
    );
    const column = container.querySelector('.column') as HTMLElement;
    const card = container.querySelector('.card') as HTMLElement;

    // Fire dragover targeting the card (to trigger the insertion-line path)
    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    // No insertion line should appear for a cross-column drag
    const indicator = container.querySelector('.drop-indicator');
    expect(indicator).toBeNull();
  });

  it('DOES show drop indicator when dragging within the same column', async () => {
    // Simulate a card from "To Do" being dragged over the "To Do" column
    cardMock.currentDragStatus = 'To Do';

    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} />
    );
    const firstCard = container.querySelectorAll('[data-item-id]')[0] as HTMLElement;

    // Mock getBoundingClientRect so midY calculation works (clientY 110 < midY 125 → 'above')
    firstCard.getBoundingClientRect = () => ({
      top: 100, bottom: 150, height: 50, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    // Fire dragover directly on the card — it bubbles up to the column handler
    await act(() => {
      fireEvent.dragOver(firstCard, { bubbles: true, clientY: 110 });
    });

    // An indicator should appear (above card at index 0)
    const indicator = container.querySelector('.drop-indicator');
    expect(indicator).not.toBeNull();
  });
});

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
