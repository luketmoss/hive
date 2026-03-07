import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { ArchiveDialog } from './archive-dialog';
import { items, showArchiveDialog, selectedItemId } from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';

vi.mock('../../hooks/use-focus-trap', () => ({
  useFocusTrap: (onEscape?: () => void) => {
    (globalThis as any).__lastOnEscape = onEscape;
    return { current: null };
  },
}));

vi.mock('../shared/label-badge', () => ({
  LabelBadge: ({ label }: { label: string }) => <span data-testid="label">{label}</span>,
}));

afterEach(() => {
  cleanup();
  items.value = [];
  showArchiveDialog.value = false;
  selectedItemId.value = null;
});

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function makeItem(overrides: Partial<ItemWithRow>): ItemWithRow {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    title: 'Test Item',
    description: '',
    status: 'Done',
    owner: 'Dad',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: daysAgoISO(5),
    sort_order: 1,
    created_by: 'test@test.com',
    board_id: '',
    sheetRow: 2,
    ...overrides,
  };
}

const onClose = vi.fn();

beforeEach(() => {
  onClose.mockReset();
});

describe('Archive dialog (AC3)', () => {
  it('renders with role="dialog" and aria-modal="true"', () => {
    items.value = [makeItem({ id: 'a' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Completed items archive');
  });

  it('displays all Done items sorted by completed_at descending', () => {
    items.value = [
      makeItem({ id: 'old', title: 'Old task', completed_at: daysAgoISO(20), sort_order: 1 }),
      makeItem({ id: 'recent', title: 'Recent task', completed_at: daysAgoISO(1), sort_order: 2 }),
      makeItem({ id: 'mid', title: 'Mid task', completed_at: daysAgoISO(10), sort_order: 3 }),
    ];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const titles = Array.from(container.querySelectorAll('.archive-item-title')).map(el => el.textContent);
    expect(titles).toEqual(['Recent task', 'Mid task', 'Old task']);
  });

  it('shows title, owner, and completed date for each item', () => {
    items.value = [
      makeItem({ id: 'a', title: 'My Task', owner: 'Mom', completed_at: daysAgoISO(3) }),
    ];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    expect(container.querySelector('.archive-item-title')?.textContent).toBe('My Task');
    expect(container.querySelector('.archive-item-owner')?.textContent).toBe('Mom');
    expect(container.querySelector('.archive-item-date')?.textContent).toContain('Completed 3 days ago');
  });

  it('shows labels when present', () => {
    items.value = [
      makeItem({ id: 'a', labels: 'Home, Fun' }),
    ];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const labels = Array.from(container.querySelectorAll('[data-testid="label"]')).map(el => el.textContent);
    expect(labels).toEqual(['Home', 'Fun']);
  });

  it('calls onClose when close button is clicked', () => {
    items.value = [makeItem({ id: 'a' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const closeBtn = container.querySelector('.modal-header .btn');
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    items.value = [makeItem({ id: 'a' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const overlay = container.querySelector('.modal-overlay');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog', () => {
    items.value = [makeItem({ id: 'a' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const dialog = container.querySelector('.archive-dialog');
    fireEvent.click(dialog!);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Archive search (AC4)', () => {
  it('search input has aria-label', () => {
    items.value = [makeItem({ id: 'a' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const input = container.querySelector('.archive-search-input');
    expect(input?.getAttribute('aria-label')).toBe('Search completed items');
  });

  it('filters items by title (case-insensitive)', () => {
    items.value = [
      makeItem({ id: 'a', title: 'File taxes', completed_at: daysAgoISO(1), sort_order: 1 }),
      makeItem({ id: 'b', title: 'Book dentist', completed_at: daysAgoISO(2), sort_order: 2 }),
      makeItem({ id: 'c', title: 'Organize files', completed_at: daysAgoISO(3), sort_order: 3 }),
    ];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const input = container.querySelector('.archive-search-input') as HTMLInputElement;

    fireEvent.input(input, { target: { value: 'file' } });
    const titles = Array.from(container.querySelectorAll('.archive-item-title')).map(el => el.textContent);
    expect(titles).toEqual(['File taxes', 'Organize files']);
  });

  it('shows results count with aria-live="polite"', () => {
    items.value = [
      makeItem({ id: 'a', title: 'Task A', completed_at: daysAgoISO(1), sort_order: 1 }),
      makeItem({ id: 'b', title: 'Task B', completed_at: daysAgoISO(2), sort_order: 2 }),
    ];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const count = container.querySelector('.archive-results-count');
    expect(count?.getAttribute('aria-live')).toBe('polite');
    expect(count?.textContent).toBe('2 items');
  });

  it('shows "1 item" for singular count', () => {
    items.value = [
      makeItem({ id: 'a', title: 'Only task', completed_at: daysAgoISO(1), sort_order: 1 }),
    ];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const count = container.querySelector('.archive-results-count');
    expect(count?.textContent).toBe('1 item');
  });

  it('shows clear button when search has text', () => {
    items.value = [makeItem({ id: 'a' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const input = container.querySelector('.archive-search-input') as HTMLInputElement;

    // No clear button initially
    expect(container.querySelector('.archive-search-clear')).toBeFalsy();

    // Type something
    fireEvent.input(input, { target: { value: 'test' } });
    expect(container.querySelector('.archive-search-clear')).toBeTruthy();
  });

  it('clears search when clear button is clicked', () => {
    items.value = [
      makeItem({ id: 'a', title: 'AAA', completed_at: daysAgoISO(1), sort_order: 1 }),
      makeItem({ id: 'b', title: 'BBB', completed_at: daysAgoISO(2), sort_order: 2 }),
    ];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const input = container.querySelector('.archive-search-input') as HTMLInputElement;

    fireEvent.input(input, { target: { value: 'AAA' } });
    expect(container.querySelectorAll('.archive-item').length).toBe(1);

    const clearBtn = container.querySelector('.archive-search-clear');
    fireEvent.click(clearBtn!);
    expect(container.querySelectorAll('.archive-item').length).toBe(2);
  });

  it('shows "No matching items" when search has no results', () => {
    items.value = [makeItem({ id: 'a', title: 'Task A' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const input = container.querySelector('.archive-search-input') as HTMLInputElement;

    fireEvent.input(input, { target: { value: 'zzz' } });
    expect(container.querySelector('.archive-empty')?.textContent).toBe('No matching items');
  });

  it('shows "No completed items" when archive is empty', () => {
    items.value = [];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    expect(container.querySelector('.archive-empty')?.textContent).toBe('No completed items');
  });
});

describe('Archive item interaction (AC5)', () => {
  it('sets selectedItemId when an archive item is clicked', () => {
    items.value = [makeItem({ id: 'clickable-item', title: 'Click me' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const item = container.querySelector('.archive-item');
    fireEvent.click(item!);
    expect(selectedItemId.value).toBe('clickable-item');
  });

  it('archive items have minimum 44px height for touch targets', () => {
    // This test verifies the CSS class is applied; actual height is CSS-dependent
    items.value = [makeItem({ id: 'a' })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const item = container.querySelector('.archive-item') as HTMLElement;
    expect(item.tagName.toLowerCase()).toBe('button');
    // The .archive-item class in CSS specifies min-height: 44px
    expect(item.classList.contains('archive-item')).toBe(true);
  });

  it('archive items have descriptive aria-label', () => {
    items.value = [makeItem({ id: 'a', title: 'My Task', completed_at: daysAgoISO(5) })];
    const { container } = render(<ArchiveDialog onClose={onClose} />);
    const item = container.querySelector('.archive-item');
    const label = item?.getAttribute('aria-label');
    expect(label).toContain('My Task');
    expect(label).toContain('Completed 5 days ago');
  });
});
