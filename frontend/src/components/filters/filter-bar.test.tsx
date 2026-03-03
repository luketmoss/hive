import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';
import { FilterBar } from './filter-bar';

afterEach(() => {
  cleanup();
});

vi.mock('../../state/board-store', () => ({
  filterOwner: { value: null },
  filterLabel: { value: null },
  groupBy: { value: 'none' },
  owners: { value: [{ name: 'Luke', google_account: 'luke@example.com' }] },
  labels: { value: [{ label: 'Urgent', color: '#ff0000' }] },
}));

describe('FilterBar ARIA labels (Issue #7)', () => {
  // AC1: Filter bar selects have accessible labels
  describe('AC1: Filter bar selects have accessible labels', () => {
    it('owner select has aria-label "Filter by owner"', () => {
      const { container } = render(<FilterBar />);
      const selects = container.querySelectorAll('select');
      const ownerSelect = selects[0] as HTMLSelectElement;
      expect(ownerSelect.getAttribute('aria-label')).toBe('Filter by owner');
    });

    it('label select has aria-label "Filter by label"', () => {
      const { container } = render(<FilterBar />);
      const selects = container.querySelectorAll('select');
      const labelSelect = selects[1] as HTMLSelectElement;
      expect(labelSelect.getAttribute('aria-label')).toBe('Filter by label');
    });

    it('group-by select has aria-label "Group items by"', () => {
      const { container } = render(<FilterBar />);
      const selects = container.querySelectorAll('select');
      const groupBySelect = selects[2] as HTMLSelectElement;
      expect(groupBySelect.getAttribute('aria-label')).toBe('Group items by');
    });
  });
});
