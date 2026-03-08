import { useFocusTrap } from '../../hooks/use-focus-trap';

interface ShortcutsHelpProps {
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string;
  description: string;
}

const NAVIGATION_SHORTCUTS: ShortcutEntry[] = [
  { keys: 'Ctrl+1-9', description: 'Switch to board by position' },
  { keys: '?', description: 'Show keyboard shortcuts' },
];

const ACTION_SHORTCUTS: ShortcutEntry[] = [
  { keys: 'N', description: 'Create new item' },
  { keys: 'A', description: 'Open completed items archive' },
  { keys: 'Ctrl+Shift+S', description: 'Share board (owner only)' },
];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  const containerRef = useFocusTrap(onClose);

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) onClose();
      }}
      ref={containerRef}
    >
      <div
        class="modal shortcuts-help"
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
      >
        <div class="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button class="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          <div class="shortcuts-group">
            <h3 class="shortcuts-group-title">Navigation</h3>
            {NAVIGATION_SHORTCUTS.map(s => (
              <div key={s.keys} class="shortcut-row">
                <kbd class="shortcut-keys">{s.keys}</kbd>
                <span class="shortcut-desc">{s.description}</span>
              </div>
            ))}
          </div>
          <div class="shortcuts-group">
            <h3 class="shortcuts-group-title">Actions</h3>
            {ACTION_SHORTCUTS.map(s => (
              <div key={s.keys} class="shortcut-row">
                <kbd class="shortcut-keys">{s.keys}</kbd>
                <span class="shortcut-desc">{s.description}</span>
              </div>
            ))}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
