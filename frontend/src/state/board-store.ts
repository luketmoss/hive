import { signal, computed } from '@preact/signals';
import type { ItemWithRow, Owner, Label, ItemStatus, Board, BoardPermission, PermissionRole, BoardStatus } from '../api/types';

// --- Core data ---
export const items = signal<ItemWithRow[]>([]);
export const owners = signal<Owner[]>([]);
export const labels = signal<Label[]>([]);
export const boards = signal<Board[]>([]);
export const permissions = signal<BoardPermission[]>([]);
export const statuses = signal<BoardStatus[]>([]);
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

/** Labels scoped to the active board. */
export const boardLabels = computed(() => {
  const bid = activeBoardId.value;
  if (!bid) return labels.value;
  return labels.value.filter(l => l.board_id === bid);
});

/** Statuses (columns) for the active board, sorted by sort_order. */
export const boardStatuses = computed(() => {
  const bid = activeBoardId.value;
  return statuses.value
    .filter(s => s.board_id === bid)
    .sort((a, b) => a.sort_order - b.sort_order);
});

/** Check if a status name is a terminal (done) status for the active board.
 * Falls back to checking if name is 'Done' when no statuses are loaded (backward compat). */
export function isTerminalStatus(statusName: string): boolean {
  if (boardStatuses.value.length === 0) return statusName === 'Done';
  return boardStatuses.value.some(s => s.name === statusName && s.is_terminal);
}

/** Check if a status name is terminal for a specific board (cross-board lookups).
 * Falls back to checking if name is 'Done' when no statuses are loaded. */
export function isTerminalStatusForBoard(statusName: string, boardId: string): boolean {
  const boardStats = statuses.value.filter(s => s.board_id === boardId);
  if (boardStats.length === 0) return statusName === 'Done';
  return boardStats.some(s => s.name === statusName && s.is_terminal);
}

/** Get the first (default) status name for the active board. Falls back to 'To Do'. */
export function defaultStatusName(): string {
  const first = boardStatuses.value[0];
  return first ? first.name : 'To Do';
}

/** Get the terminal status name for the active board. Falls back to 'Done'. */
export function terminalStatusName(): string {
  const terminal = boardStatuses.value.find(s => s.is_terminal);
  return terminal ? terminal.name : 'Done';
}

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

// --- Active view (Board vs Upcoming) ---
export type ActiveView = 'board' | 'upcoming';
export const activeView = signal<ActiveView>('board');

/** Switch to the upcoming view. Updates URL and hides board param. */
export function switchToUpcoming() {
  activeView.value = 'upcoming';
  const url = new URL(window.location.href);
  url.searchParams.delete('board');
  url.searchParams.set('view', 'upcoming');
  window.history.replaceState(null, '', url.toString());
  document.title = 'Hive — Upcoming';
}

/** Switch back to board view. Restores board param from activeBoardId. */
export function switchToBoard() {
  activeView.value = 'board';
  const url = new URL(window.location.href);
  url.searchParams.delete('view');
  if (activeBoardId.value) {
    url.searchParams.set('board', activeBoardId.value);
  }
  window.history.replaceState(null, '', url.toString());
  const board = boards.value.find(b => b.id === activeBoardId.value);
  if (board) document.title = `Hive — ${board.name}`;
}

/** Read view from URL on init. */
export function initActiveViewFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'upcoming') {
    activeView.value = 'upcoming';
    document.title = 'Hive — Upcoming';
  }
}

// --- Upcoming view: filter signals ---
export const upcomingFilterSearch = signal('');
export const upcomingFilterLabel = signal<string | null>(null);
export const upcomingFilterBoards = signal<Set<string>>(new Set());

/** Initialize upcoming board filter to all accessible boards. */
export function initUpcomingBoardFilter() {
  upcomingFilterBoards.value = new Set(accessibleBoards.value.map(b => b.id));
}

/** Toggle a board in the upcoming filter. */
export function toggleUpcomingBoard(boardId: string) {
  const current = new Set(upcomingFilterBoards.value);
  if (current.has(boardId)) {
    current.delete(boardId);
  } else {
    current.add(boardId);
  }
  upcomingFilterBoards.value = current;
}

