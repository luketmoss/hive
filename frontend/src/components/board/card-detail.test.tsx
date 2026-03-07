import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor, act } from '@testing-library/preact';
import { CardDetail } from './card-detail';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';
import { deleteItem, createItem } from '../../state/actions';
import { showToast } from '../../state/board-store';

afterEach(() => {
  cleanup();
});

// Track selectedItemId state for assertions
let mockSelectedItemId: string | null = 'detail-test-1';
let mockChildren: any[] = [];
let mockItems: any[] = [];

vi.mock('../../state/board-store', () => ({
  selectedItemId: {
    get value() { return mockSelectedItemId; },
    set value(v: string | null) { mockSelectedItemId = v; },
  },
  selectedItem: {
    get value() {
      if (!mockSelectedItemId) return null;
      return {
        id: mockSelectedItemId,
        title: 'Test Item',
        description: 'A test description',
        status: 'To Do',
        owner: 'Luke',
        due_date: '',
        scheduled_date: '',
        labels: '',
        parent_id: '',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        completed_at: '',
        sort_order: 1,
        created_by: 'luke@example.com',
        sheetRow: 2,
      };
    },
  },
  childrenOfSelected: {
    get value() { return mockChildren; },
  },
  items: {
    get value() { return mockItems; },
  },
  owners: { value: [{ name: 'Luke', google_account: 'luke@example.com' }, { name: 'Sarah', google_account: 'sarah@example.com' }] },
  labels: { value: [{ label: 'Urgent', color: '#ff0000' }] },
  showToast: vi.fn(),
}));

const mockUpdateItem = vi.fn().mockResolvedValue(true);
const mockMoveItem = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  updateItem: (...args: any[]) => mockUpdateItem(...args),
  deleteItem: vi.fn(),
  deleteSubtask: vi.fn(),
  createItem: vi.fn(),
  moveItem: (...args: any[]) => mockMoveItem(...args),
  reorderSubtasks: vi.fn(),
}));

const mockAuth: AuthState = {
  token: 'test-token',
  user: { name: 'Luke', email: 'luke@example.com', picture: '' },
  isAuthenticated: true,
  login: () => {},
  logout: () => {},
};

function renderCardDetail() {
  return render(
    <AuthContext.Provider value={mockAuth}>
      <CardDetail />
    </AuthContext.Provider>
  );
}

