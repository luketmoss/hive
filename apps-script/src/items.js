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
  var status = (data.status && VALID_STATUSES.indexOf(data.status) !== -1)
    ? data.status
    : 'To Do';

  var now = isoNow();
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
    completed_at: status === 'Done' ? now : '',
    sort_order: data.sort_order != null ? data.sort_order : getNextSortOrder(allItems, status),
    created_by: data.created_by || actor,
    board_id: data.board_id || '',
  };

  if (item.status === 'In Progress' && !item.owner) {
    throw new Error('Cannot create item in In Progress status without an owner');
  }

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
    if (VALID_STATUSES.indexOf(newStatus) === -1) {
      throw new Error('Invalid status: "' + changes.status + '"');
    }

    var itemForValidation = changes.owner
      ? Object.assign({}, item, { owner: changes.owner })
      : item;

    var validation = validateStatusTransition(itemForValidation, newStatus, allItems);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    var oldStatus = item.status;
    item = applyStatusSideEffects(item, newStatus);
    writeAuditEntry(id, 'status_changed', 'status', oldStatus, newStatus, actor);
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
        var updatedChild = applyStatusSideEffects(child, changes.status);
        updatedChild.updated_at = isoNow();
        var childRowNum = findRowByItemId(sheet, child.id);
        if (childRowNum !== -1) {
          sheet.getRange(childRowNum, 1, 1, ITEM_COLUMN_COUNT).setValues([itemToRow(updatedChild)]);
          writeAuditEntry(child.id, 'status_changed', 'status', childOldStatus, changes.status, actor);
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

function deleteItem(id, actor) {
  actor = actor || 'api';

  var sheet = getSheet('Items');
  var rowNum = findRowByItemId(sheet, id);
  if (rowNum === -1) {
    throw new Error('Item "' + id + '" not found');
  }

  var row = sheet.getRange(rowNum, 1, 1, ITEM_COLUMN_COUNT).getValues()[0];
  var item = rowToItem(row);

  // Delete children first
  var allItems = getItems();
  var children = allItems.filter(function(i) { return i.parent_id === id; });
  for (var i = 0; i < children.length; i++) {
    deleteItem(children[i].id, actor);
  }

  // Re-find row (may have shifted due to child deletions)
  var currentRowNum = findRowByItemId(sheet, id);
  if (currentRowNum !== -1) {
    sheet.deleteRow(currentRowNum);
    writeAuditEntry(id, 'deleted', '', item.title, '', actor);
  }
}
