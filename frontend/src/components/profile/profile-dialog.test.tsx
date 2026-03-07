import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { ProfileDialog } from './profile-dialog';
import type { UserInfo } from '../../api/types';

afterEach(() => {
  cleanup();
});

const mockUpdateDisplayName = vi.fn();
vi.mock('../../state/actions', () => ({
  updateDisplayName: (...args: unknown[]) => mockUpdateDisplayName(...args),
}));

vi.mock('../../hooks/use-focus-trap', () => ({
  useFocusTrap: (onEscape?: () => void) => {
    // Store for test access but return a simple ref
    (globalThis as any).__lastOnEscape = onEscape;
    return { current: null };
  },
}));

const mockUser: UserInfo = {
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/pic.jpg',
};

const defaultProps = {
  user: mockUser,
  currentName: 'Test User',
  token: 'mock-token',
  onClose: vi.fn(),
};

beforeEach(() => {
  mockUpdateDisplayName.mockReset();
  defaultProps.onClose = vi.fn();
});

describe('ProfileDialog (Issue #40)', () => {
  // AC2: Open profile dialog
  describe('AC2: Dialog structure and ARIA', () => {
    it('renders with role="dialog" and aria-modal="true"', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.getAttribute('aria-modal')).toBe('true');
      expect(dialog!.getAttribute('aria-label')).toBe('User Profile');
    });

    it('shows user avatar (decorative, alt="")', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const img = container.querySelector('.profile-avatar') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.alt).toBe('');
      expect(img.src).toBe('https://example.com/pic.jpg');
    });

    it('shows email as read-only with label', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const emailInput = container.querySelector('#profile-email') as HTMLInputElement;
      expect(emailInput).not.toBeNull();
      expect(emailInput.readOnly).toBe(true);
      expect(emailInput.value).toBe('test@example.com');

      const label = container.querySelector('label[for="profile-email"]');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe('Email');
    });

    it('shows editable display name pre-filled with current name', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      expect(nameInput).not.toBeNull();
      expect(nameInput.value).toBe('Test User');

      const label = container.querySelector('label[for="profile-name"]');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe('Display Name');
    });
  });

  // AC3: Save display name
  describe('AC3: Save display name', () => {
    it('calls updateDisplayName with cleaned name on save', async () => {
      mockUpdateDisplayName.mockResolvedValue(true);
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: 'New Name' } });
      fireEvent.submit(form);

      // Wait for async
      await vi.waitFor(() => {
        expect(mockUpdateDisplayName).toHaveBeenCalledWith(
          'New Name', 'test@example.com', 'Test User', 'mock-token'
        );
      });
    });

    it('closes dialog on successful save', async () => {
      mockUpdateDisplayName.mockResolvedValue(true);
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.submit(form);

      await vi.waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('shows loading state on save button while saving', async () => {
      let resolvePromise: (v: boolean) => void;
      mockUpdateDisplayName.mockImplementation(() => new Promise(r => { resolvePromise = r; }));
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const form = container.querySelector('form') as HTMLFormElement;
      const saveBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

      fireEvent.submit(form);

      // After submit, button should be disabled and show "Saving…"
      await vi.waitFor(() => {
        expect(saveBtn.disabled).toBe(true);
        expect(saveBtn.textContent).toBe('Saving…');
      });

      // Resolve the save
      resolvePromise!(true);
    });

    it('shows inline error and re-enables Save on failure', async () => {
      mockUpdateDisplayName.mockRejectedValue(new Error('Network error'));
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.submit(form);

      await vi.waitFor(() => {
        const errorEl = container.querySelector('#profile-name-error');
        expect(errorEl).not.toBeNull();
        expect(errorEl!.textContent).toBe('Network error');
      });

      // Save button should be re-enabled
      const saveBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);

      // Dialog should NOT be closed
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  // AC4: Display name validation
  describe('AC4: Display name validation', () => {
    it('shows error for empty name', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: '' } });
      fireEvent.submit(form);

      const errorEl = container.querySelector('#profile-name-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl!.textContent).toBe('Display name cannot be empty');
      expect(mockUpdateDisplayName).not.toHaveBeenCalled();
    });

    it('shows error for whitespace-only name', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: '   ' } });
      fireEvent.submit(form);

      const errorEl = container.querySelector('#profile-name-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl!.textContent).toBe('Display name cannot be empty');
    });

    it('shows error for name exceeding 50 characters', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: 'A'.repeat(51) } });
      fireEvent.submit(form);

      const errorEl = container.querySelector('#profile-name-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl!.textContent).toBe('Display name must be 50 characters or fewer');
    });

    it('sets aria-invalid and aria-describedby on validation error', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: '' } });
      fireEvent.submit(form);

      expect(nameInput.getAttribute('aria-invalid')).toBe('true');
      // aria-describedby includes both counter and error
      expect(nameInput.getAttribute('aria-describedby')).toBe('profile-name-counter profile-name-error');
    });
  });

  // AC5: Cancel / dismiss
  describe('AC5: Cancel / dismiss without saving', () => {
    it('calls onClose when Cancel is clicked', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const cancelBtn = Array.from(container.querySelectorAll('button')).find(
        b => b.textContent === 'Cancel'
      );
      fireEvent.click(cancelBtn!);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const closeBtn = container.querySelector('button[aria-label="Close"]');
      fireEvent.click(closeBtn!);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when overlay backdrop is clicked', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const overlay = container.querySelector('.modal-overlay');
      fireEvent.click(overlay!);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  // AC6: Accessibility
  describe('AC6: Keyboard and screen reader accessibility', () => {
    it('close button has aria-label="Close"', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const closeBtn = container.querySelector('button[aria-label="Close"]');
      expect(closeBtn).not.toBeNull();
    });

    it('validation errors have role="alert" for screen reader announcement', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: '' } });
      fireEvent.submit(form);

      const errorEl = container.querySelector('#profile-name-error');
      expect(errorEl!.getAttribute('role')).toBe('alert');
    });
  });
});

