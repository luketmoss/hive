// Read operations for the Owners sheet.

function getOwners() {
  var rows = getAllRows(getSheet('Owners'));
  return rows.map(function(row) {
    return {
      name: row[0] || '',
      google_account: row[1] || '',
    };
  });
}
