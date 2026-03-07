import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { useState } from 'preact/hooks';
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

/** Harness that re-renders on input change (simulates the ShareModal bug) */
function ReRenderHarness({ onEscape }: { onEscape?: () => void }) {
  const [value, setValue] = useState('');
  const ref = useFocusTrap(onEscape);
  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn-close">Close</button>
      <input
        data-testid="input-email"
        type="text"
        value={value}
        onInput={(e) => setValue((e.target as HTMLInputElement).value)}
      />
      <button data-testid="btn-submit">Submit</button>
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

  it('does not steal focus from input when component re-renders (AC1)', () => {
    const { getByTestId } = render(<ReRenderHarness onEscape={() => {}} />);
    const emailInput = getByTestId('input-email');

    // Focus the input (simulating user click)
    emailInput.focus();
    expect(document.activeElement).toBe(emailInput);

    // Simulate typing which triggers re-render via state change
    fireEvent.input(emailInput, { target: { value: 't' } });
    expect(document.activeElement).toBe(emailInput);

    fireEvent.input(emailInput, { target: { value: 'te' } });
    expect(document.activeElement).toBe(emailInput);

    fireEvent.input(emailInput, { target: { value: 'tes' } });
    expect(document.activeElement).toBe(emailInput);
  });

  it('uses latest onEscape callback even after re-renders (AC3)', () => {
    const onEscape1 = vi.fn();
    const { getByTestId, rerender } = render(<TestHarness onEscape={onEscape1} />);
    const container = getByTestId('trap-container');

    // Re-render with a new callback
    const onEscape2 = vi.fn();
    rerender(<TestHarness onEscape={onEscape2} />);

    // Press Escape — should call the latest callback
    fireEvent.keyDown(container, { key: 'Escape' });
    expect(onEscape1).not.toHaveBeenCalled();
    expect(onEscape2).toHaveBeenCalledTimes(1);
  });
});
