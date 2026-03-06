import { useState, useRef, useCallback } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { updateDisplayName } from '../../state/actions';
import type { UserInfo } from '../../api/types';

interface ProfileDialogProps {
  user: UserInfo;
  currentName: string;
  token: string;
  onClose: () => void;
  onNameUpdated?: (newName: string) => void;
}

export function ProfileDialog({ user, currentName, token, onClose, onNameUpdated }: ProfileDialogProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleClose = useCallback(() => {
    if (saving) return; // Suppress dismiss while save is in flight
    onClose();
  }, [saving, onClose]);

  const trapRef = useFocusTrap(handleClose);

  const validate = (value: string): string => {
    const cleaned = value.replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (!cleaned) return 'Display name cannot be empty';
    if (cleaned.length > 50) return 'Display name must be 50 characters or fewer';
    return '';
  };

  const handleSave = async () => {
    const cleaned = name.replace(/[\x00-\x1f\x7f]/g, '').trim();
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      await updateDisplayName(cleaned, user.email, currentName, token);
      onNameUpdated?.(cleaned);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update display name');
    } finally {
      setSaving(false);
    }
  };

  const handleInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setName(value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    handleSave();
  };

  const handleOverlayClick = (e: Event) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      handleClose();
    }
  };

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div
        class="modal profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="User Profile"
        ref={trapRef}
      >
        <div class="modal-header">
          <h2>Profile</h2>
          <button
            class="btn btn-ghost"
            onClick={handleClose}
            aria-label="Close"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="profile-avatar-section">
            {user.picture && (
              <img src={user.picture} alt="" class="profile-avatar" />
            )}
          </div>

          <div class="form-field">
            <label for="profile-email">Email</label>
            <input
              id="profile-email"
              type="text"
              value={user.email}
              readOnly
              class="profile-email-input"
            />
          </div>

          <div class="form-field">
            <label for="profile-name">Display Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onInput={handleInput}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'profile-name-error' : undefined}
            />
            {error && (
              <div id="profile-name-error" class="profile-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-ghost"
              onClick={handleClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
