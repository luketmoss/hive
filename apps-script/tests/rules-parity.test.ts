import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadSources } from './apps-script-sandbox';
import { applyStatusSideEffects as frontendApply } from '../../frontend/src/state/rules';
import type { Item } from '../../frontend/src/api/types';

// #243 / AC4: `applyStatusSideEffects` is duplicated by design across
// `apps-script/src/rules.js` and `frontend/src/state/rules.ts`. CLAUDE.md names
// keeping the two in sync as an invariant, but nothing enforced it — until this.
//
// The same inputs go through both implementations and the results must match.
// Changing one file without the other fails this suite, which turns the
// convention into something checked.
//
// It lives in the Apps Script suite because the sandbox loader is here and the
// frontend copy is an ordinary ES module that imports anywhere; the criterion
// is the assertion, not its address.

const NOW = '2026-05-01T12:00:00.000Z';
const EARLIER = '2026-04-01T09:00:00.000Z';

/**
 * The Apps Script copy, loaded from real source. `Date` is injected because a
 * `node:vm` context has its own intrinsics, which vitest's fake timers do not
 * reach — without it the two sides would be read off two different clocks.
 */
function loadAppsScriptApply() {
  const sandbox = loadSources(['utils.js', 'rules.js'], { Date: globalThis.Date });
  return sandbox.applyStatusSideEffects as (
    item: Item,
    newStatus: string,
    isTerminal: boolean,
  ) => Item;
}

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    title: 'Test Item',
    description: '',
    status: 'To Do',
    owner: 'Luke',
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

/** Every case both copies must agree on. */
const CASES: Array<{ name: string; item: Item; newStatus: string; isTerminal: boolean }> = [
  {
    name: 'entering a terminal status',
    item: makeItem({ status: 'In Progress' }),
    newStatus: 'Done',
    isTerminal: true,
  },
  {
    name: 'entering a terminal status named something else',
    item: makeItem({ status: 'In Progress' }),
    newStatus: 'Shipped',
    isTerminal: true,
  },
  {
    name: 'reopening — leaving a terminal status',
    item: makeItem({ status: 'Done', completed_at: EARLIER }),
    newStatus: 'To Do',
    isTerminal: false,
  },
  {
    name: 'moving between two non-terminal statuses',
    item: makeItem({ status: 'To Do' }),
    newStatus: 'In Progress',
    isTerminal: false,
  },
  {
    name: 'a terminal-to-terminal move',
    item: makeItem({ status: 'Done', completed_at: EARLIER }),
    newStatus: 'Cancelled',
    isTerminal: true,
  },
];

describe('applyStatusSideEffects parity: apps-script/src/rules.js vs frontend/src/state/rules.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  for (const { name, item, newStatus, isTerminal } of CASES) {
    it(`agrees on ${name}`, () => {
      const appsScriptApply = loadAppsScriptApply();

      const fromAppsScript = appsScriptApply({ ...item }, newStatus, isTerminal);
      const fromFrontend = frontendApply({ ...item }, newStatus, isTerminal);

      expect(fromAppsScript).toEqual(fromFrontend);
    });
  }

  it('agrees on the fields the rule is actually about', () => {
    const appsScriptApply = loadAppsScriptApply();

    for (const { item, newStatus, isTerminal } of CASES) {
      const a = appsScriptApply({ ...item }, newStatus, isTerminal);
      const f = frontendApply({ ...item }, newStatus, isTerminal);

      expect([a.status, a.updated_at, a.completed_at]).toEqual([
        f.status,
        f.updated_at,
        f.completed_at,
      ]);
    }
  });
});
