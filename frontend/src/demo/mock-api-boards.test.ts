/**
 * Tests for mock-api board operations with color and icon (issue #74).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fetchBoards, createBoardRow, updateBoardRow } from './mock-api';
import { resetMockState } from './mock-api';
import { MOCK_BOARDS } from './mock-data';

beforeEach(() => {
  resetMockState();
});

describe('mock-api board color and icon', () => {
  it('fetchBoards returns boards with color and icon from MOCK_BOARDS', async () => {
    const boards = await fetchBoards('tok');
    const familyBoard = boards.find(b => b.id === 'board-family');
    expect(familyBoard?.color).toBe('#388e3c');
    expect(familyBoard?.icon).toBe('👨‍👩‍👧');
  });

  it('createBoardRow stores color and icon', async () => {
    await createBoardRow({
      id: 'board-test',
      name: 'Test Board',
      created_at: '',
      created_by: '',
      color: '#d32f2f',
      icon: '🎯',
    }, 'tok');

    const boards = await fetchBoards('tok');
    const b = boards.find(x => x.id === 'board-test');
    expect(b?.color).toBe('#d32f2f');
    expect(b?.icon).toBe('🎯');
  });

  it('updateBoardRow updates color and icon in memory', async () => {
    await updateBoardRow('board-family', '#d32f2f', '🎯', 'tok');

    const boards = await fetchBoards('tok');
    const b = boards.find(x => x.id === 'board-family');
    expect(b?.color).toBe('#d32f2f');
    expect(b?.icon).toBe('🎯');
  });

  it('updateBoardRow is a no-op for unknown board IDs', async () => {
    const before = await fetchBoards('tok');
    await updateBoardRow('nonexistent-board', '#fff', '❓', 'tok');
    const after = await fetchBoards('tok');
    expect(after).toEqual(before);
  });
});

describe('MOCK_BOARDS has color and icon', () => {
  it('Family Board has color and icon set', () => {
    const b = MOCK_BOARDS.find(x => x.id === 'board-family');
    expect(b?.color).toBeTruthy();
    expect(b?.icon).toBeTruthy();
  });

  it('Work Projects board has color and icon set', () => {
    const b = MOCK_BOARDS.find(x => x.id === 'board-work');
    expect(b?.color).toBeTruthy();
    expect(b?.icon).toBeTruthy();
  });
});
