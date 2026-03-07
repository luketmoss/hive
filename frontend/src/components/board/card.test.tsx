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
    created_by: '',
    board_id: '',
    sheetRow: 2,
    ...overrides,
  };
}

describe('Card', () => {
  // AC1: Due date displays with text label "Due:" and optional alarm icon prefix
  describe('AC1: Due date displays with text label and alarm icon', () => {
    it('shows due date with "Due:" text label prefix', () => {
      const item = makeItem({ due_date: '2099-03-20T12:00:00', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl).not.toBeNull();
      expect(dueEl!.textContent).toContain('Due:');
      expect(dueEl!.textContent).toContain('Mar 20');
    });

    it('retains the .card-due CSS class', () => {
      const item = makeItem({ due_date: '2099-03-20T12:00:00', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl).not.toBeNull();
      expect(dueEl!.className).toContain('card-due');
    });
  });

  // AC2: Scheduled date displays with text label "Sched:" and calendar icon
  describe('AC2: Scheduled date displays with text label and calendar icon', () => {
    it('shows scheduled date with "Sched:" text label prefix', () => {
      const item = makeItem({ scheduled_date: '2026-03-15T12:00:00' });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(scheduledEl).not.toBeNull();
      expect(scheduledEl!.textContent).toContain('Sched:');
      expect(scheduledEl!.textContent).toContain('Mar 15');
    });

    it('retains the .card-scheduled CSS class', () => {
      const item = makeItem({ scheduled_date: '2026-03-15T12:00:00' });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(scheduledEl).not.toBeNull();
      expect(scheduledEl!.className).toContain('card-scheduled');
    });

    it('handles date-only strings without timezone shift', () => {
      const item = makeItem({ scheduled_date: '2026-03-02' });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(scheduledEl).not.toBeNull();
      expect(scheduledEl!.textContent).toContain('Sched:');
      expect(scheduledEl!.textContent).toContain('Mar 2');
    });
  });

  // AC3: Both dates visually distinguishable (different labels + color weight)
  describe('AC3: Both dates are visually distinguishable', () => {
    it('shows both dates with different text labels ("Due:" vs "Sched:")', () => {
      const item = makeItem({
        scheduled_date: '2026-03-15T12:00:00',
        due_date: '2026-03-20T12:00:00',
      });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      const dueEl = container.querySelector('.card-due');
      expect(scheduledEl).not.toBeNull();
      expect(dueEl).not.toBeNull();
      expect(scheduledEl!.textContent).toContain('Sched:');
      expect(dueEl!.textContent).toContain('Due:');
      // Labels are different
      expect(scheduledEl!.textContent).not.toEqual(dueEl!.textContent);
    });

    it('both dates are inside .card-meta on the same flex row', () => {
      const item = makeItem({
        scheduled_date: '2026-03-10T12:00:00',
        due_date: '2026-03-20T12:00:00',
      });
      const { container } = render(<Card item={item} />);
      const meta = container.querySelector('.card-meta');
      const scheduledEl = container.querySelector('.card-scheduled');
      const dueEl = container.querySelector('.card-due');
      expect(meta!.contains(scheduledEl!)).toBe(true);
      expect(meta!.contains(dueEl!)).toBe(true);
    });
  });

  // AC4: Overdue due date retains existing overdue styling
  describe('AC4: Overdue due date retains existing overdue styling', () => {
    it('shows "Due:" label, red overdue class, and "(overdue)" suffix for past due date', () => {
      const item = makeItem({ due_date: '2020-01-01', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl).not.toBeNull();
      expect(dueEl!.textContent).toContain('Due:');
      expect(dueEl!.textContent).toContain('(overdue)');
      expect(dueEl!.className).toContain('card-due-overdue');
    });

    it('adds the card-due-overdue CSS class for overdue items', () => {
      const item = makeItem({ due_date: '2020-01-01', status: 'In Progress' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl!.className).toContain('card-due-overdue');
    });

    it('does NOT show "(overdue)" when status is Done', () => {
      const item = makeItem({ due_date: '2020-01-01', status: 'Done' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl).not.toBeNull();
      expect(dueEl!.textContent).toContain('Due:');
      expect(dueEl!.textContent).not.toContain('(overdue)');
    });

    it('does NOT show "(overdue)" when due date is in the future', () => {
      const item = makeItem({ due_date: '2099-12-31', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl).not.toBeNull();
      expect(dueEl!.textContent).not.toContain('(overdue)');
      expect(dueEl!.className).not.toContain('card-due-overdue');
    });

    it('does NOT render due date element when there is no due date', () => {
      const item = makeItem({ due_date: '', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl).toBeNull();
    });
  });

  // AC5: Only set dates are displayed (no empty placeholders)
  describe('AC5: Only set dates are rendered', () => {
    it('renders neither date when both are empty', () => {
      const item = makeItem({ due_date: '', scheduled_date: '' });
      const { container } = render(<Card item={item} />);
      expect(container.querySelector('.card-due')).toBeNull();
      expect(container.querySelector('.card-scheduled')).toBeNull();
    });

    it('renders only due date when only due_date is set', () => {
      const item = makeItem({ due_date: '2099-03-20', scheduled_date: '' });
      const { container } = render(<Card item={item} />);
      expect(container.querySelector('.card-due')).not.toBeNull();
      expect(container.querySelector('.card-scheduled')).toBeNull();
    });

    it('renders only scheduled date when only scheduled_date is set', () => {
      const item = makeItem({ due_date: '', scheduled_date: '2026-03-15' });
      const { container } = render(<Card item={item} />);
      expect(container.querySelector('.card-due')).toBeNull();
      expect(container.querySelector('.card-scheduled')).not.toBeNull();
    });
  });

  // AC6: Due date more prominent (font-weight: 600, darker color)
  describe('AC6: Due date is more visually prominent', () => {
    it('due date element has .card-due class for bold/dark styling', () => {
      const item = makeItem({
        due_date: '2099-03-20',
        scheduled_date: '2026-03-15',
      });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      const scheduledEl = container.querySelector('.card-scheduled');
      // Due date uses .card-due (font-weight: 600, color: var(--color-text))
      expect(dueEl!.className).toContain('card-due');
      // Scheduled uses .card-scheduled (normal weight, color: var(--color-text-secondary))
      expect(scheduledEl!.className).toContain('card-scheduled');
      // They are different classes
      expect(dueEl!.className).not.toContain('card-scheduled');
    });
  });

  // AC7: Dates legible at small widths (white-space: nowrap)
  describe('AC7: Dates remain legible at small widths', () => {
    it('both date elements have classes that apply white-space: nowrap via CSS', () => {
      // Verified via CSS: .card-due and .card-scheduled both have white-space: nowrap.
      // In jsdom we verify the class names are correctly applied.
      const item = makeItem({
        due_date: '2099-03-20',
        scheduled_date: '2026-03-15',
      });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(dueEl!.classList.contains('card-due')).toBe(true);
      expect(scheduledEl!.classList.contains('card-scheduled')).toBe(true);
    });

    it('uses abbreviated labels "Due:" and "Sched:" for compact layout', () => {
      const item = makeItem({
        due_date: '2099-03-20',
        scheduled_date: '2026-03-15',
      });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      const scheduledEl = container.querySelector('.card-scheduled');
      // "Due:" not "Due date:" — abbreviated
      expect(dueEl!.textContent).toContain('Due:');
      expect(dueEl!.textContent).not.toContain('Due date:');
      // "Sched:" not "Scheduled:" — abbreviated
      expect(scheduledEl!.textContent).toContain('Sched:');
      expect(scheduledEl!.textContent).not.toContain('Scheduled:');
    });
  });

  // AC8: Date elements have aria-labels for screen readers
  describe('AC8: Date elements have accessible aria-labels', () => {
    it('scheduled date has aria-label with full "Scheduled date:" text', () => {
      const item = makeItem({ scheduled_date: '2026-03-15T12:00:00' });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      expect(scheduledEl!.getAttribute('aria-label')).toBe('Scheduled date: Mar 15');
    });

    it('due date (not overdue) has aria-label with "Due date:" text', () => {
      const item = makeItem({ due_date: '2099-03-20T12:00:00', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl!.getAttribute('aria-label')).toBe('Due date: Mar 20');
    });

    it('overdue due date has aria-label with ", overdue" suffix', () => {
      const item = makeItem({ due_date: '2020-01-01', status: 'To Do' });
      const { container } = render(<Card item={item} />);
      const dueEl = container.querySelector('.card-due');
      expect(dueEl!.getAttribute('aria-label')).toBe('Due date: Jan 1, overdue');
    });

    it('both aria-labels use full unabbreviated words (not "Sched:" or "Due:")', () => {
      const item = makeItem({
        scheduled_date: '2026-03-15',
        due_date: '2099-03-20',
      });
      const { container } = render(<Card item={item} />);
      const scheduledEl = container.querySelector('.card-scheduled');
      const dueEl = container.querySelector('.card-due');
      // aria-labels use full words
      expect(scheduledEl!.getAttribute('aria-label')).toContain('Scheduled date:');
      expect(dueEl!.getAttribute('aria-label')).toContain('Due date:');
    });
  });

  // Unassigned indicator
  describe('Unassigned indicator shown when owner is empty', () => {
    it('shows unassigned indicator when owner is empty string', () => {
      const item = makeItem({ owner: '' });
      const { container } = render(<Card item={item} />);
      const unassigned = container.querySelector('.card-unassigned');
      expect(unassigned).not.toBeNull();
      expect(unassigned!.textContent).toContain('Unassigned');
    });
  });

  // Unassigned indicator hidden when owner is set
  describe('Unassigned indicator hidden when owner is set', () => {
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

  // Issue #12 — Description preview
  describe('Description preview (Issue #12)', () => {
    // AC1: Non-empty description shows truncated preview below title
    describe('AC1: Description preview shows on card', () => {
      it('renders a description preview when description is non-empty', () => {
        const item = makeItem({ description: 'Pick up milk and eggs from the store' });
        const { container } = render(<Card item={item} />);
        const descEl = container.querySelector('.card-description');
        expect(descEl).not.toBeNull();
        expect(descEl!.textContent).toBe('Pick up milk and eggs from the store');
      });

      it('renders description below the title', () => {
        const item = makeItem({ description: 'Some notes here' });
        const { container } = render(<Card item={item} />);
        const title = container.querySelector('.card-title');
        const desc = container.querySelector('.card-description');
        expect(title).not.toBeNull();
        expect(desc).not.toBeNull();
        // Description should be a sibling after title
        expect(title!.nextElementSibling).toBe(desc);
      });
    });

    // AC2: Long descriptions are truncated with ellipsis (CSS line-clamp)
    describe('AC2: Long descriptions are truncated', () => {
      it('applies CSS line-clamp class for long descriptions', () => {
        const longDesc = 'This is a very long description that spans multiple lines. '.repeat(10);
        const item = makeItem({ description: longDesc });
        const { container } = render(<Card item={item} />);
        const descEl = container.querySelector('.card-description');
        expect(descEl).not.toBeNull();
        expect(descEl!.classList.contains('card-description')).toBe(true);
        // The CSS class card-description applies -webkit-line-clamp: 2
      });
    });

    // AC3: Empty descriptions show nothing
    describe('AC3: Empty descriptions show nothing', () => {
      it('does not render description element when description is empty string', () => {
        const item = makeItem({ description: '' });
        const { container } = render(<Card item={item} />);
        const descEl = container.querySelector('.card-description');
        expect(descEl).toBeNull();
      });

      it('does not render description element when description is undefined-like', () => {
        const item = makeItem({ description: '' });
        const { container } = render(<Card item={item} />);
        const descEl = container.querySelector('.card-description');
        expect(descEl).toBeNull();
        // Verify no empty space is left — card-meta should directly follow card-title
        const title = container.querySelector('.card-title');
        expect(title!.nextElementSibling!.classList.contains('card-meta')).toBe(true);
      });
    });
  });
});