describe('CardDetail save feedback (Issue #11)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
    mockChildren = [];
    mockItems = [];
    mockUpdateItem.mockReset().mockResolvedValue(true);
    mockMoveItem.mockReset().mockResolvedValue(true);
  });

  // AC3: Inline save feedback on card field changes
  describe('AC3: Inline save feedback on successful save', () => {
    it('shows "Saved" indicator after editing a text field successfully', async () => {
      const { container } = renderCardDetail();

      // Click on the Title field to enter edit mode
      const titleField = container.querySelector('.detail-field') as HTMLElement;
      fireEvent.click(titleField);

      // Type a new value
      const input = container.querySelector('.detail-field input[type="text"]') as HTMLInputElement;
      expect(input).not.toBeNull();
      fireEvent.input(input, { target: { value: 'Updated Title' } });

      // Blur to commit
      await act(async () => {
        fireEvent.blur(input);
      });

      // Wait for the "Saved" indicator to appear
      await waitFor(() => {
        const indicator = container.querySelector('[data-testid="save-indicator"]');
        expect(indicator).not.toBeNull();
        expect(indicator!.textContent).toBe('Saved');
      });
    });

    it('shows "Saved" indicator after changing owner select', async () => {
      const { container } = renderCardDetail();

      // Find the Owner select
      const selects = container.querySelectorAll('select');
      // Owner is the second select (Status is first)
      const ownerSelect = selects[1] as HTMLSelectElement;
      expect(ownerSelect).not.toBeNull();

      await act(async () => {
        fireEvent.change(ownerSelect, { target: { value: 'Luke' } });
      });

      await waitFor(() => {
        const indicators = container.querySelectorAll('[data-testid="save-indicator"]');
        expect(indicators.length).toBeGreaterThan(0);
      });
    });

    it('shows "Saved" indicator after toggling a label', async () => {
      const { container } = renderCardDetail();

      // Find the label toggle button
      const labelBtn = container.querySelector('.label-toggle') as HTMLElement;
      expect(labelBtn).not.toBeNull();

      await act(async () => {
        fireEvent.click(labelBtn);
      });

      await waitFor(() => {
        const indicators = container.querySelectorAll('[data-testid="save-indicator"]');
        expect(indicators.length).toBeGreaterThan(0);
      });
    });
  });

  // AC4: Save feedback on error
  describe('AC4: Save feedback on error — field reverts', () => {
    it('shows error indicator and reverts text field on save failure', async () => {
      mockUpdateItem.mockResolvedValue(false);

      const { container } = renderCardDetail();

      // Click on the Title field to enter edit mode
      const titleField = container.querySelector('.detail-field') as HTMLElement;
      fireEvent.click(titleField);

      // Type a new value
      const input = container.querySelector('.detail-field input[type="text"]') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Bad Title' } });

      // Blur to commit
      await act(async () => {
        fireEvent.blur(input);
      });

      // Wait for error indicator
      await waitFor(() => {
        const indicator = container.querySelector('[data-testid="save-indicator-error"]');
        expect(indicator).not.toBeNull();
        expect(indicator!.textContent).toBe('Error');
      });

      // The displayed value should revert to original
      const editableValue = container.querySelector('.editable-value');
      expect(editableValue?.textContent).toBe('Test Item');
    });

    it('shows error indicator on owner select save failure', async () => {
      mockUpdateItem.mockResolvedValue(false);

      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('select');
      const ownerSelect = selects[1] as HTMLSelectElement;

      await act(async () => {
        fireEvent.change(ownerSelect, { target: { value: '' } });
      });

      await waitFor(() => {
        const indicator = container.querySelector('[data-testid="save-indicator-error"]');
        expect(indicator).not.toBeNull();
      });
    });
  });
});

