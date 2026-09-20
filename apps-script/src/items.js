// CRUD operations for the Items sheet.

function getItems(filters) {
  var rows = getAllRows(getSheet('Items'));
  var items = rows.map(rowToItem);

  if (filters) {
    if (filters.status) {
      items = items.filter(function(i) { return i.status === filters.status; });
    }
    if (filters.owner) {
      items = items.filter(function(i) { return i.owner === filters.owner; });
    }
    if (filters.label) {
      var label = filters.label;
      items = items.filter(function(i) {
        return i.labels.split(',').map(function(l) { return l.trim(); }).indexOf(label) !== -1;
      });
    }
    if (filters.parent_id) {
      var pid = filters.parent_id;
      items = items.filter(function(i) { return i.parent_id === pid; });
    }
    if (filters.board_id) {
      var bid = filters.board_id;
      items = items.filter(function(i) { return i.board_id === bid; });
    }
    if (filters.roots_only === 'true') {
      items = items.filter(function(i) { return !i.parent_id; });
    }
    if (filters.due_after) {
      var dueAfter = filters.due_after;
      items = items.filter(function(i) { return i.due_date && i.due_date >= dueAfter; });
    }
    if (filters.due_before) {
      var dueBefore = filters.due_before;
      items = items.filter(function(i) { return i.due_date && i.due_date <= dueBefore; });
    }
  }

  return items.sort(function(a, b) { return a.sort_order - b.sort_order; });
}

function getItem(id) {
  var sheet = getSheet('Items');
  var rowNum = findRowByItemId(sheet, id);
  if (rowNum === -1) return null;

  var row = sheet.getRange(rowNum, 1, 1, ITEM_COLUMN_COUNT).getValues()[0];
  return rowToItem(row);
}

function createItem(data, actor) {
  actor = actor || 'api';

  if (!data.title) {
    throw new Error('title is required');
  }

  var allItems = getItems();

  // Validate status against board's defined statuses, or fall back to hardcoded list
  var validStatuses = [];
  if (data.board_id) {
    var boardStatuses = getStatuses(data.board_id);
    validStatuses = boardStatuses.map(function(s) { return s.name; });
  }
  if (validStatuses.length === 0) {
    validStatuses = VALID_STATUSES; // Fallback to hardcoded for boards without statuses
  }

  var status = (data.status && validStatuses.indexOf(data.status) !== -1)
    ? data.status
    : validStatuses[0]; // Default to first valid status

  var now = isoNow();

  // Determine if this status is terminal (completed)
  var isTerminalStatus = false;
  if (data.board_id) {
    var boardStatuses = getStatuses(data.board_id);
    var statusObj = boardStatuses.find(function(s) { return s.name === status; });
    isTerminalStatus = statusObj ? statusObj.is_terminal : false;
  }

  var item = {
    id: generateUUID(),
    title: data.title,
    description: data.description || '',
    status: status,
    owner: data.owner || '',
    due_date: data.due_date || '',
    labels: data.labels || '',
    parent_id: data.parent_id || '',
    created_at: now,
    updated_at: now,
    completed_at: isTerminalStatus ? now : '',
    sort_order: data.sort_order != null ? data.sort_order : getNextSortOrder(allItems, status),
    created_by: data.created_by || actor,
    board_id: data.board_id || '',
  };

  var sheet = getSheet('Items');
  sheet.appendRow(itemToRow(item));

  writeAuditEntry(item.id, 'created', '', '', item.title, actor);

  return item;
}

