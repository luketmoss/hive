import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { Toast } from './toast';

afterEach(() => {
  cleanup();
});

// Provide a mutable reference for the mock
let mockToastMessage: { text: string; type: 'success' | 'error'; action?: { label: string; fn: () => void }; duration?: number } | null = null;

const mockPauseToastTimer = vi.fn();
const mockResumeToastTimer = vi.fn();
const mockDismissToast = vi.fn();

vi.mock('../../state/board-store', () => ({
  toastMessage: {
    get value() { return mockToastMessage; },
  },
  openDetailWithTitleEdit: { value: false },
  pauseToastTimer: (...args: unknown[]) => mockPauseToastTimer(...args),
  resumeToastTimer: (...args: unknown[]) => mockResumeToastTimer(...args),
  dismissToast: (...args: unknown[]) => mockDismissToast(...args),
}));

describe('Toast ARIA roles (Issue #7)', () => {
  beforeEach(() => {
    mockToastMessage = null;
  });

  it('has role="status" on inner aria-live region when visible', () => {
    mockToastMessage = { text: 'Item saved', type: 'success' };
    const { container } = render(<Toast />);
    const liveRegion = container.querySelector('[role="status"]') as HTMLElement;
    expect(liveRegion).not.toBeNull();
    expect(liveRegion.textContent).toBe('Item saved');
  });

  it('has aria-live="polite" on inner region when visible', () => {
    mockToastMessage = { text: 'Item saved', type: 'success' };
    const { container } = render(<Toast />);
    const liveRegion = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(liveRegion).not.toBeNull();
  });

  it('renders empty .toast element when there is no message (pre-rendered)', () => {
    mockToastMessage = null;
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.classList.contains('toast-empty')).toBe(true);
  });
});

describe('Toast pre-rendered (Issue #157 AC6)', () => {
  beforeEach(() => {
    mockToastMessage = null;
  });

  it('always renders .toast element in DOM, even with no message', () => {
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast');
    expect(toast).not.toBeNull();
  });

  it('has role="status" and aria-live="polite" even when empty', () => {
    const { container } = render(<Toast />);
    const liveRegion = container.querySelector('[role="status"]') as HTMLElement;
    expect(liveRegion).not.toBeNull();
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
  });

  it('updates text in-place when message fires (no mount/unmount)', () => {
    mockToastMessage = null;
    const { container, rerender } = render(<Toast />);
    const toastBefore = container.querySelector('.toast') as HTMLElement;
    const liveRegion = toastBefore.querySelector('[role="status"]') as HTMLElement;
    expect(liveRegion.textContent).toBe('');

    // Fire a message
    mockToastMessage = { text: 'Item created', type: 'success' };
    rerender(<Toast />);

    const toastAfter = container.querySelector('.toast') as HTMLElement;
    const liveRegionAfter = toastAfter.querySelector('[role="status"]') as HTMLElement;
    expect(liveRegionAfter.textContent).toBe('Item created');
    // Same outer DOM element — updated in-place
    expect(toastAfter).toBe(toastBefore);
  });

  it('applies toast-success class when message type is success', () => {
    mockToastMessage = { text: 'Done', type: 'success' };
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;
    expect(toast.classList.contains('toast-success')).toBe(true);
  });

  it('applies toast-error class when message type is error', () => {
    mockToastMessage = { text: 'Fail', type: 'error' };
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;
    expect(toast.classList.contains('toast-error')).toBe(true);
  });
});

describe('Toast action button (Issue #161 AC1/AC3)', () => {
  beforeEach(() => {
    mockToastMessage = null;
    mockDismissToast.mockReset();
  });

  it('renders an Undo button when action is provided', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched to custom order', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(<Toast />);
    const btn = container.querySelector('.toast-action') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Undo');
  });

  it('does NOT render action button when no action', () => {
    mockToastMessage = { text: 'Simple toast', type: 'success' };
    const { container } = render(<Toast />);
    const btn = container.querySelector('.toast-action');
    expect(btn).toBeNull();
  });

  it('action button is OUTSIDE the aria-live region', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(<Toast />);
    const liveRegion = container.querySelector('[role="status"]') as HTMLElement;
    const btn = container.querySelector('.toast-action') as HTMLButtonElement;
    expect(liveRegion.contains(btn)).toBe(false);
  });

  it('clicking action button calls fn and dismisses toast', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(<Toast />);
    const btn = container.querySelector('.toast-action') as HTMLButtonElement;

    fireEvent.click(btn);

    expect(fn).toHaveBeenCalledOnce();
    expect(mockDismissToast).toHaveBeenCalledOnce();
  });
});

describe('Toast U key shortcut (Issue #161 AC3)', () => {
  beforeEach(() => {
    mockToastMessage = null;
    mockDismissToast.mockReset();
  });

  it('pressing U key calls action fn and dismisses toast', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    render(<Toast />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
    });

    expect(fn).toHaveBeenCalledOnce();
    expect(mockDismissToast).toHaveBeenCalledOnce();
  });

  it('U key does not fire when no action toast', () => {
    mockToastMessage = { text: 'Simple', type: 'success' };
    render(<Toast />);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
    });

    expect(mockDismissToast).not.toHaveBeenCalled();
  });

  it('U key does not fire when typing in an input', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(
      <div>
        <Toast />
        <input type="text" data-testid="input" />
      </div>
    );
    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', bubbles: true }));
    });

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Toast timer pause/resume (Issue #161 AC4)', () => {
  beforeEach(() => {
    mockToastMessage = null;
    mockPauseToastTimer.mockReset();
    mockResumeToastTimer.mockReset();
  });

  it('pauses timer on mouse enter when action is present', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;

    fireEvent.mouseEnter(toast);

    expect(mockPauseToastTimer).toHaveBeenCalledOnce();
  });

  it('resumes timer on mouse leave when action is present', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;

    fireEvent.mouseEnter(toast);
    fireEvent.mouseLeave(toast);

    expect(mockResumeToastTimer).toHaveBeenCalledOnce();
  });

  it('pauses timer on Undo button focus', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(<Toast />);
    const btn = container.querySelector('.toast-action') as HTMLButtonElement;

    fireEvent.focus(btn);

    expect(mockPauseToastTimer).toHaveBeenCalled();
  });

  it('resumes timer on Undo button blur', () => {
    const fn = vi.fn();
    mockToastMessage = { text: 'Switched', type: 'success', action: { label: 'Undo', fn }, duration: 10000 };
    const { container } = render(<Toast />);
    const btn = container.querySelector('.toast-action') as HTMLButtonElement;

    fireEvent.focus(btn);
    fireEvent.blur(btn);

    expect(mockResumeToastTimer).toHaveBeenCalled();
  });

  it('does NOT pause timer on hover when no action', () => {
    mockToastMessage = { text: 'Simple', type: 'success' };
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;

    fireEvent.mouseEnter(toast);

    expect(mockPauseToastTimer).not.toHaveBeenCalled();
  });
});
