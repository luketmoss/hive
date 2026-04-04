import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { CardDetail } from './card-detail';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

// @ts-ignore -- Node builtins available in vitest
import { readFileSync } from 'fs';
// @ts-ignore
import { resolve } from 'path';

afterEach(() => {
  cleanup();
});

// --- Mock state ---
let mockSelectedItemId: string | null = 'parent-1';
let mockChildren: any[] = [];
let mockItems: any[] = [];

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
        title: 'Parent Task',
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
        sheetRow: 2,
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
  boardLabels: { value: [] },
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

vi.mock('../../state/actions', () => ({
  updateItem: vi.fn().mockResolvedValue(true),
  deleteItem: vi.fn(),
  deleteSubtask: vi.fn(),
  createItem: vi.fn(),
  moveItem: vi.fn().mockResolvedValue(true),
  reorderSubtasks: vi.fn(),
}));

const mockAuth: AuthState = {
  token: 'test-token',
  user: { name: 'Luke', email: 'luke@example.com', picture: '' },
  isAuthenticated: true,
  login: () => {},
  logout: () => {},
  updateUserName: () => {},
};

function renderDetail() {
  return render(
    <AuthContext.Provider value={mockAuth}>
      <CardDetail />
    </AuthContext.Provider>
  );
}

function makeChild(overrides: Record<string, any> = {}) {
  return {
    id: 'child-1',
    title: 'Sub-task one',
    description: '',
    status: 'To Do' as const,
    owner: 'Luke',
    due_date: '',
    labels: '',
    parent_id: 'parent-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    completed_at: '',
    sort_order: 1,
    created_by: 'luke@example.com',
    board_id: '',
    sheetRow: 3,
    ...overrides,
  };
}

// --- CSS tests (AC1 desktop + mobile, AC5 mobile) ---

// @ts-ignore
const cssPath = resolve(__dirname, '../../global.css');
const css = readFileSync(cssPath, 'utf-8');

function extractMobileBlock(source: string): string {
  const re = /@media\s*\(\s*max-width:\s*768px\s*\)\s*\{/g;
  const match = re.exec(source);
  if (!match) return '';
  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

const mobileBlock = extractMobileBlock(css);

describe('Issue #204: Sub-item display improvements', () => {
  beforeEach(() => {
    mockSelectedItemId = 'parent-1';
    mockChildren = [];
    mockItems = [];
  });

  // --- AC1: Subtask title display ---
  describe('AC1: Subtask title display', () => {
    it('desktop: subtask-title is a clickable span with role=button', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Buy groceries', status: 'To Do', sort_order: 1 }),
      ];
      const { container } = renderDetail();
      const title = container.querySelector('.subtask-title');
      expect(title).not.toBeNull();
      expect(title!.getAttribute('role')).toBe('button');
    });

    it('desktop: subtask-title has cursor pointer CSS', () => {
      expect(css).toMatch(/\.subtask-title\s*\{[^}]*cursor:\s*pointer/);
    });

    it('desktop: subtask-item hover shows actions', () => {
      expect(css).toMatch(/\.subtask-item:hover\s+\.subtask-actions[^{]*\{/);
    });

    it('subtask-title cursor pointer style is in CSS', () => {
      expect(css).toMatch(/\.subtask-title\s*\{[^}]*cursor:\s*pointer/);
    });
  });

  // --- AC2: Flat list with divider between incomplete and done items ---
  describe('AC2: Flat list with divider separator', () => {
    it('all items are always visible — incomplete first, then done', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete task', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done task', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      // Both items always visible
      const subtaskItems = container.querySelectorAll('.subtask-item');
      expect(subtaskItems.length).toBe(2);
    });

    it('shows a .subtask-divider between incomplete and done items', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done one', status: 'Done', sort_order: 2 }),
        makeChild({ id: 'c3', title: 'Done two', status: 'Done', sort_order: 3 }),
      ];

      const { container } = renderDetail();
      const divider = container.querySelector('.subtask-divider');
      expect(divider).not.toBeNull();
      // All 3 items visible
      const subtaskItems = container.querySelectorAll('.subtask-item');
      expect(subtaskItems.length).toBe(3);
    });

    it('divider has "completed" label text', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const divider = container.querySelector('.subtask-divider');
      expect(divider).not.toBeNull();
      expect(divider!.textContent).toContain('completed');
    });

    it('when ALL sub-items are completed, all items are still visible', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Done one', status: 'Done', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done two', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const subtaskItems = container.querySelectorAll('.subtask-item');
      expect(subtaskItems.length).toBe(2);
    });

    it('no divider rendered when there are no completed sub-items', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Task A', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Task B', status: 'In Progress', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const divider = container.querySelector('.subtask-divider');
      expect(divider).toBeNull();
    });

    it('divider appears whenever there are done sub-items (even if all are done)', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Done A', status: 'Done', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done B', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      // Divider always shows when there are done items
      const divider = container.querySelector('.subtask-divider');
      expect(divider).not.toBeNull();
    });
  });

  // --- AC3: Reorder only for incomplete items ---
  describe('AC3: Reorder buttons only appear for incomplete items', () => {
    it('reorder buttons only appear for incomplete items, not done items', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete A', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Incomplete B', status: 'To Do', sort_order: 2 }),
        makeChild({ id: 'c3', title: 'Done C', status: 'Done', sort_order: 3 }),
      ];

      const { container } = renderDetail();
      // All 3 items visible (flat list)
      const subtaskItems = container.querySelectorAll('.subtask-item');
      expect(subtaskItems.length).toBe(3);

      // Reorder buttons only for incomplete items (2 items)
      const moveUpBtns = container.querySelectorAll('.subtask-action-btn[aria-label="Move up"]');
      const moveDownBtns = container.querySelectorAll('.subtask-action-btn[aria-label="Move down"]');
      expect(moveUpBtns.length).toBe(2);
      expect(moveDownBtns.length).toBe(2);
    });
  });

  // --- AC4: Progress summary in header ---
  describe('AC4: Progress summary in header', () => {
    it('header shows done/total format', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Task A', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Task B', status: 'Done', sort_order: 2 }),
        makeChild({ id: 'c3', title: 'Task C', status: 'Done', sort_order: 3 }),
      ];

      const { container } = renderDetail();
      const header = container.querySelector('.detail-subtasks-header label');
      expect(header!.textContent).toContain('2/3');
    });

    it('header shows 0/N when no items completed', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Task A', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Task B', status: 'To Do', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const header = container.querySelector('.detail-subtasks-header label');
      expect(header!.textContent).toContain('0/2');
    });
  });

  // --- AC5: Keyboard and screen reader support ---
  describe('AC5: Keyboard and screen reader support', () => {
    it('check-icon button is accessible for toggling subtask status', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      // Both items always visible
      const checkBtns = container.querySelectorAll('.check-icon');
      expect(checkBtns.length).toBe(2);
      // Each has aria-label matching the subtask title
      expect((checkBtns[0] as HTMLElement).getAttribute('aria-label')).toBe('Incomplete');
      expect((checkBtns[1] as HTMLElement).getAttribute('aria-label')).toBe('Done');
    });

    it('subtask-divider has aria-hidden to avoid redundant screen reader announcement', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const divider = container.querySelector('.subtask-divider') as HTMLElement;
      expect(divider).not.toBeNull();
      expect(divider.getAttribute('aria-hidden')).toBe('true');
    });

    it('subtask-item has min-height for touch targets', () => {
      expect(css).toMatch(/\.subtask-item\s*\{[^}]*min-height:/);
    });
  });
});
