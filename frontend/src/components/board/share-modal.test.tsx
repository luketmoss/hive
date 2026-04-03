import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { ShareModal } from './share-modal';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';

// Mutable mock state
const mockPerms = { current: [] as any[] };
const mockOwners = { current: [] as any[] };
const mockBoardId = { current: 'board-1' };
const mockUserRole = { current: 'owner' as string };

const mockBoards = { current: [
  { id: 'board-1', name: 'Test Board', created_at: '', created_by: '', color: '', icon: '' },
  { id: 'board-2', name: 'Other Board', created_at: '', created_by: '', color: '', icon: '' },
] };

vi.mock('../../state/board-store', () => ({
  showShareModal: { value: true },
  activeBoard: { get value() { return { id: mockBoardId.current, name: mockBoards.current.find(b => b.id === mockBoardId.current)?.name || 'Test Board', color: '', icon: '' }; } },
  activeBoardId: { get value() { return mockBoardId.current; } },
  permissions: { get value() { return mockPerms.current; }, set value(v: any) { mockPerms.current = v; } },
  owners: { get value() { return mockOwners.current; } },
  boards: { get value() { return mockBoards.current; } },
  userBoardRole: { get value() { return mockUserRole.current; } },
  accessibleBoards: { get value() { return mockBoards.current; } },
  showDeleteBoardModal: { value: false },
  openDetailWithTitleEdit: { value: false },
  boardStatuses: { value: [
    { id: 's1', board_id: 'board-1', name: 'To Do', sort_order: 1, color: '#e3f2fd', is_terminal: false, created_at: '' },
    { id: 's2', board_id: 'board-1', name: 'In Progress', sort_order: 2, color: '#fff3e0', is_terminal: false, created_at: '' },
    { id: 's3', board_id: 'board-1', name: 'Done', sort_order: 3, color: '#e8f5e9', is_terminal: true, created_at: '' },
  ] },
}));

const mockShareBoard = vi.fn().mockResolvedValue(true);
const mockUnshareBoard = vi.fn().mockResolvedValue(true);
const mockUpdateBoardAppearance = vi.fn().mockResolvedValue(true);
const mockRenameBoardName = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  shareBoard: (...args: any[]) => mockShareBoard(...args),
  unshareBoard: (...args: any[]) => mockUnshareBoard(...args),
  updateBoardAppearance: (...args: any[]) => mockUpdateBoardAppearance(...args),
  renameBoardName: (...args: any[]) => mockRenameBoardName(...args),
}));

vi.mock('../../hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock('../settings/label-settings', () => ({
  LabelSettings: () => <div data-testid="label-settings-mock" />,
}));

