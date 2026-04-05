import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import {
  boards, activeBoardId, switchBoard, showCreateBoardModal, showShareModal,
  accessibleBoards, userBoardRole,
  viewMode, setViewMode,
  filterLabel, filterSearch, filterDue, groupBy,
  boardLabels as labelsStore, rootItems,
  activeView,
  upcomingFilterSearch, upcomingFilterBoards, toggleUpcomingBoard,
} from '../../state/board-store';

/**
 * #177: Redesigned control bar with text search, due date filter, label chips,
 * and 3-dot menu with views/grouping/settings sections.
 */
export function ControlBar() {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 3-dot overflow menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  // Close filter popup on Escape
  useEffect(() => {
    if (!filtersExpanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setFiltersExpanded(false); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [filtersExpanded]);

  // Click-outside to dismiss 3-dot menu
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

  // Escape and arrow key navigation in 3-dot menu
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
        const items = menuDropdownRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]');
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

  // Reset state on board switch
  const currentBoardId = activeBoardId.value;
  useEffect(() => {
    setFiltersExpanded(false);
    setMenuOpen(false);
    setLocalSearch('');
  }, [currentBoardId]);

  // Sync localSearch from signal (e.g. after board switch clears it)
  useEffect(() => {
    if (filterSearch.value === '' && localSearch !== '') {
      setLocalSearch('');
    }
  }, [filterSearch.value]);

  // Debounced search (board view)
  const handleSearchInput = useCallback((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      filterSearch.value = value;
    }, 150);
  }, []);

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    filterSearch.value = '';
    searchRef.current?.focus();
  }, []);

  // Escape in search input clears it
  const handleSearchKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && localSearch) {
      e.preventDefault();
      clearSearch();
    }
  }, [localSearch, clearSearch]);

  // Upcoming search state
  const [localUpcomingSearch, setLocalUpcomingSearch] = useState('');
  const upcomingSearchRef = useRef<HTMLInputElement>(null);
  const upcomingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpcomingSearchInput = useCallback((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setLocalUpcomingSearch(value);
    if (upcomingDebounceRef.current) clearTimeout(upcomingDebounceRef.current);
    upcomingDebounceRef.current = setTimeout(() => {
      upcomingFilterSearch.value = value;
    }, 150);
  }, []);

  const clearUpcomingSearch = useCallback(() => {
    setLocalUpcomingSearch('');
    upcomingFilterSearch.value = '';
    upcomingSearchRef.current?.focus();
  }, []);

  const handleUpcomingSearchKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && localUpcomingSearch) {
      e.preventDefault();
      clearUpcomingSearch();
    }
  }, [localUpcomingSearch, clearUpcomingSearch]);

  const handleBoardChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === '__new__') {
      showCreateBoardModal.value = true;
      (e.target as HTMLSelectElement).value = activeBoardId.value;
      return;
    }
    switchBoard(value);
  };

  const isOwner = userBoardRole.value === 'owner';

  // Active filter count for mobile badge
  const activeCount =
    (filterSearch.value ? 1 : 0) +
    (filterDue.value ? 1 : 0) +
    (filterLabel.value ? 1 : 0);

  // Filtered card count for live region
  const filteredCount = rootItems.value.length;

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

  const closeFilters = useCallback(() => setFiltersExpanded(false), []);

  const handleDueClick = (due: 'today' | 'this-week') => {
    filterDue.value = filterDue.value === due ? null : due;
  };

  const handleGroupClick = (mode: 'none' | 'label') => {
    groupBy.value = mode;
    setMenuOpen(false);
  };

  const isUpcoming = activeView.value === 'upcoming';

  // Upcoming view: show search + board chips only
  // Shared filter popup renderer (mobile bottom sheet)
  const renderFilterPopup = (content: any) => (
    filtersExpanded ? (
      <div class="filter-popup-backdrop" onClick={closeFilters}>
        <div
          class="filter-popup"
          role="dialog"
          aria-label="Filters"
          onClick={(e: Event) => e.stopPropagation()}
        >
          <div class="filter-popup-header">
            <span class="filter-popup-title">Filters</span>
            <button class="filter-popup-close" onClick={closeFilters} aria-label="Close filters">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="filter-popup-body">
            {content}
            <button class="btn btn-primary filter-popup-apply" onClick={closeFilters}>
              Apply
            </button>
          </div>
        </div>
      </div>
    ) : null
  );

  if (isUpcoming) {
    const upcomingActiveCount =
      (upcomingFilterSearch.value ? 1 : 0) +
      (upcomingFilterBoards.value.size < accessibleBoards.value.length ? 1 : 0);

    const upcomingFilterChips = (
      <>
        <div class="filter-search-wrapper" data-testid="upcoming-search-wrapper">
          <input
            ref={upcomingSearchRef}
            type="text"
            class="filter-search-input"
            placeholder="Search cards..."
            aria-label="Search cards"
            value={localUpcomingSearch}
            onInput={handleUpcomingSearchInput}
            onKeyDown={handleUpcomingSearchKeyDown}
            data-testid="upcoming-search-input"
          />
          {localUpcomingSearch && (
            <button
              class="filter-search-clear"
              aria-label="Clear search"
              onClick={clearUpcomingSearch}
              data-testid="upcoming-search-clear"
            >
              &times;
            </button>
          )}
        </div>

        {accessibleBoards.value.length > 1 && (
          <div role="group" aria-label="Filter by board" class="filter-chip-group" data-testid="upcoming-board-filter-group">
            <span class="filter-chip-group-label">Board:</span>
            {accessibleBoards.value.map(b => {
              const active = upcomingFilterBoards.value.has(b.id);
              return (
                <button
                  key={b.id}
                  class={`filter-chip${active ? ' filter-chip-active' : ''}`}
                  aria-pressed={active ? 'true' : 'false'}
                  onClick={() => toggleUpcomingBoard(b.id)}
                  data-testid={`upcoming-board-chip-${b.id}`}
                >
                  {b.icon && <span aria-hidden="true">{b.icon} </span>}
                  {b.name}
                </button>
              );
            })}
          </div>
        )}
      </>
    );

    return (
      <div class="control-bar" data-testid="control-bar">
        <div class="control-bar-section control-bar-filters">
          <button
            class="filter-toggle"
            aria-expanded={filtersExpanded}
            onClick={() => setFiltersExpanded(prev => !prev)}
            data-testid="upcoming-filter-toggle"
          >
            Filters
            {upcomingActiveCount > 0 && <span class="filter-badge">{upcomingActiveCount}</span>}
          </button>

          {/* Desktop: inline (always visible, toggle hidden via CSS) */}
          <div class="control-bar-filter-content control-bar-filter-desktop" data-testid="upcoming-filter-content">
            {upcomingFilterChips}
          </div>

          {/* Mobile: bottom sheet popup */}
          {renderFilterPopup(upcomingFilterChips)}
        </div>
      </div>
    );
  }

  const searchInput = (
    <div class="filter-search-wrapper" data-testid="filter-search-wrapper">
      <input
        ref={searchRef}
        type="text"
        class="filter-search-input"
        placeholder="Search cards..."
        aria-label="Search cards"
        value={localSearch}
        onInput={handleSearchInput}
        onKeyDown={handleSearchKeyDown}
        data-testid="filter-search-input"
      />
      {localSearch && (
        <button
          class="filter-search-clear"
          aria-label="Clear search"
          onClick={clearSearch}
          data-testid="filter-search-clear"
        >
          &times;
        </button>
      )}
    </div>
  );

  const boardFilterChips = (
    <>
      {/* AC4/AC5: Due date chips */}
      <div role="group" aria-label="Filter by due date" class="filter-chip-group" data-testid="filter-due-group">
        <span class="filter-chip-group-label">Due:</span>
        {(['today', 'this-week'] as const).map(due => {
          const active = filterDue.value === due;
          const label = due === 'today' ? 'Today' : 'This Week';
          return (
            <button
              key={due}
              class={`filter-chip filter-chip-due${active ? ' filter-chip-active' : ''}`}
              aria-pressed={active ? 'true' : 'false'}
              onClick={() => handleDueClick(due)}
              data-testid={`filter-due-${due}`}
            >
              {label}
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
    </>
  );

  return (
    <div class="control-bar" data-testid="control-bar">
      {/* Board selector */}
      <div class="control-bar-section">
        <span id="board-switcher-hint" class="sr-only">{BOARD_SWITCHER_HINT}</span>
        <select
          class="board-switcher-select"
          value={activeBoardId.value}
          onChange={handleBoardChange}
          aria-label="Select board"
          aria-describedby="board-switcher-hint"
          title={BOARD_SWITCHER_HINT}
          data-testid="control-bar-board-select"
        >
          {accessibleBoards.value.map((b) => (
            <option key={b.id} value={b.id}>
              {boardOptionLabel(b.name, b.icon)}
            </option>
          ))}
          <option value="__new__">+ New Board...</option>
        </select>
      </div>

      <span class="control-bar-separator" aria-hidden="true" />

      {/* Filters section */}
      <div class="control-bar-section control-bar-filters">
        {/* Mobile: search always visible in bar (hidden on desktop via CSS) */}
        <div class="control-bar-mobile-search">
          {searchInput}
        </div>

        {/* Mobile: Filters toggle */}
        <button
          class="filter-toggle"
          aria-expanded={filtersExpanded}
          onClick={() => setFiltersExpanded(prev => !prev)}
          data-testid="control-bar-filter-toggle"
        >
          Filters
          {activeCount > 0 && <span class="filter-badge">{activeCount}</span>}
        </button>

        {/* Desktop: inline chips (always visible, toggle hidden via CSS) */}
        <div class="control-bar-filter-content control-bar-filter-desktop" data-testid="control-bar-filter-content">
          {searchInput}
          {boardFilterChips}
        </div>

        {/* Mobile: full-screen filter popup */}
        {renderFilterPopup(boardFilterChips)}

        {/* AC10: Live region for screen readers */}
        <div aria-live="polite" class="sr-only" data-testid="filter-live-region">
          {(filterSearch.value || filterDue.value || filterLabel.value) ? `${filteredCount} cards shown` : ''}
        </div>
      </div>

      {/* 3-dot overflow menu */}
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
            <div class="overflow-menu-section-header" role="presentation">Views</div>
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

            <hr class="overflow-menu-divider" />

            {/* GROUPING section */}
            <div class="overflow-menu-section-header" role="presentation">Grouping</div>
            <button
              role="menuitemradio"
              class={`overflow-menu-item${groupBy.value === 'none' ? ' overflow-menu-item-checked' : ''}`}
              aria-checked={groupBy.value === 'none'}
              onClick={() => handleGroupClick('none')}
              data-testid="overflow-menu-group-none"
            >
              None
            </button>
            <button
              role="menuitemradio"
              class={`overflow-menu-item${groupBy.value === 'label' ? ' overflow-menu-item-checked' : ''}`}
              aria-checked={groupBy.value === 'label'}
              onClick={() => handleGroupClick('label')}
              data-testid="overflow-menu-group-label"
            >
              By Label
            </button>

            {/* SETTINGS section — owners only */}
            {isOwner && (
              <>
                <hr class="overflow-menu-divider" />
                <div class="overflow-menu-section-header" role="presentation">Settings</div>
                <button
                  role="menuitem"
                  class="overflow-menu-item"
                  onClick={() => { showShareModal.value = true; setMenuOpen(false); }}
                  data-testid="overflow-menu-board-settings"
                >
                  Board Settings
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const BOARD_SWITCHER_HINT = 'Ctrl+1–9 to switch boards · Press ? for all shortcuts';

function boardOptionLabel(name: string, icon?: string): string {
  const prefix = icon ? `${icon} ` : '';
  return `${prefix}${name}`;
}
