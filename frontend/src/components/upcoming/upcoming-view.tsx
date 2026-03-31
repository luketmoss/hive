import { useCallback } from 'preact/hooks';
import {
  upcomingBuckets,
  boards,
  selectedItemId,
  openDetailWithTitleEdit,
  getChildCount,
} from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';
import { LabelBadge } from '../shared/label-badge';
import { BoardBadge } from './board-badge';

export function UpcomingView() {
  const buckets = upcomingBuckets.value;

  const handleCardClick = useCallback((item: ItemWithRow) => {
    openDetailWithTitleEdit.value = false;
    selectedItemId.value = item.id;
  }, []);

  if (buckets.length === 0) {
    return (
      <div class="upcoming-view" data-testid="upcoming-view">
        <div class="upcoming-empty" data-testid="upcoming-empty">
          <p>Nothing due — enjoy the quiet!</p>
        </div>
      </div>
    );
  }

  return (
    <div class="upcoming-view" data-testid="upcoming-view">
      <div class="board-columns" data-testid="upcoming-buckets">
        {buckets.map(bucket => (
          <div
            key={bucket.key}
            class={`column upcoming-bucket-${bucket.key}`}
            data-testid={`upcoming-bucket-${bucket.key}`}
          >
            <div class="column-header">
              <div class="column-header-row">
                <span class="column-title">{bucket.label}</span>
                <span class="column-count" aria-label={`${bucket.items.length} items`}>
                  {bucket.items.length}
                </span>
              </div>
            </div>
            <div class="column-cards">
              {bucket.items.map(item => (
                <UpcomingCard key={item.id} item={item} onClick={handleCardClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
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
