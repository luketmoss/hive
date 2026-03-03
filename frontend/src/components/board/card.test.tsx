import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Card } from './card';
import { selectedItemId } from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';

// Mock board-store to avoid signal dependency issues
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

describe('Card', () => {
  // AC1: Scheduled date displays on card
  describe('AC1: Scheduled date displays when set', () => {
    it('shows scheduled date formatted as Mon DD with a distinguishing prefix', () => {
      const item = makeItem({ scheduled_date: '2026-03-15T12:00:00' });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(scheduledEl).not.toBeNull();
      expect(scheduledEl!.textContent).toContain('Mar 15');
    });

    it('scheduled date is visually distinct from due date', () => {
      const item = makeItem({
        scheduled_date: '2026-03-15T12:00:00',
        due_date: '2026-03-20T12:00:00',
      });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      const dueEl = container.querySelector('.card-due');
      expect(scheduledEl).not.toBeNull();
      expect(dueEl).not.toBeNull();
      // Scheduled should have a distinguishing prefix/icon
      expect(scheduledEl!.textContent).not.toEqual(dueEl!.textContent);
    });

    it('handles date-only strings without timezone shift', () => {
      const item = makeItem({ scheduled_date: '2026-03-02' });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(scheduledEl).not.toBeNull();
      expect(scheduledEl!.textContent).toContain('Mar 2');
    });
  });

  // AC2: Scheduled date absent when empty
  describe('AC2: Scheduled date absent when empty', () => {
    it('does not render scheduled date element when scheduled_date is empty', () => {
      const item = makeItem({ scheduled_date: '' });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(scheduledEl).toBeNull();
    });
  });

  // AC3: Unassigned indicator shown when owner is empty
  describe('AC3: Unassigned indicator shown when owner is empty', () => {
    it('shows unassigned indicator when owner is empty string', () => {
      const item = makeItem({ owner: '' });
      const { container } = render(<Card item={item} />);
      const unassigned = container.querySelector('.card-unassigned');
      expect(unassigned).not.toBeNull();
      expect(unassigned!.textContent).toContain('Unassigned');
    });
  });

  // AC4: Unassigned indicator hidden when owner is set
  describe('AC4: Unassigned indicator hidden when owner is set', () => {
    it('shows owner name and hides unassigned indicator', () => {
      const item = makeItem({ owner: 'Luke' });
      const { container } = render(<Card item={item} />);
      const ownerEl = container.querySelector('.card-owner');
      const unassigned = container.querySelector('.card-unassigned');
      expect(ownerEl).not.toBeNull();
      expect(ownerEl!.textContent).toBe('Luke');
      expect(unassigned).toBeNull();
    });
  });

  // AC5: Both dates display together and are distinguishable
  describe('AC5: Both dates display together', () => {
    it('shows both scheduled and due dates when both are set', () => {
      const item = makeItem({
        scheduled_date: '2026-03-10T12:00:00',
        due_date: '2026-03-20T12:00:00',
      });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      const dueEl = container.querySelector('.card-due');
      expect(scheduledEl).not.toBeNull();
      expect(dueEl).not.toBeNull();
    });

    it('dates are distinguishable by different CSS classes', () => {
      const item = makeItem({
        scheduled_date: '2026-03-10T12:00:00',
        due_date: '2026-03-20T12:00:00',
      });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      const dueEl = container.querySelector('.card-due');
      // They exist as separate elements with distinct classes
      expect(scheduledEl!.className).toContain('card-scheduled');
      expect(dueEl!.className).toContain('card-due');
      // Both are visible within card-meta
      const meta = container.querySelector('.card-meta');
      expect(meta!.contains(scheduledEl!)).toBe(true);
      expect(meta!.contains(dueEl!)).toBe(true);
    });
  });

  // Issue #6 — Keyboard accessibility
  describe('Keyboard accessibility (Issue #6)', () => {
    // AC1: Cards are keyboard-focusable and activatable
    describe('AC1: Cards are keyboard-focusable and activatable', () => {
      it('has tabIndex=0 so it participates in tab order', () => {
        const item = makeItem();
        const { container } = render(<Card item={item} />);
        const card = container.querySelector('.card') as HTMLElement;
        expect(card.getAttribute('tabindex')).toBe('0');
      });

      it('has role="button" for assistive technology', () => {
        const item = makeItem();
        const { container } = render(<Card item={item} />);
        const card = container.querySelector('.card') as HTMLElement;
        expect(card.getAttribute('role')).toBe('button');
      });

      it('has an aria-label with the item title and status', () => {
        const item = makeItem({ title: 'Buy groceries', status: 'In Progress' });
        const { container } = render(<Card item={item} />);
        const card = container.querySelector('.card') as HTMLElement;
        const label = card.getAttribute('aria-label');
        expect(label).toContain('Buy groceries');
        expect(label).toContain('In Progress');
      });

      it('opens detail panel when Enter is pressed on focused card', () => {
        selectedItemId.value = null;

        const item = makeItem({ id: 'enter-test' });
        const { container } = render(<Card item={item} />);
        const card = container.querySelector('.card') as HTMLElement;

        fireEvent.keyDown(card, { key: 'Enter' });
        expect(selectedItemId.value).toBe('enter-test');
      });

      it('opens detail panel when Space is pressed on focused card', () => {
        selectedItemId.value = null;

        const item = makeItem({ id: 'space-test' });
        const { container } = render(<Card item={item} />);
        const card = container.querySelector('.card') as HTMLElement;

        fireEvent.keyDown(card, { key: ' ' });
        expect(selectedItemId.value).toBe('space-test');
      });

      it('has data-item-id attribute for focus restoration', () => {
        const item = makeItem({ id: 'data-attr-test' });
        const { container } = render(<Card item={item} />);
        const card = container.querySelector('.card') as HTMLElement;
        expect(card.getAttribute('data-item-id')).toBe('data-attr-test');
      });
    });

    // AC2: Keyboard alternative to drag-and-drop
    describe('AC2: Keyboard alternative to drag-and-drop', () => {
      it('calls onMoveStatus with next status when ArrowRight is pressed', () => {
        const onMoveStatus = vi.fn();
        const item = makeItem({ id: 'move-right', status: 'To Do' });
        const { container } = render(<Card item={item} onMoveStatus={onMoveStatus} />);
        const card = container.querySelector('.card') as HTMLElement;

        fireEvent.keyDown(card, { key: 'ArrowRight' });
        expect(onMoveStatus).toHaveBeenCalledWith('move-right', 'In Progress');
      });

      it('calls onMoveStatus with previous status when ArrowLeft is pressed', () => {
        const onMoveStatus = vi.fn();
        const item = makeItem({ id: 'move-left', status: 'In Progress' });
        const { container } = render(<Card item={item} onMoveStatus={onMoveStatus} />);
        const card = container.querySelector('.card') as HTMLElement;

        fireEvent.keyDown(card, { key: 'ArrowLeft' });
        expect(onMoveStatus).toHaveBeenCalledWith('move-left', 'To Do');
      });

      it('does not move past the last status (Done)', () => {
        const onMoveStatus = vi.fn();
        const item = makeItem({ id: 'no-right', status: 'Done' });
        const { container } = render(<Card item={item} onMoveStatus={onMoveStatus} />);
        const card = container.querySelector('.card') as HTMLElement;

        fireEvent.keyDown(card, { key: 'ArrowRight' });
        expect(onMoveStatus).not.toHaveBeenCalled();
      });

      it('does not move before the first status (To Do)', () => {
        const onMoveStatus = vi.fn();
        const item = makeItem({ id: 'no-left', status: 'To Do' });
        const { container } = render(<Card item={item} onMoveStatus={onMoveStatus} />);
        const card = container.querySelector('.card') as HTMLElement;

        fireEvent.keyDown(card, { key: 'ArrowLeft' });
        expect(onMoveStatus).not.toHaveBeenCalled();
      });

      it('does not call onMoveStatus when arrow keys pressed without the prop', () => {
        const item = makeItem({ id: 'no-handler', status: 'In Progress' });
        const { container } = render(<Card item={item} />);
        const card = container.querySelector('.card') as HTMLElement;

        // Should not throw
        fireEvent.keyDown(card, { key: 'ArrowRight' });
        fireEvent.keyDown(card, { key: 'ArrowLeft' });
      });
    });
  });
});
