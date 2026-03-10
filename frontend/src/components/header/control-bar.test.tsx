import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { ControlBar } from './control-bar';

const { mockState, mockSwitchBoard, mockSetViewMode } = vi.hoisted(() => ({
  mockState: {
    boards: [{ id: 'b1', name: 'Work', color: '#ff0000', icon: '' }] as any[],
    activeBoardId: 'b1',
    accessibleBoards: [
      { id: 'b1', name: 'Work', icon: '' },
      { id: 'b2', name: 'Family', icon: '' },
    ] as any[],
    activeBoard: { name: 'Work', color: '#ff0000' } as any,
    userBoardRole: 'owner' as string | null,
    viewMode: 'board' as string,
    filterOwner: null as string | null,
    filterLabel: null as string | null,
    groupBy: 'none' as string,
    owners: [
      { name: 'Luke', google_account: 'luke@example.com' },
      { name: 'Sarah', google_account: 'sarah@example.com' },
    ],
    labels: [
      { label: 'Urgent', color: '#ff0000' },
      { label: 'Home', color: '#00cc00' },
    ],
    showCreateBoardModal: false,
    showShareModal: false,
  },
  mockSwitchBoard: vi.fn(),
  mockSetViewMode: vi.fn(),
}));

vi.mock('../../state/board-store', () => ({
  boards: { get value() { return mockState.boards; } },
  activeBoardId: { get value() { return mockState.activeBoardId; } },
  accessibleBoards: { get value() { return mockState.accessibleBoards; } },
  activeBoard: { get value() { return mockState.activeBoard; } },
  userBoardRole: { get value() { return mockState.userBoardRole; } },
  viewMode: { get value() { return mockState.viewMode; } },
  filterOwner: {
    get value() { return mockState.filterOwner; },
    set value(v: string | null) { mockState.filterOwner = v; },
  },
  filterLabel: {
    get value() { return mockState.filterLabel; },
    set value(v: string | null) { mockState.filterLabel = v; },
  },
  groupBy: {
    get value() { return mockState.groupBy; },
    set value(v: string) { mockState.groupBy = v; },
  },
  owners: { get value() { return mockState.owners; } },
  labels: { get value() { return mockState.labels; } },
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
}));

afterEach(() => {
  cleanup();
  mockSwitchBoard.mockClear();
  mockSetViewMode.mockClear();
});

beforeEach(() => {
  mockState.boards = [{ id: 'b1', name: 'Work', color: '#ff0000', icon: '' }];
  mockState.activeBoardId = 'b1';
  mockState.accessibleBoards = [
    { id: 'b1', name: 'Work', icon: '' },
    { id: 'b2', name: 'Family', icon: '' },
  ];
  mockState.activeBoard = { name: 'Work', color: '#ff0000' };
  mockState.userBoardRole = 'owner';
  mockState.viewMode = 'board';
  mockState.filterOwner = null;
  mockState.filterLabel = null;
  mockState.groupBy = 'none';
  mockState.showCreateBoardModal = false;
  mockState.showShareModal = false;
});

