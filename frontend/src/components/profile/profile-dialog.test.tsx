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
      expect(nameInput.getAttribute('aria-describedby')).toBe('profile-name-error');
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
