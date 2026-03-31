/**
 * Tests for sheets.ts board operations with icon (issue #74).
 * Board color has been removed from the frontend type — column E is always written as empty.
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

import { fetchBoards, createBoardRow, updateBoardRow, renameBoardRow } from './sheets';

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

// --- fetchBoards maps icon (col F) ---

describe('fetchBoards — icon column', () => {
  it('maps icon (column F) from Boards!A2:F', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['board-1', 'Family', '2025-01-01', 'user@test.com', '', '🏠'],
        ['board-2', 'Work', '2025-01-02', 'other@test.com', '', '🏢'],
      ])
    );

    const boards = await fetchBoards('test-token');

    expect(boards).toHaveLength(2);
    expect(boards[0].icon).toBe('🏠');
    expect(boards[1].icon).toBe('🏢');
  });

  it('board has no color property', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['board-1', 'Family', '2025-01-01', 'user@test.com', '#1976d2', '🏠'],
      ])
    );

    const boards = await fetchBoards('test-token');

    expect(boards[0]).not.toHaveProperty('color');
  });

  it('returns empty string for missing icon (migration)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['board-1', 'Old Board', '2024-01-01', 'user@test.com'],
        // No columns E or F — pre-feature board
      ])
    );

    const boards = await fetchBoards('test-token');

    expect(boards[0].icon).toBe('');
  });

  it('fetches from Boards!A2:F range', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsGetResponse([]));

    await fetchBoards('test-token');

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('Boards!A2%3AF');
  });
});

// --- createBoardRow writes empty color (col E) and icon (col F) ---

describe('createBoardRow — icon written to column F, color always empty', () => {
  it('appends board with empty color and icon', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await createBoardRow({
      id: 'b1',
      name: 'My Board',
      created_at: '2025-01-01',
      created_by: 'user@test.com',
      icon: '🎯',
    }, 'test-token');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const row = body.values[0];
    expect(row[4]).toBe('');   // column E = color (always empty)
    expect(row[5]).toBe('🎯'); // column F = icon
  });

  it('writes empty strings when icon is not set', async () => {
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

// --- updateBoardRow writes color and icon for existing board ---

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

    await updateBoardRow('board-2', '', '🎮', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should be a PUT to Boards!E3:F3 (board-2 is row index 1 → sheetRow 3)
    const [updateUrl, updateOptions] = mockFetch.mock.calls[1];
    expect(updateUrl).toContain('Boards!E3%3AF3');
    expect(updateOptions.method).toBe('PUT');
    const body = JSON.parse(updateOptions.body);
    expect(body.values[0]).toEqual(['', '🎮']);
  });

  it('is a no-op if board ID is not found', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([['board-1'], ['board-2']])
    );

    await updateBoardRow('board-999', '', '❓', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// --- renameBoardRow writes name to column B ---

describe('renameBoardRow (issue #138)', () => {
  it('finds board row by ID and updates column B with the new name', async () => {
    // First call: sheetsGet('Boards!A2:A') to find the row
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['board-1'],
        ['board-2'],
      ])
    );
    // Second call: sheetsUpdate to write name
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await renameBoardRow('board-2', 'Renamed Board', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should be a PUT to Boards!B3 (board-2 is row index 1 → sheetRow 3)
    const [updateUrl, updateOptions] = mockFetch.mock.calls[1];
    expect(updateUrl).toContain('Boards!B3');
    expect(updateOptions.method).toBe('PUT');
    const body = JSON.parse(updateOptions.body);
    expect(body.values[0]).toEqual(['Renamed Board']);
  });

  it('is a no-op if board ID is not found', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([['board-1'], ['board-2']])
    );

    await renameBoardRow('board-999', 'Ghost Board', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('writes to the correct row for the first board (row 2)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([['board-1']])
    );
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await renameBoardRow('board-1', 'My Board', 'test-token');

    const [updateUrl] = mockFetch.mock.calls[1];
    expect(updateUrl).toContain('Boards!B2');
  });
});
