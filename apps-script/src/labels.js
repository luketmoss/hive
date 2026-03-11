// Operations for the Labels sheet.

function getLabels() {
  var rows = getAllRows(getSheet('Labels'));
  return rows.map(function(row) {
    return {
      label: row[0] || '',
      color: row[1] || '',
    };
  });
}

function createLabel(data) {
  if (!data.label) throw new Error('label field is required');
  var sheet = getSheet('Labels');
  // Check for duplicate
  var existing = getLabels();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].label.toLowerCase() === data.label.toLowerCase()) {
      throw new Error('Label "' + data.label + '" already exists');
    }
  }
  sheet.appendRow([data.label, data.color || '']);
  return { label: data.label, color: data.color || '' };
}
