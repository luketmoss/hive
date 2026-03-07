import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { ShareModal } from './share-modal';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

// Mutable mock state
const mockPerms = { current: [] as any[] };
const mockOwners = { current: [] as any[] };
const mockBoardId = { current: 'board-1' };

vi.mock('../../state/board-store', () => ({
  showShareModal: { value: true },
  activeBoard: { get value() { return { id: mockBoardId.current, name: 'Test Board' }; } },
  activeBoardId: { get value() { return mockBoardId.current; } },
  permissions: { get value() { return mockPerms.current; }, set value(v: any) { mockPerms.current = v; } },
  owners: { get value() { return mockOwners.current; } },
}));

const mockShareBoard = vi.fn().mockResolvedValue(true);
const mockUnshareBoard = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  shareBoard: (...args: any[]) => mockShareBoard(...args),
  unshareBoard: (...args: any[]) => mockUnshareBoard(...args),
}));

vi.mock('../../hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

const mockAuth: AuthState = {
  token: 'test-token',
  user: { email: 'owner@family.com', name: 'Owner', picture: '' },
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
  updateUserName: vi.fn(),
};

function renderModal(auth = mockAuth) {
  return render(
    <AuthContext.Provider value={auth}>
      <ShareModal />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms.current = [
    { board_id: 'board-1', user_email: 'owner@family.com', role: 'owner' },
    { board_id: 'board-1', user_email: 'member@family.com', role: 'member' },
  ];
  mockOwners.current = [
    { name: 'Owner', google_account: 'owner@family.com' },
    { name: 'Member', google_account: 'member@family.com' },
    { name: 'Other', google_account: 'other@family.com' },
  ];
  mockBoardId.current = 'board-1';
});

afterEach(cleanup);

describe('ShareModal (Issue #42)', () => {
  describe('AC2: Owner can share a board with another user', () => {
    it('renders share modal with board name in title', () => {
      const { getByRole } = renderModal();
      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-label')).toBe('Share Test Board');
      expect(dialog.textContent).toContain('Share "Test Board"');
    });

    it('validates email against Owners sheet — rejects non-owner', async () => {
      const { getByLabelText, getByRole } = renderModal();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: 'stranger@example.com' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(getByRole('alert').textContent).toContain("isn't a board member yet");
      });
      expect(mockShareBoard).not.toHaveBeenCalled();
    });

    it('validates email against Owners sheet — accepts existing owner', async () => {
      const { getByLabelText } = renderModal();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: 'other@family.com' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockShareBoard).toHaveBeenCalledWith(
          'board-1', 'other@family.com', 'member', 'owner@family.com', 'test-token'
        );
      });
    });

    it('shows error for already-shared email', async () => {
      const { getByLabelText, getByRole } = renderModal();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: 'member@family.com' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(getByRole('alert').textContent).toContain('Already shared');
      });
    });
  });

  describe('AC4: Owner can remove a member from a board', () => {
    it('renders remove buttons with aria-label containing email', () => {
      const { getByLabelText } = renderModal();
      const removeBtn = getByLabelText('Remove member@family.com');
      expect(removeBtn).toBeTruthy();
    });

    it('shows confirmation before removing a member', async () => {
      const { getByLabelText, getByText } = renderModal();
      const removeBtn = getByLabelText('Remove member@family.com');

      fireEvent.click(removeBtn);

      // Confirmation prompt should appear
      await waitFor(() => {
        expect(getByText(/Remove Member\?/)).toBeTruthy();
      });
      expect(mockUnshareBoard).not.toHaveBeenCalled();
    });

    it('calls unshareBoard after confirming removal', async () => {
      const { getByLabelText, getByText } = renderModal();
      const removeBtn = getByLabelText('Remove member@family.com');

      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(getByText(/Remove Member\?/)).toBeTruthy();
      });

      const yesBtn = getByText('Yes');
      fireEvent.click(yesBtn);

      await waitFor(() => {
        expect(mockUnshareBoard).toHaveBeenCalledWith(
          'board-1', 'member@family.com', 'owner@family.com', 'test-token'
        );
      });
    });

    it('does not show remove button for owner role', () => {
      const { queryByLabelText } = renderModal();
      expect(queryByLabelText('Remove owner@family.com')).toBeNull();
    });
  });

  describe('AC5: "Share with all owners" toggle', () => {
    it('renders toggle unchecked when no wildcard entry exists', () => {
      const { getByTestId } = renderModal();
      const toggle = getByTestId('share-all-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);
    });

    it('renders toggle checked when wildcard entry exists', () => {
      mockPerms.current = [
        ...mockPerms.current,
        { board_id: 'board-1', user_email: '*', role: 'member' },
      ];
      const { getByTestId } = renderModal();
      const toggle = getByTestId('share-all-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });

    it('shows helper text about family sharing', () => {
      const { getByText } = renderModal();
      expect(getByText('Everyone in the family can see this board')).toBeTruthy();
    });

    it('calls shareBoard with wildcard when toggling on', async () => {
      const { getByTestId } = renderModal();
      const toggle = getByTestId('share-all-toggle');

      fireEvent.click(toggle);

      await waitFor(() => {
        expect(mockShareBoard).toHaveBeenCalledWith(
          'board-1', '*', 'member', 'owner@family.com', 'test-token'
        );
      });
    });
  });

  describe('AC2: Error handling', () => {
    it('shows error for empty email', async () => {
      const { getByLabelText, getByRole } = renderModal();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: '' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(getByRole('alert').textContent).toContain('Email is required');
      });
    });

    it('shows error for invalid email format', async () => {
      const { getByLabelText, getByRole } = renderModal();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: 'notanemail' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(getByRole('alert').textContent).toContain('valid email');
      });
    });
  });

  describe('Accessibility', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      const { getByRole } = renderModal();
      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('email input has aria-invalid and aria-describedby on error', async () => {
      const { getByLabelText } = renderModal();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: 'bad' } });
      fireEvent.submit(form);

      await waitFor(() => {
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBe('share-email-error');
      });
    });

    it('member list has role="list" with aria-label', () => {
      const { getByRole } = renderModal();
      const list = getByRole('list');
      expect(list.getAttribute('aria-label')).toBe('Board members');
    });
  });
});
