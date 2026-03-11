import { useState } from 'preact/hooks';
import { Card, currentDragStatus } from './card';
import type { ItemStatus, ItemWithRow } from '../../api/types';
import type { SortMode } from '../../state/board-store';
import { showToast } from '../../state/board-store';

interface Props {
  status: ItemStatus;
  items: ItemWithRow[];
  onDrop: (itemId: string, newStatus: ItemStatus, targetIndex?: number) => void;
  onReorder?: (itemId: string, newIndex: number, columnItems: ItemWithRow[]) => void;
  onMoveStatus?: (itemId: string, newStatus: ItemStatus) => void;
  compact?: boolean;
  /** Total count of all Done items (for "View all N completed" link). */
  allDoneCount?: number;
  /** Whether archived (older than 7 days) Done items exist. */
  hasArchived?: boolean;
  /** Ref callback for the archive trigger button (for focus return). */
  archiveTriggerRef?: (el: HTMLButtonElement | null) => void;
  /** Called when the user clicks "View all N completed". */
  onOpenArchive?: () => void;
  /** Current sort mode for this column (kanban view only). */
  sortMode?: SortMode;
  /** Called when the user selects a new sort mode. */
  onSortChange?: (mode: SortMode) => void;
}

const SORT_LABELS: Record<SortMode, string> = {
  custom: 'Custom',
  due_date: 'Due date',
  created: 'Created',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  'To Do': 'var(--color-todo)',
  'In Progress': 'var(--color-inprogress)',
  'Done': 'var(--color-done)',
};

