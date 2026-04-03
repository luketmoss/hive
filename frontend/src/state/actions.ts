import { items, showToast, boards, activeBoardId, initActiveBoardFromUrl, initActiveViewFromUrl, initUpcomingBoardFilter, permissions, currentUserEmail, selectedItemId, boardItems as boardItemsComputed } from './board-store';
import { validateStatusTransition, applyStatusSideEffects } from './rules';
import {
  fetchAllItems as sheetsFetchAllItems,
  fetchOwners as sheetsFetchOwners,
  fetchLabels as sheetsFetchLabels,
  createItemRow as sheetsCreateItemRow,
  updateItemRow as sheetsUpdateItemRow,
  deleteItemRow as sheetsDeleteItemRow,
  appendAuditEntry as sheetsAppendAuditEntry,
  createLabelRow as sheetsCreateLabelRow,
  updateLabelRow as sheetsUpdateLabelRow,
  deleteLabelRow as sheetsDeleteLabelRow,
  fetchLabelsWithRows as sheetsFetchLabelsWithRows,
  cascadeLabelUpdate as sheetsCascadeLabelUpdate,
  cascadeOwnerUpdate as sheetsCascadeOwnerUpdate,
  upsertOwner as sheetsUpsertOwner,
  fetchBoards as sheetsFetchBoards,
  createBoardRow as sheetsCreateBoardRow,
  updateBoardRow as sheetsUpdateBoardRow,
  renameBoardRow as sheetsRenameBoardRow,
  fetchPermissions as sheetsFetchPermissions,
  createPermissionRow as sheetsCreatePermissionRow,
  deletePermissionRow as sheetsDeletePermissionRow,
  deleteBoardRow as sheetsDeleteBoardRow,
  deleteAllBoardPermissions as sheetsDeleteAllBoardPermissions,
  updateItemBoardId as sheetsUpdateItemBoardId,
  fetchStatuses as sheetsFetchStatuses,
  createStatusRow as sheetsCreateStatusRow,
  updateStatusRow as sheetsUpdateStatusRow,
  deleteStatusRow as sheetsDeleteStatusRow,
  fetchStatusesWithRows as sheetsFetchStatusesWithRows,
  cascadeStatusRename as sheetsCascadeStatusRename,
} from '../api/sheets';
import {
  fetchAllItems as mockFetchAllItems,
  fetchOwners as mockFetchOwners,
  fetchLabels as mockFetchLabels,
  createItemRow as mockCreateItemRow,
  updateItemRow as mockUpdateItemRow,
  deleteItemRow as mockDeleteItemRow,
  appendAuditEntry as mockAppendAuditEntry,
  createLabelRow as mockCreateLabelRow,
  updateLabelRow as mockUpdateLabelRow,
  deleteLabelRow as mockDeleteLabelRow,
  fetchLabelsWithRows as mockFetchLabelsWithRows,
  cascadeLabelUpdate as mockCascadeLabelUpdate,
  cascadeOwnerUpdate as mockCascadeOwnerUpdate,
  upsertOwner as mockUpsertOwner,
  fetchBoards as mockFetchBoards,
  createBoardRow as mockCreateBoardRow,
  updateBoardRow as mockUpdateBoardRow,
  renameBoardRow as mockRenameBoardRow,
  fetchPermissions as mockFetchPermissions,
  createPermissionRow as mockCreatePermissionRow,
  deletePermissionRow as mockDeletePermissionRow,
  deleteBoardRow as mockDeleteBoardRow,
  deleteAllBoardPermissions as mockDeleteAllBoardPermissions,
  updateItemBoardId as mockUpdateItemBoardId,
  fetchStatuses as mockFetchStatuses,
  createStatusRow as mockCreateStatusRow,
  updateStatusRow as mockUpdateStatusRow,
  deleteStatusRow as mockDeleteStatusRow,
  fetchStatusesWithRows as mockFetchStatusesWithRows,
  cascadeStatusRename as mockCascadeStatusRename,
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
      createLabelRow: mockCreateLabelRow,
      updateLabelRow: mockUpdateLabelRow,
      deleteLabelRow: mockDeleteLabelRow,
      fetchLabelsWithRows: mockFetchLabelsWithRows,
      cascadeLabelUpdate: mockCascadeLabelUpdate,
      cascadeOwnerUpdate: mockCascadeOwnerUpdate,
      upsertOwner: mockUpsertOwner,
      fetchBoards: mockFetchBoards,
      createBoardRow: mockCreateBoardRow,
      updateBoardRow: mockUpdateBoardRow,
      renameBoardRow: mockRenameBoardRow,
      fetchPermissions: mockFetchPermissions,
      createPermissionRow: mockCreatePermissionRow,
      deletePermissionRow: mockDeletePermissionRow,
      deleteBoardRow: mockDeleteBoardRow,
      deleteAllBoardPermissions: mockDeleteAllBoardPermissions,
      updateItemBoardId: mockUpdateItemBoardId,
      fetchStatuses: mockFetchStatuses,
      createStatusRow: mockCreateStatusRow,
      updateStatusRow: mockUpdateStatusRow,
      deleteStatusRow: mockDeleteStatusRow,
      fetchStatusesWithRows: mockFetchStatusesWithRows,
      cascadeStatusRename: mockCascadeStatusRename,
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
    createLabelRow: sheetsCreateLabelRow,
    updateLabelRow: sheetsUpdateLabelRow,
    deleteLabelRow: sheetsDeleteLabelRow,
    fetchLabelsWithRows: sheetsFetchLabelsWithRows,
    cascadeLabelUpdate: sheetsCascadeLabelUpdate,
    cascadeOwnerUpdate: sheetsCascadeOwnerUpdate,
    upsertOwner: sheetsUpsertOwner,
    fetchBoards: sheetsFetchBoards,
    createBoardRow: sheetsCreateBoardRow,
    updateBoardRow: sheetsUpdateBoardRow,
    renameBoardRow: sheetsRenameBoardRow,
    fetchPermissions: sheetsFetchPermissions,
    createPermissionRow: sheetsCreatePermissionRow,
    deletePermissionRow: sheetsDeletePermissionRow,
    deleteBoardRow: sheetsDeleteBoardRow,
    deleteAllBoardPermissions: sheetsDeleteAllBoardPermissions,
    updateItemBoardId: sheetsUpdateItemBoardId,
    fetchStatuses: sheetsFetchStatuses,
    createStatusRow: sheetsCreateStatusRow,
    updateStatusRow: sheetsUpdateStatusRow,
    deleteStatusRow: sheetsDeleteStatusRow,
    fetchStatusesWithRows: sheetsFetchStatusesWithRows,
    cascadeStatusRename: sheetsCascadeStatusRename,
  };
}

