import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
import { KebabMenu } from './kebab-menu';
import type { KebabAction } from './kebab-menu';

function makeActions(overrides: Partial<KebabAction>[] = []): KebabAction[] {
  const defaults: KebabAction[] = [
    { label: 'Move to top', onAction: vi.fn() },
    { label: 'Move to bottom', onAction: vi.fn() },
    { label: 'Delete', danger: true, onAction: vi.fn() },
  ];
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
}

describe('KebabMenu', () => {
  // AC1: Kebab button visibility
  describe('AC1: Kebab button visibility', () => {
    it('renders a ⋯ trigger button', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger');
      expect(trigger).not.toBeNull();
      expect(trigger!.textContent).toBe('⋯');
    });

    it('trigger button is keyboard-focusable (tabIndex=0)', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      expect(trigger.getAttribute('tabindex')).toBe('0');
    });

    it('trigger has accessible aria-label with item title', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Buy groceries" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      expect(trigger.getAttribute('aria-label')).toBe('Actions for Buy groceries');
    });

    it('trigger has aria-haspopup="menu"', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    });
  });

  // AC2: Menu opens and closes
  describe('AC2: Menu opens and closes', () => {
    it('menu is not visible initially', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const dropdown = container.querySelector('.kebab-dropdown');
      expect(dropdown).toBeNull();
    });

    it('menu opens on trigger click', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      fireEvent.click(trigger);
      const dropdown = container.querySelector('.kebab-dropdown');
      expect(dropdown).not.toBeNull();
    });

    it('menu shows three items: Move to top, Move to bottom, Delete', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBe(3);
      expect(items[0].textContent).toBe('Move to top');
      expect(items[1].textContent).toBe('Move to bottom');
      expect(items[2].textContent).toBe('Delete');
    });

    it('menu has role="menu"', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const dropdown = container.querySelector('.kebab-dropdown');
      expect(dropdown!.getAttribute('role')).toBe('menu');
    });

    it('aria-expanded is true when menu is open', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(trigger);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('menu closes on Escape key', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      expect(container.querySelector('.kebab-dropdown')).not.toBeNull();

      const dropdown = container.querySelector('.kebab-dropdown')!;
      fireEvent.keyDown(dropdown, { key: 'Escape' });
      expect(container.querySelector('.kebab-dropdown')).toBeNull();
    });

    it('menu opens on Enter key on trigger', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      fireEvent.keyDown(trigger, { key: 'Enter' });
      expect(container.querySelector('.kebab-dropdown')).not.toBeNull();
    });

    it('menu opens on Space key on trigger', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      fireEvent.keyDown(trigger, { key: ' ' });
      expect(container.querySelector('.kebab-dropdown')).not.toBeNull();
    });

    it('click on trigger toggles menu closed', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      const trigger = container.querySelector('.kebab-trigger') as HTMLElement;
      fireEvent.click(trigger);
      expect(container.querySelector('.kebab-dropdown')).not.toBeNull();
      fireEvent.click(trigger);
      expect(container.querySelector('.kebab-dropdown')).toBeNull();
    });
  });

  // AC3: Keyboard navigation within the menu
  describe('AC3: Keyboard navigation within the menu', () => {
    it('ArrowDown moves focus to next menu item', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const dropdown = container.querySelector('.kebab-dropdown')!;
      const items = dropdown.querySelectorAll('[role="menuitem"]');

      // First item should be focused initially
      expect(items[0].getAttribute('tabindex')).toBe('0');

      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
      // After arrow down, second item should have tabIndex 0
      expect(items[1].getAttribute('tabindex')).toBe('0');
    });

    it('ArrowUp moves focus to previous menu item', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const dropdown = container.querySelector('.kebab-dropdown')!;
      // Move down first, then back up
      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
      fireEvent.keyDown(dropdown, { key: 'ArrowUp' });

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      expect(items[0].getAttribute('tabindex')).toBe('0');
    });

    it('ArrowDown wraps from last to first item', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const dropdown = container.querySelector('.kebab-dropdown')!;
      // Go down 3 times to wrap around
      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      expect(items[0].getAttribute('tabindex')).toBe('0');
    });

    it('ArrowUp wraps from first to last item', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const dropdown = container.querySelector('.kebab-dropdown')!;
      fireEvent.keyDown(dropdown, { key: 'ArrowUp' });

      const items = dropdown.querySelectorAll('[role="menuitem"]');
      expect(items[2].getAttribute('tabindex')).toBe('0');
    });

    it('Enter on a menu item triggers the action and closes menu', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const items = container.querySelectorAll('[role="menuitem"]');
      fireEvent.keyDown(items[0], { key: 'Enter' });
      expect(actions[0].onAction).toHaveBeenCalled();
      expect(container.querySelector('.kebab-dropdown')).toBeNull();
    });

    it('Space on a menu item triggers the action and closes menu', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const items = container.querySelectorAll('[role="menuitem"]');
      fireEvent.keyDown(items[1], { key: ' ' });
      expect(actions[1].onAction).toHaveBeenCalled();
      expect(container.querySelector('.kebab-dropdown')).toBeNull();
    });

    it('ArrowDown skips disabled items', () => {
      const actions = makeActions([{}, { disabled: true }, {}]);
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const dropdown = container.querySelector('.kebab-dropdown')!;
      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });

      // Should skip disabled second item, land on third
      const items = dropdown.querySelectorAll('[role="menuitem"]');
      expect(items[2].getAttribute('tabindex')).toBe('0');
    });
  });

  // AC4/AC5: Disabled states
  describe('AC4/AC5: Disabled states for boundary cards', () => {
    it('disabled menu item has aria-disabled attribute', () => {
      const actions = makeActions([{ disabled: true }]);
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items[0].getAttribute('aria-disabled')).toBe('true');
    });

    it('disabled menu item has kebab-item-disabled class', () => {
      const actions = makeActions([{ disabled: true }]);
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items[0].classList.contains('kebab-item-disabled')).toBe(true);
    });

    it('clicking a disabled item does not trigger its action', () => {
      const actions = makeActions([{ disabled: true }]);
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const items = container.querySelectorAll('[role="menuitem"]');
      fireEvent.click(items[0]);
      expect(actions[0].onAction).not.toHaveBeenCalled();
    });

    it('Enter on a disabled item does not trigger its action', () => {
      const actions = makeActions([{ disabled: true }]);
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const items = container.querySelectorAll('[role="menuitem"]');
      fireEvent.keyDown(items[0], { key: 'Enter' });
      expect(actions[0].onAction).not.toHaveBeenCalled();
    });
  });

  // AC7: Delete item has danger styling
  describe('AC7: Delete item styling', () => {
    it('danger action has kebab-item-danger class', () => {
      const actions = makeActions();
      const { container } = render(<KebabMenu actions={actions} itemTitle="Test" />);
      fireEvent.click(container.querySelector('.kebab-trigger')!);

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items[2].classList.contains('kebab-item-danger')).toBe(true);
    });
  });

  // Click does not propagate to card
  describe('Click isolation', () => {
    it('trigger click does not propagate (stopPropagation)', () => {
      const actions = makeActions();
      const parentClick = vi.fn();
      const { container } = render(
        <div onClick={parentClick}>
          <KebabMenu actions={actions} itemTitle="Test" />
        </div>
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      expect(parentClick).not.toHaveBeenCalled();
    });

    it('menu item click does not propagate', () => {
      const actions = makeActions();
      const parentClick = vi.fn();
      const { container } = render(
        <div onClick={parentClick}>
          <KebabMenu actions={actions} itemTitle="Test" />
        </div>
      );
      fireEvent.click(container.querySelector('.kebab-trigger')!);
      const items = container.querySelectorAll('[role="menuitem"]');
      fireEvent.click(items[0]);
      expect(parentClick).not.toHaveBeenCalled();
    });
  });
});