// --- UI state ---
export const selectedItemId = signal<string | null>(null);
/** When true, CardDetail opens with the title EditableField in edit mode. */
export const openDetailWithTitleEdit = signal(false);
export const showCreateModal = signal(false);
/** When set, the Create Item modal will pre-fill this status instead of the board's first column. */
export const createModalInitialStatus = signal<string | null>(null);
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

/** All root items in terminal (done) columns (unfiltered by date). */
export const allDoneItems = computed(() =>
  rootItems.value.filter(i => isTerminalStatus(i.status))
);

/** Root terminal-column items completed within the last 7 days. */
export const recentDoneItems = computed(() => {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return allDoneItems.value
    .filter(i => i.completed_at && new Date(i.completed_at).getTime() >= cutoff)
    .sort(bySortOrder);
});

/** True when there are terminal items older than 7 days (archived). */
export const hasArchivedItems = computed(() =>
  allDoneItems.value.length > recentDoneItems.value.length
);

/** All terminal items sorted by completed_at descending, for the archive dialog. */
export const allDoneItemsSorted = computed(() =>
  allDoneItems.value.slice().sort(byCompletedAtDesc)
);

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
export const columnAnnouncement = signal<{ status: string; text: string } | null>(null);

// --- Column sort ---
export type SortMode = 'custom' | 'due_date' | 'created';

function sortKey(status: string): string {
  return `hive-sort-${status.toLowerCase().replace(/ /g, '-')}`;
}

export function loadColumnSortModes(): Record<string, SortMode> {
  const modes: Record<string, SortMode> = {};
  try {
    // Load sort modes for all known statuses
    for (const s of statuses.value) {
      const stored = localStorage.getItem(sortKey(s.name));
      if (stored === 'custom' || stored === 'due_date' || stored === 'created') {
        modes[s.name] = stored;
      } else {
        modes[s.name] = 'custom';
      }
    }
    // Fallback: also try loading legacy hardcoded keys
    for (const name of ['To Do', 'In Progress', 'Done']) {
      if (!modes[name]) {
        const stored = localStorage.getItem(sortKey(name));
        if (stored === 'custom' || stored === 'due_date' || stored === 'created') {
          modes[name] = stored;
        }
      }
    }
  } catch { /* localStorage unavailable */ }
  return modes;
}

export const columnSortModes = signal<Record<string, SortMode>>(loadColumnSortModes());