function updateItem(id, changes, actor) {
  actor = actor || 'api';

  var sheet = getSheet('Items');
  var rowNum = findRowByItemId(sheet, id);
  if (rowNum === -1) {
    throw new Error('Item "' + id + '" not found');
  }

  var row = sheet.getRange(rowNum, 1, 1, ITEM_COLUMN_COUNT).getValues()[0];
  var item = rowToItem(row);
  var allItems = getItems();
  var originalStatus = item.status; // #162: capture before any changes

  // Handle status change with business rules
  if (changes.status && changes.status !== item.status) {
    var newStatus = changes.status;

    // Validate status against board's defined statuses, or fall back to hardcoded list
    var validStatuses = [];
    if (item.board_id) {
      var boardStatuses = getStatuses(item.board_id);
      validStatuses = boardStatuses.map(function(s) { return s.name; });
    }
    if (validStatuses.length === 0) {
      validStatuses = VALID_STATUSES; // Fallback for boards without statuses
    }

    if (validStatuses.indexOf(newStatus) === -1) {
      throw new Error('Invalid status: "' + changes.status + '"');
    }

    // Determine if target status is terminal
    var isTerminal = false;
    if (item.board_id) {
      var boardStatuses = getStatuses(item.board_id);
      var targetStatus = boardStatuses.find(function(s) { return s.name === newStatus; });
      isTerminal = targetStatus ? targetStatus.is_terminal : false;
    }

    var oldStatus = item.status;
    // #239: the verdict must be taken before applyStatusSideEffects, which
    // clears completed_at — `item` is reassigned over on the next line.
    var completionAction = statusTransitionAuditAction(item, isTerminal);
    item = applyStatusSideEffects(item, newStatus, isTerminal);
    writeAuditEntry(id, 'status_changed', 'status', oldStatus, newStatus, actor);
    if (completionAction) {
      writeAuditEntry(id, completionAction, 'status', oldStatus, newStatus, actor);
    }
  }

  // Apply other field changes
  var updatableFields = [
    'title', 'description', 'owner', 'due_date',
    'labels', 'parent_id', 'sort_order', 'board_id',
  ];

  for (var i = 0; i < updatableFields.length; i++) {
    var field = updatableFields[i];
    if (changes[field] !== undefined && changes[field] !== item[field]) {
      var oldValue = String(item[field]);
      var newValue = String(changes[field]);
      item[field] = changes[field];
      writeAuditEntry(id, 'updated', field, oldValue, newValue, actor);
    }
  }

  item.updated_at = isoNow();

  var updatedRow = itemToRow(item);
  sheet.getRange(rowNum, 1, 1, ITEM_COLUMN_COUNT).setValues([updatedRow]);

  // #162: Cascade status to children when a parent item's status changes.
  // Only cascade for root items (no parent_id) that had a status change.
  if (changes.status && changes.status !== originalStatus && !item.parent_id) {
    var allItemsForCascade = getItems();
    var childItems = allItemsForCascade.filter(function(i) { return i.parent_id === id; });
    for (var c = 0; c < childItems.length; c++) {
      var child = childItems[c];
      if (child.status !== changes.status) {
        var childOldStatus = child.status;
        var childIsTerminal = false;
        if (item.board_id) {
          var childBoardStatuses = getStatuses(item.board_id);
          var childTargetStatus = childBoardStatuses.find(function(s) { return s.name === changes.status; });
          childIsTerminal = childTargetStatus ? childTargetStatus.is_terminal : false;
        }
        // #239: as above — the verdict is taken from the pre-update child.
        var childCompletionAction = statusTransitionAuditAction(child, childIsTerminal);
        var updatedChild = applyStatusSideEffects(child, changes.status, childIsTerminal);
        updatedChild.updated_at = isoNow();
        var childRowNum = findRowByItemId(sheet, child.id);
        if (childRowNum !== -1) {
          sheet.getRange(childRowNum, 1, 1, ITEM_COLUMN_COUNT).setValues([itemToRow(updatedChild)]);
          writeAuditEntry(child.id, 'status_changed', 'status', childOldStatus, changes.status, actor);
          if (childCompletionAction) {
            writeAuditEntry(child.id, childCompletionAction, 'status', childOldStatus, changes.status, actor);
          }
        }
      }
    }
  }

  // Check if parent is now ready to complete
  var refreshedItems = getItems();
  var readyParent = checkParentCompletion(item, refreshedItems);
  if (readyParent) {
    writeAuditEntry(readyParent, 'parent_ready', '', '', 'All sub-tasks complete', actor);
  }

  return item;
}

/**
 * #244: The full cascade a delete of `rootId` would remove — the item itself at
 * depth 0, then every descendant, deepest last.
 *
 * Breadth-first from the root so `depth` is honest, and guarded against a
 * parent_id cycle: an item already collected is never queued twice, so a
 * malformed sheet produces a finite preview rather than a hang.
 *
 * @param {string} rootId
 * @param {Array<Object>} allItems - every item on the Items tab
 * @returns {Array<Object>} [{ id, title, parent_id, depth }], root first
 */
function collectDeleteCascade(rootId, allItems) {
  var root = null;
  for (var i = 0; i < allItems.length; i++) {
    if (allItems[i].id === rootId) {
      root = allItems[i];
      break;
    }
  }
  if (!root) return [];

  var collected = [{ id: root.id, title: root.title, parent_id: root.parent_id, depth: 0 }];
  var seen = {};
  seen[root.id] = true;

  var frontier = [root.id];
  var depth = 0;
  while (frontier.length > 0) {
    depth++;
    var next = [];
    for (var f = 0; f < frontier.length; f++) {
      var parentId = frontier[f];
      for (var c = 0; c < allItems.length; c++) {
        var candidate = allItems[c];
        if (candidate.parent_id !== parentId) continue;
        if (seen[candidate.id]) continue;
        seen[candidate.id] = true;
        collected.push({
          id: candidate.id,
          title: candidate.title,
          parent_id: candidate.parent_id,
          depth: depth,
        });
        next.push(candidate.id);
      }
    }
    frontier = next;
  }

  return collected;
}

