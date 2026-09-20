// Hive data types — column constants and valid statuses.
// IMPORTANT: These types are duplicated in frontend/src/api/types.ts. Keep in sync.

// Column indices for the Items sheet (0-based)
var COL = {
  ID: 0,
  TITLE: 1,
  DESCRIPTION: 2,
  STATUS: 3,
  OWNER: 4,
  DUE_DATE: 5,
  LABELS: 6,
  PARENT_ID: 7,
  CREATED_AT: 8,
  UPDATED_AT: 9,
  COMPLETED_AT: 10,
  SORT_ORDER: 11,
  CREATED_BY: 12,
  BOARD_ID: 13,
};

var ITEM_COLUMN_COUNT = 14;

// Column indices for the Statuses sheet (0-based) — deprecated in favor of dynamic statuses
// Keeping for backward compat during transition period
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

// Deprecated: Statuses are now per-board in the Statuses sheet. Keep for fallback validation.
var VALID_STATUSES = ['To Do', 'In Progress', 'Done'];

// Column indices for the Audit Log sheet (0-based). Append-only forensic trail.
var AUDIT_COL = {
  TIMESTAMP: 0,
  ITEM_ID: 1,
  ACTION: 2,
  FIELD: 3,
  OLD_VALUE: 4,
  NEW_VALUE: 5,
  ACTOR: 6,
};

var AUDIT_COLUMN_COUNT = 7;

// #239: the cross-app join key is the local calendar date in this zone,
// formatted YYYY-MM-DD. No code path may slice an ISO timestamp to get a date.
var AUDIT_TIMEZONE = 'America/Denver';
