import { useState, useCallback } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showMoveToBoardModal, selectedItem, childrenOfSelected, accessibleBoards, activeBoardId } from '../../state/board-store';
import { moveItemToBoard } from '../../state/actions';
import { useFocusTrap } from '../../hooks/use-focus-trap';

export function MoveToBoardModal() {
  const { token, user } = useAuth();
  const item = selectedItem.value;
  if (!item) return null;

  const actor = user?.name || 'web';
  const subtaskCount = childrenOfSelected.value.length;
  const otherBoards = accessibleBoards.value.filter(b => b.id !== activeBoardId.value);

  const [targetBoardId, setTargetBoardId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    showMoveToBoardModal.value = false;
  }, []);

  const containerRef = useFocusTrap(close);

  const handleConfirm = async () => {
    if (!targetBoardId || !token) return;
    setSubmitting(true);
    await moveItemToBoard(item.id, targetBoardId, actor, token);
    setSubmitting(false);
    close();
  };

  return (
    <div
      class="modal-overlay"
      ref={containerRef}
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
      }}
    >
      <div class="modal move-to-board-modal" role="dialog" aria-label="Move to board" aria-modal="true">
        <div class="modal-header">
          <h2>Move to Board</h2>
          <button class="btn btn-ghost" onClick={close} aria-label="Close">&#10005;</button>
        </div>

        <div class="modal-body">
          <p>Select a board to move "{item.title}" to:</p>

          <div class="move-board-options" role="radiogroup" aria-label="Target board">
            {otherBoards.map(b => (
              <label key={b.id} class="move-board-option">
                <input
                  type="radio"
                  name="target-board"
                  value={b.id}
                  checked={targetBoardId === b.id}
                  onChange={() => setTargetBoardId(b.id)}
                />
                <span>{b.icon ? `${b.icon} ` : ''}{b.name}</span>
              </label>
            ))}
          </div>

          {targetBoardId && subtaskCount > 0 && (
            <p class="move-subtask-warning">
              {subtaskCount} sub-task{subtaskCount !== 1 ? 's' : ''} will also move.
            </p>
          )}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onClick={close}>Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={!targetBoardId || submitting}
            onClick={handleConfirm}
            data-testid="confirm-move-board"
          >
            {submitting ? 'Moving\u2026' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
