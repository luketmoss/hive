import { filterOwner, filterLabel, groupBy, owners, labels as labelsStore } from '../../state/board-store';

export function FilterBar() {
  const hasFilters = filterOwner.value || filterLabel.value;

  return (
    <div class="filter-bar">
      <div class="filter-group">
        <select
          value={filterOwner.value || ''}
          onChange={(e) => {
            filterOwner.value = (e.target as HTMLSelectElement).value || null;
          }}
        >
          <option value="">All owners</option>
          {owners.value.map(o => (
            <option key={o.name} value={o.name}>{o.name}</option>
          ))}
        </select>

        <select
          value={filterLabel.value || ''}
          onChange={(e) => {
            filterLabel.value = (e.target as HTMLSelectElement).value || null;
          }}
        >
          <option value="">All labels</option>
          {labelsStore.value.map(l => (
            <option key={l.label} value={l.label}>{l.label}</option>
          ))}
        </select>

        <select
          value={groupBy.value}
          onChange={(e) => {
            groupBy.value = (e.target as HTMLSelectElement).value as any;
          }}
        >
          <option value="none">No grouping</option>
          <option value="owner">Group by owner</option>
          <option value="label">Group by label</option>
        </select>

        {hasFilters && (
          <button
            class="btn btn-ghost btn-sm"
            onClick={() => {
              filterOwner.value = null;
              filterLabel.value = null;
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
