import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
import { ControlBar } from './control-bar';

const { mockState, mockSwitchBoard, mockSetViewMode, mockToggleUpcomingBoard } = vi.hoisted(() => ({
  mockState: {
    boards: [{ id: 'b1', name: 'Work', icon: '' }] as any[],
    activeBoardId: 'b1',
    accessibleBoards: [
      { id: 'b1', name: 'Work', icon: '' },
      { id: 'b2', name: 'Family', icon: '' },
    ] as any[],
    activeBoard: { name: 'Work' } as any,
    userBoardRole: 'owner' as string | null,
    viewMode: 'board' as string,
    activeView: 'board' as string,
    filterLabel: null as string | null,
    filterSearch: '',
    filterDue: null as string | null,
    groupBy: 'none' as string,
    labels: [
      { label: 'Urgent', color: '#ff0000' },
      { label: 'Home', color: '#00cc00' },
    ],
    showCreateBoardModal: false,
    showShareModal: false,
    rootItems: [
      { id: '1', title: 'Task 1' },
      { id: '2', title: 'Task 2' },
      { id: '3', title: 'Task 3' },
    ] as any[],
    upcomingFilterSearch: '',
    upcomingFilterBoards: new Set(['b1', 'b2']) as Set<string>,
  },
  mockSwitchBoard: vi.fn(),
  mockSetViewMode: vi.fn(),
  mockToggleUpcomingBoard: vi.fn(),
}));

vi.mock('../../state/board-store', () => ({
  boards: { get value() { return mockState.boards; } },
  activeBoardId: { get value() { return mockState.activeBoardId; } },
  accessibleBoards: { get value() { return mockState.accessibleBoards; } },
  activeBoard: { get value() { return mockState.activeBoard; } },
  userBoardRole: { get value() { return mockState.userBoardRole; } },
  viewMode: { get value() { return mockState.viewMode; } },
  filterLabel: {
    get value() { return mockState.filterLabel; },
    set value(v: string | null) { mockState.filterLabel = v; },
  },
  filterSearch: {
    get value() { return mockState.filterSearch; },
    set value(v: string) { mockState.filterSearch = v; },
  },
  filterDue: {
    get value() { return mockState.filterDue; },
    set value(v: string | null) { mockState.filterDue = v; },
  },
  groupBy: {
    get value() { return mockState.groupBy; },
    set value(v: string) { mockState.groupBy = v; },
  },
  boardLabels: { get value() { return mockState.labels; } },
  rootItems: { get value() { return mockState.rootItems; } },
  switchBoard: (...args: any[]) => mockSwitchBoard(...args),
  setViewMode: (...args: any[]) => mockSetViewMode(...args),
  showCreateBoardModal: {
    get value() { return mockState.showCreateBoardModal; },
    set value(v: boolean) { mockState.showCreateBoardModal = v; },
  },
  showShareModal: {
    get value() { return mockState.showShareModal; },
    set value(v: boolean) { mockState.showShareModal = v; },
  },
  openDetailWithTitleEdit: { value: false },
  activeView: { get value() { return mockState.activeView; } },
  upcomingFilterSearch: {
    get value() { return mockState.upcomingFilterSearch; },
    set value(v: string) { mockState.upcomingFilterSearch = v; },
  },
  upcomingFilterBoards: { get value() { return mockState.upcomingFilterBoards; } },
  toggleUpcomingBoard: (...args: any[]) => mockToggleUpcomingBoard(...args),
}));

afterEach(() => {
  cleanup();
  mockSwitchBoard.mockClear();
  mockSetViewMode.mockClear();
  mockToggleUpcomingBoard.mockClear();
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 0 });
});

beforeEach(() => {
  mockState.boards = [{ id: 'b1', name: 'Work', icon: '' }];
  mockState.activeBoardId = 'b1';
  mockState.accessibleBoards = [
    { id: 'b1', name: 'Work', icon: '' },
    { id: 'b2', name: 'Family', icon: '' },
  ];
  mockState.activeBoard = { name: 'Work' };
  mockState.userBoardRole = 'owner';
  mockState.viewMode = 'board';
  mockState.filterLabel = null;
  mockState.filterSearch = '';
  mockState.filterDue = null;
  mockState.groupBy = 'none';
  mockState.showCreateBoardModal = false;
  mockState.showShareModal = false;
  mockState.activeView = 'board';
  mockState.rootItems = [
    { id: '1', title: 'Task 1' },
    { id: '2', title: 'Task 2' },
    { id: '3', title: 'Task 3' },
  ];
  mockState.upcomingFilterSearch = '';
  mockState.upcomingFilterBoards = new Set(['b1', 'b2']);
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 0 });
});

