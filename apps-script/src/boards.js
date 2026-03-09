// Read operations for the Boards sheet.

function getBoards() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Boards');
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  return rows.map(function(row) {
    return {
      id: row[0] || '',
      name: row[1] || '',
      created_at: row[2] ? String(row[2]) : '',
      created_by: row[3] || '',
      color: row[4] || '',
      icon: row[5] || '',
    };
  });
}
