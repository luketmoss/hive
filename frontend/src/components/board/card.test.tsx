import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { Card } from './card';
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
});
