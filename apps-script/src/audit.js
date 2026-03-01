// Audit log operations — writes to the "Audit Log" sheet.

function writeAuditEntry(itemId, action, field, oldValue, newValue, actor) {
  var sheet = getSheet('Audit Log');
  sheet.appendRow([
    isoNow(),
    itemId,
    action,
    field,
    oldValue,
    newValue,
    actor,
  ]);
}