describe('CardDetail keyboard accessibility (Issue #6)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
    mockChildren = [];
    mockItems = [];
    mockUpdateItem.mockReset().mockResolvedValue(true);
    mockMoveItem.mockReset().mockResolvedValue(true);
  });

  // AC3: Detail panel traps focus
  describe('AC3: Detail panel traps focus', () => {
    it('renders with role="dialog" and aria-modal="true"', () => {
      const { container } = renderCardDetail();
      const overlay = container.querySelector('.detail-overlay') as HTMLElement;
      expect(overlay).not.toBeNull();
      expect(overlay.getAttribute('role')).toBe('dialog');
      expect(overlay.getAttribute('aria-modal')).toBe('true');
    });

    it('focuses the first focusable element when opened', () => {
      const { container } = renderCardDetail();
      // The close button in the header should be the first focusable element
      const closeBtn = container.querySelector('.detail-header .btn-ghost') as HTMLElement;
      expect(document.activeElement).toBe(closeBtn);
    });

    it('wraps focus from last to first element on Tab', () => {
      const { container } = renderCardDetail();
      const overlay = container.querySelector('.detail-overlay') as HTMLElement;

      // Get all focusable elements
      const focusable = overlay.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      expect(focusable.length).toBeGreaterThan(1);

      // Focus the last element
      const lastEl = focusable[focusable.length - 1];
      lastEl.focus();
      expect(document.activeElement).toBe(lastEl);

      // Press Tab — should wrap to first
      fireEvent.keyDown(overlay, { key: 'Tab' });
      expect(document.activeElement).toBe(focusable[0]);
    });

    it('wraps focus from first to last element on Shift+Tab', () => {
      const { container } = renderCardDetail();
      const overlay = container.querySelector('.detail-overlay') as HTMLElement;

      const focusable = overlay.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      expect(focusable.length).toBeGreaterThan(1);

      // Focus the first element
      const firstEl = focusable[0];
      firstEl.focus();
      expect(document.activeElement).toBe(firstEl);

      // Press Shift+Tab — should wrap to last
      fireEvent.keyDown(overlay, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(focusable[focusable.length - 1]);
    });
  });

  // AC4: Escape closes the detail panel
  describe('AC4: Escape closes the detail panel', () => {
    it('closes the panel when Escape is pressed', () => {
      const { container } = renderCardDetail();
      const overlay = container.querySelector('.detail-overlay') as HTMLElement;

      expect(mockSelectedItemId).toBe('detail-test-1');
      fireEvent.keyDown(overlay, { key: 'Escape' });
      expect(mockSelectedItemId).toBeNull();
    });
  });

  // AC5: Focus returns to triggering element
  describe('AC5: Focus returns to triggering element', () => {
    it('sets selectedItemId to null on close, enabling focus restoration', () => {
      // Create a card element in the DOM that can receive focus
      const cardEl = document.createElement('div');
      cardEl.setAttribute('data-item-id', 'detail-test-1');
      cardEl.setAttribute('tabindex', '0');
      document.body.appendChild(cardEl);

      const { container } = renderCardDetail();
      const overlay = container.querySelector('.detail-overlay') as HTMLElement;

      // Close via Escape
      fireEvent.keyDown(overlay, { key: 'Escape' });

      // selectedItemId should be cleared
      expect(mockSelectedItemId).toBeNull();

      // Clean up
      document.body.removeChild(cardEl);
    });

    it('close button triggers panel close', () => {
      renderCardDetail();
      const closeBtn = document.querySelector('.detail-header .btn-ghost') as HTMLElement;
      expect(closeBtn).not.toBeNull();

      fireEvent.click(closeBtn);
      expect(mockSelectedItemId).toBeNull();
    });

    it('overlay click triggers panel close', () => {
      const { container } = renderCardDetail();
      const overlay = container.querySelector('.detail-overlay') as HTMLElement;

      // Click directly on the overlay (not the panel)
      fireEvent.click(overlay);
      expect(mockSelectedItemId).toBeNull();
    });
  });
});

