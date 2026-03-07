import { filterOwner, filterLabel, groupBy, owners, labels as labelsStore } from '../../state/board-store';

export function FilterBar() {
  const hasFilters = filterOwner.value || filterLabel.value;
  const hasGrouping = groupBy.value !== 'none';
  const showReset = hasFilters || hasGrouping;

  return (
    <div class="filter-bar">
      <div class="filter-group">
        {/* #28 AC1, AC9: Owner chips in a labeled group */}
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

        {/* #28 AC2, AC9: Label chips in a labeled group */}
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

        {/* #77 AC1–AC5: Group-by chip toggles */}
        <div role="group" aria-label="Group by" class="filter-chip-group filter-chip-group-separator">
          <span class="filter-chip-group-label">Group:</span>
          {(['owner', 'label'] as const).map(mode => {
            const active = groupBy.value === mode;
            const label = mode === 'owner' ? 'Owner' : 'Label';
            return (
              <button
                key={mode}
                class={`filter-chip filter-chip-group-by${active ? ' filter-chip-active' : ''}`}
                aria-pressed={active ? 'true' : 'false'}
                onClick={() => {
                  groupBy.value = active ? 'none' : mode;
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* #77 AC9: Reset button — clears filters and grouping */}
        {showReset && (
          <button
            class="btn btn-ghost btn-sm"
            onClick={() => {
              filterOwner.value = null;
              filterLabel.value = null;
              groupBy.value = 'none';
            }}
          >
            {hasGrouping ? 'Reset all' : 'Clear filters'}
          </button>
        )}
      </div>
    </div>
  );
}
