// Client-side business rule validation.
// IMPORTANT: This logic is duplicated in apps-script/src/rules.js. Keep in sync.

import type { Item, ItemStatus } from '../api/types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateStatusTransition(
  item: Item,
  newStatus: ItemStatus,
  allItems: Item[]
): ValidationResult {
  if (item.status === newStatus) {
    return { valid: true };
  }

  // To Do → In Progress: owner must be set
  if (item.status === 'To Do' && newStatus === 'In Progress') {
    if (!item.owner) {
      return { valid: false, error: 'Cannot move to In Progress: owner must be assigned' };
    }
  }

  // Note: the "all children must be Done" check was removed in #162.
  // Moving a parent to Done now cascades the status to all children automatically.

  return { valid: true };
}

export function validateOwnerChange(
  item: Item,
  newOwner: string
): ValidationResult {
  // Cannot remove owner from an "In Progress" item
  if (item.status === 'In Progress' && !newOwner) {
    return { valid: false, error: 'Cannot remove owner from In Progress items' };
  }
  return { valid: true };
}

export function applyStatusSideEffects(item: Item, newStatus: ItemStatus): Item {
  const now = new Date().toISOString();
  return {
    ...item,
    status: newStatus,
    updated_at: now,
    completed_at: newStatus === 'Done' ? now : (item.status === 'Done' ? '' : item.completed_at),
  };
}
