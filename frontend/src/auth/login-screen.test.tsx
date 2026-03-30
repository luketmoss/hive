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

describe('Login tagline (Issue #189)', () => {
  it('AC1: displays "Plan. Track. Do." as the tagline', () => {
    const { container } = render(<LoginScreen />);
    const p = container.querySelector('.login-card p');
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe('Plan. Track. Do.');
  });

  it('AC1: tagline appears between the title and sign-in button', () => {
    const { container } = render(<LoginScreen />);
    const card = container.querySelector('.login-card')!;
    const children = Array.from(card.children);
    const h1Idx = children.findIndex(c => c.tagName === 'H1');
    const pIdx = children.findIndex(c => c.tagName === 'P');
    const btnIdx = children.findIndex(c => c.tagName === 'BUTTON');
    expect(pIdx).toBeGreaterThan(h1Idx);
    expect(pIdx).toBeLessThan(btnIdx);
  });

  it('AC1: "Hive" is still the title', () => {
    const { container } = render(<LoginScreen />);
    const h1 = container.querySelector('.login-card h1');
    expect(h1!.textContent).toBe('Hive');
  });
});