const fetchAllItems = (...args: Parameters<typeof sheetsFetchAllItems>) => api().fetchAllItems(...args);
const fetchOwners = (...args: Parameters<typeof sheetsFetchOwners>) => api().fetchOwners(...args);
const fetchLabels = (...args: Parameters<typeof sheetsFetchLabels>) => api().fetchLabels(...args);
const createItemRow = (...args: Parameters<typeof sheetsCreateItemRow>) => api().createItemRow(...args);
const updateItemRow = (...args: Parameters<typeof sheetsUpdateItemRow>) => api().updateItemRow(...args);
const deleteItemRow = (...args: Parameters<typeof sheetsDeleteItemRow>) => api().deleteItemRow(...args);
const appendAuditEntry = (...args: Parameters<typeof sheetsAppendAuditEntry>) => api().appendAuditEntry(...args);
const createLabelRow = (...args: Parameters<typeof sheetsCreateLabelRow>) => api().createLabelRow(...args);
const updateLabelRow = (...args: Parameters<typeof sheetsUpdateLabelRow>) => api().updateLabelRow(...args);
const deleteLabelRow = (...args: Parameters<typeof sheetsDeleteLabelRow>) => api().deleteLabelRow(...args);
const fetchLabelsWithRows = (...args: Parameters<typeof sheetsFetchLabelsWithRows>) => api().fetchLabelsWithRows(...args);
const cascadeLabelUpdate = (...args: Parameters<typeof sheetsCascadeLabelUpdate>) => api().cascadeLabelUpdate(...args);
const cascadeOwnerUpdate = (...args: Parameters<typeof sheetsCascadeOwnerUpdate>) => api().cascadeOwnerUpdate(...args);
const upsertOwner = (...args: Parameters<typeof sheetsUpsertOwner>) => api().upsertOwner(...args);
const fetchBoardsApi = (...args: Parameters<typeof sheetsFetchBoards>) => api().fetchBoards(...args);
const createBoardRowApi = (...args: Parameters<typeof sheetsCreateBoardRow>) => api().createBoardRow(...args);
const updateBoardRowApi = (...args: Parameters<typeof sheetsUpdateBoardRow>) => api().updateBoardRow(...args);
const renameBoardRowApi = (...args: Parameters<typeof sheetsRenameBoardRow>) => api().renameBoardRow(...args);
const fetchPermissionsApi = (...args: Parameters<typeof sheetsFetchPermissions>) => api().fetchPermissions(...args);
const createPermissionRowApi = (...args: Parameters<typeof sheetsCreatePermissionRow>) => api().createPermissionRow(...args);
const deletePermissionRowApi = (...args: Parameters<typeof sheetsDeletePermissionRow>) => api().deletePermissionRow(...args);
const deleteBoardRowApi = (...args: Parameters<typeof sheetsDeleteBoardRow>) => api().deleteBoardRow(...args);
const deleteAllBoardPermissionsApi = (...args: Parameters<typeof sheetsDeleteAllBoardPermissions>) => api().deleteAllBoardPermissions(...args);
const updateItemBoardIdApi = (...args: Parameters<typeof sheetsUpdateItemBoardId>) => api().updateItemBoardId(...args);
const fetchStatusesApi = (...args: Parameters<typeof sheetsFetchStatuses>) => api().fetchStatuses(...args);
const createStatusRowApi = (...args: Parameters<typeof sheetsCreateStatusRow>) => api().createStatusRow(...args);
const updateStatusRowApi = (...args: Parameters<typeof sheetsUpdateStatusRow>) => api().updateStatusRow(...args);
const deleteStatusRowApi = (...args: Parameters<typeof sheetsDeleteStatusRow>) => api().deleteStatusRow(...args);
const fetchStatusesWithRowsApi = (...args: Parameters<typeof sheetsFetchStatusesWithRows>) => api().fetchStatusesWithRows(...args);
const cascadeStatusRenameApi = (...args: Parameters<typeof sheetsCascadeStatusRename>) => api().cascadeStatusRename(...args);

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
    const [itemsData, ownersData, labelsData, boardsData, permsData] = await Promise.all([
      fetchAllItems(token),
      fetchOwners(token),
      fetchLabels(token),
      fetchBoardsApi(token),
      fetchPermissionsApi(token),
    ]);
    items.value = itemsData;
    owners.value = ownersData;
    boards.value = boardsData;

    // AC4: One-time migration — assign board_id to orphaned labels
    const orphanedLabels = labelsData.filter(l => !l.board_id);
    if (orphanedLabels.length > 0 && boardsData.length > 0) {
      // For each board, find labels used by that board's items
      const assignedNames = new Set<string>();
      const migratedLabels = labelsData.map(l => ({ ...l }));

      for (const board of boardsData) {
        const boardItemsForMigration = itemsData.filter(i => i.board_id === board.id);
        const usedLabelNames = new Set<string>();
        for (const item of boardItemsForMigration) {
          for (const name of item.labels.split(',').map(s => s.trim()).filter(Boolean)) {
            usedLabelNames.add(name);
          }
        }
        for (const label of migratedLabels) {
          if (label.board_id) continue; // already assigned
          if (usedLabelNames.has(label.label) && !assignedNames.has(label.label)) {
            label.board_id = board.id;
            assignedNames.add(label.label);
          }
        }
      }

      // Assign remaining unassigned labels to the first board
      const firstBoardId = boardsData[0].id;
      for (const label of migratedLabels) {
        if (!label.board_id) {
          label.board_id = firstBoardId;
        }
      }

      // Persist migration to sheet
      const labelsWithRows = await fetchLabelsWithRows(token);
      for (const label of migratedLabels) {
        const rowData = labelsWithRows.find(r => r.label === label.label && !r.board_id);
        if (rowData) {
          await updateLabelRow(rowData.sheetRow, label.label, label.color, label.board_id, token);
        }
      }

      labels.value = migratedLabels;
    } else {
      labels.value = labelsData;
    }

    // Set current user email for permission filtering
    if (user) {
      currentUserEmail.value = user.email;
    }

    // Migration (AC7): if boards exist but have no permission entries, create
    // wildcard entries so existing boards remain accessible.
    if (boardsData.length > 0 && permsData.length === 0) {
      const migrationPerms = boardsData.map(b => ({
        board_id: b.id,
        user_email: '*',
        role: 'member' as const,
      }));
      // Also grant owner role to board creators
      const ownerPerms = boardsData.map(b => ({
        board_id: b.id,
        user_email: b.created_by,
        role: 'owner' as const,
      }));
      const allPerms = [...ownerPerms, ...migrationPerms];
      for (const perm of allPerms) {
        await createPermissionRowApi(perm, token);
      }
      permissions.value = allPerms;
    } else {
      permissions.value = permsData;
    }

    // Initialize active board from URL or default to first accessible board
    if (boardsData.length > 0) {
      initActiveBoardFromUrl();
      initUpcomingBoardFilter();
      initActiveViewFromUrl();
    }

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
    labels: data.labels || '',
    parent_id: data.parent_id || '',
    created_at: now,
    updated_at: now,
    completed_at: status === 'Done' ? now : '',
    sort_order: maxOrder + 1,
    created_by: data.created_by || '',
    board_id: data.board_id || activeBoardId.value,
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

