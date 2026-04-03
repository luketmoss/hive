import { columns, boardStatuses } from '../../state/board-store';
import { Card } from './card';

export function ListView() {
  const cols = columns.value;

  return (
    <div class="list-view">
      {boardStatuses.value.map(status => {
        const items = cols[status.name] || [];
        return (
          <section key={status.id} class="list-section" data-testid={`list-section-${status.name}`}>
            <div
              class="list-section-header"
              style={{ '--section-color': status.color } as any}
            >
              <h2>{status.name}</h2>
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
