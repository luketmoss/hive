import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';

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
  boardLabels: { value: [] },
  filterOwner: { value: null },
  filterLabel: { value: null },
  filterSearch: { value: '' },
  filterDue: { value: null },
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
  showDeleteBoardModal: { value: false },
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
  columnSortModes: { value: {} },
  setColumnSortMode: vi.fn(),
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
vi.mock('./delete-board-modal', () => ({
  DeleteBoardModal: () => null,
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

// ControlBar now owns view toggle (via 3-dot overflow menu)
import { ControlBar } from '../header/control-bar';

afterEach(() => {
  cleanup();
  mockItemsRef.current = [];
  mockViewMode.value = 'board';
  mockSetViewMode.mockClear();
});

beforeEach(() => {
  mockViewMode.value = 'board';
});

describe('View Toggle in 3-dot overflow menu (#154)', () => {
  it('⋯ button is rendered in ControlBar', () => {
    const { container } = render(<ControlBar />);
    const btn = container.querySelector('[data-testid="overflow-menu-btn"]');
    expect(btn).not.toBeNull();
  });

  it('clicking ⋯ reveals Board view and List view menu items', () => {
    const { container } = render(<ControlBar />);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
    const boardItem = container.querySelector('[data-testid="overflow-menu-view-board"]');
    const listItem = container.querySelector('[data-testid="overflow-menu-view-list"]');
    expect(boardItem).not.toBeNull();
    expect(listItem).not.toBeNull();
    expect(boardItem!.textContent).toBe('Board view');
    expect(listItem!.textContent).toBe('List view');
  });

  it('Board view item has aria-checked="true" when viewMode is board', () => {
    mockViewMode.value = 'board';
    const { container } = render(<ControlBar />);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
    const boardItem = container.querySelector('[data-testid="overflow-menu-view-board"]');
    expect(boardItem!.getAttribute('aria-checked')).toBe('true');
  });

  it('List view item has aria-checked="true" when viewMode is list', () => {
    mockViewMode.value = 'list';
    const { container } = render(<ControlBar />);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
    const listItem = container.querySelector('[data-testid="overflow-menu-view-list"]');
    expect(listItem!.getAttribute('aria-checked')).toBe('true');
  });

  it('calls setViewMode("list") when List view item is clicked', () => {
    mockViewMode.value = 'board';
    const { container } = render(<ControlBar />);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-list"]') as HTMLElement);
    expect(mockSetViewMode).toHaveBeenCalledWith('list');
  });

  it('calls setViewMode("board") when Board view item is clicked', () => {
    mockViewMode.value = 'list';
    const { container } = render(<ControlBar />);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-board"]') as HTMLElement);
    expect(mockSetViewMode).toHaveBeenCalledWith('board');
  });

  it('menu closes after selecting a view', () => {
    const { container } = render(<ControlBar />);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-btn"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="overflow-menu-view-list"]') as HTMLElement);
    expect(container.querySelector('[data-testid="overflow-menu-dropdown"]')).toBeNull();
  });
});
