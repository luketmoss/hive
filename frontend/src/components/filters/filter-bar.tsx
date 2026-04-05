import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { filterOwner, filterLabel, groupBy, owners, labels as labelsStore } from '../../state/board-store';

export function FilterBar() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const hasFilters = filterOwner.value || filterLabel.value;
  const hasGrouping = groupBy.value !== 'none';
  const showReset = hasFilters || hasGrouping;

  // #88 AC3: Count active filters for badge
  const activeCount =
    (filterOwner.value ? 1 : 0) +
    (filterLabel.value ? 1 : 0) +
    (hasGrouping ? 1 : 0);

  const chipContent = (
    <>
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
        {(['status', 'label'] as const).map(mode => {
          const active = groupBy.value === mode;
          const label = mode === 'status' ? 'Status' : 'Label';
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
    </>
  );

  return (
    <div class="filter-bar">
      {/* Mobile toggle — hidden on desktop via CSS */}
      <button
        class="filter-toggle"
        aria-expanded={open}
        aria-controls="filter-content"
        onClick={() => setOpen(o => !o)}
      >
        Filters
        {activeCount > 0 && <span class="filter-badge">{activeCount}</span>}
      </button>

      {/* Desktop: inline chips (always visible, toggle hidden) */}
      <div id="filter-content" class="filter-group filter-group-desktop">
        {chipContent}
      </div>

      {/* Mobile: popup with backdrop */}
      {open && (
        <div class="filter-popup-backdrop" onClick={close}>
          <div
            ref={panelRef}
            class="filter-popup"
            role="dialog"
            aria-label="Filters"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="filter-popup-header">
              <span class="filter-popup-title">Filters</span>
              <button class="filter-popup-close" onClick={close} aria-label="Close filters">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>
            </div>
            <div class="filter-popup-body">
              {chipContent}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
