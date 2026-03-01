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

  // Any → Done: all children must be Done
  if (newStatus === 'Done') {
    const children = allItems.filter(i => i.parent_id === item.id);
    const incompleteChildren = children.filter(i => i.status !== 'Done');
    if (incompleteChildren.length > 0) {
      const names = incompleteChildren.map(c => c.title).join(', ');
      return {
        valid: false,
        error: `Cannot mark as Done: ${incompleteChildren.length} sub-task(s) not complete (${names})`,
      };
    }
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
