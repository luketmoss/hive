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
export const filterSearch = signal('');
export type DueFilter = 'today' | 'this-week' | null;
export const filterDue = signal<DueFilter>(null);
export const groupBy = signal<'none' | 'owner' | 'label'>('none');

// --- UI state ---
export const selectedItemId = signal<string | null>(null);
/** When true, CardDetail opens with the title EditableField in edit mode. */
export const openDetailWithTitleEdit = signal(false);
export const showCreateModal = signal(false);
/** When set, the Create Item modal will pre-fill this status instead of defaulting to 'To Do'. */
export const createModalInitialStatus = signal<ItemStatus | null>(null);
export const toastMessage = signal<{ text: string; type: 'success' | 'error'; action?: { label: string; fn: () => void }; duration?: number } | null>(null);

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

// --- Theme ---
export type Theme = 'light' | 'dark' | 'system';

/** Read the saved theme preference from localStorage, falling back to 'system'. */
export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem('hive-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* localStorage unavailable */ }
  return 'system';
}

export const theme = signal<Theme>(loadTheme());

/** Apply `data-theme` attribute to `<html>` based on the given theme. */
export function applyTheme(t: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = t === 'system' ? (prefersDark ? 'dark' : 'light') : t;
  document.documentElement.setAttribute('data-theme', resolved);
}

/** Set the active theme, persist to localStorage, and apply to the DOM. */
export function setTheme(t: Theme) {
  theme.value = t;
  try {
    localStorage.setItem('hive-theme', t);
  } catch { /* localStorage unavailable */ }
  applyTheme(t);
}

/** Cycle theme Light → Dark → System → Light (used by T keyboard shortcut). */
export function cycleTheme() {
  const order: Theme[] = ['light', 'dark', 'system'];
  const current = theme.value;
  const next = order[(order.indexOf(current) + 1) % order.length];
  setTheme(next);
}

// --- Derived ---