export interface StagedSubtask {
  title: string;
  owner: string;
}

export async function createItemWithSubtasks(
  data: Partial<Item>,
  subtasks: StagedSubtask[],
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

  const parentId = generateUUID();
  const parent: Item = {
    id: parentId,
    title: data.title.trim(),
    description: data.description || '',
    status,
    owner: data.owner || '',
    due_date: data.due_date || '',
    labels: data.labels || '',
    parent_id: data.parent_id || '',
    created_at: now,
    updated_at: now,
    completed_at: status === 'Done' ? now : '',
    sort_order: maxOrder + 1,
    created_by: data.created_by || '',
    board_id: data.board_id || activeBoardId.value,
  };

  // Filter out blank subtasks and build child items
  const validSubtasks = subtasks.filter(s => s.title.trim());
  const children: Item[] = validSubtasks.map((s, i) => ({
    id: generateUUID(),
    title: s.title.trim(),
    description: '',
    status: 'To Do' as ItemStatus,
    owner: s.owner || '',
    due_date: '',
    labels: '',
    parent_id: parentId,
    created_at: now,
    updated_at: now,
    completed_at: '',
    sort_order: i + 1,
    created_by: data.created_by || '',
    board_id: data.board_id || activeBoardId.value,
  }));

  // Optimistic update — add parent and all children
  const allNew: ItemWithRow[] = [parent, ...children].map(item => ({ ...item, sheetRow: -1 }));
  items.value = [...items.value, ...allNew];

  try {
    // Create parent first
    await createItemRow(parent, token);
    await appendAuditEntry(parent.id, 'created', '', '', parent.title, actor, token);

    // Create children sequentially
    for (const child of children) {
      await createItemRow(child, token);
      await appendAuditEntry(child.id, 'created', '', '', child.title, actor, token);
    }

    await refreshItems(token);
    showToast('Item created');
  } catch (err: any) {
    // Rollback all
    const ids = new Set(allNew.map(i => i.id));
    items.value = items.value.filter(i => !ids.has(i.id));
    if (!isReauthFailure(err)) {
      showToast('Failed to create item: ' + err.message, 'error');
    }
  }
}

