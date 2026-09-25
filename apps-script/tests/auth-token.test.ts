// #264: an access token as a second, read-only credential.
//
// These tests drive the real `src/*.js` sources — `auth.js`, `main.js`, and
// everything `dispatchAction` reaches — through the sandboxed loader, with
// `UrlFetchApp` (tokeninfo) and `CacheService` (the verdict cache) stubbed
// with call recording so behaviour can be asserted directly rather than
// inferred.
//
// AC numbers below refer to the issue's Acceptance Criteria table.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadAuthPath,
  makeUrlFetchApp,
  makeCacheService,
  callDoGet,
  callDoPostForm,
  callDoPostJson,
  type ApiItem,
  type ApiResponse,
} from './apps-script-sandbox';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const ALLOWED_EMAIL = 'me@example.com';
const TOKEN = 'ya29.fixture-access-token-value';
const API_KEY = 'test-key';

const VALID_PROPERTIES = {
  API_KEY,
  SPREADSHEET_ID: 'sheet-id',
  TOKEN_CLIENT_ID: CLIENT_ID,
  TOKEN_ALLOWED_EMAIL: ALLOWED_EMAIL,
};

/** A tokeninfo 200 body a valid token gets back, with overrides per case. */
function tokenInfoBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    email: ' Me@Example.com ',
    email_verified: 'true',
    expires_in: '1800',
    ...overrides,
  });
}

function itemRow(fields: {
  id: string;
  title?: string;
  status?: string;
  owner?: string;
  board_id?: string;
  parent_id?: string;
}) {
  return [
    fields.id,
    fields.title ?? 'Item ' + fields.id,
    '',
    fields.status ?? 'To Do',
    fields.owner ?? '',
    '',
    '',
    fields.parent_id ?? '',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
    '',
    1,
    'seed',
    fields.board_id ?? '',
  ];
}

const FIXTURE = {
  itemRows: [itemRow({ id: 'item-1', title: 'First', board_id: 'board-a' })],
  ownerRows: [['Luke', 'luke@example.com']],
  labelRows: [['bug', '#ff0000', 'board-a']],
  boardRows: [['board-a', 'Board A', '2026-01-01T00:00:00.000Z', 'Luke', '#fff', 'inbox']],
  statusRows: [['s1', 'board-a', 'To Do', 1, '#eee', false, '2026-01-01T00:00:00.000Z']],
  auditRows: [['2026-01-01T00:00:00.000Z', 'item-1', 'created', '', '', 'First', 'seed']],
};

/** Load a sandbox with the standard fixture rows and a scripted tokeninfo answer. */
function loadWithToken(opts: {
  properties?: Record<string, string>;
  responses?: Array<{ code: number; body: string }>;
  throwFetch?: boolean;
  cacheService?: ReturnType<typeof makeCacheService>;
} = {}) {
  const urlFetchApp = makeUrlFetchApp(opts.responses ?? [{ code: 200, body: tokenInfoBody() }], {
    throwError: opts.throwFetch,
  });
  const cacheService = opts.cacheService ?? makeCacheService();
  const sandbox = loadAuthPath({
    ...FIXTURE,
    properties: opts.properties ?? VALID_PROPERTIES,
    urlFetchApp,
    cacheService,
  });
  return { sandbox, urlFetchApp, cacheService };
}

const READ_ACTIONS = [
  { action: 'getItems', params: {} },
  { action: 'getItem', params: { id: 'item-1' } },
  { action: 'getOwners', params: {} },
  { action: 'getLabels', params: {} },
  { action: 'getBoards', params: {} },
  { action: 'getStatuses', params: {} },
  { action: 'getAuditLog', params: {} },
];

const WRITE_OR_UNKNOWN_ACTIONS = [
  'createItem',
  'updateItem',
  'deleteItem',
  'createLabel',
  'createStatus',
  'updateStatus',
  'deleteStatus',
  'totallyMadeUpAction',
];

