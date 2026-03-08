import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { CreateItemModal } from './create-item-modal';

afterEach(() => {
  cleanup();
});

// Mock dependencies
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({
    token: 'mock-token',
    user: { email: 'test@example.com', name: 'Test User', picture: '' },
  }),
}));

const { mockBoardStore } = vi.hoisted(() => {
  const mockBoardStore = {
    showCreateModal: { value: true },
    owners: { value: [{ name: 'Mom', google_account: 'mom@test.com' }, { name: 'Dad', google_account: 'dad@test.com' }] },
    labels: { value: [{ label: 'Urgent', color: '#ff0000' }] },
  };
  return { mockBoardStore };
});
vi.mock('../../state/board-store', () => mockBoardStore);

const mockCreateItem = vi.fn();
const mockCreateItemWithSubtasks = vi.fn();
vi.mock('../../state/actions', () => ({
  createItem: (...args: unknown[]) => mockCreateItem(...args),
  createItemWithSubtasks: (...args: unknown[]) => mockCreateItemWithSubtasks(...args),
}));

vi.mock('../labels/label-picker-manager', () => ({
  LabelPickerManager: () => <div data-testid="label-picker" />,
}));

vi.mock('../../utils/color', () => ({
  getContrastTextColor: () => '#000',
}));

beforeEach(() => {
  mockCreateItem.mockClear();
  mockCreateItemWithSubtasks.mockClear();
  mockBoardStore.showCreateModal.value = true;
});

// --- Previous AC tests (Scheduled Date — Issue #46) ---
describe('CreateItemModal — Scheduled Date (Issue #46)', () => {
  describe('AC1: Scheduled date picker present in create modal', () => {
    it('renders a Scheduled Date date input field', () => {
      const { container } = render(<CreateItemModal />);
      const input = container.querySelector('#scheduled-date') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.type).toBe('date');
    });

    it('has hint text "When you plan to do this" beneath the label', () => {
      const { container } = render(<CreateItemModal />);
      const hints = container.querySelectorAll('.form-hint');
      const scheduledHint = Array.from(hints).find(h => h.textContent === 'When you plan to do this');
      expect(scheduledHint).not.toBeNull();
    });

    it('is placed between Due Date and Labels', () => {
      const { container } = render(<CreateItemModal />);
      const fields = container.querySelectorAll('.form-field');
      const fieldLabels = Array.from(fields).map(f => {
        const label = f.querySelector('label');
        return label?.textContent?.replace(/\s*\(\d+\)/, '') || '';
      });
      const dueDateIdx = fieldLabels.indexOf('Due Date');
      const scheduledIdx = fieldLabels.indexOf('Scheduled Date');
      const labelsIdx = fieldLabels.indexOf('Labels');
      expect(scheduledIdx).toBeGreaterThan(dueDateIdx);
      expect(scheduledIdx).toBeLessThan(labelsIdx);
    });
  });

  describe('AC2: Creating an item with a scheduled date', () => {
    it('passes scheduled_date to createItem when set', () => {
      const { container } = render(<CreateItemModal />);
      const titleInput = container.querySelector('#title') as HTMLInputElement;
      const scheduledInput = container.querySelector('#scheduled-date') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(titleInput, { target: { value: 'Test task' } });
      fireEvent.change(scheduledInput, { target: { value: '2026-04-01' } });
      fireEvent.submit(form);

      expect(mockCreateItem).toHaveBeenCalledTimes(1);
      const data = mockCreateItem.mock.calls[0][0];
      expect(data.scheduled_date).toBe('2026-04-01');
    });
  });

  describe('AC3: Creating an item without a scheduled date', () => {
    it('passes empty scheduled_date when not set', () => {
      const { container } = render(<CreateItemModal />);
      const titleInput = container.querySelector('#title') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.input(titleInput, { target: { value: 'Test task' } });
      fireEvent.submit(form);

      expect(mockCreateItem).toHaveBeenCalledTimes(1);
      const data = mockCreateItem.mock.calls[0][0];
      expect(data.scheduled_date).toBe('');
    });
  });

  describe('AC5: Accessible labeling', () => {
    it('has a label with matching for/id attributes', () => {
      const { container } = render(<CreateItemModal />);
      const label = Array.from(container.querySelectorAll('label')).find(
        l => l.textContent === 'Scheduled Date'
      );
      expect(label).not.toBeNull();
      expect(label!.getAttribute('for')).toBe('scheduled-date');

      const input = container.querySelector('#scheduled-date');
      expect(input).not.toBeNull();
    });
  });
});

