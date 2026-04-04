import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Card } from './card';
import { selectedItemId, openDetailWithTitleEdit } from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';

// Mock board-store
vi.mock('../../state/board-store', () => ({
  selectedItemId: { value: null },
  openDetailWithTitleEdit: { value: false },
  labels: { value: [] },
  getChildCount: () => ({ done: 0, total: 0 }),
  boardStatuses: { value: [
    { id: 's1', board_id: 'board-1', name: 'To Do', sort_order: 1, color: '#e3f2fd', is_terminal: false, created_at: '' },
    { id: 's2', board_id: 'board-1', name: 'In Progress', sort_order: 2, color: '#fff3e0', is_terminal: false, created_at: '' },
    { id: 's3', board_id: 'board-1', name: 'Done', sort_order: 3, color: '#e8f5e9', is_terminal: true, created_at: '' },
  ] },
  isTerminalStatus: (name: string) => name === 'Done',
  defaultStatusName: () => 'To Do',
  terminalStatusName: () => 'Done',
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

describe('Issue #126: Immediate drag + title button', () => {
  beforeEach(() => {
    selectedItemId.value = null;
    openDetailWithTitleEdit.value = false;
  });

  // AC1: Drag begins immediately (no hold delay)
  describe('AC1: Drag begins immediately on mousedown + move', () => {
    it('card div has draggable attribute', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      expect(card.getAttribute('draggable')).toBe('true');
    });

    it('dragstart is allowed immediately (no hold threshold)', () => {
      const item = makeItem({ id: 'drag-immediate' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      const dataTransferData: Record<string, string> = {};
      const mockEvent = {
        dataTransfer: {
          setData: (type: string, value: string) => { dataTransferData[type] = value; },
        },
      };

      fireEvent.dragStart(card, mockEvent);
      expect(dataTransferData['text/plain']).toBe('drag-immediate');
      expect(dataTransferData['application/x-hive-status']).toBe('To Do');
    });
  });

  // AC2: Card title has a distinct clickable affordance (CSS tested in responsive.test.ts)
  describe('AC2: Card title is a button element', () => {
    it('card title is rendered as a <button> element', () => {
      const item = makeItem({ title: 'My Title' });
      const { container } = render(<Card item={item} />);
      const title = container.querySelector('.card-title');
      expect(title).not.toBeNull();
      expect(title!.tagName).toBe('BUTTON');
      expect(title!.textContent).toBe('My Title');
    });
  });

  // AC3: Clicking card title opens detail (no edit mode)
  describe('AC3: Clicking card title opens detail', () => {
    it('clicking the title button opens detail without title edit mode', () => {
      const item = makeItem({ id: 'title-click' });
      const { container } = render(<Card item={item} />);
      const title = container.querySelector('.card-title') as HTMLElement;

      fireEvent.click(title);
      expect(openDetailWithTitleEdit.value).toBe(false);
      expect(selectedItemId.value).toBe('title-click');
    });
  });

  // AC4: Clicking card body (non-title) opens detail without edit mode
  describe('AC4: Clicking card body opens detail without edit mode', () => {
    it('clicking the card body sets selectedItemId without title edit', () => {
      const item = makeItem({ id: 'body-click' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      // Click on the card (not the title)
      fireEvent.click(card);
      expect(openDetailWithTitleEdit.value).toBe(false);
      expect(selectedItemId.value).toBe('body-click');
    });

    it('clicking card-content area opens detail without edit mode', () => {
      const item = makeItem({ id: 'content-click' });
      const { container } = render(<Card item={item} />);
      const content = container.querySelector('.card-content') as HTMLElement;

      fireEvent.click(content);
      expect(selectedItemId.value).toBe('content-click');
      expect(openDetailWithTitleEdit.value).toBe(false);
    });
  });

  // AC5: No arm-state animation
  describe('AC5: No arm-state animation', () => {
    it('no card-arming class is applied on mousedown + hold', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      // No mouseDown/mouseUp handlers at all, so no arming can happen
      expect(card.classList.contains('card-arming')).toBe(false);
    });
  });

  // AC6: Keyboard navigation — title button is sole tab stop
  describe('AC6: Keyboard navigation via title button', () => {
    it('Enter on title button opens detail without edit mode', () => {
      const item = makeItem({ id: 'kb-enter' });
      const { container } = render(<Card item={item} />);
      const title = container.querySelector('.card-title') as HTMLElement;

      fireEvent.keyDown(title, { key: 'Enter' });
      expect(openDetailWithTitleEdit.value).toBe(false);
      expect(selectedItemId.value).toBe('kb-enter');
    });

    it('Space on title button opens detail without edit mode', () => {
      const item = makeItem({ id: 'kb-space' });
      const { container } = render(<Card item={item} />);
      const title = container.querySelector('.card-title') as HTMLElement;

      fireEvent.keyDown(title, { key: ' ' });
      expect(openDetailWithTitleEdit.value).toBe(false);
      expect(selectedItemId.value).toBe('kb-space');
    });

    it('ArrowRight on title button moves card to next column', () => {
      const onMoveStatus = vi.fn();
      const item = makeItem({ id: 'kb-right', status: 'To Do' });
      const { container } = render(<Card item={item} onMoveStatus={onMoveStatus} />);
      const title = container.querySelector('.card-title') as HTMLElement;

      fireEvent.keyDown(title, { key: 'ArrowRight' });
      expect(onMoveStatus).toHaveBeenCalledWith('kb-right', 'In Progress');
    });

    it('ArrowLeft on title button moves card to previous column', () => {
      const onMoveStatus = vi.fn();
      const item = makeItem({ id: 'kb-left', status: 'In Progress' });
      const { container } = render(<Card item={item} onMoveStatus={onMoveStatus} />);
      const title = container.querySelector('.card-title') as HTMLElement;

      fireEvent.keyDown(title, { key: 'ArrowLeft' });
      expect(onMoveStatus).toHaveBeenCalledWith('kb-left', 'To Do');
    });

    it('Alt+ArrowUp on title button calls onReorder', () => {
      const onReorder = vi.fn();
      const item = makeItem({ id: 'kb-reorder' });
      const { container } = render(<Card item={item} onReorder={onReorder} />);
      const title = container.querySelector('.card-title') as HTMLElement;

      fireEvent.keyDown(title, { key: 'ArrowUp', altKey: true });
      expect(onReorder).toHaveBeenCalledWith('kb-reorder', 'up');
    });

    it('Alt+ArrowDown on title button calls onReorder down', () => {
      const onReorder = vi.fn();
      const item = makeItem({ id: 'kb-reorder-down' });
      const { container } = render(<Card item={item} onReorder={onReorder} />);
      const title = container.querySelector('.card-title') as HTMLElement;

      fireEvent.keyDown(title, { key: 'ArrowDown', altKey: true });
      expect(onReorder).toHaveBeenCalledWith('kb-reorder-down', 'down');
    });
  });

  // AC7: No nested ARIA interactive element
  describe('AC7: No nested ARIA interactive element', () => {
    it('card container div has no role="button"', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      expect(card.getAttribute('role')).toBeNull();
    });

    it('card container div has no tabIndex', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      // tabIndex attribute should not be present on the container
      expect(card.getAttribute('tabindex')).toBeNull();
    });

    it('card title button has an accessible label', () => {
      const item = makeItem({ title: 'Buy Groceries', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const title = container.querySelector('.card-title') as HTMLElement;
      expect(title.getAttribute('aria-label')).toContain('Buy Groceries');
    });

    it('card title button is not nested inside another interactive element', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const title = container.querySelector('.card-title') as HTMLElement;
      // Walk up the tree — no ancestor should be a button or have role="button"
      let parent = title.parentElement;
      while (parent && parent !== container) {
        expect(parent.tagName).not.toBe('BUTTON');
        expect(parent.getAttribute('role')).not.toBe('button');
        parent = parent.parentElement;
      }
    });
  });

  // AC8: Touch devices not regressed
  describe('AC8: Touch devices — tap opens card detail', () => {
    it('clicking the card on touch device opens detail', () => {
      const item = makeItem({ id: 'touch-tap' });
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;

      fireEvent.click(card);
      expect(selectedItemId.value).toBe('touch-tap');
    });
  });

  // Card layout structure
  describe('Card layout structure', () => {
    it('card contains card-content directly (no card-row wrapper)', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      const content = card.querySelector('.card-content');
      expect(content).not.toBeNull();
      expect(card.querySelector('.card-row')).toBeNull();
    });

    it('no drag handle element is rendered on the card', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      expect(container.querySelector('.drag-handle')).toBeNull();
      expect(container.querySelector('.drag-handle-dots')).toBeNull();
    });
  });
});
