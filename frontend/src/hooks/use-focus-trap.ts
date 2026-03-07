import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps focus within a container element. When the user tabs past the last
 * focusable element, focus wraps to the first; shift-tabbing past the first
 * wraps to the last. Calls `onEscape` when Escape is pressed.
 *
 * On mount, captures `document.activeElement` as the trigger element.
 * On unmount (or when onEscape fires), restores focus to that trigger.
 *
 * Initial focus targets `[autofocus]` or `[data-autofocus]` inside the
 * container, falling back to the first focusable element.
 */
export function useFocusTrap(onEscape?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Capture the element that had focus when the trap mounted
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Focus the autofocus element, or fall back to the first focusable element
    const autofocusEl = container.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
    if (autofocusEl) {
      autofocusEl.focus();
    } else {
      const focusableEls = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableEls.length > 0) {
        focusableEls[0].focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus to the trigger element on unmount
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [onEscape]);

  return containerRef;
}