/**
 * #244: A deterministic token over the ids a preview reported.
 *
 * This is a drift detector, not a secret. FNV-1a in plain JS rather than
 * `Utilities.computeDigest` so it has no Google global behind it and can be
 * driven directly from the test sandbox. Ids are sorted first: the token must
 * describe the *set* being deleted, not the order the walk happened to find it.
 *
 * @param {Array<Object>} cascade - as collectDeleteCascade returns
 * @returns {string} an 8-character hex token
 */
function cascadeToken(cascade) {
  var ids = cascade.map(function(entry) { return entry.id; }).sort();
  var input = ids.join('|');
  var hash = 0x811c9dc5;
  for (var i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV prime 16777619, via shifts to stay inside 32 bits.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  var hex = hash.toString(16);
  while (hex.length < 8) hex = '0' + hex;
  return hex;
}

/** The preview envelope both the dry run and a drift rejection return. */
function buildDeletePreview(cascade) {
  return {
    dry_run: true,
    root: cascade.length ? { id: cascade[0].id, title: cascade[0].title } : null,
    count: cascade.length,
    items: cascade,
    token: cascadeToken(cascade),
  };
}

/**
 * #244: Delete an item and every descendant — dry-run by default.
 *
 * Without `options.confirm` nothing is written: the return value is the full
 * blast radius plus a token. A confirm must present that token, and the cascade
 * is re-derived and re-tokenised at confirm time — if a child was added or
 * moved since the preview, the call is refused with a fresh preview attached
 * rather than deleting something the caller was never shown.
 *
 * This is a speed bump, not a permission check. A caller can dry-run and
 * immediately confirm without reading the preview; it protects against
 * mistakes, not against a determined caller. Deleting remains unrecoverable —
 * the Audit Log keeps the title and the cascade shape, not the row.
 *
 * @param {string} id
 * @param {string} [actor]
 * @param {Object} [options] - { confirm: boolean, token: string }
 * @returns {Object} the preview (dry run) or the result (confirmed delete)
 */
function deleteItem(id, actor, options) {
  actor = actor || 'api';
  options = options || {};

  var sheet = getSheet('Items');
  if (findRowByItemId(sheet, id) === -1) {
    throw new Error('Item "' + id + '" not found');
  }

  var cascade = collectDeleteCascade(id, getItems());

  if (!options.confirm) {
    return buildDeletePreview(cascade);
  }

  if (!options.token) {
    throw new Error(
      'confirm requires the token from a dry run — call deleteItem without ' +
      '"confirm" first to see what would be removed'
    );
  }

  var token = cascadeToken(cascade);
  if (options.token !== token) {
    var err = new Error(
      'The cascade changed since the preview — ' + cascade.length +
      ' item(s) would now be removed. Nothing was deleted. Re-run with the new token.'
    );
    err.preview = buildDeletePreview(cascade);
    throw err;
  }

  // Deepest first, so a parent is never removed before its children. Each row
  // number is re-found immediately before its deleteRow: every delete shifts
  // the rows beneath it, so a row number read earlier in this loop would point
  // at the wrong record (CLAUDE.md: row deletion runs bottom-to-top).
  var ordered = cascade.slice().sort(function(a, b) { return b.depth - a.depth; });
  var deleted = [];
  for (var i = 0; i < ordered.length; i++) {
    var entry = ordered[i];
    var currentRowNum = findRowByItemId(sheet, entry.id);
    if (currentRowNum === -1) continue;
    sheet.deleteRow(currentRowNum);
    // The root keeps today's audit shape; a descendant records the id the
    // delete was called on, so the subtree can be reconstructed from the log.
    var isRoot = entry.depth === 0;
    writeAuditEntry(
      entry.id,
      'deleted',
      isRoot ? '' : 'cascade_root',
      entry.title,
      isRoot ? '' : id,
      actor
    );
    deleted.push(entry);
  }

  return {
    dry_run: false,
    root: cascade.length ? { id: cascade[0].id, title: cascade[0].title } : null,
    count: deleted.length,
    items: cascade,
    token: token,
  };
}
