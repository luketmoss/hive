import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { Column } from './column';
import type { ItemWithRow } from '../../api/types';

// vi.hoisted runs before vi.mock hoisting, so cardMock is available in the factory
const cardMock = vi.hoisted(() => ({
  currentDragStatus: null as string | null,
  Card: ({ item, onReorder }: { item: ItemWithRow; onReorder?: (id: string, dir: 'up' | 'down') => void }) => (
    <div class="card" data-item-id={item.id}>
      <button
        class="card-title"
        onKeyDown={(e: KeyboardEvent) => {
          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            if (onReorder) {
              onReorder(item.id, e.key === 'ArrowUp' ? 'up' : 'down');
            }
          }
        }}
      >
        {item.title}
      </button>
    </div>
  ),
}));

// Mock board-store for Card dependency
const mockShowToast = vi.fn();
vi.mock('../../state/board-store', () => ({
  selectedItemId: { value: null },
  openDetailWithTitleEdit: { value: false },
  labels: { value: [] },
  getChildCount: () => ({ done: 0, total: 0 }),
  showToast: (...args: unknown[]) => mockShowToast(...args),
  columnAnnouncement: { value: null },
  boardStatuses: { value: [
    { id: 's1', board_id: 'board-1', name: 'To Do', sort_order: 1, color: '#e3f2fd', is_terminal: false, created_at: '' },
    { id: 's2', board_id: 'board-1', name: 'In Progress', sort_order: 2, color: '#fff3e0', is_terminal: false, created_at: '' },
    { id: 's3', board_id: 'board-1', name: 'Done', sort_order: 3, color: '#e8f5e9', is_terminal: true, created_at: '' },
  ] },
  isTerminalStatus: (name: string) => name === 'Done',
  defaultStatusName: () => 'To Do',
  terminalStatusName: () => 'Done',
}));

// Controllable mock for the card module so tests can set currentDragStatus
vi.mock('./card', () => cardMock);

afterEach(() => {
  cleanup();
  mockShowToast.mockReset();
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

  it('shows drop indicator when dragging from a different column (cross-column drag) — AC1', async () => {
    // Simulate a card from "In Progress" being dragged over the "To Do" column (custom sort)
    cardMock.currentDragStatus = 'In Progress';

    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="custom" />
    );
    const card = container.querySelector('.card') as HTMLElement;

    // Mock getBoundingClientRect for the card
    card.getBoundingClientRect = () => ({
      top: 100, bottom: 150, height: 50, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    // Fire dragover targeting the card (to trigger the insertion-line path)
    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    // Insertion line should appear for cross-column drag (AC1)
    const indicator = container.querySelector('.drop-indicator');
    expect(indicator).not.toBeNull();
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

describe('Cross-column drop with position (Issue #128 AC2)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  it('calls onDrop with targetIndex when cross-column dropping above a card (custom sort)', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const onDrop = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', sort_order: 1 }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={onDrop} onReorder={vi.fn()} sortMode="custom" />
    );
    const firstCard = container.querySelectorAll('[data-item-id]')[0] as HTMLElement;

    // Mock getBoundingClientRect: midY = 200. clientY=100 < 200 → above → targetIndex
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 300, height: 200, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    // Create DragEvent manually to ensure clientY is set correctly
    const event = new Event('drop', { bubbles: true }) as any;
    event.clientY = 100;
    event.dataTransfer = {
      getData: (type: string) => {
        if (type === 'text/plain') return 'drag-item';
        if (type === 'application/x-hive-status') return 'In Progress';
        return '';
      },
    };

    await act(() => {
      firstCard.dispatchEvent(event);
    });

    // Cross-column drop on first card, above midpoint → targetIndex 0
    expect(onDrop).toHaveBeenCalledWith('drag-item', 'To Do', 0);
    rectSpy.mockRestore();
  });

  it('calls onDrop with targetIndex below card when cursor is in lower half (custom sort)', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const onDrop = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', sort_order: 1 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={onDrop} onReorder={vi.fn()} sortMode="custom" />
    );
    const card = container.querySelector('[data-item-id]') as HTMLElement;

    // Mock getBoundingClientRect: midY = 200. clientY=300 > 200 → below → targetIndex + 1
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 300, height: 200, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    const event = new Event('drop', { bubbles: true }) as any;
    event.clientY = 300;
    event.dataTransfer = {
      getData: (type: string) => {
        if (type === 'text/plain') return 'drag-item';
        if (type === 'application/x-hive-status') return 'In Progress';
        return '';
      },
    };

    await act(() => {
      card.dispatchEvent(event);
    });

    expect(onDrop).toHaveBeenCalledWith('drag-item', 'To Do', 1);
    rectSpy.mockRestore();
  });
});