describe('AC1: a valid token reads exactly what a key caller gets', () => {
  for (const { action, params } of READ_ACTIONS) {
    it('matches the key-caller response for ' + action, () => {
      const { sandbox: tokenSandbox } = loadWithToken();
      const keySandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES });

      const tokenRes = callDoGet(tokenSandbox, { action, access_token: TOKEN, ...params });
      const keyRes = callDoGet(keySandbox, { action, key: API_KEY, ...params });

      expect(tokenRes.success).toBe(true);
      expect(tokenRes).toEqual(keyRes);
    });
  }

  it('trims and lowercases both sides of the email comparison', () => {
    const { sandbox } = loadWithToken({
      properties: { ...VALID_PROPERTIES, TOKEN_ALLOWED_EMAIL: '  ME@EXAMPLE.COM  ' },
      responses: [{ code: 200, body: tokenInfoBody({ email: ' Me@Example.COM ' }) }],
    });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(true);
  });
});

describe('AC2: a token can never write', () => {
  it.each(WRITE_OR_UNKNOWN_ACTIONS)('refuses "%s" as read_only through doGet', (action) => {
    const { sandbox } = loadWithToken();
    const res = callDoGet(sandbox, { action, access_token: TOKEN, payload: '{}' });
    expect(res.success).toBe(false);
    expect(res.code).toBe('read_only');
    expect(res.error).toBe('Read-only caller: action "' + action + '" is not permitted');
  });

  it.each(WRITE_OR_UNKNOWN_ACTIONS)('refuses "%s" as read_only through a form-encoded doPost', (action) => {
    const { sandbox } = loadWithToken();
    const res = callDoPostForm(sandbox, { action, access_token: TOKEN, payload: '{}' });
    expect(res.success).toBe(false);
    expect(res.code).toBe('read_only');
    expect(res.error).toBe('Read-only caller: action "' + action + '" is not permitted');
  });

  it.each(WRITE_OR_UNKNOWN_ACTIONS)('refuses "%s" as read_only through the JSON-body doPost', (action) => {
    const { sandbox } = loadWithToken();
    const res = callDoPostJson(sandbox, { access_token: TOKEN, action, data: { title: 'x' } });
    expect(res.success).toBe(false);
    expect(res.code).toBe('read_only');
    expect(res.error).toBe('Read-only caller: action "' + action + '" is not permitted');
  });

  it('enumerates every case label in the shared dispatch switch and refuses each one outside the allow-list', () => {
    // Normalize CRLF to LF before matching: a Windows checkout with
    // core.autocrlf converts main.js's line endings, and the newline-
    // anchored regex below would otherwise silently find nothing.
    const mainSrc = readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'main.js'),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const dispatchBody = mainSrc.match(/function dispatchAction\([\s\S]*?\n\}\n/);
    expect(dispatchBody, 'dispatchAction() not found in main.js').toBeTruthy();
    const labels = Array.from(dispatchBody![0].matchAll(/case '([^']+)':/g)).map((m) => m[1]);

    // Sanity: this enumeration only means something if it actually found
    // both the seven reads and at least one write case label.
    expect(labels.length).toBeGreaterThan(7);

    const { sandbox } = loadWithToken();
    const allowList: string[] = sandbox.TOKEN_READ_ACTIONS;
    expect(allowList.sort()).toEqual(
      ['getAuditLog', 'getBoards', 'getItem', 'getItems', 'getLabels', 'getOwners', 'getStatuses'].sort(),
    );

    const outsideAllowList = labels.filter((label) => allowList.indexOf(label) === -1);
    expect(outsideAllowList.length).toBeGreaterThan(0);

    for (const action of outsideAllowList) {
      const res = callDoGet(sandbox, { action, access_token: TOKEN, payload: '{}' });
      expect(res.success, 'action "' + action + '" was reachable by a token caller').toBe(false);
      expect(res.code, 'action "' + action + '" did not refuse as read_only').toBe('read_only');
    }
  });

  it('treats a valid key plus an access_token as a token caller — adding a parameter never raises privilege', () => {
    const { sandbox } = loadWithToken();
    const res = callDoGet(sandbox, { action: 'createItem', key: API_KEY, access_token: TOKEN, payload: '{}' });
    expect(res.success).toBe(false);
    expect(res.code).toBe('read_only');
  });

  it('a key-plus-token caller still gets the allow-listed reads', () => {
    const { sandbox } = loadWithToken();
    const res = callDoGet(sandbox, { action: 'getItems', key: API_KEY, access_token: TOKEN });
    expect(res.success).toBe(true);
  });
});

