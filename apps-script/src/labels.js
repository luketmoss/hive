// Read operations for the Labels sheet.

function getLabels() {
  var rows = getAllRows(getSheet('Labels'));
  return rows.map(function(row) {
    return {
      label: row[0] || '',
      color: row[1] || '',
    };
  });
}
