import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/preact';
import { fireEvent } from '@testing-library/preact';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';
import type { Shortcut } from './use-keyboard-shortcuts';

afterEach(cleanup);

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(document, { key, ...opts });
}

describe('useKeyboardShortcuts', () => {
  describe('AC5: Single-key shortcuts suppressed during input', () => {
    it('fires single-key shortcut when no input is focused', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: 'a', action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      press('a');
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('suppresses single-key shortcut when input is focused', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: 'a', action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      press('a');
      expect(action).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('suppresses single-key shortcut when textarea is focused', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: 'n', action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      press('n');
      expect(action).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('suppresses single-key shortcut when select is focused', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: 'a', action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      const select = document.createElement('select');
      document.body.appendChild(select);
      select.focus();

      press('a');
      expect(action).not.toHaveBeenCalled();

      document.body.removeChild(select);
    });

    it('allows modifier shortcuts even when input is focused', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: '1', ctrl: true, action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      press('1', { ctrlKey: true });
      expect(action).toHaveBeenCalledTimes(1);

      document.body.removeChild(input);
    });
  });

  describe('Modifier key matching', () => {
    it('fires Ctrl+key shortcut with ctrlKey', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: '1', ctrl: true, action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      press('1', { ctrlKey: true });
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('fires Ctrl+key shortcut with metaKey (Mac)', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: '1', ctrl: true, action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      press('1', { metaKey: true });
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('does not fire Ctrl+key when no modifier is pressed', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: '1', ctrl: true, action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      press('1');
      expect(action).not.toHaveBeenCalled();
    });

    it('fires Ctrl+Shift+key shortcut', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: 's', ctrl: true, shift: true, action }];
      renderHook(() => useKeyboardShortcuts(shortcuts));

      press('S', { ctrlKey: true, shiftKey: true });
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe('Enabled flag', () => {
    it('does not fire when disabled', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: 'a', action }];
      renderHook(() => useKeyboardShortcuts(shortcuts, false));

      press('a');
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('removes listener on unmount', () => {
      const action = vi.fn();
      const shortcuts: Shortcut[] = [{ key: 'a', action }];
      const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

      unmount();
      press('a');
      expect(action).not.toHaveBeenCalled();
    });
  });
});
