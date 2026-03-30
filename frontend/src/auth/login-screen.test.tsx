import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { LoginScreen } from './login-screen';

vi.mock('./auth-context', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock('../components/shared/hive-logo', () => ({
  HiveLogo: (props: any) => <svg data-testid="hive-logo" width={props.size} class={props.class} />,
}));

describe('LoginScreen logo (Issue #30 AC4)', () => {
  it('renders HiveLogo above the h1', () => {
    const { container } = render(<LoginScreen />);
    const card = container.querySelector('.login-card');
    expect(card).not.toBeNull();
    const logo = card!.querySelector('[data-testid="hive-logo"]');
    expect(logo).not.toBeNull();

    // Logo should come before h1
    const children = Array.from(card!.children);
    const logoIdx = children.findIndex(c => c.getAttribute('data-testid') === 'hive-logo');
    const h1Idx = children.findIndex(c => c.tagName === 'H1');
    expect(logoIdx).toBeLessThan(h1Idx);
  });

  it('renders logo at size 64', () => {
    const { container } = render(<LoginScreen />);
    const logo = container.querySelector('[data-testid="hive-logo"]');
    expect(logo!.getAttribute('width')).toBe('64');
  });

  it('logo has the login-logo class', () => {
    const { container } = render(<LoginScreen />);
    const logo = container.querySelector('[data-testid="hive-logo"]');
    expect(logo!.classList.contains('login-logo')).toBe(true);
  });
});
