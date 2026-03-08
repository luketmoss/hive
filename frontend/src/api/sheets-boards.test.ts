/**
 * Tests for sheets.ts board operations with color and icon (issue #74).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

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

import { fetchBoards, createBoardRow, updateBoardRow } from './sheets';

const mockFetch = vi.fn() as Mock;
globalThis.fetch = mockFetch;

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

beforeEach(() => {
  mockFetch.mockReset();
});

// --- AC1/AC2: fetchBoards maps color (col E) and icon (col F) ---

describe('fetchBoards — color and icon columns', () => {
  it('maps color (column E) and icon (column F) from Boards!A2:F', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['board-1', 'Family', '2025-01-01', 'user@test.com', '#1976d2', '🏠'],
        ['board-2', 'Work', '2025-01-02', 'other@test.com', '#388e3c', '🏢'],
      ])
    );

    const boards = await fetchBoards('test-token');

    expect(boards).toHaveLength(2);
    expect(boards[0].color).toBe('#1976d2');
    expect(boards[0].icon).toBe('🏠');
    expect(boards[1].color).toBe('#388e3c');
    expect(boards[1].icon).toBe('🏢');
  });

  it('returns empty string for missing color/icon (AC5: migration)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['board-1', 'Old Board', '2024-01-01', 'user@test.com'],
        // No columns E or F — pre-feature board
      ])
    );

    const boards = await fetchBoards('test-token');

    expect(boards[0].color).toBe('');
    expect(boards[0].icon).toBe('');
  });

  it('fetches from Boards!A2:F range', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsGetResponse([]));

    await fetchBoards('test-token');

    const url: string = mockFetch.mock.calls[0][0];
    // sheets.ts uses encodeURIComponent on the range — '!' stays as '!' in the base URL
    expect(url).toContain('Boards!A2%3AF');
  });
});

// --- AC1/AC2: createBoardRow writes color and icon ---

describe('createBoardRow — color and icon written to columns E and F', () => {
  it('appends board with color and icon', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await createBoardRow({
      id: 'b1',
      name: 'My Board',
      created_at: '2025-01-01',
      created_by: 'user@test.com',
      color: '#d32f2f',
      icon: '🎯',
    }, 'test-token');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const row = body.values[0];
    expect(row[4]).toBe('#d32f2f'); // column E = color
    expect(row[5]).toBe('🎯');     // column F = icon
  });

  it('writes empty strings when color and icon are not set', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await createBoardRow({
      id: 'b2',
      name: 'Plain Board',
      created_at: '2025-01-01',
      created_by: 'user@test.com',
    }, 'test-token');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const row = body.values[0];
    expect(row[4]).toBe('');
    expect(row[5]).toBe('');
  });
});

// --- AC4: updateBoardRow writes color and icon for existing board ---

describe('updateBoardRow', () => {
  it('finds board row by ID and updates columns E and F', async () => {
    // First call: sheetsGet('Boards!A2:A') to find the row
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['board-1'],
        ['board-2'],
      ])
    );
    // Second call: sheetsUpdate to write color and icon
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await updateBoardRow('board-2', '#7b1fa2', '🎮', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should be a PUT to Boards!E3:F3 (board-2 is row index 1 → sheetRow 3)
    const [updateUrl, updateOptions] = mockFetch.mock.calls[1];
    expect(updateUrl).toContain('Boards!E3%3AF3');
    expect(updateOptions.method).toBe('PUT');
    const body = JSON.parse(updateOptions.body);
    expect(body.values[0]).toEqual(['#7b1fa2', '🎮']);
  });

  it('is a no-op if board ID is not found', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([['board-1'], ['board-2']])
    );

    // No second fetch call expected
    await updateBoardRow('board-999', '#fff', '❓', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
