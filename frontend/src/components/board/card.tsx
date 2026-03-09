import { selectedItemId, getChildCount } from '../../state/board-store';
import { labels as labelsStore } from '../../state/board-store';
import type { ItemWithRow, ItemStatus } from '../../api/types';
import { LabelBadge } from '../shared/label-badge';

/** Tracks the status of the card currently being dragged (same module, readable during dragover). */
export let currentDragStatus: string | null = null;

/** Ordered statuses for keyboard column navigation */
const STATUS_ORDER: ItemStatus[] = ['To Do', 'In Progress', 'Done'];

interface Props {
  item: ItemWithRow;
  onMoveStatus?: (itemId: string, newStatus: ItemStatus) => void;
  onReorder?: (itemId: string, direction: 'up' | 'down') => void;
  columnItems?: ItemWithRow[];
}

export function Card({ item, onMoveStatus, onReorder, columnItems }: Props) {
  const childCount = getChildCount(item.id);
  const itemLabels = item.labels
    ? item.labels.split(',').map(l => l.trim()).filter(Boolean)
    : [];

  const isOverdue = item.due_date && item.status !== 'Done' &&
    parseLocalDate(item.due_date) < new Date(new Date().toDateString());

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', item.id);
    // Store the source column status so drop targets can detect within-column vs cross-column
    e.dataTransfer?.setData('application/x-hive-status', item.status);
    // Track source status at module level (readable during dragover, unlike dataTransfer values)
    currentDragStatus = item.status;
    // Add dragging class to the card (parent of handle)
    const card = (e.currentTarget as HTMLElement).closest('.card') as HTMLElement;
    if (card) card.classList.add('card-dragging');
  };

  const handleDragEnd = (e: DragEvent) => {
    currentDragStatus = null;
    const card = (e.currentTarget as HTMLElement).closest('.card') as HTMLElement;
    if (card) card.classList.remove('card-dragging');
  };

  const handleClick = (e: MouseEvent) => {
    // Don't open detail if clicking the drag handle
    if ((e.target as HTMLElement).closest('.drag-handle')) return;
    selectedItemId.value = item.id;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectedItemId.value = item.id;
    }

    // AC4: Alt+ArrowUp/Down for within-column reorder
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (onReorder) {
        onReorder(item.id, e.key === 'ArrowUp' ? 'up' : 'down');
      }
      return;
    }

    // Arrow keys for moving between columns (only without Alt)
    if (!e.altKey && onMoveStatus && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
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
      aria-label={`${item.title}, ${item.status}. Press Enter to open details. Alt+Up/Down to reorder within column, Left/Right arrows to move between columns.`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-item-id={item.id}
    >
      <div class="card-row">
        <span
          class="drag-handle"
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          aria-label="Drag to reorder"
          title="Drag to move"
        >
          <span class="drag-handle-dots" aria-hidden="true" />
        </span>
        <div class="card-content">
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
            {item.due_date && (
              <span
                class={`card-due ${isOverdue ? 'card-due-overdue' : ''}`}
                aria-label={`Due date: ${formatDate(item.due_date)}${isOverdue ? ', overdue' : ''}`}
              >
                {'\u{23F0}'} Due: {formatDate(item.due_date)}{isOverdue ? ' (overdue)' : ''}
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
      </div>
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
