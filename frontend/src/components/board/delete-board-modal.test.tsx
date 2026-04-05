import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { DeleteBoardModal } from './delete-board-modal';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

// Mutable mock state
const mockBoardId = { current: 'board-1' };
const mockItems = { current: [] as any[] };
const mockBoards = { current: [
  { id: 'board-1', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
  { id: 'board-2', name: 'Work Board', created_at: '', created_by: '', color: '', icon: '' },
] };
const mockPerms = { current: [
  { board_id: 'board-1', user_email: 'owner@family.com', role: 'owner' },
  { board_id: 'board-2', user_email: 'owner@family.com', role: 'owner' },
] };
const mockShowDeleteBoardModal = { current: true };

vi.mock('../../state/board-store', () => ({
  showDeleteBoardModal: {
    get value() { return mockShowDeleteBoardModal.current; },
    set value(v: boolean) { mockShowDeleteBoardModal.current = v; },
  },
  activeBoard: { get value() { return mockBoards.current.find(b => b.id === mockBoardId.current) || null; } },
  activeBoardId: { get value() { return mockBoardId.current; } },
  boards: { get value() { return mockBoards.current; }, set value(v: any) { mockBoards.current = v; } },
  items: { get value() { return mockItems.current; }, set value(v: any) { mockItems.current = v; } },
  permissions: { get value() { return mockPerms.current; }, set value(v: any) { mockPerms.current = v; } },
  accessibleBoards: { get value() { return mockBoards.current; } },
  currentUserEmail: { value: 'owner@family.com' },
  userBoardRole: { get value() { return 'owner'; } },
  openDetailWithTitleEdit: { value: false },
}));

const mockDeleteBoard = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  deleteBoard: (...args: any[]) => mockDeleteBoard(...args),
}));

