import { items, showToast } from './board-store';
import { validateStatusTransition, applyStatusSideEffects } from './rules';
import {
  fetchAllItems as sheetsFetchAllItems,
  fetchOwners as sheetsFetchOwners,
  fetchLabels as sheetsFetchLabels,
  createItemRow as sheetsCreateItemRow,
  updateItemRow as sheetsUpdateItemRow,
  deleteItemRow as sheetsDeleteItemRow,
  appendAuditEntry as sheetsAppendAuditEntry,
} from '../api/sheets';
import {
  fetchAllItems as mockFetchAllItems,
  fetchOwners as mockFetchOwners,
  fetchLabels as mockFetchLabels,
  createItemRow as mockCreateItemRow,
  updateItemRow as mockUpdateItemRow,
  deleteItemRow as mockDeleteItemRow,
  appendAuditEntry as mockAppendAuditEntry,
} from '../demo/mock-api';
import { isDemoMode } from '../demo/is-demo-mode';
import { ReauthFailedError } from '../auth/reauth';
import { owners, labels, loading } from './board-store';
import type { Item, ItemStatus, ItemWithRow, UserInfo } from '../api/types';

/**
 * Check if an error is from a failed silent re-auth attempt.
 * When reauth fails, the onReauthFailed callback already handles
 * clearing auth state, showing the login screen, and displaying
 * a "Session expired" toast — so callers should NOT show an additional toast.
 */
function isReauthFailure(err: unknown): boolean {
  return err instanceof ReauthFailedError;
}

// Select real or mock API based on demo mode.
// isDemoMode() is cached after the first call, so this is cheap.
function api() {
  if (isDemoMode()) {
    return {
      fetchAllItems: mockFetchAllItems,
      fetchOwners: mockFetchOwners,
      fetchLabels: mockFetchLabels,
      createItemRow: mockCreateItemRow,
      updateItemRow: mockUpdateItemRow,
      deleteItemRow: mockDeleteItemRow,
      appendAuditEntry: mockAppendAuditEntry,
    };
  }
  return {
    fetchAllItems: sheetsFetchAllItems,
    fetchOwners: sheetsFetchOwners,
    fetchLabels: sheetsFetchLabels,
    createItemRow: sheetsCreateItemRow,
    updateItemRow: sheetsUpdateItemRow,
    deleteItemRow: sheetsDeleteItemRow,
    appendAuditEntry: sheetsAppendAuditEntry,
  };
}

const fetchAllItems = (...args: Parameters<typeof sheetsFetchAllItems>) => api().fetchAllItems(...args);
const fetchOwners = (...args: Parameters<typeof sheetsFetchOwners>) => api().fetchOwners(...args);
const fetchLabels = (...args: Parameters<typeof sheetsFetchLabels>) => api().fetchLabels(...args);
const createItemRow = (...args: Parameters<typeof sheetsCreateItemRow>) => api().createItemRow(...args);
const updateItemRow = (...args: Parameters<typeof sheetsUpdateItemRow>) => api().updateItemRow(...args);
const deleteItemRow = (...args: Parameters<typeof sheetsDeleteItemRow>) => api().deleteItemRow(...args);
const appendAuditEntry = (...args: Parameters<typeof sheetsAppendAuditEntry>) => api().appendAuditEntry(...args);

function generateUUID(): string {
  return crypto.randomUUID();
}

/** Error thrown when the signed-in user is not in the Owners allowlist. */
export class NotAllowedError extends Error {
  constructor(email: string) {
    super(`${email} is not an authorized user. Ask a board admin to add you to the Owners sheet.`);
    this.name = 'NotAllowedError';
  }
}

export async function loadBoard(token: string, user?: UserInfo | null) {
  loading.value = true;
  try {
    const [itemsData, ownersData, labelsData] = await Promise.all([
      fetchAllItems(token),
      fetchOwners(token),
      fetchLabels(token),
    ]);
    items.value = itemsData;
    owners.value = ownersData;
    labels.value = labelsData;

    // Allowlist check: the Owners sheet is the source of truth for who can
    // use the board. If the signed-in user's email isn't listed, reject.
    // Skip in demo mode — the mock user isn't in the mock owners list.
    if (user && !isDemoMode()) {
      const allowed = ownersData.some(
        o => o.google_account.toLowerCase() === user.email.toLowerCase()
      );
      if (!allowed) {
        throw new NotAllowedError(user.email);
      }
    }
  } catch (err: any) {
    if (err instanceof NotAllowedError) throw err;
    if (isReauthFailure(err)) return; // Auth layer handles this
    showToast('Failed to load board: ' + err.message, 'error');
  } finally {
    loading.value = false;
  }
}

export async function refreshItems(token: string) {
  try {
    items.value = await fetchAllItems(token);
  } catch (err: any) {
    if (isReauthFailure(err)) return; // Auth layer handles this
    if (err.status === 401) throw err; // Let auth layer handle it
    console.error('Refresh failed:', err);
  }
}

