import { describe, it, expect } from 'vitest';
import { loadDeletePath, callDoGet, type CellValue, type Sandbox } from './apps-script-sandbox';

// #244: `deleteItem` is dry-run by default. These drive the real
// `apps-script/src/items.js` and `main.js` through the sandbox loader, with
// writable Items and Audit Log tabs behind them — the assertions are about what
// the sheet holds afterward, not about what the code says it did.
//
// Transcribing the cascade logic into this file would reproduce the #241 bug
// class that #243 removed, so nothing here reimplements it.

/** Build an Items row (14 columns) from the fields a test cares about. */
function itemRow(fields: { id: string; title?: string; parent_id?: string }): CellValue[] {
  return [
    fields.id,
    fields.title ?? 'Item ' + fields.id,
    '', // description
    'To Do',
    '', // owner
    '', // due_date
    '', // labels
    fields.parent_id ?? '',
    '', // created_at
    '', // updated_at
    '', // completed_at
    0, // sort_order
    '', // created_by
    'board-1',
  ];
}

//   root
//   ├── child-a
//   │   └── grandchild
//   └── child-b
//   loner (unrelated, must survive)
function tree(): CellValue[][] {
  return [
    itemRow({ id: 'root', title: 'Root' }),
    itemRow({ id: 'child-a', title: 'Child A', parent_id: 'root' }),
    itemRow({ id: 'grandchild', title: 'Grandchild', parent_id: 'child-a' }),
    itemRow({ id: 'child-b', title: 'Child B', parent_id: 'root' }),
    itemRow({ id: 'loner', title: 'Loner' }),
  ];
}

interface CascadeEntry {
  id: string;
  title: string;
  parent_id: string;
  depth: number;
}

interface DeleteResult {
  dry_run: boolean;
  root: { id: string; title: string } | null;
  count: number;
  items: CascadeEntry[];
  token: string;
}

function idsIn(rows: CellValue[][]): string[] {
  return rows.map((r) => String(r[0]));
}

function preview(sandbox: Sandbox, id: string): DeleteResult {
  return sandbox.deleteItem(id, 'test') as DeleteResult;
}

describe('deleteItem dry run (AC1)', () => {
  it('reports the whole cascade and writes nothing', () => {
    const { sandbox, itemRows, auditRows } = loadDeletePath(tree());

    const result = preview(sandbox, 'root');

    expect(result.dry_run).toBe(true);
    expect(result.count).toBe(4);
    expect(result.root).toEqual({ id: 'root', title: 'Root' });
    expect(result.token).toBeTruthy();
    expect(result.items.map((i) => i.id).sort()).toEqual(
      ['child-a', 'child-b', 'grandchild', 'root'],
    );
    // Every entry carries what the caller needs to recognise the blast radius.
    expect(result.items.find((i) => i.id === 'root')).toEqual({
      id: 'root',
      title: 'Root',
      parent_id: '',
      depth: 0,
    });
    expect(result.items.find((i) => i.id === 'grandchild')).toEqual({
      id: 'grandchild',
      title: 'Grandchild',
      parent_id: 'child-a',
      depth: 2,
    });

    expect(idsIn(itemRows)).toEqual(['root', 'child-a', 'grandchild', 'child-b', 'loner']);
    expect(auditRows).toEqual([]);
  });

  it('previews a leaf as a cascade of one', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());

    const result = preview(sandbox, 'loner');

    expect(result.count).toBe(1);
    expect(result.items.map((i) => i.id)).toEqual(['loner']);
    expect(itemRows).toHaveLength(5);
  });

  it('throws for an unknown id rather than previewing an empty cascade', () => {
    const { sandbox } = loadDeletePath(tree());
    expect(() => sandbox.deleteItem('nope', 'test')).toThrow(/not found/);
  });

  it('returns the same token for the same cascade', () => {
    const { sandbox } = loadDeletePath(tree());
    expect(preview(sandbox, 'root').token).toBe(preview(sandbox, 'root').token);
  });
});

