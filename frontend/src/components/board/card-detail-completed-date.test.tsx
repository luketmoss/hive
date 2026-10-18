import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor, act } from '@testing-library/preact';
import { CardDetail } from './card-detail';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';
import { showToast } from '../../state/board-store';

afterEach(() => {
  cleanup();
});

// Track selectedItemId state for assertions
let mockSelectedItemId: string | null = 'detail-test-1';
let mockChildren: any[] = [];
let mockItems: any[] = [];
let mockItemOverrides: Record<string, any> = {};

vi.mock('../../state/board-store', () => ({
  selectedItemId: {
    get value() { return mockSelectedItemId; },
    set value(v: string | null) { mockSelectedItemId = v; },
  },
  selectItem: (id: string) => { mockSelectedItemId = id; },
  clearSelectedItem: () => { mockSelectedItemId = null; },
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
        sheetRow: 2,
        ...mockItemOverrides,
      };
    },
  },
  childrenOfSelected: {
    get value() { return mockChildren; },
  },
  items: {
    get value() { return mockItems; },
  },
  owners: { value: [{ name: 'Luke', google_account: 'luke@example.com' }, { name: 'Sarah', google_account: 'sarah@example.com' }] },
  labels: { value: [{ label: 'Urgent', color: '#ff0000' }] },
  boardLabels: { value: [{ label: 'Urgent', color: '#ff0000' }] },
  showToast: vi.fn(),
  accessibleBoards: { value: [] },
  activeBoardId: { value: 'board-1' },
  showMoveToBoardModal: { value: false },
  boardStatuses: { value: [
    { id: 's1', board_id: 'board-1', name: 'To Do', sort_order: 1, color: '#e3f2fd', is_terminal: false, created_at: '' },
    { id: 's2', board_id: 'board-1', name: 'In Progress', sort_order: 2, color: '#fff3e0', is_terminal: false, created_at: '' },
    { id: 's3', board_id: 'board-1', name: 'Done', sort_order: 3, color: '#e8f5e9', is_terminal: true, created_at: '' },
  ] },
  isTerminalStatus: (name: string) => name === 'Done',
  defaultStatusName: () => 'To Do',
  terminalStatusName: () => 'Done',
}));

const mockUpdateItem = vi.fn().mockResolvedValue(true);
const mockMoveItem = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  updateItem: (...args: any[]) => mockUpdateItem(...args),
  deleteItem: vi.fn(),
  deleteSubtask: vi.fn(),
  createItem: vi.fn(),
  moveItem: (...args: any[]) => mockMoveItem(...args),
  reorderSubtasks: vi.fn(),
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

function renderCardDetail() {
  return render(
    <AuthContext.Provider value={mockAuth}>
      <CardDetail />
    </AuthContext.Provider>
  );
}


