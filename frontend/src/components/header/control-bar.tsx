import { useState, useEffect, useRef } from 'preact/hooks';
import {
  boards, activeBoardId, switchBoard, showCreateBoardModal, showShareModal,
  accessibleBoards, activeBoard, userBoardRole,
  viewMode, setViewMode,
  filterOwner, filterLabel, groupBy, owners, labels as labelsStore,
} from '../../state/board-store';

/**
 * AC1/AC2: Desktop — filter chips always visible inline, no Filters toggle.
 * AC3: Mobile — Filters toggle button, chips hidden until tapped.
 * AC4–AC9: 3-dot overflow menu with view toggle + Board Settings (owner only).
 * AC10: Active filter chips and Reset all always visible on desktop.
 */
export function ControlBar() {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const chipContainerRef = useRef<HTMLDivElement>(null);
  const [overflowCount, setOverflowCount] = useState(0);

  // 3-dot overflow menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  // Detect if we're on mobile (for filter toggle visibility and label omission)
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // AC9: Click-outside to dismiss 3-dot menu
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuDropdownRef.current && !menuDropdownRef.current.contains(e.target as Node) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // AC8: Escape and arrow key navigation in 3-dot menu
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = menuDropdownRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        if (!items || items.length === 0) return;
        const focused = document.activeElement as HTMLElement;
        const idx = Array.from(items).indexOf(focused);
        if (e.key === 'ArrowDown') {
          items[(idx + 1) % items.length].focus();
        } else {
          items[(idx - 1 + items.length) % items.length].focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

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
    setMenuOpen(false);
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

  // AC3: Filter content collapsed only on mobile when toggle not expanded
  const filterContentClass = `control-bar-filter-content${isMobile && !filtersExpanded ? ' control-bar-filter-content-collapsed' : ''}`;

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
      </div>

      {/* Separator */}
      <span class="control-bar-separator" aria-hidden="true" />

      {/* Filters section */}
      <div class="control-bar-section control-bar-filters">
        {/* AC3: Filters toggle button — only visible on mobile */}
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

        {/* AC1/AC2: Filter chips inline — always visible on desktop, toggleable on mobile */}
        <div
          id="control-bar-filter-content"
          class={filterContentClass}
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

          {/* AC10: Reset all always visible on desktop when filters active */}
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

        {/* Active filter chips inline */}
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

      {/* AC4: 3-dot overflow menu */}
      <div class="control-bar-overflow" data-testid="control-bar-overflow">
        <button
          ref={menuBtnRef}
          class="btn btn-ghost overflow-menu-btn"
          aria-label="More options"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          onClick={() => setMenuOpen(prev => !prev)}
          data-testid="overflow-menu-btn"
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            ref={menuDropdownRef}
            role="menu"
            class="overflow-menu-dropdown"
            data-testid="overflow-menu-dropdown"
          >
            {/* AC4/AC5: View toggle items */}
            <button
              role="menuitem"
              class={`overflow-menu-item${viewMode.value === 'board' ? ' overflow-menu-item-checked' : ''}`}
              aria-checked={viewMode.value === 'board'}
              onClick={() => { setViewMode('board'); setMenuOpen(false); }}
              data-testid="overflow-menu-view-board"
            >
              Board view
            </button>
            <button
              role="menuitem"
              class={`overflow-menu-item${viewMode.value === 'list' ? ' overflow-menu-item-checked' : ''}`}
              aria-checked={viewMode.value === 'list'}
              onClick={() => { setViewMode('list'); setMenuOpen(false); }}
              data-testid="overflow-menu-view-list"
            >
              List view
            </button>
            {/* AC6/AC7: Board Settings — owners only */}
            {isOwner && (
              <button
                role="menuitem"
                class="overflow-menu-item"
                onClick={() => { showShareModal.value = true; setMenuOpen(false); }}
                data-testid="overflow-menu-board-settings"
              >
                Board Settings
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
