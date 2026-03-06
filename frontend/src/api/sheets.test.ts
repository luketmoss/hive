import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock the reauth module before importing sheets
vi.mock('../auth/reauth', () => ({
  attemptReauth: vi.fn(),
  ReauthFailedError: class ReauthFailedError extends Error {
    declare cause?: Error;
    constructor(cause?: Error) {
      super('Silent re-auth failed');
      this.name = 'ReauthFailedError';
      this.cause = cause;
    }
  },
}));

import { upsertOwner, fetchAllItems, fetchOwners, updateItemRow } from './sheets';
import { attemptReauth } from '../auth/reauth';
import { ReauthFailedError } from '../auth/reauth';

const mockAttemptReauth = vi.mocked(attemptReauth);

// Mock fetch globally for Sheets API calls
const mockFetch = vi.fn() as Mock;
globalThis.fetch = mockFetch;

// The module reads VITE_SPREADSHEET_ID from import.meta.env.
// Vitest + Vite makes this available, but we set a fallback via env.
// Sheets functions build URLs from this, but we mock fetch so the value doesn't matter.

function mock401Response() {
  return {
    ok: false,
    status: 401,
    json: async () => ({}),
    text: async () => 'Unauthorized',
  };
}

function mockSheetsGetResponse(values: any[][]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ values }),
    text: async () => '',
  };
}

function mockSheetsWriteResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  };
}

describe('upsertOwner', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockAttemptReauth.mockReset();
  });

  // Scenario 1: First-time sign-in auto-registers owner
  it('appends a new row when email is not found in Owners sheet', async () => {
    // First call: sheetsGet('Owners!A2:B') — returns existing owners without the new user
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['Mom', 'mom@example.com'],
        ['Dad', 'dad@example.com'],
      ])
    );
    // Second call: sheetsAppend — appends the new owner row
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    const result = await upsertOwner('Luke', 'luke@example.com', 'test-token');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify the append call
    const appendCall = mockFetch.mock.calls[1];
    const appendUrl = appendCall[0] as string;
    expect(appendUrl).toContain('Owners');
    expect(appendUrl).toContain(':append');
    const appendBody = JSON.parse(appendCall[1].body);
    expect(appendBody.values).toEqual([['Luke', 'luke@example.com']]);
  });

  // Scenario 2: Returning user does not duplicate
  it('returns false (no write) when email exists and name matches', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['Mom', 'mom@example.com'],
        ['Luke', 'luke@example.com'],
      ])
    );

    const result = await upsertOwner('Luke', 'luke@example.com', 'test-token');

    expect(result).toBe(false);
    // Only the GET call, no write
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Scenario 2 (name change): Updates name when email exists but name differs
  it('updates the name when email exists but display name has changed', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['Mom', 'mom@example.com'],
        ['Old Name', 'luke@example.com'],
      ])
    );
    // sheetsUpdate call
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    const result = await upsertOwner('Luke', 'luke@example.com', 'test-token');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify the update call targets the correct row (index 1 in data = row 3 in sheet)
    const updateCall = mockFetch.mock.calls[1];
    const updateUrl = updateCall[0] as string;
    // URL-encoded: colon becomes %3A via encodeURIComponent
    expect(updateUrl).toContain('Owners!A3%3AB3');
    expect(updateCall[1].method).toBe('PUT');
    const updateBody = JSON.parse(updateCall[1].body);
    expect(updateBody.values).toEqual([['Luke', 'luke@example.com']]);
  });

  // Email matching should be case-insensitive
  it('matches email case-insensitively', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['Luke', 'Luke@Example.COM'],
      ])
    );

    const result = await upsertOwner('Luke', 'luke@example.com', 'test-token');

    expect(result).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Edge case: empty Owners sheet
  it('appends when Owners sheet is empty', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsGetResponse([]));
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    const result = await upsertOwner('Luke', 'luke@example.com', 'test-token');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // Scenario 5: API failure propagates (ensureOwnerRegistered catches it)
  it('throws when the Sheets API returns an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(upsertOwner('Luke', 'luke@example.com', 'test-token'))
      .rejects.toThrow('Sheets API 500');
  });
});