export async function moveItem(
  itemId: string,
  newStatus: ItemStatus,
  actor: string,
  token: string,
  targetIndex?: number
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
  const oldItems = [...items.value];

  // Get destination column items (root items only, sorted by sort_order)
  const destColumnItems = items.value
    .filter(i => i.status === newStatus && !i.parent_id && i.id !== itemId)
    .sort((a, b) => a.sort_order - b.sort_order);

  // #162: Cascade — find children to update (only for root items, not sub-tasks)
  const children = !item.parent_id
    ? items.value.filter(i => i.parent_id === itemId)
    : [];
  const childrenToUpdate = children.filter(c => c.status !== newStatus);

  if (targetIndex !== undefined) {
    // AC2: Insert at specific position and renumber the destination column
    const movedItem: ItemWithRow = {
      ...applyStatusSideEffects(item, newStatus),
      sheetRow: item.sheetRow,
    };

    // Insert at the requested position
    const reordered = [...destColumnItems];
    const clampedIndex = Math.min(targetIndex, reordered.length);
    reordered.splice(clampedIndex, 0, movedItem);

    // Renumber all items in the destination column densely
    const updates: ItemWithRow[] = reordered.map((it, i) => ({
      ...it,
      sort_order: i + 1,
      updated_at: new Date().toISOString(),
    }));

    // #162: Apply cascade to children optimistically
    const cascadedChildren: ItemWithRow[] = childrenToUpdate.map(c => ({
      ...applyStatusSideEffects(c, newStatus),
      sheetRow: c.sheetRow,
    }));

    // Optimistic update (parent column + cascaded children)
    items.value = items.value.map(i => {
      const colUpdate = updates.find(u => u.id === i.id);
      if (colUpdate) return colUpdate;
      const childUpdate = cascadedChildren.find(c => c.id === i.id);
      if (childUpdate) return childUpdate;
      return i;
    });

    // AC6: Screen reader announcement with position + cascade count
    const totalInColumn = reordered.length;
    const cascadeMsg = childrenToUpdate.length > 0
      ? ` (${childrenToUpdate.length} sub-task${childrenToUpdate.length !== 1 ? 's' : ''} updated)`
      : '';
    showToast(`${item.title} moved to ${newStatus}, position ${clampedIndex + 1} of ${totalInColumn}${cascadeMsg}`);

    try {
      for (const u of updates) {
        await updateItemRow(u.sheetRow, u, token);
      }
      await appendAuditEntry(itemId, 'status_changed', 'status', oldItem.status, newStatus, actor, token);

      // #162: Persist cascade
      for (const child of cascadedChildren) {
        await updateItemRow(child.sheetRow, child, token);
        await appendAuditEntry(child.id, 'status_changed', 'status',
          childrenToUpdate.find(c => c.id === child.id)!.status, newStatus, actor, token);
      }

      await refreshItems(token);
      return true;
    } catch (err: any) {
      items.value = oldItems;
      if (!isReauthFailure(err)) {
        showToast('Failed to move item: ' + err.message, 'error');
      }
      return false;
    }
  }

  // No targetIndex — place item at bottom of target column (sort_order = max + 1)
  const maxSortOrder = destColumnItems.reduce((max, i) => Math.max(max, i.sort_order), 0);

  const updated = {
    ...applyStatusSideEffects(item, newStatus),
    sort_order: maxSortOrder + 1,
    sheetRow: item.sheetRow,
  };

  // #162: Apply cascade to children optimistically
  const cascadedChildren: ItemWithRow[] = childrenToUpdate.map(c => ({
    ...applyStatusSideEffects(c, newStatus),
    sheetRow: c.sheetRow,
  }));

  // Optimistic update (parent + cascaded children)
  items.value = items.value.map(i => {
    if (i.id === itemId) return updated;
    const childUpdate = cascadedChildren.find(c => c.id === i.id);
    if (childUpdate) return childUpdate;
    return i;
  });

  // #162: Toast with cascade count
  const cascadeMsg = childrenToUpdate.length > 0
    ? ` (${childrenToUpdate.length} sub-task${childrenToUpdate.length !== 1 ? 's' : ''} updated)`
    : '';
  showToast(`${item.title} moved to ${newStatus}${cascadeMsg}`);

  try {
    await updateItemRow(item.sheetRow, updated, token);
    await appendAuditEntry(itemId, 'status_changed', 'status', oldItem.status, newStatus, actor, token);

    // #162: Persist cascade
    for (const child of cascadedChildren) {
      await updateItemRow(child.sheetRow, child, token);
      await appendAuditEntry(child.id, 'status_changed', 'status',
        childrenToUpdate.find(c => c.id === child.id)!.status, newStatus, actor, token);
    }

    await refreshItems(token);
    return true;
  } catch (err: any) {
    items.value = oldItems;
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

export async function deleteSubtask(
  itemId: string,
  actor: string,
  token: string
) {
  const item = items.value.find(i => i.id === itemId);
  if (!item) return;

  const oldItems = [...items.value];

  // Optimistic: remove just this sub-task (no children cascade for sub-tasks)
  items.value = items.value.filter(i => i.id !== itemId);

  try {
    // Re-fetch to get current row numbers
    const freshItems = await fetchAllItems(token);
    const freshItem = freshItems.find(i => i.id === itemId);
    if (freshItem) {
      await deleteItemRow(freshItem.sheetRow, token);
      await appendAuditEntry(itemId, 'deleted', '', item.title, '', actor, token);
    }
    await refreshItems(token);
    showToast('Sub-task deleted');
  } catch (err: any) {
    items.value = oldItems;
    if (!isReauthFailure(err)) {
      showToast('Failed to delete sub-task: ' + err.message, 'error');
    }
  }
}

export async function reorderSubtasks(
  itemIdA: string,
  itemIdB: string,
  actor: string,
  token: string
) {
  const itemA = items.value.find(i => i.id === itemIdA);
  const itemB = items.value.find(i => i.id === itemIdB);
  if (!itemA || !itemB) return;

  const oldItems = [...items.value];
  const orderA = itemA.sort_order;
  const orderB = itemB.sort_order;

  // Optimistic: swap sort_order values
  const updatedA: ItemWithRow = { ...itemA, sort_order: orderB, updated_at: new Date().toISOString() };
  const updatedB: ItemWithRow = { ...itemB, sort_order: orderA, updated_at: new Date().toISOString() };
  items.value = items.value.map(i => {
    if (i.id === itemIdA) return updatedA;
    if (i.id === itemIdB) return updatedB;
    return i;
  });

  try {
    await updateItemRow(itemA.sheetRow, updatedA, token);
    await updateItemRow(itemB.sheetRow, updatedB, token);
    await appendAuditEntry(itemIdA, 'reordered', 'sort_order', String(orderA), String(orderB), actor, token);
    await refreshItems(token);
  } catch (err: any) {
    items.value = oldItems;
    if (!isReauthFailure(err)) {
      showToast('Failed to reorder sub-tasks: ' + err.message, 'error');
    }
  }
}

export async function reorderItem(
  itemId: string,
  newIndex: number,
  columnItems: ItemWithRow[],
  actor: string,
  token: string
): Promise<boolean> {
  const item = columnItems.find(i => i.id === itemId);
  if (!item) return false;

  const oldIndex = columnItems.indexOf(item);
  if (oldIndex === newIndex) return true;

  // Build new order: remove the item, insert at newIndex, renumber densely
  const reordered = columnItems.filter(i => i.id !== itemId);
  reordered.splice(newIndex, 0, item);

  const oldItems = [...items.value];
  const updates: ItemWithRow[] = reordered.map((it, i) => ({
    ...it,
    sort_order: i + 1,
    updated_at: new Date().toISOString(),
  }));

  // Optimistic update
  items.value = items.value.map(i => {
    const updated = updates.find(u => u.id === i.id);
    return updated ?? i;
  });

  // AC5: Toast with position announcement (screen reader accessible via aria-live)
  showToast(`${item.title} moved to position ${newIndex + 1} of ${reordered.length} in ${item.status}`);

  try {
    for (const updated of updates) {
      await updateItemRow(updated.sheetRow, updated, token);
    }
    await appendAuditEntry(itemId, 'reordered', 'sort_order', String(oldIndex + 1), String(newIndex + 1), actor, token);
    await refreshItems(token);
    return true;
  } catch (err: any) {
    items.value = oldItems;
    if (!isReauthFailure(err)) {
      showToast('Failed to reorder item: ' + err.message, 'error');
    }
    return false;
  }
}

// --- Profile actions ---

export async function updateDisplayName(
  newName: string,
  email: string,
  oldName: string,
  token: string
): Promise<boolean> {
  // Strip control characters and newlines
  const cleaned = newName.replace(/[\x00-\x1f\x7f]/g, '').trim();

  if (!cleaned) {
    throw new Error('Display name cannot be empty');
  }
  if (cleaned.length > 50) {
    throw new Error('Display name must be 50 characters or fewer');
  }

  // Optimistic update
  const oldItems = [...items.value];
  const oldOwners = [...owners.value];
  owners.value = owners.value.map(o =>
    o.google_account.toLowerCase() === email.toLowerCase()
      ? { ...o, name: cleaned }
      : o
  );
  items.value = items.value.map(i =>
    i.owner === oldName ? { ...i, owner: cleaned } : i
  );

  try {
    await upsertOwner(cleaned, email, token);
    if (oldName && oldName !== cleaned) {
      await cascadeOwnerUpdate(oldName, cleaned, token);
    }
    // Refresh to get server state
    const [freshItems, freshOwners] = await Promise.all([
      fetchAllItems(token),
      fetchOwners(token),
    ]);
    items.value = freshItems;
    owners.value = freshOwners;
    showToast('Display name updated');
    return true;
  } catch (err: any) {
    // Rollback
    items.value = oldItems;
    owners.value = oldOwners;
    if (!isReauthFailure(err)) {
      throw err; // Re-throw so dialog can show inline error
    }
    return false;
  }
}

// --- Label CRUD actions ---

export async function refreshLabels(token: string) {
  try {
    labels.value = await fetchLabels(token);
  } catch (err: any) {
    if (isReauthFailure(err)) return;
    console.error('Label refresh failed:', err);
  }
}

export async function createLabel(
  name: string,
  color: string,
  token: string
) {
  const boardId = activeBoardId.value;
  // Optimistic update
  const oldLabels = [...labels.value];
  labels.value = [...labels.value, { label: name, color, board_id: boardId }];

  try {
    await createLabelRow(name, color, boardId, token);
    await refreshLabels(token);
    showToast('Label created');
  } catch (err: any) {
    labels.value = oldLabels;
    if (!isReauthFailure(err)) {
      showToast('Failed to create label: ' + err.message, 'error');
    }
  }
}

export async function updateLabel(
  oldName: string,
  newName: string,
  newColor: string,
  token: string
) {
  const boardId = activeBoardId.value;
  // Find the label row (scoped to active board)
  const labelsWithRows = await fetchLabelsWithRows(token);
  const labelRow = labelsWithRows.find(l => l.label === oldName && l.board_id === boardId);
  if (!labelRow) {
    showToast('Label not found', 'error');
    return;
  }

  // Optimistic update
  const oldLabels = [...labels.value];
  const oldItems = [...items.value];
  labels.value = labels.value.map(l =>
    l.label === oldName && l.board_id === boardId ? { label: newName, color: newColor, board_id: boardId } : l
  );
  // Also optimistically update items on this board if label was renamed
  if (oldName !== newName) {
    items.value = items.value.map(i => {
      if (i.board_id !== boardId) return i;
      const labelsList = i.labels.split(',').map(x => x.trim()).filter(Boolean);
      if (!labelsList.includes(oldName)) return i;
      const updated = labelsList.map(l => l === oldName ? newName : l);
      return { ...i, labels: updated.join(', ') };
    });
  }

  try {
    await updateLabelRow(labelRow.sheetRow, newName, newColor, boardId, token);
    if (oldName !== newName) {
      await cascadeLabelUpdate(oldName, newName, token, boardId);
    }
    await refreshLabels(token);
    await refreshItems(token);
    showToast('Label updated');
  } catch (err: any) {
    labels.value = oldLabels;
    items.value = oldItems;
    if (!isReauthFailure(err)) {
      showToast('Failed to update label: ' + err.message, 'error');
    }
  }
}

export async function deleteLabel(
  labelName: string,
  token: string
) {
  const boardId = activeBoardId.value;
  // Find the label row (scoped to active board)
  const labelsWithRows = await fetchLabelsWithRows(token);
  const labelRow = labelsWithRows.find(l => l.label === labelName && l.board_id === boardId);
  if (!labelRow) {
    showToast('Label not found', 'error');
    return;
  }

  // Optimistic update — only remove this board's label and update this board's items
  const oldLabels = [...labels.value];
  const oldItems = [...items.value];
  labels.value = labels.value.filter(l => !(l.label === labelName && l.board_id === boardId));
  items.value = items.value.map(i => {
    if (i.board_id !== boardId) return i;
    const labelsList = i.labels.split(',').map(x => x.trim()).filter(Boolean);
    if (!labelsList.includes(labelName)) return i;
    const updated = labelsList.filter(l => l !== labelName);
    return { ...i, labels: updated.join(', ') };
  });

  try {
    await cascadeLabelUpdate(labelName, '', token, boardId);
    await deleteLabelRow(labelRow.sheetRow, token);
    await refreshLabels(token);
    await refreshItems(token);
    showToast('Label deleted');
  } catch (err: any) {
    labels.value = oldLabels;
    items.value = oldItems;
    if (!isReauthFailure(err)) {
      showToast('Failed to delete label: ' + err.message, 'error');
    }
  }
}

// --- Board actions ---

import type { Board } from '../api/types';
import { switchBoard } from './board-store';

export async function createBoard(
  name: string,
  actor: string,
  token: string,
  icon?: string
): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed.length > 30) return false;

  // Check for duplicate name
  if (boards.value.some(b => b.name.toLowerCase() === trimmed.toLowerCase())) {
    return false;
  }

  const board: Board = {
    id: generateUUID(),
    name: trimmed,
    created_at: new Date().toISOString(),
    created_by: actor,
    icon: icon || '',
  };

  // Check if this is the first board — orphaned items need adopting
  const isFirstBoard = boards.value.length === 0;
  const orphanedItems = isFirstBoard
    ? items.value.filter(i => !i.board_id)
    : [];

  // Optimistic update
  boards.value = [...boards.value, board];
  if (orphanedItems.length > 0) {
    items.value = items.value.map(i =>
      !i.board_id ? { ...i, board_id: board.id } : i
    );
  }

  // Optimistic: add owner permission
  const ownerPerm = { board_id: board.id, user_email: actor, role: 'owner' as const };
  permissions.value = [...permissions.value, ownerPerm];

  try {
    await createBoardRowApi(board, token);
    await createPermissionRowApi(ownerPerm, token);

    // Persist board_id for orphaned items
    for (const item of orphanedItems) {
      const updated = { ...item, board_id: board.id };
      await updateItemRow(item.sheetRow, updated, token);
    }

    await appendAuditEntry(board.id, 'board_created', '', '', board.name, actor, token);
    switchBoard(board.id);
    showToast('Board created');
    return true;
  } catch (err: any) {
    // Rollback
    boards.value = boards.value.filter(b => b.id !== board.id);
    permissions.value = permissions.value.filter(p => p.board_id !== board.id);
    if (orphanedItems.length > 0) {
      items.value = items.value.map(i =>
        orphanedItems.some(o => o.id === i.id) ? { ...i, board_id: '' } : i
      );
    }
    if (!isReauthFailure(err)) {
      showToast('Failed to create board: ' + err.message, 'error');
    }
    return false;
  }
}

