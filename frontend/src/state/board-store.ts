import { signal, computed } from '@preact/signals';
import type { ItemWithRow, Owner, Label, ItemStatus, Board, BoardPermission, PermissionRole } from '../api/types';

// --- Core data ---
export const items = signal<ItemWithRow[]>([]);
export const owners = signal<Owner[]>([]);
export const labels = signal<Label[]>([]);
export const boards = signal<Board[]>([]);
export const permissions = signal<BoardPermission[]>([]);
export const activeBoardId = signal<string>('');
export const loading = signal(true);
export const currentUserEmail = signal<string>('');

/** The currently active board object. */
export const activeBoard = computed(() =>
  boards.value.find(b => b.id === activeBoardId.value) ?? null
);

/** Boards the current user has access to (via direct permission or wildcard). */
export const accessibleBoards = computed(() => {
  const email = currentUserEmail.value.toLowerCase();
  if (!email) return boards.value; // No user context = show all (fallback)
  return boards.value.filter(b => {
    return permissions.value.some(p =>
      p.board_id === b.id && (p.user_email === '*' || p.user_email.toLowerCase() === email)
    );
  });
});

/** The current user's role on the active board. */
export const userBoardRole = computed((): PermissionRole | null => {
  const email = currentUserEmail.value.toLowerCase();
  const bid = activeBoardId.value;
  if (!email || !bid) return null;

  // Check for direct permission first (may be 'owner')
  const direct = permissions.value.find(
    p => p.board_id === bid && p.user_email.toLowerCase() === email
  );
  if (direct) return direct.role;

  // Check for wildcard
  const wildcard = permissions.value.find(
    p => p.board_id === bid && p.user_email === '*'
  );
  if (wildcard) return 'member'; // Wildcard always grants member

  return null;
});

/** Items scoped to the active board (plus their children). */
export const boardItems = computed(() => {
  const bid = activeBoardId.value;
  if (!bid) return items.value;
  // Include items on this board, plus children whose parent is on this board
  const boardRoots = new Set(
    items.value.filter(i => i.board_id === bid && !i.parent_id).map(i => i.id)
  );
  return items.value.filter(i =>
    (i.board_id === bid) || (i.parent_id && boardRoots.has(i.parent_id))
  );
});

// --- Filters ---
export const filterOwner = signal<string | null>(null);
export const filterLabel = signal<string | null>(null);
export const groupBy = signal<'none' | 'owner' | 'label'>('none');

// --- UI state ---
export const selectedItemId = signal<string | null>(null);
export const showCreateModal = signal(false);
export const toastMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);

// --- View mode (mobile list vs board) ---
export type ViewMode = 'board' | 'list';

function loadViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem('hive-view-mode');
    if (stored === 'list' || stored === 'board') return stored;
  } catch { /* localStorage unavailable */ }
  return 'board';
}

export const viewMode = signal<ViewMode>(loadViewMode());

/** Toggle between board and list view, persisting to localStorage. */
export function setViewMode(mode: ViewMode) {
  viewMode.value = mode;
  try {
    localStorage.setItem('hive-view-mode', mode);
  } catch { /* localStorage unavailable */ }
}

// --- Derived ---
export const filteredItems = computed(() => {
  let result = boardItems.value;

  if (filterOwner.value) {
    result = result.filter(i => i.owner === filterOwner.value);
  }
  if (filterLabel.value) {
    const label = filterLabel.value;
    result = result.filter(i =>
      i.labels.split(',').map(l => l.trim()).includes(label)
    );
  }

  return result;
});

export const rootItems = computed(() =>
  filteredItems.value.filter(i => !i.parent_id)
);

const bySortOrder = (a: ItemWithRow, b: ItemWithRow) => a.sort_order - b.sort_order;
const byCompletedAtDesc = (a: ItemWithRow, b: ItemWithRow) => {
  const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
  const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
  return bTime - aTime;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** All root Done items (unfiltered by date). */
export const allDoneItems = computed(() =>
  rootItems.value.filter(i => i.status === 'Done')
);

/** Root Done items completed within the last 7 days. */
export const recentDoneItems = computed(() => {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return allDoneItems.value
    .filter(i => i.completed_at && new Date(i.completed_at).getTime() >= cutoff)
    .sort(bySortOrder);
});

/** True when there are Done items older than 7 days (archived). */
export const hasArchivedItems = computed(() =>
  allDoneItems.value.length > recentDoneItems.value.length
);

/** All Done items sorted by completed_at descending, for the archive dialog. */
export const allDoneItemsSorted = computed(() =>
  allDoneItems.value.slice().sort(byCompletedAtDesc)
);

// --- UI state for archive dialog ---
export const showArchiveDialog = signal(false);

// --- UI state for board creation ---
export const showCreateBoardModal = signal(false);

// --- UI state for share modal ---
export const showShareModal = signal(false);

/** Switch to a different board. Resets filters and selection but preserves view mode. */
export function switchBoard(boardId: string) {
  activeBoardId.value = boardId;
  filterOwner.value = null;
  filterLabel.value = null;
  groupBy.value = 'none';
  selectedItemId.value = null;

  // Update URL with board param
  const url = new URL(window.location.href);
  url.searchParams.set('board', boardId);
  window.history.replaceState(null, '', url.toString());

  // Update document title
  const board = boards.value.find(b => b.id === boardId);
  if (board) {
    document.title = `Hive \u2014 ${board.name}`;
  }
}

/** Read active board from URL query param, falling back to first accessible board. */
export function initActiveBoardFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const boardParam = params.get('board');
  // Filter to boards the current user can access (AC3)
  const email = currentUserEmail.value.toLowerCase();
  const available = email
    ? boards.value.filter(b =>
        permissions.value.some(p =>
          p.board_id === b.id && (p.user_email === '*' || p.user_email.toLowerCase() === email)
        )
      )
    : boards.value;
  if (boardParam && available.some(b => b.id === boardParam)) {
    activeBoardId.value = boardParam;
  } else if (available.length > 0) {
    activeBoardId.value = available[0].id;
  }
  // Update document title
  const board = boards.value.find(b => b.id === activeBoardId.value);
  if (board) {
    document.title = `Hive \u2014 ${board.name}`;
  }
}

export const columns = computed(() => ({
  'To Do': rootItems.value.filter(i => i.status === 'To Do').sort(bySortOrder),
  'In Progress': rootItems.value.filter(i => i.status === 'In Progress').sort(bySortOrder),
  'Done': recentDoneItems.value,
}));

export const selectedItem = computed(() =>
  selectedItemId.value ? items.value.find(i => i.id === selectedItemId.value) ?? null : null
);

export const childrenOfSelected = computed(() =>
  selectedItemId.value
    ? items.value.filter(i => i.parent_id === selectedItemId.value).sort(bySortOrder)
    : []
);

// --- Helpers ---

export function showToast(text: string, type: 'success' | 'error' = 'success') {
  toastMessage.value = { text, type };
  setTimeout(() => {
    toastMessage.value = null;
  }, 4000);
}

export function getChildCount(itemId: string): { done: number; total: number } {
  const children = items.value.filter(i => i.parent_id === itemId);
  return {
    done: children.filter(i => i.status === 'Done').length,
    total: children.length,
  };
}
