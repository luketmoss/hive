import { useRef, useEffect } from 'preact/hooks';
import { toastMessage, pauseToastTimer, resumeToastTimer, dismissToast } from '../../state/board-store';

export function Toast() {
  const msg = toastMessage.value;
  const remainingRef = useRef(0);
  const startRef = useRef(0);

  // Track when the toast appears so we know elapsed time for pause/resume
  useEffect(() => {
    if (msg) {
      remainingRef.current = msg.duration ?? 4000;
      startRef.current = Date.now();
    }
  }, [msg?.text, msg?.type]);

  // Global U key shortcut for undo while action toast is visible
  useEffect(() => {
    if (!msg?.action) return;
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        msg.action!.fn();
        dismissToast();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [msg?.action]);

  const handleMouseEnter = () => {
    if (!msg?.action) return;
    const elapsed = Date.now() - startRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    pauseToastTimer();
  };

  const handleMouseLeave = () => {
    if (!msg?.action) return;
    startRef.current = Date.now();
    resumeToastTimer(remainingRef.current);
  };

  const handleFocus = () => {
    if (!msg?.action) return;
    const elapsed = Date.now() - startRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    pauseToastTimer();
  };

  const handleBlur = () => {
    if (!msg?.action) return;
    startRef.current = Date.now();
    resumeToastTimer(remainingRef.current);
  };

  const handleActionClick = () => {
    if (msg?.action) {
      msg.action.fn();
      dismissToast();
    }
  };

  return (
    <div
      class={msg ? `toast toast-${msg.type}` : 'toast toast-empty'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* aria-live region for screen reader announcement — action button is outside */}
      <div role="status" aria-live="polite">
        {msg ? msg.text : ''}
      </div>
      {msg?.action && (
        <button
          class="toast-action"
          type="button"
          onClick={handleActionClick}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {msg.action.label}
        </button>
      )}
    </div>
  );
}