describe('Cross-column drop to empty space (Issue #128 AC3)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  it('calls onDrop without targetIndex when dropping on empty column area', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const onDrop = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={onDrop} onReorder={vi.fn()} />
    );
    const column = container.querySelector('.column') as HTMLElement;

    await act(() => {
      fireEvent.drop(column, {
        bubbles: true,
        clientY: 500,
        dataTransfer: {
          getData: (type: string) => {
            if (type === 'text/plain') return 'drag-item';
            if (type === 'application/x-hive-status') return 'In Progress';
            return '';
          },
        },
      });
    });

    // Called without targetIndex (undefined)
    expect(onDrop).toHaveBeenCalledWith('drag-item', 'To Do');
  });
});

describe('Focus restoration after drop (Issue #128 AC7)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  it('calls focus on the card title button after cross-column drop via requestAnimationFrame', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const onDrop = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={onDrop} onReorder={vi.fn()} />
    );
    const column = container.querySelector('.column') as HTMLElement;

    // Spy on requestAnimationFrame
    const rafCallbacks: FrameRequestCallback[] = [];
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => { rafCallbacks.push(cb); return 0; };

    await act(() => {
      fireEvent.drop(column, {
        bubbles: true,
        clientY: 500,
        dataTransfer: {
          getData: (type: string) => {
            if (type === 'text/plain') return '1';
            if (type === 'application/x-hive-status') return 'In Progress';
            return '';
          },
        },
      });
    });

    // A rAF callback should have been queued
    expect(rafCallbacks.length).toBeGreaterThan(0);

    // Get the card-title button and spy on focus
    const titleBtn = container.querySelector('[data-item-id="1"] .card-title') as HTMLElement;
    const focusSpy = vi.spyOn(titleBtn, 'focus');

    // Flush rAF callback
    rafCallbacks.forEach(cb => cb(0));

    expect(focusSpy).toHaveBeenCalled();

    // Restore
    globalThis.requestAnimationFrame = originalRaf;
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

