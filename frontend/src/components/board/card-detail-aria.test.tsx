import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { CardDetail } from './card-detail';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

afterEach(() => {
  cleanup();
});

let mockSelectedItemId: string | null = 'aria-test-1';

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
        board_id: '',
        sheetRow: 2,
      };
    },
  },
  childrenOfSelected: {
    get value() {
      return [
        {
          id: 'child-1',
          title: 'Buy milk',
          description: '',
          status: 'To Do',
          owner: '',
          due_date: '',
          labels: '',
          parent_id: mockSelectedItemId,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          completed_at: '',
          sort_order: 1,
          created_by: 'luke@example.com',
          board_id: '',
          sheetRow: 3,
        },
        {
          id: 'child-2',
          title: 'Buy bread',
          description: '',
          status: 'Done',
          owner: 'Luke',
          due_date: '',
          labels: '',
          parent_id: mockSelectedItemId,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          completed_at: '2026-01-02T00:00:00Z',
          sort_order: 2,
          created_by: 'luke@example.com',
          board_id: '',
          sheetRow: 4,
        },
      ];
    },
  },
  items: { value: [] },
  owners: { value: [{ name: 'Luke', google_account: 'luke@example.com' }] },
  labels: { value: [] },
  boardLabels: { value: [] },
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
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  createItem: vi.fn(),
  moveItem: vi.fn(),
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

describe('CardDetail ARIA labels (Issue #7)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'aria-test-1';
  });

  // AC3: Detail panel close button has accessible label
  describe('AC3: Close button has accessible label', () => {
    it('close button has aria-label="Close"', () => {
      const { container } = renderCardDetail();
      const closeBtn = container.querySelector('.detail-header [aria-label="Close"]') as HTMLElement;
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.getAttribute('aria-label')).toBe('Close');
    });
  });

  // AC5: Subtask checkboxes have accessible labels
  describe('AC5: Subtask checkboxes have accessible labels', () => {
    it('each subtask check button has aria-label matching the subtask title', () => {
      const { container } = renderCardDetail();
      // #220: Flat list — all items always visible (incomplete first, then divider, then done)
      const checkBtns = container.querySelectorAll('.subtask-list .check-icon');
      expect(checkBtns.length).toBe(2);
      expect((checkBtns[0] as HTMLElement).getAttribute('aria-label')).toBe('Buy milk');
      expect((checkBtns[1] as HTMLElement).getAttribute('aria-label')).toBe('Buy bread');
    });
  });

  // AC6: Editable fields have accessible roles
  describe('AC6: Editable fields have accessible roles', () => {
    it('title editable field has role="button" and aria-label="Edit title"', () => {
      const { container } = renderCardDetail();
      const editableValues = container.querySelectorAll('.editable-value');
      // First editable field is Title
      const titleField = editableValues[0] as HTMLElement;
      expect(titleField.getAttribute('role')).toBe('button');
      expect(titleField.getAttribute('aria-label')).toBe('Edit title');
    });

    it('description editable field has role="button" and aria-label="Edit description"', () => {
      const { container } = renderCardDetail();
      const editableValues = container.querySelectorAll('.editable-value');
      // Second editable field is Description
      const descField = editableValues[1] as HTMLElement;
      expect(descField.getAttribute('role')).toBe('button');
      expect(descField.getAttribute('aria-label')).toBe('Edit description');
    });

    it('editable fields have tabIndex=0 for keyboard access', () => {
      const { container } = renderCardDetail();
      const editableValues = container.querySelectorAll('.editable-value');
      expect((editableValues[0] as HTMLElement).getAttribute('tabindex')).toBe('0');
      expect((editableValues[1] as HTMLElement).getAttribute('tabindex')).toBe('0');
    });

    it('pressing Enter on editable field activates edit mode', () => {
      const { container } = renderCardDetail();
      const titleField = container.querySelector('.editable-value') as HTMLElement;
      expect(titleField.getAttribute('role')).toBe('button');

      // Press Enter to activate
      fireEvent.keyDown(titleField, { key: 'Enter' });

      // After activation, the editable-value should be replaced with an input
      const input = container.querySelector('.detail-field input[type="text"]') as HTMLInputElement;
      expect(input).not.toBeNull();
    });

    it('pressing Space on editable field activates edit mode', () => {
      const { container } = renderCardDetail();
      const titleField = container.querySelector('.editable-value') as HTMLElement;

      // Press Space to activate
      fireEvent.keyDown(titleField, { key: ' ' });

      // After activation, the editable-value should be replaced with an input
      const input = container.querySelector('.detail-field input[type="text"]') as HTMLInputElement;
      expect(input).not.toBeNull();
    });
  });

  // #242: focus must enter the dialog even when its first focusable child is
  // hidden, and must be restored to the card that opened it on close.
  describe('Focus management (#242)', () => {
    let card: HTMLElement;

    beforeEach(() => {
      // jsdom has no layout, so the hook sees every element as unrendered.
      // Simulate a viewport ≤768px, where global.css hides the #206 expand
      // button, by giving that one button zero boxes and everything else a box.
      const visible = (el: HTMLElement) => !el.classList.contains('detail-expand-btn');
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return visible(this) ? 100 : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return visible(this) ? 40 : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
        return (visible(this) ? [{ width: 100, height: 40 }] : []) as unknown as DOMRectList;
      });

      // A Kanban card, as rendered by card.tsx — not natively focusable
      card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-item-id', 'aria-test-1');
      document.body.appendChild(card);
      (document.activeElement as HTMLElement | null)?.blur?.();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      card.remove();
    });

    // AC1 + AC2: focus enters the dialog, so the container's Escape handler is reachable
    it('focuses the first rendered control, skipping the hidden expand button', () => {
      const { container } = renderCardDetail();
      const expandBtn = container.querySelector('.detail-expand-btn') as HTMLElement;
      const closeBtn = container.querySelector('.detail-header [aria-label="Close"]') as HTMLElement;

      expect(document.activeElement).not.toBe(expandBtn);
      expect(document.activeElement).toBe(closeBtn);
      expect(container.querySelector('.detail-overlay')!.contains(document.activeElement)).toBe(true);
    });

    // AC3: focus returns to the card, not to document.body
    it('restores focus to the card that opened the detail', () => {
      const { unmount } = renderCardDetail();
      expect(document.activeElement).not.toBe(document.body);

      unmount();

      expect(document.activeElement).toBe(card);
      // #6 stays out of scope: the card is a programmatic target, not a tab stop
      expect(card.getAttribute('tabindex')).toBe('-1');
    });

    // AC4: no card in the DOM at all — the cold deep-link arrival of #240
    it('falls back to the board when the opening card is not present', () => {
      card.remove();
      const boardMain = document.createElement('main');
      boardMain.className = 'board-main';
      document.body.appendChild(boardMain);

      const { unmount } = renderCardDetail();
      unmount();

      expect(document.activeElement).toBe(boardMain);
      expect(document.activeElement).not.toBe(document.body);

      boardMain.remove();
    });
  });

  // Dialog role (already existed, verify it's still present)
  describe('Dialog role and aria-modal', () => {
    it('detail overlay has role="dialog" and aria-modal="true"', () => {
      const { container } = renderCardDetail();
      const overlay = container.querySelector('.detail-overlay') as HTMLElement;
      expect(overlay.getAttribute('role')).toBe('dialog');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
      expect(overlay.getAttribute('aria-label')).toBe('Item Details');
    });
  });
});
