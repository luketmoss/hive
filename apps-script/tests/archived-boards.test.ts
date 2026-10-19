import { describe, it, expect } from 'vitest';
import { loadAuthPath, callDoGet, type CellValue, type Sandbox, type ApiItem } from './apps-script-sandbox';

// #288: an archived board, and everything on it, is invisible through the
// Apps Script API (and therefore MCP) whatever the items' status, and writes
// that touch it are refused. These drive the real sources through doGet.

const API_KEY = 'test-key';
const ARCHIVED_AT = '2026-10-18T12:00:00.000Z';

function itemRow(id: string, boardId: string, status = 'To Do'): CellValue[] {
  return [id, 'Item ' + id, '', status, '', '', '', '', '', '', '', 0, '', boardId];
}

function statusRow(id: string, boardId: string, name: string, isTerminal = false): CellValue[] {
  return [id, boardId, name, 0, '', isTerminal, ''];
}

// "Home" is a short six-column row, as on a sheet from before #288 (AC5).
const BOARDS: CellValue[][] = [
  ['home', 'Home', '', '', '', '🏠'],
  ['garage', 'Garage', '', '', '', '🔧', ARCHIVED_AT],
];

function load(): Sandbox {
  return loadAuthPath({
    boardRows: BOARDS.map((r) => [...r]),
    itemRows: [
      itemRow('h1', 'home'),
      itemRow('g1', 'garage', 'To Do'),
      itemRow('g2', 'garage', 'In Progress'),
      itemRow('g3', 'garage', 'Done'),
    ],
    statusRows: [
      statusRow('hs1', 'home', 'To Do'),
      statusRow('hs2', 'home', 'Done', true),
      statusRow('gs1', 'garage', 'To Do'),
      statusRow('gs2', 'garage', 'Done', true),
    ],
    labelRows: [
      ['Chores', '#fff', 'home'],
      ['Tools', '#000', 'garage'],
    ],
    properties: { MCP_API_KEY: API_KEY },
  });
}

function itemsSheetRows(sandbox: Sandbox): CellValue[][] {
  return sandbox.SpreadsheetApp.openById('sheet-id').getSheetByName('Items').rows;
}

function get<T>(sandbox: Sandbox, params: Record<string, string>) {
  return callDoGet<T>(sandbox, { key: API_KEY, ...params });
}

function write(sandbox: Sandbox, action: string, payload: object) {
  return callDoGet<unknown>(sandbox, { key: API_KEY, action, payload: JSON.stringify(payload) });
}

describe('AC4: reads exclude archived boards', () => {
  it('getBoards hides archived boards by default', () => {
    const res = get<Array<{ id: string }>>(load(), { action: 'getBoards' });
    expect(res.data.map((b) => b.id)).toEqual(['home']);
  });

  it('getBoards&include_archived=true returns every board with archived_at', () => {
    const res = get<Array<{ id: string; archived_at: string }>>(load(), {
      action: 'getBoards',
      include_archived: 'true',
    });
    expect(res.data.map((b) => [b.id, b.archived_at])).toEqual([
      ['home', ''],
      ['garage', ARCHIVED_AT],
    ]);
  });

  it('getItems drops every archived-board item whatever its status', () => {
    const res = get<ApiItem[]>(load(), { action: 'getItems' });
    expect(res.data.map((i) => i.id)).toEqual(['h1']);
  });

  it('getItems filtered to an archived board returns nothing', () => {
    const res = get<ApiItem[]>(load(), { action: 'getItems', board_id: 'garage' });
    expect(res.data).toEqual([]);
  });

  it('getItem on an archived-board item is not found', () => {
    const res = get<ApiItem>(load(), { action: 'getItem', id: 'g3' });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Item "g3" not found');
  });

  it('getStatuses with no board_id drops the archived board', () => {
    const res = get<Array<{ id: string }>>(load(), { action: 'getStatuses' });
    expect(res.data.map((s) => s.id)).toEqual(['hs1', 'hs2']);
  });

  it('getLabels drops the archived board', () => {
    const res = get<Array<{ label: string }>>(load(), { action: 'getLabels' });
    expect(res.data.map((l) => l.label)).toEqual(['Chores']);
  });
});

describe('AC4: writes touching an archived board are refused', () => {
  const REFUSAL = 'Board "Garage" is archived';

  it.each([
    ['createItem on the archived board', 'createItem', { data: { title: 'New', board_id: 'garage' } }],
    ['updateItem on an archived-board item', 'updateItem', { id: 'g1', changes: { title: 'Renamed' } }],
    ['updateItem moving an item onto the archived board', 'updateItem', { id: 'h1', changes: { board_id: 'garage' } }],
    ['deleteItem on an archived-board item', 'deleteItem', { id: 'g2' }],
  ])('%s', (_name, action, payload) => {
    const sandbox = load();
    const before = JSON.stringify(itemsSheetRows(sandbox));
    const res = write(sandbox, action, payload);
    expect(res).toMatchObject({ success: false, error: REFUSAL });
    expect(JSON.stringify(itemsSheetRows(sandbox))).toBe(before);
  });

  it('writes on an active board still work', () => {
    const sandbox = load();
    const res = write(sandbox, 'updateItem', { id: 'h1', changes: { title: 'Renamed' } });
    expect(res.success).toBe(true);
  });
});

describe('AC5: a Boards tab with no column G', () => {
  it('treats every board as active', () => {
    const sandbox = loadAuthPath({
      boardRows: [['home', 'Home', '', '', '', '']],
      itemRows: [itemRow('h1', 'home')],
      properties: { MCP_API_KEY: API_KEY },
    });
    expect(get<ApiItem[]>(sandbox, { action: 'getItems' }).data.map((i) => i.id)).toEqual(['h1']);
    expect(get<Array<{ id: string }>>(sandbox, { action: 'getBoards' }).data.map((b) => b.id)).toEqual(['home']);
  });
});
