import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { useAuth } from '../../auth/auth-context';
import { selectedItemId, selectedItem, childrenOfSelected, items, owners, labels as labelsStore, showToast, openDetailWithTitleEdit, accessibleBoards, activeBoardId, showMoveToBoardModal } from '../../state/board-store';
import { updateItem, deleteItem, deleteSubtask, createItem, moveItem, reorderSubtasks } from '../../state/actions';
import { validateOwnerChange } from '../../state/rules';
import { LabelBadge } from '../shared/label-badge';
import { LabelPickerManager } from '../labels/label-picker-manager';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { getContrastTextColor } from '../../utils/color';
import { QuickDateChips } from '../shared/quick-date-chips';
import type { ItemStatus, ItemWithRow } from '../../api/types';

export function CardDetail() {
  const { token, user } = useAuth();
  const item = selectedItem.value;
  if (!item) return null;

  const actor = user?.name || 'web';
  const children = childrenOfSelected.value;

  // #204: Collapse completed sub-items
  const allChildrenDone = children.length > 0 && children.every(c => c.status === 'Done');
  const [showCompleted, setShowCompleted] = useState(allChildrenDone);
  const prevItemId = useRef(item.id);
  useEffect(() => {
    if (prevItemId.current !== item.id) {
      prevItemId.current = item.id;
      const allDone = children.length > 0 && children.every(c => c.status === 'Done');
      setShowCompleted(allDone);
    }
  }, [item.id, children]);
  // Auto-expand when all children become done at runtime (AC2 edge case)
  useEffect(() => {
    if (allChildrenDone) setShowCompleted(true);
  }, [allChildrenDone]);

  const incompleteChildren = children.filter(c => c.status !== 'Done');
  const doneChildren = children.filter(c => c.status === 'Done');
  // When collapsed, only show incomplete; when expanded, show all
  const visibleChildren = showCompleted ? children : incompleteChildren;

  // #206: Expand/collapse panel state
  const [expanded, setExpanded] = useState(false);
  // Reset expanded state when item changes (AC4)
  useEffect(() => {
    setExpanded(false);
  }, [item.id]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [subtaskOwner, setSubtaskOwner] = useState(item.owner);
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

  const currentUserOwnerName = owners.value.find(o => o.google_account.toLowerCase() === user?.email?.toLowerCase())?.name ?? '';

  const handleAddSubtask = () => {
    subtaskSubmittedRef.current = false;
    subtaskTitleRef.current = '';
    setAddingSubtask(true);
    setSubtaskTitle('');
    setSubtaskOwner(currentUserOwnerName);
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
      const newSubtask: Record<string, string> = { title: trimmed, parent_id: item.id, owner: subtaskOwner, created_by: user?.email || '' };
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
    // #204 AC3: Reorder within visible group only when completed items are collapsed
    const reorderList = showCompleted ? children : incompleteChildren;
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
      childIds: visibleChildren.map(c => c.id),
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
          <button
            class="btn btn-ghost detail-expand-btn"
            aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
            onClick={() => setExpanded(!expanded)}
          >{expanded ? '\u2B73' : '\u2B72'}</button>
          <button class="btn btn-ghost" aria-label="Close" onClick={close}>✕</button>
        </div>

        <div class="detail-body">
          <EditableField
            label="Title"
            value={item.title}
            onSave={(v) => save('title', v)}
            initialEditing={openDetailWithTitleEdit.value}
            onEditStart={() => { openDetailWithTitleEdit.value = false; }}
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
                <div class="date-field-row">
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
                  {item.due_date && (
                    <button
                      class="btn-icon date-clear-btn"
                      aria-label="Clear due date"
                      onClick={async () => {
                        const ok = await save('due_date', '');
                        onFieldSaved(ok);
                      }}
                    >&#215;</button>
                  )}
                </div>
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
              {/* #204 AC4: Show done/total progress in header */}
              <label>Sub-tasks ({doneChildren.length}/{children.length})</label>
              {!addingSubtask && (
                <button ref={addSubtaskBtnRef} class="btn btn-sm" onClick={handleAddSubtask}>+ Add</button>
              )}
            </div>
            {visibleChildren.length > 0 && (
              <ul class="subtask-list">
                {visibleChildren.map((child, idx) => (
                  <li key={child.id} class={`subtask-item ${child.status === 'Done' ? 'subtask-done' : ''}`}>
                    {/* #88 AC5: Drag handle for touch reorder (visible on mobile only via CSS) */}
                    {visibleChildren.length > 1 && (
                      <span
                        class="subtask-drag-handle"
                        aria-label={`Drag to reorder ${child.title}`}
                        role="button"
                        tabIndex={0}
                        onTouchStart={(e) => handleTouchReorderStart(child.id, idx, e as unknown as TouchEvent)}
                        onTouchMove={(e) => handleTouchReorderMove(e as unknown as TouchEvent)}
                        onTouchEnd={handleTouchReorderEnd}
                      >&#9776;</span>
                    )}
                    <input
                      type="checkbox"
                      checked={child.status === 'Done'}
                      aria-label={child.title}
                      onChange={() => toggleChildStatus(child.id, child.status)}
                    />
                    {editingSubtaskId === child.id ? (
                      <input
                        type="text"
                        class="subtask-title-input"
                        value={editingSubtaskDraft}
                        aria-label={`Edit sub-task title`}
                        autoFocus
                        onInput={(e) => setEditingSubtaskDraft((e.target as HTMLInputElement).value)}
                        onBlur={() => commitSubtaskTitleEdit(child.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitSubtaskTitleEdit(child.id); }
                          if (e.key === 'Escape') { e.stopPropagation(); cancelSubtaskTitleEdit(); }
                        }}
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
                    <SubtaskDates child={child} onSave={handleSubtaskDateSave} />
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
                      {visibleChildren.length > 1 && (
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
                            aria-disabled={idx === visibleChildren.length - 1 ? 'true' : undefined}
                            style={idx === visibleChildren.length - 1 ? 'opacity: 0.3; cursor: not-allowed;' : undefined}
                            onClick={() => { if (idx < visibleChildren.length - 1) handleReorder(child.id, 'down'); }}
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
            {/* #204 AC2: Completed sub-items toggle */}
            {doneChildren.length > 0 && (
              <button
                class="subtask-completed-toggle"
                aria-expanded={showCompleted ? 'true' : 'false'}
                onClick={() => setShowCompleted(!showCompleted)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowCompleted(!showCompleted);
                  }
                }}
              >
                {showCompleted ? '\u25BE' : '\u25B8'} {doneChildren.length} completed
              </button>
            )}
            {/* #88 AC5: Announce reorder to screen readers */}
            <div class="reorder-live-region" aria-live="polite" role="status">{reorderAnnouncement}</div>
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
                      if (e.key === 'Enter') { e.preventDefault(); submitAndContinue(); }
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

function EditableField({ label, value, onSave, multiline, initialEditing, onEditStart }: {
  label: string;
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
  if (!dateStr || status === 'Done') return false;
  return parseLocalDate(dateStr) < new Date(new Date().toDateString());
}

function SubtaskDates({ child, onSave }: {
  child: ItemWithRow;
  onSave: (childId: string, field: 'due_date', value: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const hasDue = !!child.due_date;
  const dueOverdue = isOverdue(child.due_date, child.status);

  const handleSave = (value: string) => {
    onSave(child.id, 'due_date', value);
    setEditing(false);
  };

  if (editing) {
    const currentValue = child.due_date ? child.due_date.split('T')[0] : '';
    return (
      <span class="subtask-dates">
        <input
          type="date"
          class="subtask-date-input"
          value={currentValue}
          aria-label={`Due date for ${child.title}`}
          autoFocus
          onChange={(e) => handleSave((e.target as HTMLInputElement).value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { handleSave((e.target as HTMLInputElement).value); }
            if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
          }}
        />
      </span>
    );
  }

  // Always render the container — date badges for set dates, add-affordance buttons for unset ones.
  // Add-affordances are opacity:0 by default, revealed on subtask-item hover/focus (AC2).
  return (
    <span class="subtask-dates">
      {hasDue ? (
        <button
          class={`subtask-date-badge ${dueOverdue ? 'subtask-date-overdue' : ''}`}
          aria-label={`Due date: ${formatCompactDate(child.due_date)}${dueOverdue ? ', overdue' : ''}. Click to edit.`}
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >
          Due: {formatCompactDate(child.due_date)}
        </button>
      ) : (
        <button
          class="subtask-date-add"
          aria-label={`Add due date for ${child.title}`}
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        >
          Due +
        </button>
      )}
    </span>
  );
}
