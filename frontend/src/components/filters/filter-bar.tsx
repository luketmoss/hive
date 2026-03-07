import { filterOwner, filterLabel, groupBy, owners, labels as labelsStore } from '../../state/board-store';

export function FilterBar() {
  const hasFilters = filterOwner.value || filterLabel.value;

  return (
    <div class="filter-bar">
      <div class="filter-group">
        {/* AC1, AC9: Owner chips in a labeled group */}
        <div role="group" aria-label="Filter by owner" class="filter-chip-group">
          <span class="filter-chip-group-label">Owner:</span>
          {owners.value.map(o => {
            const active = filterOwner.value === o.name;
            return (
              <button
                key={o.name}
                class={`filter-chip filter-chip-owner${active ? ' filter-chip-active' : ''}`}
                aria-pressed={active ? 'true' : 'false'}
                onClick={() => {
                  filterOwner.value = active ? null : o.name;
                }}
              >
                {o.name}
              </button>
            );
          })}
        </div>

        {/* AC2, AC9: Label chips in a labeled group */}
        <div role="group" aria-label="Filter by label" class="filter-chip-group">
          <span class="filter-chip-group-label">Label:</span>
          {labelsStore.value.map(l => {
            const active = filterLabel.value === l.label;
            return (
              <button
                key={l.label}
                class={`filter-chip filter-chip-label${active ? ' filter-chip-active' : ''}`}
                aria-pressed={active ? 'true' : 'false'}
                style={`--label-color: ${l.color}`}
                onClick={() => {
                  filterLabel.value = active ? null : l.label;
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>

        {/* AC6: Group-by remains a select */}
        <select
          aria-label="Group items by"
          value={groupBy.value}
          onChange={(e) => {
            groupBy.value = (e.target as HTMLSelectElement).value as any;
          }}
        >
          <option value="none">No grouping</option>
          <option value="owner">Group by owner</option>
          <option value="label">Group by label</option>
        </select>

        {/* AC4, AC5: Clear filters button */}
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
