import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { QuickDateChips } from './quick-date-chips';

afterEach(() => {
  cleanup();
});

describe('QuickDateChips — Issue #82', () => {
  describe('AC1: Renders chip buttons', () => {
    it('renders four quick date chips', () => {
      const { container } = render(<QuickDateChips value="" onChange={() => {}} />);
      const chips = container.querySelectorAll('.quick-date-chip');
      expect(chips).toHaveLength(4);
      expect(chips[0].textContent).toBe('Today');
      expect(chips[1].textContent).toBe('This Fri');
      expect(chips[2].textContent).toBe('Next Mon');
      expect(chips[3].textContent).toBe('Next Month');
    });

    it('has a role="group" with accessible label', () => {
      const { container } = render(<QuickDateChips value="" onChange={() => {}} />);
      const group = container.querySelector('[role="group"]');
      expect(group).not.toBeNull();
      expect(group!.getAttribute('aria-label')).toBe('Quick date shortcuts');
    });

    it('chips have type="button" to prevent form submission', () => {
      const { container } = render(<QuickDateChips value="" onChange={() => {}} />);
      const chips = container.querySelectorAll('.quick-date-chip');
      chips.forEach(chip => {
        expect((chip as HTMLButtonElement).type).toBe('button');
      });
    });
  });

  describe('AC1: Tapping a chip populates the date', () => {
    it('calls onChange with resolved date on click', () => {
      const onChange = vi.fn();
      const { container } = render(<QuickDateChips value="" onChange={onChange} />);
      const todayChip = container.querySelector('.quick-date-chip') as HTMLButtonElement;
      fireEvent.click(todayChip);

      expect(onChange).toHaveBeenCalledTimes(1);
      // Should be today's date in YYYY-MM-DD
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(onChange).toHaveBeenCalledWith(expected);
    });
  });

  describe('AC4: Active chip state', () => {
    it('highlights the matching chip when value matches a shortcut', () => {
      const today = new Date();
      const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { container } = render(<QuickDateChips value={value} onChange={() => {}} />);

      const activeChip = container.querySelector('.quick-date-chip-active');
      expect(activeChip).not.toBeNull();
      expect(activeChip!.textContent).toBe('Today');
      expect(activeChip!.getAttribute('aria-pressed')).toBe('true');
    });

    it('no chip is active when value does not match any shortcut', () => {
      const { container } = render(<QuickDateChips value="2099-12-25" onChange={() => {}} />);
      const active = container.querySelector('.quick-date-chip-active');
      expect(active).toBeNull();
    });

    it('non-active chips have aria-pressed="false"', () => {
      const { container } = render(<QuickDateChips value="" onChange={() => {}} />);
      const chips = container.querySelectorAll('.quick-date-chip');
      chips.forEach(chip => {
        expect(chip.getAttribute('aria-pressed')).toBe('false');
      });
    });

    it('tapping active chip clears the date', () => {
      const onChange = vi.fn();
      const today = new Date();
      const value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { container } = render(<QuickDateChips value={value} onChange={onChange} />);

      const activeChip = container.querySelector('.quick-date-chip-active') as HTMLButtonElement;
      fireEvent.click(activeChip);

      expect(onChange).toHaveBeenCalledWith('');
    });
  });
});
