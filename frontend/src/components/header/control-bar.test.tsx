import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/preact';
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
  // Reset to mobile default (JSDOM innerWidth = 0)
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 0 });
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
  // Default to mobile (JSDOM innerWidth = 0)
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

    it('shows board color dot', () => {
      const { container } = render(<ControlBar />);
      const dot = container.querySelector('[data-testid="board-color-dot"]');
      expect(dot).not.toBeNull();
    });

    it('shows New Board button when no boards', () => {
      mockState.boards = [];
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('.btn-primary');
      expect(btn!.textContent).toBe('+ New Board');
    });
  });

  describe('#163 — AC1: Board option labels no longer include shortcut text', () => {
    const HINT = 'Ctrl+1–9 to switch boards · Press ? for all shortcuts';

    it('option labels show name only — no (Ctrl+N) suffix on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const options = Array.from(container.querySelectorAll('[data-testid="control-bar-board-select"] option'));
      const boardOptions = options.filter(o => (o as HTMLOptionElement).value !== '__new__');
      boardOptions.forEach(opt => {
        expect(opt.textContent).not.toMatch(/\(Ctrl\+\d\)/);
      });
    });

    it('option with icon shows icon + name only', () => {
      mockState.accessibleBoards = [
        { id: 'b1', name: 'Work', icon: '💼' },
        { id: 'b2', name: 'Family', icon: '' },
      ];
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const b1Option = container.querySelector('[data-testid="control-bar-board-select"] option[value="b1"]');
      expect(b1Option!.textContent).toBe('💼 Work');
      expect(b1Option!.textContent).not.toContain('Ctrl');
    });

    it('option without icon shows name only', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const b2Option = container.querySelector('[data-testid="control-bar-board-select"] option[value="b2"]');
      expect(b2Option!.textContent).toBe('Family');
    });

    describe('#163 — AC2: Select shows shortcut hint via title', () => {
      it('select element has correct title attribute', () => {
        const { container } = render(<ControlBar />);
        const select = container.querySelector('[data-testid="control-bar-board-select"]');
        expect(select!.getAttribute('title')).toBe(HINT);
      });
    });

    describe('#163 — AC4: Screen readers via aria-describedby', () => {
      it('select has aria-describedby pointing to board-switcher-hint', () => {
        const { container } = render(<ControlBar />);
        const select = container.querySelector('[data-testid="control-bar-board-select"]');
        expect(select!.getAttribute('aria-describedby')).toBe('board-switcher-hint');
      });

      it('sr-only span #board-switcher-hint exists with hint text', () => {
        const { container } = render(<ControlBar />);
        const hint = container.querySelector('#board-switcher-hint');
        expect(hint).not.toBeNull();
        expect(hint!.classList.contains('sr-only')).toBe(true);
        expect(hint!.textContent).toBe(HINT);
      });

      it('hint text references Ctrl+1 and ? shortcuts', () => {
        const { container } = render(<ControlBar />);
        const hint = container.querySelector('#board-switcher-hint');
        expect(hint!.textContent).toContain('Ctrl+1');
        expect(hint!.textContent).toContain('?');
      });
    });
  });

  describe('CSS separators', () => {
    it('renders one separator span with aria-hidden', () => {
      const { container } = render(<ControlBar />);
      const separators = container.querySelectorAll('.control-bar-separator');
      expect(separators.length).toBe(1);
      separators.forEach(sep => {
        expect(sep.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });

  describe('AC2: Desktop — no Filters toggle button visible', () => {
    it('filter toggle is rendered but hidden via CSS on desktop (not in DOM logic)', () => {
      // On desktop (innerWidth > 768), isMobile=false so filter toggle is rendered
      // but CSS hides it. In JS/JSDOM we can verify the element exists and filter content is visible.
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      const { container } = render(<ControlBar />);
      // Filter content should NOT have the collapsed class on desktop
      const content = container.querySelector('[data-testid="control-bar-filter-content"]');
      expect(content!.className).not.toContain('control-bar-filter-content-collapsed');
    });
  });

  describe('AC1: Desktop — filter chips always visible', () => {
    it('filter content has no collapsed class on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const content = container.querySelector('[data-testid="control-bar-filter-content"]');
      expect(content!.className).not.toContain('control-bar-filter-content-collapsed');
    });

    it('owner chips are rendered without needing to click filter toggle on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]');
      expect(ownerGroup).not.toBeNull();
      const chips = ownerGroup!.querySelectorAll('button.filter-chip');
      expect(chips.length).toBe(2);
    });

    it('group labels are visible on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });
      const { container } = render(<ControlBar />);
      const labels = container.querySelectorAll('.filter-chip-group-label');
      expect(labels.length).toBeGreaterThanOrEqual(3); // Owner:, Label:, Group:
    });
  });

  describe('AC3: Mobile — filter controls behind Filters button', () => {
    it('renders filter toggle button on mobile', () => {
      // JSDOM defaults to innerWidth=0 (mobile)
      const { container } = render(<ControlBar />);
      const toggle = container.querySelector('[data-testid="control-bar-filter-toggle"]');
      expect(toggle).not.toBeNull();
      expect(toggle!.textContent).toBe('Filters');
    });

    it('filter content has collapsed class on mobile by default', () => {
      const { container } = render(<ControlBar />);
      const content = container.querySelector('[data-testid="control-bar-filter-content"]');
      expect(content!.className).toContain('control-bar-filter-content-collapsed');
    });

    it('shows filter badge when filters active on mobile', () => {
      mockState.filterOwner = 'Luke';
      const { container } = render(<ControlBar />);
      const badge = container.querySelector('.filter-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('1');
    });

    it('clicking toggle expands filter content on mobile', () => {
      const { container } = render(<ControlBar />);
      const toggle = container.querySelector('[data-testid="control-bar-filter-toggle"]') as HTMLElement;
      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const content = container.querySelector('[data-testid="control-bar-filter-content"]');
      expect(content!.className).not.toContain('control-bar-filter-content-collapsed');
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

  describe('AC10: Active filter chips inline', () => {
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

  describe('AC4: 3-dot overflow menu — structure and ARIA', () => {
    it('renders the overflow ⋯ button', () => {
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('[data-testid="overflow-menu-btn"]');
      expect(btn).not.toBeNull();
    });

    it('⋯ button has aria-label="More options"', () => {
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('[data-testid="overflow-menu-btn"]');
      expect(btn!.getAttribute('aria-label')).toBe('More options');
    });

    it('⋯ button has aria-haspopup="true"', () => {
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('[data-testid="overflow-menu-btn"]');
      expect(btn!.getAttribute('aria-haspopup')).toBe('true');
    });

    it('⋯ button has aria-expanded="false" when closed', () => {
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('[data-testid="overflow-menu-btn"]');
      expect(btn!.getAttribute('aria-expanded')).toBe('false');
    });

    it('⋯ button has aria-expanded="true" when open', () => {
      const { container } = render(<ControlBar />);
      const btn = container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement;
      fireEvent.click(btn);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
    });

    it('clicking ⋯ opens dropdown with role="menu"', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const menu = container.querySelector('[data-testid="overflow-menu-dropdown"]');
      expect(menu).not.toBeNull();
      expect(menu!.getAttribute('role')).toBe('menu');
    });

    it('menu items have role="menuitem"', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBeGreaterThanOrEqual(2);
      items.forEach(item => expect(item.getAttribute('role')).toBe('menuitem'));
    });

    it('Board view item has aria-checked="true" when in board mode', () => {
      mockState.viewMode = 'board';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const boardItem = container.querySelector('[data-testid="overflow-menu-view-board"]');
      expect(boardItem!.getAttribute('aria-checked')).toBe('true');
    });

    it('List view item has aria-checked="true" when in list mode', () => {
      mockState.viewMode = 'list';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const listItem = container.querySelector('[data-testid="overflow-menu-view-list"]');
      expect(listItem!.getAttribute('aria-checked')).toBe('true');
    });
  });

  describe('AC5: View toggle in 3-dot switches view and closes menu', () => {
    it('clicking Board view in menu calls setViewMode("board")', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-board"]') as HTMLElement);
      expect(mockSetViewMode).toHaveBeenCalledWith('board');
    });

    it('clicking List view in menu calls setViewMode("list")', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-list"]') as HTMLElement);
      expect(mockSetViewMode).toHaveBeenCalledWith('list');
    });

    it('menu closes after selecting view', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-list"]') as HTMLElement);
      const menu = container.querySelector('[data-testid="overflow-menu-dropdown"]');
      expect(menu).toBeNull();
    });
  });

  describe('AC6: Board Settings item opens the settings modal', () => {
    it('Board Settings item appears for owner in 3-dot menu', () => {
      mockState.userBoardRole = 'owner';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const settings = container.querySelector('[data-testid="overflow-menu-board-settings"]');
      expect(settings).not.toBeNull();
      expect(settings!.textContent).toBe('Board Settings');
    });

    it('clicking Board Settings sets showShareModal=true and closes menu', () => {
      mockState.userBoardRole = 'owner';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-board-settings"]') as HTMLElement);
      expect(mockState.showShareModal).toBe(true);
      const menu = container.querySelector('[data-testid="overflow-menu-dropdown"]');
      expect(menu).toBeNull();
    });
  });

  describe('AC7: Non-owners do not see Board Settings', () => {
    it('Board Settings item is absent for non-owner', () => {
      mockState.userBoardRole = 'member';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const settings = container.querySelector('[data-testid="overflow-menu-board-settings"]');
      expect(settings).toBeNull();
    });

    it('only view toggle items present for non-owner', () => {
      mockState.userBoardRole = 'member';
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBe(2);
    });
  });

  describe('AC8: 3-dot menu — keyboard navigation', () => {
    it('Escape closes the menu and no error is thrown', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).not.toBeNull();
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).toBeNull();
    });

    it('ArrowDown moves focus between menu items', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items[0].focus();
      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });
      expect(document.activeElement).toBe(items[1]);
    });

    it('ArrowUp moves focus between menu items', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
      items[1].focus();
      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowUp' });
      });
      expect(document.activeElement).toBe(items[0]);
    });
  });

  describe('AC9: 3-dot menu — click-outside to dismiss', () => {
    it('clicking outside the menu closes it', () => {
      const { container } = render(<ControlBar />);
      fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).not.toBeNull();
      act(() => {
        fireEvent.mouseDown(document.body);
      });
      expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).toBeNull();
    });
  });
});
