import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isIOS = () => /iP(hone|ad|od)/i.test(navigator.userAgent);

/**
 * #242: `FOCUSABLE_SELECTOR` cannot exclude elements hidden with `display: none`
 * — a CSS selector has no way to ask about rendering. Below 768px the detail
 * panel's first focusable child (the #206 expand button) is hidden, and
 * `.focus()` on a hidden element is a no-op, so focus never entered the dialog.
 *
 * `offsetWidth || offsetHeight || getClientRects().length` is the standard
 * layout test. `checkVisibility()` is cleaner but missing in older Safari, and
 * the project targets mobile browsers.
 */
function isRendered(el: HTMLElement): boolean {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

/**
 * Focusable descendants, narrowed to those actually rendered. Environments
 * without layout (jsdom) report every element as unrendered; when nothing
 * qualifies, fall back to the unfiltered list rather than trapping nothing.
 */
function focusableIn(container: HTMLElement): HTMLElement[] {
  const all = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  const rendered = all.filter(isRendered);
  return rendered.length > 0 ? rendered : all;
}

/**
 * Focus an element that may not be natively focusable — a Kanban card, say.
 * A temporary `tabindex="-1"` makes it a programmatic focus target without
 * adding it to the Tab order (making cards real tab stops is #6, out of scope);
 * it is removed again on blur so the markup is not permanently mutated.
 */
function focusRestoreTarget(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex') && !el.matches(FOCUSABLE_SELECTOR)) {
    el.setAttribute('tabindex', '-1');
    el.addEventListener('blur', () => el.removeAttribute('tabindex'), { once: true });
  }
  el.focus();
}

export interface FocusTrapOptions {
  /**
   * Where focus should land when the trap closes and the element that had
   * focus on mount cannot take it back — because nothing was focused (a cold
   * deep link, #240) or the opener was a non-focusable element such as a card,
   * which leaves `document.activeElement` on `body`.
   */
  restoreFocusTo?: () => HTMLElement | null;
}

function lockScroll(): () => void {
  const scrollY = window.scrollY;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  const body = document.body;

  if (isIOS()) {
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
  } else {
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  return () => {
    if (isIOS()) {
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      window.scrollTo(0, scrollY);
    } else {
      body.style.overflow = '';
      body.style.paddingRight = '';
    }
  };
}

/**
 * Traps focus within a container element. When the user tabs past the last
 * focusable element, focus wraps to the first; shift-tabbing past the first
 * wraps to the last. Calls `onEscape` when Escape is pressed.
 *
 * On mount, captures `document.activeElement` as the trigger element.
 * On unmount (or when onEscape fires), restores focus to that trigger — or,
 * when the trigger was `body` or has gone away, to `options.restoreFocusTo()`.
 *
 * Initial focus targets `[autofocus]` or `[data-autofocus]` inside the
 * container, falling back to the first focusable element that is actually
 * rendered — hidden elements are skipped (#242).
 *
 * Also locks background scroll while the trap is active and restores
 * the exact scroll position on unmount.
 */
export function useFocusTrap(onEscape?: () => void, options?: FocusTrapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Capture the element that had focus when the trap mounted
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Lock background scroll
    const unlockScroll = lockScroll();

    // Focus the autofocus element, or fall back to the first focusable element
    const autofocusEl = container.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
    const focusableEls = focusableIn(container);
    // Skip a hidden autofocus target only when there is a rendered alternative;
    // without layout information (jsdom) the declared target still wins.
    const autofocusUsable =
      autofocusEl && (isRendered(autofocusEl) || !focusableEls.some(isRendered));
    if (autofocusUsable) {
      autofocusEl.focus();
    } else if (focusableEls.length > 0) {
      focusableEls[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = focusableIn(container);
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
      unlockScroll();
      // Restore focus on unmount (#242). A non-focusable opener — a Kanban card —
      // leaves the captured trigger on `body`, and a dialog opened with no user
      // action at all has no trigger; both fall through to `restoreFocusTo`
      // rather than dropping focus on `document.body`.
      const trigger = triggerRef.current;
      const triggerUsable =
        trigger &&
        trigger !== document.body &&
        trigger.isConnected &&
        typeof trigger.focus === 'function';
      const target = triggerUsable ? trigger : optionsRef.current?.restoreFocusTo?.() ?? null;
      if (target && target.isConnected) {
        focusRestoreTarget(target);
      }
    };
  }, []);

  return containerRef;
}
