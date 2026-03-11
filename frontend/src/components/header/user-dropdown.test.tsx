import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { UserDropdown } from './user-dropdown';

vi.mock('../board/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" role="group" aria-label="Theme" />,
}));

// Default: demo mode OFF
vi.mock('../../demo/is-demo-mode', () => ({
  isDemoMode: () => false,
}));

const mockUser = { name: 'Luke', email: 'luke@example.com', picture: 'https://example.com/pic.jpg' };
const mockSignOut = vi.fn();
const mockOpenProfile = vi.fn();

afterEach(() => {
  cleanup();
  mockSignOut.mockClear();
  mockOpenProfile.mockClear();
});

function renderDropdown(props = {}) {
  return render(
    <UserDropdown
      user={mockUser}
      displayName="Luke"
      onSignOut={mockSignOut}
      onOpenProfile={mockOpenProfile}
      {...props}
    />
  );
}

describe('UserDropdown (Issue #132 AC1)', () => {
  describe('Trigger button', () => {
    it('renders trigger with aria-haspopup="menu"', () => {
      const { container } = renderDropdown();
      const trigger = container.querySelector('[data-testid="user-dropdown-trigger"]');
      expect(trigger).not.toBeNull();
      expect(trigger!.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('renders avatar image when user has picture', () => {
      const { container } = renderDropdown();
      const avatar = container.querySelector('.user-avatar');
      expect(avatar).not.toBeNull();
      expect((avatar as HTMLImageElement).src).toContain('pic.jpg');
    });

    it('renders placeholder when user has no picture', () => {
      const { container } = renderDropdown({
        user: { ...mockUser, picture: '' },
      });
      const placeholder = container.querySelector('.user-avatar-placeholder');
      expect(placeholder).not.toBeNull();
      expect(placeholder!.textContent).toBe('L');
    });

    it('shows display name and caret', () => {
      const { container } = renderDropdown();
      const name = container.querySelector('.user-dropdown-name');
      expect(name!.textContent).toBe('Luke');
      const caret = container.querySelector('.user-dropdown-caret');
      expect(caret).not.toBeNull();
    });

    it('has aria-expanded="false" when closed', () => {
      const { container } = renderDropdown();
      const trigger = container.querySelector('[data-testid="user-dropdown-trigger"]');
      expect(trigger!.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('Opening and closing', () => {
    it('opens panel on click', () => {
      const { container } = renderDropdown();
      const trigger = container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement;
      fireEvent.click(trigger);
      const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
      expect(panel).not.toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('closes on second click', () => {
      const { container } = renderDropdown();
      const trigger = container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement;
      fireEvent.click(trigger);
      fireEvent.click(trigger);
      const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
      expect(panel).toBeNull();
    });

    it('closes on Escape key', () => {
      const { container } = renderDropdown();
      const trigger = container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement;
      fireEvent.click(trigger);
      fireEvent.keyDown(document, { key: 'Escape' });
      const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
      expect(panel).toBeNull();
    });

    it('closes on click outside', () => {
      const { container } = renderDropdown();
      const trigger = container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement;
      fireEvent.click(trigger);
      fireEvent.mouseDown(document.body);
      const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
      expect(panel).toBeNull();
    });
  });

  describe('Panel contents', () => {
    it('shows user email', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const email = container.querySelector('.user-dropdown-email');
      expect(email!.textContent).toBe('luke@example.com');
    });

    it('includes theme toggle', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const themeToggle = container.querySelector('[data-testid="theme-toggle"]');
      expect(themeToggle).not.toBeNull();
    });

    it('has dividers separating sections (3 with Edit profile)', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const dividers = container.querySelectorAll('.user-dropdown-divider');
      expect(dividers.length).toBe(3);
    });

    it('has sign out button', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const signout = container.querySelector('[data-testid="user-dropdown-signout"]');
      expect(signout).not.toBeNull();
      expect(signout!.textContent).toBe('Sign out');
    });

    it('sign out calls onSignOut and closes panel', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-signout"]') as HTMLElement);
      expect(mockSignOut).toHaveBeenCalledOnce();
      const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
      expect(panel).toBeNull();
    });
  });

  describe('Keyboard navigation', () => {
    it('Tab on last item closes dropdown', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const signout = container.querySelector('[data-testid="user-dropdown-signout"]') as HTMLElement;
      signout.focus();
      fireEvent.keyDown(container.querySelector('[data-testid="user-dropdown-panel"]') as HTMLElement, {
        key: 'Tab',
      });
      const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
      expect(panel).toBeNull();
    });
  });
});

describe('UserDropdown — Edit profile (Issue #136)', () => {
  // AC1: "Edit profile" entry visible in user dropdown
  it('renders "Edit profile" button above a divider before Sign out', () => {
    const { container } = renderDropdown();
    fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
    const editProfile = container.querySelector('[data-testid="user-dropdown-edit-profile"]');
    expect(editProfile).not.toBeNull();
    expect(editProfile!.textContent).toBe('Edit profile');
    // Verify it comes before Sign out in DOM order
    const panel = container.querySelector('[data-testid="user-dropdown-panel"]')!;
    const buttons = Array.from(panel.querySelectorAll('button'));
    const editIdx = buttons.findIndex(b => b.dataset.testid === 'user-dropdown-edit-profile');
    const signoutIdx = buttons.findIndex(b => b.dataset.testid === 'user-dropdown-signout');
    expect(editIdx).toBeLessThan(signoutIdx);
  });

  // AC2: Profile dialog opens from dropdown — clicking calls onOpenProfile and closes panel
  it('calls onOpenProfile and closes dropdown on click', () => {
    const { container } = renderDropdown();
    fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-testid="user-dropdown-edit-profile"]') as HTMLElement);
    expect(mockOpenProfile).toHaveBeenCalledOnce();
    const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
    expect(panel).toBeNull();
  });

  // AC5: Profile entry not shown in demo mode
  it('hides "Edit profile" when onOpenProfile is not provided', () => {
    const { container } = render(
      <UserDropdown user={mockUser} displayName="Luke" onSignOut={mockSignOut} />
    );
    fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
    const editProfile = container.querySelector('[data-testid="user-dropdown-edit-profile"]');
    expect(editProfile).toBeNull();
    // Only 2 dividers when no profile button
    const dividers = container.querySelectorAll('.user-dropdown-divider');
    expect(dividers.length).toBe(2);
  });

  // AC8: ARIA menu semantics on the panel
  describe('ARIA menu semantics (AC8)', () => {
    it('panel has role="menu"', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const panel = container.querySelector('[data-testid="user-dropdown-panel"]');
      expect(panel!.getAttribute('role')).toBe('menu');
    });

    it('Edit profile button has role="menuitem"', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const editProfile = container.querySelector('[data-testid="user-dropdown-edit-profile"]');
      expect(editProfile!.getAttribute('role')).toBe('menuitem');
    });

    it('Sign out button has role="menuitem"', () => {
      const { container } = renderDropdown();
      fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
      const signout = container.querySelector('[data-testid="user-dropdown-signout"]');
      expect(signout!.getAttribute('role')).toBe('menuitem');
    });

    it('trigger has aria-haspopup="menu"', () => {
      const { container } = renderDropdown();
      const trigger = container.querySelector('[data-testid="user-dropdown-trigger"]');
      expect(trigger!.getAttribute('aria-haspopup')).toBe('menu');
    });
  });
});

describe('UserDropdown — demo mode hides Edit profile (Issue #136 AC5)', () => {
  it('hides Edit profile in demo mode', async () => {
    // Override isDemoMode to return true for this test
    const demoModule = await import('../../demo/is-demo-mode');
    const spy = vi.spyOn(demoModule, 'isDemoMode').mockReturnValue(true);

    const { container } = renderDropdown();
    fireEvent.click(container.querySelector('[data-testid="user-dropdown-trigger"]') as HTMLElement);
    const editProfile = container.querySelector('[data-testid="user-dropdown-edit-profile"]');
    expect(editProfile).toBeNull();
    // Only 2 dividers in demo mode
    const dividers = container.querySelectorAll('.user-dropdown-divider');
    expect(dividers.length).toBe(2);

    spy.mockRestore();
  });
});
