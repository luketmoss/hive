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

import {
  createLabelRow,
  updateLabelRow,
  deleteLabelRow,
  fetchLabelsWithRows,
  cascadeLabelUpdate,
} from './sheets';

// Mock fetch globally
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

function mockSheetsPropertiesResponse(sheetTitle: string, sheetId: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      sheets: [{ properties: { title: sheetTitle, sheetId } }],
    }),
    text: async () => '',
  };
}

describe('Sheets API label CRUD', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // Scenario 1: createLabelRow appends to Labels sheet
  it('createLabelRow appends a new row to Labels sheet', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await createLabelRow('Urgent', '#E74C3C', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    const url = call[0] as string;
    expect(url).toContain('Labels');
    expect(url).toContain(':append');
    const body = JSON.parse(call[1].body);
    expect(body.values).toEqual([['Urgent', '#E74C3C']]);
  });

  // Scenario 3: updateLabelRow updates a specific row in Labels sheet
  it('updateLabelRow updates a specific row', async () => {
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await updateLabelRow(3, 'Renamed', '#00FF00', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    const url = call[0] as string;
    expect(url).toContain('Labels!A3');
    expect(call[1].method).toBe('PUT');
    const body = JSON.parse(call[1].body);
    expect(body.values).toEqual([['Renamed', '#00FF00']]);
  });

  // Scenario 4: deleteLabelRow finds Labels sheet ID and deletes the row
  it('deleteLabelRow deletes a row from the Labels sheet', async () => {
    // First call: get sheet properties
    mockFetch.mockResolvedValueOnce(mockSheetsPropertiesResponse('Labels', 42));
    // Second call: batchUpdate to delete row
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await deleteLabelRow(3, 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Verify batchUpdate call
    const batchCall = mockFetch.mock.calls[1];
    const batchUrl = batchCall[0] as string;
    expect(batchUrl).toContain(':batchUpdate');
    const batchBody = JSON.parse(batchCall[1].body);
    expect(batchBody.requests[0].deleteDimension.range.sheetId).toBe(42);
    expect(batchBody.requests[0].deleteDimension.range.startIndex).toBe(2); // 0-based: row 3 - 1
    expect(batchBody.requests[0].deleteDimension.range.endIndex).toBe(3);
  });

  // fetchLabelsWithRows returns labels with row numbers
  it('fetchLabelsWithRows returns labels with sheetRow', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['Errands', '#42a5f5'],
        ['Home', '#66bb6a'],
      ])
    );

    const result = await fetchLabelsWithRows('test-token');

    expect(result).toEqual([
      { label: 'Errands', color: '#42a5f5', sheetRow: 2 },
      { label: 'Home', color: '#66bb6a', sheetRow: 3 },
    ]);
  });

  // Scenario 3: cascadeLabelUpdate renames a label in Items
  it('cascadeLabelUpdate renames a label in items that contain it', async () => {
    // GET Items!A2:N
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['id-1', 'Task 1', '', 'To Do', '', '', '', 'Errands, Home', '', '', '', '', '1', ''],
        ['id-2', 'Task 2', '', 'To Do', '', '', '', 'Home', '', '', '', '', '2', ''],
        ['id-3', 'Task 3', '', 'Done', '', '', '', '', '', '', '', '', '3', ''],
      ])
    );
    // PUT for item id-1 (only this item has Errands)
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await cascadeLabelUpdate('Errands', 'Shopping', 'test-token');

    // Only 2 calls: 1 GET + 1 PUT (only id-1 has Errands)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const putCall = mockFetch.mock.calls[1];
    const putUrl = putCall[0] as string;
    expect(putUrl).toContain('Items!H2'); // row 2 (index 0 + 2)
    const putBody = JSON.parse(putCall[1].body);
    expect(putBody.values).toEqual([['Shopping, Home']]);
  });

  // Scenario 4: cascadeLabelUpdate removes a label from items when newName is empty
  it('cascadeLabelUpdate removes a label from items when newName is empty', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['id-1', 'Task 1', '', 'To Do', '', '', '', 'Errands, Home', '', '', '', '', '1', ''],
        ['id-2', 'Task 2', '', 'To Do', '', '', '', 'Errands', '', '', '', '', '2', ''],
      ])
    );
    // Two PUT calls (both items have Errands)
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());
    mockFetch.mockResolvedValueOnce(mockSheetsWriteResponse());

    await cascadeLabelUpdate('Errands', '', 'test-token');

    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 GET + 2 PUTs
    // First item: "Home"
    const put1Body = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(put1Body.values).toEqual([['Home']]);
    // Second item: "" (empty string, Errands was the only label)
    const put2Body = JSON.parse(mockFetch.mock.calls[2][1].body);
    expect(put2Body.values).toEqual([['']]);
  });

  // Edge case: cascadeLabelUpdate with no matching items
  it('cascadeLabelUpdate does nothing when no items reference the label', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSheetsGetResponse([
        ['id-1', 'Task 1', '', 'To Do', '', '', '', 'Home', '', '', '', '', '1', ''],
      ])
    );

    await cascadeLabelUpdate('NonExistent', 'Something', 'test-token');

    // Only the GET call, no PUTs
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
