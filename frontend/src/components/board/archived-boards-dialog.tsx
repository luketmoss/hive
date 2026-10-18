import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showArchivedBoardsDialog, archivedBoards, items, userRoleForBoard } from '../../state/board-store';
import { unarchiveBoard } from '../../state/actions';
import { useFocusTrap } from '../../hooks/use-focus-trap';

function formatArchivedDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * #288: Every archived board the user can access, newest first. Owners can
 * unarchive from here; members see the list only. Not to be confused with
 * the completed-items ArchiveDialog.
 */
export function ArchivedBoardsDialog() {
  const { token, user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Index of the row whose button should take focus once the restored row is gone.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    showArchivedBoardsDialog.value = false;
  }, []);

  const containerRef = useFocusTrap(close);
  const list = archivedBoards.value;

  // After an unarchive, focus moves to the next row's button (or the previous
  // row's when the last row went), and to Close once the list is empty, so it
  // never lands on a removed node.
  useEffect(() => {
    if (focusIndex === null) return;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [];
    const target = buttons[Math.min(focusIndex, buttons.length - 1)] ?? closeRef.current;
    target?.focus();
    setFocusIndex(null);
  }, [focusIndex, list.length]);

  const handleUnarchive = async (boardId: string, index: number) => {
    if (!token) return;
    setBusyId(boardId);
    const ok = await unarchiveBoard(boardId, user?.email || '', token);
    setBusyId(null);
    if (ok) setFocusIndex(index);
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
        aria-labelledby="archived-boards-title"
        data-testid="archived-boards-dialog"
      >
        <div class="modal-header">
          <h2 id="archived-boards-title">Archived Boards</h2>
          <button ref={closeRef} class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
        </div>

        <div class="modal-body">
          {list.length === 0 ? (
            <p class="archived-boards-empty" data-testid="archived-boards-empty">No archived boards</p>
          ) : (
            <ul class="archived-boards-list" ref={listRef}>
              {list.map((b, index) => {
                const count = items.value.filter(i => i.board_id === b.id).length;
                const isOwner = userRoleForBoard(b.id) === 'owner';
                const date = formatArchivedDate(b.archived_at || '');
                return (
                  <li key={b.id} class="archived-boards-row" data-testid="archived-board-row">
                    <div class="archived-boards-info">
                      <div class="archived-boards-name">
                        {b.icon ? <span aria-hidden="true">{b.icon} </span> : null}
                        {b.name}
                      </div>
                      <div class="archived-boards-meta">
                        {date ? `Archived ${date} · ` : ''}{count} item{count !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        type="button"
                        class="btn btn-primary"
                        aria-label={`Unarchive ${b.name}`}
                        disabled={busyId !== null}
                        onClick={() => handleUnarchive(b.id, index)}
                        data-testid="unarchive-board-btn"
                      >
                        {busyId === b.id ? 'Restoring…' : 'Unarchive'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onClick={close}>Done</button>
        </div>
      </div>
    </div>
  );
}
