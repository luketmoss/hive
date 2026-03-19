import { useState, useRef, useEffect, useCallback } from 'preact/hooks';

export interface KebabAction {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onAction: () => void;
}

interface Props {
  actions: KebabAction[];
  /** aria-label for the trigger button */
  itemTitle: string;
}

export function KebabMenu({ actions, itemTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false);
        // Don't refocus trigger on outside click — let natural focus flow
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  // Focus first enabled item when menu opens
  useEffect(() => {
    if (!open) return;
    const firstEnabled = actions.findIndex(a => !a.disabled);
    setFocusIndex(firstEnabled >= 0 ? firstEnabled : 0);
  }, [open, actions]);

  // Focus the active menu item when focusIndex changes
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[focusIndex]?.focus();
  }, [open, focusIndex]);

  const handleTriggerClick = (e: MouseEvent) => {
    e.stopPropagation(); // Don't open card detail
    setOpen(prev => !prev);
  };

  const handleTriggerKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation(); // Don't open card detail
      setOpen(prev => !prev);
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        // Cycle forward, skipping disabled
        let next = (focusIndex + 1) % actions.length;
        let attempts = 0;
        while (actions[next].disabled && attempts < actions.length) {
          next = (next + 1) % actions.length;
          attempts++;
        }
        setFocusIndex(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        let prev = (focusIndex - 1 + actions.length) % actions.length;
        let attempts = 0;
        while (actions[prev].disabled && attempts < actions.length) {
          prev = (prev - 1 + actions.length) % actions.length;
          attempts++;
        }
        setFocusIndex(prev);
        break;
      }
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        // Close menu on Tab
        setOpen(false);
        break;
    }
  };

  const handleItemClick = (action: KebabAction, e: MouseEvent) => {
    e.stopPropagation();
    if (action.disabled) return;
    setOpen(false);
    action.onAction();
  };

  const handleItemKeyDown = (action: KebabAction, e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !action.disabled) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      action.onAction();
    }
  };

  return (
    <div class="kebab-menu-container">
      <button
        ref={triggerRef}
        class="kebab-trigger"
        type="button"
        tabIndex={0}
        aria-label={`Actions for ${itemTitle}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={menuRef}
          class="kebab-dropdown"
          role="menu"
          aria-label={`Actions for ${itemTitle}`}
          onKeyDown={handleMenuKeyDown}
        >
          {actions.map((action, i) => (
            <div
              key={action.label}
              role="menuitem"
              tabIndex={focusIndex === i ? 0 : -1}
              class={`kebab-item${action.disabled ? ' kebab-item-disabled' : ''}${action.danger ? ' kebab-item-danger' : ''}`}
              aria-disabled={action.disabled || undefined}
              onClick={(e: MouseEvent) => handleItemClick(action, e)}
              onKeyDown={(e: KeyboardEvent) => handleItemKeyDown(action, e)}
            >
              {action.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
