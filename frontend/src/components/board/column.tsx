import { Card } from './card';
import type { ItemStatus, ItemWithRow } from '../../api/types';

interface Props {
  status: ItemStatus;
  items: ItemWithRow[];
  onDrop: (itemId: string, newStatus: ItemStatus) => void;
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
}

const STATUS_COLORS: Record<ItemStatus, string> = {
  'To Do': 'var(--color-todo)',
  'In Progress': 'var(--color-inprogress)',
  'Done': 'var(--color-done)',
};

export function Column({ status, items, onDrop, onMoveStatus, compact, allDoneCount, hasArchived, archiveTriggerRef, onOpenArchive }: Props) {
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.add('column-drag-over');
  };

  const handleDragLeave = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('column-drag-over');
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('column-drag-over');
    const itemId = e.dataTransfer?.getData('text/plain');
    if (itemId) {
      onDrop(itemId, status);
    }
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
      <div class="column-header">
        <div class="column-header-row">
          <h2>{status}</h2>
          <span class="column-count">{items.length}</span>
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
        {items.map(item => (
          <Card key={item.id} item={item} onMoveStatus={onMoveStatus} />
        ))}
        {items.length === 0 && (
          <div class="column-empty">No items</div>
        )}
      </div>
    </div>
  );
}
