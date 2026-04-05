import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { MoveToBoardModal } from './move-to-board-modal';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

afterEach(() => {
  cleanup();
});

let mockShowMoveToBoardModal = true;
let mockSelectedItemId: string | null = 'item-1';
let mockChildren: any[] = [];
let mockAccessibleBoards: any[] = [];
let mockActiveBoardId = 'board-family';

vi.mock('../../state/board-store', () => ({
  showMoveToBoardModal: {
    get value() { return mockShowMoveToBoardModal; },
    set value(v: boolean) { mockShowMoveToBoardModal = v; },
  },
  selectedItem: {
    get value() {
      if (!mockSelectedItemId) return null;
      return {
        id: mockSelectedItemId,
        title: 'Test Item',
        description: '',
        status: 'To Do',
        owner: 'Luke',
        due_date: '',
        labels: '',
        parent_id: '',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        completed_at: '',
        sort_order: 1,
        created_by: 'luke@example.com',
        board_id: 'board-family',
        sheetRow: 2,
      };
    },
  },
  childrenOfSelected: {
    get value() { return mockChildren; },
  },
  accessibleBoards: {
    get value() { return mockAccessibleBoards; },
  },
  activeBoardId: {
    get value() { return mockActiveBoardId; },
  },
}));

const mockMoveItemToBoard = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  moveItemToBoard: (...args: any[]) => mockMoveItemToBoard(...args),
}));

const mockAuth: AuthState = {
  token: 'test-token',
  user: { name: 'Luke', email: 'luke@example.com', picture: '' },
  isAuthenticated: true,
  isAuthLoading: false,
  login: () => {},
  logout: () => {},
  updateUserName: () => {},
};

function renderModal() {
  return render(
    <AuthContext.Provider value={mockAuth}>
      <MoveToBoardModal />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  mockShowMoveToBoardModal = true;
  mockSelectedItemId = 'item-1';
  mockChildren = [];
  mockAccessibleBoards = [
    { id: 'board-family', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
    { id: 'board-work', name: 'Work Projects', created_at: '', created_by: '', color: '#1976d2', icon: '' },
  ];
  mockActiveBoardId = 'board-family';
  mockMoveItemToBoard.mockReset().mockResolvedValue(true);
});

describe('MoveToBoardModal', () => {
  // AC5: Shows other boards, excludes current
  it('shows radio options for other accessible boards, excluding current', () => {
    const { container } = renderModal();
    const radios = container.querySelectorAll('input[name="target-board"]');
    expect(radios).toHaveLength(1);
    const label = radios[0].closest('label');
    expect(label?.textContent).toContain('Work Projects');
  });

  // AC5: No board pre-selected; confirm disabled until one is chosen
  it('has Move button disabled until a board is selected', () => {
    const { container } = renderModal();
    const moveBtn = container.querySelector('[data-testid="confirm-move-board"]') as HTMLButtonElement;
    expect(moveBtn.disabled).toBe(true);
  });

  // AC1: Selecting a board and clicking Move calls moveItemToBoard
  it('calls moveItemToBoard when a board is selected and Move is clicked', async () => {
    const { container } = renderModal();

    // Select the target board
    const radio = container.querySelector('input[value="board-work"]') as HTMLInputElement;
    fireEvent.click(radio);

    const moveBtn = container.querySelector('[data-testid="confirm-move-board"]') as HTMLButtonElement;
    expect(moveBtn.disabled).toBe(false);
    fireEvent.click(moveBtn);

    // Wait for async handler
    await new Promise(r => setTimeout(r, 0));
    expect(mockMoveItemToBoard).toHaveBeenCalledWith('item-1', 'board-work', 'Luke', 'test-token');
  });

  // AC2: Cancel closes modal without moving
  it('closes modal on Cancel without calling moveItemToBoard', () => {
    const { container } = renderModal();
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Cancel');
    expect(cancelBtn).not.toBeUndefined();
    fireEvent.click(cancelBtn!);
    expect(mockShowMoveToBoardModal).toBe(false);
    expect(mockMoveItemToBoard).not.toHaveBeenCalled();
  });

  // AC2: Clicking overlay backdrop closes modal
  it('closes modal on overlay click', () => {
    const { container } = renderModal();
    const overlay = container.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(mockShowMoveToBoardModal).toBe(false);
    expect(mockMoveItemToBoard).not.toHaveBeenCalled();
  });

  // AC3: Subtask warning shown when subtasks exist and board is selected
  it('shows subtask count warning when subtasks exist and board is selected', () => {
    mockChildren = [
      { id: 'child-1', title: 'Sub 1', status: 'To Do', parent_id: 'item-1', sort_order: 1 },
      { id: 'child-2', title: 'Sub 2', status: 'To Do', parent_id: 'item-1', sort_order: 2 },
    ];

    const { container } = renderModal();
    const radio = container.querySelector('input[value="board-work"]') as HTMLInputElement;
    fireEvent.click(radio);

    const warning = container.querySelector('.move-subtask-warning');
    expect(warning).not.toBeNull();
    expect(warning!.textContent).toBe('2 sub-tasks will also move.');
  });

  // AC3: Singular form for 1 subtask
  it('shows singular form for 1 subtask', () => {
    mockChildren = [
      { id: 'child-1', title: 'Sub 1', status: 'To Do', parent_id: 'item-1', sort_order: 1 },
    ];

    const { container } = renderModal();
    const radio = container.querySelector('input[value="board-work"]') as HTMLInputElement;
    fireEvent.click(radio);

    const warning = container.querySelector('.move-subtask-warning');
    expect(warning!.textContent).toBe('1 sub-task will also move.');
  });

  // AC3: No warning when no subtasks
  it('does not show subtask warning when item has no subtasks', () => {
    mockChildren = [];

    const { container } = renderModal();
    const radio = container.querySelector('input[value="board-work"]') as HTMLInputElement;
    fireEvent.click(radio);

    const warning = container.querySelector('.move-subtask-warning');
    expect(warning).toBeNull();
  });

  // Accessibility: dialog role and label
  it('has dialog role and aria-modal', () => {
    const { container } = renderModal();
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-label')).toBe('Move to board');
  });

  // AC5: Multiple other boards shown
  it('shows multiple other boards when user has access to 3+', () => {
    mockAccessibleBoards = [
      { id: 'board-family', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
      { id: 'board-work', name: 'Work Projects', created_at: '', created_by: '', color: '', icon: '' },
      { id: 'board-fun', name: 'Fun Board', created_at: '', created_by: '', color: '', icon: '' },
    ];

    const { container } = renderModal();
    const radios = container.querySelectorAll('input[name="target-board"]');
    expect(radios).toHaveLength(2); // work + fun, excluding current (family)
  });
});
