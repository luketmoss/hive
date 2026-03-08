import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { KanbanBoard } from './kanban-board';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

// Mutable mock state — defined as plain objects so vi.mock hoisting works
const mockState = {
  items: [] as any[],
  showShareModal: false,
  userBoardRole: null as string | null,
  showCreateModal: false,
  showCreateBoardModal: false,
  showArchiveDialog: false,
  selectedItem: null as any,
  accessibleBoards: [] as any[],
};

const mockSwitchBoard = vi.fn();

afterEach(() => {
  cleanup();
  mockState.items = [];
  mockState.showShareModal = false;
  mockState.userBoardRole = null;
  mockState.showCreateModal = false;
  mockState.showCreateBoardModal = false;
  mockState.showArchiveDialog = false;
  mockState.selectedItem = null;
  mockState.accessibleBoards = [];
  mockSwitchBoard.mockClear();
});

vi.mock('../../state/board-store', () => ({
  items: { get value() { return mockState.items; } },
  columns: {
    get value() {
      return {
        'To Do': mockState.items.filter((i: any) => i.status === 'To Do' && !i.parent_id),
        'In Progress': mockState.items.filter((i: any) => i.status === 'In Progress' && !i.parent_id),
        'Done': mockState.items.filter((i: any) => i.status === 'Done' && !i.parent_id),
      };
    },
  },
  rootItems: {
    get value() { return mockState.items.filter((i: any) => !i.parent_id); },
  },
  showCreateModal: {
    get value() { return mockState.showCreateModal; },
    set value(v: boolean) { mockState.showCreateModal = v; },
  },
  selectedItem: {
    get value() { return mockState.selectedItem; },
    set value(v: any) { mockState.selectedItem = v; },
  },
  selectedItemId: { value: null },
  groupBy: { value: 'none' },
  owners: { value: [] },
  labels: { value: [] },
  filterOwner: { value: null },
  filterLabel: { value: null },
  loading: { value: false },
  getChildCount: () => ({ done: 0, total: 0 }),
  viewMode: { value: 'board' },
  setViewMode: () => {},
  allDoneItems: { value: [] },
  hasArchivedItems: { value: false },
  showArchiveDialog: {
    get value() { return mockState.showArchiveDialog; },
    set value(v: boolean) { mockState.showArchiveDialog = v; },
  },
  boards: { value: [] },
  boardItems: { get value() { return mockState.items; } },
  showCreateBoardModal: {
    get value() { return mockState.showCreateBoardModal; },
    set value(v: boolean) { mockState.showCreateBoardModal = v; },
  },
  showShareModal: {
    get value() { return mockState.showShareModal; },
    set value(v: boolean) { mockState.showShareModal = v; },
  },
  accessibleBoards: { get value() { return mockState.accessibleBoards; } },
  activeBoard: { value: null },
  userBoardRole: { get value() { return mockState.userBoardRole; } },
  permissions: { value: [] },
  currentUserEmail: { value: '' },
  switchBoard: (...args: any[]) => mockSwitchBoard(...args),
}));

vi.mock('../../state/actions', () => ({
  moveItem: vi.fn(),
}));

