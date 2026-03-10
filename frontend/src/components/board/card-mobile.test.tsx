import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Card } from './card';
import { selectedItemId } from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';

// Mock board-store
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

describe('Issue #118: Hold-to-drag interaction', () => {
  beforeEach(() => {
    selectedItemId.value = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // AC5: Drag handle removed from all viewports
  describe('AC5: Drag handle removed', () => {
    it('no drag handle element is rendered on the card', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      expect(container.querySelector('.drag-handle')).toBeNull();
      expect(container.querySelector('.drag-handle-dots')).toBeNull();
    });

    it('no card-row wrapper is rendered (flat card-content layout)', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      expect(container.querySelector('.card-row')).toBeNull();
    });

    it('accessibility tree does not contain "Drag to reorder" label', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const elements = container.querySelectorAll('[aria-label="Drag to reorder"]');
      expect(elements.length).toBe(0);
    });
  });

  // AC1: Single click opens card detail
  describe('AC1: Single click opens card detail', () => {
    it('clicking the card body opens the detail panel', () => {
      const item = makeItem({ id: 'click-test' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.click(card);
      expect(selectedItemId.value).toBe('click-test');
    });

    it('clicking card-content area opens the detail panel', () => {
      const item = makeItem({ id: 'content-click' });
      const { container } = render(<Card item={item} />);
      const content = container.querySelector('.card-content') as HTMLElement;

      fireEvent.click(content);
      expect(selectedItemId.value).toBe('content-click');
    });
  });

  // AC2: Hold-to-drag — card is draggable
  describe('AC2: Card is draggable (hold-to-drag)', () => {
    it('card div has draggable attribute', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      expect(card.getAttribute('draggable')).toBe('true');
    });

    it('dragstart is allowed after hold threshold (200ms)', () => {
      const item = makeItem({ id: 'drag-armed' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      // Press and hold
      fireEvent.mouseDown(card, { button: 0 });
      vi.advanceTimersByTime(200);

      // Drag should proceed (not prevented)
      const dataTransferData: Record<string, string> = {};
      const prevented = { value: false };
      const mockEvent = {
        dataTransfer: {
          setData: (type: string, value: string) => { dataTransferData[type] = value; },
        },
        preventDefault: () => { prevented.value = true; },
      };

      fireEvent.dragStart(card, mockEvent);
      // After armed, dragstart should set data (not be prevented)
      expect(dataTransferData['text/plain']).toBe('drag-armed');
    });
  });

  // AC3: Accidental drag (before hold threshold) is suppressed
  describe('AC3: Accidental drag before hold threshold is suppressed', () => {
    it('dragstart is prevented if hold duration < 200ms', () => {
      const item = makeItem({ id: 'early-drag' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      // Press but do not wait long enough
      fireEvent.mouseDown(card, { button: 0 });
      vi.advanceTimersByTime(100); // only 100ms, less than 200ms threshold

      // fireEvent returns false when preventDefault() was called
      const dragAllowed = fireEvent.dragStart(card);
      expect(dragAllowed).toBe(false);
    });

    it('dragstart is prevented if no mousedown occurred', () => {
      const item = makeItem({ id: 'no-press' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      // fireEvent returns false when preventDefault() was called
      const dragAllowed = fireEvent.dragStart(card);
      expect(dragAllowed).toBe(false);
    });
  });

  // AC4: Visual hold feedback (arm state)
  describe('AC4: Visual arm-state feedback', () => {
    it('adds card-arming class after 100ms hold', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.mouseDown(card, { button: 0 });
      expect(card.classList.contains('card-arming')).toBe(false);

      vi.advanceTimersByTime(100);
      expect(card.classList.contains('card-arming')).toBe(true);
    });

    it('removes card-arming class on mouseup before 200ms', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.mouseDown(card, { button: 0 });
      vi.advanceTimersByTime(100);
      expect(card.classList.contains('card-arming')).toBe(true);

      fireEvent.mouseUp(card);
      expect(card.classList.contains('card-arming')).toBe(false);
    });

    it('removes card-arming class on mouse leave', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.mouseDown(card, { button: 0 });
      vi.advanceTimersByTime(100);
      expect(card.classList.contains('card-arming')).toBe(true);

      fireEvent.mouseLeave(card);
      expect(card.classList.contains('card-arming')).toBe(false);
    });

    it('does not add card-arming class for right-click', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.mouseDown(card, { button: 2 });
      vi.advanceTimersByTime(150);
      expect(card.classList.contains('card-arming')).toBe(false);
    });
  });

  // AC6: Touch devices — tap to open
  describe('AC6: Touch devices — tap opens card detail', () => {
    it('clicking the card on touch device opens detail (same as pointer click)', () => {
      const item = makeItem({ id: 'touch-tap' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.click(card);
      expect(selectedItemId.value).toBe('touch-tap');
    });
  });

  // AC7: Keyboard interactions unchanged
  describe('AC7: Keyboard interactions unchanged', () => {
    it('Enter opens card detail', () => {
      const item = makeItem({ id: 'keyboard-enter' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(selectedItemId.value).toBe('keyboard-enter');
    });

    it('Space opens card detail', () => {
      const item = makeItem({ id: 'keyboard-space' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.keyDown(card, { key: ' ' });
      expect(selectedItemId.value).toBe('keyboard-space');
    });

    it('Alt+ArrowUp calls onReorder', () => {
      const onReorder = vi.fn();
      const item = makeItem({ id: 'kb-reorder' });
      const { container } = render(<Card item={item} onReorder={onReorder} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.keyDown(card, { key: 'ArrowUp', altKey: true });
      expect(onReorder).toHaveBeenCalledWith('kb-reorder', 'up');
    });

    it('ArrowRight moves between columns', () => {
      const onMoveStatus = vi.fn();
      const item = makeItem({ id: 'kb-move', status: 'To Do' });
      const { container } = render(<Card item={item} onMoveStatus={onMoveStatus} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.keyDown(card, { key: 'ArrowRight' });
      expect(onMoveStatus).toHaveBeenCalledWith('kb-move', 'In Progress');
    });
  });

  // Card layout structure (updated for #118)
  describe('Card layout structure', () => {
    it('card contains card-content directly (no card-row wrapper)', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      const content = card.querySelector('.card-content');
      expect(content).not.toBeNull();
      expect(card.querySelector('.card-row')).toBeNull();
    });

    it('card title is inside card-content', () => {
      const item = makeItem({ title: 'Nested Title' });
      const { container } = render(<Card item={item} />);
      const content = container.querySelector('.card-content');
      const title = content!.querySelector('.card-title');
      expect(title).not.toBeNull();
      expect(title!.textContent).toBe('Nested Title');
    });
  });
});

// Import afterEach for timer cleanup
import { afterEach } from 'vitest';
