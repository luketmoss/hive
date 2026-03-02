import { selectedItemId, getChildCount } from '../../state/board-store';
import { labels as labelsStore } from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';
import { LabelBadge } from '../shared/label-badge';

interface Props {
  item: ItemWithRow;
}

export function Card({ item }: Props) {
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

  return (
    <div
      class="card"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      <div class="card-title">{item.title}</div>

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
