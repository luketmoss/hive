// Client-side business rule helpers.
// applyStatusSideEffects and statusTransitionAuditAction are duplicated in
// apps-script/src/rules.js — keep in sync.

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

/**
 * #239: The durable completion event for a status change, or null if the move
 * is neither a completion nor a reopening.
 *
 * The branches mirror applyStatusSideEffects exactly — that is the point.
 * `completed_at` records whether an item is *currently* done and is cleared on
 * the way out; the Audit Log records that it *was* done on a given day and
 * never changes. Emitting the verdict as its own action keeps it self-describing:
 * an audit row stores a status name, and `is_terminal` is a mutable per-board
 * flag, so a consumer inferring completion from a historical status name would
 * silently reinterpret history whenever a column is reconfigured.
 *
 * MUST be called with the item as it was *before* applyStatusSideEffects, which
 * clears completed_at.
 */
export function statusTransitionAuditAction(
  item: Pick<Item, 'completed_at'>,
  isTerminal: boolean
): 'completed' | 'reopened' | null {
  if (isTerminal) return 'completed';
  if (item.completed_at) return 'reopened';
  return null;
}
