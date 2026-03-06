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
        scheduled_date: '',
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
    get value() {
      return [
        {
          id: 'child-1',
          title: 'Buy milk',
          description: '',
          status: 'To Do',
          owner: '',
          due_date: '',
          scheduled_date: '',
          labels: '',
          parent_id: mockSelectedItemId,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          completed_at: '',
          sort_order: 1,
          created_by: 'luke@example.com',
          sheetRow: 3,
        },
        {
          id: 'child-2',
          title: 'Buy bread',
          description: '',
          status: 'Done',
          owner: 'Luke',
          due_date: '',
          scheduled_date: '',
          labels: '',
          parent_id: mockSelectedItemId,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          completed_at: '2026-01-02T00:00:00Z',
          sort_order: 2,
          created_by: 'luke@example.com',
          sheetRow: 4,
        },
      ];
    },
  },
  items: { value: [] },
  owners: { value: [{ name: 'Luke', google_account: 'luke@example.com' }] },
  labels: { value: [] },
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
      const closeBtn = container.querySelector('.detail-header .btn-ghost') as HTMLElement;
      expect(closeBtn).not.toBeNull();
      expect(closeBtn.getAttribute('aria-label')).toBe('Close');
    });
  });

  // AC5: Subtask checkboxes have accessible labels
  describe('AC5: Subtask checkboxes have accessible labels', () => {
    it('each subtask checkbox has aria-label matching the subtask title', () => {
      const { container } = renderCardDetail();
      const checkboxes = container.querySelectorAll('.subtask-list input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
      expect((checkboxes[0] as HTMLInputElement).getAttribute('aria-label')).toBe('Buy milk');
      expect((checkboxes[1] as HTMLInputElement).getAttribute('aria-label')).toBe('Buy bread');
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