describe('CardDetail inline dialogs (Issue #9)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
    mockChildren = [];
    mockItems = [];
    vi.clearAllMocks();
  });

  // AC1: Delete confirmation is inline (not browser confirm())
  describe('AC1: Delete confirmation is inline', () => {
    it('shows inline confirmation UI when Delete is clicked instead of browser confirm()', () => {
      const { container } = renderCardDetail();

      // Click the Delete button
      const deleteBtn = container.querySelector('.detail-footer .btn-danger') as HTMLElement;
      expect(deleteBtn).not.toBeNull();
      expect(deleteBtn.textContent).toBe('Delete');
      fireEvent.click(deleteBtn);

      // Inline confirmation should appear
      const confirmInline = container.querySelector('.delete-confirm-inline') as HTMLElement;
      expect(confirmInline).not.toBeNull();
      expect(confirmInline.querySelector('.delete-confirm-text')!.textContent).toBe('Are you sure?');

      // Should have Cancel and Delete buttons
      const buttons = confirmInline.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('Cancel');
      expect(buttons[1].textContent).toBe('Delete');
    });

    it('does not call browser confirm()', () => {
      const confirmSpy = vi.spyOn(window, 'confirm');
      const { container } = renderCardDetail();

      const deleteBtn = container.querySelector('.detail-footer .btn-danger') as HTMLElement;
      fireEvent.click(deleteBtn);

      expect(confirmSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('calls deleteItem and closes panel when inline Delete is confirmed', () => {
      const { container } = renderCardDetail();

      // Click Delete to show confirmation
      const deleteBtn = container.querySelector('.detail-footer .btn-danger') as HTMLElement;
      fireEvent.click(deleteBtn);

      // Click the confirm Delete button
      const confirmBtn = container.querySelector('.delete-confirm-inline .btn-danger') as HTMLElement;
      fireEvent.click(confirmBtn);

      expect(deleteItem).toHaveBeenCalledWith('detail-test-1', 'Luke', 'test-token');
      expect(mockSelectedItemId).toBeNull();
    });
  });

  // AC2: Delete can be cancelled
  describe('AC2: Delete can be cancelled', () => {
    it('dismisses confirmation when Cancel is clicked', () => {
      const { container } = renderCardDetail();

      // Show confirmation
      const deleteBtn = container.querySelector('.detail-footer .btn-danger') as HTMLElement;
      fireEvent.click(deleteBtn);
      expect(container.querySelector('.delete-confirm-inline')).not.toBeNull();

      // Click Cancel
      const cancelBtn = container.querySelector('.delete-confirm-inline .btn-ghost') as HTMLElement;
      fireEvent.click(cancelBtn);

      // Confirmation should be dismissed
      expect(container.querySelector('.delete-confirm-inline')).toBeNull();
      // The Delete button should be back
      expect(container.querySelector('.detail-footer .btn-danger')).not.toBeNull();
      // Item should not be deleted
      expect(deleteItem).not.toHaveBeenCalled();
    });

    it('dismisses confirmation when Escape is pressed on the confirmation area', () => {
      const { container } = renderCardDetail();

      // Show confirmation
      const deleteBtn = container.querySelector('.detail-footer .btn-danger') as HTMLElement;
      fireEvent.click(deleteBtn);

      // Press Escape on the confirmation area
      const confirmInline = container.querySelector('.delete-confirm-inline') as HTMLElement;
      fireEvent.keyDown(confirmInline, { key: 'Escape' });

      // Confirmation should be dismissed
      expect(container.querySelector('.delete-confirm-inline')).toBeNull();
      expect(deleteItem).not.toHaveBeenCalled();
    });
  });

  // AC3: Subtask creation is inline (not browser prompt())
  describe('AC3: Subtask creation is inline', () => {
    it('shows inline text input when + Add is clicked instead of browser prompt()', () => {
      const { container } = renderCardDetail();

      // Click + Add
      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      expect(addBtn).not.toBeNull();
      expect(addBtn.textContent).toBe('+ Add');
      fireEvent.click(addBtn);

      // Inline input should appear
      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('Sub-task title...');
    });

    it('does not call browser prompt()', () => {
      const promptSpy = vi.spyOn(window, 'prompt');
      const { container } = renderCardDetail();

      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      expect(promptSpy).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('hides + Add button while input is visible', () => {
      const { container } = renderCardDetail();

      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      // + Add button should be hidden
      expect(container.querySelector('.detail-subtasks-header .btn-sm')).toBeNull();
    });
  });

  // AC4: Subtask creation submits on Enter
  describe('AC4: Subtask creation submits on Enter', () => {
    it('creates subtask and closes input when Enter is pressed with text', () => {
      const { container } = renderCardDetail();

      // Open inline input
      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;

      // Type a title
      fireEvent.input(input, { target: { value: 'New subtask' } });

      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(createItem).toHaveBeenCalledWith(
        { title: 'New subtask', parent_id: 'detail-test-1', owner: 'Luke', created_by: 'luke@example.com' },
        'Luke',
        'test-token'
      );

      // Input should close
      expect(container.querySelector('.subtask-add-input')).toBeNull();
    });

    it('does not create subtask if input is empty on Enter', () => {
      const { container } = renderCardDetail();

      // Open inline input
      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;

      // Press Enter without typing
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(createItem).not.toHaveBeenCalled();
    });

    it('does not create subtask if input is whitespace-only on Enter', () => {
      const { container } = renderCardDetail();

      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
      fireEvent.input(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(createItem).not.toHaveBeenCalled();
    });
  });

  // AC5: Subtask creation cancels on Escape
  describe('AC5: Subtask creation cancels on Escape', () => {
    it('closes input without creating subtask when Escape is pressed', () => {
      const { container } = renderCardDetail();

      // Open inline input
      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Some text' } });

      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape' });

      // Input should close
      expect(container.querySelector('.subtask-add-input')).toBeNull();
      // No subtask created
      expect(createItem).not.toHaveBeenCalled();
      // + Add button should return
      expect(container.querySelector('.detail-subtasks-header .btn-sm')).not.toBeNull();
    });

    it('creation row stays open when focus moves between sibling controls', () => {
      const { container } = renderCardDetail();

      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Some text' } });

      // The owner dropdown should be rendered next to the input
      const ownerSelect = container.querySelector('.subtask-add-owner') as HTMLSelectElement;
      expect(ownerSelect).not.toBeNull();

      // Verify input is still open (focus-container pattern prevents premature close)
      expect(container.querySelector('.subtask-add-input')).not.toBeNull();
      expect(createItem).not.toHaveBeenCalled();
    });
  });
});

describe('CardDetail subtask double-submit fix (Issue #54)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
    mockChildren = [];
    mockItems = [];
    vi.clearAllMocks();
  });

  // AC1: Enter creates exactly one sub-task — guard prevents focusout re-trigger.
  // Note: @testing-library/preact's fireEvent.focusOut does not work with Preact in JSDOM
  // because 'onfocusout' is not an IDL property of elements in JSDOM 28, causing it to
  // dispatch an event with type 'FocusOut' (mixed case) which Preact's listener never sees.
  // We use dispatchEvent(new FocusEvent('focusout', ...)) to dispatch the correct event.
  it('AC1: pressing Enter creates exactly one sub-task, not two', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    const row = container.querySelector('.subtask-add-inline') as HTMLElement;

    fireEvent.input(input, { target: { value: 'Buy milk' } });
    fireEvent.keyDown(input, { key: 'Enter' }); // submits once, sets guard

    // Simulate focusout on the row — the guard (subtaskSubmittedRef) must prevent a second submit
    row.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      { title: 'Buy milk', parent_id: 'detail-test-1', owner: 'Luke', created_by: 'luke@example.com' },
      'Luke',
      'test-token'
    );
  });

  // AC2: Focusout (without Enter) submits exactly once.
  // Fire on the input so the event bubbles up to the row's onFocusOut handler.
  // submitSubtask reads subtaskTitleRef (always current) not state (stale closure).
  it('AC2: focusout submits exactly once when Enter was not pressed', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Walk the dog' } });

    // Dispatch 'focusout' on the input — it bubbles up to the row's Preact handler
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

    expect(createItem).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledWith(
      { title: 'Walk the dog', parent_id: 'detail-test-1', owner: 'Luke', created_by: 'luke@example.com' },
      'Luke',
      'test-token'
    );
  });

  // AC3: Escape sets the guard, so focusout afterwards does not create a sub-task
  it('AC3: Escape cancels and subsequent focusout does not create a sub-task', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    const row = container.querySelector('.subtask-add-inline') as HTMLElement;

    fireEvent.input(input, { target: { value: 'Should not save' } });
    fireEvent.keyDown(input, { key: 'Escape' }); // cancels, sets guard

    // Even if focusout fires, the guard prevents submission
    row.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

    expect(createItem).not.toHaveBeenCalled();
  });

  // AC4: Guard resets between sessions — second sub-task also creates exactly once
  it('AC4: adding a second sub-task after the first creates exactly one item per session', () => {
    const { container } = renderCardDetail();

    // First sub-task
    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);
    let input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'First task' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Second sub-task
    const addBtn2 = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn2);
    input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Second task' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(createItem).toHaveBeenCalledTimes(2);
    expect((createItem as ReturnType<typeof vi.fn>).mock.calls[0][0].title).toBe('First task');
    expect((createItem as ReturnType<typeof vi.fn>).mock.calls[1][0].title).toBe('Second task');
  });

  // AC5: Empty input creates no sub-task on Enter or focusout
  it('AC5: empty input does not create a sub-task on Enter', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(createItem).not.toHaveBeenCalled();
  });

  it('AC5: whitespace-only input does not create a sub-task on focusout', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '   ' } });

    const row = container.querySelector('.subtask-add-inline') as HTMLElement;
    row.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));

    expect(createItem).not.toHaveBeenCalled();
  });

  // AC6: Sub-task title input has accessible name
  it('AC6: sub-task title input has aria-label independent of placeholder', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Sub-task title');
    expect(input.getAttribute('placeholder')).toBe('Sub-task title...');
  });
});