export function setColumnSortMode(status: string, mode: SortMode) {
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

export const columns = computed((): Record<string, ItemWithRow[]> => {
  const result: Record<string, ItemWithRow[]> = {};
  for (const status of boardStatuses.value) {
    if (status.is_terminal) {
      result[status.name] = recentDoneItems.value;
    } else {
      const mode = columnSortModes.value[status.name] || 'custom';
      result[status.name] = sortItems(
        rootItems.value.filter(i => i.status === status.name),
        mode
      );
    }
  }
  return result;
});

// --- Upcoming view: time-bucketed items ---
export type UpcomingBucket = 'overdue' | 'this-week' | 'next-week' | 'later';

export interface UpcomingBucketData {
  key: UpcomingBucket;
  label: string;
  items: ItemWithRow[];
}

/** Get Monday of the current week as YYYY-MM-DD. */
function mondayOfWeek(d: Date): string {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Mon=1
  copy.setDate(copy.getDate() + diff);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
}

/** Get Sunday of the current week as YYYY-MM-DD. */
function sundayOfWeek(d: Date): string {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun
  const diff = day === 0 ? 0 : 7 - day;
  copy.setDate(copy.getDate() + diff);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
}

/** Get next week's Monday and Sunday. */
function nextWeekRange(d: Date): [string, string] {
  const copy = new Date(d);
  const day = copy.getDay();
  const toNextMon = day === 0 ? 1 : 8 - day;
  copy.setDate(copy.getDate() + toNextMon);
  const monday = `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
  copy.setDate(copy.getDate() + 6);
  const sunday = `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, '0')}-${String(copy.getDate()).padStart(2, '0')}`;
  return [monday, sunday];
}

function classifyDueDate(dueDate: string, today: string, thisMonday: string, thisSunday: string, nextMonday: string, nextSunday: string): UpcomingBucket {
  if (dueDate < today) return 'overdue';
  if (dueDate >= thisMonday && dueDate <= thisSunday) return 'this-week';
  if (dueDate >= nextMonday && dueDate <= nextSunday) return 'next-week';
  return 'later';
}

export const upcomingBuckets = computed((): UpcomingBucketData[] => {
  const now = new Date();
  const today = todayStr();
  const thisMonday = mondayOfWeek(now);
  const thisSunday = sundayOfWeek(now);
  const [nextMonday, nextSunday] = nextWeekRange(now);

  // Get all non-terminal items across all accessible boards
  const selectedBoards = upcomingFilterBoards.value;
  const allItems = items.value.filter(i =>
    !isTerminalStatusForBoard(i.status, i.board_id) && selectedBoards.has(i.board_id)
  );

  const search = upcomingFilterSearch.value.trim();
  const labelFilter = upcomingFilterLabel.value;

  // Classify items with due dates into buckets
  const rootsWithDue = allItems.filter(i => !i.parent_id && i.due_date);
  const children = allItems.filter(i => i.parent_id);

  // Build parent → earliest child bucket map for AC3
  const parentBucketMap = new Map<string, UpcomingBucket>();
  for (const child of children) {
    if (!child.due_date) continue;
    const bucket = classifyDueDate(child.due_date, today, thisMonday, thisSunday, nextMonday, nextSunday);
    const existing = parentBucketMap.get(child.parent_id);
    if (!existing || bucketOrder(bucket) < bucketOrder(existing)) {
      parentBucketMap.set(child.parent_id, bucket);
    }
  }

  // Collect all qualifying root items
  const buckets: Record<UpcomingBucket, ItemWithRow[]> = {
    'overdue': [],
    'this-week': [],
    'next-week': [],
    'later': [],
  };

  // Roots with their own due dates
  for (const item of rootsWithDue) {
    const bucket = classifyDueDate(item.due_date, today, thisMonday, thisSunday, nextMonday, nextSunday);
    buckets[bucket].push(item);
  }

  // AC3: Parents without qualifying due date but with qualifying children
  const rootsWithoutDue = allItems.filter(i => !i.parent_id && !i.due_date);
  for (const item of rootsWithoutDue) {
    const childBucket = parentBucketMap.get(item.id);
    if (childBucket) {
      buckets[childBucket].push(item);
    }
  }

  // Also include roots whose own due_date doesn't qualify but whose children do
  // (e.g., root due_date is in "later" but child is in "overdue")
  // The root already appears via its own due date, so skip re-adding

  // Apply search and label filters
  const applyFilters = (list: ItemWithRow[]): ItemWithRow[] => {
    let result = list;
    if (search) {
      const t = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(t) ||
        i.description.toLowerCase().includes(t) ||
        i.labels.toLowerCase().includes(t)
      );
    }
    if (labelFilter) {
      result = result.filter(i =>
        i.labels.split(',').map(l => l.trim()).includes(labelFilter)
      );
    }
    return result;
  };

  // Sort each bucket by due_date ascending
  const sortByDue = (a: ItemWithRow, b: ItemWithRow) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  };

  const result: UpcomingBucketData[] = [];
  const bucketDefs: { key: UpcomingBucket; label: string }[] = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'this-week', label: 'This Week' },
    { key: 'next-week', label: 'Next Week' },
    { key: 'later', label: 'Later' },
  ];

  for (const def of bucketDefs) {
    const filtered = applyFilters(buckets[def.key]).sort(sortByDue);
    if (filtered.length > 0) {
      result.push({ key: def.key, label: def.label, items: filtered });
    }
  }

  return result;
});

function bucketOrder(bucket: UpcomingBucket): number {
  const order: Record<UpcomingBucket, number> = { 'overdue': 0, 'this-week': 1, 'next-week': 2, 'later': 3 };
  return order[bucket];
}

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
    done: children.filter(i => isTerminalStatus(i.status)).length,
    total: children.length,
  };
}
