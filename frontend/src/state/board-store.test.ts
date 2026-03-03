import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// We need to test the actual store, not a mock.
// To do this, we need to re-import the module for each test group
// since the signal is created at module load time.

describe('viewMode persistence (AC4)', () => {
  let originalGetItem: typeof Storage.prototype.getItem;
  let originalSetItem: typeof Storage.prototype.setItem;

  beforeEach(() => {
    originalGetItem = Storage.prototype.getItem;
    originalSetItem = Storage.prototype.setItem;
    vi.resetModules();
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
    Storage.prototype.setItem = originalSetItem;
    localStorage.removeItem('hive-view-mode');
  });

  it('defaults to "board" when localStorage has no stored value', async () => {
    localStorage.removeItem('hive-view-mode');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('board');
  });

  it('loads "list" from localStorage when previously stored', async () => {
    localStorage.setItem('hive-view-mode', 'list');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('list');
  });

  it('loads "board" from localStorage when previously stored', async () => {
    localStorage.setItem('hive-view-mode', 'board');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('board');
  });

  it('defaults to "board" when localStorage has an invalid value', async () => {
    localStorage.setItem('hive-view-mode', 'invalid');
    const store = await import('./board-store');
    expect(store.viewMode.value).toBe('board');
  });

  it('persists preference to localStorage when setViewMode is called', async () => {
    localStorage.removeItem('hive-view-mode');
    const store = await import('./board-store');

    store.setViewMode('list');
    expect(store.viewMode.value).toBe('list');
    expect(localStorage.getItem('hive-view-mode')).toBe('list');

    store.setViewMode('board');
    expect(store.viewMode.value).toBe('board');
    expect(localStorage.getItem('hive-view-mode')).toBe('board');
  });

  it('handles localStorage errors gracefully on read', async () => {
    Storage.prototype.getItem = () => { throw new Error('quota exceeded'); };
    const store = await import('./board-store');
    // Should default to 'board' without throwing
    expect(store.viewMode.value).toBe('board');
  });

  it('handles localStorage errors gracefully on write', async () => {
    localStorage.removeItem('hive-view-mode');
    const store = await import('./board-store');
    Storage.prototype.setItem = () => { throw new Error('quota exceeded'); };
    // Should not throw
    expect(() => store.setViewMode('list')).not.toThrow();
    expect(store.viewMode.value).toBe('list');
  });
});
