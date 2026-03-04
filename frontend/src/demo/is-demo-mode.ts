// Demo mode detection utility.
// Both conditions must be true (defense in depth):
//   1. VITE_DEMO_MODE=true must be set at build time
//   2. ?demo=true query param must be present at runtime

let _cached: boolean | null = null;

export function isDemoMode(): boolean {
  if (_cached !== null) return _cached;
  const envEnabled = import.meta.env.VITE_DEMO_MODE === 'true';
  const paramEnabled = new URLSearchParams(window.location.search).get('demo') === 'true';
  _cached = envEnabled && paramEnabled;
  return _cached;
}

/** Reset cached value (for testing only). */
export function _resetDemoModeCache(): void {
  _cached = null;
}