describe('CardDetail created_by display (Issue #23)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
  });

  // AC4: Creator displayed in card detail view
  describe('AC4: Creator displayed in metadata section', () => {
    it('shows "Created by" line in the detail metadata section', () => {
      const { container } = renderCardDetail();
      const metaSection = container.querySelector('.detail-meta');
      expect(metaSection).not.toBeNull();
      const smalls = metaSection!.querySelectorAll('small');
      const createdByLine = Array.from(smalls).find(s => s.textContent?.startsWith('Created by:'));
      expect(createdByLine).not.toBeNull();
    });

    it('resolves email to display name when email matches a known owner', () => {
      // The mock item has created_by: 'luke@example.com' and
      // owners has { name: 'Luke', google_account: 'luke@example.com' }
      const { container } = renderCardDetail();
      const metaSection = container.querySelector('.detail-meta');
      const smalls = metaSection!.querySelectorAll('small');
      const createdByLine = Array.from(smalls).find(s => s.textContent?.startsWith('Created by:'));
      expect(createdByLine!.textContent).toBe('Created by: Luke');
    });
  });

  // AC5: Creator field is read-only
  describe('AC5: Creator field is read-only', () => {
    it('created_by line is not editable (no input/select in metadata)', () => {
      const { container } = renderCardDetail();
      const metaSection = container.querySelector('.detail-meta');
      const inputs = metaSection!.querySelectorAll('input, select, textarea');
      expect(inputs.length).toBe(0);
    });
  });
});

