import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor, act } from '@testing-library/preact';
import { CardDetail } from './card-detail';
import { AuthContext } from '../../auth/auth-context';
import type { AuthState } from '../../auth/auth-context';
import { deleteItem, createItem } from '../../state/actions';

afterEach(() => {
  cleanup();
});

// Track selectedItemId state for assertions
let mockSelectedItemId: string | null = 'detail-test-1';

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
        sheetRow: 2,
      };
    },
  },
  childrenOfSelected: { value: [] },
  items: { value: [] },
  owners: { value: [{ name: 'Luke', google_account: 'luke@example.com' }] },
  labels: { value: [{ label: 'Urgent', color: '#ff0000' }] },
}));

const mockUpdateItem = vi.fn().mockResolvedValue(true);
const mockMoveItem = vi.fn().mockResolvedValue(true);

vi.mock('../../state/actions', () => ({
  updateItem: (...args: any[]) => mockUpdateItem(...args),
  deleteItem: vi.fn(),
  createItem: vi.fn(),
  moveItem: (...args: any[]) => mockMoveItem(...args),
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
        { title: 'New subtask', parent_id: 'detail-test-1', owner: 'Luke' },
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

    it('closes input without creating subtask on blur', () => {
      const { container } = renderCardDetail();

      const addBtn = container.querySelector('.detail-subtasks-header .btn-sm') as HTMLElement;
      fireEvent.click(addBtn);

      const input = container.querySelector('.subtask-add-input') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Some text' } });

      // Blur the input (clicking away)
      fireEvent.blur(input);

      // Input should close
      expect(container.querySelector('.subtask-add-input')).toBeNull();
      expect(createItem).not.toHaveBeenCalled();
    });
  });
});
