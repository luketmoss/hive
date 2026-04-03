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

  // --- AC1: Expandable sub-item titles ---
  describe('AC1: Expandable sub-item titles', () => {
    it('desktop: hover on subtask-item removes line-clamp from subtask-title', () => {
      // CSS rule: .subtask-item:hover .subtask-title should override line-clamp
      expect(css).toMatch(/\.subtask-item:hover\s+\.subtask-title\s*\{[^}]*-webkit-line-clamp:\s*unset/);
    });

    it('desktop: focus-within on subtask-item removes line-clamp from subtask-title', () => {
      expect(css).toMatch(/\.subtask-item:focus-within\s+\.subtask-title\s*\{[^}]*-webkit-line-clamp:\s*unset/);
    });

    it('desktop: subtask-title has max-height transition for smooth expand', () => {
      expect(css).toMatch(/\.subtask-title\s*\{[^}]*transition:[^}]*max-height/);
    });

    it('mobile: subtask-title has no line-clamp', () => {
      expect(mobileBlock).toContain('.subtask-title');
      expect(mobileBlock).toMatch(/\.subtask-title\s*\{[^}]*-webkit-line-clamp:\s*unset/);
    });
  });

  // --- AC2: Collapse completed sub-items ---
  describe('AC2: Collapse completed sub-items', () => {
    it('completed sub-items are hidden by default, toggle shows count', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete task', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done task', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle');
      expect(toggle).toBeTruthy();
      expect(toggle!.textContent).toContain('1');
      expect(toggle!.textContent).toContain('completed');

      // Completed item should not be visible when collapsed
      const subtaskItems = container.querySelectorAll('.subtask-item');
      // Only the incomplete one should be in the main list
      expect(subtaskItems.length).toBe(1);
    });

    it('toggle expands to show completed items', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done one', status: 'Done', sort_order: 2 }),
        makeChild({ id: 'c3', title: 'Done two', status: 'Done', sort_order: 3 }),
      ];

      const { container } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle') as HTMLElement;
      fireEvent.click(toggle);

      // After expanding, all 3 items visible
      const subtaskItems = container.querySelectorAll('.subtask-item');
      expect(subtaskItems.length).toBe(3);
    });

    it('toggle has disclosure triangle ▸ when collapsed and ▾ when expanded', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle') as HTMLElement;
      expect(toggle.textContent).toContain('▸');

      fireEvent.click(toggle);
      expect(toggle.textContent).toContain('▾');
    });

    it('when ALL sub-items are completed, toggle starts expanded', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Done one', status: 'Done', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done two', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      // All items should be visible (expanded by default)
      const subtaskItems = container.querySelectorAll('.subtask-item');
      expect(subtaskItems.length).toBe(2);

      // Toggle should show expanded state
      const toggle = container.querySelector('.subtask-completed-toggle') as HTMLElement;
      expect(toggle.textContent).toContain('▾');
    });

    it('toggle state resets when different item selected', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container, rerender } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle') as HTMLElement;
      fireEvent.click(toggle); // expand

      // Simulate selecting a new item
      mockSelectedItemId = 'parent-2';
      mockChildren = [
        makeChild({ id: 'c3', title: 'Other incomplete', status: 'To Do', sort_order: 1, parent_id: 'parent-2' }),
        makeChild({ id: 'c4', title: 'Other done', status: 'Done', sort_order: 2, parent_id: 'parent-2' }),
      ];
      rerender(
        <AuthContext.Provider value={mockAuth}>
          <CardDetail />
        </AuthContext.Provider>
      );

      // Should be collapsed again (default state)
      const items = container.querySelectorAll('.subtask-item');
      expect(items.length).toBe(1); // only incomplete
    });

    it('no toggle rendered when there are no completed sub-items', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Task A', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Task B', status: 'In Progress', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle');
      expect(toggle).toBeNull();
    });
  });

  // --- AC3: Reorder respects collapsed state ---
  describe('AC3: Reorder respects collapsed state', () => {
    it('when collapsed, reorder buttons only appear for incomplete items', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete A', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Incomplete B', status: 'To Do', sort_order: 2 }),
        makeChild({ id: 'c3', title: 'Done C', status: 'Done', sort_order: 3 }),
      ];

      const { container } = renderDetail();
      // Only 2 incomplete items visible, each with reorder buttons
      const subtaskItems = container.querySelectorAll('.subtask-item');
      expect(subtaskItems.length).toBe(2);

      // Each incomplete item should have move up/down buttons
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
    it('toggle has aria-expanded attribute', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle') as HTMLElement;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
    });

    it('toggle is activatable with Enter key', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle') as HTMLElement;
      expect(container.querySelectorAll('.subtask-item').length).toBe(1);

      fireEvent.keyDown(toggle, { key: 'Enter' });
      expect(container.querySelectorAll('.subtask-item').length).toBe(2);
    });

    it('toggle is activatable with Space key', () => {
      mockChildren = [
        makeChild({ id: 'c1', title: 'Incomplete', status: 'To Do', sort_order: 1 }),
        makeChild({ id: 'c2', title: 'Done', status: 'Done', sort_order: 2 }),
      ];

      const { container } = renderDetail();
      const toggle = container.querySelector('.subtask-completed-toggle') as HTMLElement;
      fireEvent.keyDown(toggle, { key: ' ' });
      expect(container.querySelectorAll('.subtask-item').length).toBe(2);
    });

    it('mobile: completed toggle has 44px min touch target', () => {
      expect(mobileBlock).toMatch(/\.subtask-completed-toggle\s*\{[^}]*min-height:\s*44px/);
    });
  });
});