describe('Column sort mode (Issue #157)', () => {
  it('AC1-3: Card component does not receive a sortMode prop', () => {
    const items = [makeItem({ id: '1', title: 'Task 1' })];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="custom" />
    );
    // The Card mock just renders a div.card; no sortMode attribute present
    const card = container.querySelector('.card') as HTMLElement;
    expect(card).not.toBeNull();
    // No .card-sort-lock element
    expect(container.querySelector('.card-sort-lock')).toBeNull();
  });

  it('renders a sort dropdown with Custom, Due date, Created options when sortMode is provided', () => {
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} sortMode="custom" />
    );
    const select = container.querySelector('.column-sort-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
    expect(options[0].value).toBe('custom');
    expect(options[1].value).toBe('due_date');
    expect(options[2].value).toBe('created');
  });

  it('renders items in the order passed by parent (sorting handled by parent)', () => {
    const items = [
      makeItem({ id: 'sooner', title: 'Sooner', due_date: '2026-03-01', sort_order: 1 }),
      makeItem({ id: 'later', title: 'Later', due_date: '2026-06-01', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} sortMode="due_date" />
    );
    const cardIds = Array.from(container.querySelectorAll('[data-item-id]')).map(el => el.getAttribute('data-item-id'));
    expect(cardIds).toEqual(['sooner', 'later']);
  });

  it('AC7: sort dropdown has active class when sortMode is due_date', () => {
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} sortMode="due_date" />
    );
    const select = container.querySelector('.column-sort-select') as HTMLSelectElement;
    expect(select.classList.contains('column-sort-active')).toBe(true);
  });

  it('AC7: sort dropdown has active class when sortMode is created', () => {
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} sortMode="created" />
    );
    const select = container.querySelector('.column-sort-select') as HTMLSelectElement;
    expect(select.classList.contains('column-sort-active')).toBe(true);
  });

  it('AC7: sort dropdown has no active class when sortMode is custom', () => {
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} sortMode="custom" />
    );
    const select = container.querySelector('.column-sort-select') as HTMLSelectElement;
    expect(select.classList.contains('column-sort-active')).toBe(false);
  });

  it('AC7: calls onSortChange when dropdown changes', async () => {
    const onSortChange = vi.fn();
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} sortMode="custom" onSortChange={onSortChange} />
    );
    const select = container.querySelector('.column-sort-select') as HTMLSelectElement;

    await act(() => {
      fireEvent.change(select, { target: { value: 'due_date' } });
    });

    expect(onSortChange).toHaveBeenCalledWith('due_date');
  });
});

describe('Intra-column drag in date-sorted column switches to custom (Issue #161 AC1)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  it('AC1: drag reorder within date-sorted column calls onSortChange to custom + onReorder + shows undo toast', async () => {
    cardMock.currentDragStatus = 'To Do';
    const onReorder = vi.fn();
    const onSortChange = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', due_date: '2026-03-01', sort_order: 1 }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do', due_date: '2026-06-01', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={onReorder} sortMode="due_date" onSortChange={onSortChange} />
    );

    // Drop item '2' (index 1) onto firstCard (index 0) above midpoint → newIndex 0
    const firstCard = container.querySelectorAll('[data-item-id]')[0] as HTMLElement;
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 300, height: 200, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    const event = new Event('drop', { bubbles: true }) as any;
    event.clientY = 100; // above midpoint → index 0
    event.dataTransfer = {
      getData: (type: string) => {
        if (type === 'text/plain') return '2';
        if (type === 'application/x-hive-status') return 'To Do';
        return '';
      },
    };

    await act(() => {
      firstCard.dispatchEvent(event);
    });

    // Should switch to custom sort
    expect(onSortChange).toHaveBeenCalledWith('custom');
    // Should perform the reorder (item 2 was at index 1, dropped at index 0)
    expect(onReorder).toHaveBeenCalledWith('2', 0, items);
    // Should show undo toast with 10s duration
    expect(mockShowToast).toHaveBeenCalledWith(
      'Switched to custom order',
      'success',
      expect.objectContaining({ label: 'Undo' }),
      10000
    );
    rectSpy.mockRestore();
  });

  it('AC2: no-op drag (same position) does not switch sort mode', async () => {
    cardMock.currentDragStatus = 'To Do';
    const onReorder = vi.fn();
    const onSortChange = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', sort_order: 1 }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={onReorder} sortMode="due_date" onSortChange={onSortChange} />
    );

    const firstCard = container.querySelectorAll('[data-item-id]')[0] as HTMLElement;
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 300, height: 200, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    const event = new Event('drop', { bubbles: true }) as any;
    event.clientY = 100; // above midpoint → index 0, same as source index
    event.dataTransfer = {
      getData: (type: string) => {
        if (type === 'text/plain') return '1'; // item at index 0
        if (type === 'application/x-hive-status') return 'To Do';
        return '';
      },
    };

    await act(() => {
      firstCard.dispatchEvent(event);
    });

    // No sort change, no reorder, no toast
    expect(onSortChange).not.toHaveBeenCalled();
    expect(onReorder).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it('AC3: undo action in toast reverts to previous sort mode', async () => {
    cardMock.currentDragStatus = 'To Do';
    const onReorder = vi.fn();
    const onSortChange = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', sort_order: 1 }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={onReorder} sortMode="created" onSortChange={onSortChange} />
    );

    // Drop item '2' (index 1) onto firstCard (index 0) to trigger sort switch
    const firstCard = container.querySelectorAll('[data-item-id]')[0] as HTMLElement;
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 300, height: 200, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    const event = new Event('drop', { bubbles: true }) as any;
    event.clientY = 100;
    event.dataTransfer = {
      getData: (type: string) => {
        if (type === 'text/plain') return '2';
        if (type === 'application/x-hive-status') return 'To Do';
        return '';
      },
    };

    await act(() => {
      firstCard.dispatchEvent(event);
    });

    // Extract the undo function from the toast call
    const toastCall = mockShowToast.mock.calls[0];
    const action = toastCall[2] as { label: string; fn: () => void };
    expect(action.label).toBe('Undo');

    // Call undo — should revert to 'created'
    onSortChange.mockReset();
    action.fn();
    expect(onSortChange).toHaveBeenCalledWith('created');

    rectSpy.mockRestore();
  });
});