describe('CardDetail sub-task owner editing (Issue #24)', () => {
  const childTodo = {
    id: 'child-1',
    title: 'Pick up prescription',
    description: '',
    status: 'To Do' as const,
    owner: 'Luke',
    due_date: '',
    scheduled_date: '',
    labels: '',
    parent_id: 'detail-test-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    completed_at: '',
    sort_order: 1,
    created_by: '',
    sheetRow: 3,
  };

  const childInProgress = {
    ...childTodo,
    id: 'child-2',
    title: 'Buy groceries',
    status: 'In Progress' as const,
    owner: 'Sarah',
    sheetRow: 4,
    sort_order: 2,
  };

  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
    mockChildren = [childTodo, childInProgress];
    mockItems = [childTodo, childInProgress];
    mockUpdateItem.mockReset().mockResolvedValue(true);
    mockMoveItem.mockReset().mockResolvedValue(true);
    vi.mocked(showToast).mockReset();
  });

  // AC1: Sub-task owner is editable inline
  describe('AC1: Sub-task owner is editable inline', () => {
    it('renders an owner dropdown for each sub-task', () => {
      const { container } = renderCardDetail();

      const ownerSelects = container.querySelectorAll('.subtask-owner-select');
      expect(ownerSelects.length).toBe(2);
    });

    it('shows "Unassigned" plus all owners in the dropdown', () => {
      const { container } = renderCardDetail();

      const select = container.querySelector('.subtask-owner-select') as HTMLSelectElement;
      const options = Array.from(select.querySelectorAll('option'));

      expect(options.length).toBe(3); // Unassigned + Luke + Sarah
      expect(options[0].value).toBe('');
      expect(options[0].textContent).toBe('Unassigned');
      expect(options[1].value).toBe('Luke');
      expect(options[2].value).toBe('Sarah');
    });

    it('shows the current owner as the selected value', () => {
      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;
      expect(selects[0].value).toBe('Luke');
      expect(selects[1].value).toBe('Sarah');
    });

    it('has accessible label for each sub-task owner dropdown', () => {
      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;
      expect(selects[0].getAttribute('aria-label')).toBe('Owner for Pick up prescription');
      expect(selects[1].getAttribute('aria-label')).toBe('Owner for Buy groceries');
    });
  });

  // AC2: Selecting an owner saves immediately
  describe('AC2: Selecting an owner saves immediately', () => {
    it('calls updateItem with new owner when selection changes', async () => {
      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;

      await act(async () => {
        fireEvent.change(selects[0], { target: { value: 'Sarah' } });
      });

      expect(mockUpdateItem).toHaveBeenCalledWith(
        'child-1',
        { owner: 'Sarah' },
        'Luke',
        'test-token'
      );
    });
  });

  // AC3: Sub-task creation still defaults to parent's owner
  describe('AC3: Sub-task creation still defaults to parent owner', () => {
    it('creates sub-task with parent owner when + Add is used', () => {
      const { container } = renderCardDetail();

      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'New subtask' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(createItem).toHaveBeenCalledWith(
        { title: 'New subtask', parent_id: 'detail-test-1', owner: 'Luke', created_by: 'luke@example.com' },
        'Luke',
        'test-token'
      );
    });
  });

  // AC4: Sub-task can be set to "Unassigned"
  describe('AC4: Sub-task can be set to Unassigned', () => {
    it('calls updateItem with empty owner when Unassigned is selected', async () => {
      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;

      await act(async () => {
        fireEvent.change(selects[0], { target: { value: '' } });
      });

      expect(mockUpdateItem).toHaveBeenCalledWith(
        'child-1',
        { owner: '' },
        'Luke',
        'test-token'
      );
    });
  });

  // AC5: Owner change respects "In Progress requires owner" rule
  describe('AC5: Owner change respects In Progress requires owner rule', () => {
    it('shows toast error when trying to unassign an In Progress sub-task', async () => {
      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;
      // selects[1] is the "In Progress" child owned by "Sarah"

      await act(async () => {
        fireEvent.change(selects[1], { target: { value: '' } });
      });

      expect(showToast).toHaveBeenCalledWith('Cannot remove owner from In Progress items', 'error');
      expect(mockUpdateItem).not.toHaveBeenCalled();
    });

    it('reverts the select value when validation fails', async () => {
      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;

      await act(async () => {
        fireEvent.change(selects[1], { target: { value: '' } });
      });

      // The select should revert to the original value
      expect(selects[1].value).toBe('Sarah');
    });

    it('allows changing In Progress sub-task to a different owner', async () => {
      const { container } = renderCardDetail();

      const selects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;

      await act(async () => {
        fireEvent.change(selects[1], { target: { value: 'Luke' } });
      });

      expect(mockUpdateItem).toHaveBeenCalledWith(
        'child-2',
        { owner: 'Luke' },
        'Luke',
        'test-token'
      );
      expect(showToast).not.toHaveBeenCalled();
    });
  });

  // AC6: Changing parent's owner does NOT cascade to sub-tasks
  describe('AC6: Changing parent owner does NOT cascade to sub-tasks', () => {
    it('sub-task owners remain unchanged when parent owner changes', async () => {
      const { container } = renderCardDetail();

      // Change the parent's owner via the parent Owner select
      // The parent Owner select is in .detail-field, not in .subtask-item
      const detailSelects = container.querySelectorAll('.detail-field select') as NodeListOf<HTMLSelectElement>;
      // Status is first, Owner is second
      const parentOwnerSelect = detailSelects[1];

      await act(async () => {
        fireEvent.change(parentOwnerSelect, { target: { value: 'Sarah' } });
      });

      // updateItem should only be called for the parent, not for children
      expect(mockUpdateItem).toHaveBeenCalledTimes(1);
      expect(mockUpdateItem).toHaveBeenCalledWith(
        'detail-test-1',
        { owner: 'Sarah' },
        'Luke',
        'test-token'
      );

      // Sub-task owner selects should still show their original values
      const subtaskSelects = container.querySelectorAll('.subtask-owner-select') as NodeListOf<HTMLSelectElement>;
      expect(subtaskSelects[0].value).toBe('Luke');
      expect(subtaskSelects[1].value).toBe('Sarah');
    });
  });
});

