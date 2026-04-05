import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { selectedItemId, selectedItem, childrenOfSelected, items, owners, labels as labelsStore, showToast, openDetailWithTitleEdit, accessibleBoards, activeBoardId, showMoveToBoardModal, boardStatuses, isTerminalStatus, defaultStatusName, terminalStatusName } from '../../state/board-store';
import { updateItem, deleteItem, deleteSubtask, createItem, moveItem, reorderSubtasks } from '../../state/actions';
import { LabelBadge } from '../shared/label-badge';
import { LabelPickerManager } from '../labels/label-picker-manager';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { getContrastTextColor } from '../../utils/color';
// QuickDateChips removed in #220 follow-up — native date picker only
import type { ItemStatus, ItemWithRow } from '../../api/types';

// #220: Map status colors to theme-aware CSS variables (same as column.tsx)
const COLOR_TO_CSS_VAR: Record<string, string> = {
  '#e3f2fd': 'var(--color-todo)',
  '#fff3e0': 'var(--color-inprogress)',
  '#e8f5e9': 'var(--color-done)',
  '#e8eaf6': 'var(--color-col-indigo)',
  '#f3e5f5': 'var(--color-col-purple)',
  '#fce4ec': 'var(--color-col-pink)',
  '#e0f2f1': 'var(--color-col-teal)',
  '#fff8e1': 'var(--color-col-amber)',
};

function resolveColumnColor(color?: string): string {
  if (!color) return 'var(--color-bg)';
  return COLOR_TO_CSS_VAR[color] || color;
}

// #220: Owner avatar initials + deterministic colors
const OWNER_COLORS = ['#e65100', '#1976d2', '#2e7d32', '#7b1fa2', '#c62828', '#00838f', '#4e342e', '#455a64'];

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getOwnerColor(index: number): string {
  return OWNER_COLORS[index % OWNER_COLORS.length];
}

// #220: Due date relative label
function getRelativeDateLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const today = new Date(new Date().toDateString());
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 7) return `In ${diff} days`;
  return '';
}