describe('Keyboard reorder in date-sorted column switches to custom (Issue #161 AC5)', () => {
  it('AC5: Alt+ArrowDown in date-sorted column switches to custom, reorders, shows undo toast', async () => {
    const onReorder = vi.fn();
    const onSortChange = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', sort_order: 1 }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={onReorder} sortMode="due_date" onSortChange={onSortChange} />
    );

    const titleBtn = container.querySelector('[data-item-id="1"] .card-title') as HTMLElement;
    await act(() => {
      fireEvent.keyDown(titleBtn, { key: 'ArrowDown', altKey: true });
    });

    expect(onSortChange).toHaveBeenCalledWith('custom');
    expect(onReorder).toHaveBeenCalledWith('1', 1, items);
    expect(mockShowToast).toHaveBeenCalledWith(
      'Switched to custom order',
      'success',
      expect.objectContaining({ label: 'Undo' }),
      10000
    );
  });

  it('AC5: Alt+ArrowUp in date-sorted column switches to custom', async () => {
    const onReorder = vi.fn();
    const onSortChange = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', sort_order: 1 }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={onReorder} sortMode="created" onSortChange={onSortChange} />
    );

    const titleBtn = container.querySelector('[data-item-id="2"] .card-title') as HTMLElement;
    await act(() => {
      fireEvent.keyDown(titleBtn, { key: 'ArrowUp', altKey: true });
    });

    expect(onSortChange).toHaveBeenCalledWith('custom');
    expect(onReorder).toHaveBeenCalledWith('2', 0, items);
  });

  it('keyboard reorder works normally in custom sort mode', async () => {
    const onReorder = vi.fn();
    const onSortChange = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do', sort_order: 1 }),
      makeItem({ id: '2', title: 'Task 2', status: 'To Do', sort_order: 2 }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={onReorder} sortMode="custom" onSortChange={onSortChange} />
    );

    const titleBtn = container.querySelector('[data-item-id="1"] .card-title') as HTMLElement;
    await act(() => {
      fireEvent.keyDown(titleBtn, { key: 'ArrowDown', altKey: true });
    });

    expect(onReorder).toHaveBeenCalledWith('1', 1, items);
    expect(onSortChange).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

describe('Cross-column drag overlay for date-sorted columns (Issue #161 AC7/AC8)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  it('AC7: shows overlay with due date message when cross-column dragging into due_date-sorted column', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="due_date" />
    );
    const card = container.querySelector('.card') as HTMLElement;

    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    const overlay = container.querySelector('.column-date-sort-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toBe('Will be sorted by due date');
  });

  it('AC7: shows overlay with creation date message for created-sorted column', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="created" />
    );
    const card = container.querySelector('.card') as HTMLElement;

    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    const overlay = container.querySelector('.column-date-sort-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toBe('Will be sorted by creation date');
  });

  it('AC8: shows overlay with completion date message for Done column', async () => {
    cardMock.currentDragStatus = 'To Do';
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'Done' }),
    ];
    const { container } = render(
      <Column status="Done" items={items} onDrop={vi.fn()} onReorder={vi.fn()} isTerminal />
    );
    const card = container.querySelector('.card') as HTMLElement;

    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    const overlay = container.querySelector('.column-date-sort-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.textContent).toBe('Will be sorted by completion date');
  });

  it('AC7: suppresses drop indicators when showing overlay', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="due_date" />
    );
    const card = container.querySelector('.card') as HTMLElement;

    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    // Overlay present, no drop indicators
    expect(container.querySelector('.column-date-sort-overlay')).not.toBeNull();
    expect(container.querySelector('.drop-indicator')).toBeNull();
  });

  it('AC7: overlay disappears when pointer leaves the column', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="due_date" />
    );
    const column = container.querySelector('.column') as HTMLElement;
    const card = container.querySelector('.card') as HTMLElement;

    // Show overlay
    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });
    expect(container.querySelector('.column-date-sort-overlay')).not.toBeNull();

    // Leave column
    await act(() => {
      fireEvent.dragLeave(column, { relatedTarget: null });
    });
    expect(container.querySelector('.column-date-sort-overlay')).toBeNull();
  });

  it('no overlay for same-column drag in date-sorted column', async () => {
    cardMock.currentDragStatus = 'To Do';
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="due_date" />
    );
    const card = container.querySelector('.card') as HTMLElement;

    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    // No overlay for same-column drag (AC1 handles this differently)
    expect(container.querySelector('.column-date-sort-overlay')).toBeNull();
  });

  it('no overlay for cross-column drag into custom-sorted column', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="custom" />
    );
    const card = container.querySelector('.card') as HTMLElement;
    card.getBoundingClientRect = () => ({
      top: 100, bottom: 150, height: 50, left: 0, right: 100, width: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });

    await act(() => {
      fireEvent.dragOver(card, { bubbles: true, clientY: 110 });
    });

    expect(container.querySelector('.column-date-sort-overlay')).toBeNull();
  });
});