describe('deleteItem confirm (AC2)', () => {
  it('deletes the item and every descendant when the token matches', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());
    const previewed = preview(sandbox, 'root');

    const result = sandbox.deleteItem('root', 'test', {
      confirm: true,
      token: previewed.token,
    }) as DeleteResult;

    expect(result.dry_run).toBe(false);
    expect(result.count).toBe(previewed.count);
    expect(result.items.map((i) => i.id).sort()).toEqual(
      previewed.items.map((i) => i.id).sort(),
    );
    // The unrelated item is the whole point of this assertion.
    expect(idsIn(itemRows)).toEqual(['loner']);
  });

  it('deletes a leaf without touching anything else', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());
    const previewed = preview(sandbox, 'loner');

    sandbox.deleteItem('loner', 'test', { confirm: true, token: previewed.token });

    expect(idsIn(itemRows)).toEqual(['root', 'child-a', 'grandchild', 'child-b']);
  });
});

describe('deleteItem confirm without a token (AC3)', () => {
  it('is refused, and nothing is deleted', () => {
    const { sandbox, itemRows, auditRows } = loadDeletePath(tree());

    expect(() => sandbox.deleteItem('root', 'test', { confirm: true })).toThrow(/token/i);

    expect(itemRows).toHaveLength(5);
    expect(auditRows).toEqual([]);
  });
});

describe('deleteItem drift detection (AC4)', () => {
  it('refuses a stale token when a child was added after the preview', () => {
    const { sandbox, itemRows, auditRows } = loadDeletePath(tree());
    const stale = preview(sandbox, 'root');

    // A new child appears between the preview and the confirm.
    itemRows.push(itemRow({ id: 'late', title: 'Late Arrival', parent_id: 'child-b' }));

    let thrown: (Error & { preview?: DeleteResult }) | null = null;
    try {
      sandbox.deleteItem('root', 'test', { confirm: true, token: stale.token });
    } catch (err) {
      thrown = err as Error & { preview?: DeleteResult };
    }

    expect(thrown).not.toBeNull();
    expect(thrown!.message).toMatch(/changed since the preview/i);
    expect(thrown!.preview!.count).toBe(5);
    expect(thrown!.preview!.items.map((i) => i.id)).toContain('late');
    expect(thrown!.preview!.token).not.toBe(stale.token);

    // Nothing was deleted — not even the part of the subtree that did match.
    expect(itemRows).toHaveLength(6);
    expect(auditRows).toEqual([]);

    // The fresh token from the rejection works.
    sandbox.deleteItem('root', 'test', { confirm: true, token: thrown!.preview!.token });
    expect(idsIn(itemRows)).toEqual(['loner']);
  });

  it('refuses a stale token when a descendant was removed after the preview', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());
    const stale = preview(sandbox, 'root');

    // 'grandchild' is the third data row.
    itemRows.splice(2, 1);

    expect(() =>
      sandbox.deleteItem('root', 'test', { confirm: true, token: stale.token }),
    ).toThrow(/changed since the preview/i);
    expect(itemRows).toHaveLength(4);
  });

  it('refuses a token from a different item', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());
    const otherToken = preview(sandbox, 'loner').token;

    expect(() =>
      sandbox.deleteItem('root', 'test', { confirm: true, token: otherToken }),
    ).toThrow(/changed since the preview/i);
    expect(itemRows).toHaveLength(5);
  });
});

describe('deleteItem audit trail (AC5)', () => {
  it('appends one deleted row per removed item, with the cascade root recorded', () => {
    const { sandbox, auditRows } = loadDeletePath(tree());
    const previewed = preview(sandbox, 'root');

    sandbox.deleteItem('root', 'test-actor', { confirm: true, token: previewed.token });

    // timestamp, item_id, action, field, old_value, new_value, actor
    const byId: Record<string, CellValue[]> = {};
    for (const row of auditRows) byId[String(row[1])] = row;

    expect(Object.keys(byId).sort()).toEqual(['child-a', 'child-b', 'grandchild', 'root']);
    for (const row of auditRows) {
      expect(row[2]).toBe('deleted');
      expect(row[6]).toBe('test-actor');
      expect(row[0]).toBeTruthy();
    }

    // The root keeps today's shape: title in old_value, nothing else.
    expect(byId['root'].slice(3, 6)).toEqual(['', 'Root', '']);

    // A descendant names the item the delete was called on, so the subtree can
    // be reconstructed from the log.
    expect(byId['grandchild'].slice(3, 6)).toEqual(['cascade_root', 'Grandchild', 'root']);
    expect(byId['child-b'].slice(3, 6)).toEqual(['cascade_root', 'Child B', 'root']);
  });
});

