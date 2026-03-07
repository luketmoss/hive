import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/preact';
import { FilterBar } from './filter-bar';

const { mockFilterOwner, mockFilterLabel, mockGroupBy, mockOwners, mockLabels } = vi.hoisted(() => ({
  mockFilterOwner: { value: null as string | null },
  mockFilterLabel: { value: null as string | null },
  mockGroupBy: { value: 'none' },
  mockOwners: { value: [
    { name: 'Luke', google_account: 'luke@example.com' },
    { name: 'Sarah', google_account: 'sarah@example.com' },
  ]},
  mockLabels: { value: [
    { label: 'Urgent', color: '#ff0000' },
    { label: 'Home', color: '#00cc00' },
  ]},
}));

vi.mock('../../state/board-store', () => ({
  filterOwner: mockFilterOwner,
  filterLabel: mockFilterLabel,
  groupBy: mockGroupBy,
  owners: mockOwners,
  labels: mockLabels,
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockFilterOwner.value = null;
  mockFilterLabel.value = null;
  mockGroupBy.value = 'none';
});

describe('FilterBar chip redesign (Issue #28)', () => {
  // AC1: Owner filter rendered as chips
  describe('AC1: Owner filter rendered as chips', () => {
    it('renders each owner as a button chip (not a select)', () => {
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const chips = ownerGroup.querySelectorAll('button.filter-chip');
      expect(chips.length).toBe(2);
      expect(chips[0].textContent).toBe('Luke');
      expect(chips[1].textContent).toBe('Sarah');
    });

    it('tapping an owner chip filters to that owner', () => {
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const lukeChip = ownerGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      fireEvent.click(lukeChip);
      expect(mockFilterOwner.value).toBe('Luke');
    });

    it('tapping the active owner chip deselects it', () => {
      mockFilterOwner.value = 'Luke';
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const lukeChip = ownerGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      fireEvent.click(lukeChip);
      expect(mockFilterOwner.value).toBeNull();
    });
  });

  // AC2: Label filter rendered as colored chips
  describe('AC2: Label filter rendered as colored chips', () => {
    it('renders each label as a button chip', () => {
      const { container } = render(<FilterBar />);
      const labelGroup = container.querySelector('[aria-label="Filter by label"]')!;
      const chips = labelGroup.querySelectorAll('button.filter-chip');
      expect(chips.length).toBe(2);
      expect(chips[0].textContent).toBe('Urgent');
      expect(chips[1].textContent).toBe('Home');
    });

    it('label chips have the label color as CSS variable', () => {
      const { container } = render(<FilterBar />);
      const labelGroup = container.querySelector('[aria-label="Filter by label"]')!;
      const urgentChip = labelGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      expect(urgentChip.style.getPropertyValue('--label-color')).toBe('#ff0000');
    });

    it('tapping a label chip filters to that label', () => {
      const { container } = render(<FilterBar />);
      const labelGroup = container.querySelector('[aria-label="Filter by label"]')!;
      const urgentChip = labelGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      fireEvent.click(urgentChip);
      expect(mockFilterLabel.value).toBe('Urgent');
    });

    it('tapping the active label chip deselects it', () => {
      mockFilterLabel.value = 'Urgent';
      const { container } = render(<FilterBar />);
      const labelGroup = container.querySelector('[aria-label="Filter by label"]')!;
      const urgentChip = labelGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      fireEvent.click(urgentChip);
      expect(mockFilterLabel.value).toBeNull();
    });
  });

  // AC3: Combined owner + label filtering
  describe('AC3: Combined owner + label filtering', () => {
    it('allows selecting both an owner and a label simultaneously', () => {
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const labelGroup = container.querySelector('[aria-label="Filter by label"]')!;

      fireEvent.click(ownerGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement);
      fireEvent.click(labelGroup.querySelectorAll('button.filter-chip')[0] as HTMLElement);

      expect(mockFilterOwner.value).toBe('Luke');
      expect(mockFilterLabel.value).toBe('Urgent');
    });
  });

  // AC4: Active chips are visually distinct
  describe('AC4: Active chips are visually distinct', () => {
    it('active owner chip has filter-chip-active class', () => {
      mockFilterOwner.value = 'Luke';
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const lukeChip = ownerGroup.querySelectorAll('button.filter-chip')[0];
      expect(lukeChip.classList.contains('filter-chip-active')).toBe(true);
    });

    it('inactive owner chip does not have filter-chip-active class', () => {
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const lukeChip = ownerGroup.querySelectorAll('button.filter-chip')[0];
      expect(lukeChip.classList.contains('filter-chip-active')).toBe(false);
    });

    it('shows Clear filters button when a filter is active', () => {
      mockFilterOwner.value = 'Luke';
      const { container } = render(<FilterBar />);
      const clearBtn = container.querySelector('.btn-ghost');
      expect(clearBtn).not.toBeNull();
      expect(clearBtn!.textContent).toContain('Clear filters');
    });

    it('hides Clear filters button when no filters are active', () => {
      const { container } = render(<FilterBar />);
      const clearBtn = container.querySelector('.btn-ghost');
      expect(clearBtn).toBeNull();
    });
  });

  // AC5: Clear filters resets all chips
  describe('AC5: Clear filters resets all chips', () => {
    it('clicking Clear filters resets owner and label', () => {
      mockFilterOwner.value = 'Luke';
      mockFilterLabel.value = 'Urgent';
      const { container } = render(<FilterBar />);
      const clearBtn = container.querySelector('.btn-ghost') as HTMLElement;
      fireEvent.click(clearBtn);
      expect(mockFilterOwner.value).toBeNull();
      expect(mockFilterLabel.value).toBeNull();
    });
  });

  // AC6: Group-by remains a dropdown
  describe('AC6: Group-by remains a dropdown', () => {
    it('renders a single select for group-by', () => {
      const { container } = render(<FilterBar />);
      const selects = container.querySelectorAll('select');
      expect(selects.length).toBe(1);
      expect(selects[0].getAttribute('aria-label')).toBe('Group items by');
    });
  });

  // AC8: Keyboard accessible with aria-pressed
  describe('AC8: Keyboard accessible with aria-pressed', () => {
    it('inactive chips have aria-pressed="false"', () => {
      const { container } = render(<FilterBar />);
      const chips = container.querySelectorAll('button.filter-chip');
      chips.forEach(chip => {
        expect(chip.getAttribute('aria-pressed')).toBe('false');
      });
    });

    it('active owner chip has aria-pressed="true"', () => {
      mockFilterOwner.value = 'Luke';
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const lukeChip = ownerGroup.querySelectorAll('button.filter-chip')[0];
      expect(lukeChip.getAttribute('aria-pressed')).toBe('true');
    });

    it('active label chip has aria-pressed="true"', () => {
      mockFilterLabel.value = 'Urgent';
      const { container } = render(<FilterBar />);
      const labelGroup = container.querySelector('[aria-label="Filter by label"]')!;
      const urgentChip = labelGroup.querySelectorAll('button.filter-chip')[0];
      expect(urgentChip.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // AC9: Filter groups are labeled for screen readers
  describe('AC9: Filter groups are labeled for screen readers', () => {
    it('owner chips are wrapped in role="group" with aria-label', () => {
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[role="group"][aria-label="Filter by owner"]');
      expect(ownerGroup).not.toBeNull();
    });

    it('label chips are wrapped in role="group" with aria-label', () => {
      const { container } = render(<FilterBar />);
      const labelGroup = container.querySelector('[role="group"][aria-label="Filter by label"]');
      expect(labelGroup).not.toBeNull();
    });

    it('visible "Owner:" prefix is present', () => {
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const label = ownerGroup.querySelector('.filter-chip-group-label');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe('Owner:');
    });

    it('visible "Label:" prefix is present', () => {
      const { container } = render(<FilterBar />);
      const labelGroup = container.querySelector('[aria-label="Filter by label"]')!;
      const label = labelGroup.querySelector('.filter-chip-group-label');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe('Label:');
    });
  });
});
