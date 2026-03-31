import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { UpcomingView } from './upcoming-view';

const { mockState, mockToggleUpcomingBoard } = vi.hoisted(() => ({
  mockState: {
    upcomingBuckets: [] as any[],
    upcomingFilterSearch: '',
    upcomingFilterBoards: new Set(['b1', 'b2']) as Set<string>,
    accessibleBoards: [
      { id: 'b1', name: 'Work', icon: '💼', color: '#4a90e2' },
      { id: 'b2', name: 'Home', icon: '🏠', color: '#7ed321' },
    ] as any[],
    boards: [
      { id: 'b1', name: 'Work', icon: '💼', color: '#4a90e2' },
      { id: 'b2', name: 'Home', icon: '🏠', color: '#7ed321' },
    ] as any[],
    items: [] as any[],
    selectedItemId: null as string | null,
    openDetailWithTitleEdit: false,
  },
  mockToggleUpcomingBoard: vi.fn(),
}));

vi.mock('../../state/board-store', () => ({
  upcomingBuckets: { get value() { return mockState.upcomingBuckets; } },
  upcomingFilterSearch: {
    get value() { return mockState.upcomingFilterSearch; },
    set value(v: string) { mockState.upcomingFilterSearch = v; },
  },
  upcomingFilterBoards: { get value() { return mockState.upcomingFilterBoards; } },
  toggleUpcomingBoard: (...args: any[]) => mockToggleUpcomingBoard(...args),
  accessibleBoards: { get value() { return mockState.accessibleBoards; } },
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
}));

afterEach(() => {
  cleanup();
  mockToggleUpcomingBoard.mockClear();
});

beforeEach(() => {
  mockState.upcomingBuckets = [];
  mockState.upcomingFilterSearch = '';
  mockState.upcomingFilterBoards = new Set(['b1', 'b2']);
  mockState.accessibleBoards = [
    { id: 'b1', name: 'Work', icon: '💼', color: '#4a90e2' },
    { id: 'b2', name: 'Home', icon: '🏠', color: '#7ed321' },
  ];
  mockState.boards = [
    { id: 'b1', name: 'Work', icon: '💼', color: '#4a90e2' },
    { id: 'b2', name: 'Home', icon: '🏠', color: '#7ed321' },
  ];
  mockState.items = [];
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
});

describe('UpcomingView', () => {
  describe('Board filter tiles', () => {
    it('renders board tiles instead of dropdown', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-board-tiles"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="upcoming-board-filter-toggle"]')).toBeNull();
      expect(container.querySelector('[data-testid="upcoming-board-checkboxes"]')).toBeNull();
    });

    it('renders one tile per accessible board', () => {
      const { container } = render(<UpcomingView />);
      const tiles = container.querySelectorAll('[data-testid^="upcoming-board-tile-"]');
      expect(tiles.length).toBe(2);
    });

    it('active tile has upcoming-board-tile-active class and aria-pressed="true"', () => {
      mockState.upcomingFilterBoards = new Set(['b1', 'b2']);
      const { container } = render(<UpcomingView />);
      const tile = container.querySelector('[data-testid="upcoming-board-tile-b1"]');
      expect(tile!.classList.contains('upcoming-board-tile-active')).toBe(true);
      expect(tile!.getAttribute('aria-pressed')).toBe('true');
    });

    it('inactive tile has aria-pressed="false" and lacks active class', () => {
      mockState.upcomingFilterBoards = new Set(['b1']); // b2 excluded
      const { container } = render(<UpcomingView />);
      const tile = container.querySelector('[data-testid="upcoming-board-tile-b2"]');
      expect(tile!.classList.contains('upcoming-board-tile-active')).toBe(false);
      expect(tile!.getAttribute('aria-pressed')).toBe('false');
    });

    it('clicking a tile calls toggleUpcomingBoard with its id', () => {
      const { container } = render(<UpcomingView />);
      fireEvent.click(container.querySelector('[data-testid="upcoming-board-tile-b1"]') as HTMLElement);
      expect(mockToggleUpcomingBoard).toHaveBeenCalledWith('b1');
    });

    it('tiles show board icon and name', () => {
      const { container } = render(<UpcomingView />);
      const tile = container.querySelector('[data-testid="upcoming-board-tile-b1"]');
      expect(tile!.textContent).toContain('💼');
      expect(tile!.textContent).toContain('Work');
    });

    it('tiles use --board-color CSS custom property', () => {
      const { container } = render(<UpcomingView />);
      const tile = container.querySelector('[data-testid="upcoming-board-tile-b1"]') as HTMLElement;
      expect(tile.style.getPropertyValue('--board-color')).toBe('#4a90e2');
    });

    it('board tile group has role="group" and aria-label', () => {
      const { container } = render(<UpcomingView />);
      const group = container.querySelector('[data-testid="upcoming-board-tiles"]');
      expect(group!.getAttribute('role')).toBe('group');
      expect(group!.getAttribute('aria-label')).toBe('Filter by board');
    });
  });

  describe('No label chips in filter bar', () => {
    it('has no "Filter by label" group', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[aria-label="Filter by label"]')).toBeNull();
    });

    it('has no Label: chip group label text', () => {
      const { container } = render(<UpcomingView />);
      const labels = Array.from(container.querySelectorAll('.filter-chip-group-label'));
      expect(labels.find(l => l.textContent === 'Label:')).toBeUndefined();
    });
  });

  describe('Filter bar', () => {
    it('renders search input', () => {
      const { container } = render(<UpcomingView />);
      const input = container.querySelector('[data-testid="upcoming-search-input"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('Search cards...');
    });

    it('active filter count excludes labels', () => {
      mockState.upcomingFilterSearch = 'test';
      mockState.upcomingFilterBoards = new Set(['b1']); // b2 excluded = 1 board filter active
      const { container } = render(<UpcomingView />);
      const badge = container.querySelector('.filter-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('2'); // search + board filter
    });

    it('no filter badge when all boards selected and no search', () => {
      mockState.upcomingFilterSearch = '';
      mockState.upcomingFilterBoards = new Set(['b1', 'b2']);
      const { container } = render(<UpcomingView />);
      const badge = container.querySelector('.filter-badge');
      expect(badge).toBeNull();
    });
  });

  describe('Empty state', () => {
    it('shows empty message when no buckets', () => {
      mockState.upcomingBuckets = [];
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-empty"]')).not.toBeNull();
    });
  });

  describe('Mobile collapse', () => {
    it('filter content is collapsed on mobile by default', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      const { container } = render(<UpcomingView />);
      const content = container.querySelector('[data-testid="upcoming-filter-content"]');
      expect(content!.className).toContain('upcoming-filter-content-collapsed');
    });

    it('filter toggle button is present', () => {
      const { container } = render(<UpcomingView />);
      expect(container.querySelector('[data-testid="upcoming-filter-toggle"]')).not.toBeNull();
    });
  });
});