// Mock FilterBar to avoid pulling in the full filter chain
vi.mock('../filters/filter-bar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

// Mock ListView, CardDetail, and CreateItemModal
vi.mock('./list-view', () => ({
  ListView: () => <div data-testid="list-view" />,
}));
vi.mock('./card-detail', () => ({
  CardDetail: () => <div data-testid="card-detail" />,
}));
vi.mock('../forms/create-item-modal', () => ({
  CreateItemModal: () => <div data-testid="create-modal" />,
}));
vi.mock('./board-switcher', () => ({
  BoardSwitcher: () => null,
}));
vi.mock('./create-board-modal', () => ({
  CreateBoardModal: () => null,
}));
vi.mock('./share-modal', () => ({
  ShareModal: () => null,
}));
vi.mock('./shortcuts-help', () => ({
  ShortcutsHelp: ({ onClose }: any) => <div data-testid="shortcuts-help"><button onClick={onClose}>Close</button></div>,
}));
vi.mock('../profile/profile-dialog', () => ({
  ProfileDialog: () => <div data-testid="profile-dialog" />,
}));
vi.mock('../archive/archive-dialog', () => ({
  ArchiveDialog: () => <div data-testid="archive-dialog" />,
}));

const mockAuth: AuthState = {
  token: 'test-token',
  user: { name: 'Luke', email: 'luke@example.com', picture: '' },
  isAuthenticated: true,
  login: () => {},
  logout: () => {},
  updateUserName: () => {},
};

function renderBoard() {
  return render(
    <AuthContext.Provider value={mockAuth}>
      <KanbanBoard />
    </AuthContext.Provider>
  );
}

describe('KanbanBoard empty/welcome state (Issue #11)', () => {
  // AC1: Empty board shows welcome message
  describe('AC1: Empty board shows welcome message', () => {
    it('shows welcome message when board has zero items', () => {
      mockState.items = [];
      const { container } = renderBoard();
      const welcome = container.querySelector('[data-testid="board-welcome"]');
      expect(welcome).not.toBeNull();
      expect(welcome!.textContent).toContain('No tasks yet');
      expect(welcome!.textContent).toContain('+');
    });

    it('does not show welcome when board has items', () => {
      mockState.items = [{
        id: '1', title: 'Task', description: '', status: 'To Do',
        owner: '', due_date: '', scheduled_date: '', labels: '',
        parent_id: '', created_at: '', updated_at: '', completed_at: '',
        sort_order: 1, created_by: '', board_id: '', sheetRow: 2,
      }];
      const { container } = renderBoard();
      const welcome = container.querySelector('[data-testid="board-welcome"]');
      expect(welcome).toBeNull();
    });

    it('does not show columns when board is empty', () => {
      mockState.items = [];
      const { container } = renderBoard();
      const columns = container.querySelector('.board-columns');
      expect(columns).toBeNull();
    });
  });

  // AC2: Empty columns still show standard "No items" text (not welcome)
  describe('AC2: Empty columns still show standard text', () => {
    it('renders columns with "No items" when board has items but some columns are empty', () => {
      mockState.items = [{
        id: '1', title: 'Task', description: '', status: 'To Do',
        owner: '', due_date: '', scheduled_date: '', labels: '',
        parent_id: '', created_at: '', updated_at: '', completed_at: '',
        sort_order: 1, created_by: '', board_id: '', sheetRow: 2,
      }];
      const { container } = renderBoard();
      // Board should show columns, not welcome
      const welcome = container.querySelector('[data-testid="board-welcome"]');
      expect(welcome).toBeNull();

      const emptyColumns = container.querySelectorAll('.column-empty');
      // "In Progress" and "Done" columns should show "No items"
      expect(emptyColumns.length).toBe(2);
      emptyColumns.forEach(el => {
        expect(el.textContent).toBe('No items');
      });
    });
  });
});

describe('KanbanBoard profile trigger (Issue #40)', () => {
  // AC1: Profile trigger in header
  describe('AC1: Profile trigger is a button with proper ARIA', () => {
    it('renders user-info as a <button> element', () => {
      mockState.items = [];
      const { container } = renderBoard();
      const trigger = container.querySelector('.user-info');
      expect(trigger).not.toBeNull();
      expect(trigger!.tagName).toBe('BUTTON');
    });

    it('has aria-haspopup="dialog"', () => {
      mockState.items = [];
      const { container } = renderBoard();
      const trigger = container.querySelector('.user-info');
      expect(trigger!.getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('shows user name with truncation class', () => {
      mockState.items = [];
      const { container } = renderBoard();
      const nameSpan = container.querySelector('.user-name');
      expect(nameSpan).not.toBeNull();
      expect(nameSpan!.textContent).toBe('Luke');
    });
  });
});

describe('KanbanBoard ARIA labels (Issue #7)', () => {
  // AC2: FAB has accessible label
  describe('AC2: FAB has accessible label', () => {
    it('FAB button has aria-label="Create new item"', () => {
      mockState.items = [];
      const { container } = renderBoard();
      const fab = container.querySelector('.fab') as HTMLElement;
      expect(fab).not.toBeNull();
      expect(fab.getAttribute('aria-label')).toBe('Create new item');
    });

    it('FAB button has title="Create new item"', () => {
      mockState.items = [];
      const { container } = renderBoard();
      const fab = container.querySelector('.fab') as HTMLElement;
      expect(fab.getAttribute('title')).toBe('Create new item');
    });
  });
});

describe('KanbanBoard keyboard shortcut (Issue #90)', () => {
  describe('AC2: Ctrl+Shift+S opens share modal for owners', () => {
    it('opens share modal on Ctrl+Shift+S when user is owner', () => {
      mockState.items = [];
      mockState.userBoardRole ='owner';
      renderBoard();

      fireEvent.keyDown(document, { key: 'S', ctrlKey: true, shiftKey: true });

      expect(mockState.showShareModal).toBe(true);
    });

    it('opens share modal on Cmd+Shift+S (Mac) when user is owner', () => {
      mockState.items = [];
      mockState.userBoardRole ='owner';
      renderBoard();

      fireEvent.keyDown(document, { key: 'S', metaKey: true, shiftKey: true });

      expect(mockState.showShareModal).toBe(true);
    });
  });

  describe('AC3: Shortcut inactive for non-owners', () => {
    it('does not open share modal when user is member', () => {
      mockState.items = [];
      mockState.userBoardRole ='member';
      renderBoard();

      fireEvent.keyDown(document, { key: 'S', ctrlKey: true, shiftKey: true });

      expect(mockState.showShareModal).toBe(false);
    });

    it('does not open share modal when user has no role', () => {
      mockState.items = [];
      mockState.userBoardRole =null;
      renderBoard();

      fireEvent.keyDown(document, { key: 'S', ctrlKey: true, shiftKey: true });

      expect(mockState.showShareModal).toBe(false);
    });
  });

  describe('Shortcut guards', () => {
    it('does not open share modal when another modal is open', () => {
      mockState.items = [];
      mockState.userBoardRole ='owner';
      mockState.showCreateModal = true;
      renderBoard();

      fireEvent.keyDown(document, { key: 'S', ctrlKey: true, shiftKey: true });

      expect(mockState.showShareModal).toBe(false);
    });

    it('does not open share modal when share modal is already open', () => {
      mockState.items = [];
      mockState.userBoardRole = 'owner';
      mockState.showShareModal = true;
      renderBoard();

      fireEvent.keyDown(document, { key: 'S', ctrlKey: true, shiftKey: true });

      // Should still be true (unchanged), not toggled
      expect(mockState.showShareModal).toBe(true);
    });
  });
});

describe('KanbanBoard keyboard shortcuts (Issue #91)', () => {
  describe('AC1: Archive shortcut', () => {
    it('opens archive dialog when A is pressed', () => {
      mockState.items = [];
      renderBoard();

      fireEvent.keyDown(document, { key: 'a' });

      expect(mockState.showArchiveDialog).toBe(true);
    });

    it('closes archive dialog when A is pressed again', () => {
      mockState.items = [];
      mockState.showArchiveDialog = true;
      renderBoard();

      fireEvent.keyDown(document, { key: 'a' });

      expect(mockState.showArchiveDialog).toBe(false);
    });
  });

  describe('AC2: Board switching shortcuts', () => {
    it('switches to board at position with Ctrl+number', () => {
      mockState.items = [];
      mockState.accessibleBoards = [
        { id: 'b1', name: 'Board 1' },
        { id: 'b2', name: 'Board 2' },
      ];
      renderBoard();

      fireEvent.keyDown(document, { key: '2', ctrlKey: true });

      expect(mockSwitchBoard).toHaveBeenCalledWith('b2');
    });

    it('switches to first board with Cmd+1 (Mac)', () => {
      mockState.items = [];
      mockState.accessibleBoards = [
        { id: 'b1', name: 'Board 1' },
        { id: 'b2', name: 'Board 2' },
      ];
      renderBoard();

      fireEvent.keyDown(document, { key: '1', metaKey: true });

      expect(mockSwitchBoard).toHaveBeenCalledWith('b1');
    });

    it('does nothing when number exceeds board count', () => {
      mockState.items = [];
      mockState.accessibleBoards = [{ id: 'b1', name: 'Board 1' }];
      renderBoard();

      fireEvent.keyDown(document, { key: '5', ctrlKey: true });

      expect(mockSwitchBoard).not.toHaveBeenCalled();
    });
  });

  describe('AC3: New item shortcut', () => {
    it('opens create modal when N is pressed', () => {
      mockState.items = [];
      renderBoard();

      fireEvent.keyDown(document, { key: 'n' });

      expect(mockState.showCreateModal).toBe(true);
    });

    it('does not open create modal when another modal is already open', () => {
      mockState.items = [];
      mockState.showArchiveDialog = true;
      renderBoard();

      fireEvent.keyDown(document, { key: 'n' });

      expect(mockState.showCreateModal).toBe(false);
    });
  });

  describe('AC4: Shortcuts help overlay', () => {
    it('opens shortcuts help when ? is pressed', () => {
      mockState.items = [];
      const { queryByTestId } = renderBoard();

      // Real keyboards send shiftKey: true when typing '?' (Shift + /)
      fireEvent.keyDown(document, { key: '?', shiftKey: true });

      expect(queryByTestId('shortcuts-help')).not.toBeNull();
    });
  });
});