// --- Inline Sub-tasks (Issue #55) ---
describe('CreateItemModal — Inline Sub-tasks (Issue #55)', () => {
  function getSubtaskInput(container: Element) {
    return container.querySelector('#subtask-title') as HTMLInputElement;
  }

  function getAddButton(container: Element) {
    return Array.from(container.querySelectorAll('button')).find(
      b => b.textContent === 'Add'
    ) as HTMLButtonElement;
  }

  function addSubtaskViaEnter(container: Element, title: string) {
    const input = getSubtaskInput(container);
    fireEvent.input(input, { target: { value: title } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }

  function getStagedSubtasks(container: Element) {
    return container.querySelectorAll('.staged-subtask');
  }

  // AC1: Sub-task input section visible in create modal
  describe('AC1: Sub-task input section visible', () => {
    it('renders a Sub-tasks section with input and Add button', () => {
      const { container } = render(<CreateItemModal />);
      const section = container.querySelector('.subtasks-section');
      expect(section).not.toBeNull();

      const input = getSubtaskInput(container);
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('Sub-task title...');

      const addBtn = getAddButton(container);
      expect(addBtn).not.toBeNull();
    });

    it('shows Enter to add hint', () => {
      const { container } = render(<CreateItemModal />);
      const hints = container.querySelectorAll('.form-hint');
      const subtaskHint = Array.from(hints).find(h => h.textContent?.includes('Enter to add'));
      expect(subtaskHint).not.toBeNull();
    });

    it('shows count when sub-tasks are present', () => {
      const { container } = render(<CreateItemModal />);
      addSubtaskViaEnter(container, 'Task A');
      addSubtaskViaEnter(container, 'Task B');

      const label = container.querySelector('.subtasks-section label');
      expect(label!.textContent).toBe('Sub-tasks (2)');
    });

    it('shows no count when no sub-tasks exist', () => {
      const { container } = render(<CreateItemModal />);
      const label = container.querySelector('.subtasks-section label');
      expect(label!.textContent).toBe('Sub-tasks');
    });
  });

  // AC2: Adding multiple sub-tasks before saving
  describe('AC2: Adding multiple sub-tasks', () => {
    it('adds sub-task to list on Enter and clears input', () => {
      const { container } = render(<CreateItemModal />);
      addSubtaskViaEnter(container, 'Buy milk');

      const staged = getStagedSubtasks(container);
      expect(staged).toHaveLength(1);
      expect(staged[0].querySelector('.staged-subtask-title')!.textContent).toBe('Buy milk');

      // Input should be cleared
      const input = getSubtaskInput(container);
      expect(input.value).toBe('');
    });

    it('adds sub-task on Add button click', () => {
      const { container } = render(<CreateItemModal />);
      const input = getSubtaskInput(container);
      fireEvent.input(input, { target: { value: 'Buy eggs' } });

      const addBtn = getAddButton(container);
      fireEvent.click(addBtn);

      const staged = getStagedSubtasks(container);
      expect(staged).toHaveLength(1);
      expect(staged[0].querySelector('.staged-subtask-title')!.textContent).toBe('Buy eggs');
    });

    it('can add multiple sub-tasks', () => {
      const { container } = render(<CreateItemModal />);
      addSubtaskViaEnter(container, 'Task A');
      addSubtaskViaEnter(container, 'Task B');
      addSubtaskViaEnter(container, 'Task C');

      const staged = getStagedSubtasks(container);
      expect(staged).toHaveLength(3);
    });

    it('does not add empty/whitespace sub-tasks', () => {
      const { container } = render(<CreateItemModal />);
      addSubtaskViaEnter(container, '   ');

      const staged = getStagedSubtasks(container);
      expect(staged).toHaveLength(0);
    });
  });

  // AC3: Removing a staged sub-task
  describe('AC3: Removing a staged sub-task', () => {
    it('removes a sub-task when ✕ is clicked', () => {
      const { container } = render(<CreateItemModal />);
      addSubtaskViaEnter(container, 'Task A');
      addSubtaskViaEnter(container, 'Task B');

      const removeBtn = container.querySelector('.staged-subtask-remove') as HTMLButtonElement;
      fireEvent.click(removeBtn);

      const staged = getStagedSubtasks(container);
      expect(staged).toHaveLength(1);
      expect(staged[0].querySelector('.staged-subtask-title')!.textContent).toBe('Task B');
    });

    it('remove button has correct aria-label', () => {
      const { container } = render(<CreateItemModal />);
      addSubtaskViaEnter(container, 'Buy milk');

      const removeBtn = container.querySelector('.staged-subtask-remove') as HTMLButtonElement;
      expect(removeBtn.getAttribute('aria-label')).toBe('Remove sub-task: Buy milk');
    });
  });

  // AC4: Sub-tasks inherit parent owner
  describe('AC4: Sub-tasks inherit parent owner', () => {
    it('sub-task inherits current parent owner', () => {
      const { container } = render(<CreateItemModal />);

      // Set parent owner to Mom
      const ownerSelect = container.querySelector('#owner') as HTMLSelectElement;
      fireEvent.change(ownerSelect, { target: { value: 'Mom' } });

      addSubtaskViaEnter(container, 'Buy groceries');

      const staged = getStagedSubtasks(container);
      const ownerBadge = staged[0].querySelector('.staged-subtask-owner');
      expect(ownerBadge!.textContent).toBe('Mom');
    });

    it('changing parent owner does not retroactively change existing sub-tasks', () => {
      const { container } = render(<CreateItemModal />);

      // Set owner to Mom and add sub-task
      const ownerSelect = container.querySelector('#owner') as HTMLSelectElement;
      fireEvent.change(ownerSelect, { target: { value: 'Mom' } });
      addSubtaskViaEnter(container, 'Task from Mom');

      // Change parent owner to Dad
      fireEvent.change(ownerSelect, { target: { value: 'Dad' } });
      addSubtaskViaEnter(container, 'Task from Dad');

      const staged = getStagedSubtasks(container);
      expect(staged[0].querySelector('.staged-subtask-owner')!.textContent).toBe('Mom');
      expect(staged[1].querySelector('.staged-subtask-owner')!.textContent).toBe('Dad');
    });
  });

  // AC5: Saving parent and sub-tasks together
  describe('AC5: Saving parent and sub-tasks', () => {
    it('calls createItemWithSubtasks when sub-tasks exist', () => {
      const { container } = render(<CreateItemModal />);
      const titleInput = container.querySelector('#title') as HTMLInputElement;
      fireEvent.input(titleInput, { target: { value: 'Parent task' } });

      addSubtaskViaEnter(container, 'Child A');
      addSubtaskViaEnter(container, 'Child B');

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      expect(mockCreateItemWithSubtasks).toHaveBeenCalledTimes(1);
      expect(mockCreateItem).not.toHaveBeenCalled();

      const [data, subtasks, actor, token] = mockCreateItemWithSubtasks.mock.calls[0];
      expect(data.title).toBe('Parent task');
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].title).toBe('Child A');
      expect(subtasks[1].title).toBe('Child B');
      expect(actor).toBe('Test User');
      expect(token).toBe('mock-token');
    });

    it('closes the modal after saving', () => {
      const { container } = render(<CreateItemModal />);
      const titleInput = container.querySelector('#title') as HTMLInputElement;
      fireEvent.input(titleInput, { target: { value: 'Parent' } });
      addSubtaskViaEnter(container, 'Child');

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      expect(mockBoardStore.showCreateModal.value).toBe(false);
    });
  });

  // AC6: Keyboard-driven flow
  describe('AC6: Keyboard-driven flow', () => {
    it('Enter adds sub-task and clears input', () => {
      const { container } = render(<CreateItemModal />);
      const input = getSubtaskInput(container);
      fireEvent.input(input, { target: { value: 'Sub A' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(getStagedSubtasks(container)).toHaveLength(1);
      expect(input.value).toBe('');
    });

    it('Escape clears input when text is present', () => {
      const { container } = render(<CreateItemModal />);
      const input = getSubtaskInput(container);
      fireEvent.input(input, { target: { value: 'partial text' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input.value).toBe('');
      // Modal should still be open (stopPropagation prevents close)
      expect(mockBoardStore.showCreateModal.value).toBe(true);
    });

    it('Escape on empty input closes modal', () => {
      const { container } = render(<CreateItemModal />);
      const input = getSubtaskInput(container);
      // Input is empty
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockBoardStore.showCreateModal.value).toBe(false);
    });

    it('Enter does not add empty sub-task', () => {
      const { container } = render(<CreateItemModal />);
      const input = getSubtaskInput(container);
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(getStagedSubtasks(container)).toHaveLength(0);
    });
  });

  // AC7: Empty state — no sub-tasks required
  describe('AC7: Empty state — no sub-tasks required', () => {
    it('calls createItem (not createItemWithSubtasks) when no sub-tasks', () => {
      const { container } = render(<CreateItemModal />);
      const titleInput = container.querySelector('#title') as HTMLInputElement;
      fireEvent.input(titleInput, { target: { value: 'Solo task' } });

      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      expect(mockCreateItem).toHaveBeenCalledTimes(1);
      expect(mockCreateItemWithSubtasks).not.toHaveBeenCalled();
    });
  });

  // AC9: Modal accessibility attributes (Issue #55)
  describe('AC9: Modal accessibility attributes', () => {
    it('modal has role="dialog" and aria-modal="true"', () => {
      const { container } = render(<CreateItemModal />);
      const modal = container.querySelector('.modal');
      expect(modal!.getAttribute('role')).toBe('dialog');
      expect(modal!.getAttribute('aria-modal')).toBe('true');
    });

    it('modal has aria-labelledby pointing to the heading', () => {
      const { container } = render(<CreateItemModal />);
      const modal = container.querySelector('.modal');
      const heading = container.querySelector('h2');
      expect(heading!.id).toBe('create-modal-title');
      expect(modal!.getAttribute('aria-labelledby')).toBe('create-modal-title');
    });

    it('close button has aria-label="Close"', () => {
      const { container } = render(<CreateItemModal />);
      const closeBtn = container.querySelector('.modal-header .btn.btn-ghost') as HTMLButtonElement;
      expect(closeBtn.getAttribute('aria-label')).toBe('Close');
    });
  });
});

// --- Quick Date Shortcuts (Issue #82) ---
describe('CreateItemModal — Quick Date Shortcuts (Issue #82)', () => {
  describe('AC1: Quick date chips on create modal', () => {
    it('renders quick date chips below the due date input', () => {
      const { container } = render(<CreateItemModal />);
      const dueDateField = container.querySelector('#due-date')!.closest('.form-field')!;
      const chips = dueDateField.querySelector('.quick-date-chips');
      expect(chips).not.toBeNull();
      expect(chips!.querySelectorAll('.quick-date-chip')).toHaveLength(4);
    });

    it('renders quick date chips below the scheduled date input', () => {
      const { container } = render(<CreateItemModal />);
      const scheduledField = container.querySelector('#scheduled-date')!.closest('.form-field')!;
      const chips = scheduledField.querySelector('.quick-date-chips');
      expect(chips).not.toBeNull();
      expect(chips!.querySelectorAll('.quick-date-chip')).toHaveLength(4);
    });

    it('tapping a due date chip populates the due date input', () => {
      const { container } = render(<CreateItemModal />);
      const dueDateField = container.querySelector('#due-date')!.closest('.form-field')!;
      const todayChip = dueDateField.querySelector('.quick-date-chip') as HTMLButtonElement;
      fireEvent.click(todayChip);

      // Submitting the form should include today's date as due_date
      const titleInput = container.querySelector('#title') as HTMLInputElement;
      fireEvent.input(titleInput, { target: { value: 'Test' } });
      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(mockCreateItem.mock.calls[0][0].due_date).toBe(expected);
    });

    it('tapping a scheduled date chip populates the scheduled date input', () => {
      const { container } = render(<CreateItemModal />);
      const scheduledField = container.querySelector('#scheduled-date')!.closest('.form-field')!;
      const todayChip = scheduledField.querySelector('.quick-date-chip') as HTMLButtonElement;
      fireEvent.click(todayChip);

      const titleInput = container.querySelector('#title') as HTMLInputElement;
      fireEvent.input(titleInput, { target: { value: 'Test' } });
      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(mockCreateItem.mock.calls[0][0].scheduled_date).toBe(expected);
    });

    it('date input can still be edited manually after chip selection', () => {
      const { container } = render(<CreateItemModal />);
      const dueDateField = container.querySelector('#due-date')!.closest('.form-field')!;
      const todayChip = dueDateField.querySelector('.quick-date-chip') as HTMLButtonElement;
      fireEvent.click(todayChip);

      // Override with manual date
      const dueDateInput = container.querySelector('#due-date') as HTMLInputElement;
      fireEvent.change(dueDateInput, { target: { value: '2026-12-25' } });

      const titleInput = container.querySelector('#title') as HTMLInputElement;
      fireEvent.input(titleInput, { target: { value: 'Test' } });
      const form = container.querySelector('form') as HTMLFormElement;
      fireEvent.submit(form);

      expect(mockCreateItem.mock.calls[0][0].due_date).toBe('2026-12-25');
    });
  });
});
