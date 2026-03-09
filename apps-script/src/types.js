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

var VALID_STATUSES = ['To Do', 'In Progress', 'Done'];
