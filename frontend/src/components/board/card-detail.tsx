import { useState } from 'preact/hooks';
import { useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { selectedItemId, selectedItem, childrenOfSelected, items, owners, labels as labelsStore } from '../../state/board-store';
import { updateItem, deleteItem, createItem, moveItem } from '../../state/actions';
import { LabelBadge } from '../shared/label-badge';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import type { ItemStatus } from '../../api/types';

export function CardDetail() {
  const { token, user } = useAuth();
  const item = selectedItem.value;
  if (!item) return null;

  const actor = user?.name || 'web';
  const children = childrenOfSelected.value;

  const close = useCallback(() => {
    // Return focus to the triggering card element (AC5)
    const triggerId = selectedItemId.value;
    selectedItemId.value = null;
    // Use requestAnimationFrame to allow the DOM to update after panel closes
    requestAnimationFrame(() => {
      if (triggerId) {
        const cardEl = document.querySelector<HTMLElement>(`[data-item-id="${triggerId}"]`);
        cardEl?.focus();
      }
    });
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
    if (confirm('Delete this item and all sub-tasks?')) {
      if (token) {
        deleteItem(item.id, actor, token);
        selectedItemId.value = null;
      }
    }
  };

  const handleAddSubtask = () => {
    const title = prompt('Sub-task title:');
    if (title && token) {
      createItem({ title, parent_id: item.id, owner: item.owner }, actor, token);
    }
  };

  const toggleChildStatus = (childId: string, currentStatus: ItemStatus) => {
    if (!token) return;
    const newStatus: ItemStatus = currentStatus === 'Done' ? 'To Do' : 'Done';
    moveItem(childId, newStatus, actor, token);
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
          <button class="btn btn-ghost" onClick={close}>✕</button>
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
            )}
          </SaveFeedbackField>

          <SaveFeedbackField label="Scheduled Date">
            {(onFieldSaved) => (
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
            )}
          </SaveFeedbackField>

          <SaveFeedbackField label="Labels">
            {(onFieldSaved) => (
              <div class="label-picker">
                {labelsStore.value.map(l => {
                  const currentLabels = item.labels.split(',').map(x => x.trim()).filter(Boolean);
                  const isActive = currentLabels.includes(l.label);
                  return (
                    <button
                      key={l.label}
                      class={`label-toggle ${isActive ? 'label-toggle-active' : ''}`}
                      style={{ '--label-color': l.color } as any}
                      onClick={async () => {
                        const updated = isActive
                          ? currentLabels.filter(x => x !== l.label)
                          : [...currentLabels, l.label];
                        const ok = await save('labels', updated.join(', '));
                        onFieldSaved(ok);
                      }}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            )}
          </SaveFeedbackField>

          {/* Sub-tasks */}
          <div class="detail-subtasks">
            <div class="detail-subtasks-header">
              <label>Sub-tasks ({children.length})</label>
              <button class="btn btn-sm" onClick={handleAddSubtask}>+ Add</button>
            </div>
            {children.length > 0 && (
              <ul class="subtask-list">
                {children.map(child => (
                  <li key={child.id} class={`subtask-item ${child.status === 'Done' ? 'subtask-done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={child.status === 'Done'}
                      onChange={() => toggleChildStatus(child.id, child.status)}
                    />
                    <span>{child.title}</span>
                    {child.owner && <span class="subtask-owner">{child.owner}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div class="detail-meta">
            <small>Created: {new Date(item.created_at).toLocaleString()}</small>
            <small>Updated: {new Date(item.updated_at).toLocaleString()}</small>
            {item.completed_at && (
              <small>Completed: {new Date(item.completed_at).toLocaleString()}</small>
            )}
          </div>
        </div>

        <div class="detail-footer">
          <button class="btn btn-danger" onClick={handleDelete}>Delete</button>
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
        <div class="editable-value">
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
