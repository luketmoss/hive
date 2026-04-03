// Client-side business rule validation.
// IMPORTANT: This logic is duplicated in apps-script/src/rules.js. Keep in sync.

import type { Item, ItemStatus } from '../api/types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Status-specific business rules removed in #218. All transitions are now allowed.
// These functions are kept for backward compatibility with existing callers.

export function validateStatusTransition(
  _item: Item,
  _newStatus: ItemStatus,
  _allItems: Item[]
): ValidationResult {
  return { valid: true };
}

export function validateOwnerChange(
  _item: Item,
  _newOwner: string
): ValidationResult {
  return { valid: true };
}

export function applyStatusSideEffects(item: Item, newStatus: ItemStatus, isTerminal?: boolean): Item {
  const now = new Date().toISOString();

  let completed_at = item.completed_at;
  if (isTerminal) {
    // Moving to a terminal column — set completed_at
    completed_at = now;
  } else if (item.completed_at && isTerminal === false) {
    // Moving away from a terminal column — clear completed_at
    completed_at = '';
  }

  return {
    ...item,
    status: newStatus,
    updated_at: now,
    completed_at,
  };
}
