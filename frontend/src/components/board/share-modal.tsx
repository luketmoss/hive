import { useState, useCallback, useRef } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showShareModal, activeBoard, activeBoardId, permissions, owners, boards, showDeleteBoardModal, userBoardRole, accessibleBoards } from '../../state/board-store';
import { shareBoard, unshareBoard, updateBoardAppearance, renameBoardName } from '../../state/actions';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { ColorPicker } from '../shared/color-picker';
import { IconPicker } from '../shared/icon-picker';
import { LabelSettings } from '../settings/label-settings';

const MAX_NAME_LENGTH = 30;
const HEADING_ID = 'board-settings-title';

export function ShareModal() {
  const { token, user } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);
  const [color, setColor] = useState(activeBoard.value?.color || '');
  const [icon, setIcon] = useState(activeBoard.value?.icon || '');
  const [name, setName] = useState(activeBoard.value?.name || '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const boardId = activeBoardId.value;
  const isOwner = userBoardRole.value === 'owner';

  // Permissions for this board
  const boardPerms = permissions.value.filter(p => p.board_id === boardId);
  const hasWildcard = boardPerms.some(p => p.user_email === '*');
  const memberPerms = boardPerms.filter(p => p.user_email !== '*');

  const close = useCallback(() => {
    showShareModal.value = false;
  }, []);

  const containerRef = useFocusTrap(close);

  // --- Name validation ---
  const validateName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return 'Board name is required';
    if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
    if (boards.value.some(b => b.id !== boardId && b.name.toLowerCase() === trimmed.toLowerCase())) {
      return 'A board with this name already exists';
    }
    return '';
  };

  const handleNameInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setName(value);
    if (nameError) setNameError(validateName(value));
  };

  const handleSaveName = async (e: Event) => {
    e.preventDefault();
    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }
    if (!token) return;
    setSavingName(true);
    const success = await renameBoardName(boardId, name, token);
    setSavingName(false);
    if (!success) {
      // AC6: Return focus to name input so user can retry
      nameInputRef.current?.focus();
    }
  };

  // --- Color / icon (still auto-save) ---
  const handleColorChange = async (newColor: string) => {
    setColor(newColor);
    if (token) await updateBoardAppearance(boardId, newColor, icon, token);
  };

  const handleIconChange = async (newIcon: string) => {
    setIcon(newIcon);
    if (token) await updateBoardAppearance(boardId, color, newIcon, token);
  };

  // --- Share / unshare ---
  const handleAddMember = async (e: Event) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setEmailError('Email is required');
      return;
    }
    if (!trimmed.includes('@')) {
      setEmailError('Enter a valid email address');
      return;
    }
    const isOwnerEmail = owners.value.some(
      o => o.google_account.toLowerCase() === trimmed
    );
    if (!isOwnerEmail) {
      setEmailError("This person isn't a board member yet. Add them to the Owners list first.");
      return;
    }
    const alreadyShared = boardPerms.some(
      p => p.user_email.toLowerCase() === trimmed
    );
    if (alreadyShared) {
      setEmailError('Already shared with this person');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    setEmailError('');
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

  const handleEmailInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setEmail(value);
    if (emailError) setEmailError('');
  };

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
      <div class="modal share-modal" role="dialog" aria-labelledby={HEADING_ID} aria-modal="true">
        <div class="modal-header">
          <h2 id={HEADING_ID}>Board Settings</h2>
          <button class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
        </div>

        {/* Board name + appearance */}
        <form onSubmit={handleSaveName}>
          <div class="modal-body">
            <div class="form-field">
              <label for="board-settings-name">Board Name</label>
              <input
                id="board-settings-name"
                type="text"
                ref={nameInputRef}
                data-autofocus
                value={name}
                onInput={handleNameInput}
                maxLength={MAX_NAME_LENGTH}
                disabled={!isOwner}
                aria-invalid={nameError ? 'true' : undefined}
                aria-describedby={nameError ? 'board-settings-name-error' : undefined}
              />
              <div class="board-name-meta">
                {nameError && (
                  <span id="board-settings-name-error" class="form-error" role="alert">{nameError}</span>
                )}
                <span class={`char-counter ${name.length > MAX_NAME_LENGTH ? 'char-counter-danger' : name.length > MAX_NAME_LENGTH - 5 ? 'char-counter-warning' : ''}`}>
                  {name.length}/{MAX_NAME_LENGTH}
                </span>
              </div>
            </div>

            <div class="form-field">
              <label>Color</label>
              <ColorPicker value={color} onChange={handleColorChange} disabled={!isOwner} />
            </div>

            <div class="form-field">
              <label>Icon</label>
              <IconPicker value={icon} onChange={handleIconChange} disabled={!isOwner} />
            </div>
          </div>

          {isOwner && (
            <div class="modal-footer board-settings-save-footer">
              <button
                type="submit"
                class="btn btn-primary"
                disabled={!name.trim() || savingName}
                data-testid="save-board-name-btn"
              >
                {savingName ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </form>

        {/* Sharing section */}
        <form onSubmit={handleAddMember}>
          <div class="modal-body">
            {/* Share with all toggle */}
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
                  onInput={handleEmailInput}
                  placeholder="Enter email address"
                  aria-invalid={emailError ? 'true' : undefined}
                  aria-describedby={emailError ? 'share-email-error' : undefined}
                />
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={!email.trim() || submitting}
                >
                  {submitting ? 'Adding...' : 'Add'}
                </button>
              </div>
              {emailError && (
                <span id="share-email-error" class="form-error" role="alert">{emailError}</span>
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
                    <span class="share-member-name">
                      {nameForEmail(perm.user_email)}
                      {perm.role === 'owner' && (
                        <span class="share-owner-badge" aria-label="Board owner">(Owner)</span>
                      )}
                    </span>
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

            {/* Danger zone — delete board (AC5: only visible to owners) */}
            {isOwner && (
              <div class="share-danger-zone">
                <span class="share-danger-zone-label">Danger zone</span>
                <button
                  type="button"
                  class="btn btn-danger share-delete-board-btn"
                  disabled={accessibleBoards.value.length <= 1}
                  title={accessibleBoards.value.length <= 1 ? 'This is your last board and cannot be deleted' : `Delete ${activeBoard.value?.name || 'board'}`}
                  onClick={() => {
                    showShareModal.value = false;
                    showDeleteBoardModal.value = true;
                  }}
                  data-testid="delete-board-btn"
                >
                  Delete board
                </button>
              </div>
            )}
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" onClick={close}>Done</button>
          </div>
        </form>

        {/* Labels section */}
        <hr class="share-modal-divider" />
        <div class="share-modal-labels-wrapper">
          {token && <LabelSettings token={token} />}
        </div>
      </div>
    </div>
  );
}