describe('deleteItem row ordering (AC6)', () => {
  it('removes exactly the subtree from a deep cascade, deepest first', () => {
    // Four levels, interleaved with unrelated rows so an off-by-one row number
    // would delete a survivor rather than silently doing the right thing.
    const rows: CellValue[][] = [
      itemRow({ id: 'keep-1' }),
      itemRow({ id: 'a', title: 'A' }),
      itemRow({ id: 'keep-2' }),
      itemRow({ id: 'b', title: 'B', parent_id: 'a' }),
      itemRow({ id: 'keep-3' }),
      itemRow({ id: 'c', title: 'C', parent_id: 'b' }),
      itemRow({ id: 'd', title: 'D', parent_id: 'c' }),
      itemRow({ id: 'keep-4' }),
    ];
    const { sandbox, itemRows } = loadDeletePath(rows);

    const previewed = preview(sandbox, 'a');
    expect(previewed.count).toBe(4);
    expect(previewed.items.map((i) => i.depth)).toEqual([0, 1, 2, 3]);

    sandbox.deleteItem('a', 'test', { confirm: true, token: previewed.token });

    expect(idsIn(itemRows)).toEqual(['keep-1', 'keep-2', 'keep-3', 'keep-4']);
  });

  it('terminates on a parent_id cycle instead of hanging', () => {
    const rows: CellValue[][] = [
      itemRow({ id: 'x', parent_id: 'y' }),
      itemRow({ id: 'y', parent_id: 'x' }),
    ];
    const { sandbox } = loadDeletePath(rows);

    const result = preview(sandbox, 'x');
    expect(result.items.map((i) => i.id)).toEqual(['x', 'y']);
  });
});

describe('deleteItem over doGet', () => {
  const KEY = 'test-key';

  it('returns the preview as data and writes nothing without confirm', () => {
    const { sandbox, itemRows, auditRows } = loadDeletePath(tree());

    const response = callDoGet<DeleteResult>(sandbox, {
      action: 'deleteItem',
      key: KEY,
      payload: JSON.stringify({ id: 'root', actor: 'agent' }),
    });

    expect(response.success).toBe(true);
    expect(response.data.dry_run).toBe(true);
    expect(response.data.count).toBe(4);
    expect(itemRows).toHaveLength(5);
    expect(auditRows).toEqual([]);
  });

  it('forwards confirm and token, and deletes the cascade', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());
    const token = callDoGet<DeleteResult>(sandbox, {
      action: 'deleteItem',
      key: KEY,
      payload: JSON.stringify({ id: 'root' }),
    }).data.token;

    const response = callDoGet<DeleteResult>(sandbox, {
      action: 'deleteItem',
      key: KEY,
      payload: JSON.stringify({ id: 'root', confirm: true, token, actor: 'agent' }),
    });

    expect(response.success).toBe(true);
    expect(response.data.dry_run).toBe(false);
    expect(idsIn(itemRows)).toEqual(['loner']);
  });

  it('returns the fresh preview alongside the error when the token is stale', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());
    const stale = callDoGet<DeleteResult>(sandbox, {
      action: 'deleteItem',
      key: KEY,
      payload: JSON.stringify({ id: 'root' }),
    }).data.token;

    itemRows.push(itemRow({ id: 'late', parent_id: 'root' }));

    const response = callDoGet<DeleteResult>(sandbox, {
      action: 'deleteItem',
      key: KEY,
      payload: JSON.stringify({ id: 'root', confirm: true, token: stale }),
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/changed since the preview/i);
    expect(response.data.dry_run).toBe(true);
    expect(response.data.count).toBe(5);
    expect(itemRows).toHaveLength(6);
  });

  it('refuses a confirm with no token', () => {
    const { sandbox, itemRows } = loadDeletePath(tree());

    const response = callDoGet<DeleteResult>(sandbox, {
      action: 'deleteItem',
      key: KEY,
      payload: JSON.stringify({ id: 'root', confirm: true }),
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/token/i);
    expect(itemRows).toHaveLength(5);
  });

  it('still requires payload.id', () => {
    const { sandbox } = loadDeletePath(tree());

    const response = callDoGet<DeleteResult>(sandbox, {
      action: 'deleteItem',
      key: KEY,
      payload: JSON.stringify({ confirm: true }),
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/payload\.id/);
  });
});
