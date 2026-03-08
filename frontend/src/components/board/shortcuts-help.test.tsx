import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { ShortcutsHelp } from './shortcuts-help';

vi.mock('../../hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

afterEach(cleanup);

function renderHelp(onClose = vi.fn()) {
  return { ...render(<ShortcutsHelp onClose={onClose} />), onClose };
}

describe('ShortcutsHelp (Issue #91)', () => {
  describe('AC4: Shortcut help overlay', () => {
    it('renders as a dialog with aria-label', () => {
      const { getByRole } = renderHelp();
      const dialog = getByRole('dialog');
      expect(dialog.getAttribute('aria-label')).toBe('Keyboard shortcuts');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });

    it('shows "Keyboard Shortcuts" heading', () => {
      const { getByText } = renderHelp();
      expect(getByText('Keyboard Shortcuts')).toBeTruthy();
    });

    it('groups shortcuts by Navigation and Actions categories', () => {
      const { getByText } = renderHelp();
      expect(getByText('Navigation')).toBeTruthy();
      expect(getByText('Actions')).toBeTruthy();
    });

    it('lists all expected shortcuts', () => {
      const { getByText } = renderHelp();
      // Navigation
      expect(getByText('Switch to board by position')).toBeTruthy();
      expect(getByText('Show keyboard shortcuts')).toBeTruthy();
      // Actions
      expect(getByText('Create new item')).toBeTruthy();
      expect(getByText('Open completed items archive')).toBeTruthy();
      expect(getByText('Share board (owner only)')).toBeTruthy();
    });

    it('shows shortcut key labels', () => {
      const { container } = renderHelp();
      const kbds = container.querySelectorAll('kbd.shortcut-keys');
      const keys = Array.from(kbds).map(k => k.textContent);
      expect(keys).toContain('Ctrl+1-9');
      expect(keys).toContain('?');
      expect(keys).toContain('N');
      expect(keys).toContain('A');
      expect(keys).toContain('Ctrl+Shift+S');
    });

    it('calls onClose when Done button is clicked', () => {
      const { getByText, onClose } = renderHelp();
      fireEvent.click(getByText('Done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button (✕) is clicked', () => {
      const { getByLabelText, onClose } = renderHelp();
      fireEvent.click(getByLabelText('Close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked', () => {
      const { container, onClose } = renderHelp();
      const overlay = container.querySelector('.modal-overlay');
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
