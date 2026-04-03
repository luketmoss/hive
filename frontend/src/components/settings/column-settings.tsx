import { useState, useRef } from 'preact/hooks';
import { boardStatuses, boardItems } from '../../state/board-store';
import { createStatus, updateStatus, reorderStatuses, deleteStatusWithMigration } from '../../state/actions';
import type { BoardStatus } from '../../api/types';

interface ColumnSettingsProps {
  token: string;
}

interface EditState {
  name: string;
  color: string;
  is_terminal: boolean;
}

const COLUMN_PRESET_COLORS = [
  '#e3f2fd', '#e8eaf6', '#f3e5f5', '#fce4ec',
  '#fff3e0', '#e8f5e9', '#e0f2f1', '#fff8e1',
];

export function ColumnSettings({ token }: ColumnSettingsProps) {
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState(COLUMN_PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string>('');
  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const columns = boardStatuses.value;
  const allItems = boardItems.value;

  const getItemCount = (statusName: string): number => {
    return allItems.filter(i => i.status === statusName).length;
  };

  // --- Create ---
  const handleStartCreate = () => {
    const usedColors = new Set(columns.map(c => c.color));
    const firstUnused = COLUMN_PRESET_COLORS.find(c => !usedColors.has(c)) || COLUMN_PRESET_COLORS[0];
    setCreateColor(firstUnused);
    setCreateName('');
    setCreating(true);
    requestAnimationFrame(() => createInputRef.current?.focus());
  };

  const handleCreate = async () => {
    const trimmed = createName.trim();
    if (!trimmed) return;
    if (columns.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    await createStatus(trimmed, createColor, false, token);
    setCreating(false);
    setCreateName('');
  };

  // --- Edit ---
  const handleStartEdit = (col: BoardStatus) => {
    setEditingId(col.id);
    setEditState({ name: col.name, color: col.color, is_terminal: col.is_terminal });
    requestAnimationFrame(() => editInputRef.current?.focus());
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editState) return;
    const trimmed = editState.name.trim();
    if (!trimmed) return;

    const current = columns.find(c => c.id === editingId);
    if (!current) return;

    // Duplicate name check (excluding self)
    if (columns.some(c => c.id !== editingId && c.name.toLowerCase() === trimmed.toLowerCase())) return;

    const changes: Partial<Pick<BoardStatus, 'name' | 'color' | 'is_terminal'>> = {};
    if (trimmed !== current.name) changes.name = trimmed;
    if (editState.color !== current.color) changes.color = editState.color;
    if (editState.is_terminal !== current.is_terminal) changes.is_terminal = editState.is_terminal;

    if (Object.keys(changes).length > 0) {
      await updateStatus(editingId, changes, token);
    }
    setEditingId(null);
    setEditState(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  // --- Reorder ---
  const handleMoveUp = async (idx: number) => {
    if (idx <= 0) return;
    const ids = columns.map(c => c.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await reorderStatuses(ids, token);
  };

  const handleMoveDown = async (idx: number) => {
    if (idx >= columns.length - 1) return;
    const ids = columns.map(c => c.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    await reorderStatuses(ids, token);
  };

  // --- Delete ---
  const handleStartDelete = (col: BoardStatus) => {
    // Guard: cannot delete last column
    if (columns.length <= 1) return;
    // Guard: cannot delete sole terminal column
    const terminalCount = columns.filter(c => c.is_terminal).length;
    if (col.is_terminal && terminalCount <= 1) return;

    setDeletingId(col.id);
    const otherColumns = columns.filter(c => c.id !== col.id);
    setDeleteTarget(otherColumns[0]?.name || '');
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    const col = columns.find(c => c.id === deletingId);
    if (!col) return;

    const itemCount = getItemCount(col.name);
    const target = itemCount > 0 ? deleteTarget : null;
    await deleteStatusWithMigration(deletingId, target, token);
    setDeletingId(null);
    setDeleteTarget('');
  };

  const handleCancelDelete = () => {
    setDeletingId(null);
    setDeleteTarget('');
  };

  const terminalCount = columns.filter(c => c.is_terminal).length;

  return (
    <div class="column-settings">
      <div class="column-settings-list">
        {columns.map((col, idx) => {
          const itemCount = getItemCount(col.name);
          const isEditing = editingId === col.id;
          const isDeleting = deletingId === col.id;

          if (isDeleting) {
            const deleteItemCount = getItemCount(col.name);
            const otherColumns = columns.filter(c => c.id !== col.id);
            return (
              <div key={col.id} class="column-settings-row column-settings-row-delete">
                <div class="column-settings-delete-prompt">
                  {deleteItemCount > 0 ? (
                    <>
                      <p>
                        <strong>{col.name}</strong> has {deleteItemCount} item{deleteItemCount !== 1 ? 's' : ''}.
                        Move them to:
                      </p>
                      <select
                        value={deleteTarget}
                        onChange={(e) => setDeleteTarget((e.target as HTMLSelectElement).value)}
                        class="column-settings-delete-select"
                      >
                        {otherColumns.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <p>Delete column <strong>{col.name}</strong>?</p>
                  )}
                  <div class="column-settings-delete-actions">
                    <button class="btn btn-danger btn-sm" onClick={handleConfirmDelete}>
                      {deleteItemCount > 0 ? 'Move & Delete' : 'Delete'}
                    </button>
                    <button class="btn btn-ghost btn-sm" onClick={handleCancelDelete}>Cancel</button>
                  </div>
                </div>
              </div>
            );
          }

          if (isEditing && editState) {
            return (
              <div key={col.id} class="column-settings-row column-settings-row-edit">
                <input
                  ref={editInputRef}
                  type="text"
                  class="column-settings-name-input"
                  value={editState.name}
                  onInput={(e) => setEditState({ ...editState, name: (e.target as HTMLInputElement).value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <div class="column-settings-color-row">
                  {COLUMN_PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      class={`column-color-swatch${editState.color === c ? ' column-color-swatch-active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setEditState({ ...editState, color: c })}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <label class="column-settings-terminal-label">
                  <input
                    type="checkbox"
                    checked={editState.is_terminal}
                    onChange={(e) => setEditState({ ...editState, is_terminal: (e.target as HTMLInputElement).checked })}
                    disabled={col.is_terminal && terminalCount <= 1}
                  />
                  Completion column
                </label>
                <div class="column-settings-edit-actions">
                  <button class="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
                  <button class="btn btn-ghost btn-sm" onClick={handleCancelEdit}>Cancel</button>
                </div>
              </div>
            );
          }

          return (
            <div key={col.id} class="column-settings-row">
              <span class="column-settings-swatch" style={{ background: col.color }} />
              <span class="column-settings-name">{col.name}</span>
              <span class="column-settings-count">{itemCount}</span>
              {col.is_terminal && <span class="column-settings-terminal-badge">Completion</span>}
              <div class="column-settings-actions">
                <button
                  class="btn-icon"
                  aria-label="Move up"
                  disabled={idx === 0}
                  onClick={() => handleMoveUp(idx)}
                >{'\u25B2'}</button>
                <button
                  class="btn-icon"
                  aria-label="Move down"
                  disabled={idx === columns.length - 1}
                  onClick={() => handleMoveDown(idx)}
                >{'\u25BC'}</button>
                <button class="btn btn-ghost btn-sm" onClick={() => handleStartEdit(col)}>Edit</button>
                <button
                  class="btn btn-ghost btn-sm"
                  disabled={columns.length <= 1 || (col.is_terminal && terminalCount <= 1)}
                  onClick={() => handleStartDelete(col)}
                >Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {creating ? (
        <div class="column-settings-create">
          <input
            ref={createInputRef}
            type="text"
            class="column-settings-name-input"
            placeholder="Column name"
            value={createName}
            onInput={(e) => setCreateName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setCreating(false);
            }}
          />
          <div class="column-settings-color-row">
            {COLUMN_PRESET_COLORS.map(c => (
              <button
                key={c}
                class={`column-color-swatch${createColor === c ? ' column-color-swatch-active' : ''}`}
                style={{ background: c }}
                onClick={() => setCreateColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div class="column-settings-create-actions">
            <button class="btn btn-primary btn-sm" onClick={handleCreate} disabled={!createName.trim()}>Add</button>
            <button class="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button class="btn btn-ghost column-settings-add-btn" onClick={handleStartCreate}>
          + Add Column
        </button>
      )}
    </div>
  );
}