vi.mock('../settings/column-settings', () => ({
  ColumnSettings: () => <div data-testid="column-settings-mock" />,
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

/** Render the modal and navigate to the Sharing tab. */
function renderSharingTab(auth = mockAuth) {
  const result = renderModal(auth);
  const sharingTab = result.getByTestId('settings-tab-sharing');
  fireEvent.click(sharingTab);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserRole.current = 'owner';
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
  mockBoards.current = [
    { id: 'board-1', name: 'Test Board', created_at: '', created_by: '', color: '', icon: '' },
    { id: 'board-2', name: 'Other Board', created_at: '', created_by: '', color: '', icon: '' },
  ];
});

afterEach(cleanup);

describe('ShareModal renamed to Board Settings (Issue #138)', () => {
  describe('AC7: aria-labelledby on dialog', () => {
    it('dialog uses aria-labelledby pointing to the h2 id', () => {
      const { getByRole } = renderModal();
      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-labelledby')).toBe('board-settings-title');
      expect(dialog.getAttribute('aria-label')).toBeNull();
    });

    it('h2 has id="board-settings-title" and text "Board Settings"', () => {
      const { container } = renderModal();
      const heading = container.querySelector('#board-settings-title');
      expect(heading).not.toBeNull();
      expect(heading!.textContent).toBe('Board Settings');
    });
  });

  describe('AC1: Owner can rename the active board via explicit Save', () => {
    it('name input is pre-filled with current board name', () => {
      const { getByLabelText } = renderModal();
      const input = getByLabelText('Board Name') as HTMLInputElement;
      expect(input.value).toBe('Test Board');
    });

    it('has data-autofocus on name input', () => {
      const { container } = renderModal();
      const input = container.querySelector('#board-settings-name');
      expect(input?.hasAttribute('data-autofocus')).toBe(true);
    });

    it('Save button calls renameBoardName with trimmed name', async () => {
      const { getByLabelText, getByTestId } = renderModal();
      const input = getByLabelText('Board Name');
      fireEvent.input(input, { target: { value: 'New Name' } });

      const saveBtn = getByTestId('save-board-name-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockRenameBoardName).toHaveBeenCalledWith('board-1', 'New Name', 'test-token');
      });
    });
  });

  describe('AC2: Duplicate board name is rejected', () => {
    it('shows inline error when name matches an existing board (case-insensitive)', async () => {
      const { getByLabelText, getByRole } = renderModal();
      const input = getByLabelText('Board Name');

      // "Other Board" already exists in mockBoards
      fireEvent.input(input, { target: { value: 'other board' } });
      const saveBtn = input.closest('form')!.querySelector('[data-testid="save-board-name-btn"]')!;
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(getByRole('alert').textContent).toContain('already exists');
      });
      expect(mockRenameBoardName).not.toHaveBeenCalled();
    });
  });

  describe('AC3: Board name is required, max 30 chars, with character counter', () => {
    it('shows error and disables Save when name is empty', async () => {
      const { getByLabelText, getByTestId } = renderModal();
      const input = getByLabelText('Board Name');
      // Clear the name field
      fireEvent.input(input, { target: { value: '' } });
      // Save button should be disabled
      const saveBtn = getByTestId('save-board-name-btn') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
      // Submit the form directly to confirm validation fires
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => {
        expect(saveBtn.disabled).toBe(true);
      });
    });

    it('shows character counter', () => {
      const { container } = renderModal();
      const counter = container.querySelector('.char-counter');
      expect(counter).not.toBeNull();
      expect(counter!.textContent).toContain('/30');
    });

    it('Save button is disabled when name is empty', () => {
      const { getByLabelText, getByTestId } = renderModal();
      const input = getByLabelText('Board Name');
      fireEvent.input(input, { target: { value: '' } });
      const saveBtn = getByTestId('save-board-name-btn') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });
  });

  describe('AC5: Non-owners see read-only settings', () => {
    beforeEach(() => {
      mockUserRole.current = 'member';
    });

    it('name input is disabled for non-owners', () => {
      const { getByLabelText } = renderModal();
      const input = getByLabelText('Board Name') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('Save button is not rendered for non-owners', () => {
      const { queryByTestId } = renderModal();
      expect(queryByTestId('save-board-name-btn')).toBeNull();
    });

    it('color picker buttons are disabled for non-owners', () => {
      const { container } = renderModal();
      const colorButtons = container.querySelectorAll('.color-swatch');
      colorButtons.forEach(btn => {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      });
    });

    it('icon picker buttons are disabled for non-owners', () => {
      const { container } = renderModal();
      const iconButtons = container.querySelectorAll('.icon-swatch');
      iconButtons.forEach(btn => {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      });
    });

    it('danger zone (delete board) is hidden for non-owners', () => {
      const { queryByTestId } = renderModal();
      expect(queryByTestId('delete-board-btn')).toBeNull();
    });
  });
});

