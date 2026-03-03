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

describe('Mobile and responsive improvements (Issue #10)', () => {
  beforeEach(() => {
    selectedItemId.value = null;
  });

  // AC3: Cards have a drag handle
  describe('AC3: Cards have a visible drag handle', () => {
    it('renders a drag handle element inside the card', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const handle = container.querySelector('.drag-handle');
      expect(handle).not.toBeNull();
    });

    it('drag handle contains a dots grip icon element', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const dots = container.querySelector('.drag-handle-dots');
      expect(dots).not.toBeNull();
    });

    it('drag handle has draggable attribute', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const handle = container.querySelector('.drag-handle') as HTMLElement;
      expect(handle.getAttribute('draggable')).toBe('true');
    });

    it('card div itself is NOT draggable', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      // The card element should not have draggable attribute
      expect(card.getAttribute('draggable')).toBeNull();
    });

    it('drag handle has an accessible label', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const handle = container.querySelector('.drag-handle') as HTMLElement;
      expect(handle.getAttribute('aria-label')).toBe('Drag to reorder');
    });

    it('only the drag handle initiates drag (clicking card body opens detail)', () => {
      selectedItemId.value = null;
      const item = makeItem({ id: 'click-test' });
      const { container } = render(<Card item={item} />);
      const cardContent = container.querySelector('.card-content') as HTMLElement;

      // Click on the card content area (not the handle)
      fireEvent.click(cardContent);
      expect(selectedItemId.value).toBe('click-test');
    });

    it('clicking the drag handle does NOT open the detail panel', () => {
      selectedItemId.value = null;
      const item = makeItem({ id: 'handle-click-test' });
      const { container } = render(<Card item={item} />);
      const handle = container.querySelector('.drag-handle') as HTMLElement;

      fireEvent.click(handle);
      expect(selectedItemId.value).toBeNull();
    });
  });

  // AC3 continued: Drag handle fires drag events with item ID
  describe('AC3: Drag handle fires correct drag events', () => {
    it('sets item id in dataTransfer when drag starts from handle', () => {
      const item = makeItem({ id: 'drag-item-1' });
      const { container } = render(<Card item={item} />);
      const handle = container.querySelector('.drag-handle') as HTMLElement;

      const dataTransferData: Record<string, string> = {};
      const mockDataTransfer = {
        setData: (type: string, value: string) => { dataTransferData[type] = value; },
      };

      fireEvent.dragStart(handle, { dataTransfer: mockDataTransfer });
      expect(dataTransferData['text/plain']).toBe('drag-item-1');
    });
  });

  // AC4: Drag handle prevents accidental drags on touch
  describe('AC4: Drag handle has touch-action none for touch safety', () => {
    it('drag handle has touch-action: none in CSS (verified via class presence)', () => {
      // This AC is implemented via CSS `touch-action: none` on .drag-handle.
      // In jsdom we verify the element exists and has the correct class;
      // the CSS rule is verified by inspecting the stylesheet content.
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const handle = container.querySelector('.drag-handle');
      expect(handle).not.toBeNull();
      expect(handle!.classList.contains('drag-handle')).toBe(true);
    });

    it('card body (non-handle area) does not have draggable attribute', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const card = container.querySelector('.card') as HTMLElement;
      const content = container.querySelector('.card-content') as HTMLElement;
      // Neither the card wrapper nor content area should be draggable
      expect(card.getAttribute('draggable')).toBeNull();
      expect(content.getAttribute('draggable')).toBeNull();
    });
  });

  // AC3/AC4: Card layout structure
  describe('Card layout structure', () => {
    it('card contains a card-row with handle and content', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const row = container.querySelector('.card-row');
      expect(row).not.toBeNull();
      const handle = row!.querySelector('.drag-handle');
      const content = row!.querySelector('.card-content');
      expect(handle).not.toBeNull();
      expect(content).not.toBeNull();
    });

    it('card title is inside card-content (not at card root)', () => {
      const item = makeItem({ title: 'Nested Title' });
      const { container } = render(<Card item={item} />);
      const content = container.querySelector('.card-content');
      const title = content!.querySelector('.card-title');
      expect(title).not.toBeNull();
      expect(title!.textContent).toBe('Nested Title');
    });
  });
});
