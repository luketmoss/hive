import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { useFocusTrap } from './use-focus-trap';

afterEach(() => {
  cleanup();
});

function TestHarness({ onEscape }: { onEscape?: () => void }) {
  const ref = useFocusTrap(onEscape);
  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn-first">First</button>
      <input data-testid="input-middle" type="text" />
      <button data-testid="btn-last">Last</button>
    </div>
  );
}

function EmptyHarness({ onEscape }: { onEscape?: () => void }) {
  const ref = useFocusTrap(onEscape);
  return (
    <div ref={ref} data-testid="trap-container">
      <span>No focusable elements here</span>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('focuses the first focusable element on mount', () => {
    const { getByTestId } = render(<TestHarness />);
    expect(document.activeElement).toBe(getByTestId('btn-first'));
  });

  it('wraps focus from last to first on Tab', () => {
    const { getByTestId } = render(<TestHarness />);
    const container = getByTestId('trap-container');
    const lastBtn = getByTestId('btn-last');

    lastBtn.focus();
    fireEvent.keyDown(container, { key: 'Tab' });

    expect(document.activeElement).toBe(getByTestId('btn-first'));
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    const { getByTestId } = render(<TestHarness />);
    const container = getByTestId('trap-container');
    const firstBtn = getByTestId('btn-first');

    firstBtn.focus();
    fireEvent.keyDown(container, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(getByTestId('btn-last'));
  });

  it('calls onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    const { getByTestId } = render(<TestHarness onEscape={onEscape} />);
    const container = getByTestId('trap-container');

    fireEvent.keyDown(container, { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does not throw when there are no focusable elements', () => {
    expect(() => render(<EmptyHarness />)).not.toThrow();
  });

  it('allows normal Tab when focus is on middle elements', () => {
    const { getByTestId } = render(<TestHarness />);
    const container = getByTestId('trap-container');
    const middleInput = getByTestId('input-middle');

    middleInput.focus();
    // Tab on a middle element should not prevent default (browser handles it)
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    container.dispatchEvent(event);

    // preventDefault should NOT be called because we're not on the last element
    expect(preventSpy).not.toHaveBeenCalled();
  });
});
