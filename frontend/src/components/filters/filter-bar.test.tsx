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

  // AC8: Keyboard accessible with aria-pressed
  describe('AC8: Keyboard accessible with aria-pressed', () => {
    it('inactive filter chips have aria-pressed="false"', () => {
      const { container } = render(<FilterBar />);
      const ownerGroup = container.querySelector('[aria-label="Filter by owner"]')!;
      const chips = ownerGroup.querySelectorAll('button.filter-chip');
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

describe('Group-by chip toggles (Issue #77)', () => {
  // AC1: Group-by rendered as chip toggles
  describe('AC1: Group-by rendered as chip toggles', () => {
    it('renders "Owner" and "Label" group chips (not a select)', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const chips = groupSection.querySelectorAll('button.filter-chip');
      expect(chips.length).toBe(2);
      expect(chips[0].textContent).toBe('Owner');
      expect(chips[1].textContent).toBe('Label');
    });

    it('renders no <select> element', () => {
      const { container } = render(<FilterBar />);
      expect(container.querySelectorAll('select').length).toBe(0);
    });

    it('group chips use filter-chip-group-by modifier class', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const chips = groupSection.querySelectorAll('button.filter-chip-group-by');
      expect(chips.length).toBe(2);
    });

    it('renders "Group:" label prefix', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const label = groupSection.querySelector('.filter-chip-group-label');
      expect(label).not.toBeNull();
      expect(label!.textContent).toBe('Group:');
    });
  });

  // AC2: Single-click toggle activates grouping
  describe('AC2: Single-click toggle activates grouping', () => {
    it('clicking "Owner" group chip sets groupBy to "owner"', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const ownerChip = groupSection.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      fireEvent.click(ownerChip);
      expect(mockGroupBy.value).toBe('owner');
    });

    it('active group chip has filter-chip-active class', () => {
      mockGroupBy.value = 'owner';
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const ownerChip = groupSection.querySelectorAll('button.filter-chip')[0];
      expect(ownerChip.classList.contains('filter-chip-active')).toBe(true);
    });
  });

  // AC3: Clicking active group chip deselects grouping
  describe('AC3: Clicking active group chip deselects grouping', () => {
    it('clicking the active group chip resets groupBy to "none"', () => {
      mockGroupBy.value = 'owner';
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const ownerChip = groupSection.querySelectorAll('button.filter-chip')[0] as HTMLElement;
      fireEvent.click(ownerChip);
      expect(mockGroupBy.value).toBe('none');
    });

    it('deselected chip loses filter-chip-active class', () => {
      mockGroupBy.value = 'none';
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const ownerChip = groupSection.querySelectorAll('button.filter-chip')[0];
      expect(ownerChip.classList.contains('filter-chip-active')).toBe(false);
    });
  });

  // AC4: Only one group chip active at a time (radio behavior)
  describe('AC4: Only one group chip active at a time (radio behavior)', () => {
    it('clicking Label while Owner is active switches to label grouping', () => {
      mockGroupBy.value = 'owner';
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const labelChip = groupSection.querySelectorAll('button.filter-chip')[1] as HTMLElement;
      fireEvent.click(labelChip);
      expect(mockGroupBy.value).toBe('label');
    });

    it('only the active group chip has filter-chip-active', () => {
      mockGroupBy.value = 'label';
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const chips = groupSection.querySelectorAll('button.filter-chip');
      expect(chips[0].classList.contains('filter-chip-active')).toBe(false); // Owner
      expect(chips[1].classList.contains('filter-chip-active')).toBe(true);  // Label
    });
  });

  // AC5: Accessibility — keyboard navigation and ARIA
  describe('AC5: Accessibility — keyboard navigation and ARIA', () => {
    it('group chips are in a container with role="group" and aria-label="Group by"', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[role="group"][aria-label="Group by"]');
      expect(groupSection).not.toBeNull();
    });

    it('inactive group chips have aria-pressed="false"', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const chips = groupSection.querySelectorAll('button.filter-chip');
      chips.forEach(chip => {
        expect(chip.getAttribute('aria-pressed')).toBe('false');
      });
    });

    it('active group chip has aria-pressed="true"', () => {
      mockGroupBy.value = 'owner';
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const ownerChip = groupSection.querySelectorAll('button.filter-chip')[0];
      expect(ownerChip.getAttribute('aria-pressed')).toBe('true');
    });
  });

  // AC7: Visual separator between filter and group sections
  describe('AC7: Visual separator between filter and group sections', () => {
    it('group chip section has separator class for extra gap', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]');
      expect(groupSection!.classList.contains('filter-chip-group-separator')).toBe(true);
    });
  });

  // AC8: Distinct active style for group chips
  describe('AC8: Distinct active style for group chips', () => {
    it('group chips use filter-chip-group-by class (not filter-chip-owner)', () => {
      const { container } = render(<FilterBar />);
      const groupSection = container.querySelector('[aria-label="Group by"]')!;
      const chips = groupSection.querySelectorAll('button.filter-chip');
      chips.forEach(chip => {
        expect(chip.classList.contains('filter-chip-group-by')).toBe(true);
        expect(chip.classList.contains('filter-chip-owner')).toBe(false);
      });
    });
  });

  // AC9: Clear/Reset button includes grouping
  describe('AC9: Clear/Reset button includes grouping', () => {
    it('shows "Clear filters" when only filters are active', () => {
      mockFilterOwner.value = 'Luke';
      const { container } = render(<FilterBar />);
      const btn = container.querySelector('.btn-ghost');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toBe('Clear filters');
    });

    it('shows "Reset all" when grouping is active', () => {
      mockGroupBy.value = 'owner';
      const { container } = render(<FilterBar />);
      const btn = container.querySelector('.btn-ghost');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toBe('Reset all');
    });

    it('shows "Reset all" when both filters and grouping are active', () => {
      mockFilterOwner.value = 'Luke';
      mockGroupBy.value = 'owner';
      const { container } = render(<FilterBar />);
      const btn = container.querySelector('.btn-ghost');
      expect(btn!.textContent).toBe('Reset all');
    });

    it('hides button when no filters or grouping are active', () => {
      const { container } = render(<FilterBar />);
      const btn = container.querySelector('.btn-ghost');
      expect(btn).toBeNull();
    });

    it('clicking Reset all clears filters and grouping', () => {
      mockFilterOwner.value = 'Luke';
      mockFilterLabel.value = 'Urgent';
      mockGroupBy.value = 'owner';
      const { container } = render(<FilterBar />);
      const btn = container.querySelector('.btn-ghost') as HTMLElement;
      fireEvent.click(btn);
      expect(mockFilterOwner.value).toBeNull();
      expect(mockFilterLabel.value).toBeNull();
      expect(mockGroupBy.value).toBe('none');
    });

    it('clicking Clear filters resets only filters (grouping stays none)', () => {
      mockFilterOwner.value = 'Luke';
      mockGroupBy.value = 'none';
      const { container } = render(<FilterBar />);
      const btn = container.querySelector('.btn-ghost') as HTMLElement;
      fireEvent.click(btn);
      expect(mockFilterOwner.value).toBeNull();
      expect(mockGroupBy.value).toBe('none');
    });
  });
});
