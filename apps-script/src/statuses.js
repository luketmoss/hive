// Status/Column CRUD for Hive Kanban Board
// Each status (column) is per-board and has: id, board_id, name, sort_order, color, is_terminal, created_at

var STATUS_COL = {
  ID: 0,
  BOARD_ID: 1,
  NAME: 2,
  SORT_ORDER: 3,
  COLOR: 4,
  IS_TERMINAL: 5,
  CREATED_AT: 6,
};

var STATUS_COLUMN_COUNT = 7;

/**
 * Gets all statuses for a specific board, sorted by sort_order.
 * @param {string} boardId - Board ID to fetch statuses for
 * @returns {Array<Object>} Array of status objects
 */
function getStatuses(boardId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Statuses');
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var rows = sheet.getRange(2, 1, lastRow - 1, STATUS_COLUMN_COUNT).getValues();
  var statuses = rows.map(function(row) {
    return {
      id: row[STATUS_COL.ID] || '',
      board_id: row[STATUS_COL.BOARD_ID] || '',
      name: row[STATUS_COL.NAME] || '',
      sort_order: row[STATUS_COL.SORT_ORDER] || 0,
      color: row[STATUS_COL.COLOR] || '',
      is_terminal: row[STATUS_COL.IS_TERMINAL] === true || row[STATUS_COL.IS_TERMINAL] === 'TRUE',
      created_at: row[STATUS_COL.CREATED_AT] ? String(row[STATUS_COL.CREATED_AT]) : '',
    };
  });

  // Filter by board_id and sort by sort_order
  return statuses
    .filter(function(s) { return s.board_id === boardId; })
    .sort(function(a, b) { return a.sort_order - b.sort_order; });
}

/**
 * Creates a new status for a board.
 * @param {Object} data - { id, board_id, name, sort_order, color, is_terminal }
 * @returns {boolean} Success
 */
function createStatus(data) {
  if (!data.id || !data.board_id || !data.name) {
    throw new Error('Status requires: id, board_id, name');
  }

  // Validate: name must be unique within the board
  var existing = getStatuses(data.board_id);
  if (existing.some(function(s) { return s.name.toLowerCase() === data.name.toLowerCase(); })) {
    throw new Error('Status name "' + data.name + '" already exists for this board');
  }

  // Ensure Statuses sheet exists
  ensureStatusesSheet();

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Statuses');
  var row = [
    data.id,
    data.board_id,
    data.name,
    data.sort_order || 0,
    data.color || '',
    data.is_terminal ? 'TRUE' : 'FALSE',
    data.created_at || new Date().toISOString(),
  ];

  sheet.appendRow(row);
  return true;
}

/**
 * Updates an existing status.
 * @param {string} statusId - Status ID
 * @param {Object} changes - Fields to update: { name, sort_order, color, is_terminal }
 * @returns {boolean} Success
 */
function updateStatus(statusId, changes) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Statuses');
  if (!sheet) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var rows = sheet.getRange(2, 1, lastRow - 1, STATUS_COLUMN_COUNT).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][STATUS_COL.ID] === statusId) {
      var sheetRow = i + 2; // 1-based, account for header

      if (changes.name !== undefined) {
        sheet.getRange(sheetRow, STATUS_COL.NAME + 1).setValue(changes.name);
      }
      if (changes.sort_order !== undefined) {
        sheet.getRange(sheetRow, STATUS_COL.SORT_ORDER + 1).setValue(changes.sort_order);
      }
      if (changes.color !== undefined) {
        sheet.getRange(sheetRow, STATUS_COL.COLOR + 1).setValue(changes.color);
      }
      if (changes.is_terminal !== undefined) {
        sheet.getRange(sheetRow, STATUS_COL.IS_TERMINAL + 1).setValue(changes.is_terminal ? 'TRUE' : 'FALSE');
      }

      return true;
    }
  }

  return false;
}

/**
 * Deletes a status by ID.
 * @param {string} statusId - Status ID to delete
 * @returns {boolean} Success
 */
function deleteStatus(statusId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Statuses');
  if (!sheet) return false;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var rows = sheet.getRange(2, 1, lastRow - 1, STATUS_COLUMN_COUNT).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][STATUS_COL.ID] === statusId) {
      var sheetRow = i + 2; // 1-based
      sheet.deleteRow(sheetRow);
      return true;
    }
  }

  return false;
}

/**
 * Initializes 3 default statuses for a new board.
 * @param {string} boardId - Board ID
 * @returns {boolean} Success
 */
function initBoardStatuses(boardId) {
  var defaults = getDefaultStatuses(boardId);
  for (var i = 0; i < defaults.length; i++) {
    createStatus(defaults[i]);
  }
  return true;
}

/**
 * Gets the 3 default statuses for a board (not yet created).
 * @param {string} boardId - Board ID
 * @returns {Array<Object>} Array of default status objects
 */
function getDefaultStatuses(boardId) {
  return [
    {
      id: generateId(),
      board_id: boardId,
      name: 'To Do',
      sort_order: 1,
      color: '#e3f2fd',
      is_terminal: false,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      board_id: boardId,
      name: 'In Progress',
      sort_order: 2,
      color: '#fff3e0',
      is_terminal: false,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      board_id: boardId,
      name: 'Done',
      sort_order: 3,
      color: '#e8f5e9',
      is_terminal: true,
      created_at: new Date().toISOString(),
    },
  ];
}

/**
 * Ensures the Statuses sheet exists with a header row.
 */
function ensureStatusesSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Statuses');

  if (!sheet) {
    sheet = ss.insertSheet('Statuses');
    sheet.appendRow(['id', 'board_id', 'name', 'sort_order', 'color', 'is_terminal', 'created_at']);
  }
}

/**
 * One-time migration: seeds default statuses for all existing boards that don't have any.
 * Run manually from Apps Script editor after deploying statuses.js
 */
function migrateExistingBoards() {
  var boards = getBoards();
  var existingStatuses = getAllStatuses();
  var boardsWithStatuses = new Set(existingStatuses.map(function(s) { return s.board_id; }));

  for (var i = 0; i < boards.length; i++) {
    var board = boards[i];
    if (!boardsWithStatuses.has(board.id)) {
      Logger.log('Creating default statuses for board: ' + board.name + ' (' + board.id + ')');
      initBoardStatuses(board.id);
    }
  }

  Logger.log('Migration complete');
}

/**
 * Gets all statuses across all boards (helper for migration).
 */
function getAllStatuses() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Statuses');
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var rows = sheet.getRange(2, 1, lastRow - 1, STATUS_COLUMN_COUNT).getValues();
  return rows.map(function(row) {
    return {
      id: row[STATUS_COL.ID] || '',
      board_id: row[STATUS_COL.BOARD_ID] || '',
      name: row[STATUS_COL.NAME] || '',
      sort_order: row[STATUS_COL.SORT_ORDER] || 0,
      color: row[STATUS_COL.COLOR] || '',
      is_terminal: row[STATUS_COL.IS_TERMINAL] === true || row[STATUS_COL.IS_TERMINAL] === 'TRUE',
      created_at: row[STATUS_COL.CREATED_AT] ? String(row[STATUS_COL.CREATED_AT]) : '',
    };
  });
}