describe('Cross-column drop into date-sorted column (Issue #161 AC9)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  it('AC9: cross-column drop into date-sorted column calls onDrop without targetIndex', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const onDrop = vi.fn();
    const items = [
      makeItem({ id: '1', title: 'Task 1', status: 'To Do' }),
    ];
    const { container } = render(
      <Column status="To Do" items={items} onDrop={onDrop} onReorder={vi.fn()} sortMode="due_date" />
    );
    const column = container.querySelector('.column') as HTMLElement;

    await act(() => {
      fireEvent.drop(column, {
        bubbles: true,
        clientY: 500,
        dataTransfer: {
          getData: (type: string) => {
            if (type === 'text/plain') return 'drag-item';
            if (type === 'application/x-hive-status') return 'In Progress';
            return '';
          },
        },
      });
    });

    // Called without targetIndex — date-sorted column places at end
    expect(onDrop).toHaveBeenCalledWith('drag-item', 'To Do');
  });

  it('AC9: cross-column drop into Done column calls onDrop without targetIndex', async () => {
    cardMock.currentDragStatus = 'To Do';
    const onDrop = vi.fn();
    const { container } = render(
      <Column status="Done" items={[]} onDrop={onDrop} onReorder={vi.fn()} />
    );
    const column = container.querySelector('.column') as HTMLElement;

    await act(() => {
      fireEvent.drop(column, {
        bubbles: true,
        clientY: 500,
        dataTransfer: {
          getData: (type: string) => {
            if (type === 'text/plain') return 'drag-item';
            if (type === 'application/x-hive-status') return 'To Do';
            return '';
          },
        },
      });
    });

    expect(onDrop).toHaveBeenCalledWith('drag-item', 'Done');
  });

  it('AC9: no undo toast on cross-column drop into date-sorted column', async () => {
    cardMock.currentDragStatus = 'In Progress';
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} onReorder={vi.fn()} sortMode="due_date" />
    );
    const column = container.querySelector('.column') as HTMLElement;

    await act(() => {
      fireEvent.drop(column, {
        bubbles: true,
        clientY: 500,
        dataTransfer: {
          getData: (type: string) => {
            if (type === 'text/plain') return 'drag-item';
            if (type === 'application/x-hive-status') return 'In Progress';
            return '';
          },
        },
      });
    });

    expect(mockShowToast).not.toHaveBeenCalled();
  });
});