export async function updateBoardAppearance(
  boardId: string,
  icon: string,
  token: string
): Promise<boolean> {
  const oldBoards = [...boards.value];

  // Optimistic update
  boards.value = boards.value.map(b =>
    b.id === boardId ? { ...b, icon } : b
  );

  try {
    await updateBoardRowApi(boardId, '', icon, token);
    return true;
  } catch (err: any) {
    boards.value = oldBoards;
    if (!isReauthFailure(err)) {
      showToast('Failed to update board: ' + err.message, 'error');
    }
    return false;
  }
}

export async function renameBoardName(
  boardId: string,
  newName: string,
  token: string
): Promise<boolean> {
  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > 30) return false;

  // Duplicate check (case-insensitive, excluding the board being renamed)
  if (boards.value.some(b => b.id !== boardId && b.name.toLowerCase() === trimmed.toLowerCase())) {
    return false;
  }

  const oldBoards = [...boards.value];

  // Optimistic update
  boards.value = boards.value.map(b =>
    b.id === boardId ? { ...b, name: trimmed } : b
  );

  // Update document title if this is the active board
  if (activeBoardId.value === boardId) {
    document.title = `Hive \u2014 ${trimmed}`;
  }

  try {
    await renameBoardRowApi(boardId, trimmed, token);
    showToast('Board renamed');
    return true;
  } catch (err: any) {
    // Rollback
    boards.value = oldBoards;
    if (activeBoardId.value === boardId) {
      const original = oldBoards.find(b => b.id === boardId);
      if (original) document.title = `Hive \u2014 ${original.name}`;
    }
    if (!isReauthFailure(err)) {
      showToast('Failed to rename board: ' + err.message, 'error');
    }
    return false;
  }
}

