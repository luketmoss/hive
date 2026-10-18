// Read operations for the Boards sheet.

/**
 * @param {boolean} [includeArchived] - #288: archived boards are hidden unless
 *   the caller asks for them
 */
function getBoards(includeArchived) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Boards');
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // #288: column G (archived_at) may not exist on older sheets — short rows
  // read back as empty, which means active.
  var rows = sheet.getRange(2, 1, lastRow - 1, BOARD_COLUMN_COUNT).getValues();
  var boards = rows.map(function(row) {
    return {
      id: row[BOARD_COL.ID] || '',
      name: row[BOARD_COL.NAME] || '',
      created_at: row[BOARD_COL.CREATED_AT] ? String(row[BOARD_COL.CREATED_AT]) : '',
      created_by: row[BOARD_COL.CREATED_BY] || '',
      color: row[BOARD_COL.COLOR] || '',
      icon: row[BOARD_COL.ICON] || '',
      archived_at: row[BOARD_COL.ARCHIVED_AT] ? String(row[BOARD_COL.ARCHIVED_AT]) : '',
    };
  });
  if (includeArchived) return boards;
  return boards.filter(function(b) { return !isBoardArchived(b); });
}

/**
 * #288: Archived boards keyed by id, mapped to their name. Everything on an
 * archived board is invisible and read-only through this API.
 * @returns {Object<string, string>}
 */
function getArchivedBoards() {
  var archived = {};
  getBoards(true).forEach(function(b) {
    if (isBoardArchived(b)) archived[b.id] = b.name;
  });
  return archived;
}

/** #288: Throw if `boardId` names an archived board. */
function assertBoardNotArchived(boardId, archived) {
  archived = archived || getArchivedBoards();
  if (boardId && Object.prototype.hasOwnProperty.call(archived, boardId)) {
    throw new Error('Board "' + (archived[boardId] || boardId) + '" is archived');
  }
}
