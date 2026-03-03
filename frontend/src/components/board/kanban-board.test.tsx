import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { KanbanBoard } from './kanban-board';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

afterEach(() => {
  cleanup();
});

vi.mock('../../state/board-store', () => ({
  columns: {
    value: {
      'To Do': [],
      'In Progress': [],
      'Done': [],
    },
  },
  showCreateModal: { value: false },
  selectedItem: { value: null },
  selectedItemId: { value: null },
  groupBy: { value: 'none' },
  rootItems: { value: [] },
  owners: { value: [] },
  labels: { value: [] },
  filterOwner: { value: null },
  filterLabel: { value: null },
}));

vi.mock('../../state/actions', () => ({
  moveItem: vi.fn(),
}));

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

describe('KanbanBoard ARIA labels (Issue #7)', () => {
  // AC2: FAB has accessible label
  describe('AC2: FAB has accessible label', () => {
    it('FAB button has aria-label="Create new item"', () => {
      const { container } = renderBoard();
      const fab = container.querySelector('.fab') as HTMLElement;
      expect(fab).not.toBeNull();
      expect(fab.getAttribute('aria-label')).toBe('Create new item');
    });

    it('FAB button has title="Create new item"', () => {
      const { container } = renderBoard();
      const fab = container.querySelector('.fab') as HTMLElement;
      expect(fab.getAttribute('title')).toBe('Create new item');
    });
  });
});