// --- Board sharing actions ---

import type { BoardPermission } from '../api/types';

export async function shareBoard(
  boardId: string,
  userEmail: string,
  role: BoardPermission['role'],
  actor: string,
  token: string
): Promise<boolean> {
  // Check if already shared
  const existing = permissions.value.find(
    p => p.board_id === boardId && p.user_email.toLowerCase() === userEmail.toLowerCase()
  );
  if (existing) {
    showToast('Already shared with this user', 'error');
    return false;
  }

  const perm: BoardPermission = { board_id: boardId, user_email: userEmail, role };

  // Optimistic update
  permissions.value = [...permissions.value, perm];

  try {
    await createPermissionRowApi(perm, token);
    await appendAuditEntry(boardId, 'board_shared', 'user_email', '', userEmail, actor, token);
    return true;
  } catch (err: any) {
    permissions.value = permissions.value.filter(
      p => !(p.board_id === boardId && p.user_email.toLowerCase() === userEmail.toLowerCase())
    );
    if (!isReauthFailure(err)) {
      showToast('Failed to share board: ' + err.message, 'error');
    }
    return false;
  }
}

export async function unshareBoard(
  boardId: string,
  userEmail: string,
  actor: string,
  token: string
): Promise<boolean> {
  const oldPerms = [...permissions.value];

  // Optimistic update
  permissions.value = permissions.value.filter(
    p => !(p.board_id === boardId && p.user_email.toLowerCase() === userEmail.toLowerCase())
  );

  try {
    await deletePermissionRowApi(boardId, userEmail, token);
    await appendAuditEntry(boardId, 'board_unshared', 'user_email', userEmail, '', actor, token);
    return true;
  } catch (err: any) {
    permissions.value = oldPerms;
    if (!isReauthFailure(err)) {
      showToast('Failed to remove member: ' + err.message, 'error');
    }
    return false;
  }
}

