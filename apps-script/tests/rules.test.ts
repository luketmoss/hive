import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSources, type Sandbox } from './apps-script-sandbox';

// These tests drive the real `apps-script/src/rules.js` through the sandboxed
// loader in `apps-script-sandbox.ts` (#241). Nothing here transcribes source:
// editing `rules.js` without editing this file breaks the suite.
//
// #243 deleted the `validateStatusTransition` and `validateOwnerChange` suites
// that lived here. Both functions were removed from source in #228; their
// transcribed copies survived and kept reporting coverage of deleted code.

const NOW = '2026-05-01T12:00:00.000Z';
const EARLIER = '2026-04-01T09:00:00.000Z';

/**
 * Load `utils.js` (for `isoNow`) and `rules.js` into one sandbox.
 *
 * `Date` is injected deliberately: a `node:vm` context has its own intrinsics,
 * so vitest's fake timers — which patch the host `globalThis.Date` — would not
 * otherwise reach `isoNow()`. Loading happens per test, after the clock is
 * frozen, so the injected reference is the faked one.
 */
function loadRules(): Sandbox {
  return loadSources(['utils.js', 'rules.js'], { Date: globalThis.Date });
}

interface Item {
  id: string;
  title: string;
  status: string;
  owner: string;
  parent_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  board_id: string;
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Item',
    status: 'To Do',
    owner: '',
    parent_id: '',
    created_at: EARLIER,
    updated_at: EARLIER,
    completed_at: '',
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
    const { applyStatusSideEffects } = loadRules();
    const item = makeItem({ status: 'In Progress' });

    const result = applyStatusSideEffects(item, 'Done', true);

    expect(result.status).toBe('Done');
    expect(result.completed_at).toBe(NOW);
  });

  it('sets completed_at for a terminal column whatever it is called', () => {
    const { applyStatusSideEffects } = loadRules();
    const item = makeItem({ status: 'In Progress' });

    // is_terminal drives completed_at, never the column's name (CLAUDE.md).
    const result = applyStatusSideEffects(item, 'Shipped', true);

    expect(result.status).toBe('Shipped');
    expect(result.completed_at).toBe(NOW);
  });

  it('clears completed_at when leaving a terminal status', () => {
    const { applyStatusSideEffects } = loadRules();
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
    const { applyStatusSideEffects } = loadRules();
    const item = makeItem({ status: 'To Do' });

    const result = applyStatusSideEffects(item, 'In Progress', false);

    expect(result.completed_at).toBe('');
  });

  it('refreshes updated_at on every move', () => {
    const { applyStatusSideEffects } = loadRules();

    for (const [from, to, isTerminal] of [
      ['To Do', 'In Progress', false],
      ['In Progress', 'Done', true],
      ['Done', 'To Do', false],
    ] as const) {
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
    const { applyStatusSideEffects } = loadRules();
    const item = makeItem({ title: 'Buy milk', owner: 'Luke', created_at: EARLIER });

    const result = applyStatusSideEffects(item, 'In Progress', false);

    expect(result.title).toBe('Buy milk');
    expect(result.owner).toBe('Luke');
    expect(result.created_at).toBe(EARLIER);
    expect(result.id).toBe('item-1');
  });

  it('does not mutate the item it was given', () => {
    const { applyStatusSideEffects } = loadRules();
    const item = makeItem({ status: 'In Progress' });

    applyStatusSideEffects(item, 'Done', true);

    expect(item.status).toBe('In Progress');
    expect(item.completed_at).toBe('');
    expect(item.updated_at).toBe(EARLIER);
  });
});

describe('checkParentCompletion', () => {
  it('returns null for root items', () => {
    const { checkParentCompletion } = loadRules();
    const item = makeItem({ parent_id: '' });

    expect(checkParentCompletion(item, [item])).toBeNull();
  });

  it('returns the parent ID when all siblings are Done', () => {
    const { checkParentCompletion } = loadRules();
    const child1 = makeItem({ id: 'c1', parent_id: 'parent', status: 'Done' });
    const child2 = makeItem({ id: 'c2', parent_id: 'parent', status: 'Done' });

    expect(checkParentCompletion(child1, [child1, child2])).toBe('parent');
  });

  it('returns null when some siblings are not Done', () => {
    const { checkParentCompletion } = loadRules();
    const child1 = makeItem({ id: 'c1', parent_id: 'parent', status: 'Done' });
    const child2 = makeItem({ id: 'c2', parent_id: 'parent', status: 'In Progress' });

    expect(checkParentCompletion(child1, [child1, child2])).toBeNull();
  });
});
