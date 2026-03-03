import { selectedItemId, getChildCount } from '../../state/board-store';
import { labels as labelsStore } from '../../state/board-store';
import type { ItemWithRow, ItemStatus } from '../../api/types';
import { LabelBadge } from '../shared/label-badge';

/** Ordered statuses for keyboard column navigation */
const STATUS_ORDER: ItemStatus[] = ['To Do', 'In Progress', 'Done'];

interface Props {
  item: ItemWithRow;
  onMoveStatus?: (itemId: string, newStatus: ItemStatus) => void;
}

export function Card({ item, onMoveStatus }: Props) {
  const childCount = getChildCount(item.id);
  const itemLabels = item.labels
    ? item.labels.split(',').map(l => l.trim()).filter(Boolean)
    : [];

  const isOverdue = item.due_date && item.status !== 'Done' &&
    parseLocalDate(item.due_date) < new Date(new Date().toDateString());

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', item.id);
    (e.currentTarget as HTMLElement).classList.add('card-dragging');
  };

  const handleDragEnd = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('card-dragging');
  };

  const handleClick = () => {
    selectedItemId.value = item.id;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectedItemId.value = item.id;
    }

    // Arrow keys for moving between columns
    if (onMoveStatus && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const currentIndex = STATUS_ORDER.indexOf(item.status);
      if (currentIndex === -1) return;
      const newIndex = e.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < STATUS_ORDER.length) {
        onMoveStatus(item.id, STATUS_ORDER[newIndex]);
      }
    }
  };

  return (
    <div
      class="card"
      tabIndex={0}
      role="button"
      aria-label={`${item.title}, ${item.status}. Press Enter to open details, arrow keys to move between columns.`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-item-id={item.id}
    >
      <div class="card-title">{item.title}</div>

      {item.description && (
        <div class="card-description">{item.description}</div>
      )}

      <div class="card-meta">
        {item.owner ? (
          <span class="card-owner">{item.owner}</span>
        ) : (
          <span class="card-unassigned">Unassigned</span>
        )}
        {item.scheduled_date && (
          <span class="card-scheduled">{'\u{1F4C5}'} {formatDate(item.scheduled_date)}</span>
        )}
        {item.due_date && (
          <span class={`card-due ${isOverdue ? 'card-due-overdue' : ''}`}>
            {formatDate(item.due_date)}
          </span>
        )}
      </div>

      {itemLabels.length > 0 && (
        <div class="card-labels">
          {itemLabels.map(label => (
            <LabelBadge key={label} label={label} />
          ))}
        </div>
      )}

      {childCount.total > 0 && (
        <div class="card-subtasks">
          <div
            class="subtask-bar"
            style={{ '--progress': `${(childCount.done / childCount.total) * 100}%` } as any}
          />
          <span class="subtask-text">{childCount.done}/{childCount.total}</span>
        </div>
      )}
    </div>
  );
}

function parseLocalDate(dateStr: string): Date {
  // Date-only strings (e.g. "2026-03-02") are parsed as UTC by JS,
  // which shifts the day back in western timezones. Append T00:00:00
  // so it's treated as local time instead.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  return new Date(dateStr);
}

function formatDate(dateStr: string): string {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
