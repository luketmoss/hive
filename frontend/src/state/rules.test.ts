import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyStatusSideEffects } from './rules';
import type { Item } from '../api/types';

// #243: `applyStatusSideEffects` is duplicated by design across
// `frontend/src/state/rules.ts` and `apps-script/src/rules.js`, and CLAUDE.md
// names keeping the two in sync as an invariant. These are the first tests it
// has had on this side. `apps-script/tests/rules-parity.test.ts` asserts the
// two copies agree.

const NOW = '2026-05-01T12:00:00.000Z';
const EARLIER = '2026-04-01T09:00:00.000Z';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: '',
    due_date: '',
    labels: '',
    parent_id: '',
    created_at: EARLIER,
    updated_at: EARLIER,
    completed_at: '',
    sort_order: 1,
    created_by: '',
    board_id: 'board-1',
    ...overrides,
  };
}

describe('applyStatusSideEffects', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets completed_at when entering a terminal status', () => {
    const item = makeItem({ status: 'In Progress' });

    const result = applyStatusSideEffects(item, 'Done', true);

    expect(result.status).toBe('Done');
    expect(result.completed_at).toBe(NOW);
  });

  it('sets completed_at for a terminal column whatever it is called', () => {
    const item = makeItem({ status: 'In Progress' });

    // is_terminal drives completed_at, never the column's name (CLAUDE.md).
    const result = applyStatusSideEffects(item, 'Shipped', true);

    expect(result.status).toBe('Shipped');
    expect(result.completed_at).toBe(NOW);
  });

  it('clears completed_at when leaving a terminal status', () => {
    const item = makeItem({ status: 'Done', completed_at: EARLIER });

    const result = applyStatusSideEffects(item, 'In Progress', false);

    expect(result.status).toBe('In Progress');
    expect(result.completed_at).toBe('');
  });

  // The fixture's empty `completed_at` is the point of this case, not an
  // oversight. The rule only sees the *target* status's `is_terminal`, never
  // the one it came from, so "leaving a terminal status" and "moving between
  // two non-terminal statuses" are one code path; which branch runs is decided
  // by whether `completed_at` was already set. An item sitting in a
  // non-terminal column has none, which is the state modelled here. Populate it
  // and the value is cleared instead — see the preceding test.
  it('leaves completed_at untouched between two non-terminal statuses', () => {
    const item = makeItem({ status: 'To Do' });

    const result = applyStatusSideEffects(item, 'In Progress', false);

    expect(result.completed_at).toBe('');
  });

  it('refreshes updated_at on every move', () => {
    const cases: Array<[string, string, boolean]> = [
      ['To Do', 'In Progress', false],
      ['In Progress', 'Done', true],
      ['Done', 'To Do', false],
    ];

    for (const [from, to, isTerminal] of cases) {
      const item = makeItem({
        status: from,
        completed_at: from === 'Done' ? EARLIER : '',
      });

      const result = applyStatusSideEffects(item, to, isTerminal);

      expect(result.updated_at).toBe(NOW);
      expect(result.updated_at).not.toBe(item.updated_at);
    }
  });

  it('carries unrelated fields through untouched', () => {
    const item = makeItem({ title: 'Buy milk', owner: 'Luke', sort_order: 7 });

    const result = applyStatusSideEffects(item, 'In Progress', false);

    expect(result.title).toBe('Buy milk');
    expect(result.owner).toBe('Luke');
    expect(result.sort_order).toBe(7);
    expect(result.created_at).toBe(EARLIER);
    expect(result.id).toBe('item-1');
  });

  it('does not mutate the item it was given', () => {
    const item = makeItem({ status: 'In Progress' });

    applyStatusSideEffects(item, 'Done', true);

    expect(item.status).toBe('In Progress');
    expect(item.completed_at).toBe('');
    expect(item.updated_at).toBe(EARLIER);
  });
});
