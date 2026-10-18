import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';
import {
  boards, permissions, items, activeBoardId, currentUserEmail,
  showArchiveBoardModal, showArchivedBoardsDialog, showShareModal,
} from '../../state/board-store';
import type { ItemWithRow } from '../../api/types';

// #288: the three surfaces — the Danger Zone button, the archive confirmation
// and the Archived boards dialog. The store is real; the actions are mocked.

const mockArchiveBoard = vi.fn().mockResolvedValue(true);
const mockUnarchiveBoard = vi.fn();

vi.mock('../../state/actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../state/actions')>()),
  archiveBoard: (...args: unknown[]) => mockArchiveBoard(...args),
  unarchiveBoard: (...args: unknown[]) => mockUnarchiveBoard(...args),
}));
vi.mock('../../hooks/use-focus-trap', () => ({ useFocusTrap: () => ({ current: null }) }));

import { ShareModal } from './share-modal';
import { ArchiveBoardModal } from './archive-board-modal';
import { ArchivedBoardsDialog } from './archived-boards-dialog';

const ME = 'owner@test.com';
const auth: AuthState = {
  token: 'tok',
  user: { email: ME, name: 'Owner', picture: '' },
  isAuthenticated: true,
  isAuthLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateUserName: vi.fn(),
};

function withAuth(node: preact.ComponentChild) {
  return render(<AuthContext.Provider value={auth}>{node}</AuthContext.Provider>);
}

function item(id: string, boardId: string): ItemWithRow {
  return {
    id, title: id, description: '', status: 'To Do', owner: '', due_date: '', labels: '',
    parent_id: '', created_at: '', updated_at: '', completed_at: '', sort_order: 1,
    created_by: '', board_id: boardId, sheetRow: 2,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUserEmail.value = ME;
  boards.value = [
    { id: 'home', name: 'Home', created_at: '', created_by: '' },
    { id: 'work', name: 'Work', created_at: '', created_by: '' },
  ];
  permissions.value = [
    { board_id: 'home', user_email: ME, role: 'owner' },
    { board_id: 'work', user_email: ME, role: 'owner' },
  ];
  items.value = [];
  activeBoardId.value = 'home';
  showArchiveBoardModal.value = false;
  showArchivedBoardsDialog.value = true;
  showShareModal.value = true;
});

afterEach(cleanup);

function openDangerZone() {
  const view = withAuth(<ShareModal />);
  fireEvent.click(view.getByRole('tab', { name: /danger/i }));
  return view;
}

describe('AC1: Danger Zone', () => {
  it('puts a secondary Archive button above Delete', () => {
    const view = openDangerZone();
    const archive = view.getByTestId('archive-board-btn');
    const del = view.getByTestId('delete-board-btn');
    expect(archive.className).not.toContain('btn-danger');
    expect(archive.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.getByText('Hide this board and its items. You can restore it any time.')).toBeTruthy();
    expect(view.getByText(/To keep them, archive the board instead/)).toBeTruthy();
  });

  it('opens the confirmation on top of Board Settings, which stays open', () => {
    const view = openDangerZone();
    fireEvent.click(view.getByTestId('archive-board-btn'));
    expect(showArchiveBoardModal.value).toBe(true);
    expect(showShareModal.value).toBe(true);
  });

  it('is disabled on the last active board', () => {
    boards.value = [boards.value[0]];
    const view = openDangerZone();
    const archive = view.getByTestId('archive-board-btn') as HTMLButtonElement;
    expect(archive.disabled).toBe(true);
    expect(archive.title).toBe('This is your last board and cannot be archived');
  });
});

describe('AC1: archive confirmation', () => {
  it('names the board, says where to restore it, and archives on confirm', async () => {
    showArchiveBoardModal.value = true;
    const view = withAuth(<ArchiveBoardModal />);
    const dialog = view.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Archive Home? Its items will be hidden everywhere.');
    expect(dialog.textContent).toContain('restore it from Archived boards in your profile menu');

    fireEvent.click(view.getByTestId('confirm-archive-board'));
    await waitFor(() => expect(mockArchiveBoard).toHaveBeenCalledWith('home', ME, 'tok'));
    await waitFor(() => expect(showShareModal.value).toBe(false));
    expect(showArchiveBoardModal.value).toBe(false);
  });

  it('Cancel closes only the confirmation', () => {
    showArchiveBoardModal.value = true;
    const view = withAuth(<ArchiveBoardModal />);
    fireEvent.click(view.getByText('Cancel'));
    expect(showArchiveBoardModal.value).toBe(false);
    expect(showShareModal.value).toBe(true);
    expect(mockArchiveBoard).not.toHaveBeenCalled();
  });
});

describe('AC3: Archived boards dialog', () => {
  beforeEach(() => {
    boards.value = [
      { id: 'home', name: 'Home', created_at: '', created_by: '' },
      { id: 'garage', name: 'Garage', created_at: '', created_by: '', icon: '🔧', archived_at: '2026-10-18T12:00:00.000Z' },
      { id: 'shed', name: 'Shed', created_at: '', created_by: '', archived_at: '2026-09-02T12:00:00.000Z' },
    ];
    permissions.value = [
      { board_id: 'home', user_email: ME, role: 'owner' },
      { board_id: 'garage', user_email: ME, role: 'owner' },
      { board_id: 'shed', user_email: ME, role: 'member' },
    ];
    items.value = [item('g1', 'garage'), item('g2', 'garage'), item('s1', 'shed')];
  });

  it('lists archived boards newest first with date and item count', () => {
    const view = withAuth(<ArchivedBoardsDialog />);
    const rows = view.getAllByTestId('archived-board-row').map(r => r.textContent);
    expect(rows[0]).toContain('Garage');
    expect(rows[0]).toContain('Archived Oct 18, 2026 · 2 items');
    expect(rows[1]).toContain('Shed');
    expect(rows[1]).toContain('1 item');
    expect(view.getByRole('dialog').getAttribute('aria-labelledby')).toBe('archived-boards-title');
  });

  it('gives owners a labelled Unarchive button and members none', () => {
    const view = withAuth(<ArchivedBoardsDialog />);
    const buttons = view.getAllByTestId('unarchive-board-btn');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toBe('Unarchive Garage');
  });

  it('unarchives through the action, and moves focus to Close when the list empties', async () => {
    boards.value = boards.value.filter(b => b.id !== 'shed');
    mockUnarchiveBoard.mockImplementation(async () => {
      boards.value = boards.value.map(b => ({ ...b, archived_at: '' }));
      return true;
    });
    const view = withAuth(<ArchivedBoardsDialog />);
    fireEvent.click(view.getByLabelText('Unarchive Garage'));
    await waitFor(() => expect(view.getByTestId('archived-boards-empty').textContent).toBe('No archived boards'));
    expect(mockUnarchiveBoard).toHaveBeenCalledWith('garage', ME, 'tok');
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Close'));
  });

  it('says "No archived boards" when there are none', () => {
    boards.value = [boards.value[0]];
    const view = withAuth(<ArchivedBoardsDialog />);
    expect(view.getByTestId('archived-boards-empty').textContent).toBe('No archived boards');
  });
});
