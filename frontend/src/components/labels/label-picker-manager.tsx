import { useState, useRef } from 'preact/hooks';
import { labels as labelsStore } from '../../state/board-store';
import { createLabel, updateLabel, deleteLabel } from '../../state/actions';
import { getContrastTextColor } from '../../utils/color';
import { ColorSwatchGrid } from './color-swatch-grid';
import { PRESET_COLORS } from './preset-colors';

interface Props {
  /** Currently assigned labels (comma-separated string) */
  currentLabels: string;
  /** Called when a label is toggled on/off (only in normal mode) */
  onToggle: (labelName: string) => void;
  /** Auth token for API calls */
  token: string;
}

type Mode = 'normal' | 'edit';
type FormMode = 'create' | 'edit-label';

interface FormState {
  mode: FormMode;
  name: string;
  color: string;
  /** Original label name when editing (for rename tracking) */
  originalName?: string;
}

/**
 * Label picker with inline create, edit, and delete management.
 * Used by both CardDetail and CreateItemModal.
 */
export function LabelPickerManager({ currentLabels, onToggle, token }: Props) {
  const [mode, setMode] = useState<Mode>('normal');
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const newLabelBtnRef = useRef<HTMLButtonElement>(null);
  const manageBtnRef = useRef<HTMLButtonElement>(null);

  const allLabels = labelsStore.value;
  const currentLabelsList = currentLabels.split(',').map(x => x.trim()).filter(Boolean);

  // Determine first unused color for new labels
  const usedColors = new Set(allLabels.map(l => l.color.toUpperCase()));
  const firstUnusedColor = PRESET_COLORS.find(pc => !usedColors.has(pc.hex.toUpperCase()))?.hex || PRESET_COLORS[0].hex;

  const openCreateForm = () => {
    setForm({ mode: 'create', name: '', color: firstUnusedColor });
    setConfirmingDelete(null);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const openEditForm = (labelName: string) => {
    const label = allLabels.find(l => l.label === labelName);
    if (!label) return;
    setForm({ mode: 'edit-label', name: label.label, color: label.color, originalName: label.label });
    setConfirmingDelete(null);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const closeForm = () => {
    setForm(null);
    // Return focus appropriately
    requestAnimationFrame(() => {
      if (mode === 'normal') {
        newLabelBtnRef.current?.focus();
      } else {
        manageBtnRef.current?.focus();
      }
    });
  };

  const toggleEditMode = () => {
    setMode(m => m === 'normal' ? 'edit' : 'normal');
    setForm(null);
    setConfirmingDelete(null);
  };

  // --- Validation ---
  const validateName = (name: string, originalName?: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Label name is required';
    if (trimmed.length > 30) return 'Label name must be 30 characters or fewer';
    const isDuplicate = allLabels.some(
      l => l.label.toLowerCase() === trimmed.toLowerCase() &&
        l.label.toLowerCase() !== (originalName || '').toLowerCase()
    );
    if (isDuplicate) return 'A label with this name already exists';
    return null;
  };

  const validationError = form ? validateName(form.name, form.originalName) : null;
  const canSave = form !== null && form.name.trim() !== '' && !validationError && form.color !== '';

  // --- Submit handlers ---
  const handleSave = async () => {
    if (!form || !canSave) return;
    const trimmedName = form.name.trim();

    if (form.mode === 'create') {
      await createLabel(trimmedName, form.color, token);
    } else if (form.mode === 'edit-label' && form.originalName) {
      await updateLabel(form.originalName, trimmedName, form.color, token);
    }
    closeForm();
  };

  const handleDelete = (labelName: string) => {
    setConfirmingDelete(labelName);
    setForm(null);
  };

  const confirmDeleteLabel = async (labelName: string) => {
    await deleteLabel(labelName, token);
    setConfirmingDelete(null);
  };

  const cancelDelete = () => {
    setConfirmingDelete(null);
  };

  // --- Empty state ---
  if (allLabels.length === 0 && !form) {
    return (
      <div class="label-picker-empty">
        <span class="label-picker-empty-text">No labels yet</span>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onClick={openCreateForm}
        >
          + Create label
        </button>
        {form && renderForm()}
      </div>
    );
  }

  function renderForm() {
    if (!form) return null;
    return (
      <div class="label-form" data-testid="label-form">
        <input
          ref={nameInputRef}
          type="text"
          class="label-form-input"
          placeholder="Label name..."
          maxLength={30}
          value={form.name}
          onInput={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') { e.stopPropagation(); closeForm(); }
          }}
          data-testid="label-name-input"
        />
        {validationError && form.name.trim() !== '' && (
          <span class="label-form-error" data-testid="label-validation-error">{validationError}</span>
        )}
        <ColorSwatchGrid
          selectedColor={form.color}
          onSelect={(hex) => setForm({ ...form, color: hex })}
        />
        <div class="label-form-actions">
          <button type="button" class="btn btn-ghost btn-sm" onClick={closeForm}>Cancel</button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            disabled={!canSave}
            onClick={handleSave}
            data-testid="label-save-btn"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="label-picker-manager">
      <div class="label-picker">
        {allLabels.map(l => {
          const isActive = currentLabelsList.includes(l.label);
          const isDeleting = confirmingDelete === l.label;
          const isBeingEdited = form?.mode === 'edit-label' && form.originalName === l.label;

          if (isBeingEdited) {
            return renderForm();
          }

          if (isDeleting) {
            return (
              <div key={l.label} class="label-delete-confirm" data-testid="label-delete-confirm">
                <span class="delete-confirm-text">Remove label from all items?</span>
                <button type="button" class="btn btn-ghost btn-sm" onClick={cancelDelete}>Cancel</button>
                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  onClick={() => confirmDeleteLabel(l.label)}
                  data-testid="label-delete-confirm-btn"
                >
                  Remove
                </button>
              </div>
            );
          }

          return (
            <div key={l.label} class={`label-toggle-wrapper ${mode === 'edit' ? 'label-toggle-edit-mode' : ''}`}>
              <button
                type="button"
                class={`label-toggle ${isActive ? 'label-toggle-active' : ''}`}
                style={{ '--label-color': l.color, '--label-text-color': getContrastTextColor(l.color) } as any}
                aria-pressed={isActive}
                onClick={() => {
                  if (mode === 'normal') onToggle(l.label);
                }}
                disabled={mode === 'edit'}
              >
                {l.label}
              </button>
              {mode === 'edit' && (
                <span class="label-edit-actions">
                  <button
                    type="button"
                    class="btn-icon"
                    aria-label={`Edit ${l.label}`}
                    title={`Edit ${l.label}`}
                    onClick={() => openEditForm(l.label)}
                    data-testid={`label-edit-${l.label}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    type="button"
                    class="btn-icon btn-icon-danger"
                    aria-label={`Delete ${l.label}`}
                    title={`Delete ${l.label}`}
                    onClick={() => handleDelete(l.label)}
                    data-testid={`label-delete-${l.label}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline create form (shown below label toggles) */}
      {form && form.mode === 'create' && renderForm()}

      {/* Action bar: New label + Manage labels */}
      <div class="label-picker-actions">
        {mode === 'normal' && !form && (
          <button
            ref={newLabelBtnRef}
            type="button"
            class="btn btn-ghost btn-sm"
            onClick={openCreateForm}
            data-testid="new-label-btn"
          >
            + New label
          </button>
        )}
        <button
          ref={manageBtnRef}
          type="button"
          class="btn btn-ghost btn-sm"
          onClick={toggleEditMode}
          data-testid="manage-labels-btn"
        >
          {mode === 'edit' ? 'Done' : 'Manage labels'}
        </button>
      </div>
    </div>
  );
}
