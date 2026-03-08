import { useState } from 'preact/hooks';
import { useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { selectedItemId, selectedItem, childrenOfSelected, items, owners, labels as labelsStore, showToast } from '../../state/board-store';
import { updateItem, deleteItem, deleteSubtask, createItem, moveItem, reorderSubtasks } from '../../state/actions';
import { validateOwnerChange } from '../../state/rules';
import { LabelBadge } from '../shared/label-badge';
import { LabelPickerManager } from '../labels/label-picker-manager';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { getContrastTextColor } from '../../utils/color';
import { QuickDateChips } from '../shared/quick-date-chips';
import type { ItemStatus } from '../../api/types';

export function CardDetail() {
  const { token, user } = useAuth();
  const item = selectedItem.value;
  if (!item) return null;

  const actor = user?.name || 'web';
  const children = childrenOfSelected.value;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskOwner, setSubtaskOwner] = useState(item.owner);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const subtaskRowRef = useRef<HTMLDivElement>(null);
  const addSubtaskBtnRef = useRef<HTMLButtonElement>(null);
  // Prevents the focusout handler from re-submitting after Enter already triggered submitSubtask
  const subtaskSubmittedRef = useRef(false);
  // Mirrors subtaskTitle state so submitSubtask always reads the current value,
  // avoiding stale-closure problems when focusOut fires before re-render.
  const subtaskTitleRef = useRef('');

  const close = useCallback(() => {
    selectedItemId.value = null;
  }, []);

  // Focus trap (AC3) + Escape to close (AC4)
  const panelRef = useFocusTrap(close);

  const save = async (field: string, value: string): Promise<boolean> => {
    if (!token) return false;
    return updateItem(item.id, { [field]: value }, actor, token);
  };

  const handleMoveStatus = async (newStatus: ItemStatus): Promise<boolean> => {
    if (!token) return false;
    return moveItem(item.id, newStatus, actor, token);
  };

  const handleDelete = () => {
    setConfirmingDelete(true);
  };

  const confirmDelete = () => {
    if (token) {
      deleteItem(item.id, actor, token);
      selectedItemId.value = null;
    }
    setConfirmingDelete(false);
  };

  const cancelDelete = () => {
    setConfirmingDelete(false);
  };

  const handleAddSubtask = () => {
    subtaskSubmittedRef.current = false;
    subtaskTitleRef.current = '';
    setAddingSubtask(true);
    setSubtaskTitle('');
    setSubtaskOwner(item.owner);
    // Focus the input after render
    requestAnimationFrame(() => {
      subtaskInputRef.current?.focus();
    });
  };

  const submitSubtask = () => {
    // Guard: Enter keydown unmounts the input row which fires focusout on the container,
    // which would otherwise call submitSubtask a second time before state has cleared.
    if (subtaskSubmittedRef.current) return;
    subtaskSubmittedRef.current = true;
    // Read from ref to avoid stale closure (focusOut fires before Preact re-renders)
    const trimmed = subtaskTitleRef.current.trim();
    if (trimmed && token) {
      createItem({ title: trimmed, parent_id: item.id, owner: subtaskOwner, created_by: user?.email || '' }, actor, token);
    }
    setAddingSubtask(false);
    setSubtaskTitle('');
    subtaskTitleRef.current = '';
    // Return focus to the "+ Add" trigger button after the row unmounts (#58 AC1/AC3)
    requestAnimationFrame(() => addSubtaskBtnRef.current?.focus());
  };

  const cancelSubtask = () => {
    subtaskSubmittedRef.current = true; // prevent focusout from submitting on cancel
    setAddingSubtask(false);
    setSubtaskTitle('');
    subtaskTitleRef.current = '';
    // Return focus to the "+ Add" trigger button (#58 AC2/AC3)
    requestAnimationFrame(() => addSubtaskBtnRef.current?.focus());
  };

  /** Focus-container: only submit when focus leaves the entire creation row */
  const handleCreationRowFocusOut = (e: FocusEvent) => {
    const container = subtaskRowRef.current;
    const related = e.relatedTarget as Node | null;
    // If focus moved to another element inside the creation row, don't submit
    if (container && related && container.contains(related)) return;
    submitSubtask();
  };

  const handleDeleteSubtask = (childId: string, childTitle: string) => {
    if (!token) return;
    const confirmed = confirm(`Delete sub-task '${childTitle}'?`);
    if (confirmed) {
      deleteSubtask(childId, actor, token);
    }
  };

  const handleReorder = (childId: string, direction: 'up' | 'down') => {
    if (!token) return;
    const idx = children.findIndex(c => c.id === childId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= children.length) return;
    reorderSubtasks(children[idx].id, children[swapIdx].id, actor, token);
  };

  const toggleChildStatus = (childId: string, currentStatus: ItemStatus) => {
    if (!token) return;
    const newStatus: ItemStatus = currentStatus === 'Done' ? 'To Do' : 'Done';
    moveItem(childId, newStatus, actor, token);
  };

  const handleSubtaskOwnerChange = async (childId: string, newOwner: string, selectEl: HTMLSelectElement) => {
    if (!token) return;
    const child = items.value.find(i => i.id === childId);
    if (!child) return;

    const validation = validateOwnerChange(child, newOwner);
    if (!validation.valid) {
      showToast(validation.error!, 'error');
      selectEl.value = child.owner;
      return;
    }

    await updateItem(childId, { owner: newOwner }, actor, token);
  };

  return (
    <div
      class="detail-overlay"
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Item Details"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('detail-overlay')) close();
      }}
    >
      <div class="detail-panel">
        <div class="detail-header">
          <h2>Item Details</h2>
          <button class="btn btn-ghost" aria-label="Close" onClick={close}>✕</button>
        </div>

        <div class="detail-body">
          <EditableField
            label="Title"
            value={item.title}
            onSave={(v) => save('title', v)}
          />

          <EditableField
            label="Description"
            value={item.description}
            onSave={(v) => save('description', v)}
            multiline
          />

          <SaveFeedbackField label="Status">
            {(onFieldSaved) => (
              <select
                value={item.status}
                onChange={async (e) => {
                  const prev = item.status;
                  const ok = await handleMoveStatus((e.target as HTMLSelectElement).value as ItemStatus);
                  onFieldSaved(ok);
                  if (!ok) (e.target as HTMLSelectElement).value = prev;
                }}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
            )}
          </SaveFeedbackField>

          <SaveFeedbackField label="Owner">
            {(onFieldSaved) => (
              <select
                value={item.owner}
                onChange={async (e) => {
                  const prev = item.owner;
                  const ok = await save('owner', (e.target as HTMLSelectElement).value);
                  onFieldSaved(ok);
                  if (!ok) (e.target as HTMLSelectElement).value = prev;
                }}
              >
                <option value="">Unassigned</option>
                {owners.value.map(o => (
                  <option key={o.name} value={o.name}>{o.name}</option>
                ))}
              </select>
            )}
          </SaveFeedbackField>

          <SaveFeedbackField label="Due Date">
            {(onFieldSaved) => (
              <>
                <input
                  type="date"
                  value={item.due_date ? item.due_date.split('T')[0] : ''}
                  onChange={async (e) => {
                    const prev = item.due_date ? item.due_date.split('T')[0] : '';
                    const ok = await save('due_date', (e.target as HTMLInputElement).value);
                    onFieldSaved(ok);
                    if (!ok) (e.target as HTMLInputElement).value = prev;
                  }}
                />
                <QuickDateChips
                  value={item.due_date ? item.due_date.split('T')[0] : ''}
                  onChange={async (date) => {
                    const ok = await save('due_date', date);
                    onFieldSaved(ok);
                  }}
                />
              </>
            )}
          </SaveFeedbackField>

          <SaveFeedbackField label="Scheduled Date">
            {(onFieldSaved) => (
              <>
                <input
                  type="date"
                  value={item.scheduled_date ? item.scheduled_date.split('T')[0] : ''}
                  onChange={async (e) => {
                    const prev = item.scheduled_date ? item.scheduled_date.split('T')[0] : '';
                    const ok = await save('scheduled_date', (e.target as HTMLInputElement).value);
                    onFieldSaved(ok);
                    if (!ok) (e.target as HTMLInputElement).value = prev;
                  }}
                />
                <QuickDateChips
                  value={item.scheduled_date ? item.scheduled_date.split('T')[0] : ''}
                  onChange={async (date) => {
                    const ok = await save('scheduled_date', date);
                    onFieldSaved(ok);
                  }}
                />
              </>
            )}
          </SaveFeedbackField>

          <SaveFeedbackField label="Labels">
            {(onFieldSaved) => (
              <LabelPickerManager
                currentLabels={item.labels}
                onToggle={async (labelName) => {
                  const currentLabels = item.labels.split(',').map(x => x.trim()).filter(Boolean);
                  const isActive = currentLabels.includes(labelName);
                  const updated = isActive
                    ? currentLabels.filter(x => x !== labelName)
                    : [...currentLabels, labelName];
                  const ok = await save('labels', updated.join(', '));
                  onFieldSaved(ok);
                }}
                token={token!}
              />
            )}
          </SaveFeedbackField>

          {/* Sub-tasks */}
          <div class="detail-subtasks">
            <div class="detail-subtasks-header">
              <label>Sub-tasks ({children.length})</label>
              {!addingSubtask && (
                <button ref={addSubtaskBtnRef} class="btn btn-sm" onClick={handleAddSubtask}>+ Add</button>
              )}
            </div>
            {children.length > 0 && (
              <ul class="subtask-list">
                {children.map((child, idx) => (
                  <li key={child.id} class={`subtask-item ${child.status === 'Done' ? 'subtask-done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={child.status === 'Done'}
                      aria-label={child.title}
                      onChange={() => toggleChildStatus(child.id, child.status)}
                    />
                    <span class="subtask-title">{child.title}</span>
                    <select
                      class="subtask-owner-select"
                      value={child.owner}
                      aria-label={`Owner for ${child.title}`}
                      onChange={(e) => handleSubtaskOwnerChange(child.id, (e.target as HTMLSelectElement).value, e.target as HTMLSelectElement)}
                    >
                      <option value="">Unassigned</option>
                      {owners.value.map(o => (
                        <option key={o.name} value={o.name}>{o.name}</option>
                      ))}
                    </select>
                    <div class="subtask-actions">
                      {children.length > 1 && (
                        <>
                          <button
                            class="btn-icon subtask-action-btn"
                            aria-label="Move up"
                            aria-disabled={idx === 0 ? 'true' : undefined}
                            style={idx === 0 ? 'opacity: 0.3; cursor: not-allowed;' : undefined}
                            onClick={() => { if (idx > 0) handleReorder(child.id, 'up'); }}
                          >&#9650;</button>
                          <button
                            class="btn-icon subtask-action-btn"
                            aria-label="Move down"
                            aria-disabled={idx === children.length - 1 ? 'true' : undefined}
                            style={idx === children.length - 1 ? 'opacity: 0.3; cursor: not-allowed;' : undefined}
                            onClick={() => { if (idx < children.length - 1) handleReorder(child.id, 'down'); }}
                          >&#9660;</button>
                        </>
                      )}
                      <button
                        class="btn-icon btn-icon-danger subtask-action-btn"
                        aria-label="Delete sub-task"
                        onClick={() => handleDeleteSubtask(child.id, child.title)}
                      >&#215;</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {addingSubtask && (
              <div
                class="subtask-add-wrapper"
                ref={subtaskRowRef}
                onFocusOut={handleCreationRowFocusOut}
              >
                <div class="subtask-add-inline">
                  <input
                    ref={subtaskInputRef}
                    type="text"
                    class="subtask-add-input"
                    placeholder="Sub-task title..."
                    aria-label="Sub-task title"
                    aria-describedby="subtask-add-hint"
                    value={subtaskTitle}
                    onInput={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      subtaskTitleRef.current = v;
                      setSubtaskTitle(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); submitSubtask(); }
                      if (e.key === 'Escape') { e.stopPropagation(); cancelSubtask(); }
                    }}
                  />
                  <select
                    class="subtask-add-owner"
                    value={subtaskOwner}
                    aria-label="Owner for new sub-task"
                    aria-describedby="subtask-add-hint"
                    onChange={(e) => setSubtaskOwner((e.target as HTMLSelectElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { e.stopPropagation(); cancelSubtask(); }
                    }}
                  >
                    <option value="">Unassigned</option>
                    {owners.value.map(o => (
                      <option key={o.name} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                  <button
                    class="btn-icon subtask-action-btn subtask-add-confirm"
                    aria-label="Add sub-task"
                    aria-disabled={!subtaskTitle.trim() ? 'true' : undefined}
                    style={!subtaskTitle.trim() ? 'opacity: 0.4; cursor: not-allowed;' : undefined}
                    onClick={() => { if (subtaskTitle.trim()) submitSubtask(); }}
                  >&#10003;</button>
                  <button
                    class="btn-icon subtask-action-btn"
                    aria-label="Cancel adding sub-task"
                    onClick={() => cancelSubtask()}
                  >&#10005;</button>
                </div>
                <span id="subtask-add-hint" class="subtask-add-hint">Enter to add · Esc to cancel</span>
              </div>
            )}
          </div>

          <div class="detail-meta">
            {item.created_by && (
              <small>Created by: {owners.value.find(o => o.google_account === item.created_by)?.name || item.created_by}</small>
            )}
            {!item.created_by && (
              <small>Created by: Unknown</small>
            )}
            <small>Created: {new Date(item.created_at).toLocaleString()}</small>
            <small>Updated: {new Date(item.updated_at).toLocaleString()}</small>
            {item.completed_at && (
              <small>Completed: {new Date(item.completed_at).toLocaleString()}</small>
            )}
          </div>
        </div>

        <div class="detail-footer">
          {confirmingDelete ? (
            <div
              class="delete-confirm-inline"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.stopPropagation(); cancelDelete(); }
              }}
            >
              <span class="delete-confirm-text">Are you sure?</span>
              <button class="btn btn-ghost btn-sm" onClick={cancelDelete}>Cancel</button>
              <button class="btn btn-danger btn-sm" onClick={confirmDelete}>Delete</button>
            </div>
          ) : (
            <button class="btn btn-danger" onClick={handleDelete}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Save feedback wrapper for non-editable fields (selects, dates, labels) ---

function SaveFeedbackField({ label, children }: {
  label: string;
  children: (onFieldSaved: (success: boolean) => void) => any;
}) {
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);

  const onFieldSaved = (success: boolean) => {
    setFeedback(success ? 'saved' : 'error');
    setTimeout(() => setFeedback(null), 2000);
  };

  return (
    <div class="detail-field">
      <label>
        {label}
        {feedback === 'saved' && (
          <span class="save-indicator save-indicator-success" data-testid="save-indicator">Saved</span>
        )}
        {feedback === 'error' && (
          <span class="save-indicator save-indicator-error" data-testid="save-indicator-error">Error</span>
        )}
      </label>
      {children(onFieldSaved)}
    </div>
  );
}

// --- Inline editable field ---

function EditableField({ label, value, onSave, multiline }: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<boolean>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);

  const commit = async () => {
    setEditing(false);
    if (draft !== value) {
      const ok = await onSave(draft);
      if (ok) {
        setFeedback('saved');
      } else {
        setFeedback('error');
        setDraft(value); // revert draft on error
      }
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div class="detail-field" onClick={() => { setDraft(value); setEditing(true); }}>
        <label>
          {label}
          {feedback === 'saved' && (
            <span class="save-indicator save-indicator-success" data-testid="save-indicator">Saved</span>
          )}
          {feedback === 'error' && (
            <span class="save-indicator save-indicator-error" data-testid="save-indicator-error">Error</span>
          )}
        </label>
        <div
          class="editable-value"
          role="button"
          tabIndex={0}
          aria-label={`Edit ${label.toLowerCase()}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setDraft(value);
              setEditing(true);
            }
          }}
        >
          {value || <span class="placeholder">Click to edit</span>}
        </div>
      </div>
    );
  }

  return (
    <div class="detail-field">
      <label>{label}</label>
      {multiline ? (
        <textarea
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } }}
          autoFocus
          rows={4}
        />
      ) : (
        <input
          type="text"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
          }}
          autoFocus
        />
      )}
    </div>
  );
}
