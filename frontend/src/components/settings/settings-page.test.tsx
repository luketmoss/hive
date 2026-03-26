import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { showSettings } from '../../state/board-store';
import { SettingsPage } from './settings-page';

// Mock useFocusTrap to avoid side effects in tests
vi.mock('../../hooks/use-focus-trap', () => ({
  useFocusTrap: (onEscape?: () => void) => {
    const ref = { current: null };
    // Store onEscape for Escape key simulation
    (globalThis as any).__mockOnEscape = onEscape;
    return ref;
  },
}));

// Mock LabelSettings
vi.mock('./label-settings', () => ({
  LabelSettings: ({ token }: { token: string }) => (
    <div data-testid="label-settings-mock">token={token}</div>
  ),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    showSettings.value = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    showSettings.value = false;
  });

  // AC1: Settings modal renders with heading
  it('renders a dialog with Settings heading', () => {
    const { container } = render(<SettingsPage token="test-token" />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-labelledby')).toBe('settings-heading');

    const heading = container.querySelector('#settings-heading');
    expect(heading).toBeTruthy();
    expect(heading!.textContent).toBe('Settings');
  });

  // AC1: Settings modal has close button
  it('closes on close button click', () => {
    const { container } = render(<SettingsPage token="test-token" />);
    const closeBtn = container.querySelector('[data-testid="settings-close-btn"]');
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn!);
    expect(showSettings.value).toBe(false);
  });

  // AC1: Overlay click closes
  it('closes on overlay click', () => {
    const { container } = render(<SettingsPage token="test-token" />);
    const overlay = container.querySelector('.modal-overlay');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);
    expect(showSettings.value).toBe(false);
  });

  // AC1: Does not close when clicking inside modal
  it('does not close when clicking inside modal body', () => {
    const { container } = render(<SettingsPage token="test-token" />);
    const modal = container.querySelector('.settings-page');
    fireEvent.click(modal!);
    expect(showSettings.value).toBe(true);
  });

  // AC1: Renders LabelSettings with token
  it('renders LabelSettings component', () => {
    const { container } = render(<SettingsPage token="my-token" />);
    const labelSettings = container.querySelector('[data-testid="label-settings-mock"]');
    expect(labelSettings).toBeTruthy();
    expect(labelSettings!.textContent).toContain('token=my-token');
  });

  // AC1: Focus heading has tabIndex for focus management
  it('heading has tabIndex=-1 and data-autofocus for focus trap', () => {
    const { container } = render(<SettingsPage token="test-token" />);
    const heading = container.querySelector('#settings-heading');
    expect(heading!.getAttribute('tabindex')).toBe('-1');
    expect(heading!.hasAttribute('data-autofocus')).toBe(true);
  });
});