/** Get today's date as YYYY-MM-DD. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get end-of-week (Sunday) date as YYYY-MM-DD from today. */
function endOfWeekStr(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Check if an item's fields match the search term (case-insensitive). */
function itemMatchesSearch(item: ItemWithRow, term: string): boolean {
  const t = term.toLowerCase();
  return (
    item.title.toLowerCase().includes(t) ||
    item.description.toLowerCase().includes(t) ||
    item.labels.toLowerCase().includes(t)
  );
}

/** Check if an item's due_date falls within the due filter range. */
function itemMatchesDue(item: ItemWithRow, due: 'today' | 'this-week'): boolean {
  if (!item.due_date) return false;
  const today = todayStr();
  if (due === 'today') return item.due_date === today;
  // this-week: today through Sunday inclusive
  return item.due_date >= today && item.due_date <= endOfWeekStr();
}

export const filteredItems = computed(() => {
  let result = boardItems.value;

  if (filterLabel.value) {
    const label = filterLabel.value;
    result = result.filter(i =>
      i.labels.split(',').map(l => l.trim()).includes(label)
    );
  }

  const search = filterSearch.value.trim();
  const due = filterDue.value;

  if (search || due) {
    // Build set of root IDs whose children match (for sub-item search)
    const allItems = boardItems.value;
    const matchingParentIds = new Set<string>();

    if (search) {
      for (const item of allItems) {
        if (item.parent_id && itemMatchesSearch(item, search)) {
          matchingParentIds.add(item.parent_id);
        }
      }
    }
    if (due) {
      for (const item of allItems) {
        if (item.parent_id && itemMatchesDue(item, due)) {
          matchingParentIds.add(item.parent_id);
        }
      }
    }

    result = result.filter(i => {
      // Children pass through — they're filtered out by rootItems
      if (i.parent_id) return true;

      const searchOk = !search || itemMatchesSearch(i, search) || matchingParentIds.has(i.id);
      const dueOk = !due || itemMatchesDue(i, due) || matchingParentIds.has(i.id);
      return searchOk && dueOk;
    });
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

// --- UI state for settings modal ---
export const showSettings = signal(false);

// --- UI state for archive dialog ---
export const showArchiveDialog = signal(false);

// --- UI state for board creation ---
export const showCreateBoardModal = signal(false);

// --- UI state for share modal ---
export const showShareModal = signal(false);

// --- UI state for delete board modal ---
export const showDeleteBoardModal = signal(false);

// --- UI state for move-to-board modal ---
export const showMoveToBoardModal = signal(false);

/** Switch to a different board. Resets filters and selection but preserves view mode. */
export function switchBoard(boardId: string) {
  activeBoardId.value = boardId;
  filterOwner.value = null;
  filterLabel.value = null;
  filterSearch.value = '';
  filterDue.value = null;
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

// --- Column announcements (for aria-live cross-column keyboard move) ---
export const columnAnnouncement = signal<{ status: ItemStatus; text: string } | null>(null);

// --- Column sort ---
export type SortMode = 'custom' | 'due_date' | 'created';

function sortKey(status: ItemStatus): string {
  return `hive-sort-${status.toLowerCase().replace(/ /g, '-')}`;
}

export function loadColumnSortModes(): Record<ItemStatus, SortMode> {
  const modes: Record<ItemStatus, SortMode> = { 'To Do': 'custom', 'In Progress': 'custom', 'Done': 'custom' };
  try {
    for (const s of ['To Do', 'In Progress', 'Done'] as ItemStatus[]) {
      const stored = localStorage.getItem(sortKey(s));
      if (stored === 'custom' || stored === 'due_date' || stored === 'created') {
        modes[s] = stored;
      }
    }
  } catch { /* localStorage unavailable */ }
  return modes;
}

export const columnSortModes = signal<Record<ItemStatus, SortMode>>(loadColumnSortModes());

export function setColumnSortMode(status: ItemStatus, mode: SortMode) {
  columnSortModes.value = { ...columnSortModes.value, [status]: mode };
  try {
    localStorage.setItem(sortKey(status), mode);
  } catch { /* localStorage unavailable */ }
}

function sortItems(itemList: ItemWithRow[], mode: SortMode): ItemWithRow[] {
  if (mode === 'due_date') {
    return itemList.slice().sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1; // nulls last
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }
  if (mode === 'created') {
    return itemList.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return itemList.slice().sort(bySortOrder);
}

export const columns = computed(() => ({
  'To Do': sortItems(rootItems.value.filter(i => i.status === 'To Do'), columnSortModes.value['To Do']),
  'In Progress': sortItems(rootItems.value.filter(i => i.status === 'In Progress'), columnSortModes.value['In Progress']),
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

/** Timer ID for the current toast auto-dismiss. Exported for pause/resume in Toast component. */
export let toastTimerId: ReturnType<typeof setTimeout> | null = null;

export function showToast(text: string, type: 'success' | 'error' = 'success', action?: { label: string; fn: () => void }, duration?: number) {
  // Clear any existing timer
  if (toastTimerId !== null) {
    clearTimeout(toastTimerId);
    toastTimerId = null;
  }
  const ms = duration ?? 4000;
  toastMessage.value = { text, type, action, duration: ms };
  toastTimerId = setTimeout(() => {
    toastMessage.value = null;
    toastTimerId = null;
  }, ms);
}

/** Pause the toast auto-dismiss timer. Returns remaining ms, or null if no timer. */
export function pauseToastTimer(): void {
  if (toastTimerId !== null) {
    clearTimeout(toastTimerId);
    toastTimerId = null;
  }
}

/** Resume the toast auto-dismiss timer with the given remaining ms. */
export function resumeToastTimer(remainingMs: number): void {
  if (toastTimerId !== null) {
    clearTimeout(toastTimerId);
  }
  toastTimerId = setTimeout(() => {
    toastMessage.value = null;
    toastTimerId = null;
  }, remainingMs);
}

/** Dismiss the current toast immediately and clear any pending timer. */
export function dismissToast(): void {
  if (toastTimerId !== null) {
    clearTimeout(toastTimerId);
    toastTimerId = null;
  }
  toastMessage.value = null;
}

export function getChildCount(itemId: string): { done: number; total: number } {
  const children = items.value.filter(i => i.parent_id === itemId);
  return {
    done: children.filter(i => i.status === 'Done').length,
    total: children.length,
  };
}
