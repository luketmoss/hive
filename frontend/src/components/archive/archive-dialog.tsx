import { useState, useCallback } from 'preact/hooks';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { allDoneItemsSorted, showArchiveDialog, selectedItemId } from '../../state/board-store';
import { LabelBadge } from '../shared/label-badge';
import type { ItemWithRow } from '../../api/types';

interface ArchiveDialogProps {
  onClose: () => void;
}

export function ArchiveDialog({ onClose }: ArchiveDialogProps) {
  const [search, setSearch] = useState('');

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const trapRef = useFocusTrap(handleClose);

  const allItems = allDoneItemsSorted.value;
  const filtered = search.trim()
    ? allItems.filter(i => i.title.toLowerCase().includes(search.trim().toLowerCase()))
    : allItems;

  const handleOverlayClick = (e: Event) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      handleClose();
    }
  };

  const handleItemClick = (item: ItemWithRow) => {
    selectedItemId.value = item.id;
  };

  const handleSearchInput = (e: Event) => {
    setSearch((e.target as HTMLInputElement).value);
  };

  const clearSearch = () => {
    setSearch('');
  };

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div
        class="modal archive-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Completed items archive"
        ref={trapRef}
      >
        <div class="modal-header">
          <h2>Completed Items</h2>
          <button
            class="btn btn-ghost"
            onClick={handleClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div class="archive-search-container">
          <div class="archive-search-field">
            <input
              type="text"
              value={search}
              onInput={handleSearchInput}
              placeholder="Search completed items…"
              aria-label="Search completed items"
              class="archive-search-input"
              data-autofocus
            />
            {search && (
              <button
                class="archive-search-clear"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <div class="archive-results-count" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </div>
        </div>

        <div class="archive-list">
          {filtered.length === 0 ? (
            <div class="archive-empty">
              {search.trim() ? 'No matching items' : 'No completed items'}
            </div>
          ) : (
            filtered.map(item => (
              <ArchiveItem key={item.id} item={item} onClick={handleItemClick} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ArchiveItemProps {
  item: ItemWithRow;
  onClick: (item: ItemWithRow) => void;
}

function ArchiveItem({ item, onClick }: ArchiveItemProps) {
  const itemLabels = item.labels
    ? item.labels.split(',').map(l => l.trim()).filter(Boolean)
    : [];

  return (
    <button
      class="archive-item"
      onClick={() => onClick(item)}
      aria-label={`${item.title}, completed ${formatRelativeDate(item.completed_at)}. Click to open details.`}
    >
      <div class="archive-item-content">
        <div class="archive-item-title">{item.title}</div>
        <div class="archive-item-meta">
          {item.owner && <span class="archive-item-owner">{item.owner}</span>}
          <span class="archive-item-date">
            {formatRelativeDate(item.completed_at)}
          </span>
        </div>
        {itemLabels.length > 0 && (
          <div class="archive-item-labels">
            {itemLabels.map(label => (
              <LabelBadge key={label} label={label} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return 'Unknown date';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return 'Completed today';
    if (diffDays === 1) return 'Completed yesterday';
    if (diffDays < 30) return `Completed ${diffDays} days ago`;

    return `Completed ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } catch {
    return 'Unknown date';
  }
}
