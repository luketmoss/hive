import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/preact';

const {
  mockBoards,
  mockActiveBoardId,
  mockUserRole,
  mockSwitchBoard,
  mockShowCreateBoardModal,
  mockShowShareModal,
} = vi.hoisted(() => ({
  mockBoards: { current: [
    { id: 'b1', name: 'Work', icon: '💼', color: '#ff0000', created_at: '', created_by: '' },
    { id: 'b2', name: 'Family', icon: '', color: '', created_at: '', created_by: '' },
    { id: 'b3', name: 'Personal', icon: '🏠', color: '', created_at: '', created_by: '' },
  ] },
  mockActiveBoardId: { current: 'b1' },
  mockUserRole: { current: 'owner' as string },
  mockSwitchBoard: vi.fn(),
  mockShowCreateBoardModal: { value: false },
  mockShowShareModal: { value: false },
}));

vi.mock('../../state/board-store', () => ({
  boards: { get value() { return mockBoards.current; } },
  accessibleBoards: { get value() { return mockBoards.current; } },
  activeBoardId: { get value() { return mockActiveBoardId.current; } },
  activeBoard: { get value() { return mockBoards.current.find(b => b.id === mockActiveBoardId.current) || null; } },
  userBoardRole: { get value() { return mockUserRole.current; } },
  switchBoard: (...args: any[]) => mockSwitchBoard(...args),
  showCreateBoardModal: mockShowCreateBoardModal,
  showShareModal: mockShowShareModal,
}));

import { BoardSwitcher } from './board-switcher';

afterEach(() => {
  cleanup();
  mockSwitchBoard.mockClear();
});

beforeEach(() => {
  mockBoards.current = [
    { id: 'b1', name: 'Work', icon: '💼', color: '#ff0000', created_at: '', created_by: '' },
    { id: 'b2', name: 'Family', icon: '', color: '', created_at: '', created_by: '' },
    { id: 'b3', name: 'Personal', icon: '🏠', color: '', created_at: '', created_by: '' },
  ];
  mockActiveBoardId.current = 'b1';
  mockUserRole.current = 'owner';
});

const HINT = 'Ctrl+1–9 to switch boards · Press ? for all shortcuts';

describe('BoardSwitcher — AC1: Board option labels no longer include shortcut text', () => {
  it('option for first board shows icon + name only, no (Ctrl+1) suffix', () => {
    const { container } = render(<BoardSwitcher />);
    const options = container.querySelectorAll('option');
    const workOption = Array.from(options).find(o => o.value === 'b1');
    expect(workOption).not.toBeNull();
    expect(workOption!.textContent).toBe('💼 Work');
    expect(workOption!.textContent).not.toContain('Ctrl');
  });

  it('option for second board shows name only (no icon, no shortcut)', () => {
    const { container } = render(<BoardSwitcher />);
    const options = container.querySelectorAll('option');
    const familyOption = Array.from(options).find(o => o.value === 'b2');
    expect(familyOption).not.toBeNull();
    expect(familyOption!.textContent).toBe('Family');
    expect(familyOption!.textContent).not.toContain('Ctrl');
  });

  it('no option contains a "(Ctrl+N)" pattern', () => {
    const { container } = render(<BoardSwitcher />);
    const options = container.querySelectorAll('option');
    options.forEach(option => {
      expect(option.textContent).not.toMatch(/\(Ctrl\+\d\)/);
    });
  });
});

describe('BoardSwitcher — AC2: Select element shows shortcut hint via title', () => {
  it('select element has the correct title attribute', () => {
    const { container } = render(<BoardSwitcher />);
    const select = container.querySelector('select.board-switcher-select');
    expect(select).not.toBeNull();
    expect(select!.getAttribute('title')).toBe(HINT);
  });
});

describe('BoardSwitcher — AC3: Keyboard shortcuts behaviour (structural)', () => {
  it('renders the same number of board options regardless of shortcut removal', () => {
    const { container } = render(<BoardSwitcher />);
    // 3 boards + 1 "New Board..." option
    const options = container.querySelectorAll('option');
    expect(options.length).toBe(4);
  });

  it('board options retain correct value attributes for shortcut switching', () => {
    const { container } = render(<BoardSwitcher />);
    const b1Option = container.querySelector('option[value="b1"]');
    const b2Option = container.querySelector('option[value="b2"]');
    const b3Option = container.querySelector('option[value="b3"]');
    expect(b1Option).not.toBeNull();
    expect(b2Option).not.toBeNull();
    expect(b3Option).not.toBeNull();
  });
});

describe('BoardSwitcher — AC4: Screen readers via aria-describedby', () => {
  it('select has aria-describedby pointing to the hint span', () => {
    const { container } = render(<BoardSwitcher />);
    const select = container.querySelector('select.board-switcher-select');
    expect(select!.getAttribute('aria-describedby')).toBe('board-switcher-hint');
  });

  it('a visually-hidden span with id="board-switcher-hint" exists with hint text', () => {
    const { container } = render(<BoardSwitcher />);
    const hint = container.querySelector('#board-switcher-hint');
    expect(hint).not.toBeNull();
    expect(hint!.classList.contains('sr-only')).toBe(true);
    expect(hint!.textContent).toBe(HINT);
  });

  it('hint span contains "Ctrl+1" and "?" references', () => {
    const { container } = render(<BoardSwitcher />);
    const hint = container.querySelector('#board-switcher-hint');
    expect(hint!.textContent).toContain('Ctrl+1');
    expect(hint!.textContent).toContain('?');
  });
});

describe('BoardSwitcher — empty boards state', () => {
  it('renders New Board button when boards is empty', () => {
    mockBoards.current = [];
    const { container } = render(<BoardSwitcher />);
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('New Board');
    expect(container.querySelector('select')).toBeNull();
  });
});