export async function refreshPermissions(token: string) {
  try {
    permissions.value = await fetchPermissionsApi(token);
  } catch (err: any) {
    if (isReauthFailure(err)) return;
    console.error('Permission refresh failed:', err);
  }
}

// --- Delete board ---

import { accessibleBoards } from './board-store';

// --- Move item to another board ---

export async function moveItemToBoard(
  itemId: string,
  targetBoardId: string,
  actor: string,
  token: string
): Promise<boolean> {
  const item = items.value.find(i => i.id === itemId);
  if (!item) return false;

  const oldBoardId = item.board_id;
  if (oldBoardId === targetBoardId) return false;

  // Collect item + all subtasks
  const subtasks = items.value.filter(i => i.parent_id === itemId);
  const allItems = [item, ...subtasks];

  const oldItems = [...items.value];

  // Optimistic update: change board_id for item and subtasks
  items.value = items.value.map(i => {
    if (i.id === itemId || i.parent_id === itemId) {
      return { ...i, board_id: targetBoardId, updated_at: new Date().toISOString() };
    }
    return i;
  });

  // Close the detail panel
  selectedItemId.value = null;

  const targetBoard = boards.value.find(b => b.id === targetBoardId);
  const targetName = targetBoard?.name || 'another board';
  showToast(`Item moved to ${targetName}`);

  try {
    // Persist board_id changes
    for (const it of allItems) {
      await updateItemBoardIdApi(it.sheetRow, targetBoardId, token);
    }
    // Audit log
    await appendAuditEntry(itemId, 'board_moved', 'board_id', oldBoardId, targetBoardId, actor, token);
    await refreshItems(token);
    return true;
  } catch (err: any) {
    // Rollback
    items.value = oldItems;
    selectedItemId.value = itemId;
    if (!isReauthFailure(err)) {
      showToast('Failed to move item: ' + err.message, 'error');
    }
    return false;
  }
}