export function CardDetail() {
  const { token, user } = useAuth();
  const item = selectedItem.value;
  if (!item) return null;

  const actor = user?.name || 'web';
  const children = childrenOfSelected.value;

  // #220: Flat list — incomplete first, then divider, then done
  const incompleteChildren = children.filter(c => !isTerminalStatus(c.status));
  const doneChildren = children.filter(c => isTerminalStatus(c.status));

  // #206: Expand/collapse panel state
  const [expanded, setExpanded] = useState(false);
  // Reset expanded state when item changes (AC4)
  useEffect(() => {
    setExpanded(false);
  }, [item.id]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskDueDate, setSubtaskDueDate] = useState('');
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
    setSubtaskDueDate('');
    // Focus the input after render
    requestAnimationFrame(() => {
      subtaskInputRef.current?.focus();
    });
  };

  /** Create the subtask from current input state. Returns true if created. */
  const doCreateSubtask = (): boolean => {
    const trimmed = subtaskTitleRef.current.trim();
    if (trimmed && token) {
      const newSubtask: Record<string, string> = { title: trimmed, parent_id: item.id, owner: '', created_by: user?.email || '' };
      if (subtaskDueDate) newSubtask.due_date = subtaskDueDate;
      createItem(newSubtask, actor, token);
      return true;
    }
    return false;
  };

  /** #208: Enter path — create subtask and keep the add row open for the next one. */
  const submitAndContinue = () => {
    if (subtaskSubmittedRef.current) return;
    subtaskSubmittedRef.current = true;
    const created = doCreateSubtask();
    // Clear input but keep the add row open
    setSubtaskTitle('');
    subtaskTitleRef.current = '';
    setSubtaskDueDate('');
    subtaskSubmittedRef.current = false;
    if (created) {
      requestAnimationFrame(() => subtaskInputRef.current?.focus());
    }
  };

  /** Focusout / confirm button path — create subtask and close the add row. */
  const submitSubtask = () => {
    if (subtaskSubmittedRef.current) return;
    subtaskSubmittedRef.current = true;
    doCreateSubtask();
    setAddingSubtask(false);
    setSubtaskTitle('');
    subtaskTitleRef.current = '';
    setSubtaskDueDate('');
    // Return focus to the "+ Add" trigger button after the row unmounts (#58 AC1/AC3)
    requestAnimationFrame(() => addSubtaskBtnRef.current?.focus());
  };

  const cancelSubtask = () => {
    subtaskSubmittedRef.current = true; // prevent focusout from submitting on cancel
    setAddingSubtask(false);
    setSubtaskTitle('');
    subtaskTitleRef.current = '';
    setSubtaskDueDate('');
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
    // #220: Reorder within incomplete children only
    const reorderList = incompleteChildren;
    const idx = reorderList.findIndex(c => c.id === childId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= reorderList.length) return;
    reorderSubtasks(reorderList[idx].id, reorderList[swapIdx].id, actor, token);
  };

  // #116: Per-subtask title editing
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskDraft, setEditingSubtaskDraft] = useState('');

  const startEditSubtaskTitle = (childId: string, currentTitle: string) => {
    setEditingSubtaskId(childId);
    setEditingSubtaskDraft(currentTitle);
  };

  const commitSubtaskTitleEdit = async (childId: string) => {
    const trimmed = editingSubtaskDraft.trim();
    setEditingSubtaskId(null);
    if (!trimmed) {
      // AC5: Empty title — restore original, no save
      return;
    }
    const child = children.find(c => c.id === childId);
    if (!child || trimmed === child.title) return;
    if (!token) return;
    const ok = await updateItem(childId, { title: trimmed }, actor, token);
    if (ok) {
      showToast('Sub-task updated', 'success');
    } else {
      showToast('Failed to update sub-task', 'error');
    }
  };

  const cancelSubtaskTitleEdit = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskDraft('');
  };

  // #88 AC5: Touch-friendly sub-task reorder
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const touchDragRef = useRef<{
    childId: string;
    startIdx: number;
    targetIdx: number;
    startY: number;
    listEl: HTMLElement;
    rowHeight: number;
    childIds: string[];
  } | null>(null);

  const handleTouchReorderStart = (childId: string, idx: number, e: TouchEvent) => {
    const handle = e.currentTarget as HTMLElement;
    const li = handle.closest('.subtask-item') as HTMLElement;
    const list = li.closest('.subtask-list') as HTMLElement;
    const rowHeight = li.getBoundingClientRect().height + 4; // gap

    li.classList.add('subtask-dragging');

    touchDragRef.current = {
      childId,
      startIdx: idx,
      targetIdx: idx,
      startY: e.touches[0].clientY,
      listEl: list,
      rowHeight,
      childIds: incompleteChildren.map(c => c.id),
    };
  };

  const handleTouchReorderMove = (e: TouchEvent) => {
    const drag = touchDragRef.current;
    if (!drag) return;
    e.preventDefault();

    const deltaY = e.touches[0].clientY - drag.startY;
    const items = Array.from(drag.listEl.querySelectorAll('.subtask-item')) as HTMLElement[];

    // Visual transform on dragged item
    if (items[drag.startIdx]) {
      items[drag.startIdx].style.transform = `translateY(${deltaY}px)`;
      items[drag.startIdx].style.position = 'relative';
      items[drag.startIdx].style.zIndex = '10';
    }

    // Calculate target position
    const offset = Math.round(deltaY / drag.rowHeight);
    drag.targetIdx = Math.max(0, Math.min(items.length - 1, drag.startIdx + offset));

    // Show drop indicator
    items.forEach((el, i) => {
      if (i === drag.startIdx) return;
      el.classList.toggle('subtask-drop-target', i === drag.targetIdx);
    });
  };

  const handleTouchReorderEnd = () => {
    const drag = touchDragRef.current;
    if (!drag) return;

    // Clean up DOM styles
    const items = Array.from(drag.listEl.querySelectorAll('.subtask-item')) as HTMLElement[];
    items.forEach(el => {
      el.style.transform = '';
      el.style.position = '';
      el.style.zIndex = '';
      el.classList.remove('subtask-dragging');
      el.classList.remove('subtask-drop-target');
    });

    const { startIdx, targetIdx, childIds } = drag;
    touchDragRef.current = null;

    if (startIdx === targetIdx || !token) return;

    // Perform sequential adjacent swaps
    const ids = [...childIds];
    const step = targetIdx > startIdx ? 1 : -1;
    for (let i = startIdx; i !== targetIdx; i += step) {
      reorderSubtasks(ids[i], ids[i + step], actor, token);
      [ids[i], ids[i + step]] = [ids[i + step], ids[i]];
    }

    setReorderAnnouncement(`Sub-task moved to position ${targetIdx + 1}`);
    setTimeout(() => setReorderAnnouncement(''), 3000);
  };

  // --- Move to Board ---
  // AC6: Hidden for subtasks. AC7: Hidden when only one accessible board.
  const isSubtask = !!item.parent_id;
  const otherBoards = accessibleBoards.value.filter(b => b.id !== activeBoardId.value);
  const showMoveToBoard = !isSubtask && otherBoards.length > 0;

  const toggleChildStatus = (childId: string, currentStatus: ItemStatus) => {
    if (!token) return;
    const newStatus: ItemStatus = isTerminalStatus(currentStatus) ? defaultStatusName() : terminalStatusName();
    moveItem(childId, newStatus, actor, token);
  };

  const handleSubtaskDateSave = async (childId: string, field: 'due_date', value: string) => {
    if (!token) return;
    await updateItem(childId, { [field]: value }, actor, token);
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
      <div class={`detail-panel${expanded ? ' detail-panel-expanded' : ''}`}>
        <div class="detail-header">
          <h2>Item Details</h2>
          <div class="detail-header-actions">
            <button
              class="btn btn-ghost detail-expand-btn"
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              onClick={() => setExpanded(!expanded)}
            >{expanded
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="10" y2="14"/><polyline points="10 20 4 20 4 14"/><line x1="20" y1="4" x2="14" y2="10"/><polyline points="14 4 20 4 20 10"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="14" y1="10" x2="20" y2="4"/><polyline points="20 10 20 4 14 4"/><line x1="10" y1="14" x2="4" y2="20"/><polyline points="4 14 4 20 10 20"/></svg>
            }</button>
            <button class="btn btn-ghost" aria-label="Close" onClick={close}>✕</button>
          </div>
        </div>

        {/* #220: Status chevron pipeline — between header and body */}
        <div class="status-pipeline" role="radiogroup" aria-label="Status">
          {boardStatuses.value.map((s, i) => {
            const activeIdx = boardStatuses.value.findIndex(bs => bs.name === item.status);
            const isActive = s.name === item.status;
            const isReached = i < activeIdx;
            const resolvedColor = resolveColumnColor(s.color);
            return (
              <button
                key={s.id}
                type="button"
                class={`status-chevron${isActive ? ' active' : ''}${isReached ? ' reached' : ''}`}
                role="radio"
                aria-checked={isActive}
                style={isActive ? { background: resolvedColor } : undefined}
                onClick={() => handleMoveStatus(s.name as ItemStatus)}
              >{s.name}</button>
            );
          })}
        </div>

        <div class="detail-body">
          <EditableField
            label="Title"
            hideLabel
            value={item.title}
            onSave={(v) => save('title', v)}
            initialEditing={openDetailWithTitleEdit.value}
            onEditStart={() => { openDetailWithTitleEdit.value = false; }}
          />

          <EditableField
            label="Description"
            hideLabel
            value={item.description}
            onSave={(v) => save('description', v)}
            multiline
          />

          <OwnerDateRow item={item} owners={owners.value} save={save} />

          <SaveFeedbackField label="Labels" hideLabel>
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

          {/* Sub-tasks (#220 redesigned) */}
          <div class="detail-subtasks">
            <div class="detail-subtasks-header">
              <label>Sub-tasks ({doneChildren.length}/{children.length})</label>
              {!addingSubtask && (
                <button ref={addSubtaskBtnRef} class="subtask-add-circle" onClick={handleAddSubtask} aria-label="Add sub-task">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                </button>
              )}
            </div>
            {(incompleteChildren.length > 0 || doneChildren.length > 0 || addingSubtask) && (
              <ul class="subtask-list">
                {incompleteChildren.map((child, idx) => (
                  <SubtaskRow
                    key={child.id}
                    child={child}
                    idx={idx}
                    allItems={incompleteChildren}
                    isDone={false}
                    editingSubtaskId={editingSubtaskId}
                    editingSubtaskDraft={editingSubtaskDraft}
                    setEditingSubtaskDraft={setEditingSubtaskDraft}
                    commitSubtaskTitleEdit={commitSubtaskTitleEdit}
                    cancelSubtaskTitleEdit={cancelSubtaskTitleEdit}
                    startEditSubtaskTitle={startEditSubtaskTitle}
                    toggleChildStatus={toggleChildStatus}
                    handleSubtaskDateSave={handleSubtaskDateSave}
                    handleDeleteSubtask={handleDeleteSubtask}
                    handleReorder={handleReorder}
                    handleTouchReorderStart={handleTouchReorderStart}
                    handleTouchReorderMove={handleTouchReorderMove}
                    handleTouchReorderEnd={handleTouchReorderEnd}
                    token={token}
                    actor={actor}
                    item={item}
                  />
                ))}
                {addingSubtask && (
                  <li class="subtask-add-li">
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
                            if (e.key === 'Enter') { e.preventDefault(); submitAndContinue(); }
                            if (e.key === 'Escape') { e.stopPropagation(); cancelSubtask(); }
                          }}
                        />
                        <input
                          type="date"
                          class="subtask-add-date"
                          value={subtaskDueDate}
                          aria-label="Due date for new sub-task"
                          onChange={(e) => setSubtaskDueDate((e.target as HTMLInputElement).value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { e.stopPropagation(); cancelSubtask(); }
                          }}
                        />
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
                      <span id="subtask-add-hint" class="subtask-add-hint">Enter to add another · Esc to cancel</span>
                    </div>
                  </li>
                )}
                {doneChildren.length > 0 && (
                  <li class="subtask-divider" aria-hidden="true">
                    <span class="subtask-divider-line"></span>
                    <span class="subtask-divider-label">completed</span>
                    <span class="subtask-divider-line"></span>
                  </li>
                )}
                {doneChildren.map((child, idx) => (
                  <SubtaskRow
                    key={child.id}
                    child={child}
                    idx={idx}
                    allItems={doneChildren}
                    isDone={true}
                    editingSubtaskId={editingSubtaskId}
                    editingSubtaskDraft={editingSubtaskDraft}
                    setEditingSubtaskDraft={setEditingSubtaskDraft}
                    commitSubtaskTitleEdit={commitSubtaskTitleEdit}
                    cancelSubtaskTitleEdit={cancelSubtaskTitleEdit}
                    startEditSubtaskTitle={startEditSubtaskTitle}
                    toggleChildStatus={toggleChildStatus}
                    handleSubtaskDateSave={handleSubtaskDateSave}
                    handleDeleteSubtask={handleDeleteSubtask}
                    handleReorder={handleReorder}
                    handleTouchReorderStart={handleTouchReorderStart}
                    handleTouchReorderMove={handleTouchReorderMove}
                    handleTouchReorderEnd={handleTouchReorderEnd}
                    token={token}
                    actor={actor}
                    item={item}
                  />
                ))}
              </ul>
            )}
            {/* #88 AC5: Announce reorder to screen readers */}
            <div class="reorder-live-region" aria-live="polite" role="status">{reorderAnnouncement}</div>
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
          <div class="detail-footer-left">
            {showMoveToBoard && (
              <button
                class="btn btn-ghost"
                aria-label="Move to board"
                onClick={() => { showMoveToBoardModal.value = true; }}
              >
                Move to board
              </button>
            )}
          </div>
          <div class="detail-footer-right">
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
    </div>
  );
}

