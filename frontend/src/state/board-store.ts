import { signal, computed } from '@preact/signals';
import type { ItemWithRow, Owner, Label, ItemStatus } from '../api/types';

// --- Core data ---
export const items = signal<ItemWithRow[]>([]);
export const owners = signal<Owner[]>([]);
export const labels = signal<Label[]>([]);
export const loading = signal(true);

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
  let result = items.value;

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

export const columns = computed(() => ({
  'To Do': rootItems.value.filter(i => i.status === 'To Do').sort(bySortOrder),
  'In Progress': rootItems.value.filter(i => i.status === 'In Progress').sort(bySortOrder),
  'Done': rootItems.value.filter(i => i.status === 'Done').sort(bySortOrder),
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
