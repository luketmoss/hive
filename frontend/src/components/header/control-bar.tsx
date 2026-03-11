import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import {
  boards, activeBoardId, switchBoard, showCreateBoardModal, showShareModal,
  accessibleBoards, activeBoard, userBoardRole,
  viewMode, setViewMode,
  filterOwner, filterLabel, groupBy, owners, labels as labelsStore,
} from '../../state/board-store';

/**
 * AC2: Unified control bar merges board selector, share, view toggle, and filters.
 * AC3: Filter chip overflow handling.
 * AC5: Mobile layout adaptations.
 */
export function ControlBar() {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const chipContainerRef = useRef<HTMLDivElement>(null);
  const [overflowCount, setOverflowCount] = useState(0);

  // Detect if we're on mobile (for omitting keyboard shortcuts from select labels)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Build active filter chip data
  const activeChips = getActiveChips();

  // AC3: Measure chip overflow
  useEffect(() => {
    if (chipsExpanded || !chipContainerRef.current) {
      setOverflowCount(0);
      return;
    }
    const container = chipContainerRef.current;
    const chips = container.querySelectorAll<HTMLElement>('.control-bar-chip');
    if (chips.length === 0) {
      setOverflowCount(0);
      return;
    }
    const containerRight = container.getBoundingClientRect().right;
    let hidden = 0;
    chips.forEach(chip => {
      if (chip.getBoundingClientRect().right > containerRight) {
        hidden++;
      }
    });
    setOverflowCount(hidden);
  }, [activeChips.length, chipsExpanded]);

  // Reset expanded state on board switch
  const currentBoardId = activeBoardId.value;
  useEffect(() => {
    setChipsExpanded(false);
    setFiltersExpanded(false);
  }, [currentBoardId]);

  const handleBoardChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === '__new__') {
      showCreateBoardModal.value = true;
      (e.target as HTMLSelectElement).value = activeBoardId.value;
      return;
    }
    switchBoard(value);
  };

  const boardName = activeBoard.value?.name || 'board';
  const boardColor = activeBoard.value?.color || '';
  const isOwner = userBoardRole.value === 'owner';

  const hasFilters = filterOwner.value || filterLabel.value;
  const hasGrouping = groupBy.value !== 'none';
  const showReset = hasFilters || hasGrouping;

  const activeCount =
    (filterOwner.value ? 1 : 0) +
    (filterLabel.value ? 1 : 0) +
    (hasGrouping ? 1 : 0);

  // Empty boards: show new board button only
  if (boards.value.length === 0) {
    return (
      <div class="control-bar" data-testid="control-bar">
        <button
          class="btn btn-primary"
          onClick={() => { showCreateBoardModal.value = true; }}
        >
          + New Board
        </button>
      </div>
    );
  }

  return (
    <div class="control-bar" data-testid="control-bar">
      {/* Board selector section */}
      <div class="control-bar-section">
        {boardColor && (
          <span
            class="board-color-dot"
            style={`background: ${boardColor};`}
            aria-hidden="true"
            data-testid="board-color-dot"
          />
        )}
        <select
          class="board-switcher-select"
          value={activeBoardId.value}
          onChange={handleBoardChange}
          aria-label="Select board"
          data-testid="control-bar-board-select"
        >
          {accessibleBoards.value.map((b, i) => (
            <option key={b.id} value={b.id}>
              {boardOptionLabel(b.name, b.icon, !isMobile && i < 9 ? `Ctrl+${i + 1}` : undefined)}
            </option>
          ))}
          <option value="__new__">+ New Board...</option>
        </select>
        {isOwner && (
          <button
            class="btn btn-ghost share-btn"
            onClick={() => { showShareModal.value = true; }}
            aria-label={`Board settings for ${boardName}`}
            title="Board settings (Ctrl+Shift+S)"
            data-testid="share-board-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>

      {/* Separator */}
      <span class="control-bar-separator" aria-hidden="true" />

      {/* View toggle — always visible */}
      <div class="control-bar-section" data-testid="control-bar-view-toggle">
        <button
          class={`view-toggle-btn${viewMode.value === 'board' ? ' view-toggle-active' : ''}`}
          onClick={() => setViewMode('board')}
          aria-pressed={viewMode.value === 'board'}
          data-testid="view-toggle-board"
        >
          Board
        </button>
        <button
          class={`view-toggle-btn${viewMode.value === 'list' ? ' view-toggle-active' : ''}`}
          onClick={() => setViewMode('list')}
          aria-pressed={viewMode.value === 'list'}
          data-testid="view-toggle-list"
        >
          List
        </button>
      </div>

      {/* Separator */}
      <span class="control-bar-separator" aria-hidden="true" />

      {/* Filters section */}
      <div class="control-bar-section control-bar-filters">
        <button
          class="filter-toggle"
          aria-expanded={filtersExpanded}
          aria-controls="control-bar-filter-content"
          onClick={() => setFiltersExpanded(prev => !prev)}
          data-testid="control-bar-filter-toggle"
        >
          Filters
          {activeCount > 0 && <span class="filter-badge">{activeCount}</span>}
        </button>

        {/* Desktop inline filter chips */}
        <div
          id="control-bar-filter-content"
          class={`control-bar-filter-content${filtersExpanded ? '' : ' control-bar-filter-content-collapsed'}`}
          data-testid="control-bar-filter-content"
        >
          {/* Owner chips */}
          <div role="group" aria-label="Filter by owner" class="filter-chip-group">
            <span class="filter-chip-group-label">Owner:</span>
            {owners.value.map(o => {
              const active = filterOwner.value === o.name;
              return (
                <button
                  key={o.name}
                  class={`filter-chip filter-chip-owner${active ? ' filter-chip-active' : ''}`}
                  aria-pressed={active ? 'true' : 'false'}
                  onClick={() => { filterOwner.value = active ? null : o.name; }}
                >
                  {o.name}
                </button>
              );
            })}
          </div>

          {/* Label chips */}
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
                  onClick={() => { filterLabel.value = active ? null : l.label; }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>

          {/* Group-by chips */}
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
                  onClick={() => { groupBy.value = active ? 'none' : mode; }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {showReset && (
            <button
              class="btn btn-ghost btn-sm"
              onClick={() => {
                filterOwner.value = null;
                filterLabel.value = null;
                groupBy.value = 'none';
              }}
              data-testid="control-bar-reset"
            >
              Reset all
            </button>
          )}
        </div>

        {/* AC3: Active filter chips inline (desktop) */}
        {activeChips.length > 0 && (
          <div
            class={`control-bar-active-chips${chipsExpanded ? ' control-bar-active-chips-expanded' : ''}`}
            ref={chipContainerRef}
            data-testid="control-bar-active-chips"
          >
            {activeChips.map(chip => (
              <span key={chip.key} class="control-bar-chip" data-testid="control-bar-chip">
                {chip.label}
                <button
                  class="control-bar-chip-remove"
                  aria-label={`Remove ${chip.label} filter`}
                  onClick={chip.onRemove}
                >
                  &times;
                </button>
              </span>
            ))}
            {overflowCount > 0 && !chipsExpanded && (
              <button
                class="control-bar-chip-more"
                aria-label={`Show ${overflowCount} more active filters`}
                onClick={() => setChipsExpanded(true)}
                data-testid="control-bar-chip-more"
              >
                +{overflowCount} more
              </button>
            )}
            {chipsExpanded && (
              <button
                class="control-bar-chip-more"
                onClick={() => setChipsExpanded(false)}
                data-testid="control-bar-chip-less"
              >
                Show less
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function boardOptionLabel(name: string, icon?: string, shortcut?: string): string {
  const prefix = icon ? `${icon} ` : '';
  return shortcut ? `${prefix}${name} (${shortcut})` : `${prefix}${name}`;
}

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

function getActiveChips(): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filterOwner.value) {
    chips.push({
      key: `owner-${filterOwner.value}`,
      label: `Owner: ${filterOwner.value}`,
      onRemove: () => { filterOwner.value = null; },
    });
  }
  if (filterLabel.value) {
    chips.push({
      key: `label-${filterLabel.value}`,
      label: `Label: ${filterLabel.value}`,
      onRemove: () => { filterLabel.value = null; },
    });
  }
  if (groupBy.value !== 'none') {
    const label = groupBy.value === 'owner' ? 'Owner' : 'Label';
    chips.push({
      key: `group-${groupBy.value}`,
      label: `Group: ${label}`,
      onRemove: () => { groupBy.value = 'none'; },
    });
  }
  return chips;
}
