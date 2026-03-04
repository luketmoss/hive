import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isDemoMode, _resetDemoModeCache } from './is-demo-mode';

// We need to mock import.meta.env at the module level.
// Vitest supports overriding import.meta.env directly.

function setEnv(val: string | undefined) {
  if (val === undefined) {
    delete (import.meta.env as any).VITE_DEMO_MODE;
  } else {
    (import.meta.env as any).VITE_DEMO_MODE = val;
  }
}

function setQueryParam(demo: boolean) {
  const url = new URL(window.location.href);
  if (demo) {
    url.searchParams.set('demo', 'true');
  } else {
    url.searchParams.delete('demo');
  }
  // jsdom supports direct assignment
  Object.defineProperty(window, 'location', {
    value: new URL(url.toString()),
    writable: true,
    configurable: true,
  });
}

describe('isDemoMode()', () => {
  beforeEach(() => {
    _resetDemoModeCache();
  });

  afterEach(() => {
    _resetDemoModeCache();
    delete (import.meta.env as any).VITE_DEMO_MODE;
  });

  // Scenario 1: Both env var AND query param => demo mode active
  it('returns true when VITE_DEMO_MODE=true AND ?demo=true', () => {
    setEnv('true');
    setQueryParam(true);
    expect(isDemoMode()).toBe(true);
  });

  // Scenario 2: Production (no env var) + query param => NOT active
  it('returns false when VITE_DEMO_MODE is not set even with ?demo=true', () => {
    setEnv(undefined);
    setQueryParam(true);
    expect(isDemoMode()).toBe(false);
  });

  // Scenario 3: Env var set but no query param => NOT active
  it('returns false when VITE_DEMO_MODE=true but no ?demo=true', () => {
    setEnv('true');
    setQueryParam(false);
    expect(isDemoMode()).toBe(false);
  });

  // Both absent
  it('returns false when neither condition is met', () => {
    setEnv(undefined);
    setQueryParam(false);
    expect(isDemoMode()).toBe(false);
  });

  // Env var is "false" (string)
  it('returns false when VITE_DEMO_MODE=false even with ?demo=true', () => {
    setEnv('false');
    setQueryParam(true);
    expect(isDemoMode()).toBe(false);
  });

  // Caching behavior
  it('caches the result after first call', () => {
    setEnv('true');
    setQueryParam(true);
    expect(isDemoMode()).toBe(true);
    // Change env — should still return cached value
    setEnv(undefined);
    expect(isDemoMode()).toBe(true);
  });

  it('cache resets with _resetDemoModeCache', () => {
    setEnv('true');
    setQueryParam(true);
    expect(isDemoMode()).toBe(true);
    _resetDemoModeCache();
    setEnv(undefined);
    expect(isDemoMode()).toBe(false);
  });
});
