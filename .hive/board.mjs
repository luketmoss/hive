#!/usr/bin/env node
// Hive board helper. All project board writes go through this script.
//
//   node .hive/board.mjs show <issue>
//   node .hive/board.mjs set <issue> --status "In Development"
//   node .hive/board.mjs list --status Refined
//   node .hive/board.mjs children <issue>   # sub-issues with their board status
//   node .hive/board.mjs sync               # refresh status option IDs from the API
//
// Status option IDs are cached in board.json so routine moves cost one API call
// instead of three. `sync` rewrites that cache after a column is added or renamed.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, 'board.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

// Issue number -> project item id. Every item-list call pulls 200 rows and
// counts against the same GraphQL budget as a real move, so a run that touches
// several issues can trip the burst limit on lookups alone. Ids never change,
// so they are worth caching. Untracked — delete it and it rebuilds.
const cachePath = join(here, '.item-cache.json');
const itemCache = existsSync(cachePath)
  ? JSON.parse(readFileSync(cachePath, 'utf8'))
  : {};

function rememberItem(issue, id) {
  if (itemCache[issue] === id) return;
  itemCache[issue] = id;
  writeFileSync(cachePath, `${JSON.stringify(itemCache, null, 2)}\n`);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function gh(args) {
  // GitHub's burst limit on the projects API surfaces as a hard failure rather
  // than a 429 with a Retry-After, so back off and try again before giving up.
  for (let attempt = 0; ; attempt += 1) {
    try {
      return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } catch (err) {
      const message = String(err.stderr || err.message || '');
      if (attempt >= 4 || !/rate limit/i.test(message)) throw err;
      const wait = 15000 * 2 ** attempt;
      console.error(`Rate limited; retrying in ${wait / 1000}s...`);
      sleep(wait);
    }
  }
}

function die(message) {
  console.error(message);
  process.exit(1);
}

function items() {
  const raw = gh([
    'project', 'item-list', String(config.projectNumber),
    '--owner', config.owner, '--limit', '200', '--format', 'json',
  ]);
  const rows = JSON.parse(raw).items;
  for (const row of rows) {
    if (row.content?.number) rememberItem(row.content.number, row.id);
  }
  return rows;
}

function findItem(issue) {
  const item = items().find((i) => i.content?.number === Number(issue));
  if (!item) die(`Issue #${issue} is not on project #${config.projectNumber}.`);
  return item;
}

function flag(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
}

function optionId(status) {
  const id = config.statuses[status];
  if (id) return id;
  die(
    `Unknown status "${status}".\n` +
    `Known: ${Object.keys(config.statuses).join(', ')}\n` +
    `If the column was just added or renamed, run: node .hive/board.mjs sync`
  );
}

const [command, ...argv] = process.argv.slice(2);

switch (command) {
  case 'show': {
    const item = findItem(argv[0]);
    console.log(`#${item.content.number}  ${item.content.title}`);
    console.log(`Status: ${item.status ?? '(none)'}`);
    console.log(item.content.url);
    break;
  }

  case 'set': {
    const issue = argv[0];
    const status = flag(argv, 'status');
    if (!issue || !status) die('Usage: board.mjs set <issue> --status "<column>"');
    const optionValue = optionId(status);

    // A cached id means the move is one API call instead of two. The mutation
    // is idempotent, so skipping the lookup only costs the "already in X" note.
    const cachedId = itemCache[Number(issue)];
    const item = cachedId ? { id: cachedId, status: null } : findItem(issue);
    if (!cachedId) rememberItem(Number(issue), item.id);

    if (item.status === status) {
      console.log(`#${issue} already in ${status}.`);
      break;
    }
    gh([
      'api', 'graphql', '-f', `query=mutation {
        updateProjectV2ItemFieldValue(input: {
          projectId: "${config.projectId}"
          itemId: "${item.id}"
          fieldId: "${config.statusFieldId}"
          value: { singleSelectOptionId: "${optionValue}" }
        }) { projectV2Item { id } }
      }`,
    ]);
    console.log(cachedId ? `#${issue} -> ${status}` : `#${issue}: ${item.status ?? '(none)'} -> ${status}`);
    break;
  }

  case 'list': {
    const status = flag(argv, 'status');
    const rows = items().filter((i) => !status || i.status === status);
    if (rows.length === 0) {
      console.log(status ? `Nothing in ${status}.` : 'Board is empty.');
      break;
    }
    for (const i of rows) {
      console.log(`#${i.content.number}  [${i.status ?? '-'}]  ${i.content.title}`);
    }
    break;
  }

  case 'children': {
    const parent = argv[0];
    if (!parent) die('Usage: board.mjs children <issue>');
    const [owner, name] = config.repo.split('/');
    const raw = gh([
      'api', 'graphql', '-f', `query=query {
        repository(owner: "${owner}", name: "${name}") {
          issue(number: ${Number(parent)}) {
            title
            subIssues(first: 50) { nodes { number title state } }
          }
        }
      }`,
    ]);
    const issue = JSON.parse(raw).data.repository.issue;
    if (!issue) die(`Issue #${parent} not found in ${config.repo}.`);
    const kids = issue.subIssues.nodes;
    if (kids.length === 0) {
      console.log(`#${parent} ${issue.title} has no sub-issues.`);
      break;
    }
    const board = new Map(items().map((i) => [i.content?.number, i.status]));
    console.log(`#${parent}  ${issue.title}`);
    for (const k of kids) {
      const status = k.state === 'CLOSED' ? 'CLOSED' : board.get(k.number) ?? '(not on board)';
      console.log(`  #${k.number}  [${status}]  ${k.title}`);
    }
    break;
  }

  case 'sync': {
    const raw = gh([
      'project', 'field-list', String(config.projectNumber),
      '--owner', config.owner, '--format', 'json',
    ]);
    const field = JSON.parse(raw).fields.find((f) => f.id === config.statusFieldId);
    if (!field) die('Status field not found on the project.');
    config.statuses = Object.fromEntries(field.options.map((o) => [o.name, o.id]));
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`Synced ${field.options.length} statuses: ${Object.keys(config.statuses).join(', ')}`);
    break;
  }

  default:
    die('Usage: board.mjs <show|set|list|children|sync> ...');
}
