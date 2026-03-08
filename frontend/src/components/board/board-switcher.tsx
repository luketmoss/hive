import { boards, activeBoardId, switchBoard, showCreateBoardModal, showShareModal, accessibleBoards, activeBoard, userBoardRole } from '../../state/board-store';

/** Format the option label for a board: icon (if set) + name. */
function boardOptionLabel(name: string, icon?: string, shortcut?: string): string {
  const prefix = icon ? `${icon} ` : '';
  return shortcut ? `${prefix}${name} (${shortcut})` : `${prefix}${name}`;
}

export function BoardSwitcher() {
  const handleChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === '__new__') {
      showCreateBoardModal.value = true;
      // Reset select to current board so it doesn't show "New Board..."
      (e.target as HTMLSelectElement).value = activeBoardId.value;
      return;
    }
    switchBoard(value);
  };

  if (boards.value.length === 0) {
    return (
      <div class="board-switcher" data-testid="board-switcher">
        <button
          class="btn btn-primary"
          onClick={() => { showCreateBoardModal.value = true; }}
        >
          + New Board
        </button>
      </div>
    );
  }

  const boardName = activeBoard.value?.name || 'board';
  const boardColor = activeBoard.value?.color || '';
  const isOwner = userBoardRole.value === 'owner';

  return (
    <div class="board-switcher" data-testid="board-switcher">
      {boardColor && (
        <span
          class="board-color-dot"
          style={`background: ${boardColor};`}
          aria-hidden="true"
          data-testid="board-color-dot"
        />
      )}
      <select
        class="board-switcher-select"
        value={activeBoardId.value}
        onChange={handleChange}
        aria-label="Select board"
      >
        {accessibleBoards.value.map((b, i) => (
          <option key={b.id} value={b.id}>
            {boardOptionLabel(b.name, b.icon, i < 9 ? `Ctrl+${i + 1}` : undefined)}
          </option>
        ))}
        <option value="__new__">+ New Board...</option>
      </select>
      {isOwner && (
        <button
          class="btn btn-ghost share-btn"
          onClick={() => { showShareModal.value = true; }}
          aria-label={`Share ${boardName}`}
          title="Share board (Ctrl+Shift+S)"
          data-testid="share-board-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      )}
    </div>
  );
}