describe('AC3: bad tokens are refused with the right code', () => {
  it('tokeninfo 4xx -> token_invalid', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 401, body: 'unauthorized' }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(false);
    expect(res.code).toBe('token_invalid');
  });

  it('tokeninfo 200 with a body that is not valid JSON -> token_invalid', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: 'not json at all' }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(false);
    expect(res.code).toBe('token_invalid');
  });

  it('expires_in missing -> token_invalid', () => {
    const body = JSON.parse(tokenInfoBody());
    delete body.expires_in;
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: JSON.stringify(body) }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_invalid');
  });

  it('expires_in not a number -> token_invalid', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: tokenInfoBody({ expires_in: 'soon' }) }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_invalid');
  });

  it('expires_in <= 0 -> token_invalid', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: tokenInfoBody({ expires_in: '0' }) }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_invalid');
  });

  it('aud mismatch -> token_forbidden', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: tokenInfoBody({ aud: 'someone-elses-client' }) }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_forbidden');
  });

  it('azp present and different from aud/client -> token_forbidden', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: tokenInfoBody({ azp: 'a-different-client' }) }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_forbidden');
  });

  it('email mismatch -> token_forbidden', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: tokenInfoBody({ email: 'someone-else@example.com' }) }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_forbidden');
  });

  it('email_verified not true -> token_forbidden', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 200, body: tokenInfoBody({ email_verified: 'false' }) }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_forbidden');
  });

  it('TOKEN_CLIENT_ID and TOKEN_ALLOWED_EMAIL both unset -> token_forbidden, tokeninfo never called', () => {
    const { sandbox, urlFetchApp } = loadWithToken({ properties: { API_KEY, SPREADSHEET_ID: 'sheet-id' } });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_forbidden');
    expect(urlFetchApp.calls.length).toBe(0);
  });

  it('TOKEN_ALLOWED_EMAIL blank -> token_forbidden, tokeninfo never called', () => {
    const { sandbox, urlFetchApp } = loadWithToken({
      properties: { ...VALID_PROPERTIES, TOKEN_ALLOWED_EMAIL: '   ' },
    });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_forbidden');
    expect(urlFetchApp.calls.length).toBe(0);
  });

  it('UrlFetchApp.fetch throws -> token_unavailable', () => {
    const { sandbox } = loadWithToken({ throwFetch: true });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_unavailable');
  });

  it('tokeninfo 5xx -> token_unavailable', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 503, body: 'try again later' }] });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_unavailable');
  });

  it('key callers are completely unaffected when a token property is unset', () => {
    const { sandbox } = loadWithToken({ properties: { API_KEY, SPREADSHEET_ID: 'sheet-id' } });
    const res = callDoGet(sandbox, { action: 'getItems', key: API_KEY });
    expect(res.success).toBe(true);
  });
});

