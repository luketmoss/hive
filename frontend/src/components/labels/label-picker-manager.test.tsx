import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/preact';
import { labels } from '../../state/board-store';
import { LabelPickerManager } from './label-picker-manager';
import type { Label } from '../../api/types';

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

describe('LabelPickerManager', () => {
  beforeEach(() => {
    labels.value = [...MOCK_LABELS];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Scenario 8: aria-pressed on label toggles in normal mode
  it('renders label toggles with aria-pressed in normal mode', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels="Errands, Home"
        onToggle={() => {}}
        token="test-token"
      />
    );
    const toggles = container.querySelectorAll('.label-toggle');
    expect(toggles.length).toBe(3);

    // Errands is active
    const errands = Array.from(toggles).find(t => t.textContent === 'Errands')!;
    expect(errands.getAttribute('aria-pressed')).toBe('true');

    // School is not active
    const school = Array.from(toggles).find(t => t.textContent === 'School')!;
    expect(school.getAttribute('aria-pressed')).toBe('false');
  });

  // Scenario 1: Clicking label toggle in normal mode calls onToggle
  it('calls onToggle when a label is clicked in normal mode', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={onToggle}
        token="test-token"
      />
    );
    const toggles = container.querySelectorAll('.label-toggle');
    (toggles[0] as HTMLElement).click();
    expect(onToggle).toHaveBeenCalledWith('Errands');
  });

  // Scenario 1: "+ New label" button is visible in normal mode
  it('shows "+ New label" button in normal mode', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    const btn = container.querySelector('[data-testid="new-label-btn"]');
    expect(btn).toBeTruthy();
  });

  // Scenario 1: Clicking "+ New label" shows the inline create form
  it('shows inline create form when "+ New label" is clicked', async () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    expect(container.querySelector('[data-testid="label-form"]')).toBeFalsy();
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    expect(container.querySelector('[data-testid="label-form"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="label-name-input"]')).toBeTruthy();
  });

  // Scenario 1: Create form has name input, color swatches, Save/Cancel
  it('create form has name input, color swatch grid, and Save/Cancel buttons', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    const form = container.querySelector('[data-testid="label-form"]')!;
    expect(form.querySelector('.label-form-input')).toBeTruthy();
    expect(form.querySelector('.color-swatch-grid')).toBeTruthy();
    expect(container.querySelector('[data-testid="label-save-btn"]')).toBeTruthy();
    expect(form.querySelector('.btn-ghost')).toBeTruthy(); // Cancel
  });

  // Scenario 5: Save button disabled when name is empty
  it('Save button is disabled when name is empty', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    const saveBtn = container.querySelector('[data-testid="label-save-btn"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  // Scenario 5: Duplicate label name shows validation error
  it('shows validation error for duplicate label name', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    const input = container.querySelector('[data-testid="label-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'errands' } }); // case-insensitive
    const error = container.querySelector('[data-testid="label-validation-error"]');
    expect(error).toBeTruthy();
    expect(error!.textContent).toContain('already exists');
  });

  // Scenario 5: Name over 30 characters shows validation error
  it('shows validation error when name exceeds 30 characters', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    const input = container.querySelector('[data-testid="label-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'A'.repeat(31) } });
    const error = container.querySelector('[data-testid="label-validation-error"]');
    expect(error).toBeTruthy();
    expect(error!.textContent).toContain('30 characters');
  });

  // Scenario 1: Valid create calls createLabel action
  it('calls createLabel action with valid name and color', async () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    const input = container.querySelector('[data-testid="label-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'New Label' } });
    const saveBtn = container.querySelector('[data-testid="label-save-btn"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(createLabel).toHaveBeenCalledWith('New Label', expect.any(String), 'test-token');
    });
  });

  // Scenario 2: "Manage labels" button toggles edit mode
  it('shows "Manage labels" button that toggles to "Done"', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    const manageBtn = container.querySelector('[data-testid="manage-labels-btn"]')!;
    expect(manageBtn.textContent).toBe('Manage labels');
    fireEvent.click(manageBtn);
    expect(manageBtn.textContent).toBe('Done');
    fireEvent.click(manageBtn);
    expect(manageBtn.textContent).toBe('Manage labels');
  });

  // Scenario 2: In edit mode, each label has edit and delete icons
  it('shows edit and delete icons for each label in edit mode', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="manage-labels-btn"]')!);
    for (const l of MOCK_LABELS) {
      expect(container.querySelector(`[data-testid="label-edit-${l.label}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-testid="label-delete-${l.label}"]`)).toBeTruthy();
    }
  });

  // Scenario 2: Label toggles are disabled in edit mode
  it('disables label toggle clicks in edit mode', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={onToggle}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="manage-labels-btn"]')!);
    const toggles = container.querySelectorAll('.label-toggle');
    (toggles[0] as HTMLElement).click();
    expect(onToggle).not.toHaveBeenCalled();
  });

  // Scenario 3: Edit icon opens edit form for a label
  it('clicking edit icon opens edit form with pre-filled name and color', async () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="manage-labels-btn"]')!);
    fireEvent.click(container.querySelector('[data-testid="label-edit-Errands"]')!);
    const input = container.querySelector('[data-testid="label-name-input"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('Errands');
  });

  // Scenario 3: Saving edit calls updateLabel action
  it('calls updateLabel when edit form is saved', async () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="manage-labels-btn"]')!);
    fireEvent.click(container.querySelector('[data-testid="label-edit-Errands"]')!);
    const input = container.querySelector('[data-testid="label-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Shopping' } });
    fireEvent.click(container.querySelector('[data-testid="label-save-btn"]')!);
    await waitFor(() => {
      expect(updateLabel).toHaveBeenCalledWith('Errands', 'Shopping', expect.any(String), 'test-token');
    });
  });

  // Scenario 4: Delete icon shows inline confirmation
  it('clicking delete icon shows inline confirmation', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="manage-labels-btn"]')!);
    fireEvent.click(container.querySelector('[data-testid="label-delete-Errands"]')!);
    const confirm = container.querySelector('[data-testid="label-delete-confirm"]');
    expect(confirm).toBeTruthy();
    expect(confirm!.textContent).toContain('Remove label from all items?');
  });

  // Scenario 4: Confirming delete calls deleteLabel action
  it('calls deleteLabel when delete is confirmed', async () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="manage-labels-btn"]')!);
    fireEvent.click(container.querySelector('[data-testid="label-delete-Errands"]')!);
    fireEvent.click(container.querySelector('[data-testid="label-delete-confirm-btn"]')!);
    await waitFor(() => {
      expect(deleteLabel).toHaveBeenCalledWith('Errands', 'test-token');
    });
  });

  // Scenario 4: Cancel delete dismisses confirmation
  it('cancelling delete dismisses confirmation', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="manage-labels-btn"]')!);
    fireEvent.click(container.querySelector('[data-testid="label-delete-Errands"]')!);
    const confirm = container.querySelector('[data-testid="label-delete-confirm"]');
    expect(confirm).toBeTruthy();
    // Click cancel
    const cancelBtn = confirm!.querySelector('.btn-ghost')!;
    fireEvent.click(cancelBtn);
    expect(container.querySelector('[data-testid="label-delete-confirm"]')).toBeFalsy();
  });

  // Scenario 7: Empty state when no labels exist
  it('shows empty state with create button when no labels exist', () => {
    labels.value = [];
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    expect(container.querySelector('.label-picker-empty')).toBeTruthy();
    expect(container.textContent).toContain('No labels yet');
    const createBtn = container.querySelector('.label-picker-empty .btn-primary');
    expect(createBtn).toBeTruthy();
    expect(createBtn!.textContent).toContain('Create label');
  });

  // Scenario 5: Valid name, no duplicate -- Save enabled
  it('enables Save when name is valid and unique', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    const input = container.querySelector('[data-testid="label-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Unique Label' } });
    const saveBtn = container.querySelector('[data-testid="label-save-btn"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  // Scenario 5: Whitespace-only name keeps Save disabled
  it('keeps Save disabled for whitespace-only name', () => {
    const { container } = render(
      <LabelPickerManager
        currentLabels=""
        onToggle={() => {}}
        token="test-token"
      />
    );
    fireEvent.click(container.querySelector('[data-testid="new-label-btn"]')!);
    const input = container.querySelector('[data-testid="label-name-input"]') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '   ' } });
    const saveBtn = container.querySelector('[data-testid="label-save-btn"]') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });
});