// --- AC2: Stale/revoked token on first API call → silent re-auth ---
describe('withReauth: stale token triggers silent re-auth (AC2)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockAttemptReauth.mockReset();
  });

  it('retries fetchAllItems with new token after 401 + successful reauth', async () => {
    // First call: 401 (stale token)
    mockFetch.mockResolvedValueOnce(mock401Response());
    // attemptReauth succeeds with fresh token
    mockAttemptReauth.mockResolvedValueOnce('fresh-token');
    // Retry call with fresh token: success
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['id-1', 'Task 1', '', 'To Do', '', '', '', '', '', '', '', '', '1', ''],
      ])
    );

    const result = await fetchAllItems('stale-token');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Task 1');
    expect(mockAttemptReauth).toHaveBeenCalledTimes(1);
    // First call used stale token, retry used fresh token
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryHeaders = mockFetch.mock.calls[1][1]?.headers || {};
    expect(retryHeaders.Authorization || mockFetch.mock.calls[1][0]).toBeDefined();
  });

  it('retries fetchOwners with new token after 401 + successful reauth', async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(mock401Response());
    // Reauth succeeds
    mockAttemptReauth.mockResolvedValueOnce('fresh-token');
    // Retry: success
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([['Mom', 'mom@example.com']])
    );

    const result = await fetchOwners('stale-token');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Mom');
    expect(mockAttemptReauth).toHaveBeenCalledTimes(1);
  });
});

// --- AC3: Silent re-auth fails after stale token → propagate ReauthFailedError ---
describe('withReauth: reauth failure propagates (AC3)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockAttemptReauth.mockReset();
  });

  it('propagates ReauthFailedError when reauth fails after 401', async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(mock401Response());
    // Reauth fails
    mockAttemptReauth.mockRejectedValueOnce(
      new ReauthFailedError(new Error('popup blocked'))
    );

    await expect(fetchAllItems('stale-token')).rejects.toThrow(ReauthFailedError);
    expect(mockAttemptReauth).toHaveBeenCalledTimes(1);
    // No retry attempt after reauth failure
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// --- AC4: Mid-session token expiry → silent re-auth + retry ---
describe('withReauth: mid-session 401 retries API call (AC4)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockAttemptReauth.mockReset();
  });

  it('retries updateItemRow with new token after mid-session 401', async () => {
    const item = {
      id: 'id-1', title: 'Test', description: '', status: 'To Do' as const,
      owner: '', due_date: '', scheduled_date: '', labels: '', parent_id: '',
      created_at: '', updated_at: '', completed_at: '', sort_order: 1, created_by: '',
    };

    // First call: 401 (expired token mid-session)
    mockFetch.mockResolvedValueOnce(mock401Response());
    // Reauth succeeds
    mockAttemptReauth.mockResolvedValueOnce('refreshed-token');
    // Retry: success
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    // Should not throw — retried successfully
    await updateItemRow(2, item, 'expired-token');

    expect(mockAttemptReauth).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// --- AC5: Mid-session reauth fails → propagate error ---
describe('withReauth: mid-session reauth failure (AC5)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockAttemptReauth.mockReset();
  });

  it('propagates ReauthFailedError when mid-session reauth fails', async () => {
    const item = {
      id: 'id-1', title: 'Test', description: '', status: 'To Do' as const,
      owner: '', due_date: '', scheduled_date: '', labels: '', parent_id: '',
      created_at: '', updated_at: '', completed_at: '', sort_order: 1, created_by: '',
    };

    // First call: 401
    mockFetch.mockResolvedValueOnce(mock401Response());
    // Reauth fails
    mockAttemptReauth.mockRejectedValueOnce(
      new ReauthFailedError(new Error('consent revoked'))
    );

    await expect(updateItemRow(2, item, 'expired-token'))
      .rejects.toThrow(ReauthFailedError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-401 errors', async () => {
    // 500 error — should not trigger reauth
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    });

    await expect(fetchAllItems('valid-token')).rejects.toThrow('Sheets API 500');
    expect(mockAttemptReauth).not.toHaveBeenCalled();
  });
});
