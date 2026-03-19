import { useState } from 'preact/hooks';
import { Card, currentDragStatus } from './card';
import type { ItemStatus, ItemWithRow } from '../../api/types';
import type { SortMode } from '../../state/board-store';
import { showToast, columnAnnouncement } from '../../state/board-store';

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
  /** Called when the user clicks the "+" header button or the "Add item" hover row. */
  onAddItem?: () => void;
  /** Kebab menu: delete an item with undo */
  onDeleteItem?: (itemId: string) => void;
}

const SORT_LABELS: Record<SortMode, string> = {
  custom: 'Custom',
  due_date: 'Due date',
  created: 'Created',
};

const SORT_OVERLAY_TEXT: Record<SortMode, string> = {
  custom: '',
  due_date: 'Will be sorted by due date',
  created: 'Will be sorted by creation date',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  'To Do': 'var(--color-todo)',
  'In Progress': 'var(--color-inprogress)',
  'Done': 'var(--color-done)',
};

export function Column({ status, items, onDrop, onReorder, onMoveStatus, compact, allDoneCount, hasArchived, archiveTriggerRef, onOpenArchive, sortMode, onSortChange, onAddItem, onDeleteItem }: Props) {
  // Track the insertion indicator position for within-column reorder
  const [dropIndicator, setDropIndicator] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  // aria-live announcement text
  const [sortAnnouncement, setSortAnnouncement] = useState('');
  // AC7/AC8: Cross-column drag overlay for date-sorted destinations
  const [showDateSortOverlay, setShowDateSortOverlay] = useState(false);

  const isDateSorted = sortMode && sortMode !== 'custom';
  // Done column is always sorted by completion date
  const isDateSortedDestination = isDateSorted || status === 'Done';

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();

    // Check if this is a cross-column drag into a date-sorted destination
    const sourceStatus = currentDragStatus;
    const isCrossColumn = sourceStatus !== null && sourceStatus !== status;

    if (isCrossColumn && isDateSortedDestination) {
      // AC7/AC8: Show overlay, suppress drop indicators
      setShowDateSortOverlay(true);
      setDropIndicator(null);
      (e.currentTarget as HTMLElement).classList.remove('column-drag-over');
      return;
    }

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
      setShowDateSortOverlay(false);
      column.classList.remove('column-drag-over');
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('column-drag-over');
    setDropIndicator(null);
    setShowDateSortOverlay(false);

    const itemId = e.dataTransfer?.getData('text/plain');
    const sourceStatus = e.dataTransfer?.getData('application/x-hive-status');
    if (!itemId) return;

    // Same-column reorder
    if (sourceStatus === status) {
      // AC1: If column is in date-sort mode, switch to custom sort
      if (isDateSorted) {
        const previousMode = sortMode!;
        // Compute new index for the dropped card
        const target = (e.target as HTMLElement).closest('.card') as HTMLElement;
        const sourceIndex = items.findIndex(i => i.id === itemId);
        let newIndex = sourceIndex;
        if (target) {
          const targetId = target.getAttribute('data-item-id');
          const targetIndex = items.findIndex(i => i.id === targetId);
          if (targetIndex !== -1) {
            const rect = target.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            newIndex = e.clientY < midY ? targetIndex : targetIndex + 1;
            if (sourceIndex !== -1 && sourceIndex < newIndex) {
              newIndex--;
            }
          }
        }
        // AC2: No-op if position unchanged
        if (sourceIndex === newIndex) return;
        // Switch to custom sort
        if (onSortChange) onSortChange('custom');
        // Perform the reorder
        if (onReorder) {
          onReorder(itemId, newIndex, items);
        }
        // Show undo toast (10s)
        showToast('Switched to custom order', 'success', {
          label: 'Undo',
          fn: () => {
            if (onSortChange) onSortChange(previousMode);
          },
        }, 10000);
        restoreFocus(itemId);
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
            // Focus restoration after within-column reorder
            restoreFocus(itemId);
            return;
          }
        }
      }
      // Dropped on empty area of same column — no-op
      return;
    }

    // AC9: Cross-column drop into date-sorted column — place at end (no targetIndex)
    if (isDateSortedDestination) {
      onDrop(itemId, status);
      restoreFocus(itemId);
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
        // Focus restoration after cross-column drop
        restoreFocus(itemId);
        return;
      }
    }

    // Dropped on empty space or empty column — place at end (no targetIndex)
    onDrop(itemId, status);
    // Focus restoration
    restoreFocus(itemId);
  };

  /** Restore focus to the moved card's title button after DOM update */
  const restoreFocus = (itemId: string) => {
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-item-id="${itemId}"]`);
      const titleBtn = card?.querySelector('.card-title') as HTMLElement | null;
      titleBtn?.focus();
    });
  };

  const handleKeyboardReorder = (itemId: string, direction: 'up' | 'down') => {
    if (!onReorder) return;
    // AC5: If date-sorted, switch to custom and perform the reorder
    if (isDateSorted) {
      const previousMode = sortMode!;
      const currentIndex = items.findIndex(i => i.id === itemId);
      if (currentIndex === -1) return;
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= items.length) return;
      // Switch to custom sort
      if (onSortChange) onSortChange('custom');
      onReorder(itemId, newIndex, items);
      // Show undo toast (10s)
      showToast('Switched to custom order', 'success', {
        label: 'Undo',
        fn: () => {
          if (onSortChange) onSortChange(previousMode);
        },
      }, 10000);
      return;
    }
    const currentIndex = items.findIndex(i => i.id === itemId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    onReorder(itemId, newIndex, items);
  };

  /** AC6: Handle cross-column keyboard move to date-sorted destination */
  const handleMoveStatus = (itemId: string, newStatus: ItemStatus) => {
    if (!onMoveStatus) return;
    onMoveStatus(itemId, newStatus);
  };

  /** Kebab menu: move item to top of column (index 0) */
  const handleMoveToTop = (itemId: string) => {
    if (!onReorder) return;
    // AC6: If date-sorted, switch to custom first
    if (isDateSorted) {
      const previousMode = sortMode!;
      if (onSortChange) onSortChange('custom');
      onReorder(itemId, 0, items);
      showToast('Switched to custom order', 'success', {
        label: 'Undo',
        fn: () => { if (onSortChange) onSortChange(previousMode); },
      }, 10000);
      return;
    }
    onReorder(itemId, 0, items);
  };

  /** Kebab menu: move item to bottom of column */
  const handleMoveToBottom = (itemId: string) => {
    if (!onReorder) return;
    // AC6: If date-sorted, switch to custom first
    if (isDateSorted) {
      const previousMode = sortMode!;
      if (onSortChange) onSortChange('custom');
      onReorder(itemId, items.length - 1, items);
      showToast('Switched to custom order', 'success', {
        label: 'Undo',
        fn: () => { if (onSortChange) onSortChange(previousMode); },
      }, 10000);
      return;
    }
    onReorder(itemId, items.length - 1, items);
  };

  const handleSortChange = (e: Event) => {
    const mode = (e.currentTarget as HTMLSelectElement).value as SortMode;
    if (onSortChange) onSortChange(mode);
    setSortAnnouncement(`${status} column: sorted by ${SORT_LABELS[mode].toLowerCase()}`);
  };

  // Determine the overlay text for date-sorted cross-column drag
  const getOverlayText = (): string => {
    if (status === 'Done') return 'Will be sorted by completion date';
    if (sortMode === 'due_date') return SORT_OVERLAY_TEXT.due_date;
    if (sortMode === 'created') return SORT_OVERLAY_TEXT.created;
    return '';
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
      {/* aria-live region for sort change and cross-column keyboard move announcements */}
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {columnAnnouncement.value?.status === status ? columnAnnouncement.value.text : sortAnnouncement}
      </div>
      <div class="column-header">
        <div class="column-header-row">
          <h2>{status}</h2>
          <span class="column-count">{items.length}</span>
          {!compact && onAddItem && (
            <button
              class="column-add-btn"
              onClick={onAddItem}
              aria-label={`Add item to ${status}`}
            >+</button>
          )}
          {/* Sort selector only in board view (not compact/swimlane) */}
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
              class={`column-sort-select${isDateSorted ? ' column-sort-active' : ''}`}
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
      <div class="column-cards" style={{ position: 'relative' }}>
        {items.map((item, index) => (
          <div key={item.id} class="card-wrapper">
            {dropIndicator && dropIndicator.index === index && dropIndicator.position === 'above' && (
              <div class="drop-indicator" />
            )}
            <Card
              item={item}
              onMoveStatus={handleMoveStatus}
              onReorder={handleKeyboardReorder}
              columnItems={items}
              onMoveToTop={onReorder ? handleMoveToTop : undefined}
              onMoveToBottom={onReorder ? handleMoveToBottom : undefined}
              onDelete={onDeleteItem}
            />
            {dropIndicator && dropIndicator.index === index && dropIndicator.position === 'below' && (
              <div class="drop-indicator" />
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div class="column-empty">No items</div>
        )}
        {/* Hover "Add item" row — only in board view, hidden during drag */}
        {!compact && onAddItem && !currentDragStatus && (
          <button
            class="column-add-row"
            onClick={onAddItem}
            tabIndex={-1}
          >
            <span class="column-add-row-icon">+</span> Add item
          </button>
        )}
        {/* AC7/AC8: Date-sort overlay for cross-column drag */}
        {showDateSortOverlay && (
          <div class="column-date-sort-overlay">
            {getOverlayText()}
          </div>
        )}
      </div>
    </div>
  );
}