describe('ControlBar (Issue #132 AC2)', () => {
  describe('Board selector', () => {
    it('renders board select with current board', () => {
      const { container } = render(<ControlBar />);
      const select = container.querySelector('[data-testid="control-bar-board-select"]') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.value).toBe('b1');
    });

    it('shows board color dot', () => {
      const { container } = render(<ControlBar />);
      const dot = container.querySelector('[data-testid="board-color-dot"]');
      expect(dot).not.toBeNull();
    });

    it('shows share button for owner', () => {
      const { container } = render(<ControlBar />);
      const share = container.querySelector('[data-testid="share-board-btn"]');
      expect(share).not.toBeNull();
    });

    it('hides share button for non-owner', () => {
      mockState.userBoardRole = 'member';
      const { container } = render(<ControlBar />);
      const share = container.querySelector('[data-testid="share-board-btn"]');
      expect(share).toBeNull();
    });

    it('shows New Board button when no boards', () => {
      mockState.boards = [];
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('.btn-primary');
      expect(btn!.textContent).toBe('+ New Board');
    });
  });

  describe('CSS separators', () => {
    it('renders separator spans with aria-hidden', () => {
      const { container } = render(<ControlBar />);
      const separators = container.querySelectorAll('.control-bar-separator');
      expect(separators.length).toBe(2);
      separators.forEach(sep => {
        expect(sep.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });

  describe('View toggle', () => {
    it('renders Board and List buttons', () => {
      const { container } = render(<ControlBar />);
      const board = container.querySelector('[data-testid="view-toggle-board"]');
      const list = container.querySelector('[data-testid="view-toggle-list"]');
      expect(board!.textContent).toBe('Board');
      expect(list!.textContent).toBe('List');
    });

    it('Board button has aria-pressed="true" when board mode', () => {
      const { container } = render(<ControlBar />);
      const board = container.querySelector('[data-testid="view-toggle-board"]');
      expect(board!.getAttribute('aria-pressed')).toBe('true');
    });

    it('clicking List calls setViewMode("list")', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="view-toggle-list"]') as HTMLElement);
      expect(mockSetViewMode).toHaveBeenCalledWith('list');
    });
  });

  describe('Filter toggle', () => {
    it('renders filter toggle button', () => {
      const { container } = render(<ControlBar />);
      const toggle = container.querySelector('[data-testid="control-bar-filter-toggle"]');
      expect(toggle).not.toBeNull();
      expect(toggle!.textContent).toBe('Filters');
    });

    it('shows filter badge when filters active', () => {
      mockState.filterOwner = 'Luke';
      const { container } = render(<ControlBar />);
      const badge = container.querySelector('.filter-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });

    it('clicking toggle expands filter content', () => {
      const { container } = render(<ControlBar />);
      const toggle = container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement;
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('Filter chips', () => {
    it('renders owner chips', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]');
      const chips = ownerGroup!.querySelectorAll('button.filter-chip');
      expect(chips.length).toBe(2);
    });

    it('clicking owner chip activates filter', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const lukeChip = ownerGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      fireEvent.click(lukeChip);
      expect(mockState.filterOwner).toBe('Luke');
    });
  });

  describe('Reset all button', () => {
    it('shows Reset all when filters active', () => {
      mockState.filterOwner = 'Luke';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement);
      const reset = container.querySelector('[data-testid="control-bar-reset"]');
      expect(reset).not.toBeNull();
      expect(reset!.textContent).toBe('Reset all');
    });

    it('Reset all clears all filters and grouping', () => {
      mockState.filterOwner = 'Luke';
      mockState.filterLabel = 'Urgent';
      mockState.groupBy = 'owner';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="control-bar-reset"]') as HTMLElement);
      expect(mockState.filterOwner).toBeNull();
      expect(mockState.filterLabel).toBeNull();
      expect(mockState.groupBy).toBe('none');
    });

    it('hidden when no filters active', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement);
      const reset = container.querySelector('[data-testid="control-bar-reset"]');
      expect(reset).toBeNull();
    });
  });

  describe('Active filter chips inline (AC3)', () => {
    it('shows active chips when owner filter set', () => {
      mockState.filterOwner = 'Luke';
      const { container } = render(<ControlBar />);
      const chips = container.querySelectorAll('[data-testid="control-bar-chip"]');
      expect(chips.length).toBe(1);
      expect(chips[0].textContent).toContain('Owner: Luke');
    });

    it('shows remove button on chip', () => {
      mockState.filterOwner = 'Luke';
      const { container } = render(<ControlBar />);
      const removeBtn = container.querySelector('.control-bar-chip-remove');
      expect(removeBtn).not.toBeNull();
      expect(removeBtn!.getAttribute('aria-label')).toBe('Remove Owner: Luke filter');
    });

    it('clicking remove clears the filter', () => {
      mockState.filterOwner = 'Luke';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('.control-bar-chip-remove') as HTMLElement);
      expect(mockState.filterOwner).toBeNull();
    });
  });
});
