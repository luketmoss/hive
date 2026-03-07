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

function AutofocusHarness({ onEscape }: { onEscape?: () => void }) {
  const ref = useFocusTrap(onEscape);
  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn-first">First</button>
      <input data-testid="input-autofocus" type="text" data-autofocus />
      <button data-testid="btn-last">Last</button>
    </div>
  );
}

function NativeAutofocusHarness({ onEscape }: { onEscape?: () => void }) {
  const ref = useFocusTrap(onEscape);
  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn-first">First</button>
      <input data-testid="input-native-autofocus" type="text" autoFocus />
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
  describe('AC1: Focus trap — Tab wrapping', () => {
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

    it('allows normal Tab when focus is on middle elements', () => {
      const { getByTestId } = render(<TestHarness />);
      const container = getByTestId('trap-container');
      const middleInput = getByTestId('input-middle');

      middleInput.focus();
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      container.dispatchEvent(event);

      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('does not throw when there are no focusable elements', () => {
      expect(() => render(<EmptyHarness />)).not.toThrow();
    });
  });

  describe('AC2: Focus restore on unmount', () => {
    it('captures trigger element on mount and restores focus on unmount', () => {
      // Create and focus an external trigger button
      const trigger = document.createElement('button');
      trigger.textContent = 'Open Modal';
      document.body.appendChild(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      // Mount the trap — focus moves into the trap
      const { unmount } = render(<TestHarness />);
      expect(document.activeElement).not.toBe(trigger);

      // Unmount — focus should return to trigger
      unmount();
      expect(document.activeElement).toBe(trigger);

      document.body.removeChild(trigger);
    });

    it('restores focus when component unmounts after Escape', () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Open Modal';
      document.body.appendChild(trigger);
      trigger.focus();

      const onEscape = vi.fn();
      const { getByTestId, unmount } = render(<TestHarness onEscape={onEscape} />);
      const container = getByTestId('trap-container');

      // Press Escape — onEscape is called
      fireEvent.keyDown(container, { key: 'Escape' });
      expect(onEscape).toHaveBeenCalledTimes(1);

      // Parent responds to onEscape by unmounting the modal
      unmount();
      expect(document.activeElement).toBe(trigger);

      document.body.removeChild(trigger);
    });
  });

  describe('AC3: Escape key handling', () => {
    it('calls onEscape when Escape key is pressed', () => {
      const onEscape = vi.fn();
      const { getByTestId } = render(<TestHarness onEscape={onEscape} />);
      const container = getByTestId('trap-container');

      fireEvent.keyDown(container, { key: 'Escape' });

      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('prevents default on Escape', () => {
      const onEscape = vi.fn();
      const { getByTestId } = render(<TestHarness onEscape={onEscape} />);
      const container = getByTestId('trap-container');

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      container.dispatchEvent(event);

      expect(preventSpy).toHaveBeenCalled();
    });
  });

  describe('AC4: Initial focus targeting', () => {
    it('focuses the first focusable element when no autofocus is present', () => {
      const { getByTestId } = render(<TestHarness />);
      expect(document.activeElement).toBe(getByTestId('btn-first'));
    });

    it('focuses the element with data-autofocus attribute', () => {
      const { getByTestId } = render(<AutofocusHarness />);
      expect(document.activeElement).toBe(getByTestId('input-autofocus'));
    });

    it('focuses the element with native autofocus attribute', () => {
      const { getByTestId } = render(<NativeAutofocusHarness />);
      expect(document.activeElement).toBe(getByTestId('input-native-autofocus'));
    });

    it('prefers autofocus element over first focusable element', () => {
      const { getByTestId } = render(<AutofocusHarness />);
      // The input-autofocus is the second element, not the first
      expect(document.activeElement).toBe(getByTestId('input-autofocus'));
      expect(document.activeElement).not.toBe(getByTestId('btn-first'));
    });
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