describe('CardDetail Add/Cancel buttons (Issue #58)', () => {
  beforeEach(() => {
    mockSelectedItemId = 'detail-test-1';
    mockChildren = [];
    mockItems = [];
    vi.clearAllMocks();
  });

  // AC1: Add button submits the sub-task
  it('AC1: Add button creates sub-task when title is non-empty', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'New subtask via button' } });

    // Click the Add (checkmark) button
    const confirmBtn = container.querySelector('[aria-label="Add sub-task"]') as HTMLElement;
    expect(confirmBtn).not.toBeNull();
    fireEvent.click(confirmBtn);

    expect(createItem).toHaveBeenCalledWith(
      { title: 'New subtask via button', parent_id: 'detail-test-1', owner: 'Luke', created_by: 'luke@example.com' },
      'Luke',
      'test-token'
    );
    // Creation row should close
    expect(container.querySelector('.subtask-add-input')).toBeNull();
  });

  // AC2: Cancel button closes without creating
  it('AC2: Cancel button closes creation row without creating sub-task', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Should not save' } });

    // Click the Cancel (X) button
    const cancelBtn = container.querySelector('[aria-label="Cancel adding sub-task"]') as HTMLElement;
    expect(cancelBtn).not.toBeNull();
    fireEvent.click(cancelBtn);

    expect(createItem).not.toHaveBeenCalled();
    expect(container.querySelector('.subtask-add-input')).toBeNull();
    // + Add button should return
    expect(container.querySelector('.detail-subtasks-header .btn-sm')).not.toBeNull();
  });

  // AC4: Add button is disabled when input is empty
  it('AC4: Add button is disabled when input is empty', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const confirmBtn = container.querySelector('[aria-label="Add sub-task"]') as HTMLElement;
    expect(confirmBtn.getAttribute('aria-disabled')).toBe('true');

    // Clicking disabled button should not create anything
    fireEvent.click(confirmBtn);
    expect(createItem).not.toHaveBeenCalled();
    // Row should stay open
    expect(container.querySelector('.subtask-add-input')).not.toBeNull();
  });

  it('AC4: Add button becomes enabled when text is entered', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Some text' } });

    const confirmBtn = container.querySelector('[aria-label="Add sub-task"]') as HTMLElement;
    expect(confirmBtn.getAttribute('aria-disabled')).toBeNull();
  });

  // AC5: Buttons have accessible names
  it('AC5: Add and Cancel buttons have aria-label', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const confirmBtn = container.querySelector('[aria-label="Add sub-task"]');
    const cancelBtn = container.querySelector('[aria-label="Cancel adding sub-task"]');
    expect(confirmBtn).not.toBeNull();
    expect(cancelBtn).not.toBeNull();
  });

  // AC1/AC2: Button order is Add first, Cancel second
  it('Buttons are ordered: Add (left) then Cancel (right)', () => {
    const { container } = renderCardDetail();

    const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
    fireEvent.click(addBtn);

    const buttons = container.querySelectorAll('.subtask-add-inline .subtask-action-btn');
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('aria-label')).toBe('Add sub-task');
    expect(buttons[1].getAttribute('aria-label')).toBe('Cancel adding sub-task');
  });
});
