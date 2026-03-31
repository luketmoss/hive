import type { Board } from '../../api/types';

interface Props {
  board: Board;
}

export function BoardBadge({ board }: Props) {
  return (
    <span
      class="board-badge"
      data-testid={`board-badge-${board.id}`}
    >
      {board.icon && <span aria-hidden="true">{board.icon}</span>}
      {board.name}
    </span>
  );
}
