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
  openDetailWithTitleEdit: { value: false },
  groupBy: { value: 'none' },
  owners: { value: [] },
  labels: { value: [] },
  filterOwner: { value: null },
  filterLabel: { value: null },
  loading: { value: false },
  getChildCount: () => ({ done: 0, total: 0 }),
  viewMode: mockViewMode,
  setViewMode: mockSetViewMode,
  allDoneItems: { value: [] },
  hasArchivedItems: { value: false },
  showArchiveDialog: { value: false },
  boards: { value: [{ id: 'b1', name: 'Work' }] },
  boardItems: { get value() { return mockItemsRef.current; } },
  showCreateBoardModal: { value: false },
  showShareModal: { value: false },
  accessibleBoards: { value: [{ id: 'b1', name: 'Work', icon: '' }] },
  activeBoard: { value: { name: 'Work', color: '' } },
  activeBoardId: { value: 'b1' },
  userBoardRole: { value: null },
  permissions: { value: [] },
  currentUserEmail: { value: '' },
  switchBoard: vi.fn(),
  theme: { value: 'system' },
  applyTheme: () => {},
  cycleTheme: () => {},
  setTheme: () => {},
}));

vi.mock('../../state/actions', () => ({
  moveItem: vi.fn(),
  reorderItem: vi.fn(),
}));

vi.mock('./create-board-modal', () => ({
  CreateBoardModal: () => null,
}));

vi.mock('./share-modal', () => ({
  ShareModal: () => null,
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

vi.mock('../archive/archive-dialog', () => ({
  ArchiveDialog: () => <div data-testid="archive-dialog" />,
}));

vi.mock('../header/user-dropdown', () => ({
  UserDropdown: () => <div data-testid="user-dropdown" />,
}));

vi.mock('../shared/hive-logo', () => ({
  HiveLogo: (props: any) => <svg data-testid="hive-logo" class={props.class} />,
}));

// ControlBar includes the view toggle now — render the real ControlBar
// But we need to test the view toggle integration through KanbanBoard
// Since ControlBar now owns the view toggle, test it via ControlBar
import { ControlBar } from '../header/control-bar';

const mockAuth: AuthState = {
  token: 'test-token',
  user: { name: 'Luke', email: 'luke@example.com', picture: '' },
  isAuthenticated: true,
  login: () => {},
  logout: () => {},
  updateUserName: () => {},
};

afterEach(() => {
  cleanup();
  mockItemsRef.current = [];
  mockViewMode.value = 'board';
  mockSetViewMode.mockClear();
});

describe('View Toggle in ControlBar (Issue #132 AC2)', () => {
  it('renders Board and List toggle buttons', () => {
    const { container } = render(<ControlBar />);
    const board = container.querySelector('[data-testid="view-toggle-board"]');
    const list = container.querySelector('[data-testid="view-toggle-list"]');
    expect(board).not.toBeNull();
    expect(list).not.toBeNull();
    expect(board!.textContent).toBe('Board');
    expect(list!.textContent).toBe('List');
  });

  it('marks Board button as active when viewMode is board', () => {
    mockViewMode.value = 'board';
    const { container } = render(<ControlBar />);
    const boardBtn = container.querySelector('[data-testid="view-toggle-board"]');
    expect(boardBtn!.classList.contains('view-toggle-active')).toBe(true);
    expect(boardBtn!.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks List button as active when viewMode is list', () => {
    mockViewMode.value = 'list';
    const { container } = render(<ControlBar />);
    const listBtn = container.querySelector('[data-testid="view-toggle-list"]');
    expect(listBtn!.classList.contains('view-toggle-active')).toBe(true);
    expect(listBtn!.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls setViewMode("list") when List button is clicked', () => {
    mockViewMode.value = 'board';
    const { container } = render(<ControlBar />);
    const listBtn = container.querySelector('[data-testid="view-toggle-list"]') as HTMLElement;
    fireEvent.click(listBtn);
    expect(mockSetViewMode).toHaveBeenCalledWith('list');
  });

  it('calls setViewMode("board") when Board button is clicked', () => {
    mockViewMode.value = 'list';
    const { container } = render(<ControlBar />);
    const boardBtn = container.querySelector('[data-testid="view-toggle-board"]') as HTMLElement;
    fireEvent.click(boardBtn);
    expect(mockSetViewMode).toHaveBeenCalledWith('board');
  });
});

describe('View toggle always visible (Issue #132 AC2)', () => {
  it('view toggle is rendered inside control-bar (not hidden behind mobile breakpoint)', () => {
    const { container } = render(<ControlBar />);
    const viewToggle = container.querySelector('[data-testid="control-bar-view-toggle"]');
    expect(viewToggle).not.toBeNull();
    expect(viewToggle!.querySelector('[data-testid="view-toggle-board"]')).not.toBeNull();
    expect(viewToggle!.querySelector('[data-testid="view-toggle-list"]')).not.toBeNull();
  });
});