describe('AC4: verdicts are cached, and the token never leaks', () => {
  it('UrlFetchApp.fetch is called once across two accepted requests', () => {
    const { sandbox, urlFetchApp } = loadWithToken();
    const first = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    const second = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(urlFetchApp.calls.length).toBe(1);
  });

  it('the cache key is the fixed namespace plus hex SHA-256 of token|clientId|email', () => {
    const { sandbox, cacheService } = loadWithToken();
    callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });

    const namespace: string = sandbox.TOKEN_CACHE_NAMESPACE;
    const expectedDigest = createHash('sha256')
      .update(TOKEN + '|' + CLIENT_ID + '|' + ALLOWED_EMAIL, 'utf8')
      .digest('hex');

    expect(cacheService.puts.length).toBe(1);
    expect(cacheService.puts[0].key).toBe(namespace + expectedDigest);
  });

  it('changing TOKEN_CLIENT_ID misses the cache even for the same token', () => {
    const cacheService = makeCacheService();
    const first = loadWithToken({ cacheService });
    callDoGet(first.sandbox, { action: 'getItems', access_token: TOKEN });

    const second = loadWithToken({
      properties: { ...VALID_PROPERTIES, TOKEN_CLIENT_ID: 'a-different-client-id' },
      responses: [{ code: 200, body: tokenInfoBody({ aud: 'a-different-client-id', azp: 'a-different-client-id' }) }],
      cacheService,
    });
    callDoGet(second.sandbox, { action: 'getItems', access_token: TOKEN });

    expect(cacheService.puts.length).toBe(2);
    expect(cacheService.puts[0].key).not.toBe(cacheService.puts[1].key);
  });

  it('accepted TTL is expires_in - 60, capped at 3600', () => {
    const { sandbox, cacheService } = loadWithToken({
      responses: [{ code: 200, body: tokenInfoBody({ expires_in: '1800' }) }],
    });
    callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(cacheService.puts[0].ttl).toBe(1740);
    expect(cacheService.puts[0].value).toBe('ok');
  });

  it('accepted TTL caps at 3600 for a long-lived token', () => {
    const { sandbox, cacheService } = loadWithToken({
      responses: [{ code: 200, body: tokenInfoBody({ expires_in: '99999' }) }],
    });
    callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(cacheService.puts[0].ttl).toBe(3600);
  });

  it('an accepted verdict is not cached when expires_in - 60 <= 0', () => {
    const { sandbox, cacheService } = loadWithToken({
      responses: [{ code: 200, body: tokenInfoBody({ expires_in: '30' }) }],
    });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(true);
    expect(cacheService.puts.length).toBe(0);
  });

  it('token_invalid and token_forbidden are cached for 300s as no:<code>', () => {
    const invalid = loadWithToken({ responses: [{ code: 401, body: 'nope' }] });
    callDoGet(invalid.sandbox, { action: 'getItems', access_token: TOKEN });
    expect(invalid.cacheService.puts[0]).toMatchObject({ value: 'no:token_invalid', ttl: 300 });

    const forbidden = loadWithToken({ responses: [{ code: 200, body: tokenInfoBody({ aud: 'nope' }) }] });
    callDoGet(forbidden.sandbox, { action: 'getItems', access_token: TOKEN });
    expect(forbidden.cacheService.puts[0]).toMatchObject({ value: 'no:token_forbidden', ttl: 300 });
  });

  it('token_unavailable is never cached', () => {
    const { sandbox, cacheService } = loadWithToken({ throwFetch: true });
    callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(cacheService.puts.length).toBe(0);
  });

  it('a cached refusal returns the same code it was refused with, without calling tokeninfo again', () => {
    const cacheService = makeCacheService();
    const namespace_probe = loadWithToken({ cacheService });
    const namespace: string = namespace_probe.sandbox.TOKEN_CACHE_NAMESPACE;
    const key = namespace + createHash('sha256').update(TOKEN + '|' + CLIENT_ID + '|' + ALLOWED_EMAIL, 'utf8').digest('hex');
    cacheService.store[key] = 'no:token_forbidden';

    const { sandbox, urlFetchApp } = loadWithToken({ cacheService });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_forbidden');
    expect(urlFetchApp.calls.length).toBe(0);
  });

  it('proceeds as a cache miss (not a refusal) when CacheService.get throws', () => {
    const { sandbox, urlFetchApp } = loadWithToken({ cacheService: makeCacheService({ throwOnGet: true }) });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(true);
    expect(urlFetchApp.calls.length).toBe(1);
  });

  it('proceeds as no-store (not a refusal) when CacheService.put throws', () => {
    const { sandbox } = loadWithToken({ cacheService: makeCacheService({ throwOnPut: true }) });
    const res = callDoGet(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(true);
  });

  it('the raw token string appears in no cache key, no cache value, no log call, and no response body', () => {
    const secretToken = 'ya29.SUPER-SECRET-DO-NOT-LEAK-abc123XYZ';
    const cacheService = makeCacheService();
    const urlFetchApp = makeUrlFetchApp([
      { code: 200, body: tokenInfoBody() },
      { code: 401, body: 'nope' },
    ]);
    const sandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES, urlFetchApp, cacheService });

    const loggerSpy = vi.fn();
    sandbox.Logger.log = loggerSpy;
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const responses: Array<ApiResponse<unknown>> = [];
    responses.push(callDoGet(sandbox, { action: 'getItems', access_token: secretToken }));
    responses.push(callDoGet(sandbox, { action: 'getItems', access_token: secretToken })); // cache hit
    responses.push(callDoGet(sandbox, { action: 'createItem', access_token: secretToken, payload: '{}' })); // read_only
    responses.push(callDoPostJson(sandbox, { access_token: secretToken, action: 'createItem' })); // AC6 refusal

    const other = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES, urlFetchApp, cacheService });
    responses.push(
      callDoGet(other, {
        action: 'getItems',
        access_token: 'a-second-token-checked-independently-of-' + secretToken,
      }),
    );

    const loggedArgs = loggerSpy.mock.calls.concat(consoleLogSpy.mock.calls, consoleErrorSpy.mock.calls);
    for (const args of loggedArgs) {
      for (const arg of args) {
        expect(String(arg)).not.toContain(secretToken);
      }
    }

    for (const res of responses) {
      expect(JSON.stringify(res)).not.toContain(secretToken);
    }

    for (const key of Object.keys(cacheService.store)) {
      expect(key).not.toContain(secretToken);
      expect(cacheService.store[key]).not.toContain(secretToken);
    }
    for (const put of cacheService.puts) {
      expect(put.key).not.toContain(secretToken);
      expect(put.value).not.toContain(secretToken);
    }
    for (const got of cacheService.gets) {
      expect(got).not.toContain(secretToken);
    }

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe('AC5: key callers are unchanged', () => {
  it('every read action through doGet succeeds exactly as before for a key caller', () => {
    const sandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES });
    for (const { action, params } of READ_ACTIONS) {
      const res = callDoGet(sandbox, { action, key: API_KEY, ...params });
      expect(res.success).toBe(true);
      expect(res.code).toBeUndefined();
    }
  });

  it('an invalid key is still refused with the unchanged message and no code', () => {
    const sandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES });
    const res = callDoGet(sandbox, { action: 'getItems', key: 'wrong-key' });
    expect(res).toEqual({ success: false, error: 'Invalid or missing API key' });
    expect(res.code).toBeUndefined();
  });

  it('the JSON-body doPost path is unchanged for a key caller', () => {
    const sandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES });
    const res = callDoPostJson<ApiItem>(sandbox, {
      key: API_KEY,
      action: 'createItem',
      data: { title: 'From JSON POST', owner: 'Luke' },
      actor: 'test',
    });
    expect(res.success).toBe(true);
    expect((res.data as ApiItem).title).toBe('From JSON POST');
    expect(res.code).toBeUndefined();
  });

  it('an invalid key on the JSON-body doPost path is unchanged', () => {
    const sandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES });
    const res = callDoPostJson(sandbox, { key: 'wrong-key', action: 'createItem', data: { title: 'x' } });
    expect(res).toEqual({ success: false, error: 'Invalid or missing API key' });
  });
});