export type DeleteBoardMode = 'discard' | 'migrate';

export async function deleteBoard(
  boardId: string,
  mode: DeleteBoardMode | null,
  targetBoardId: string | null,
  actor: string,
  token: string
): Promise<boolean> {
  const board = boards.value.find(b => b.id === boardId);
  if (!board) return false;

  // Snapshot for rollback
  const oldBoards = [...boards.value];
  const oldPerms = [...permissions.value];
  const oldItems = [...items.value];

  const boardItemsList = items.value.filter(i => i.board_id === boardId);

  // Optimistic update
  boards.value = boards.value.filter(b => b.id !== boardId);
  permissions.value = permissions.value.filter(p => p.board_id !== boardId);

  if (mode === 'migrate' && targetBoardId) {
    items.value = items.value.map(i =>
      i.board_id === boardId ? { ...i, board_id: targetBoardId } : i
    );
  } else if (mode === 'discard') {
    items.value = items.value.filter(i => i.board_id !== boardId);
  }

  // Switch to another board
  const remaining = accessibleBoards.value;
  if (targetBoardId && remaining.some(b => b.id === targetBoardId)) {
    switchBoard(targetBoardId);
  } else if (remaining.length > 0) {
    switchBoard(remaining[0].id);
  }

  try {
    // Perform item operations
    if (mode === 'migrate' && targetBoardId) {
      for (const item of boardItemsList) {
        await updateItemBoardIdApi(item.sheetRow, targetBoardId, token);
      }
    } else if (mode === 'discard') {
      // Delete from bottom to top to avoid row shifting
      const sorted = [...boardItemsList].sort((a, b) => b.sheetRow - a.sheetRow);
      for (const item of sorted) {
        await deleteItemRow(item.sheetRow, token);
      }
      // Re-fetch to get updated row numbers
      await refreshItems(token);
    }

    // Delete all permission rows for this board
    await deleteAllBoardPermissionsApi(boardId, token);

    // Delete the board row itself
    await deleteBoardRowApi(boardId, token);

    // Audit entry
    await appendAuditEntry(boardId, 'board_deleted', '', board.name, '', actor, token);

    // Refresh state from server
    const [freshBoards, freshPerms, freshItems] = await Promise.all([
      fetchBoardsApi(token),
      fetchPermissionsApi(token),
      fetchAllItems(token),
    ]);
    boards.value = freshBoards;
    permissions.value = freshPerms;
    items.value = freshItems;

    // Toast
    if (mode === 'migrate' && targetBoardId) {
      const targetBoard = freshBoards.find(b => b.id === targetBoardId);
      const targetName = targetBoard?.name || 'another board';
      showToast(`${board.name} deleted \u2014 ${boardItemsList.length} item${boardItemsList.length !== 1 ? 's' : ''} moved to ${targetName}`);
    } else {
      showToast(`${board.name} deleted`);
    }

    return true;
  } catch (err: any) {
    // Rollback
    boards.value = oldBoards;
    permissions.value = oldPerms;
    items.value = oldItems;
    // Restore active board
    switchBoard(boardId);
    if (!isReauthFailure(err)) {
      showToast('Failed to delete board: ' + err.message, 'error');
    }
    return false;
  }
}
