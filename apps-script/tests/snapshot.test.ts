// #294: the daily Drive snapshot. AC numbers refer to #294's Acceptance Criteria.

import { describe, it, expect } from 'vitest';
import { loadSources, makePropertiesService, makeUtilities, type Sandbox } from './apps-script-sandbox';

interface FakeFile {
  name: string;
  trashed: boolean;
}

function makeFolder(names: string[], access = 'OWNER') {
  const files: FakeFile[] = names.map((name) => ({ name, trashed: false }));
  const handle = (f: FakeFile) => ({
    getName: () => f.name,
    setTrashed(v: boolean) {
      f.trashed = v;
    },
  });
  return {
    files,
    getAccess: () => access,
    getFilesByName(name: string) {
      const hits = files.filter((f) => f.name === name && !f.trashed).map(handle);
      return { hasNext: () => hits.length > 0 };
    },
    getFiles() {
      const live = files.filter((f) => !f.trashed).map(handle);
      let i = 0;
      return { hasNext: () => i < live.length, next: () => live[i++] };
    },
  };
}

function load(opts: { folderId?: string; folder?: ReturnType<typeof makeFolder>; today?: string; triggers?: Array<{ handler: string }> } = {}) {
  const folder = opts.folder ?? makeFolder([]);
  const copies: Array<{ id: string; name: string; folder: unknown }> = [];
  const triggers = (opts.triggers ?? []).map((t) => ({ ...t }));
  const created: Array<Record<string, unknown>> = [];
  const logs: string[] = [];
  const properties: Record<string, string> = { SPREADSHEET_ID: 'sheet-id' };
  if (opts.folderId !== undefined) properties.SNAPSHOT_FOLDER_ID = opts.folderId;

  const FakeDate = class extends Date {
    constructor(...args: unknown[]) {
      super(...((args.length ? args : [opts.today ?? '2026-10-18T09:00:00Z']) as [string]));
    }
  };

  const sandbox: Sandbox = loadSources(['types.js', 'utils.js', 'snapshot.js'], {
    PropertiesService: makePropertiesService(properties),
    Utilities: makeUtilities(),
    Date: FakeDate,
    Logger: { log: (m: string) => logs.push(m) },
    Session: { getEffectiveUser: () => 'me' },
    DriveApp: {
      Permission: { OWNER: 'OWNER', EDIT: 'EDIT', VIEW: 'VIEW' },
      getFolderById(id: string) {
        if (id !== 'folder-id') throw new Error('no such folder');
        return folder;
      },
      getFileById(id: string) {
        return {
          makeCopy(name: string, into: unknown) {
            copies.push({ id, name, folder: into });
            (into as typeof folder).files.push({ name, trashed: false });
          },
        };
      },
    },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((t) => ({ getHandlerFunction: () => t.handler, ref: t })),
      deleteTrigger(t: { ref: { handler: string } }) {
        triggers.splice(triggers.indexOf(t.ref), 1);
      },
      newTrigger(handler: string) {
        const spec: Record<string, unknown> = { handler };
        const b: Record<string, (...a: unknown[]) => unknown> = {
          timeBased: () => b,
          everyDays: (n) => ((spec.everyDays = n), b),
          atHour: (h) => ((spec.atHour = h), b),
          inTimezone: (tz) => ((spec.tz = tz), b),
          create() {
            created.push(spec);
            triggers.push({ handler });
          },
        };
        return b;
      },
    },
  });
  return { sandbox, folder, copies, triggers, created, logs };
}

const snapName = (d: string) => `Hive snapshot ${d}`;
const dates = (n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10));

