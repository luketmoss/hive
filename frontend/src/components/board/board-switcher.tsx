import { boards, activeBoardId, switchBoard, showCreateBoardModal } from '../../state/board-store';

export function BoardSwitcher() {
  const currentBoard = boards.value.find(b => b.id === activeBoardId.value);

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

  return (
    <div class="board-switcher" data-testid="board-switcher">
      <select
        class="board-switcher-select"
        value={activeBoardId.value}
        onChange={handleChange}
        aria-label="Select board"
      >
        {boards.value.map(b => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
        <option value="__new__">+ New Board...</option>
      </select>
    </div>
  );
}
