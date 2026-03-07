import { describe, it, expect, beforeEach } from 'vitest';
import {
  boards, permissions, currentUserEmail, activeBoardId,
  accessibleBoards, userBoardRole,
} from './board-store';

describe('Board permissions (Issue #42)', () => {
  beforeEach(() => {
    boards.value = [
      { id: 'b1', name: 'Family', created_at: '', created_by: 'mom@family.com' },
      { id: 'b2', name: 'Work', created_at: '', created_by: 'dad@family.com' },
      { id: 'b3', name: 'Private', created_at: '', created_by: 'dad@family.com' },
    ];
    permissions.value = [
      { board_id: 'b1', user_email: '*', role: 'member' },
      { board_id: 'b1', user_email: 'mom@family.com', role: 'owner' },
      { board_id: 'b2', user_email: 'dad@family.com', role: 'owner' },
      { board_id: 'b2', user_email: 'mom@family.com', role: 'member' },
      { board_id: 'b3', user_email: 'dad@family.com', role: 'owner' },
    ];
  });

  describe('AC3: Board list filtered by permissions', () => {
    it('shows all boards when user has access via wildcard or direct permission', () => {
      currentUserEmail.value = 'mom@family.com';
      // Mom has: b1 (wildcard + owner), b2 (member)
      const accessible = accessibleBoards.value.map(b => b.id);
      expect(accessible).toContain('b1');
      expect(accessible).toContain('b2');
      expect(accessible).not.toContain('b3');
    });

    it('shows wildcard boards to any user', () => {
      currentUserEmail.value = 'kiddo@family.com';
      // Kiddo has: b1 (wildcard only)
      const accessible = accessibleBoards.value.map(b => b.id);
      expect(accessible).toContain('b1');
      expect(accessible).not.toContain('b2');
      expect(accessible).not.toContain('b3');
    });

    it('shows all boards when no user email is set (fallback)', () => {
      currentUserEmail.value = '';
      expect(accessibleBoards.value.length).toBe(3);
    });

    it('shows boards with direct owner permission', () => {
      currentUserEmail.value = 'dad@family.com';
      const accessible = accessibleBoards.value.map(b => b.id);
      expect(accessible).toContain('b1'); // wildcard
      expect(accessible).toContain('b2'); // owner
      expect(accessible).toContain('b3'); // owner
    });
  });

  describe('AC6: userBoardRole', () => {
    it('returns "owner" for board creator with owner permission', () => {
      currentUserEmail.value = 'mom@family.com';
      activeBoardId.value = 'b1';
      expect(userBoardRole.value).toBe('owner');
    });

    it('returns "member" for user with member permission', () => {
      currentUserEmail.value = 'mom@family.com';
      activeBoardId.value = 'b2';
      expect(userBoardRole.value).toBe('member');
    });

    it('returns "member" for wildcard-only access', () => {
      currentUserEmail.value = 'kiddo@family.com';
      activeBoardId.value = 'b1';
      expect(userBoardRole.value).toBe('member');
    });

    it('returns null when user has no access', () => {
      currentUserEmail.value = 'kiddo@family.com';
      activeBoardId.value = 'b3';
      expect(userBoardRole.value).toBeNull();
    });

    it('returns null when no user email is set', () => {
      currentUserEmail.value = '';
      activeBoardId.value = 'b1';
      expect(userBoardRole.value).toBeNull();
    });

    it('is case-insensitive for email matching', () => {
      currentUserEmail.value = 'MOM@Family.COM';
      activeBoardId.value = 'b1';
      expect(userBoardRole.value).toBe('owner');
    });
  });
});
