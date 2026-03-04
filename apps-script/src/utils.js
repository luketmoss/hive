// Utility functions for sheet access and data mapping.

function getSpreadsheetId() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID not set in script properties');
  return id;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(getSpreadsheetId());
}

function getSheet(name) {
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found');
  return sheet;
}

function generateUUID() {
  return Utilities.getUuid();
}

function isoNow() {
  return new Date().toISOString();
}

function rowToItem(row) {
  return {
    id: row[COL.ID] || '',
    title: row[COL.TITLE] || '',
    description: row[COL.DESCRIPTION] || '',
    status: row[COL.STATUS] || 'To Do',
    owner: row[COL.OWNER] || '',
    due_date: row[COL.DUE_DATE] ? String(row[COL.DUE_DATE]) : '',
    scheduled_date: row[COL.SCHEDULED_DATE] ? String(row[COL.SCHEDULED_DATE]) : '',
    labels: row[COL.LABELS] || '',
    parent_id: row[COL.PARENT_ID] || '',
    created_at: row[COL.CREATED_AT] ? String(row[COL.CREATED_AT]) : '',
    updated_at: row[COL.UPDATED_AT] ? String(row[COL.UPDATED_AT]) : '',
    completed_at: row[COL.COMPLETED_AT] ? String(row[COL.COMPLETED_AT]) : '',
    sort_order: Number(row[COL.SORT_ORDER]) || 0,
    created_by: row[COL.CREATED_BY] || '',
  };
}

function itemToRow(item) {
  return [
    item.id,
    item.title,
    item.description,
    item.status,
    item.owner,
    item.due_date,
    item.scheduled_date,
    item.labels,
    item.parent_id,
    item.created_at,
    item.updated_at,
    item.completed_at,
    item.sort_order,
    item.created_by,
  ];
}

/** Find the 1-based sheet row number for an item by ID. Returns -1 if not found. */
function findRowByItemId(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === id) {
      return i + 2;
    }
  }
  return -1;
}

/** Get all data rows from a sheet (skipping header row). */
function getAllRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

/** Get the next sort order value for a given status column. */
function getNextSortOrder(items, status) {
  var maxOrder = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].status === status && items[i].sort_order > maxOrder) {
      maxOrder = items[i].sort_order;
    }
  }
  return maxOrder + 1;
}
