// #273: a second full-access key, MCP_API_KEY, for the remote MCP Worker.
//
// Drives the real `main.js` through the sandboxed loader. AC numbers refer to
// the issue's Acceptance Criteria.

import { describe, it, expect } from 'vitest';
import { loadAuthPath, makeUrlFetchApp, makeCacheService, callDoGet, callDoPostForm, callDoPostJson } from './apps-script-sandbox';

const API_KEY = 'primary-key';
const MCP_KEY = 'mcp-key';
const REFUSED = 'Invalid or missing API key';

function load(properties: Record<string, string>) {
  return loadAuthPath({ properties });
}

describe('#273 AC1: either key is a full-access caller', () => {
  const sandbox = load({ API_KEY, MCP_API_KEY: MCP_KEY });

  it.each([API_KEY, MCP_KEY])('accepts %s on doGet', (key) => {
    expect(callDoGet(sandbox, { action: 'getItems', key }).success).toBe(true);
  });

  it.each([API_KEY, MCP_KEY])('accepts %s on a form-encoded doPost', (key) => {
    expect(callDoPostForm(sandbox, { action: 'getItems', key }).success).toBe(true);
  });

  it.each([API_KEY, MCP_KEY])('accepts %s on a JSON-body doPost write', (key) => {
    const res = callDoPostJson(sandbox, { key, action: 'createItem', data: { title: 'x' } });
    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);
  });
});

describe('#273 AC2: a wrong key is refused', () => {
  const sandbox = load({ API_KEY, MCP_API_KEY: MCP_KEY });

  it('refuses a key matching neither, on every entry point', () => {
    expect(callDoGet(sandbox, { action: 'getItems', key: 'nope' }).error).toBe(REFUSED);
    expect(callDoPostForm(sandbox, { action: 'getItems', key: 'nope' }).error).toBe(REFUSED);
    expect(callDoPostJson(sandbox, { key: 'nope', action: 'createItem', data: { title: 'x' } }).error).toBe(REFUSED);
  });
});

describe('#273 AC3: an unset or blank MCP_API_KEY never matches', () => {
  const cases: [string, Record<string, string>][] = [
    ['absent', { API_KEY }],
    ['empty', { API_KEY, MCP_API_KEY: '' }],
  ];
  for (const [label, properties] of cases) {
    it(`refuses empty, missing, "undefined" and "null" keys when the property is ${label}`, () => {
      const sandbox = load(properties);
      expect(callDoGet(sandbox, { action: 'getItems', key: '' }).error).toBe(REFUSED);
      expect(callDoGet(sandbox, { action: 'getItems' }).error).toBe(REFUSED);
      expect(callDoGet(sandbox, { action: 'getItems', key: 'undefined' }).error).toBe(REFUSED);
      expect(callDoGet(sandbox, { action: 'getItems', key: 'null' }).error).toBe(REFUSED);
      expect(callDoPostJson(sandbox, { action: 'createItem', data: { title: 'x' } }).error).toBe(REFUSED);
    });
  }
});

describe('#273 AC4: API_KEY alone behaves as today', () => {
  const sandbox = load({ API_KEY });

  it('accepts the right key and refuses a wrong one', () => {
    expect(callDoGet(sandbox, { action: 'getItems', key: API_KEY }).success).toBe(true);
    expect(callDoGet(sandbox, { action: 'getItems', key: MCP_KEY }).error).toBe(REFUSED);
  });
});

describe('#273 AC5: an unset API_KEY is still an error', () => {
  it.each([
    ['MCP_API_KEY set and matching', { MCP_API_KEY: MCP_KEY }, MCP_KEY],
    ['MCP_API_KEY unset', {}, 'anything'],
  ])('throws the config error with %s', (_label, extra, key) => {
    const sandbox = loadAuthPath({ properties: { ...extra, API_KEY: '' } });
    const res = callDoGet(sandbox, { action: 'getItems', key });
    expect(res.success).toBe(false);
    expect(res.error).toBe('API_KEY not configured in script properties');
  });
});

describe('#273 AC6: the access_token door is untouched', () => {
  const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  const TOKEN = 'ya29.fixture-access-token-value';

  // A valid token, so the request reaches the read-only limit rather than
  // being refused earlier as token_forbidden.
  function loadWithToken() {
    const tokenInfo = JSON.stringify({
      aud: CLIENT_ID,
      azp: CLIENT_ID,
      email: 'me@example.com',
      email_verified: 'true',
      expires_in: '1800',
    });
    return loadAuthPath({
      properties: {
        API_KEY,
        MCP_API_KEY: MCP_KEY,
        TOKEN_CLIENT_ID: CLIENT_ID,
        TOKEN_ALLOWED_EMAIL: 'me@example.com',
      },
      urlFetchApp: makeUrlFetchApp([{ code: 200, body: tokenInfo }]),
      cacheService: makeCacheService(),
    });
  }

  it('still reads with a valid token', () => {
    const res = callDoGet(loadWithToken(), { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(true);
  });

  it('treats a valid MCP_API_KEY beside a token as a token caller: writes are read_only', () => {
    const params = { action: 'createItem', key: MCP_KEY, access_token: TOKEN, payload: '{}' };
    for (const res of [callDoGet(loadWithToken(), params), callDoPostForm(loadWithToken(), params)]) {
      expect(res.success).toBe(false);
      expect(res.code).toBe('read_only');
    }
  });

  it('refuses a token on the JSON-body path even beside a valid MCP_API_KEY', () => {
    const res = callDoPostJson(loadWithToken(), {
      key: MCP_KEY,
      access_token: TOKEN,
      action: 'createItem',
      data: { title: 'x' },
    });
    expect(res.success).toBe(false);
    expect(res.code).toBe('read_only');
  });
});
