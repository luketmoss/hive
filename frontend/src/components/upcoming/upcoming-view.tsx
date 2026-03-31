import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import {
  upcomingBuckets,
  upcomingFilterSearch,
  upcomingFilterBoards,
  toggleUpcomingBoard,
  accessibleBoards,
  boards,
  items,
  selectedItemId,
  openDetailWithTitleEdit,
  getChildCount,
} from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';
import { LabelBadge } from '../shared/label-badge';
import { BoardBadge } from './board-badge';

export function UpcomingView() {
  const buckets = upcomingBuckets.value;
  const [localSearch, setLocalSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Mobile detect
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSearchInput = useCallback((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      upcomingFilterSearch.value = value;
    }, 150);
  }, []);

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    upcomingFilterSearch.value = '';
    searchRef.current?.focus();
  }, []);

  const handleSearchKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && localSearch) {
      e.preventDefault();
      clearSearch();
    }
  }, [localSearch, clearSearch]);

  const handleCardClick = useCallback((item: ItemWithRow) => {
    openDetailWithTitleEdit.value = false;
    selectedItemId.value = item.id;
  }, []);

  const selectedBoardCount = upcomingFilterBoards.value.size;
  const totalBoardCount = accessibleBoards.value.length;

  const activeFilterCount =
    (upcomingFilterSearch.value ? 1 : 0) +
    (selectedBoardCount < totalBoardCount ? 1 : 0);

  return (
    <div class="upcoming-view" data-testid="upcoming-view">
      {/* Filters */}
      <div class="upcoming-filters" data-testid="upcoming-filters">
        <button
          class="filter-toggle"
          aria-expanded={filtersExpanded}
          aria-controls="upcoming-filter-content"
          onClick={() => setFiltersExpanded(prev => !prev)}
          data-testid="upcoming-filter-toggle"
        >
          Filters
          {activeFilterCount > 0 && <span class="filter-badge">{activeFilterCount}</span>}
        </button>

        <div
          id="upcoming-filter-content"
          class={`upcoming-filter-content${isMobile && !filtersExpanded ? ' upcoming-filter-content-collapsed' : ''}`}
          data-testid="upcoming-filter-content"
        >
          {/* Search */}
          <div class="filter-search-wrapper" data-testid="upcoming-search-wrapper">
            <input
              ref={searchRef}
              type="text"
              class="filter-search-input"
              placeholder="Search cards..."
              aria-label="Search cards"
              value={localSearch}
              onInput={handleSearchInput}
              onKeyDown={handleSearchKeyDown}
              data-testid="upcoming-search-input"
            />
            {localSearch && (
              <button
                class="filter-search-clear"
                aria-label="Clear search"
                onClick={clearSearch}
                data-testid="upcoming-search-clear"
              >
                &times;
              </button>
            )}
          </div>

          {/* Board filter tiles */}
          <div
            role="group"
            aria-label="Filter by board"
            class="upcoming-board-tiles"
            data-testid="upcoming-board-tiles"
          >
            {accessibleBoards.value.map(b => {
              const active = upcomingFilterBoards.value.has(b.id);
              return (
                <button
                  key={b.id}
                  class={`upcoming-board-tile${active ? ' upcoming-board-tile-active' : ''}`}
                  aria-pressed={active ? 'true' : 'false'}
                  style={`--board-color: ${b.color || '#999'}`}
                  onClick={() => toggleUpcomingBoard(b.id)}
                  data-testid={`upcoming-board-tile-${b.id}`}
                >
                  {b.icon && <span aria-hidden="true">{b.icon}</span>}
                  {b.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Buckets */}
      {buckets.length === 0 ? (
        <div class="upcoming-empty" data-testid="upcoming-empty">
          <p>Nothing due — enjoy the quiet!</p>
        </div>
      ) : (
        <div class="upcoming-buckets" data-testid="upcoming-buckets">
          {buckets.map(bucket => (
            <div key={bucket.key} class={`upcoming-bucket upcoming-bucket-${bucket.key}`} data-testid={`upcoming-bucket-${bucket.key}`}>
              <h3 class="upcoming-bucket-header">
                {bucket.label}
                <span class="upcoming-bucket-count">{bucket.items.length}</span>
              </h3>
              <div class="upcoming-bucket-items">
                {bucket.items.map(item => (
                  <UpcomingCard key={item.id} item={item} onClick={handleCardClick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface UpcomingCardProps {
  item: ItemWithRow;
  onClick: (item: ItemWithRow) => void;
}

function UpcomingCard({ item, onClick }: UpcomingCardProps) {
  const childCount = getChildCount(item.id);
  const itemLabels = item.labels
    ? item.labels.split(',').map(l => l.trim()).filter(Boolean)
    : [];
  const board = boards.value.find(b => b.id === item.board_id);

  const isOverdue = item.due_date && item.status !== 'Done' &&
    parseLocalDate(item.due_date) < new Date(new Date().toDateString());

  return (
    <div
      class="card upcoming-card"
      onClick={() => onClick(item)}
      data-item-id={item.id}
      data-testid={`upcoming-card-${item.id}`}
    >
      <div class="card-content">
        <button
          class="card-title"
          type="button"
          tabIndex={0}
          aria-label={`${item.title}, ${item.status}. Press Enter to open details.`}
          onClick={(e) => {
            e.stopPropagation();
            openDetailWithTitleEdit.value = true;
            selectedItemId.value = item.id;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openDetailWithTitleEdit.value = true;
              selectedItemId.value = item.id;
            }
          }}
        >
          {item.title}
        </button>

        {item.description && (
          <div class="card-description">{item.description}</div>
        )}

        <div class="card-meta">
          {item.owner ? (
            <span class="card-owner">{item.owner}</span>
          ) : (
            <span class="card-unassigned">Unassigned</span>
          )}
          {item.due_date && (
            <span
              class={`card-due ${isOverdue ? 'card-due-overdue' : ''}`}
              aria-label={`Due date: ${formatDate(item.due_date)}${isOverdue ? ', overdue' : ''}`}
            >
              {'\u{23F0}'} Due: {formatDate(item.due_date)}{isOverdue ? ' (overdue)' : ''}
            </span>
          )}
        </div>

        <div class="upcoming-card-badges">
          {board && <BoardBadge board={board} />}
          {itemLabels.map(label => (
            <LabelBadge key={label} label={label} />
          ))}
        </div>

        {childCount.total > 0 && (
          <div
            class="card-subtasks"
            role="progressbar"
            aria-valuenow={childCount.done}
            aria-valuemin={0}
            aria-valuemax={childCount.total}
            aria-label="Sub-task progress"
          >
            <div
              class="subtask-bar"
              style={{ '--progress': `${(childCount.done / childCount.total) * 100}%` } as any}
            />
            <span class="subtask-text">{childCount.done}/{childCount.total}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  return new Date(dateStr);
}

function formatDate(dateStr: string): string {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
