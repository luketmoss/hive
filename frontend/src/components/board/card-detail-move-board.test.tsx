import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { CardDetail } from './card-detail';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

afterEach(() => {
  cleanup();
});

let mockSelectedItemId: string | null = 'move-test-1';
let mockChildren: any[] = [];
let mockItems: any[] = [];
let mockAccessibleBoards: any[] = [];
let mockActiveBoardId = 'board-family';

// Track what item the mock returns based on selectedItemId
let mockSelectedItemOverrides: Record<string, any> = {};

vi.mock('../../state/board-store', () => ({
  selectedItemId: {
    get value() { return mockSelectedItemId; },
    set value(v: string | null) { mockSelectedItemId = v; },
  },
  openDetailWithTitleEdit: { value: false },
  selectedItem: {
    get value() {
      if (!mockSelectedItemId) return null;
      return {
        id: mockSelectedItemId,
        title: 'Test Item',
        description: 'A test description',
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
        ...mockSelectedItemOverrides,
      };
    },
  },
  childrenOfSelected: {
    get value() { return mockChildren; },
  },
  items: {
    get value() { return mockItems; },
  },
  owners: { value: [{ name: 'Luke', google_account: 'luke@example.com' }] },
  labels: { value: [] },
  showToast: vi.fn(),
  accessibleBoards: {
    get value() { return mockAccessibleBoards; },
  },
  activeBoardId: {
    get value() { return mockActiveBoardId; },
  },
}));

const mockMoveItemToBoard = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  updateItem: vi.fn().mockResolvedValue(true),
  deleteItem: vi.fn(),
  deleteSubtask: vi.fn(),
  createItem: vi.fn(),
  moveItem: vi.fn().mockResolvedValue(true),
  reorderSubtasks: vi.fn(),
  moveItemToBoard: (...args: any[]) => mockMoveItemToBoard(...args),
}));

const mockAuth: AuthState = {
  token: 'test-token',
  user: { name: 'Luke', email: 'luke@example.com', picture: '' },
  isAuthenticated: true,
  login: () => {},
  logout: () => {},
  updateUserName: () => {},
};

function renderCardDetail() {
  return render(
    <AuthContext.Provider value={mockAuth}>
      <CardDetail />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  mockSelectedItemId = 'move-test-1';
  mockChildren = [];
  mockItems = [];
  mockSelectedItemOverrides = {};
  mockAccessibleBoards = [
    { id: 'board-family', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '👨‍👩‍👧' },
    { id: 'board-work', name: 'Work Projects', created_at: '', created_by: '', color: '#1976d2', icon: '🏢' },
  ];
  mockActiveBoardId = 'board-family';
  mockMoveItemToBoard.mockReset().mockResolvedValue(true);
});

describe('Move to Board — CardDetail UI', () => {
  // AC5: Move target list excludes current board
  it('shows dropdown with other accessible boards, excluding current board', () => {
    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]') as HTMLSelectElement;

    expect(select).not.toBeNull();
    const options = Array.from(select.options);
    // Default disabled placeholder + Work Projects = 2 options
    expect(options).toHaveLength(2);
    expect(options[0].text).toBe('— Move to board —');
    expect(options[0].disabled).toBe(true);
    expect(options[1].text).toContain('Work Projects');
  });

  // AC2: No action on select alone (Move button must be clicked)
  it('does not call moveItemToBoard when only selecting a board', () => {
    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: 'board-work' } });

    expect(mockMoveItemToBoard).not.toHaveBeenCalled();
  });

  // AC2: Move button appears after selecting a board
  it('shows Move button only after selecting a target board', () => {
    const { container } = renderCardDetail();

    // Initially no Move button
    let moveBtn = container.querySelector('.move-to-board-row button');
    expect(moveBtn).toBeNull();

    // Select a target
    const select = container.querySelector('[aria-label="Move to board"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'board-work' } });

    moveBtn = container.querySelector('.move-to-board-row button');
    expect(moveBtn).not.toBeNull();
    expect(moveBtn!.textContent).toBe('Move');
  });

  // AC1: Clicking Move calls moveItemToBoard
  it('calls moveItemToBoard when Move button is clicked', async () => {
    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'board-work' } });

    const moveBtn = container.querySelector('.move-to-board-row button') as HTMLButtonElement;
    fireEvent.click(moveBtn);

    expect(mockMoveItemToBoard).toHaveBeenCalledWith('move-test-1', 'board-work', 'Luke', 'test-token');
  });

  // AC3: Subtask count hint shown when target selected and item has subtasks
  it('shows subtask count hint when target selected and item has subtasks', () => {
    mockChildren = [
      { id: 'child-1', title: 'Sub 1', status: 'To Do', parent_id: 'move-test-1', sort_order: 1 },
      { id: 'child-2', title: 'Sub 2', status: 'To Do', parent_id: 'move-test-1', sort_order: 2 },
    ];

    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'board-work' } });

    const hint = container.querySelector('.move-subtask-hint');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toBe('2 sub-tasks will also move.');
  });

  // AC3: Singular form for 1 subtask
  it('shows singular form for 1 subtask', () => {
    mockChildren = [
      { id: 'child-1', title: 'Sub 1', status: 'To Do', parent_id: 'move-test-1', sort_order: 1 },
    ];

    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'board-work' } });

    const hint = container.querySelector('.move-subtask-hint');
    expect(hint!.textContent).toBe('1 sub-task will also move.');
  });

  // AC3: No hint when no subtasks
  it('does not show subtask hint when item has no subtasks', () => {
    mockChildren = [];

    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'board-work' } });

    const hint = container.querySelector('.move-subtask-hint');
    expect(hint).toBeNull();
  });

  // AC6: Hidden for subtasks
  it('hides Move to Board for subtask items', () => {
    mockSelectedItemOverrides = { parent_id: 'some-parent' };

    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]');
    expect(select).toBeNull();
  });

  // AC7: Hidden when user has only one accessible board
  it('hides Move to Board when only one accessible board', () => {
    mockAccessibleBoards = [
      { id: 'board-family', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
    ];

    const { container } = renderCardDetail();
    const select = container.querySelector('[aria-label="Move to board"]');
    expect(select).toBeNull();
  });
});
