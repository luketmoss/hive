import { useState, useRef } from 'preact/hooks';
import { boardStatuses, boardItems } from '../../state/board-store';
import { createStatus, updateStatus, reorderStatuses, deleteStatusWithMigration } from '../../state/actions';
import type { BoardStatus } from '../../api/types';

interface ColumnSettingsProps {
  token: string;
}

// Stored values (light-mode pastels) — mapped to theme-aware CSS vars at render time
const COLUMN_PRESET_COLORS = [
  '#e3f2fd', '#e8eaf6', '#f3e5f5', '#fce4ec',
  '#fff3e0', '#e8f5e9', '#e0f2f1', '#fff8e1',
];

// More saturated preview colors for the picker swatches (easier to differentiate)
const SWATCH_PREVIEW_COLORS: Record<string, string> = {
  '#e3f2fd': '#90caf9', // blue
  '#e8eaf6': '#9fa8da', // indigo
  '#f3e5f5': '#ce93d8', // purple
  '#fce4ec': '#f48fb1', // pink
  '#fff3e0': '#ffb74d', // orange
  '#e8f5e9': '#81c784', // green
  '#e0f2f1': '#80cbc4', // teal
  '#fff8e1': '#ffd54f', // amber
};

export function ColumnSettings({ token }: ColumnSettingsProps) {
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState(COLUMN_PRESET_COLORS[0]);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string>('');
  const createInputRef = useRef<HTMLInputElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);

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

  // --- Inline name edit ---
  const handleStartNameEdit = (col: BoardStatus) => {
    setEditingNameId(col.id);
    setEditingNameValue(col.name);
    requestAnimationFrame(() => editNameRef.current?.focus());
  };

  const handleSaveName = async (col: BoardStatus) => {
    const trimmed = editingNameValue.trim();
    setEditingNameId(null);
    if (!trimmed || trimmed === col.name) return;
    if (columns.some(c => c.id !== col.id && c.name.toLowerCase() === trimmed.toLowerCase())) return;
    await updateStatus(col.id, { name: trimmed }, token);
  };

  // --- Inline color change ---
  const handleColorChange = async (col: BoardStatus, newColor: string) => {
    setColorPickerId(null);
    if (newColor === col.color) return;
    await updateStatus(col.id, { color: newColor }, token);
  };

  // --- Terminal toggle ---
  const handleTerminalToggle = async (col: BoardStatus) => {
    const terminalCount = columns.filter(c => c.is_terminal).length;
    if (col.is_terminal && terminalCount <= 1) return;
    await updateStatus(col.id, { is_terminal: !col.is_terminal }, token);
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
    if (columns.length <= 1) return;
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

          return (
            <div key={col.id} class="column-settings-row">
              {/* Clickable color swatch — opens inline color picker */}
              <div class="column-settings-swatch-wrap">
                <button
                  class="column-settings-swatch"
                  style={{ background: SWATCH_PREVIEW_COLORS[col.color] || col.color }}
                  onClick={() => setColorPickerId(colorPickerId === col.id ? null : col.id)}
                  aria-label={`Change color for ${col.name}`}
                />
                {colorPickerId === col.id && (
                  <div class="column-settings-color-popover">
                    {COLUMN_PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        class={`column-color-swatch${col.color === c ? ' column-color-swatch-active' : ''}`}
                        style={{ background: SWATCH_PREVIEW_COLORS[c] || c }}
                        onClick={() => handleColorChange(col, c)}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Clickable name — becomes input on click */}
              {editingNameId === col.id ? (
                <input
                  ref={editNameRef}
                  type="text"
                  class="column-settings-name-inline"
                  value={editingNameValue}
                  onInput={(e) => setEditingNameValue((e.target as HTMLInputElement).value)}
                  onBlur={() => handleSaveName(col)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setEditingNameId(null); }
                  }}
                />
              ) : (
                <button
                  class="column-settings-name"
                  onClick={() => handleStartNameEdit(col)}
                  title="Click to rename"
                >
                  {col.name}
                </button>
              )}

              <span class="column-settings-count">{itemCount}</span>

              {/* Terminal toggle */}
              <label class="column-settings-terminal-toggle" title="Completion column">
                <input
                  type="checkbox"
                  checked={col.is_terminal}
                  onChange={() => handleTerminalToggle(col)}
                  disabled={col.is_terminal && terminalCount <= 1}
                />
                <span class="column-settings-terminal-icon">{col.is_terminal ? '\u2713' : ''}</span>
              </label>

              {/* Reorder arrows */}
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

              {/* Delete — red text */}
              <button
                class="column-settings-delete-btn"
                disabled={columns.length <= 1 || (col.is_terminal && terminalCount <= 1)}
                onClick={() => handleStartDelete(col)}
                aria-label={`Delete ${col.name}`}
              >Delete</button>
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
                style={{ background: SWATCH_PREVIEW_COLORS[c] || c }}
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
