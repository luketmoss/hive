// Business rule helpers.
// applyStatusSideEffects and statusTransitionAuditAction are duplicated in
// frontend/src/state/rules.ts — keep in sync.

function applyStatusSideEffects(item, newStatus, isTerminal) {
  var updated = {};
  for (var key in item) {
    updated[key] = item[key];
  }
  updated.status = newStatus;
  updated.updated_at = isoNow();

  // isTerminal parameter: set completed_at if moving to a terminal column
  if (isTerminal) {
    updated.completed_at = isoNow();
  } else if (item.completed_at) {
    // Clearing completed_at when moving away from a terminal status
    updated.completed_at = '';
  }

  return updated;
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
 *
 * @param {Object} item - the item before the status change
 * @param {boolean} isTerminal - whether the target status is terminal
 * @returns {string|null} 'completed', 'reopened', or null
 */
function statusTransitionAuditAction(item, isTerminal) {
  if (isTerminal) return 'completed';
  if (item.completed_at) return 'reopened';
  return null;
}

/**
 * Check if a parent item is ready to be completed after a child was updated.
 * Returns the parent ID if all siblings are now Done, null otherwise.
 */
function checkParentCompletion(item, allItems) {
  if (!item.parent_id) return null;
  var siblings = allItems.filter(function(i) { return i.parent_id === item.parent_id; });
  var allDone = siblings.every(function(i) { return i.status === 'Done'; });
  return allDone ? item.parent_id : null;
}