describe('AC6: form-encoded POST routes like GET; JSON-body POST stays write-only', () => {
  it('a form-encoded POST for a key caller matches the equivalent GET', () => {
    const sandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES });
    const getRes = callDoGet(sandbox, { action: 'getItems', key: API_KEY });
    const postRes = callDoPostForm(sandbox, { action: 'getItems', key: API_KEY });
    expect(postRes).toEqual(getRes);
  });

  it('a form-encoded POST accepts a token for an allow-listed read', () => {
    const { sandbox } = loadWithToken();
    const res = callDoPostForm(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.success).toBe(true);
  });

  it('a form-encoded POST with a bad token is refused with the token code, not read_only', () => {
    const { sandbox } = loadWithToken({ responses: [{ code: 401, body: 'nope' }] });
    const res = callDoPostForm(sandbox, { action: 'getItems', access_token: TOKEN });
    expect(res.code).toBe('token_invalid');
  });

  it('the JSON-body POST path runs today\'s write flow unchanged when no token is present', () => {
    const sandbox = loadAuthPath({ ...FIXTURE, properties: VALID_PROPERTIES });
    const res = callDoPostJson<ApiItem>(sandbox, {
      key: API_KEY,
      action: 'updateItem',
      id: 'item-1',
      changes: { title: 'Renamed' },
      actor: 'test',
    });
    expect(res.success).toBe(true);
    expect((res.data as ApiItem).title).toBe('Renamed');
  });

  it('a token in e.parameter.access_token refuses the JSON-body path outright', () => {
    const { sandbox } = loadWithToken();
    const res = callDoPostJson(sandbox, { action: 'createItem', data: { title: 'x' } }, { access_token: TOKEN });
    expect(res.success).toBe(false);
    expect(res.code).toBe('read_only');
  });

  it('a token inside the JSON body itself refuses the JSON-body path outright', () => {
    const { sandbox } = loadWithToken();
    const res = callDoPostJson(sandbox, { action: 'createItem', access_token: TOKEN, data: { title: 'x' } });
    expect(res.success).toBe(false);
    expect(res.code).toBe('read_only');
  });
});
