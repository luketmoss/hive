import { useState, useCallback } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showArchiveBoardModal, showShareModal, activeBoard, activeBoardId } from '../../state/board-store';
import { archiveBoard } from '../../state/actions';
import { useFocusTrap } from '../../hooks/use-focus-trap';

/**
 * #288: Confirm archiving the active board. Opens on top of Board Settings,
 * which stays mounted underneath, so Cancel and Escape hand focus straight
 * back to the Archive button that opened this.
 */
export function ArchiveBoardModal() {
  const { token, user } = useAuth();
  const boardId = activeBoardId.value;
  const boardName = activeBoard.value?.name || 'board';
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    showArchiveBoardModal.value = false;
  }, []);

  const containerRef = useFocusTrap(close);

  const handleConfirm = async () => {
    if (!token) return;
    setSubmitting(true);
    const success = await archiveBoard(boardId, user?.email || '', token);
    setSubmitting(false);
    if (success) {
      showArchiveBoardModal.value = false;
      showShareModal.value = false;
    }
  };

  return (
    <div
      class="modal-overlay"
      ref={containerRef}
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
      }}
    >
      <div
        class="modal delete-board-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-board-title"
        data-testid="archive-board-modal"
      >
        <div class="modal-header">
          <h2 id="archive-board-title">Archive Board</h2>
          <button class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
        </div>

        <div class="modal-body">
          <p>
            Archive <strong>{boardName}</strong>? Its items will be hidden everywhere. You can
            restore it from <strong>Archived boards</strong> in your profile menu.
          </p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onClick={close}>Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={submitting}
            onClick={handleConfirm}
            data-testid="confirm-archive-board"
          >
            {submitting ? 'Archiving…' : 'Archive board'}
          </button>
        </div>
      </div>
    </div>
  );
}
