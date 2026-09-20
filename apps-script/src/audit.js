// Audit log operations — the "Audit Log" sheet.
//
// The tab is append-only by design: it is the durable forensic trail, and the
// only place that records that an item *was* completed on a given day.
// `completed_at` on the Items row answers "is it done now" and is cleared when
// an item leaves a terminal column, so it cannot answer "what did I finish on
// the 12th" once the item is reopened. Nothing here ever rewrites a row.
//
// NOTE: this tab is never created by code — unlike `Boards` and `Permissions`,
// which bootstrap their own headers. It exists because it was made by hand
// during setup, and `getSheet` throws if it is missing.

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

/**
 * #239: The local calendar date of a timestamp, formatted YYYY-MM-DD.
 *
 * Timestamps are stored as `new Date().toISOString()` — UTC. Slicing that
 * string to get a date misfiles everything logged after 18:00 MDT / 17:00 MST
 * onto the following day, which is the evening quarter of every day and
 * precisely when tasks get closed. `Utilities.formatDate` handles the MDT/MST
 * transition without a library.
 *
 * The cross-app contract: the join key is the local calendar date in
 * AUDIT_TIMEZONE, and no code path may slice an ISO timestamp to get a date.
 *
 * @param {string|Date} timestamp
 * @returns {string} 'YYYY-MM-DD', or '' if the timestamp is unparseable
 */
function auditLocalDate(timestamp) {
  if (!timestamp) return '';
  var date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, AUDIT_TIMEZONE, 'yyyy-MM-dd');
}

/** Map an Audit Log sheet row to the object shape returned over the API. */
function rowToAuditEntry(row) {
  return {
    timestamp: row[AUDIT_COL.TIMESTAMP] ? String(row[AUDIT_COL.TIMESTAMP]) : '',
    item_id: row[AUDIT_COL.ITEM_ID] || '',
    action: row[AUDIT_COL.ACTION] || '',
    field: row[AUDIT_COL.FIELD] || '',
    old_value: row[AUDIT_COL.OLD_VALUE] === undefined || row[AUDIT_COL.OLD_VALUE] === null
      ? '' : String(row[AUDIT_COL.OLD_VALUE]),
    new_value: row[AUDIT_COL.NEW_VALUE] === undefined || row[AUDIT_COL.NEW_VALUE] === null
      ? '' : String(row[AUDIT_COL.NEW_VALUE]),
    actor: row[AUDIT_COL.ACTOR] || '',
  };
}

/**
 * #239: Read the Audit Log over a local-date range.
 *
 * This is a log reader, not a query engine. Rows come back exactly as logged,
 * in append order — which is chronological — with no deduplication and no
 * netting to a daily final state. An item completed and reopened on the same
 * day returns both rows; completed twice in one day returns two `completed`
 * rows. Hive returns events; the consumer decides what they mean, because
 * taking that decision here would bind every future consumer to one reading
 * of "done".
 *
 * @param {Object} [filters]
 * @param {string} [filters.from]   inclusive local start date, 'YYYY-MM-DD'
 * @param {string} [filters.to]     inclusive local end date, 'YYYY-MM-DD'
 * @param {string} [filters.action] exact action to match; omit for all actions
 * @returns {Array<Object>} matching entries, oldest first
 */
function getAuditLog(filters) {
  filters = filters || {};
  var from = filters.from || '';
  var to = filters.to || '';
  var actionFilter = filters.action || '';

  var rows = getAllRows(getSheet('Audit Log'));
  var results = [];

  for (var i = 0; i < rows.length; i++) {
    var entry = rowToAuditEntry(rows[i]);
    if (!entry.timestamp) continue;

    if (actionFilter && entry.action !== actionFilter) continue;

    // Lexical comparison is safe: both sides are zero-padded YYYY-MM-DD.
    if (from || to) {
      var localDate = auditLocalDate(entry.timestamp);
      if (!localDate) continue;
      if (from && localDate < from) continue;
      if (to && localDate > to) continue;
    }

    results.push(entry);
  }

  return results;
}
