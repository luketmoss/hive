// Client-side business rule helpers.
// applyStatusSideEffects is duplicated in apps-script/src/rules.js — keep in sync.

import type { Item, ItemStatus } from '../api/types';

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
