import { useState, useRef } from 'preact/hooks';
import { labels as labelsStore, items, loading } from '../../state/board-store';
import { createLabel, updateLabel, deleteLabel } from '../../state/actions';
import { getContrastTextColor } from '../../utils/color';
import { ColorSwatchGrid } from '../labels/color-swatch-grid';
import { PRESET_COLORS } from '../labels/preset-colors';

interface LabelSettingsProps {
  token: string;
}

interface EditState {
  name: string;
  color: string;
  originalName: string;
}

export function LabelSettings({ token }: LabelSettingsProps) {
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deletingLabel, setDeletingLabel] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const allLabels = labelsStore.value;
  const allItems = items.value;

  const getUsageCount = (labelName: string): number => {
    return allItems.filter(item => {
      const labelsList = item.labels.split(',').map(l => l.trim());
      return labelsList.includes(labelName);
    }).length;
  };

  const usedColors = new Set(allLabels.map(l => l.color.toUpperCase()));
  const firstUnusedColor = PRESET_COLORS.find(pc => !usedColors.has(pc.hex.toUpperCase()))?.hex || PRESET_COLORS[0].hex;

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

  // --- Create ---
  const startCreate = () => {
    setCreating(true);
    setCreateName('');
    setCreateColor(firstUnusedColor);
    setEditingLabel(null);
    setEditState(null);
    setDeletingLabel(null);
    requestAnimationFrame(() => createInputRef.current?.focus());
  };

  const cancelCreate = () => {
    setCreating(false);
    setCreateName('');
    setCreateColor('');
  };

  const createValidationError = creating ? validateName(createName) : null;
  const canCreate = creating && createName.trim() !== '' && !createValidationError && createColor !== '';

  const handleCreate = async () => {
    if (!canCreate) return;
    await createLabel(createName.trim(), createColor, token);
    cancelCreate();
  };

  // --- Edit ---
  const startEdit = (labelName: string) => {
    const label = allLabels.find(l => l.label === labelName);
    if (!label) return;
    setEditingLabel(labelName);
    setEditState({ name: label.label, color: label.color, originalName: label.label });
    setCreating(false);
    setDeletingLabel(null);
    requestAnimationFrame(() => editInputRef.current?.focus());
  };

  const cancelEdit = () => {
    setEditingLabel(null);
    setEditState(null);
  };

  const editValidationError = editState ? validateName(editState.name, editState.originalName) : null;
  const canSaveEdit = editState !== null && editState.name.trim() !== '' && !editValidationError && editState.color !== '';

  const handleSaveEdit = async () => {
    if (!editState || !canSaveEdit) return;
    await updateLabel(editState.originalName, editState.name.trim(), editState.color, token);
    cancelEdit();
  };

  // --- Delete ---
  const startDelete = (labelName: string) => {
    setDeletingLabel(labelName);
    setEditingLabel(null);
    setEditState(null);
    setCreating(false);
  };

  const cancelDelete = () => {
    setDeletingLabel(null);
  };

  const confirmDelete = async (labelName: string) => {
    await deleteLabel(labelName, token);
    setDeletingLabel(null);
  };

  // --- Loading ---
  if (loading.value) {
    return (
      <section class="label-settings" data-testid="label-settings" aria-label="Labels">
        <h3 class="label-settings-heading">Labels</h3>
        <div class="label-settings-loading" data-testid="label-settings-loading">
          <span class="spinner" aria-label="Loading labels" />
        </div>
      </section>
    );
  }

  // --- Empty ---
  if (allLabels.length === 0 && !creating) {
    return (
      <section class="label-settings" data-testid="label-settings" aria-label="Labels">
        <h3 class="label-settings-heading">Labels</h3>
        <div class="label-settings-empty" data-testid="label-settings-empty">
          <p>No labels yet.</p>
          <button
            type="button"
            class="btn btn-primary"
            onClick={startCreate}
            data-testid="label-settings-create-first"
          >
            Create your first label
          </button>
        </div>
      </section>
    );
  }

  return (
    <section class="label-settings" data-testid="label-settings" aria-label="Labels">
      <div class="label-settings-header">
        <h3 class="label-settings-heading">Labels</h3>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          onClick={startCreate}
          data-testid="label-settings-new-btn"
        >
          New Label
        </button>
      </div>

      {creating && (
        <div class="label-settings-create-form" data-testid="label-settings-create-form">
          <div class="label-settings-form-field">
            <label for="label-create-name">Label name</label>
            <input
              ref={createInputRef}
              id="label-create-name"
              type="text"
              maxLength={30}
              value={createName}
              onInput={(e) => setCreateName((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canCreate) { e.preventDefault(); handleCreate(); }
                if (e.key === 'Escape') { e.stopPropagation(); cancelCreate(); }
              }}
              aria-invalid={createValidationError && createName.trim() !== '' ? 'true' : undefined}
              aria-describedby={createValidationError && createName.trim() !== '' ? 'label-create-error' : undefined}
              data-testid="label-create-name-input"
            />
            {createValidationError && createName.trim() !== '' && (
              <span id="label-create-error" class="label-settings-error" role="alert" data-testid="label-create-error">
                {createValidationError}
              </span>
            )}
          </div>
          <ColorSwatchGrid selectedColor={createColor} onSelect={setCreateColor} />
          <div class="label-settings-form-actions">
            <button type="button" class="btn btn-ghost btn-sm" onClick={cancelCreate}>Cancel</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              disabled={!canCreate}
              onClick={handleCreate}
              data-testid="label-create-save-btn"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <table class="label-settings-table" data-testid="label-settings-table">
        <thead>
          <tr>
            <th>Color</th>
            <th>Name</th>
            <th>Items</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {allLabels.map(l => {
            const usageCount = getUsageCount(l.label);
            const isEditing = editingLabel === l.label;
            const isDeleting = deletingLabel === l.label;

            if (isEditing && editState) {
              return (
                <tr key={l.label} data-testid={`label-row-${l.label}`}>
                  <td colSpan={4}>
                    <div class="label-settings-edit-form" data-testid="label-edit-form">
                      <div class="label-settings-form-field">
                        <label for="label-edit-name">Label name</label>
                        <input
                          ref={editInputRef}
                          id="label-edit-name"
                          type="text"
                          maxLength={30}
                          value={editState.name}
                          onInput={(e) => setEditState({ ...editState, name: (e.target as HTMLInputElement).value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canSaveEdit) { e.preventDefault(); handleSaveEdit(); }
                            if (e.key === 'Escape') { e.stopPropagation(); cancelEdit(); }
                          }}
                          aria-invalid={editValidationError && editState.name.trim() !== '' ? 'true' : undefined}
                          aria-describedby={editValidationError && editState.name.trim() !== '' ? 'label-edit-error' : undefined}
                          data-testid="label-edit-name-input"
                        />
                        {editValidationError && editState.name.trim() !== '' && (
                          <span id="label-edit-error" class="label-settings-error" role="alert" data-testid="label-edit-error">
                            {editValidationError}
                          </span>
                        )}
                      </div>
                      <ColorSwatchGrid selectedColor={editState.color} onSelect={(hex) => setEditState({ ...editState, color: hex })} />
                      <div class="label-settings-form-actions">
                        <button type="button" class="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          disabled={!canSaveEdit}
                          onClick={handleSaveEdit}
                          data-testid="label-edit-save-btn"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }

            if (isDeleting) {
              const deleteMessage = usageCount > 0
                ? `This label is used by ${usageCount} item${usageCount === 1 ? '' : 's'}. Remove it from all items and delete?`
                : 'Delete this label?';
              return (
                <tr key={l.label} data-testid={`label-row-${l.label}`}>
                  <td colSpan={4}>
                    <div class="label-settings-delete-confirm" data-testid="label-delete-confirm">
                      <span class="label-settings-delete-message" data-testid="label-delete-message">{deleteMessage}</span>
                      <div class="label-settings-form-actions">
                        <button type="button" class="btn btn-ghost btn-sm" onClick={cancelDelete}>Cancel</button>
                        <button
                          type="button"
                          class="btn btn-danger btn-sm"
                          onClick={() => confirmDelete(l.label)}
                          data-testid="label-delete-confirm-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={l.label} data-testid={`label-row-${l.label}`}>
                <td>
                  <span
                    class="label-settings-swatch"
                    style={{ backgroundColor: l.color }}
                    aria-label={`Color: ${l.color}`}
                  />
                </td>
                <td>
                  <span
                    class="label-settings-name"
                    style={{ '--label-color': l.color, '--label-text-color': getContrastTextColor(l.color) } as any}
                  >
                    {l.label}
                  </span>
                </td>
                <td class="label-settings-count">{usageCount}</td>
                <td class="label-settings-actions">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm label-settings-action-btn"
                    onClick={() => startEdit(l.label)}
                    aria-label={`Edit ${l.label}`}
                    data-testid={`label-edit-btn-${l.label}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm label-settings-action-btn label-settings-delete-btn"
                    onClick={() => startDelete(l.label)}
                    aria-label={`Delete ${l.label}`}
                    data-testid={`label-delete-btn-${l.label}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
