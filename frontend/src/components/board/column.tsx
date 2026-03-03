import { Card } from './card';
import type { ItemStatus, ItemWithRow } from '../../api/types';

interface Props {
  status: ItemStatus;
  items: ItemWithRow[];
  onDrop: (itemId: string, newStatus: ItemStatus) => void;
  onMoveStatus?: (itemId: string, newStatus: ItemStatus) => void;
  compact?: boolean;
}

const STATUS_COLORS: Record<ItemStatus, string> = {
  'To Do': 'var(--color-todo)',
  'In Progress': 'var(--color-inprogress)',
  'Done': 'var(--color-done)',
};

export function Column({ status, items, onDrop, onMoveStatus, compact }: Props) {
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
        <h2>{status}</h2>
        <span class="column-count">{items.length}</span>
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
