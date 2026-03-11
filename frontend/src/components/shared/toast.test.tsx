import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { Toast } from './toast';

afterEach(() => {
  cleanup();
});

// Provide a mutable reference for the mock
let mockToastMessage: { text: string; type: 'success' | 'error' } | null = null;

vi.mock('../../state/board-store', () => ({
  toastMessage: {
    get value() { return mockToastMessage; },
  },
  openDetailWithTitleEdit: { value: false },
}));

describe('Toast ARIA roles (Issue #7)', () => {
  beforeEach(() => {
    mockToastMessage = null;
  });

  it('has role="status" when visible', () => {
    mockToastMessage = { text: 'Item saved', type: 'success' };
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.getAttribute('role')).toBe('status');
  });

  it('has aria-live="polite" when visible', () => {
    mockToastMessage = { text: 'Item saved', type: 'success' };
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });

  it('renders empty .toast element when there is no message (AC6: pre-rendered)', () => {
    mockToastMessage = null;
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast') as HTMLElement;
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('');
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
    const toast = container.querySelector('.toast') as HTMLElement;
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });

  it('updates text in-place when message fires (no mount/unmount)', () => {
    mockToastMessage = null;
    const { container, rerender } = render(<Toast />);
    const toastBefore = container.querySelector('.toast') as HTMLElement;
    expect(toastBefore.textContent).toBe('');

    // Fire a message
    mockToastMessage = { text: 'Item created', type: 'success' };
    rerender(<Toast />);

    const toastAfter = container.querySelector('.toast') as HTMLElement;
    expect(toastAfter.textContent).toBe('Item created');
    // Same DOM element — updated in-place
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
