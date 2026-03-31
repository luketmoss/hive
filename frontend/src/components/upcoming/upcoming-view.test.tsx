import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { UpcomingView } from './upcoming-view';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    upcomingBuckets: [] as any[],
    boards: [
      { id: 'b1', name: 'Work', icon: '💼' },
      { id: 'b2', name: 'Home', icon: '🏠' },
    ] as any[],
    items: [] as any[],
    selectedItemId: null as string | null,
    openDetailWithTitleEdit: false,
  },
}));

vi.mock('../../state/board-store', () => ({
  upcomingBuckets: { get value() { return mockState.upcomingBuckets; } },
  boards: { get value() { return mockState.boards; } },
  items: { get value() { return mockState.items; } },
  selectedItemId: {
    get value() { return mockState.selectedItemId; },
    set value(v: string | null) { mockState.selectedItemId = v; },
  },
  openDetailWithTitleEdit: {
    get value() { return mockState.openDetailWithTitleEdit; },
    set value(v: boolean) { mockState.openDetailWithTitleEdit = v; },
  },
  getChildCount: () => ({ total: 0, done: 0 }),
  // Required by LabelBadge which is used in UpcomingCard
  labels: { value: [] },
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockState.upcomingBuckets = [];
  mockState.boards = [
    { id: 'b1', name: 'Work', icon: '💼' },
    { id: 'b2', name: 'Home', icon: '🏠' },
  ];
  mockState.items = [];
});

describe('UpcomingView', () => {
  describe('Empty state', () => {
    it('shows empty message when no buckets', () => {
      mockState.upcomingBuckets = [];
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-empty"]')).not.toBeNull();
    });

    it('does not show buckets when empty', () => {
      mockState.upcomingBuckets = [];
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-buckets"]')).toBeNull();
    });
  });

  describe('Buckets render as columns', () => {
    beforeEach(() => {
      mockState.upcomingBuckets = [
        {
          key: 'overdue',
          label: 'Overdue',
          items: [
            { id: 'i1', title: 'Fix bug', status: 'To Do', owner: 'Luke', due_date: '2024-01-01', labels: '', description: '', board_id: 'b1', parent_id: '', created_at: '', updated_at: '', completed_at: '', sort_order: 0, created_by: '', sheetRow: 1 },
          ],
        },
        {
          key: 'this-week',
          label: 'This Week',
          items: [],
        },
      ];
    });

    it('renders the board-columns container', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-buckets"]')).not.toBeNull();
      expect(container.querySelector('.board-columns')).not.toBeNull();
    });

    it('renders each bucket with the column class', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-bucket-overdue"]')).not.toBeNull();
      expect(container.querySelector('.column')).not.toBeNull();
    });

    it('each bucket has the correct color class', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('.upcoming-bucket-overdue')).not.toBeNull();
      expect(container.querySelector('.upcoming-bucket-this-week')).not.toBeNull();
    });

    it('bucket header shows label and count', () => {
      const { container } = render(<UpcomingView />);
      const header = container.querySelector('[data-testid="upcoming-bucket-overdue"] .column-header');
      expect(header!.textContent).toContain('Overdue');
      expect(header!.textContent).toContain('1');
    });

    it('renders card items in the bucket', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-card-i1"]')).not.toBeNull();
    });

    it('no filter UI rendered inside upcoming view (moved to control bar)', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-filter-toggle"]')).toBeNull();
      expect(container.querySelector('[data-testid="upcoming-search-input"]')).toBeNull();
      expect(container.querySelector('[data-testid="upcoming-board-tiles"]')).toBeNull();
    });
  });

  describe('Card rendering', () => {
    beforeEach(() => {
      mockState.upcomingBuckets = [
        {
          key: 'this-week',
          label: 'This Week',
          items: [
            { id: 'c1', title: 'Write tests', status: 'To Do', owner: 'Luke', due_date: '2026-04-02', labels: 'Work', description: 'A task', board_id: 'b1', parent_id: '', created_at: '', updated_at: '', completed_at: '', sort_order: 0, created_by: '', sheetRow: 2 },
          ],
        },
      ];
    });

    it('card shows title', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-card-c1"]')!.textContent).toContain('Write tests');
    });

    it('card shows owner name', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-card-c1"]')!.textContent).toContain('Luke');
    });

    it('board badge shows board name', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="board-badge-b1"]')!.textContent).toContain('Work');
    });
  });
});