function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}
function ymd(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('CardDetail completed date (#280)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
    mockChildren = [];
    mockItems = [];
    mockItemOverrides = {};
    mockUpdateItem.mockReset().mockResolvedValue(true);
    (showToast as any).mockReset();
  });

  it('AC1: shows the button for a terminal item and drops the footer line', () => {
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(3) };
    const { container } = renderCardDetail();
    const btn = container.querySelector('[data-testid="completed-date-btn"]') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Completed');
    expect(btn.textContent).toContain('3 days ago');
    expect(btn.getAttribute('aria-label')).toMatch(/^Completed .*\d{4}\. Change completed date$/);
    expect(container.querySelector('.detail-meta')!.textContent).not.toContain('Completed:');
  });

  it('AC1: no field for a non-terminal item', () => {
    mockItemOverrides = { status: 'To Do', completed_at: '' };
    const { container } = renderCardDetail();
    expect(container.querySelector('[data-testid="completed-date-btn"]')).toBeNull();
  });

  it('AC6: hidden input is not a tab stop and is aria-hidden', () => {
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(1) };
    const { container } = renderCardDetail();
    const input = container.querySelector('[data-testid="completed-date-input"]') as HTMLInputElement;
    expect(input.getAttribute('tabindex')).toBe('-1');
    expect(input.getAttribute('aria-hidden')).toBe('true');
    expect(input.max).toBe(ymd(new Date().toISOString()));
  });

  it('AC2: saves an ISO timestamp on the picked local date, keeping time of day', async () => {
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(1) };
    const { container } = renderCardDetail();
    const input = container.querySelector('[data-testid="completed-date-input"]') as HTMLInputElement;
    const picked = ymd(daysAgoIso(4));
    await act(async () => { fireEvent.change(input, { target: { value: picked } }); });
    expect(mockUpdateItem).toHaveBeenCalledTimes(1);
    const [id, changes] = mockUpdateItem.mock.calls[0];
    expect(id).toBe('detail-test-1');
    expect(changes.completed_at).toMatch(/Z$/);
    expect(ymd(changes.completed_at)).toBe(picked);
    expect(new Date(changes.completed_at).getHours()).toBe(18);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="save-indicator"]')!.textContent).toBe('Saved');
    });
  });

  it('AC2: picking the same date writes nothing', async () => {
    const prev = daysAgoIso(2);
    mockItemOverrides = { status: 'Done', completed_at: prev };
    const { container } = renderCardDetail();
    const input = container.querySelector('[data-testid="completed-date-input"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: ymd(prev) } }); });
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('AC3: future date writes nothing and shows the error text', async () => {
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(2) };
    const { container } = renderCardDetail();
    const input = container.querySelector('[data-testid="completed-date-input"]') as HTMLInputElement;
    const t = new Date();
    t.setDate(t.getDate() + 3);
    await act(async () => { fireEvent.change(input, { target: { value: ymd(t.toISOString()) } }); });
    expect(mockUpdateItem).not.toHaveBeenCalled();
    const err = container.querySelector('[data-testid="save-indicator-error"]')!;
    expect(err.textContent).toBe("Completed date can't be in the future");
    expect(err.className).toContain('save-indicator-error');
  });

  it('AC3: empty value reverts silently', async () => {
    const prev = daysAgoIso(2);
    mockItemOverrides = { status: 'Done', completed_at: prev };
    const { container } = renderCardDetail();
    const input = container.querySelector('[data-testid="completed-date-input"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: '' } }); });
    expect(mockUpdateItem).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="save-indicator-error"]')).toBeNull();
    expect(input.value).toBe(ymd(prev));
  });

  it('AC3: a date before created_at is accepted', async () => {
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(1), created_at: daysAgoIso(1) };
    const { container } = renderCardDetail();
    const input = container.querySelector('[data-testid="completed-date-input"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: ymd(daysAgoIso(3)) } }); });
    expect(mockUpdateItem).toHaveBeenCalledTimes(1);
  });

  it('AC4: toasts when the edit moves the item past the 7-day window', async () => {
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(1), title: 'Pantry' };
    const { container } = renderCardDetail();
    const input = container.querySelector('[data-testid="completed-date-input"]') as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: ymd(daysAgoIso(12)) } }); });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Pantry moved to the archive', 'success'));
  });

  it('AC4: no toast when staying inside the window or restoring from the archive', async () => {
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(1) };
    const first = renderCardDetail();
    await act(async () => {
      fireEvent.change(first.container.querySelector('[data-testid="completed-date-input"]')!, { target: { value: ymd(daysAgoIso(4)) } });
    });
    first.unmount();
    mockItemOverrides = { status: 'Done', completed_at: daysAgoIso(20) };
    const second = renderCardDetail();
    await act(async () => {
      fireEvent.change(second.container.querySelector('[data-testid="completed-date-input"]')!, { target: { value: ymd(daysAgoIso(2)) } });
    });
    await waitFor(() => expect(mockUpdateItem).toHaveBeenCalledTimes(2));
    await new Promise(r => setTimeout(r, 20));
    expect(showToast).not.toHaveBeenCalled();
  });
});
