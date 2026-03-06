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

vi.mock('../../state/board-store', () => ({
  showCreateModal: { value: true },
  owners: { value: [{ name: 'Luke', google_account: 'luke@test.com' }] },
  labels: { value: [{ label: 'Urgent', color: '#ff0000' }] },
}));

const mockCreateItem = vi.fn();
vi.mock('../../state/actions', () => ({
  createItem: (...args: unknown[]) => mockCreateItem(...args),
}));

vi.mock('../labels/label-picker-manager', () => ({
  LabelPickerManager: () => <div data-testid="label-picker" />,
}));

vi.mock('../../utils/color', () => ({
  getContrastTextColor: () => '#000',
}));

beforeEach(() => {
  mockCreateItem.mockClear();
});

describe('CreateItemModal — Scheduled Date (Issue #46)', () => {
  // AC1: Scheduled date picker present in create modal
  describe('AC1: Scheduled date picker present in create modal', () => {
    it('renders a Scheduled Date date input field', () => {
      const { container } = render(<CreateItemModal />);
      const input = container.querySelector('#scheduled-date') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.type).toBe('date');
    });

    it('has hint text "When you plan to do this" beneath the label', () => {
      const { container } = render(<CreateItemModal />);
      const hint = container.querySelector('.form-hint');
      expect(hint).not.toBeNull();
      expect(hint!.textContent).toBe('When you plan to do this');
    });

    it('is placed between Due Date and Labels', () => {
      const { container } = render(<CreateItemModal />);
      const fields = container.querySelectorAll('.form-field');
      const fieldLabels = Array.from(fields).map(f => {
        const label = f.querySelector('label');
        return label?.textContent || '';
      });
      const dueDateIdx = fieldLabels.indexOf('Due Date');
      const scheduledIdx = fieldLabels.indexOf('Scheduled Date');
      const labelsIdx = fieldLabels.indexOf('Labels');
      expect(scheduledIdx).toBeGreaterThan(dueDateIdx);
      expect(scheduledIdx).toBeLessThan(labelsIdx);
    });
  });

  // AC2: Creating an item with a scheduled date
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

  // AC3: Creating an item without a scheduled date
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

  // AC5: Accessible labeling
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