describe('ProfileDialog — Display name persistence (Issue #61)', () => {
  // AC1: Display name persists across dialog open/close
  describe('AC1: Dialog uses currentName prop (not user.name)', () => {
    it('pre-fills with currentName even when it differs from user.name', () => {
      // Simulate: user.name is Google OAuth name, currentName is Owners-sheet name
      const props = {
        ...defaultProps,
        user: { ...mockUser, name: 'Google Name' },
        currentName: 'Owners Sheet Name',
      };
      const { container } = render(<ProfileDialog {...props} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      expect(nameInput.value).toBe('Owners Sheet Name');
    });
  });

  // AC2 + AC5: onNameUpdated callback is called on successful save
  describe('AC2/AC5: onNameUpdated callback updates AuthContext', () => {
    it('calls onNameUpdated with new name on successful save', async () => {
      mockUpdateDisplayName.mockResolvedValue(true);
      const onNameUpdated = vi.fn();
      const { container } = render(
        <ProfileDialog {...defaultProps} onNameUpdated={onNameUpdated} />
      );
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: 'Alice' } });
      fireEvent.submit(form);

      await vi.waitFor(() => {
        expect(onNameUpdated).toHaveBeenCalledWith('Alice');
      });
    });

    it('does not call onNameUpdated on save failure', async () => {
      mockUpdateDisplayName.mockRejectedValue(new Error('fail'));
      const onNameUpdated = vi.fn();
      const { container } = render(
        <ProfileDialog {...defaultProps} onNameUpdated={onNameUpdated} />
      );
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.submit(form);

      await vi.waitFor(() => {
        const errorEl = container.querySelector('#profile-name-error');
        expect(errorEl).not.toBeNull();
      });
      expect(onNameUpdated).not.toHaveBeenCalled();
    });

    it('passes currentName as oldName to updateDisplayName', async () => {
      mockUpdateDisplayName.mockResolvedValue(true);
      const props = {
        ...defaultProps,
        currentName: 'Alice',
      };
      const { container } = render(<ProfileDialog {...props} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: 'A' } });
      fireEvent.submit(form);

      await vi.waitFor(() => {
        expect(mockUpdateDisplayName).toHaveBeenCalledWith(
          'A', 'test@example.com', 'Alice', 'mock-token'
        );
      });
    });
  });
});

