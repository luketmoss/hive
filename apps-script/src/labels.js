// Operations for the Labels sheet.

function getLabels(boardId) {
  var rows = getAllRows(getSheet('Labels'));
  var labels = rows.map(function(row) {
    return {
      label: row[0] || '',
      color: row[1] || '',
      board_id: row[2] || '',
    };
  });
  // Filter by board_id if provided; otherwise return all (backward-compatible)
  if (boardId) {
    return labels.filter(function(l) { return l.board_id === boardId; });
  }
  return labels;
}

function createLabel(data) {
  if (!data.label) throw new Error('label field is required');
  var sheet = getSheet('Labels');
  // Check for duplicate (scoped to board if board_id provided)
  var existing = getLabels(data.board_id || '');
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].label.toLowerCase() === data.label.toLowerCase()) {
      throw new Error('Label "' + data.label + '" already exists');
    }
  }
  sheet.appendRow([data.label, data.color || '', data.board_id || '']);
  return { label: data.label, color: data.color || '', board_id: data.board_id || '' };
}
