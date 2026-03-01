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
  SCHEDULED_DATE: 6,
  LABELS: 7,
  PARENT_ID: 8,
  CREATED_AT: 9,
  UPDATED_AT: 10,
  COMPLETED_AT: 11,
  SORT_ORDER: 12,
};

var ITEM_COLUMN_COUNT = 13;

var VALID_STATUSES = ['To Do', 'In Progress', 'Done'];
