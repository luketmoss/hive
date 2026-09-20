// Sandboxed loader for Apps Script sources.
//
// Apps Script files are plain `.js` evaluated into one shared global scope —
// no modules, no exports. Tests that transcribe a function into the test file
// stay green when the real source breaks (see #241), so instead we read the
// real `src/*.js` files and evaluate them into a `node:vm` context with the
// Google globals stubbed.
//
// This is safe because no source file touches a Google global at load time:
// `PropertiesService`, `ContentService` and `SpreadsheetApp` appear only inside
// function bodies.
//
// `loadSources` is the general seam; `loadReadPath` is a convenience over it
// for the Items read path. #243 converts the remaining transcription-based
// tests and should build on `loadSources` rather than add a second loader.

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

// The sandbox is a `node:vm` context holding the globals the `.js` sources
// declared. Its shape is only knowable at runtime — the sources are plain
// Apps Script JS with no types to import — so `any` is the honest type here
// rather than a shortcut, and callers narrow at the point of use.
export type Sandbox = Record<string, any>;

/** A value as a Sheets range hands it back. */
export type CellValue = string | number | boolean | Date;

/** A fake Sheet covering the surface `utils.js` actually uses. */
export function makeSheet(rows: CellValue[][], columnCount?: number) {
  const lastColumn = columnCount ?? (rows.length ? rows[0].length : 0);
  return {
    getLastRow() {
      return rows.length + 1; // +1 for the header row
    },
    getLastColumn() {
      return lastColumn;
    },
    getRange(startRow: number, startCol: number, numRows: number, numCols: number) {
      return {
        getValues() {
          return rows
            .slice(startRow - 2, startRow - 2 + numRows)
            .map((r) => r.slice(startCol - 1, startCol - 1 + numCols));
        },
      };
    },
  };
}

/**
 * A fake Sheet that can also be written to — `setValues` and `appendRow`.
 * `rows` is the live backing array, so a test can assert against it after a
 * write. Reads go through the same surface `makeSheet` exposes.
 */
export function makeWritableSheet(rows: CellValue[][], columnCount?: number) {
  const lastColumn = columnCount ?? (rows.length ? rows[0].length : 0);
  return {
    rows,
    getLastRow() {
      return rows.length + 1; // +1 for the header row
    },
    getLastColumn() {
      return lastColumn;
    },
    appendRow(row: CellValue[]) {
      rows.push(row);
    },
    getRange(startRow: number, startCol: number, numRows: number, numCols: number) {
      return {
        getValues() {
          return rows
            .slice(startRow - 2, startRow - 2 + numRows)
            .map((r) => r.slice(startCol - 1, startCol - 1 + numCols));
        },
        setValues(values: CellValue[][]) {
          for (let i = 0; i < numRows; i++) {
            const target = startRow - 2 + i;
            if (!rows[target]) rows[target] = [];
            for (let c = 0; c < numCols; c++) {
              rows[target][startCol - 1 + c] = values[i][c];
            }
          }
        },
      };
    },
  };
}

/**
 * `Utilities` stub covering the surface the sources use.
 *
 * `formatDate` is the load-bearing one (#239): the real Apps Script method
 * resolves a named IANA zone including its DST transitions, so the stub does
 * the same through `Intl` rather than hard-coding an offset — a fixed -6 or -7
 * would make the MDT/MST boundary test pass for the wrong reason.
 */
export function makeUtilities(uuids: string[] = []) {
  let nextUuid = 0;
  return {
    getUuid() {
      return uuids[nextUuid++] ?? 'uuid-' + nextUuid;
    },
    formatDate(date: Date, timeZone: string, format: string) {
      if (format !== 'yyyy-MM-dd') {
        throw new Error('Utilities.formatDate stub only supports yyyy-MM-dd, got: ' + format);
      }
      // 'en-CA' renders as YYYY-MM-DD, which is the format Apps Script's
      // 'yyyy-MM-dd' produces.
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    },
  };
}

/** ContentService stub — captures the text passed to `createTextOutput`. */
export function makeContentService() {
  return {
    MimeType: { JSON: 'application/json' },
    createTextOutput(text: string) {
      const output = {
        getContent() {
          return text;
        },
        setMimeType() {
          return output;
        },
      };
      return output;
    },
  };
}

/** PropertiesService stub backed by a plain object of script properties. */
export function makePropertiesService(properties: Record<string, string>) {
  return {
    getScriptProperties() {
      return {
        getProperty(key: string) {
          return Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null;
        },
      };
    },
  };
}

/**
 * Evaluate the named files from `apps-script/src` into one shared sandbox,
 * in order, with `globals` injected first.
 */
export function loadSources(files: string[], globals: Sandbox = {}): Sandbox {
  // `Logger` and `console` are diagnostics only — they never affect an
  // assertion, so defaulting them keeps a caller from having to stub noise.
  // Anything that *does* affect behaviour (ContentService, PropertiesService,
  // SpreadsheetApp, Utilities) is left to the caller on purpose: a missing
  // stub should fail loudly rather than quietly return a default.
  const context = createContext({ Logger: { log() {} }, console, ...globals });
  for (const file of files) {
    const filename = path.join(SRC_DIR, file);
    const code = readFileSync(filename, 'utf8');
    runInContext(code, context, { filename, displayErrors: true });
  }
  return context;
}

/**
 * Load the read path (`types`, `utils`, `items`, `main`) with the Google
 * globals stubbed and the Items sheet backed by `itemRows`.
 */
export function loadReadPath(itemRows: CellValue[][], apiKey = 'test-key'): Sandbox {
  const sandbox = loadSources(['types.js', 'utils.js', 'items.js', 'main.js'], {
    ContentService: makeContentService(),
    PropertiesService: makePropertiesService({ API_KEY: apiKey, SPREADSHEET_ID: 'sheet-id' }),
  });

  // Seam for fixture rows: replace the sheet accessor, keep `getAllRows` and
  // `rowToItem` as the real source so column mapping is exercised too.
  const itemsSheet = makeSheet(itemRows, sandbox.ITEM_COLUMN_COUNT);
  sandbox.getSheet = (name: string) => {
    if (name !== 'Items') throw new Error('Sheet "' + name + '" not stubbed');
    return itemsSheet;
  };

  return sandbox;
}

/** An Items row as `rowToItem` returns it over the API. */
export interface ApiItem {
  id: string;
  [field: string]: CellValue;
}

/** An Audit Log row as `rowToAuditEntry` returns it over the API. */
export interface AuditEntry {
  timestamp: string;
  item_id: string;
  action: string;
  field: string;
  old_value: string;
  new_value: string;
  actor: string;
}

/**
 * The envelope every `doGet` action returns. `data` is absent on failure.
 * The payload type varies by action, so it is a parameter with the Items
 * read path — by far the most common caller — as the default.
 */
export interface ApiResponse<T = ApiItem[]> {
  success: boolean;
  data: T;
  error?: string;
}

/** Call the sandbox's `doGet` with `params` and return the parsed JSON body. */
export function callDoGet<T = ApiItem[]>(
  sandbox: Sandbox,
  params: Record<string, string | undefined>,
): ApiResponse<T> {
  const output = sandbox.doGet({ parameter: { ...params } });
  return JSON.parse(output.getContent()) as ApiResponse<T>;
}
