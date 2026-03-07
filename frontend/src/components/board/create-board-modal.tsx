import { useState, useEffect, useRef } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { showCreateBoardModal, boards } from '../../state/board-store';
import { createBoard } from '../../state/actions';

const MAX_NAME_LENGTH = 30;

export function CreateBoardModal() {
  const { token, user } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    // Store the element that had focus when modal opened
    triggerRef.current = document.activeElement;
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  const close = () => {
    showCreateBoardModal.value = false;
    // Return focus to trigger element
    if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
    }
  };

  const validate = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return 'Board name is required';
    if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
    if (boards.value.some(b => b.name.toLowerCase() === trimmed.toLowerCase())) {
      return 'A board with this name already exists';
    }
    return '';
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!token) return;

    setSubmitting(true);
    const success = await createBoard(name, user?.email || '', token);
    setSubmitting(false);

    if (success) {
      close();
    }
  };

  const handleInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setName(value);
    if (error) setError(validate(value));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) close();
      }}
      onKeyDown={handleKeyDown}
    >
      <div class="modal create-board-modal" role="dialog" aria-label="Create new board" aria-modal="true">
        <div class="modal-header">
          <h2>New Board</h2>
          <button class="btn btn-ghost" onClick={close} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="form-field">
            <label for="board-name">Board Name</label>
            <input
              id="board-name"
              ref={inputRef}
              type="text"
              value={name}
              onInput={handleInput}
              placeholder="e.g., Home Tasks"
              maxLength={MAX_NAME_LENGTH}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'board-name-error' : undefined}
            />
            <div class="board-name-meta">
              {error && (
                <span id="board-name-error" class="form-error" role="alert">{error}</span>
              )}
              <span class={`char-counter ${name.length > MAX_NAME_LENGTH ? 'char-counter-danger' : name.length > MAX_NAME_LENGTH - 5 ? 'char-counter-warning' : ''}`}>
                {name.length}/{MAX_NAME_LENGTH}
              </span>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" onClick={close}>Cancel</button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={!name.trim() || submitting}
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
