import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserInfo } from '../api/types';

// Mock the sheets API module before importing actions
vi.mock('../api/sheets', () => ({
  fetchAllItems: vi.fn().mockResolvedValue([]),
  fetchOwners: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  createItemRow: vi.fn().mockResolvedValue(undefined),
  updateItemRow: vi.fn().mockResolvedValue(undefined),
  deleteItemRow: vi.fn().mockResolvedValue(undefined),
  appendAuditEntry: vi.fn().mockResolvedValue(undefined),
  SheetsApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(`Sheets API ${status}: ${message}`);
      this.status = status;
    }
  },
}));

// Mock demo mode to return false (real API mode)
vi.mock('../demo/is-demo-mode', () => ({
  isDemoMode: vi.fn().mockReturnValue(false),
}));

// Mock the mock-api module (required by actions.ts import)
vi.mock('../demo/mock-api', () => ({
  fetchAllItems: vi.fn().mockResolvedValue([]),
  fetchOwners: vi.fn().mockResolvedValue([]),
  fetchLabels: vi.fn().mockResolvedValue([]),
  createItemRow: vi.fn().mockResolvedValue(undefined),
  updateItemRow: vi.fn().mockResolvedValue(undefined),
  deleteItemRow: vi.fn().mockResolvedValue(undefined),
  appendAuditEntry: vi.fn().mockResolvedValue(undefined),
}));

import { loadBoard, NotAllowedError } from './actions';
import { owners, loading } from './board-store';
import * as sheetsApi from '../api/sheets';

const mockFetchOwners = vi.mocked(sheetsApi.fetchOwners);
const mockFetchAllItems = vi.mocked(sheetsApi.fetchAllItems);
const mockFetchLabels = vi.mocked(sheetsApi.fetchLabels);

describe('loadBoard owner allowlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAllItems.mockResolvedValue([]);
    mockFetchLabels.mockResolvedValue([]);
  });

  it('loads the board when user email is in the Owners sheet', async () => {
    mockFetchOwners.mockResolvedValue([
      { name: 'Luke', google_account: 'luke@example.com' },
    ]);

    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };
    await loadBoard('test-token', user);

    expect(owners.value).toHaveLength(1);
    expect(loading.value).toBe(false);
  });

  it('throws NotAllowedError when user email is not in Owners sheet', async () => {
    mockFetchOwners.mockResolvedValue([
      { name: 'Luke', google_account: 'luke@example.com' },
    ]);

    const user: UserInfo = { name: 'Stranger', email: 'stranger@example.com', picture: '' };
    await expect(loadBoard('test-token', user)).rejects.toThrow(NotAllowedError);
    expect(loading.value).toBe(false);
  });

  it('matches email case-insensitively', async () => {
    mockFetchOwners.mockResolvedValue([
      { name: 'Luke', google_account: 'Luke@Example.COM' },
    ]);

    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };
    await loadBoard('test-token', user);

    expect(owners.value).toHaveLength(1);
    expect(loading.value).toBe(false);
  });

  it('skips allowlist check when no user is provided', async () => {
    mockFetchOwners.mockResolvedValue([]);

    await loadBoard('test-token');

    // No error thrown even though owners list is empty
    expect(loading.value).toBe(false);
  });
});