vi.mock('../../hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

const mockAuth: AuthState = {
  token: 'test-token',
  user: { email: 'owner@family.com', name: 'Owner', picture: '' },
  isAuthenticated: true,
  isAuthLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateUserName: vi.fn(),
};

function renderModal(auth = mockAuth) {
  return render(
    <AuthContext.Provider value={auth}>
      <DeleteBoardModal />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockBoardId.current = 'board-1';
  mockShowDeleteBoardModal.current = true;
  mockBoards.current = [
    { id: 'board-1', name: 'Family Board', created_at: '', created_by: '', color: '', icon: '' },
    { id: 'board-2', name: 'Work Board', created_at: '', created_by: '', color: '', icon: '' },
  ];
  mockItems.current = [];
  mockPerms.current = [
    { board_id: 'board-1', user_email: 'owner@family.com', role: 'owner' },
    { board_id: 'board-2', user_email: 'owner@family.com', role: 'owner' },
  ];
});

afterEach(cleanup);

describe('DeleteBoardModal (Issue #120)', () => {
  describe('AC1: Delete an empty board — single-step confirmation', () => {
    it('renders single-step confirm when board has no items', () => {
      const { getByRole, getByText } = renderModal();
      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-label')).toBe('Delete Family Board');
      expect(getByText(/Delete "Family Board"\? This cannot be undone\./)).toBeTruthy();
    });

    it('does not show radio options for empty board', () => {
      const { queryByTestId } = renderModal();
      expect(queryByTestId('delete-mode-migrate')).toBeNull();
      expect(queryByTestId('delete-mode-discard')).toBeNull();
    });

    it('calls deleteBoard with null mode on confirm', async () => {
      const { getByTestId } = renderModal();
      const btn = getByTestId('confirm-delete-board');
      fireEvent.click(btn);

      await waitFor(() => {
        expect(mockDeleteBoard).toHaveBeenCalledWith(
          'board-1', null, null, 'owner@family.com', 'test-token'
        );
      });
    });

    it('shows "Deleting…" while submitting', async () => {
      // Make deleteBoard hang
      mockDeleteBoard.mockReturnValue(new Promise(() => {}));
      const { getByTestId } = renderModal();
      const btn = getByTestId('confirm-delete-board');
      fireEvent.click(btn);

      await waitFor(() => {
        expect(btn.textContent).toContain('Deleting');
        expect(btn.hasAttribute('disabled')).toBe(true);
      });
    });
  });

  describe('AC2: Delete board — migrate items', () => {
    beforeEach(() => {
      mockItems.current = [
        { id: 'item-1', title: 'Task', status: 'To Do', board_id: 'board-1', sheetRow: 2, parent_id: '', owner: '', due_date: '', labels: '', description: '', created_at: '', updated_at: '', completed_at: '', sort_order: 1, created_by: '' },
        { id: 'item-2', title: 'Subtask', status: 'To Do', board_id: 'board-1', sheetRow: 3, parent_id: 'item-1', owner: '', due_date: '', labels: '', description: '', created_at: '', updated_at: '', completed_at: '', sort_order: 1, created_by: '' },
      ];
    });

    it('renders two-step flow with migrate and discard options', () => {
      const { getByTestId, getByText } = renderModal();
      expect(getByText(/has 2 items/)).toBeTruthy();
      expect(getByTestId('delete-mode-migrate')).toBeTruthy();
      expect(getByTestId('delete-mode-discard')).toBeTruthy();
    });

    it('shows target board dropdown when migrate is selected', async () => {
      const { getByTestId, queryByTestId } = renderModal();
      expect(queryByTestId('target-board-select')).toBeNull();

      fireEvent.click(getByTestId('delete-mode-migrate'));
      await waitFor(() => {
        expect(getByTestId('target-board-select')).toBeTruthy();
      });
    });

    it('calls deleteBoard with migrate mode and target board', async () => {
      const { getByTestId } = renderModal();
      fireEvent.click(getByTestId('delete-mode-migrate'));

      await waitFor(() => {
        expect(getByTestId('target-board-select')).toBeTruthy();
      });

      fireEvent.click(getByTestId('confirm-delete-board'));

      await waitFor(() => {
        expect(mockDeleteBoard).toHaveBeenCalledWith(
          'board-1', 'migrate', 'board-2', 'owner@family.com', 'test-token'
        );
      });
    });

    it('confirm button disabled until mode selected', () => {
      const { getByTestId } = renderModal();
      const btn = getByTestId('confirm-delete-board');
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('AC3: Delete board — discard all items', () => {
    beforeEach(() => {
      mockItems.current = [
        { id: 'item-1', title: 'Task', status: 'To Do', board_id: 'board-1', sheetRow: 2, parent_id: '', owner: '', due_date: '', labels: '', description: '', created_at: '', updated_at: '', completed_at: '', sort_order: 1, created_by: '' },
      ];
    });

    it('calls deleteBoard with discard mode', async () => {
      const { getByTestId } = renderModal();
      fireEvent.click(getByTestId('delete-mode-discard'));

      await waitFor(() => {
        const btn = getByTestId('confirm-delete-board');
        expect(btn.hasAttribute('disabled')).toBe(false);
      });

      fireEvent.click(getByTestId('confirm-delete-board'));

      await waitFor(() => {
        expect(mockDeleteBoard).toHaveBeenCalledWith(
          'board-1', 'discard', null, 'owner@family.com', 'test-token'
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      const { getByRole } = renderModal();
      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('radio group has accessible label', () => {
      mockItems.current = [
        { id: 'item-1', title: 'Task', status: 'To Do', board_id: 'board-1', sheetRow: 2, parent_id: '', owner: '', due_date: '', labels: '', description: '', created_at: '', updated_at: '', completed_at: '', sort_order: 1, created_by: '' },
      ];
      const { getByRole } = renderModal();
      const radiogroup = getByRole('radiogroup');
      expect(radiogroup.getAttribute('aria-label')).toBe('Delete options');
    });
  });

  describe('Close behavior', () => {
    it('sets showDeleteBoardModal to false on cancel', () => {
      const { getByText } = renderModal();
      fireEvent.click(getByText('Cancel'));
      expect(mockShowDeleteBoardModal.current).toBe(false);
    });

    it('sets showDeleteBoardModal to false on close button', () => {
      const { getByLabelText } = renderModal();
      fireEvent.click(getByLabelText('Close'));
      expect(mockShowDeleteBoardModal.current).toBe(false);
    });
  });
});
