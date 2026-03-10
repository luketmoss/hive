import { useRef } from 'preact/hooks';
import { selectedItemId, getChildCount } from '../../state/board-store';
import { labels as labelsStore } from '../../state/board-store';
import type { ItemWithRow, ItemStatus } from '../../api/types';
import { LabelBadge } from '../shared/label-badge';

/** Tracks the status of the card currently being dragged (same module, readable during dragover). */
export let currentDragStatus: string | null = null;

/** Ordered statuses for keyboard column navigation */
const STATUS_ORDER: ItemStatus[] = ['To Do', 'In Progress', 'Done'];

/** Hold duration (ms) before drag is armed */
const DRAG_ARM_DELAY = 200;
/** Visual feedback starts at this fraction of the arm delay */
const ARM_VISUAL_DELAY = 100;

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

  // Hold-to-drag state refs (not signals — avoid re-renders on pointer events)
  const dragArmed = useRef(false);
  const armTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualTimerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const clearTimers = () => {
    if (armTimerId.current !== null) { clearTimeout(armTimerId.current); armTimerId.current = null; }
    if (visualTimerId.current !== null) { clearTimeout(visualTimerId.current); visualTimerId.current = null; }
  };

  const handleMouseDown = (e: MouseEvent) => {
    // Only left button
    if (e.button !== 0) return;

    dragArmed.current = false;
    clearTimers();

    // At ARM_VISUAL_DELAY, show arming feedback
    visualTimerId.current = setTimeout(() => {
      cardRef.current?.classList.add('card-arming');
    }, ARM_VISUAL_DELAY);

    // At DRAG_ARM_DELAY, arm drag
    armTimerId.current = setTimeout(() => {
      dragArmed.current = true;
    }, DRAG_ARM_DELAY);
  };

  const handleMouseUp = () => {
    clearTimers();
    dragArmed.current = false;
    cardRef.current?.classList.remove('card-arming');
  };

  const handleMouseLeave = () => {
    clearTimers();
    dragArmed.current = false;
    cardRef.current?.classList.remove('card-arming');
  };

  const handleDragStart = (e: DragEvent) => {
    if (!dragArmed.current) {
      // Hold threshold not met — suppress drag, let click handler open detail
      e.preventDefault();
      return;
    }

    clearTimers();
    cardRef.current?.classList.remove('card-arming');

    e.dataTransfer?.setData('text/plain', item.id);
    e.dataTransfer?.setData('application/x-hive-status', item.status);
    currentDragStatus = item.status;

    const card = e.currentTarget as HTMLElement;
    card.classList.add('card-dragging');
  };

  const handleDragEnd = (e: DragEvent) => {
    currentDragStatus = null;
    dragArmed.current = false;
    clearTimers();
    const card = e.currentTarget as HTMLElement;
    card.classList.remove('card-dragging');
    card.classList.remove('card-arming');
  };

  const handleClick = (e: MouseEvent) => {
    selectedItemId.value = item.id;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectedItemId.value = item.id;
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
      ref={cardRef}
      class="card"
      tabIndex={0}
      role="button"
      draggable
      aria-label={`${item.title}, ${item.status}. Press Enter to open details. Alt+Up/Down to reorder within column, Left/Right arrows to move between columns.`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-item-id={item.id}
    >
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