export function Column({ status, items, onDrop, onReorder, onMoveStatus, compact, allDoneCount, hasArchived, archiveTriggerRef, onOpenArchive, sortMode, onSortChange }: Props) {
  // Track the insertion indicator position for within-column reorder
  const [dropIndicator, setDropIndicator] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  // AC8: aria-live announcement text
  const [sortAnnouncement, setSortAnnouncement] = useState('');

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();

    const target = (e.target as HTMLElement).closest('.card') as HTMLElement;

    if (!target) {
      // Dragging over column but not over a card — show column-level highlight
      setDropIndicator(null);
      (e.currentTarget as HTMLElement).classList.add('column-drag-over');
      return;
    }

    const targetId = target.getAttribute('data-item-id');
    const targetIndex = items.findIndex(i => i.id === targetId);
    if (targetIndex === -1) {
      (e.currentTarget as HTMLElement).classList.add('column-drag-over');
      return;
    }

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position: 'above' | 'below' = e.clientY < midY ? 'above' : 'below';

    setDropIndicator({ index: targetIndex, position });
    // Remove column-level highlight when showing card-level indicator
    (e.currentTarget as HTMLElement).classList.remove('column-drag-over');
  };

  const handleDragLeave = (e: DragEvent) => {
    // Only clear if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const column = e.currentTarget as HTMLElement;
    if (!relatedTarget || !column.contains(relatedTarget)) {
      setDropIndicator(null);
      column.classList.remove('column-drag-over');
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('column-drag-over');
    setDropIndicator(null);

    const itemId = e.dataTransfer?.getData('text/plain');
    const sourceStatus = e.dataTransfer?.getData('application/x-hive-status');
    if (!itemId) return;

    // Same-column reorder
    if (sourceStatus === status) {
      // AC5: If column is in date-sort mode, same-column drag is a no-op
      if (sortMode && sortMode !== 'custom') {
        showToast('Reorder by drag is disabled when sorted by date', 'error');
        return;
      }
      if (onReorder) {
        const target = (e.target as HTMLElement).closest('.card') as HTMLElement;
        if (target) {
          const targetId = target.getAttribute('data-item-id');
          const targetIndex = items.findIndex(i => i.id === targetId);
          if (targetIndex !== -1) {
            const rect = target.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            let newIndex = e.clientY < midY ? targetIndex : targetIndex + 1;
            // Adjust: if dragged item was before the target, account for removal
            const sourceIndex = items.findIndex(i => i.id === itemId);
            if (sourceIndex !== -1 && sourceIndex < newIndex) {
              newIndex--;
            }
            if (sourceIndex !== newIndex) {
              onReorder(itemId, newIndex, items);
            }
            // AC7: Focus restoration after within-column reorder
            restoreFocus(itemId);
            return;
          }
        }
      }
      // Dropped on empty area of same column — no-op
      return;
    }

    // Cross-column drop — compute target index from cursor position
    const target = (e.target as HTMLElement).closest('.card') as HTMLElement;
    if (target) {
      const targetId = target.getAttribute('data-item-id');
      const targetIndex = items.findIndex(i => i.id === targetId);
      if (targetIndex !== -1) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertIndex = e.clientY < midY ? targetIndex : targetIndex + 1;
        onDrop(itemId, status, insertIndex);
        // AC7: Focus restoration after cross-column drop
        restoreFocus(itemId);
        return;
      }
    }

    // AC3: Dropped on empty space or empty column — place at end (no targetIndex)
    onDrop(itemId, status);
    // AC7: Focus restoration
    restoreFocus(itemId);
  };

  /** AC7: Restore focus to the moved card's title button after DOM update */
  const restoreFocus = (itemId: string) => {
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-item-id="${itemId}"]`);
      const titleBtn = card?.querySelector('.card-title') as HTMLElement | null;
      titleBtn?.focus();
    });
  };

  const handleKeyboardReorder = (itemId: string, direction: 'up' | 'down') => {
    if (!onReorder) return;
    const currentIndex = items.findIndex(i => i.id === itemId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    onReorder(itemId, newIndex, items);
  };

  const handleSortChange = (e: Event) => {
    const mode = (e.currentTarget as HTMLSelectElement).value as SortMode;
    if (onSortChange) onSortChange(mode);
    setSortAnnouncement(`${status} column: sorted by ${SORT_LABELS[mode].toLowerCase()}`);
  };

  return (
    <div
      class={`column ${compact ? 'column-compact' : ''}`}
      role="region"
      aria-label={`${status} column, ${items.length} ${items.length === 1 ? 'item' : 'items'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ '--column-color': STATUS_COLORS[status] } as any}
    >
      {/* AC8: aria-live region for sort change announcements */}
      <div class="sr-only" aria-live="polite" aria-atomic="true">{sortAnnouncement}</div>
      <div class="column-header">
        <div class="column-header-row">
          <h2>{status}</h2>
          <span class="column-count">{items.length}</span>
          {/* AC6: Sort selector only in board view (not compact/swimlane) */}
          {!compact && status === 'Done' && (
            <select
              class="column-sort-select"
              disabled
              title="Done items are always sorted by completion date"
              aria-label="Sort Done column"
            >
              <option>Completion date</option>
            </select>
          )}
          {!compact && status !== 'Done' && sortMode !== undefined && (
            <select
              class="column-sort-select"
              value={sortMode}
              onChange={handleSortChange}
              aria-label={`Sort ${status} column`}
            >
              <option value="custom">Custom</option>
              <option value="due_date">Due date</option>
              <option value="created">Created</option>
            </select>
          )}
        </div>
        {status === 'Done' && hasArchived && onOpenArchive && (
          <button
            class="column-archive-link"
            ref={archiveTriggerRef}
            onClick={onOpenArchive}
          >
            View all {allDoneCount} completed
          </button>
        )}
      </div>
      <div class="column-cards">
        {items.map((item, index) => (
          <div key={item.id} class="card-wrapper">
            {dropIndicator && dropIndicator.index === index && dropIndicator.position === 'above' && (
              <div class="drop-indicator" />
            )}
            <Card
              item={item}
              onMoveStatus={onMoveStatus}
              onReorder={handleKeyboardReorder}
              columnItems={items}
              sortMode={sortMode}
            />
            {dropIndicator && dropIndicator.index === index && dropIndicator.position === 'below' && (
              <div class="drop-indicator" />
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div class="column-empty">No items</div>
        )}
      </div>
    </div>
  );
}
