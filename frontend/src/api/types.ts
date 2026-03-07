// Hive data types — mirrors Google Sheet column structure.
// IMPORTANT: Keep in sync with apps-script/src/types.js

export type ItemStatus = 'To Do' | 'In Progress' | 'Done';

export interface Item {
  id: string;
  title: string;
  description: string;
  status: ItemStatus;
  owner: string;
  due_date: string;
  scheduled_date: string;
  labels: string;
  parent_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  sort_order: number;
  created_by: string;
  board_id: string;
}

export interface ItemWithRow extends Item {
  /** 1-based sheet row number for updates */
  sheetRow: number;
}

export interface Owner {
  name: string;
  google_account: string;
}

export interface Label {
  label: string;
  color: string;
}

export interface Board {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
}

export type PermissionRole = 'owner' | 'member';

export interface BoardPermission {
  board_id: string;
  user_email: string;
  role: PermissionRole;
}

export interface UserInfo {
  email: string;
  name: string;
  picture: string;
}
