// Demo mode banner — rendered above the board when demo mode is active.
// Uses role="status" + aria-live="polite" for screen reader accessibility.

export function DemoBanner() {
  return (
    <div
      class="demo-banner"
      role="status"
      aria-live="polite"
      data-testid="demo-banner"
    >
      <strong>Demo Mode</strong> — Changes are not saved
    </div>
  );
}
