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

  it('renders nothing when there is no message', () => {
    mockToastMessage = null;
    const { container } = render(<Toast />);
    const toast = container.querySelector('.toast');
    expect(toast).toBeNull();
  });
});