// --- Combined owner + date row (no labels) ---

function OwnerDateRow({ item, owners: ownersList, save }: {
  item: ItemWithRow;
  owners: Array<{ name: string; google_account: string }>;
  save: (field: string, value: string) => Promise<boolean>;
}) {
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  const onSaved = (ok: boolean) => {
    setFeedback(ok ? 'saved' : 'error');
    setTimeout(() => setFeedback(null), 2000);
  };

  const dateVal = item.due_date ? item.due_date.split('T')[0] : '';
  const hasDate = !!dateVal;

  return (
    <div class="owner-date-row">
      {feedback === 'saved' && (
        <span class="save-indicator save-indicator-success owner-date-feedback" data-testid="save-indicator">Saved</span>
      )}
      {feedback === 'error' && (
        <span class="save-indicator save-indicator-error owner-date-feedback" data-testid="save-indicator-error">Error</span>
      )}
      <div class="owner-circles">
        {ownersList.map((o, i) => (
          <div key={o.name} class="owner-circle-wrapper">
            <button
              type="button"
              class={`owner-circle${item.owner === o.name ? ' active' : ''}`}
              title={o.name}
              style={{ background: getOwnerColor(i) }}
              onClick={async () => onSaved(await save('owner', o.name))}
            >{getInitials(o.name)}</button>
            <span class="owner-circle-name">{o.name.split(' ')[0]}</span>
          </div>
        ))}
        <div class="owner-circle-wrapper">
          <button
            type="button"
            class={`owner-circle${!item.owner ? ' active' : ''}`}
            title="Unassigned"
            style={{ background: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            onClick={async () => onSaved(await save('owner', ''))}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
          <span class="owner-circle-name">None</span>
        </div>
      </div>

      <div class="due-date-group">
        <button
          type="button"
          class={`due-date-btn${hasDate ? ' has-date' : ''}`}
          title={hasDate ? 'Change date' : 'Set due date'}
          onClick={() => hiddenDateRef.current?.showPicker()}
        >
          {hasDate ? (
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          )}
          <div class="date-info">
            {hasDate ? (
              <>
                <span class={`date-text${isOverdue(dateVal, item.status) ? ' due-date-overdue-text' : ''}`}>{formatCompactDate(dateVal)}</span>
                {getRelativeDateLabel(dateVal) && (
                  <span class={`date-relative${isOverdue(dateVal, item.status) ? ' due-date-overdue-text' : ''}`}>{getRelativeDateLabel(dateVal)}</span>
                )}
              </>
            ) : (
              <span class="no-date">No date</span>
            )}
          </div>
        </button>
        <input
          ref={hiddenDateRef}
          type="date"
          class="due-date-hidden"
          value={dateVal}
          onChange={async (e) => onSaved(await save('due_date', (e.target as HTMLInputElement).value))}
        />
      </div>
    </div>
  );
}

// --- Save feedback wrapper for non-editable fields (selects, dates, labels) ---

function SaveFeedbackField({ label, children, hideLabel }: {
  label: string;
  children: (onFieldSaved: (success: boolean) => void) => any;
  hideLabel?: boolean;
}) {
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);

  const onFieldSaved = (success: boolean) => {
    setFeedback(success ? 'saved' : 'error');
    setTimeout(() => setFeedback(null), 2000);
  };

  return (
    <div class="detail-field">
      {!hideLabel && (
        <label>
          {label}
          {feedback === 'saved' && (
            <span class="save-indicator save-indicator-success" data-testid="save-indicator">Saved</span>
          )}
          {feedback === 'error' && (
            <span class="save-indicator save-indicator-error" data-testid="save-indicator-error">Error</span>
          )}
        </label>
      )}
      {hideLabel && feedback === 'saved' && (
        <span class="save-indicator save-indicator-success" data-testid="save-indicator">Saved</span>
      )}
      {hideLabel && feedback === 'error' && (
        <span class="save-indicator save-indicator-error" data-testid="save-indicator-error">Error</span>
      )}
      {children(onFieldSaved)}
    </div>
  );
}

// --- Inline editable field ---

function EditableField({ label, hideLabel, value, onSave, multiline, initialEditing, onEditStart }: {
  label: string;
  hideLabel?: boolean;
  value: string;
  onSave: (value: string) => Promise<boolean>;
  multiline?: boolean;
  /** When true, the field starts in edit mode on mount. */
  initialEditing?: boolean;
  /** Called once when initialEditing triggers edit mode. */
  onEditStart?: () => void;
}) {
  const [editing, setEditing] = useState(!!initialEditing);
  const [draft, setDraft] = useState(initialEditing ? value : value);
  const [feedback, setFeedback] = useState<'saved' | 'error' | null>(null);

  // Clear the signal after consuming it
  if (initialEditing && onEditStart) {
    onEditStart();
  }

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
      <div class={`detail-field${hideLabel ? ' detail-field-no-label' : ''}`} onClick={() => { setDraft(value); setEditing(true); }}>
        {!hideLabel && (
          <label>
            {label}
            {feedback === 'saved' && (
              <span class="save-indicator save-indicator-success" data-testid="save-indicator">Saved</span>
            )}
            {feedback === 'error' && (
              <span class="save-indicator save-indicator-error" data-testid="save-indicator-error">Error</span>
            )}
          </label>
        )}
        {hideLabel && feedback === 'saved' && (
          <span class="save-indicator save-indicator-success" data-testid="save-indicator">Saved</span>
        )}
        {hideLabel && feedback === 'error' && (
          <span class="save-indicator save-indicator-error" data-testid="save-indicator-error">Error</span>
        )}
        <div
          class={`editable-value${hideLabel ? (multiline ? ' editable-value-desc' : ' editable-value-title') : ''}`}
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
          {value || <span class="placeholder">{hideLabel && multiline ? 'Add a description...' : 'Click to edit'}</span>}
        </div>
      </div>
    );
  }

  return (
    <div class={`detail-field${hideLabel ? ' detail-field-no-label' : ''}`}>
      {!hideLabel && <label>{label}</label>}
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

// --- Subtask date display + inline editing (#86) ---

function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  return new Date(dateStr);
}

