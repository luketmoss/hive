import { useState, useRef, useCallback } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showCreateModal, owners, labels as labelsStore } from '../../state/board-store';
import { createItem, createItemWithSubtasks } from '../../state/actions';
import type { StagedSubtask } from '../../state/actions';
import { LabelPickerManager } from '../labels/label-picker-manager';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { getContrastTextColor } from '../../utils/color';
import { QuickDateChips } from '../shared/quick-date-chips';

export function CreateItemModal() {
  const { token, user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<StagedSubtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => { showCreateModal.value = false; }, []);
  const trapRef = useFocusTrap(close);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!title.trim() || !token) return;

    const data = {
      title: title.trim(),
      description,
      owner,
      due_date: dueDate,
      scheduled_date: scheduledDate,
      labels: selectedLabels.join(', '),
      created_by: user?.email || '',
    };
    const actor = user?.name || 'web';

    if (subtasks.length > 0) {
      createItemWithSubtasks(data, subtasks, actor, token);
    } else {
      createItem(data, actor, token);
    }
    close();
  };

  const toggleLabel = (label: string) => {
    setSelectedLabels(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const addSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks(prev => [...prev, { title: subtaskInput.trim(), owner: owner }]);
    setSubtaskInput('');
    subtaskInputRef.current?.focus();
  };

  const removeSubtask = (index: number) => {
    setSubtasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubtaskKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtask();
    } else if (e.key === 'Escape') {
      if (subtaskInput) {
        e.stopPropagation();
        setSubtaskInput('');
      } else {
        close();
      }
    }
  };

  return (
    <div class="modal-overlay" ref={trapRef} onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
    }}>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="create-modal-title">
        <div class="modal-header">
          <h2 id="create-modal-title">New Item</h2>
          <button class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="modal-body">
            <div class="form-field">
              <label for="title">Title *</label>
              <input
                id="title"
                type="text"
                value={title}
                onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
                placeholder="What needs to be done?"
                autoFocus
                required
              />
            </div>

            <div class="form-field">
              <label for="description">Description</label>
              <textarea
                id="description"
                value={description}
                onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
                placeholder="Details, notes, shopping lists..."
                rows={3}
              />
            </div>

            <div class="form-field">
              <label for="owner">Owner</label>
              <select
                id="owner"
                value={owner}
                onChange={(e) => setOwner((e.target as HTMLSelectElement).value)}
              >
                <option value="">Unassigned</option>
                {owners.value.map(o => (
                  <option key={o.name} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>

            <div class="form-field">
              <label for="due-date">Due Date</label>
              <input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate((e.target as HTMLInputElement).value)}
              />
              <QuickDateChips value={dueDate} onChange={setDueDate} />
            </div>

            <div class="form-field">
              <label for="scheduled-date">Scheduled Date</label>
              <input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate((e.target as HTMLInputElement).value)}
              />
              <QuickDateChips value={scheduledDate} onChange={setScheduledDate} />
              <span class="form-hint">When you plan to do this</span>
            </div>

            <div class="form-field">
              <label>Labels</label>
              <LabelPickerManager
                currentLabels={selectedLabels.join(', ')}
                onToggle={toggleLabel}
                token={token!}
              />
            </div>

            <div class="form-field subtasks-section">
              <label>
                Sub-tasks{subtasks.length > 0 && ` (${subtasks.length})`}
              </label>

              {subtasks.length > 0 && (
                <ul class="staged-subtasks" role="list">
                  {subtasks.map((s, i) => (
                    <li key={i} class="staged-subtask">
                      <span class="staged-subtask-title">{s.title}</span>
                      {s.owner && <span class="staged-subtask-owner">{s.owner}</span>}
                      <button
                        type="button"
                        class="btn-icon staged-subtask-remove"
                        onClick={() => removeSubtask(i)}
                        aria-label={`Remove sub-task: ${s.title}`}
                      >✕</button>
                    </li>
                  ))}
                </ul>
              )}

              <div class="subtask-input-row">
                <input
                  ref={subtaskInputRef}
                  id="subtask-title"
                  type="text"
                  value={subtaskInput}
                  onInput={(e) => setSubtaskInput((e.target as HTMLInputElement).value)}
                  onKeyDown={handleSubtaskKeyDown}
                  placeholder="Sub-task title..."
                />
                <button
                  type="button"
                  class="btn btn-ghost"
                  onClick={addSubtask}
                  disabled={!subtaskInput.trim()}
                >Add</button>
              </div>
              <span class="form-hint">Enter to add · Esc to clear</span>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" onClick={close}>Cancel</button>
            <button type="submit" class="btn btn-primary" disabled={!title.trim()}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
