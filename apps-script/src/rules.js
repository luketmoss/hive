// Business rule enforcement for status transitions and side effects.
// IMPORTANT: This logic is duplicated in frontend/src/state/rules.ts. Keep in sync.

function validateStatusTransition(item, newStatus, allItems) {
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
    var children = allItems.filter(function(i) { return i.parent_id === item.id; });
    var incompleteChildren = children.filter(function(i) { return i.status !== 'Done'; });
    if (incompleteChildren.length > 0) {
      var names = incompleteChildren.map(function(c) { return c.title; }).join(', ');
      return {
        valid: false,
        error: 'Cannot mark as Done: ' + incompleteChildren.length + ' sub-task(s) not complete (' + names + ')',
      };
    }
  }

  // Done → To Do or In Progress: always allowed (reopening)
  return { valid: true };
}

function validateOwnerChange(item, newOwner) {
  // Cannot remove owner from an "In Progress" item
  if (item.status === 'In Progress' && !newOwner) {
    return { valid: false, error: 'Cannot remove owner from In Progress items' };
  }
  return { valid: true };
}

function applyStatusSideEffects(item, newStatus) {
  var updated = {};
  for (var key in item) {
    updated[key] = item[key];
  }
  updated.status = newStatus;
  updated.updated_at = isoNow();

  if (newStatus === 'Done') {
    updated.completed_at = isoNow();
  } else if (item.status === 'Done' && newStatus !== 'Done') {
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
