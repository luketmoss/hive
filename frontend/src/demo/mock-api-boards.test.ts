/**
 * Tests for mock-api board operations with icon (issue #74).
 * Board color has been removed — only icon is supported.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fetchBoards, createBoardRow, updateBoardRow } from './mock-api';
import { resetMockState } from './mock-api';
import { MOCK_BOARDS } from './mock-data';

beforeEach(() => {
  resetMockState();
});

describe('mock-api board icon', () => {
  it('fetchBoards returns boards with icon from MOCK_BOARDS', async () => {
    const boards = await fetchBoards('tok');
    const familyBoard = boards.find(b => b.id === 'board-family');
    expect(familyBoard?.icon).toBe('👨‍👩‍👧');
  });

  it('board has no color property', async () => {
    const boards = await fetchBoards('tok');
    const familyBoard = boards.find(b => b.id === 'board-family');
    expect(familyBoard).not.toHaveProperty('color');
  });

  it('createBoardRow stores icon', async () => {
    await createBoardRow({
      id: 'board-test',
      name: 'Test Board',
      created_at: '',
      created_by: '',
      icon: '🎯',
    }, 'tok');

    const boards = await fetchBoards('tok');
    const b = boards.find(x => x.id === 'board-test');
    expect(b?.icon).toBe('🎯');
  });

  it('updateBoardRow updates icon in memory', async () => {
    await updateBoardRow('board-family', '', '🎯', 'tok');

    const boards = await fetchBoards('tok');
    const b = boards.find(x => x.id === 'board-family');
    expect(b?.icon).toBe('🎯');
  });

  it('updateBoardRow is a no-op for unknown board IDs', async () => {
    const before = await fetchBoards('tok');
    await updateBoardRow('nonexistent-board', '', '❓', 'tok');
    const after = await fetchBoards('tok');
    expect(after).toEqual(before);
  });
});

describe('MOCK_BOARDS has icon', () => {
  it('Family Board has icon set', () => {
    const b = MOCK_BOARDS.find(x => x.id === 'board-family');
    expect(b?.icon).toBeTruthy();
    expect(b).not.toHaveProperty('color');
  });

  it('Work Projects board has icon set', () => {
    const b = MOCK_BOARDS.find(x => x.id === 'board-work');
    expect(b?.icon).toBeTruthy();
    expect(b).not.toHaveProperty('color');
  });
});
