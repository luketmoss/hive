import type { Board } from '../../api/types';
import { getContrastTextColor } from '../../utils/color';

interface Props {
  board: Board;
}

export function BoardBadge({ board }: Props) {
  const color = board.color || '#999';
  const textColor = getContrastTextColor(color);

  return (
    <span
      class="board-badge"
      style={{ backgroundColor: color, color: textColor }}
      data-testid={`board-badge-${board.id}`}
    >
      {board.icon && <span aria-hidden="true">{board.icon} </span>}
      {board.name}
    </span>
  );
}
