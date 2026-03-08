import { useEffect } from 'preact/hooks';

/** Tags where single-key shortcuts should be suppressed to allow normal typing. */
const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Returns true when focus is in a text input, textarea, or select element. */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (INPUT_TAGS.has(el.tagName)) return true;
  // contentEditable
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export interface Shortcut {
  /** The key to match (e.g. 'a', 'n', '?', '1'). Case-insensitive for letters. */
  key: string;
  /** If true, Ctrl (or Cmd on Mac) must be held. */
  ctrl?: boolean;
  /** If true, Shift must be held. */
  shift?: boolean;
  /** Handler to invoke when the shortcut fires. */
  action: () => void;
  /**
   * If true, this shortcut fires even when an input is focused.
   * Defaults to false — single-key shortcuts are suppressed during input.
   * Modifier shortcuts (ctrl/meta) always fire regardless of this flag.
   */
  allowInInput?: boolean;
}

/**
 * Registers global keyboard shortcuts. Single-key shortcuts (no ctrl/shift modifiers)
 * are suppressed when the user is focused in an input, textarea, or select, so normal
 * typing is preserved. Modifier shortcuts (Ctrl+key) always fire.
 *
 * @param shortcuts Array of shortcut definitions. Changes to the array reference cause re-registration.
 * @param enabled If false, all shortcuts are disabled. Defaults to true.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
          || e.key === shortcut.key; // exact match for non-alpha like '?'

        if (!keyMatch) continue;

        // Check modifier requirements
        const needsCtrl = !!shortcut.ctrl;
        const needsShift = !!shortcut.shift;
        const hasCtrl = e.ctrlKey || e.metaKey;
        const hasShift = e.shiftKey;

        if (needsCtrl !== hasCtrl) continue;
        if (needsShift !== hasShift) continue;

        // For single-key shortcuts (no ctrl/shift), suppress when input is focused
        const isModifier = needsCtrl || needsShift;
        if (!isModifier && !shortcut.allowInInput && isInputFocused()) continue;

        e.preventDefault();
        shortcut.action();
        return; // Only fire first matching shortcut
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