describe('ProfileDialog — Mobile compacting (Issue #64)', () => {
  describe('AC1: Avatar conditional rendering', () => {
    it('renders avatar section when user has a picture', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const avatarSection = container.querySelector('.profile-avatar-section');
      expect(avatarSection).not.toBeNull();
      const img = container.querySelector('.profile-avatar') as HTMLImageElement;
      expect(img).not.toBeNull();
      expect(img.src).toBe('https://example.com/pic.jpg');
    });

    it('does not render avatar section when user has no picture', () => {
      const props = {
        ...defaultProps,
        user: { ...mockUser, picture: '' },
      };
      const { container } = render(<ProfileDialog {...props} />);
      const avatarSection = container.querySelector('.profile-avatar-section');
      expect(avatarSection).toBeNull();
    });

    it('does not render avatar section when picture is undefined', () => {
      const props = {
        ...defaultProps,
        user: { email: 'test@example.com', name: 'Test User' } as UserInfo,
      };
      const { container } = render(<ProfileDialog {...props} />);
      const avatarSection = container.querySelector('.profile-avatar-section');
      expect(avatarSection).toBeNull();
    });
  });

  describe('AC2: Dialog has profile-dialog class for CSS targeting', () => {
    it('dialog element has profile-dialog class', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog!.classList.contains('profile-dialog')).toBe(true);
    });
  });
});

describe('ProfileDialog — Character counter (Issue #65)', () => {
  describe('AC1: Counter is always visible', () => {
    it('displays character counter with current count and limit', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const counter = container.querySelector('#profile-name-counter');
      expect(counter).not.toBeNull();
      // "Test User" = 9 chars
      expect(counter!.textContent).toBe('9/50');
    });

    it('counter is inside profile-name-status container', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const status = container.querySelector('.profile-name-status');
      expect(status).not.toBeNull();
      const counter = status!.querySelector('#profile-name-counter');
      expect(counter).not.toBeNull();
    });
  });

  describe('AC2: Counter updates on input (uses cleaned length)', () => {
    it('updates count when user types', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const counter = container.querySelector('#profile-name-counter');

      fireEvent.input(nameInput, { target: { value: 'Hello World' } });
      expect(counter!.textContent).toBe('11/50');
    });

    it('strips control characters and trims for count', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const counter = container.querySelector('#profile-name-counter');

      // "  Alice  " has leading/trailing spaces — cleaned length is 5
      fireEvent.input(nameInput, { target: { value: '  Alice  ' } });
      expect(counter!.textContent).toBe('5/50');
    });
  });

  describe('AC3: Warning state at >40 characters', () => {
    it('adds char-counter-warning class when cleaned length exceeds 40', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const counter = container.querySelector('#profile-name-counter');

      fireEvent.input(nameInput, { target: { value: 'A'.repeat(41) } });
      expect(counter!.classList.contains('char-counter-warning')).toBe(true);
      expect(counter!.classList.contains('char-counter-danger')).toBe(false);
    });

    it('does not add warning class at exactly 40 characters', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const counter = container.querySelector('#profile-name-counter');

      fireEvent.input(nameInput, { target: { value: 'A'.repeat(40) } });
      expect(counter!.classList.contains('char-counter-warning')).toBe(false);
    });
  });

  describe('AC4: Danger state at >50 characters', () => {
    it('adds char-counter-danger class when cleaned length exceeds 50', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const counter = container.querySelector('#profile-name-counter');

      fireEvent.input(nameInput, { target: { value: 'A'.repeat(51) } });
      expect(counter!.classList.contains('char-counter-danger')).toBe(true);
      expect(counter!.classList.contains('char-counter-warning')).toBe(false);
    });
  });

  describe('AC5: Accessibility — aria-describedby and aria-live', () => {
    it('input aria-describedby includes counter id', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const describedBy = nameInput.getAttribute('aria-describedby') || '';
      expect(describedBy).toContain('profile-name-counter');
    });

    it('counter has aria-live="off" when under 41 characters', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const counter = container.querySelector('#profile-name-counter');
      expect(counter!.getAttribute('aria-live')).toBe('off');
    });

    it('counter has aria-live="polite" when over 40 characters', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const counter = container.querySelector('#profile-name-counter');

      fireEvent.input(nameInput, { target: { value: 'A'.repeat(41) } });
      expect(counter!.getAttribute('aria-live')).toBe('polite');
    });

    it('aria-describedby includes both counter and error when validation fails', () => {
      const { container } = render(<ProfileDialog {...defaultProps} />);
      const nameInput = container.querySelector('#profile-name') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(nameInput, { target: { value: '' } });
      fireEvent.submit(form);

      const describedBy = nameInput.getAttribute('aria-describedby') || '';
      expect(describedBy).toContain('profile-name-counter');
      expect(describedBy).toContain('profile-name-error');
    });
  });
});