function formatCompactDate(dateStr: string): string {
  try {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function isOverdue(dateStr: string, status: string): boolean {
  if (!dateStr || isTerminalStatus(status)) return false;
  return parseLocalDate(dateStr) < new Date(new Date().toDateString());
}

// #220: Subtask inline date — launches native picker directly (single click)
function SubtaskDateInline({ child, onSave }: {
  child: ItemWithRow;
  onSave: (childId: string, field: 'due_date', value: string) => void;
}) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  const hasDue = !!child.due_date;
  const dueOverdue = isOverdue(child.due_date, child.status);
  const isDone = isTerminalStatus(child.status);
  const dateVal = child.due_date ? child.due_date.split('T')[0] : '';

  const openPicker = (e: Event) => {
    e.stopPropagation();
    hiddenRef.current?.showPicker();
  };

  return (
    <div class="subtask-date-wrapper">
      <input
        ref={hiddenRef}
        type="date"
        class="due-date-hidden"
        value={dateVal}
        aria-label={`Due date for ${child.title}`}
        onChange={(e) => onSave(child.id, 'due_date', (e.target as HTMLInputElement).value)}
      />
      {hasDue ? (
        <button
          class={`subtask-date-inline${dueOverdue ? ' overdue' : ''}${isDone ? ' done' : ''}`}
          title={`Due: ${formatCompactDate(child.due_date)}. Tap to change.`}
          onClick={openPicker}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {formatCompactDate(child.due_date)}
        </button>
      ) : (
        <button
          class="subtask-date-add-inline"
          aria-label={`Add due date for ${child.title}`}
          onClick={openPicker}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Add date
        </button>
      )}
    </div>
  );
}

// #220: SubtaskRow component — handles checkbox, title, date, actions, context menu
function SubtaskRow({ child, idx, allItems, isDone, editingSubtaskId, editingSubtaskDraft, setEditingSubtaskDraft, commitSubtaskTitleEdit, cancelSubtaskTitleEdit, startEditSubtaskTitle, toggleChildStatus, handleSubtaskDateSave, handleDeleteSubtask, handleReorder, handleTouchReorderStart, handleTouchReorderMove, handleTouchReorderEnd, token, actor, item }: {
  child: ItemWithRow;
  idx: number;
  allItems: ItemWithRow[];
  isDone: boolean;
  editingSubtaskId: string | null;
  editingSubtaskDraft: string;
  setEditingSubtaskDraft: (v: string) => void;
  commitSubtaskTitleEdit: (childId: string) => void;
  cancelSubtaskTitleEdit: () => void;
  startEditSubtaskTitle: (childId: string, title: string) => void;
  toggleChildStatus: (childId: string, status: any) => void;
  handleSubtaskDateSave: (childId: string, field: 'due_date', value: string) => void;
  handleDeleteSubtask: (childId: string, title: string) => void;
  handleReorder: (childId: string, dir: 'up' | 'down') => void;
  handleTouchReorderStart: (childId: string, idx: number, e: TouchEvent) => void;
  handleTouchReorderMove: (e: TouchEvent) => void;
  handleTouchReorderEnd: () => void;
  token: string | null;
  actor: string;
  item: ItemWithRow;
}) {
  const [contextMenu, setContextMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Long-press handler for touch
  const handleTouchStartLongPress = (e: TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenu(true);
    }, 500);
  };

  const handleTouchEndLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Cancel long-press on touch move (prevents conflict with drag reorder)
  const handleTouchMoveLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenuEvent = (e: Event) => {
    e.preventDefault();
    setContextMenu(true);
  };

  // Close context menu on outside click/touch (focusOut unreliable on mobile)
  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = (e: Event) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside, true);
    return () => document.removeEventListener('pointerdown', handleOutside, true);
  }, [contextMenu]);

  const handlePromoteToItem = async () => {
    if (!token) return;
    const newItem: Record<string, string> = {
      title: child.title,
      description: '',
      owner: child.owner || '',
      created_by: item.created_by || '',
    };
    if (child.due_date) newItem.due_date = child.due_date;
    await createItem(newItem, actor, token);
    await deleteSubtask(child.id, actor, token);
    setContextMenu(false);
  };

  // Auto-resize textarea
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  return (
    <li
      key={child.id}
      class={`subtask-item${isDone ? ' subtask-done' : ''}`}
      style={{ position: 'relative' }}
      draggable={!isDone && allItems.length > 1}
      onDragStart={(e) => {
        if (isDone) return;
        (e as DragEvent).dataTransfer!.effectAllowed = 'move';
        (e as DragEvent).dataTransfer!.setData('text/plain', child.id);
        (e.currentTarget as HTMLElement).classList.add('subtask-dragging');
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).classList.remove('subtask-dragging');
        document.querySelectorAll('.subtask-drop-target').forEach(el => el.classList.remove('subtask-drop-target'));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        (e as DragEvent).dataTransfer!.dropEffect = 'move';
        (e.currentTarget as HTMLElement).classList.add('subtask-drop-target');
      }}
      onDragLeave={(e) => {
        (e.currentTarget as HTMLElement).classList.remove('subtask-drop-target');
      }}
      onDrop={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove('subtask-drop-target');
        const draggedId = (e as DragEvent).dataTransfer!.getData('text/plain');
        if (draggedId && draggedId !== child.id) {
          const fromIdx = allItems.findIndex(i => i.id === draggedId);
          if (fromIdx !== -1) {
            const dir = fromIdx < idx ? 'down' : 'up';
            const steps = Math.abs(fromIdx - idx);
            for (let s = 0; s < steps; s++) handleReorder(draggedId, dir);
          }
        }
      }}
      onContextMenu={handleContextMenuEvent}
      onTouchStart={(e) => {
        handleTouchStartLongPress(e as unknown as TouchEvent);
        if (!isDone && allItems.length > 1) handleTouchReorderStart(child.id, idx, e as unknown as TouchEvent);
      }}
      onTouchMove={(e) => { handleTouchMoveLongPress(); handleTouchReorderMove(e as unknown as TouchEvent); }}
      onTouchEnd={() => { handleTouchEndLongPress(); handleTouchReorderEnd(); }}
      onTouchCancel={() => { handleTouchEndLongPress(); handleTouchReorderEnd(); }}
    >
      {/* Rounded square checkbox */}
      <button class="check-icon" onClick={() => toggleChildStatus(child.id, child.status)} aria-label={child.title}>
        <span class={`check-box${isTerminalStatus(child.status) ? ' checked' : ''}`}>
          {isTerminalStatus(child.status) && (
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          )}
        </span>
      </button>

      {/* Content column: title + date */}
      <div class="subtask-content">
        {editingSubtaskId === child.id ? (
          <textarea
            class="subtask-title-input"
            value={editingSubtaskDraft}
            aria-label="Edit sub-task title"
            autoFocus
            rows={1}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement;
              setEditingSubtaskDraft(el.value);
              autoResize(el);
            }}
            onBlur={() => commitSubtaskTitleEdit(child.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitSubtaskTitleEdit(child.id); }
              if (e.key === 'Escape') { e.stopPropagation(); cancelSubtaskTitleEdit(); }
            }}
            ref={(el) => { if (el) autoResize(el); }}
          />
        ) : (
          <span
            class="subtask-title"
            role="button"
            tabIndex={0}
            aria-label={`Edit sub-task: ${child.title}`}
            onClick={() => startEditSubtaskTitle(child.id, child.title)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startEditSubtaskTitle(child.id, child.title);
              }
            }}
          >{child.title}</span>
        )}
        <SubtaskDateInline child={child} onSave={handleSubtaskDateSave} />
      </div>

      {/* Kebab menu (always visible) */}
      <button
        class="subtask-kebab-btn"
        aria-label="Sub-task options"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setContextMenu(!contextMenu); }}
      >&#8942;</button>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextRef}
          class="subtask-context-menu"
        >
          <button onClick={handlePromoteToItem}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
            Turn into item
          </button>
          <button class="danger" onClick={() => { handleDeleteSubtask(child.id, child.title); setContextMenu(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
