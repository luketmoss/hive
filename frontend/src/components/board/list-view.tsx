import { columns, boardStatuses } from '../../state/board-store';
import { Card } from './card';

const COLOR_TO_CSS_VAR: Record<string, string> = {
  '#e3f2fd': 'var(--color-todo)',
  '#fff3e0': 'var(--color-inprogress)',
  '#e8f5e9': 'var(--color-done)',
  '#e8eaf6': 'var(--color-col-indigo)',
  '#f3e5f5': 'var(--color-col-purple)',
  '#fce4ec': 'var(--color-col-pink)',
  '#e0f2f1': 'var(--color-col-teal)',
  '#fff8e1': 'var(--color-col-amber)',
};

function resolveColumnColor(color?: string): string {
  if (!color) return 'var(--color-bg)';
  return COLOR_TO_CSS_VAR[color] || color;
}

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
              style={{ '--section-color': resolveColumnColor(status.color) } as any}
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
