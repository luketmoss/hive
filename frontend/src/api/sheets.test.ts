import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { upsertOwner } from './sheets';

// Mock fetch globally for Sheets API calls
const mockFetch = vi.fn() as Mock;
globalThis.fetch = mockFetch;

// The module reads VITE_SPREADSHEET_ID from import.meta.env.
// Vitest + Vite makes this available, but we set a fallback via env.
// Sheets functions build URLs from this, but we mock fetch so the value doesn't matter.

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
