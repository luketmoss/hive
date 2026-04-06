import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor, act } from '@testing-library/preact';
import type { BoardStatus, ItemWithRow } from '../../api/types';

vi.mock('../../state/board-store', async () => {
  const { signal } = await import('@preact/signals');
  return {
    boardStatuses: signal([]),
    boardItems: signal([]),
  };
});

const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);

vi.mock('../../state/actions', () => ({
  createStatus: vi.fn().mockResolvedValue(undefined),
  updateStatus: (...args: any[]) => mockUpdateStatus(...args),
  reorderStatuses: vi.fn().mockResolvedValue(undefined),
  deleteStatusWithMigration: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks are set up
import { boardStatuses, boardItems } from '../../state/board-store';
import { ColumnSettings } from './column-settings';

function makeStatus(overrides: Partial<BoardStatus> = {}): BoardStatus {
  return {
    id: 's1',
    board_id: 'board-1',
    name: 'To Do',
    sort_order: 1,
    color: '#e3f2fd',
    is_terminal: false,
    created_at: '2026-01-01',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe('ColumnSettings terminal toggle (Issue #234)', () => {
  beforeEach(() => {
    mockUpdateStatus.mockReset().mockResolvedValue(undefined);
    (boardItems as any).value = [];
  });

  it('AC1: toggling a non-terminal column swaps it with the current terminal', async () => {
    (boardStatuses as any).value = [
      makeStatus({ id: 's1', name: 'To Do', is_terminal: false }),
      makeStatus({ id: 's2', name: 'In Progress', is_terminal: false }),
      makeStatus({ id: 's3', name: 'Done', is_terminal: true }),
    ];

    const { container } = render(<ColumnSettings token="test-token" />);

    const toggles = container.querySelectorAll('.column-settings-terminal-toggle input[type="checkbox"]');
    expect(toggles.length).toBe(3);

    // Toggle "To Do" (index 0) which is non-terminal
    await act(async () => {
      fireEvent.change(toggles[0]);
    });

    // Should first turn off "Done" (s3), then turn on "To Do" (s1)
    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith('s3', { is_terminal: false }, 'test-token');
      expect(mockUpdateStatus).toHaveBeenCalledWith('s1', { is_terminal: true }, 'test-token');
    });
  });

  it('AC2: clicking the current terminal column does nothing', () => {
    (boardStatuses as any).value = [
      makeStatus({ id: 's1', name: 'To Do', is_terminal: false }),
      makeStatus({ id: 's3', name: 'Done', is_terminal: true }),
    ];

    const { container } = render(<ColumnSettings token="test-token" />);

    const toggles = container.querySelectorAll('.column-settings-terminal-toggle input[type="checkbox"]');
    expect((toggles[1] as HTMLInputElement).disabled).toBe(true);

    fireEvent.change(toggles[1]);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('AC2: terminal toggle checkbox is disabled for the current completion column', () => {
    (boardStatuses as any).value = [
      makeStatus({ id: 's1', name: 'To Do', is_terminal: false }),
      makeStatus({ id: 's2', name: 'Done', is_terminal: true }),
    ];

    const { container } = render(<ColumnSettings token="test-token" />);

    const toggles = container.querySelectorAll('.column-settings-terminal-toggle input[type="checkbox"]');
    expect((toggles[0] as HTMLInputElement).disabled).toBe(false);
    expect((toggles[1] as HTMLInputElement).disabled).toBe(true);
  });

  it('shows descriptive tooltip on terminal column', () => {
    (boardStatuses as any).value = [
      makeStatus({ id: 's1', name: 'To Do', is_terminal: false }),
      makeStatus({ id: 's2', name: 'Done', is_terminal: true }),
    ];

    const { container } = render(<ColumnSettings token="test-token" />);

    const labels = container.querySelectorAll('.column-settings-terminal-toggle');
    expect((labels[1] as HTMLElement).title).toContain('click another column to change');
    expect((labels[0] as HTMLElement).title).toContain('Set as completion column');
  });
});
