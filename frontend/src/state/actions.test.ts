import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  upsertOwner: vi.fn().mockResolvedValue(false),
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
  upsertOwner: vi.fn().mockResolvedValue(false),
}));

import { ensureOwnerRegistered, loadBoard } from './actions';
import { owners, loading } from './board-store';
import * as sheetsApi from '../api/sheets';

const mockUpsertOwner = vi.mocked(sheetsApi.upsertOwner);
const mockFetchOwners = vi.mocked(sheetsApi.fetchOwners);
const mockFetchAllItems = vi.mocked(sheetsApi.fetchAllItems);
const mockFetchLabels = vi.mocked(sheetsApi.fetchLabels);

describe('ensureOwnerRegistered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 1: First-time sign-in calls upsertOwner with display name and email
  it('calls upsertOwner with display name and email', async () => {
    mockUpsertOwner.mockResolvedValueOnce(true);
    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };

    const result = await ensureOwnerRegistered(user, 'test-token');

    expect(result).toBe(true);
    expect(mockUpsertOwner).toHaveBeenCalledWith('Luke', 'luke@example.com', 'test-token');
  });

  // Scenario 2: Returning user — upsertOwner returns false (no write)
  it('returns false when upsertOwner finds no changes needed', async () => {
    mockUpsertOwner.mockResolvedValueOnce(false);
    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };

    const result = await ensureOwnerRegistered(user, 'test-token');

    expect(result).toBe(false);
  });

  // Edge case: Google account with no display name falls back to email prefix
  it('falls back to email prefix when display name is empty', async () => {
    mockUpsertOwner.mockResolvedValueOnce(true);
    const user: UserInfo = { name: '', email: 'luke@example.com', picture: '' };

    await ensureOwnerRegistered(user, 'test-token');

    expect(mockUpsertOwner).toHaveBeenCalledWith('luke', 'luke@example.com', 'test-token');
  });

  // Scenario 5: Auto-register fails gracefully
  it('returns false and logs to console when upsertOwner throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpsertOwner.mockRejectedValueOnce(new Error('Network error'));
    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };

    const result = await ensureOwnerRegistered(user, 'test-token');

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Auto-register owner failed:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('loadBoard with auto-registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAllItems.mockResolvedValue([]);
    mockFetchLabels.mockResolvedValue([]);
    mockFetchOwners.mockResolvedValue([{ name: 'Mom', google_account: 'mom@example.com' }]);
  });

  // Scenario 1: loadBoard triggers auto-registration and re-fetches owners on write
  it('auto-registers user and re-fetches owners when upsert writes', async () => {
    mockUpsertOwner.mockResolvedValueOnce(true);
    // After upsert, the re-fetch returns updated owners
    mockFetchOwners
      .mockResolvedValueOnce([{ name: 'Mom', google_account: 'mom@example.com' }])  // initial load
      .mockResolvedValueOnce([
        { name: 'Mom', google_account: 'mom@example.com' },
        { name: 'Luke', google_account: 'luke@example.com' },
      ]);  // re-fetch after upsert

    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };
    await loadBoard('test-token', user);

    expect(mockUpsertOwner).toHaveBeenCalledWith('Luke', 'luke@example.com', 'test-token');
    // fetchOwners called twice: once in initial parallel fetch, once after upsert
    expect(mockFetchOwners).toHaveBeenCalledTimes(2);
    // owners signal should have both owners
    expect(owners.value).toHaveLength(2);
    expect(owners.value.find(o => o.name === 'Luke')).toBeTruthy();
    expect(loading.value).toBe(false);
  });

  // Scenario 2: No re-fetch when upsert returns false (no change)
  it('skips re-fetch when upsert returns false (no change needed)', async () => {
    mockUpsertOwner.mockResolvedValueOnce(false);

    const user: UserInfo = { name: 'Mom', email: 'mom@example.com', picture: '' };
    await loadBoard('test-token', user);

    expect(mockUpsertOwner).toHaveBeenCalled();
    // fetchOwners called only once (initial load), not re-fetched
    expect(mockFetchOwners).toHaveBeenCalledTimes(1);
    expect(loading.value).toBe(false);
  });

  // loadBoard without user does not call ensureOwnerRegistered
  it('does not call upsertOwner when user is not provided', async () => {
    await loadBoard('test-token');

    expect(mockUpsertOwner).not.toHaveBeenCalled();
    expect(loading.value).toBe(false);
  });

  // Scenario 5: Board loads even if auto-registration fails
  it('still loads the board when auto-registration fails', async () => {
    mockUpsertOwner.mockRejectedValueOnce(new Error('Network error'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const user: UserInfo = { name: 'Luke', email: 'luke@example.com', picture: '' };
    await loadBoard('test-token', user);

    // Board should still have loaded successfully
    expect(owners.value).toHaveLength(1);
    expect(owners.value[0].name).toBe('Mom');
    expect(loading.value).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