describe('ShareModal sharing behavior (Issue #42, preserved in #138)', () => {
  describe('AC2: Owner can share a board with another user', () => {
    it('validates email against Owners sheet — rejects non-owner', async () => {
      const { getByLabelText, getByRole } = renderSharingTab();
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
      const { getByLabelText } = renderSharingTab();
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
      const { getByLabelText, getAllByRole } = renderSharingTab();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: 'member@family.com' } });
      fireEvent.submit(form);

      await waitFor(() => {
        const alerts = getAllByRole('alert');
        const shareAlert = alerts.find(a => a.textContent?.includes('Already shared'));
        expect(shareAlert).toBeTruthy();
      });
    });
  });

  describe('AC4: Owner can remove a member from a board', () => {
    it('renders remove buttons with aria-label containing email', () => {
      const { getByLabelText } = renderSharingTab();
      const removeBtn = getByLabelText('Remove member@family.com');
      expect(removeBtn).toBeTruthy();
    });

    it('shows confirmation before removing a member', async () => {
      const { getByLabelText, getByText } = renderSharingTab();
      const removeBtn = getByLabelText('Remove member@family.com');

      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(getByText(/Remove Member\?/)).toBeTruthy();
      });
      expect(mockUnshareBoard).not.toHaveBeenCalled();
    });

    it('calls unshareBoard after confirming removal', async () => {
      const { getByLabelText, getByText } = renderSharingTab();
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
      const { queryByLabelText } = renderSharingTab();
      expect(queryByLabelText('Remove owner@family.com')).toBeNull();
    });
  });

  describe('AC5: "Share with all owners" toggle', () => {
    it('renders toggle unchecked when no wildcard entry exists', () => {
      const { getByTestId } = renderSharingTab();
      const toggle = getByTestId('share-all-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(false);
    });

    it('renders toggle checked when wildcard entry exists', () => {
      mockPerms.current = [
        ...mockPerms.current,
        { board_id: 'board-1', user_email: '*', role: 'member' },
      ];
      const { getByTestId } = renderSharingTab();
      const toggle = getByTestId('share-all-toggle') as HTMLInputElement;
      expect(toggle.checked).toBe(true);
    });

    it('shows helper text about family sharing', () => {
      const { getByText } = renderSharingTab();
      expect(getByText('Everyone in the family can see this board')).toBeTruthy();
    });

    it('calls shareBoard with wildcard when toggling on', async () => {
      const { getByTestId } = renderSharingTab();
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
      const { getByLabelText, getAllByRole } = renderSharingTab();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: '' } });
      fireEvent.submit(form);

      await waitFor(() => {
        const alerts = getAllByRole('alert');
        const emailAlert = alerts.find(a => a.textContent?.includes('Email is required'));
        expect(emailAlert).toBeTruthy();
      });
    });

    it('shows error for invalid email format', async () => {
      const { getByLabelText, getAllByRole } = renderSharingTab();
      const input = getByLabelText('Add a person');
      const form = input.closest('form')!;

      fireEvent.input(input, { target: { value: 'notanemail' } });
      fireEvent.submit(form);

      await waitFor(() => {
        const alerts = getAllByRole('alert');
        const emailAlert = alerts.find(a => a.textContent?.includes('valid email'));
        expect(emailAlert).toBeTruthy();
      });
    });
  });

  describe('AC1: Owner badge in member list', () => {
    it('shows "(Owner)" badge next to the owner entry', () => {
      const { container } = renderSharingTab();
      const badge = container.querySelector('.share-owner-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('(Owner)');
    });

    it('owner badge has aria-label="Board owner"', () => {
      const { container } = renderSharingTab();
      const badge = container.querySelector('.share-owner-badge');
      expect(badge!.getAttribute('aria-label')).toBe('Board owner');
    });

    it('does not show owner badge on member entries', () => {
      const { container } = renderSharingTab();
      const badges = container.querySelectorAll('.share-owner-badge');
      expect(badges.length).toBe(1);
    });
  });

  describe('Accessibility', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      const { getByRole } = renderSharingTab();
      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('email input has aria-invalid and aria-describedby on error', async () => {
      const { getByLabelText } = renderSharingTab();
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
      const { getByRole } = renderSharingTab();
      const list = getByRole('list');
      expect(list.getAttribute('aria-label')).toBe('Board members');
    });
  });
});