describe('#294 AC1: a daily copy lands in the snapshot folder', () => {
  it('copies the sheet into the folder, named for the Denver date', () => {
    const t = load({ folderId: 'folder-id' });
    t.sandbox.takeSnapshot();
    expect(t.copies).toEqual([{ id: 'sheet-id', name: 'Hive snapshot 2026-10-18', folder: t.folder }]);
  });

  it('uses the Denver date, not the UTC one, late in the evening', () => {
    const t = load({ folderId: 'folder-id', today: '2026-10-19T03:30:00Z' }); // 21:30 MDT on the 18th
    t.sandbox.takeSnapshot();
    expect(t.copies[0].name).toBe('Hive snapshot 2026-10-18');
  });
});

describe('#294 AC2: one snapshot per date', () => {
  it('does not copy twice and logs that it exists', () => {
    const t = load({ folderId: 'folder-id', folder: makeFolder([snapName('2026-10-18')]) });
    t.sandbox.takeSnapshot();
    expect(t.copies).toHaveLength(0);
    expect(t.logs).toContain('Snapshot for 2026-10-18 already exists');
  });
});

describe('#294 AC3: retention keeps the newest 60', () => {
  it('trashes only the oldest by name date, leaving 60', () => {
    const old = dates(60); // 2026-08-01 .. 2026-09-29
    const folder = makeFolder([...old].reverse().map(snapName)); // creation order scrambled
    const t = load({ folderId: 'folder-id', folder });
    t.sandbox.takeSnapshot();
    const live = folder.files.filter((f) => !f.trashed);
    expect(live).toHaveLength(60);
    expect(folder.files.filter((f) => f.trashed).map((f) => f.name)).toEqual([snapName('2026-08-01')]);
    expect(live.map((f) => f.name)).toContain(snapName('2026-10-18'));
  });

  it('never touches files whose names do not match', () => {
    const odd = ['notes.txt', 'Hive snapshot 2026-8-1', 'Hive snapshot 2026-08-01 (copy)', 'Copy of Hive snapshot 2026-08-01'];
    const folder = makeFolder([...odd, ...dates(61).map(snapName)]);
    load({ folderId: 'folder-id', folder }).sandbox.takeSnapshot();
    expect(folder.files.filter((f) => odd.includes(f.name)).every((f) => !f.trashed)).toBe(true);
    expect(folder.files.filter((f) => f.trashed && !odd.includes(f.name))).toHaveLength(2);
  });
});

describe('#294 AC4: unconfigured or failed runs fail loudly', () => {
  const MSG = 'SNAPSHOT_FOLDER_ID is not set or not writable';
  it.each([
    ['unset', undefined],
    ['blank', '   '],
    ['not a folder', 'bogus'],
  ])('throws when the folder id is %s, and copies nothing', (_l, folderId) => {
    const t = load({ folderId });
    expect(() => t.sandbox.takeSnapshot()).toThrow(MSG);
    expect(t.copies).toHaveLength(0);
  });

  it('throws when the account can only view the folder', () => {
    const t = load({ folderId: 'folder-id', folder: makeFolder([], 'VIEW') });
    expect(() => t.sandbox.takeSnapshot()).toThrow(MSG);
    expect(t.copies).toHaveLength(0);
  });
});

describe('#294 AC5: installing is idempotent', () => {
  it('leaves exactly one takeSnapshot trigger, daily at 03:00 Denver, and other triggers alone', () => {
    const t = load({ triggers: [{ handler: 'takeSnapshot' }, { handler: 'other' }] });
    t.sandbox.installSnapshotTrigger();
    t.sandbox.installSnapshotTrigger();
    expect(t.triggers.filter((x) => x.handler === 'takeSnapshot')).toHaveLength(1);
    expect(t.triggers.filter((x) => x.handler === 'other')).toHaveLength(1);
    expect(t.created[0]).toMatchObject({ handler: 'takeSnapshot', everyDays: 1, atHour: 3, tz: 'America/Denver' });
  });

  it('removeSnapshotTrigger removes only takeSnapshot', () => {
    const t = load({ triggers: [{ handler: 'takeSnapshot' }, { handler: 'other' }] });
    t.sandbox.removeSnapshotTrigger();
    expect(t.triggers.map((x) => x.handler)).toEqual(['other']);
  });
});
