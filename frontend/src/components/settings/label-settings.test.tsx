import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/preact';
import { labels, items, loading } from '../../state/board-store';
import { LabelSettings } from './label-settings';
import type { Label, ItemWithRow } from '../../api/types';

// Mock the actions module
vi.mock('../../state/actions', () => ({
  createLabel: vi.fn().mockResolvedValue(undefined),
  updateLabel: vi.fn().mockResolvedValue(undefined),
  deleteLabel: vi.fn().mockResolvedValue(undefined),
}));

import { createLabel, updateLabel, deleteLabel } from '../../state/actions';

const MOCK_LABELS: Label[] = [
  { label: 'Errands', color: '#42a5f5' },
  { label: 'Home', color: '#66bb6a' },
  { label: 'School', color: '#ffa726' },
];

function makeItem(overrides: Partial<ItemWithRow> = {}): ItemWithRow {
  return {
    id: 'item-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    labels: '',
    parent_id: '',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    completed_at: '',
    sort_order: 1,
    created_by: 'test@test.com',
    board_id: 'board-1',
    sheetRow: 2,
    ...overrides,
  };
}

describe('LabelSettings', () => {
  beforeEach(() => {
    labels.value = [...MOCK_LABELS];
    items.value = [
      makeItem({ id: 'i1', labels: 'Errands' }),
      makeItem({ id: 'i2', labels: 'Errands, Home' }),
      makeItem({ id: 'i3', labels: 'School' }),
    ];
    loading.value = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // --- AC2: View labels with usage counts ---

  it('renders all labels in a table', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    const table = container.querySelector('[data-testid="label-settings-table"]');
    expect(table).toBeTruthy();
    const rows = table!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('shows label name with color swatch', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    const swatches = container.querySelectorAll('.label-settings-swatch');
    expect(swatches.length).toBe(3);
    // First swatch should have the color of Errands
    expect((swatches[0] as HTMLElement).style.backgroundColor).toBeTruthy();
  });

  it('shows usage count for each label', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    const counts = container.querySelectorAll('.label-settings-count');
    // Errands: 2 items, Home: 1 item, School: 1 item
    expect(counts[0].textContent).toBe('2');
    expect(counts[1].textContent).toBe('1');
    expect(counts[2].textContent).toBe('1');
  });

  it('shows spinner when loading', () => {
    loading.value = true;
    const { container } = render(<LabelSettings token="test-token" />);
    expect(container.querySelector('[data-testid="label-settings-loading"]')).toBeTruthy();
    expect(container.querySelector('.spinner')).toBeTruthy();
  });

  it('shows empty state with create button when no labels', () => {
    labels.value = [];
    const { container } = render(<LabelSettings token="test-token" />);
    expect(container.querySelector('[data-testid="label-settings-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="label-settings-create-first"]')).toBeTruthy();
  });

  // --- AC3: Create label ---

  it('shows create form when "New Label" is clicked', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    const newBtn = container.querySelector('[data-testid="label-settings-new-btn"]');
    expect(newBtn).toBeTruthy();
    fireEvent.click(newBtn!);
    expect(container.querySelector('[data-testid="label-settings-create-form"]')).toBeTruthy();
  });

  it('create form has proper label element and aria-describedby', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);
    const label = container.querySelector('label[for="label-create-name"]');
    expect(label).toBeTruthy();
    expect(label!.textContent).toBe('Label name');
    const input = container.querySelector('#label-create-name');
    expect(input).toBeTruthy();
  });

  it('calls createLabel on save', async () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);

    const input = container.querySelector('[data-testid="label-create-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'New Label' } });

    const saveBtn = container.querySelector('[data-testid="label-create-save-btn"]');
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(createLabel).toHaveBeenCalledWith('New Label', expect.any(String), 'test-token');
    });
  });

  it('shows validation error for duplicate name', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);

    const input = container.querySelector('[data-testid="label-create-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Errands' } });

    const error = container.querySelector('[data-testid="label-create-error"]');
    expect(error).toBeTruthy();
    expect(error!.textContent).toBe('A label with this name already exists');
  });

  it('shows validation error for duplicate name (case-insensitive)', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);

    const input = container.querySelector('[data-testid="label-create-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'errands' } });

    expect(container.querySelector('[data-testid="label-create-error"]')).toBeTruthy();
  });

  it('disables save button when name is empty', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);

    const saveBtn = container.querySelector('[data-testid="label-create-save-btn"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('cancels create form on Cancel click', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);
    expect(container.querySelector('[data-testid="label-settings-create-form"]')).toBeTruthy();

    const cancelBtn = container.querySelector('.label-settings-create-form .btn-ghost');
    fireEvent.click(cancelBtn!);
    expect(container.querySelector('[data-testid="label-settings-create-form"]')).toBeFalsy();
  });

  it('cancels create form on Escape', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);

    const input = container.querySelector('[data-testid="label-create-name-input"]')!;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('[data-testid="label-settings-create-form"]')).toBeFalsy();
  });

  it('submits create form on Enter when valid', async () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-new-btn"]')!);

    const input = container.querySelector('[data-testid="label-create-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Fresh' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(createLabel).toHaveBeenCalledWith('Fresh', expect.any(String), 'test-token');
    });
  });

  it('create form from empty state works', async () => {
    labels.value = [];
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-settings-create-first"]')!);
    expect(container.querySelector('[data-testid="label-settings-create-form"]')).toBeTruthy();
  });

  // --- AC4: Inline edit ---

  it('shows edit form when Edit button is clicked', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    const editBtn = container.querySelector('[data-testid="label-edit-btn-Errands"]');
    expect(editBtn).toBeTruthy();
    fireEvent.click(editBtn!);
    expect(container.querySelector('[data-testid="label-edit-form"]')).toBeTruthy();
  });

  it('edit form has proper label element', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-edit-btn-Errands"]')!);
    const label = container.querySelector('label[for="label-edit-name"]');
    expect(label).toBeTruthy();
    expect(label!.textContent).toBe('Label name');
  });

  it('edit form pre-fills name and shows color grid', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-edit-btn-Errands"]')!);

    const input = container.querySelector('[data-testid="label-edit-name-input"]') as HTMLInputElement;
    expect(input.value).toBe('Errands');
    expect(container.querySelector('.color-swatch-grid')).toBeTruthy();
  });

  it('calls updateLabel on edit save', async () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-edit-btn-Errands"]')!);

    const input = container.querySelector('[data-testid="label-edit-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Tasks' } });

    fireEvent.click(container.querySelector('[data-testid="label-edit-save-btn"]')!);

    await waitFor(() => {
      expect(updateLabel).toHaveBeenCalledWith('Errands', 'Tasks', expect.any(String), 'test-token');
    });
  });

  it('cancels edit on Escape', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-edit-btn-Errands"]')!);

    const input = container.querySelector('[data-testid="label-edit-name-input"]')!;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('[data-testid="label-edit-form"]')).toBeFalsy();
  });

  it('edit/delete action buttons have min 44x44 touch target', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    const editBtn = container.querySelector('[data-testid="label-edit-btn-Errands"]');
    expect(editBtn!.classList.contains('label-settings-action-btn')).toBe(true);
  });

  // --- AC5: Delete with confirmation ---

  it('shows delete confirmation when Delete is clicked', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    const deleteBtn = container.querySelector('[data-testid="label-delete-btn-Errands"]');
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);
    expect(container.querySelector('[data-testid="label-delete-confirm"]')).toBeTruthy();
  });

  it('shows usage count in delete confirmation message', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-delete-btn-Errands"]')!);
    const message = container.querySelector('[data-testid="label-delete-message"]');
    // Errands is used by 2 items
    expect(message!.textContent).toBe('This label is used by 2 items. Remove it from all items and delete?');
  });

  it('shows singular message when used by 1 item', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-delete-btn-Home"]')!);
    const message = container.querySelector('[data-testid="label-delete-message"]');
    expect(message!.textContent).toBe('This label is used by 1 item. Remove it from all items and delete?');
  });

  it('shows simple message when label is unused', () => {
    items.value = []; // No items use any label
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-delete-btn-Errands"]')!);
    const message = container.querySelector('[data-testid="label-delete-message"]');
    expect(message!.textContent).toBe('Delete this label?');
  });

  it('calls deleteLabel on confirm', async () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-delete-btn-Errands"]')!);
    fireEvent.click(container.querySelector('[data-testid="label-delete-confirm-btn"]')!);

    await waitFor(() => {
      expect(deleteLabel).toHaveBeenCalledWith('Errands', 'test-token');
    });
  });

  it('cancels delete on Cancel click', () => {
    const { container } = render(<LabelSettings token="test-token" />);
    fireEvent.click(container.querySelector('[data-testid="label-delete-btn-Errands"]')!);
    expect(container.querySelector('[data-testid="label-delete-confirm"]')).toBeTruthy();

    const cancelBtn = container.querySelector('.label-settings-delete-confirm .btn-ghost');
    fireEvent.click(cancelBtn!);
    expect(container.querySelector('[data-testid="label-delete-confirm"]')).toBeFalsy();
  });
});
