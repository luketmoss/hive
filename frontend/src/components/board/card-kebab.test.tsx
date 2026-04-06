import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { Card } from './card';
import type { ItemWithRow } from '../../api/types';

// Mock board-store
vi.mock('../../state/board-store', () => ({
  selectedItemId: { value: null },
  openDetailWithTitleEdit: { value: false },
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

function makeColumnItems(count: number): ItemWithRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeItem({ id: `item-${i}`, title: `Item ${i}`, sort_order: i + 1 })
  );
}

describe('Card kebab menu integration', () => {
  // AC1: Kebab button appears when handlers are provided
  describe('AC1: Kebab button visibility', () => {
    it('renders kebab trigger when onDelete is provided', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      const trigger = container.querySelector('.kebab-trigger');
      expect(trigger).not.toBeNull();
    });

    it('does not render kebab trigger when no kebab handlers are provided', () => {
      const item = makeItem();
      const { container } = render(<Card item={item} />);
      const trigger = container.querySelector('.kebab-trigger');
      expect(trigger).toBeNull();
    });

    it('kebab trigger is keyboard-accessible (tabIndex=0)', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      expect(trigger.getAttribute('tabindex')).toBe('0');
    });
  });

  // AC4: Move to top disabled when card is first
  describe('AC4: Move to top', () => {
    it('"Move to top" is disabled when card is first in column', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[0]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems[0].getAttribute('aria-disabled')).toBe('true');
    });

    it('"Move to top" is enabled when card is not first in column', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems[0].getAttribute('aria-disabled')).toBeNull();
    });

    it('clicking "Move to top" calls onMoveToTop with item id', () => {
      const onMoveToTop = vi.fn();
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={onMoveToTop}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      fireEvent.click(menuItems[0]);
      expect(onMoveToTop).toHaveBeenCalledWith('item-1');
    });
  });

  // AC5: Move to bottom disabled when card is last
  describe('AC5: Move to bottom', () => {
    it('"Move to bottom" is disabled when card is last in column', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[2]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems[1].getAttribute('aria-disabled')).toBe('true');
    });

    it('"Move to bottom" is enabled when card is not last in column', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[0]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems[1].getAttribute('aria-disabled')).toBeNull();
    });

    it('clicking "Move to bottom" calls onMoveToBottom with item id', () => {
      const onMoveToBottom = vi.fn();
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[0]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={onMoveToBottom}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      fireEvent.click(menuItems[1]);
      expect(onMoveToBottom).toHaveBeenCalledWith('item-0');
    });
  });

  // AC1 (#231): Copy option shown between Move to bottom and Delete
  describe('AC1 (#231): Copy menu item', () => {
    it('"Copy" appears between "Move to bottom" and "Delete"', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems[0].textContent).toBe('Move to top');
      expect(menuItems[1].textContent).toBe('Move to bottom');
      expect(menuItems[2].textContent).toBe('Copy');
      expect(menuItems[3].textContent).toBe('Delete');
    });

    it('clicking "Copy" calls onCopy with item id', () => {
      const onCopy = vi.fn();
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onCopy={onCopy}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      fireEvent.click(menuItems[2]);
      expect(onCopy).toHaveBeenCalledWith('item-1');
    });

    it('"Copy" is not shown when onCopy is not provided', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems).toHaveLength(3); // Move to top, Move to bottom, Delete
      expect(menuItems[2].textContent).toBe('Delete');
    });
  });

  // AC7: Delete action
  describe('AC7: Delete', () => {
    it('clicking "Delete" calls onDelete with item id', () => {
      const onDelete = vi.fn();
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onCopy={vi.fn()}
          onDelete={onDelete}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      fireEvent.click(menuItems[3]); // Delete is now the fourth item
      expect(onDelete).toHaveBeenCalledWith('item-1');
    });

    it('"Delete" item has danger styling', () => {
      const items = makeColumnItems(3);
      const { container } = render(
        <Card
          item={items[1]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems[3].classList.contains('kebab-item-danger')).toBe(true);
    });
  });

  // Single item column — both move actions disabled
  describe('Single item column', () => {
    it('both move actions are disabled when column has only one item', () => {
      const items = makeColumnItems(1);
      const { container } = render(
        <Card
          item={items[0]}
          columnItems={items}
          onMoveToTop={vi.fn()}
          onMoveToBottom={vi.fn()}
          onDelete={vi.fn()}
        />
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const menuItems = container.querySelectorAll('[role="menuitem"]');
      expect(menuItems[0].getAttribute('aria-disabled')).toBe('true'); // Move to top
      expect(menuItems[1].getAttribute('aria-disabled')).toBe('true'); // Move to bottom
    });
  });
});
