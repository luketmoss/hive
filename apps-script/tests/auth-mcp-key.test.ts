// #293: MCP_API_KEY is the only credential the API accepts.
//
// Drives the real `main.js` through the sandboxed loader. AC numbers refer to
// #293's Acceptance Criteria.

import { describe, it, expect } from 'vitest';
import { loadAuthPath, callDoGet, callDoPostForm, callDoPostJson } from './apps-script-sandbox';

const MCP_KEY = 'mcp-key';
const OLD_API_KEY = 'old-api-key';
const REFUSED = 'Invalid or missing API key';
const UNCONFIGURED = 'MCP_API_KEY not configured in script properties';

function load(properties: Record<string, string>) {
  return loadAuthPath({ properties });
}

describe('#293 AC1: the MCP key works on every entry point', () => {
  const sandbox = load({ MCP_API_KEY: MCP_KEY });

  it('accepts a read and a write action on doGet', () => {
    expect(callDoGet(sandbox, { action: 'getItems', key: MCP_KEY }).success).toBe(true);
    const write = callDoGet(sandbox, { action: 'createItem', key: MCP_KEY, payload: JSON.stringify({ data: { title: 'x' } }) });
    expect(write.error).toBeUndefined();
    expect(write.success).toBe(true);
  });

  it('accepts a form-encoded doPost', () => {
    expect(callDoPostForm(sandbox, { action: 'getItems', key: MCP_KEY }).success).toBe(true);
  });

  it('accepts a JSON-body doPost write', () => {
    const res = callDoPostJson(sandbox, { key: MCP_KEY, action: 'createItem', data: { title: 'x' } });
    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);
  });
});

describe('#293 AC2: nothing else authenticates', () => {
  const sandbox = load({ MCP_API_KEY: MCP_KEY, API_KEY: OLD_API_KEY });

  it.each([
    ['a wrong key', { key: 'nope' }],
    ['a missing key', {}],
    ['the old API_KEY value', { key: OLD_API_KEY }],
  ])('refuses %s on every entry point', (_label, creds) => {
    expect(callDoGet(sandbox, { action: 'getItems', ...creds }).error).toBe(REFUSED);
    expect(callDoPostForm(sandbox, { action: 'getItems', ...creds }).error).toBe(REFUSED);
    expect(callDoPostJson(sandbox, { ...creds, action: 'createItem', data: { title: 'x' } }).error).toBe(REFUSED);
  });

  it('refuses an access_token with no valid key, with no token code and no network call', () => {
    sandbox.UrlFetchApp = {
      fetch() {
        throw new Error('tokeninfo must never be called');
      },
    };
    const params = { action: 'getItems', access_token: 'ya29.anything' };
    for (const res of [
      callDoGet(sandbox, params),
      callDoPostForm(sandbox, params),
      callDoPostJson(sandbox, { action: 'createItem', data: { title: 'x' }, access_token: 'ya29.anything' }),
    ]) {
      expect(res.error).toBe(REFUSED);
      expect((res as { code?: string }).code).toBeUndefined();
    }
  });

  it('accepts a valid key beside a stray access_token', () => {
    const params = { action: 'getItems', key: MCP_KEY, access_token: 'ya29.stray' };
    expect(callDoGet(sandbox, params).success).toBe(true);
    expect(callDoPostForm(sandbox, params).success).toBe(true);
    expect(callDoPostJson(sandbox, { key: MCP_KEY, access_token: 'ya29.stray', action: 'createItem', data: { title: 'x' } }).success).toBe(true);
  });
});

describe('#293 AC3: API_KEY is not needed, and an unset MCP_API_KEY fails loudly', () => {
  it('succeeds with API_KEY unset', () => {
    const sandbox = load({ MCP_API_KEY: MCP_KEY });
    expect(callDoGet(sandbox, { action: 'getItems', key: MCP_KEY }).success).toBe(true);
  });

  const cases: [string, Record<string, string>][] = [
    ['absent', {}],
    ['empty', { MCP_API_KEY: '' }],
  ];
  for (const [label, properties] of cases) {
    it.each([['an empty key', ''], ['any key', 'anything'], ['a missing key', undefined]])(
      `returns the config error for %s when MCP_API_KEY is ${label}`,
      (_k, key) => {
        const sandbox = load(properties);
        for (const res of [
          callDoGet(sandbox, { action: 'getItems', key }),
          callDoPostForm(sandbox, { action: 'getItems', key }),
          callDoPostJson(sandbox, { key, action: 'createItem', data: { title: 'x' } }),
        ]) {
          expect(res.success).toBe(false);
          expect(res.error).toBe(UNCONFIGURED);
        }
      },
    );
  }

  it('runs no action when unconfigured', () => {
    const itemRows: never[] = [];
    const sandbox = loadAuthPath({ properties: { MCP_API_KEY: '' }, itemRows });
    callDoPostJson(sandbox, { key: '', action: 'createItem', data: { title: 'x' } });
    expect(itemRows).toHaveLength(0);
  });
});