// --- Inline Add Item to Column (Issue #170) ---
describe('Column — Inline Add Item (Issue #170)', () => {
  afterEach(() => {
    cardMock.currentDragStatus = null;
  });

  // AC1: Header "+" button renders and calls onAddItem
  it('renders header "+" button with correct aria-label in board view', () => {
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} />
    );
    const addBtn = container.querySelector('.column-add-btn') as HTMLButtonElement;
    expect(addBtn).not.toBeNull();
    expect(addBtn.getAttribute('aria-label')).toBe('Add item to To Do');
  });

  it('header "+" button calls onAddItem when clicked', () => {
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="In Progress" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} />
    );
    const addBtn = container.querySelector('.column-add-btn') as HTMLButtonElement;
    fireEvent.click(addBtn);
    expect(onAddItem).toHaveBeenCalledTimes(1);
  });

  // AC5: No "+" button in compact (swimlane) mode
  it('does not render header "+" button in compact mode', () => {
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} compact />
    );
    const addBtn = container.querySelector('.column-add-btn');
    expect(addBtn).toBeNull();
  });

  // AC2: Hover "Add item" row renders in board view (not compact)
  it('renders hover "Add item" row in board view', () => {
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} />
    );
    const addRow = container.querySelector('.column-add-row');
    expect(addRow).not.toBeNull();
    expect(addRow!.textContent).toContain('Add item');
  });

  // AC5: No hover row in compact mode
  it('does not render hover "Add item" row in compact mode', () => {
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} compact />
    );
    const addRow = container.querySelector('.column-add-row');
    expect(addRow).toBeNull();
  });

  // AC3: Hover row calls onAddItem when clicked
  it('hover "Add item" row calls onAddItem when clicked', () => {
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="Done" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} />
    );
    const addRow = container.querySelector('.column-add-row') as HTMLButtonElement;
    fireEvent.click(addRow);
    expect(onAddItem).toHaveBeenCalledTimes(1);
  });

  // AC4: Hover row not rendered during drag
  it('does not render hover row when a drag is active', () => {
    cardMock.currentDragStatus = 'To Do';
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="In Progress" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} />
    );
    const addRow = container.querySelector('.column-add-row');
    expect(addRow).toBeNull();
  });

  // No onAddItem prop means no button or row
  it('does not render "+" button or hover row when onAddItem is not provided', () => {
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} />
    );
    expect(container.querySelector('.column-add-btn')).toBeNull();
    expect(container.querySelector('.column-add-row')).toBeNull();
  });

  // Hover row has tabIndex=-1 (mouse-only)
  it('hover row has tabIndex=-1 for mouse-only interaction', () => {
    const onAddItem = vi.fn();
    const { container } = render(
      <Column status="To Do" items={[]} onDrop={vi.fn()} onAddItem={onAddItem} />
    );
    const addRow = container.querySelector('.column-add-row') as HTMLButtonElement;
    expect(addRow.tabIndex).toBe(-1);
  });
});
