import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showShareModal, activeBoard, activeBoardId, permissions, owners } from '../../state/board-store';
import { shareBoard, unshareBoard } from '../../state/actions';
import { useFocusTrap } from '../../hooks/use-focus-trap';

export function ShareModal() {
  const { token, user } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const triggerRef = useRef<Element | null>(null);

  const boardId = activeBoardId.value;
  const boardName = activeBoard.value?.name || 'board';

  // Permissions for this board
  const boardPerms = permissions.value.filter(p => p.board_id === boardId);
  const hasWildcard = boardPerms.some(p => p.user_email === '*');
  const memberPerms = boardPerms.filter(p => p.user_email !== '*');

  useEffect(() => {
    triggerRef.current = document.activeElement;
  }, []);

  const close = useCallback(() => {
    showShareModal.value = false;
    if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
    }
  }, []);

  const containerRef = useFocusTrap(close);

  const handleAddMember = async (e: Event) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email is required');
      return;
    }

    // Validate email format
    if (!trimmed.includes('@')) {
      setError('Enter a valid email address');
      return;
    }

    // AC2: Validate against Owners sheet
    const isOwner = owners.value.some(
      o => o.google_account.toLowerCase() === trimmed
    );
    if (!isOwner) {
      setError("This person isn't a board member yet. Add them to the Owners list first.");
      return;
    }

    // Check if already shared
    const alreadyShared = boardPerms.some(
      p => p.user_email.toLowerCase() === trimmed
    );
    if (alreadyShared) {
      setError('Already shared with this person');
      return;
    }

    if (!token) return;
    setSubmitting(true);
    setError('');

    const success = await shareBoard(boardId, trimmed, 'member', user?.email || '', token);
    setSubmitting(false);

    if (success) {
      setRecentlyAdded(trimmed);
      setEmail('');
      setTimeout(() => setRecentlyAdded(null), 2000);
    }
  };

  const handleRemove = async (userEmail: string) => {
    if (!token) return;
    setConfirmRemove(null);
    await unshareBoard(boardId, userEmail, user?.email || '', token);
  };

  const handleToggleShareAll = async () => {
    if (!token) return;
    if (hasWildcard) {
      await unshareBoard(boardId, '*', user?.email || '', token);
    } else {
      await shareBoard(boardId, '*', 'member', user?.email || '', token);
    }
  };

  const handleInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setEmail(value);
    if (error) setError('');
  };

  // Find display name for an email
  const nameForEmail = (emailAddr: string): string => {
    const owner = owners.value.find(
      o => o.google_account.toLowerCase() === emailAddr.toLowerCase()
    );
    return owner?.name || emailAddr;
  };

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
      }}
      ref={containerRef}
    >
      <div class="modal share-modal" role="dialog" aria-label={`Share ${boardName}`} aria-modal="true">
        <div class="modal-header">
          <h2>Share "{boardName}"</h2>
          <button class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleAddMember}>
          <div class="modal-body">
            {/* Share with all toggle (AC5) */}
            <div class="share-all-toggle">
              <label class="share-toggle-label">
                <input
                  type="checkbox"
                  checked={hasWildcard}
                  onChange={handleToggleShareAll}
                  data-testid="share-all-toggle"
                />
                <span>Share with all Owners</span>
              </label>
              <span class="form-hint">Everyone in the family can see this board</span>
            </div>

            {/* Add member input */}
            <div class="form-field">
              <label for="share-email">Add a person</label>
              <div class="share-input-row">
                <input
                  id="share-email"
                  type="email"
                  value={email}
                  onInput={handleInput}
                  placeholder="Enter email address"
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'share-email-error' : undefined}
                />
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={!email.trim() || submitting}
                >
                  {submitting ? 'Adding...' : 'Add'}
                </button>
              </div>
              {error && (
                <span id="share-email-error" class="form-error" role="alert">{error}</span>
              )}
            </div>

            {/* Member list */}
            <div class="share-member-list" role="list" aria-label="Board members">
              {memberPerms.length === 0 && !hasWildcard && (
                <p class="share-empty">Share this board with family members</p>
              )}
              {memberPerms.map(perm => (
                <div
                  key={perm.user_email}
                  class={`share-member-row ${recentlyAdded === perm.user_email ? 'share-member-highlight' : ''}`}
                  role="listitem"
                >
                  <div class="share-member-info">
                    <span class="share-member-name">{nameForEmail(perm.user_email)}</span>
                    <span class="share-member-email">{perm.user_email}</span>
                  </div>
                  <span class="share-member-role">{perm.role}</span>
                  {perm.role !== 'owner' && (
                    confirmRemove === perm.user_email ? (
                      <div class="share-confirm-remove">
                        <span>Remove {nameForEmail(perm.user_email)}?</span>
                        <button
                          class="btn btn-ghost btn-sm"
                          onClick={() => handleRemove(perm.user_email)}
                        >
                          Yes
                        </button>
                        <button
                          class="btn btn-ghost btn-sm"
                          onClick={() => setConfirmRemove(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        class="btn btn-ghost btn-sm share-remove-btn"
                        onClick={() => setConfirmRemove(perm.user_email)}
                        aria-label={`Remove ${perm.user_email}`}
                        data-testid={`remove-${perm.user_email}`}
                      >
                        ✕
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" onClick={close}>Done</button>
          </div>
        </form>
      </div>
    </div>
  );
}