describe('ControlBar', () => {
  describe('Board selector', () => {
    it('renders board select with current board', () => {
      const { container } = render(<ControlBar />);
      const select = container.querySelector('[data-testid="control-bar-board-select"]') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.value).toBe('b1');
    });

    it('does not render a board color dot', () => {
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="board-color-dot"]')).toBeNull();
    });

    it('shows New Board button when no boards', () => {
      mockState.boards = [];
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('.btn-primary');
      expect(btn!.textContent).toBe('+ New Board');
    });
  });

  describe('#177 AC1: Text search input renders in filter bar', () => {
    it('renders search input with placeholder', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const input = container.querySelector('[data-testid="filter-search-input"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('Search cards...');
    });

    it('search input has aria-label="Search cards"', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const input = container.querySelector('[data-testid="filter-search-input"]');
      expect(input!.getAttribute('aria-label')).toBe('Search cards');
    });

    it('search wrapper has flex: 1 for available space (via class)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const wrapper = container.querySelector('[data-testid="filter-search-wrapper"]');
      expect(wrapper).not.toBeNull();
      expect(wrapper!.classList.contains('filter-search-wrapper')).toBe(true);
    });
  });

  describe('#177 AC2: Text search filters cards in real time', () => {
    it('shows × clear button when search has text', () => {
      const { container } = render(<ControlBar />);
      const input = container.querySelector('[data-testid="filter-search-input"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'test' } });
      const clearBtn = container.querySelector('[data-testid="filter-search-clear"]');
      expect(clearBtn).not.toBeNull();
    });

    it('hides × clear button when search is empty', () => {
      const { container } = render(<ControlBar />);
      const clearBtn = container.querySelector('[data-testid="filter-search-clear"]');
      expect(clearBtn).toBeNull();
    });

    it('clicking × clears the search', () => {
      const { container } = render(<ControlBar />);
      const input = container.querySelector('[data-testid="filter-search-input"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'test' } });
      const clearBtn = container.querySelector('[data-testid="filter-search-clear"]') as HTMLElement;
      fireEvent.click(clearBtn);
      expect(input.value).toBe('');
      expect(mockState.filterSearch).toBe('');
    });

    it('updates filterSearch signal after debounce', async () => {
      vi.useFakeTimers();
      const { container } = render(<ControlBar />);
      const input = container.querySelector('[data-testid="filter-search-input"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'kanban' } });
      expect(mockState.filterSearch).toBe('');
      vi.advanceTimersByTime(150);
      expect(mockState.filterSearch).toBe('kanban');
      vi.useRealTimers();
    });
  });

  describe('#177 AC4: Due quick-filter — Today', () => {
    it('renders Today chip in due filter group', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const chip = container.querySelector('[data-testid="filter-due-today"]');
      expect(chip).not.toBeNull();
      expect(chip!.textContent).toBe('Today');
    });

    it('clicking Today sets filterDue to "today"', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="filter-due-today"]') as HTMLElement);
      expect(mockState.filterDue).toBe('today');
    });

    it('clicking Today again clears the filter', () => {
      mockState.filterDue = 'today';
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="filter-due-today"]') as HTMLElement);
      expect(mockState.filterDue).toBeNull();
    });

    it('active Today chip has filter-chip-active class and aria-pressed="true"', () => {
      mockState.filterDue = 'today';
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const chip = container.querySelector('[data-testid="filter-due-today"]');
      expect(chip!.classList.contains('filter-chip-active')).toBe(true);
      expect(chip!.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('#177 AC5: Due quick-filter — This Week', () => {
    it('renders This Week chip', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const chip = container.querySelector('[data-testid="filter-due-this-week"]');
      expect(chip).not.toBeNull();
      expect(chip!.textContent).toBe('This Week');
    });

    it('clicking This Week sets filterDue to "this-week"', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="filter-due-this-week"]') as HTMLElement);
      expect(mockState.filterDue).toBe('this-week');
    });

    it('due chips are mutually exclusive', () => {
      mockState.filterDue = 'today';
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="filter-due-this-week"]') as HTMLElement);
      expect(mockState.filterDue).toBe('this-week');
    });
  });

  describe('#177 AC7: Owner chip group removed', () => {
    it('no "Filter by owner" group exists', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]');
      expect(ownerGroup).toBeNull();
    });

    it('no "Owner:" label text exists', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const labels = Array.from(container.querySelectorAll('.filter-chip-group-label'));
      const ownerLabel = labels.find(l => l.textContent === 'Owner:');
      expect(ownerLabel).toBeUndefined();
    });
  });

  describe('#177 AC8: Grouping moved to 3-dot menu', () => {
    it('no "Group by" chip group in filter bar', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]');
      expect(groupSection).toBeNull();
    });

    it('3-dot menu has Views section header', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const headers = Array.from(container.querySelectorAll('.overflow-menu-section-header'));
      expect(headers.some(h => h.textContent === 'Views')).toBe(true);
    });

    it('3-dot menu has Grouping section header', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const headers = Array.from(container.querySelectorAll('.overflow-menu-section-header'));
      expect(headers.some(h => h.textContent === 'Grouping')).toBe(true);
    });

    it('3-dot menu has Settings section header for owners', () => {
      mockState.userBoardRole = 'owner';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const headers = Array.from(container.querySelectorAll('.overflow-menu-section-header'));
      expect(headers.some(h => h.textContent === 'Settings')).toBe(true);
    });

    it('3-dot menu has hr dividers between sections', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const dividers = container.querySelectorAll('.overflow-menu-divider');
      expect(dividers.length).toBeGreaterThanOrEqual(1);
    });

    it('grouping items use role="menuitemradio"', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const noneItem = container.querySelector('[data-testid="overflow-menu-group-none"]');
      const labelItem = container.querySelector('[data-testid="overflow-menu-group-label"]');
      expect(noneItem!.getAttribute('role')).toBe('menuitemradio');
      expect(labelItem!.getAttribute('role')).toBe('menuitemradio');
    });

    it('"None" grouping has aria-checked="true" by default', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const noneItem = container.querySelector('[data-testid="overflow-menu-group-none"]');
      expect(noneItem!.getAttribute('aria-checked')).toBe('true');
    });

    it('clicking "By Label" sets groupBy to "label" and closes menu', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-group-label"]') as HTMLElement);
      expect(mockState.groupBy).toBe('label');
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).toBeNull();
    });
  });

  describe('#177 AC9: Mobile responsive', () => {
    it('desktop filter content is always rendered', () => {
      const { container } = render(<ControlBar />);
      const content = container.querySelector('[data-testid="control-bar-filter-content"]');
      expect(content).not.toBeNull();
      expect(content!.className).toContain('control-bar-filter-desktop');
    });

    it('Filters toggle shows badge with active filter count (search + due + label)', () => {
      mockState.filterSearch = 'test';
      mockState.filterDue = 'today';
      mockState.filterLabel = 'Urgent';
      const { container } = render(<ControlBar />);
      const badge = container.querySelector('.filter-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('3');
    });

    it('clicking toggle opens filter popup', () => {
      const { container } = render(<ControlBar />);
      const toggle = container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement;
      expect(container.querySelector('.filter-popup')).toBeNull();
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(container.querySelector('.filter-popup')).not.toBeNull();
    });

    it('clicking toggle again closes filter popup', () => {
      const { container } = render(<ControlBar />);
      const toggle = container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement;
      fireEvent.click(toggle); // open
      fireEvent.click(toggle); // close
      expect(container.querySelector('.filter-popup')).toBeNull();
    });

    it('clicking backdrop closes filter popup', () => {
      const { container } = render(<ControlBar />);
      const toggle = container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement;
      fireEvent.click(toggle);
      const backdrop = container.querySelector('.filter-popup-backdrop') as HTMLElement;
      fireEvent.click(backdrop);
      expect(container.querySelector('.filter-popup')).toBeNull();
    });

    it('badge count does not include owner (removed)', () => {
      mockState.filterSearch = 'test';
      const { container } = render(<ControlBar />);
      const badge = container.querySelector('.filter-badge');
      expect(badge!.textContent).toBe('1');
    });
  });

  describe('#177 AC10: Search input accessibility', () => {
    it('live region shows filtered count when filters active', () => {
      mockState.filterSearch = 'test';
      mockState.rootItems = [{ id: '1', title: 'Task 1' }, { id: '2', title: 'Task 2' }];
      const { container } = render(<ControlBar />);
      const liveRegion = container.querySelector('[data-testid="filter-live-region"]');
      expect(liveRegion).not.toBeNull();
      expect(liveRegion!.getAttribute('aria-live')).toBe('polite');
      expect(liveRegion!.textContent).toBe('2 cards shown');
    });

    it('live region is empty when no filters active', () => {
      const { container } = render(<ControlBar />);
      const liveRegion = container.querySelector('[data-testid="filter-live-region"]');
      expect(liveRegion!.textContent).toBe('');
    });

    it('pressing Escape in search input clears it', () => {
      const { container } = render(<ControlBar />);
      const input = container.querySelector('[data-testid="filter-search-input"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'test' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(input.value).toBe('');
    });
  });

  describe('3-dot menu — keyboard navigation (preserved)', () => {
    it('Escape closes the menu', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).not.toBeNull();
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).toBeNull();
    });

    it('click-outside closes menu', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).not.toBeNull();
      act(() => {
        fireEvent.mouseDown(document.body);
      });
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).toBeNull();
    });
  });

  describe('View toggle (preserved)', () => {
    it('clicking Board view calls setViewMode("board")', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-board"]') as HTMLElement);
      expect(mockSetViewMode).toHaveBeenCalledWith('board');
    });

    it('clicking List view calls setViewMode("list")', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-list"]') as HTMLElement);
      expect(mockSetViewMode).toHaveBeenCalledWith('list');
    });
  });

  describe('Board Settings (preserved)', () => {
    it('appears for owner', () => {
      mockState.userBoardRole = 'owner';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      expect(container.querySelector('[data-testid="overflow-menu-board-settings"]')).not.toBeNull();
    });

    it('hidden for non-owner', () => {
      mockState.userBoardRole = 'member';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      expect(container.querySelector('[data-testid="overflow-menu-board-settings"]')).toBeNull();
    });
  });

  describe('Board switcher hints (preserved)', () => {
    it('select has correct title attribute', () => {
      const { container } = render(<ControlBar />);
      const select = container.querySelector('[data-testid="control-bar-board-select"]');
      expect(select!.getAttribute('title')).toContain('Ctrl+1');
    });

    it('sr-only hint exists', () => {
      const { container } = render(<ControlBar />);
      const hint = container.querySelector('#board-switcher-hint');
      expect(hint).not.toBeNull();
      expect(hint!.classList.contains('sr-only')).toBe(true);
    });
  });

  describe('Due filter group a11y', () => {
    it('due filter group has role="group" and aria-label', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const group = container.querySelector('[data-testid="filter-due-group"]');
      expect(group!.getAttribute('role')).toBe('group');
      expect(group!.getAttribute('aria-label')).toBe('Filter by due date');
    });

    it('due chips have aria-pressed', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const todayChip = container.querySelector('[data-testid="filter-due-today"]');
      expect(todayChip!.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Upcoming view — filter bar in control bar', () => {
    beforeEach(() => {
      mockState.activeView = 'upcoming';
    });

    it('renders control-bar (not null) in upcoming view', () => {
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="control-bar"]')).not.toBeNull();
    });

    it('renders search input in upcoming view', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="upcoming-search-input"]')).not.toBeNull();
    });

    it('renders board filter chips in upcoming view when multiple boards exist', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="upcoming-board-filter-group"]')).not.toBeNull();
    });

    it('renders one chip per accessible board', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const chips = container.querySelectorAll('[data-testid^="upcoming-board-chip-"]');
      expect(chips.length).toBe(2);
    });

    it('board chips use filter-chip class', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const chip = container.querySelector('[data-testid="upcoming-board-chip-b1"]');
      expect(chip!.classList.contains('filter-chip')).toBe(true);
    });

    it('active board chip has filter-chip-active class', () => {
      mockState.upcomingFilterBoards = new Set(['b1', 'b2']);
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const chip = container.querySelector('[data-testid="upcoming-board-chip-b1"]');
      expect(chip!.classList.contains('filter-chip-active')).toBe(true);
    });

    it('clicking board chip calls toggleUpcomingBoard', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="upcoming-board-chip-b1"]') as HTMLElement);
      expect(mockToggleUpcomingBoard).toHaveBeenCalledWith('b1');
    });

    it('does not render board selector or due/label chips in upcoming view', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="control-bar-board-select"]')).toBeNull();
      expect(container.querySelector('[data-testid="filter-due-today"]')).toBeNull();
    });

    it('does not render overflow menu in upcoming view', () => {
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="overflow-menu-btn"]')).toBeNull();
    });

    it('hides board filter group when only one board', () => {
      mockState.accessibleBoards = [{ id: 'b1', name: 'Work', icon: '' }];
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="upcoming-board-filter-group"]')).toBeNull();
    });
  });

  describe('Board view — normal render', () => {
    it('renders normally when activeView is board', () => {
      mockState.activeView = 'board';
      const { container } = render(<ControlBar />);
      expect(container.querySelector('[data-testid="control-bar"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="control-bar-board-select"]')).not.toBeNull();
    });
  });
});
