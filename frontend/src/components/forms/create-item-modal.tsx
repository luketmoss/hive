import { useState } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showCreateModal, owners, labels as labelsStore } from '../../state/board-store';
import { createItem } from '../../state/actions';
import { getContrastTextColor } from '../../utils/color';

export function CreateItemModal() {
  const { token, user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const close = () => { showCreateModal.value = false; };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!title.trim() || !token) return;

    createItem(
      {
        title: title.trim(),
        description,
        owner,
        due_date: dueDate,
        labels: selectedLabels.join(', '),
      },
      user?.name || 'web',
      token
    );
    close();
  };

  const toggleLabel = (label: string) => {
    setSelectedLabels(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  return (
    <div class="modal-overlay" onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
    }}>
      <div class="modal">
        <div class="modal-header">
          <h2>New Item</h2>
          <button class="btn btn-ghost" onClick={close}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
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
          </div>

          <div class="form-field">
            <label>Labels</label>
            <div class="label-picker">
              {labelsStore.value.map(l => (
                <button
                  key={l.label}
                  type="button"
                  class={`label-toggle ${selectedLabels.includes(l.label) ? 'label-toggle-active' : ''}`}
                  style={{ '--label-color': l.color, '--label-text-color': getContrastTextColor(l.color) } as any}
                  onClick={() => toggleLabel(l.label)}
                >
                  {l.label}
                </button>
              ))}
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
