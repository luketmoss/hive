import { selectedItemId, getChildCount, openDetailWithTitleEdit, boardStatuses, isTerminalStatus } from '../../state/board-store';
import { labels as labelsStore } from '../../state/board-store';
import type { ItemWithRow, ItemStatus } from '../../api/types';
import { LabelBadge } from '../shared/label-badge';
import { KebabMenu } from './kebab-menu';
import type { KebabAction } from './kebab-menu';

/** Tracks the status of the card currently being dragged (same module, readable during dragover). */
export let currentDragStatus: string | null = null;

interface Props {
  item: ItemWithRow;
  onMoveStatus?: (itemId: string, newStatus: ItemStatus) => void;
  onReorder?: (itemId: string, direction: 'up' | 'down') => void;
  columnItems?: ItemWithRow[];
  /** Kebab menu: move to top of column */
  onMoveToTop?: (itemId: string) => void;
  /** Kebab menu: move to bottom of column */
  onMoveToBottom?: (itemId: string) => void;
  /** Kebab menu: delete item */
  onDelete?: (itemId: string) => void;
}

export function Card({ item, onMoveStatus, onReorder, columnItems, onMoveToTop, onMoveToBottom, onDelete }: Props) {
  const childCount = getChildCount(item.id);
  const itemLabels = item.labels
    ? item.labels.split(',').map(l => l.trim()).filter(Boolean)
    : [];

  const isOverdue = item.due_date && !isTerminalStatus(item.status) &&
    parseLocalDate(item.due_date) < new Date(new Date().toDateString());

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', item.id);
    e.dataTransfer?.setData('application/x-hive-status', item.status);
    currentDragStatus = item.status;

    const card = e.currentTarget as HTMLElement;
    card.classList.add('card-dragging');
  };

  const handleDragEnd = (e: DragEvent) => {
    currentDragStatus = null;
    const card = e.currentTarget as HTMLElement;
    card.classList.remove('card-dragging');
  };

  /** Click on the card body (non-title) opens detail without edit mode */
  const handleCardClick = (e: MouseEvent) => {
    // If the click originated from the title button, let its own handler deal with it
    if ((e.target as HTMLElement).closest('.card-title')) return;
    openDetailWithTitleEdit.value = false;
    selectedItemId.value = item.id;
  };

  /** Click on the title button opens detail (edit title from inside the panel) */
  const handleTitleClick = (e: MouseEvent) => {
    e.stopPropagation();
    openDetailWithTitleEdit.value = false;
    selectedItemId.value = item.id;
  };

  /** Keyboard handler on the title button — the sole tab stop per card */
  const handleTitleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetailWithTitleEdit.value = false;
      selectedItemId.value = item.id;
      return;
    }

    // Alt+ArrowUp/Down for within-column reorder
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
      const statusOrder = boardStatuses.value.map(s => s.name);
      const currentIndex = statusOrder.indexOf(item.status);
      if (currentIndex === -1) return;
      const newIndex = e.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < statusOrder.length) {
        onMoveStatus(item.id, statusOrder[newIndex]);
      }
    }
  };

  // Build kebab menu actions
  const isFirstInColumn = columnItems ? columnItems[0]?.id === item.id : false;
  const isLastInColumn = columnItems ? columnItems[columnItems.length - 1]?.id === item.id : false;

  const kebabActions: KebabAction[] = [];
  if (onMoveToTop) {
    kebabActions.push({
      label: 'Move to top',
      disabled: isFirstInColumn,
      onAction: () => onMoveToTop(item.id),
    });
  }
  if (onMoveToBottom) {
    kebabActions.push({
      label: 'Move to bottom',
      disabled: isLastInColumn,
      onAction: () => onMoveToBottom(item.id),
    });
  }
  if (onDelete) {
    kebabActions.push({
      label: 'Delete',
      danger: true,
      onAction: () => onDelete(item.id),
    });
  }

  return (
    <div
      class="card"
      draggable
      onClick={handleCardClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-item-id={item.id}
    >
      <div class="card-content">
        {kebabActions.length > 0 && (
          <KebabMenu actions={kebabActions} itemTitle={item.title} />
        )}
        <button
          class="card-title"
          type="button"
          tabIndex={0}
          aria-label={`${item.title}, ${item.status}. Press Enter to view details. Arrow keys to move between columns, Alt+Up/Down to reorder.`}
          onClick={handleTitleClick}
          onKeyDown={handleTitleKeyDown}
        >
          {item.title}
        </button>

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
          <div
            class="card-subtasks"
            role="progressbar"
            aria-valuenow={childCount.done}
            aria-valuemin={0}
            aria-valuemax={childCount.total}
            aria-label="Sub-task progress"
          >
            <div
              class="subtask-bar"
              style={{ '--progress': `${(childCount.done / childCount.total) * 100}%` } as any}
            />
            <span class="subtask-text">{childCount.done}/{childCount.total}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function parseLocalDate(dateStr: string): Date {
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