export async function createItem(
  data: Partial<Item>,
  actor: string,
  token: string
) {
  if (!data.title?.trim()) {
    showToast('Title is required', 'error');
    return;
  }

  const status: ItemStatus = data.status ?? 'To Do';
  if (status === 'In Progress' && !data.owner) {
    showToast('Owner required for In Progress items', 'error');
    return;
  }

  const now = new Date().toISOString();
  const maxOrder = items.value
    .filter(i => i.status === status)
    .reduce((max, i) => Math.max(max, i.sort_order), 0);

  const item: Item = {
    id: generateUUID(),
    title: data.title.trim(),
    description: data.description || '',
    status,
    owner: data.owner || '',
    due_date: data.due_date || '',
    scheduled_date: data.scheduled_date || '',
    labels: data.labels || '',
    parent_id: data.parent_id || '',
    created_at: now,
    updated_at: now,
    completed_at: status === 'Done' ? now : '',
    sort_order: maxOrder + 1,
    created_by: data.created_by || '',
  };

  // Optimistic update
  const newItemWithRow: ItemWithRow = { ...item, sheetRow: -1 };
  items.value = [...items.value, newItemWithRow];

  try {
    await createItemRow(item, token);
    await appendAuditEntry(item.id, 'created', '', '', item.title, actor, token);
    // Refresh to get correct sheetRow
    await refreshItems(token);
    showToast('Item created');
  } catch (err: any) {
    // Rollback
    items.value = items.value.filter(i => i.id !== item.id);
    if (!isReauthFailure(err)) {
      showToast('Failed to create item: ' + err.message, 'error');
    }
  }
}

export async function moveItem(
  itemId: string,
  newStatus: ItemStatus,
  actor: string,
  token: string
): Promise<boolean> {
  const item = items.value.find(i => i.id === itemId);
  if (!item) return false;
  if (item.status === newStatus) return true;

  const validation = validateStatusTransition(item, newStatus, items.value);
  if (!validation.valid) {
    showToast(validation.error!, 'error');
    return false;
  }

  const oldItem = { ...item };
  const updated = { ...applyStatusSideEffects(item, newStatus), sheetRow: item.sheetRow };

  // Optimistic update
  items.value = items.value.map(i => i.id === itemId ? updated : i);

  try {
    await updateItemRow(item.sheetRow, updated, token);
    await appendAuditEntry(itemId, 'status_changed', 'status', oldItem.status, newStatus, actor, token);
    await refreshItems(token);
    return true;
  } catch (err: any) {
    items.value = items.value.map(i => i.id === itemId ? oldItem : i);
    if (!isReauthFailure(err)) {
      showToast('Failed to move item: ' + err.message, 'error');
    }
    return false;
  }
}

export async function updateItem(
  itemId: string,
  changes: Partial<Item>,
  actor: string,
  token: string
): Promise<boolean> {
  const item = items.value.find(i => i.id === itemId);
  if (!item) return false;

  const oldItem = { ...item };
  const updated: ItemWithRow = {
    ...item,
    ...changes,
    updated_at: new Date().toISOString(),
  };

  // Handle status change
  if (changes.status && changes.status !== item.status) {
    return moveItem(itemId, changes.status as ItemStatus, actor, token);
  }

  // Optimistic update
  items.value = items.value.map(i => i.id === itemId ? updated : i);

  try {
    await updateItemRow(item.sheetRow, updated, token);
    // Audit log for each changed field
    for (const key of Object.keys(changes) as (keyof Item)[]) {
      if (changes[key] !== undefined && changes[key] !== oldItem[key]) {
        await appendAuditEntry(
          itemId, 'updated', key, String(oldItem[key]), String(changes[key]), actor, token
        );
      }
    }
    await refreshItems(token);
    return true;
  } catch (err: any) {
    items.value = items.value.map(i => i.id === itemId ? oldItem : i);
    if (!isReauthFailure(err)) {
      showToast('Failed to update item: ' + err.message, 'error');
    }
    return false;
  }
}

export async function deleteItem(
  itemId: string,
  actor: string,
  token: string
) {
  const item = items.value.find(i => i.id === itemId);
  if (!item) return;

  const oldItems = [...items.value];

  // Remove item and its children optimistically
  items.value = items.value.filter(i => i.id !== itemId && i.parent_id !== itemId);

  try {
    // Delete children first (from bottom to top to avoid row shifting issues)
    const children = oldItems
      .filter(i => i.parent_id === itemId)
      .sort((a, b) => b.sheetRow - a.sheetRow);

    for (const child of children) {
      await deleteItemRow(child.sheetRow, token);
      await appendAuditEntry(child.id, 'deleted', '', child.title, '', actor, token);
    }

    // Re-fetch to get updated row numbers after child deletions
    const freshItems = await fetchAllItems(token);
    const freshItem = freshItems.find(i => i.id === itemId);
    if (freshItem) {
      await deleteItemRow(freshItem.sheetRow, token);
      await appendAuditEntry(itemId, 'deleted', '', item.title, '', actor, token);
    }

    await refreshItems(token);
    showToast('Item deleted');
  } catch (err: any) {
    items.value = oldItems;
    if (!isReauthFailure(err)) {
      showToast('Failed to delete item: ' + err.message, 'error');
    }
  }
}
