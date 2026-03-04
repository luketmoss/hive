import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

// Use vi.hoisted so these are available in the vi.mock factory
const { mockViewMode, mockSetViewMode, mockItemsRef } = vi.hoisted(() => ({
  mockViewMode: { value: 'board' as string },
  mockSetViewMode: vi.fn((mode: string) => { mockViewMode.value = mode; }),
  mockItemsRef: { current: [] as any[] },
}));

vi.mock('../../state/board-store', () => ({
  items: { get value() { return mockItemsRef.current; } },
  columns: {
    get value() {
      return {
        'To Do': mockItemsRef.current.filter((i: any) => i.status === 'To Do' && !i.parent_id),
        'In Progress': mockItemsRef.current.filter((i: any) => i.status === 'In Progress' && !i.parent_id),
        'Done': mockItemsRef.current.filter((i: any) => i.status === 'Done' && !i.parent_id),
      };
    },
  },
  rootItems: {
    get value() { return mockItemsRef.current.filter((i: any) => !i.parent_id); },
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
  viewMode: mockViewMode,
  setViewMode: mockSetViewMode,
}));

vi.mock('../../state/actions', () => ({
  moveItem: vi.fn(),
}));

vi.mock('../filters/filter-bar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('./list-view', () => ({
  ListView: () => <div class="list-view" data-testid="list-view" />,
}));

vi.mock('./card-detail', () => ({
  CardDetail: () => <div data-testid="card-detail" />,
}));

vi.mock('../forms/create-item-modal', () => ({
  CreateItemModal: () => <div data-testid="create-modal" />,
}));

// Import after mocks
import { KanbanBoard } from './kanban-board';

const mockAuth: AuthState = {
  token: 'test-token',
  user: { name: 'Luke', email: 'luke@example.com', picture: '' },
  isAuthenticated: true,
  login: () => {},
  logout: () => {},
};

function renderBoard() {
  return render(
    <AuthContext.Provider value={mockAuth}>
      <KanbanBoard />
    </AuthContext.Provider>
  );
}

afterEach(() => {
  cleanup();
  mockItemsRef.current = [];
  mockViewMode.value = 'board';
  mockSetViewMode.mockClear();
});

describe('View Toggle (Issue #13)', () => {
  beforeEach(() => {
    mockItemsRef.current = [
      {
        id: '1', title: 'Task A', description: '', status: 'To Do',
        owner: '', due_date: '', scheduled_date: '', labels: '',
        parent_id: '', created_at: '', updated_at: '', completed_at: '',
        sort_order: 1, created_by: '', sheetRow: 2,
      },
    ];
  });

  // AC1: View toggle available on mobile (<= 768px), hidden on desktop
  describe('AC1: Toggle is available on mobile, hidden on desktop', () => {
    it('renders the view toggle bar with Board and List buttons', () => {
      const { container } = renderBoard();
      const toggleBar = container.querySelector('[data-testid="view-toggle-bar"]');
      expect(toggleBar).not.toBeNull();

      const boardBtn = container.querySelector('[data-testid="view-toggle-board"]');
      const listBtn = container.querySelector('[data-testid="view-toggle-list"]');
      expect(boardBtn).not.toBeNull();
      expect(listBtn).not.toBeNull();
      expect(boardBtn!.textContent).toBe('Board');
      expect(listBtn!.textContent).toBe('List');
    });

    it('toggle bar has view-toggle-bar class which is hidden on desktop via CSS', () => {
      const { container } = renderBoard();
      const toggleBar = container.querySelector('.view-toggle-bar');
      expect(toggleBar).not.toBeNull();
      // CSS hides this on desktop with display:none; shown at max-width:768px
    });

    it('marks Board button as active when viewMode is board', () => {
      mockViewMode.value = 'board';
      const { container } = renderBoard();
      const boardBtn = container.querySelector('[data-testid="view-toggle-board"]');
      expect(boardBtn!.classList.contains('view-toggle-active')).toBe(true);
      expect(boardBtn!.getAttribute('aria-pressed')).toBe('true');
    });

    it('marks List button as active when viewMode is list', () => {
      mockViewMode.value = 'list';
      const { container } = renderBoard();
      const listBtn = container.querySelector('[data-testid="view-toggle-list"]');
      expect(listBtn!.classList.contains('view-toggle-active')).toBe(true);
      expect(listBtn!.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // AC1 continued: clicking toggles call setViewMode
  describe('AC1: Toggle switching', () => {
    it('calls setViewMode("list") when List button is clicked', () => {
      mockViewMode.value = 'board';
      const { container } = renderBoard();
      const listBtn = container.querySelector('[data-testid="view-toggle-list"]') as HTMLElement;
      fireEvent.click(listBtn);
      expect(mockSetViewMode).toHaveBeenCalledWith('list');
    });

    it('calls setViewMode("board") when Board button is clicked', () => {
      mockViewMode.value = 'list';
      const { container } = renderBoard();
      const boardBtn = container.querySelector('[data-testid="view-toggle-board"]') as HTMLElement;
      fireEvent.click(boardBtn);
      expect(mockSetViewMode).toHaveBeenCalledWith('board');
    });
  });

  // AC2: List view renders when viewMode is list
  describe('AC2: List view renders when toggled', () => {
    it('renders list-view component when viewMode is list', () => {
      mockViewMode.value = 'list';
      const { container } = renderBoard();
      const listView = container.querySelector('[data-testid="list-view"]');
      expect(listView).not.toBeNull();
      // Board columns should NOT be present
      const boardColumns = container.querySelector('.board-columns');
      expect(boardColumns).toBeNull();
    });
  });

  // AC5: Board view still works on mobile when toggled back
  describe('AC5: Board view works when toggled back', () => {
    it('renders board columns when viewMode is board', () => {
      mockViewMode.value = 'board';
      const { container } = renderBoard();
      const boardColumns = container.querySelector('.board-columns');
      expect(boardColumns).not.toBeNull();
      // List view should NOT be present
      const listView = container.querySelector('[data-testid="list-view"]');
      expect(listView).toBeNull();
    });
  });
});
