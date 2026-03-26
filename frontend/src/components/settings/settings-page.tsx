import { useCallback } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { showSettings } from '../../state/board-store';
import { LabelSettings } from './label-settings';

interface SettingsPageProps {
  token: string;
}

export function SettingsPage({ token }: SettingsPageProps) {
  const handleClose = useCallback(() => {
    showSettings.value = false;
  }, []);

  const trapRef = useFocusTrap(handleClose);

  const handleOverlayClick = (e: Event) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      handleClose();
    }
  };

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div
        class="modal settings-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-heading"
        ref={trapRef}
        data-testid="settings-modal"
      >
        <div class="modal-header">
          <h2 id="settings-heading" data-autofocus tabIndex={-1}>Settings</h2>
          <button
            class="btn btn-ghost"
            onClick={handleClose}
            aria-label="Close"
            data-testid="settings-close-btn"
          >
            ✕
          </button>
        </div>

        <div class="settings-body">
          <LabelSettings token={token} />
        </div>
      </div>
    </div>
  );
}
