import { useState, useCallback } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showDeleteBoardModal, activeBoard, activeBoardId, boards, accessibleBoards } from '../../state/board-store';
import { deleteBoard } from '../../state/actions';
import type { DeleteBoardMode } from '../../state/actions';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { items } from '../../state/board-store';

export function DeleteBoardModal() {
  const { token, user } = useAuth();
  const boardId = activeBoardId.value;
  const boardName = activeBoard.value?.name || 'board';

  // Count items on this board (root + subtasks)
  const boardItemCount = items.value.filter(i => i.board_id === boardId).length;
  const isEmpty = boardItemCount === 0;

  // Other boards to migrate to
  const otherBoards = accessibleBoards.value.filter(b => b.id !== boardId);

  const [mode, setMode] = useState<DeleteBoardMode | null>(null);
  const [targetBoardId, setTargetBoardId] = useState<string>(otherBoards[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    showDeleteBoardModal.value = false;
  }, []);

  const containerRef = useFocusTrap(close);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const success = await deleteBoard(
      boardId,
      isEmpty ? null : mode,
      mode === 'migrate' ? targetBoardId : null,
      user?.email || '',
      token
    );
    setSubmitting(false);
    if (success) {
      close();
    }
  };

  // AC1: Empty board — single step confirmation
  if (isEmpty) {
    return (
      <div
        class="modal-overlay"
        ref={containerRef}
        onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
        }}
      >
        <div class="modal delete-board-modal" role="dialog" aria-label={`Delete ${boardName}`} aria-modal="true">
          <div class="modal-header">
            <h2>Delete Board</h2>
            <button class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
          </div>

          <div class="modal-body">
            <p>Delete "{boardName}"? This cannot be undone.</p>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" onClick={close}>Cancel</button>
            <button
              type="button"
              class="btn btn-danger"
              disabled={submitting}
              onClick={handleConfirm}
              data-testid="confirm-delete-board"
            >
              {submitting ? 'Deleting\u2026' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AC2/AC3: Board with items — two-step flow
  const canConfirm = mode === 'discard' || (mode === 'migrate' && targetBoardId);

  return (
    <div
      class="modal-overlay"
      ref={containerRef}
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
      }}
    >
      <div class="modal delete-board-modal" role="dialog" aria-label={`Delete ${boardName}`} aria-modal="true">
        <div class="modal-header">
          <h2>Delete Board</h2>
          <button class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
        </div>

        <div class="modal-body">
          <p>"{boardName}" has {boardItemCount} item{boardItemCount !== 1 ? 's' : ''}. What would you like to do?</p>

          <div class="delete-board-options" role="radiogroup" aria-label="Delete options">
            {otherBoards.length > 0 && (
              <label class="delete-board-option">
                <input
                  type="radio"
                  name="delete-mode"
                  value="migrate"
                  checked={mode === 'migrate'}
                  onChange={() => setMode('migrate')}
                  data-testid="delete-mode-migrate"
                />
                <span>Move items to another board</span>
              </label>
            )}

            {mode === 'migrate' && (
              <div class="delete-board-target">
                <label for="target-board">Target board</label>
                <select
                  id="target-board"
                  value={targetBoardId}
                  onChange={(e) => setTargetBoardId((e.target as HTMLSelectElement).value)}
                  data-testid="target-board-select"
                >
                  {otherBoards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <label class="delete-board-option">
              <input
                type="radio"
                name="delete-mode"
                value="discard"
                checked={mode === 'discard'}
                onChange={() => setMode('discard')}
                data-testid="delete-mode-discard"
              />
              <span>Delete all items</span>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onClick={close}>Cancel</button>
          <button
            type="button"
            class="btn btn-danger"
            disabled={!canConfirm || submitting}
            onClick={handleConfirm}
            data-testid="confirm-delete-board"
          >
            {submitting ? 'Deleting\u2026' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
