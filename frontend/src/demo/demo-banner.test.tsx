import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/preact';
import { DemoBanner } from './demo-banner';

describe('DemoBanner', () => {
  it('renders with "Demo Mode" text', () => {
    const { container } = render(<DemoBanner />);
    expect(container.textContent).toContain('Demo Mode');
    expect(container.textContent).toContain('Changes are not saved');
  });

  it('has role="status" for screen reader accessibility', () => {
    const { container } = render(<DemoBanner />);
    const banner = container.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
  });

  it('has aria-live="polite"', () => {
    const { container } = render(<DemoBanner />);
    const banner = container.querySelector('[aria-live="polite"]');
    expect(banner).not.toBeNull();
  });

  it('has the demo-banner CSS class', () => {
    const { container } = render(<DemoBanner />);
    const banner = container.querySelector('.demo-banner');
    expect(banner).not.toBeNull();
  });

  it('has data-testid for agent testing', () => {
    const { container } = render(<DemoBanner />);
    const banner = container.querySelector('[data-testid="demo-banner"]');
    expect(banner).not.toBeNull();
  });
});
