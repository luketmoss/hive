import { columns } from '../../state/board-store';
import { Card } from './card';
import type { ItemStatus } from '../../api/types';

const STATUS_ORDER: ItemStatus[] = ['To Do', 'In Progress', 'Done'];

const STATUS_COLORS: Record<ItemStatus, string> = {
  'To Do': 'var(--color-todo)',
  'In Progress': 'var(--color-inprogress)',
  'Done': 'var(--color-done)',
};

export function ListView() {
  const cols = columns.value;

  return (
    <div class="list-view">
      {STATUS_ORDER.map(status => {
        const items = cols[status];
        return (
          <section key={status} class="list-section" data-testid={`list-section-${status}`}>
            <div
              class="list-section-header"
              style={{ '--section-color': STATUS_COLORS[status] } as any}
            >
              <h2>{status}</h2>
              <span class="list-section-count">{items.length}</span>
            </div>
            <div class="list-section-cards">
              {items.map(item => (
                <Card key={item.id} item={item} />
              ))}
              {items.length === 0 && (
                <div class="list-section-empty">No items</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
