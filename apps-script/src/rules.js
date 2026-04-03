// Business rule enforcement for status transitions and side effects.
// IMPORTANT: This logic is duplicated in frontend/src/state/rules.ts. Keep in sync.

// Status-specific business rules removed in #218. All validation is now dynamic per board.
// These functions are kept for backward compatibility but return permissive defaults.

function validateStatusTransition(item, newStatus, allItems) {
  // All transitions allowed — per-column rules now managed via board settings
  return { valid: true };
}

function validateOwnerChange(item, newOwner) {
  // All owner changes allowed — per-column requirements now managed via board settings
  return { valid: true };
}

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
 * Check if a parent item is ready to be completed after a child was updated.
 * Returns the parent ID if all siblings are now Done, null otherwise.
 */
function checkParentCompletion(item, allItems) {
  if (!item.parent_id) return null;
  var siblings = allItems.filter(function(i) { return i.parent_id === item.parent_id; });
  var allDone = siblings.every(function(i) { return i.status === 'Done'; });
  return allDone ? item.parent_id : null;
}
