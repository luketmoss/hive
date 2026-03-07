import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { KanbanBoard } from './kanban-board';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

afterEach(() => {
  cleanup();
});

// Mutable mock data for items
let mockItems: any[] = [];

vi.mock('../../state/board-store', () => ({
  items: { get value() { return mockItems; } },
  columns: {
    get value() {
      return {
        'To Do': mockItems.filter((i: any) => i.status === 'To Do' && !i.parent_id),
        'In Progress': mockItems.filter((i: any) => i.status === 'In Progress' && !i.parent_id),
        'Done': mockItems.filter((i: any) => i.status === 'Done' && !i.parent_id),
      };
    },
  },
  rootItems: {
    get value() { return mockItems.filter((i: any) => !i.parent_id); },
  },
  showCreateModal: { value: false },
  selectedItem: { value: null },
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
  showArchiveDialog: { value: false },
  boards: { value: [] },
  boardItems: { get value() { return mockItems; } },
  showCreateBoardModal: { value: false },
  showShareModal: { value: false },
  accessibleBoards: { value: [] },
  activeBoard: { value: null },
  userBoardRole: { value: null },
  permissions: { value: [] },
  currentUserEmail: { value: '' },
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
      mockItems = [];
      const { container } = renderBoard();
      const welcome = container.querySelector('[data-testid="board-welcome"]');
      expect(welcome).not.toBeNull();
      expect(welcome!.textContent).toContain('No tasks yet');
      expect(welcome!.textContent).toContain('+');
    });

    it('does not show welcome when board has items', () => {
      mockItems = [{
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
      mockItems = [];
      const { container } = renderBoard();
      const columns = container.querySelector('.board-columns');
      expect(columns).toBeNull();
    });
  });

  // AC2: Empty columns still show standard "No items" text (not welcome)
  describe('AC2: Empty columns still show standard text', () => {
    it('renders columns with "No items" when board has items but some columns are empty', () => {
      mockItems = [{
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
      mockItems = [];
      const { container } = renderBoard();
      const trigger = container.querySelector('.user-info');
      expect(trigger).not.toBeNull();
      expect(trigger!.tagName).toBe('BUTTON');
    });

    it('has aria-haspopup="dialog"', () => {
      mockItems = [];
      const { container } = renderBoard();
      const trigger = container.querySelector('.user-info');
      expect(trigger!.getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('shows user name with truncation class', () => {
      mockItems = [];
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
      mockItems = [];
      const { container } = renderBoard();
      const fab = container.querySelector('.fab') as HTMLElement;
      expect(fab).not.toBeNull();
      expect(fab.getAttribute('aria-label')).toBe('Create new item');
    });

    it('FAB button has title="Create new item"', () => {
      mockItems = [];
      const { container } = renderBoard();
      const fab = container.querySelector('.fab') as HTMLElement;
      expect(fab.getAttribute('title')).toBe('Create new item');
    });
  });
});
