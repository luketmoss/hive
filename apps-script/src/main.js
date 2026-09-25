// Entry points for the Apps Script web app.
// Apps Script serves every deployment through a redirect. A plain HTTP POST
// doesn't follow a redirect and resend its body, so an anonymous POST
// against the deploy URL loses its payload — that's "POST is broken for
// anonymous callers". A browser `fetch()` (or almanac's) *does* follow the
// redirect and resend the method and body, so a form-encoded POST works
// fine from a real client; it just can't be smoke-tested with a bare `curl
// -X POST`. Write operations pass data via a `payload` query param either way.
//
// Read examples:
//   ?action=getOwners
//   ?action=getItems&status=To+Do&owner=Luke
//   ?action=getItems&due_after=2026-09-01&due_before=2026-09-30
//   ?action=getAuditLog&from=2026-09-12&to=2026-09-12
//   ?action=getAuditLog&from=2026-09-12&to=2026-09-12&audit_action=completed
//   ?action=getStatuses&board_id=A
//   ?action=getStatuses   (no board_id: every board's statuses, flat, each row carrying its own board_id)
//
// Write examples:
//   ?action=createItem&payload={"data":{"title":"Test","owner":"Luke"},"actor":"smoke-test"}
//   ?action=updateItem&payload={"id":"uuid","changes":{"status":"Done"},"actor":"smoke-test"}
//
// Delete is dry-run by default (#244). The first call reports the whole
// cascade and writes nothing; the second must carry the token it returned:
//   ?action=deleteItem&payload={"id":"uuid","actor":"smoke-test"}
//   ?action=deleteItem&payload={"id":"uuid","confirm":true,"token":"a1b2c3d4","actor":"smoke-test"}
//
// #264: a read-only door for callers that can't hold API_KEY (almanac, a
// public browser bundle). Send a Google access token as `access_token`
// instead of `key` — it can only run the seven read actions in
// TOKEN_READ_ACTIONS (auth.js), on either entry point:
//   ?action=getItems&access_token=ya29...                          (GET)
//   POST body (form-encoded): action=getItems&access_token=ya29...
// A form-encoded POST body is what almanac actually sends: `e.parameter` is
// filled from it exactly as it is from a query string, so a live token never
// lands in a URL log while a plain `?access_token=...` GET still works from
// a terminal. The JSON-body POST path below stays a write-only door for `key`
// callers — a token there is refused outright.

function validateApiKey(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) throw new Error('API_KEY not configured in script properties');
  if (key !== expected) return false;
  return true;
}

function jsonOutput(result) {
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run every read and write action `doGet` supports. Shared by `doGet` and
 * the form-encoded branch of `doPost` (#264, AC6) so the two entry points
 * can't drift on what an action does.
 * @param {string} action
 * @param {Object} params - `e.parameter`-shaped request parameters
 * @param {Object} payload - parsed `params.payload`, `{}` if absent
 * @returns {Object} the envelope to return
 */
function dispatchAction(action, params, payload) {
  var result;

  switch (action) {
    // --- Read operations ---
    case 'getItems':
      result = {
        success: true,
        data: getItems({
          status: params.status,
          owner: params.owner,
          label: params.label,
          parent_id: params.parent_id,
          board_id: params.board_id,
          roots_only: params.roots_only,
          due_after: params.due_after,
          due_before: params.due_before,
        }),
      };
      break;

    case 'getItem':
      if (!params.id) {
        result = { success: false, error: 'id parameter required' };
        break;
      }
      var foundItem = getItem(params.id);
      if (!foundItem) {
        result = { success: false, error: 'Item "' + params.id + '" not found' };
      } else {
        result = { success: true, data: foundItem };
      }
      break;

    case 'getOwners':
      result = { success: true, data: getOwners() };
      break;

    case 'getLabels':
      result = { success: true, data: getLabels(params.board_id || '') };
      break;

    case 'getBoards':
      result = { success: true, data: getBoards() };
      break;

    // #239: Audit Log reader for cross-app day queries.
    // `from`/`to` are inclusive local calendar dates (AUDIT_TIMEZONE),
    // formatted YYYY-MM-DD. The action filter is `audit_action`, not
    // `action` — `action` is already the dispatch parameter.
    case 'getAuditLog':
      result = {
        success: true,
        data: getAuditLog({
          from: params.from,
          to: params.to,
          action: params.audit_action,
        }),
      };
      break;

    case 'getStatuses':
      if (params.board_id === undefined) {
        result = { success: true, data: getAllStatuses() };
        break;
      }
      if (params.board_id.trim() === '') {
        result = { success: false, error: 'board_id must not be empty' };
        break;
      }
      result = { success: true, data: getStatuses(params.board_id) };
      break;

    // --- Write operations (data in payload param) ---
    case 'createItem':
      if (!payload.data) {
        result = { success: false, error: 'payload.data field required' };
        break;
      }
      result = { success: true, data: createItem(payload.data, payload.actor || 'api') };
      break;

    case 'updateItem':
      if (!payload.id) {
        result = { success: false, error: 'payload.id field required' };
        break;
      }
      if (!payload.changes) {
        result = { success: false, error: 'payload.changes field required' };
        break;
      }
      result = { success: true, data: updateItem(payload.id, payload.changes, payload.actor || 'api') };
      break;

    // #244: dry-run by default. No `confirm` returns the full cascade that
    // would be removed, plus a token, and writes nothing. `confirm` must
    // carry that token back or the call is refused.
    case 'deleteItem':
      if (!payload.id) {
        result = { success: false, error: 'payload.id field required' };
        break;
      }
      result = {
        success: true,
        data: deleteItem(payload.id, payload.actor || 'api', {
          confirm: payload.confirm,
          token: payload.token,
        }),
      };
      break;

    case 'createLabel':
      if (!payload.label) {
        result = { success: false, error: 'payload.label field required' };
        break;
      }
      result = { success: true, data: createLabel(payload) };
      break;

    case 'createStatus':
      if (!payload.data) {
        result = { success: false, error: 'payload.data field required' };
        break;
      }
      result = { success: true, data: createStatus(payload.data) };
      break;

    case 'updateStatus':
      if (!payload.id) {
        result = { success: false, error: 'payload.id field required' };
        break;
      }
      if (!payload.changes) {
        result = { success: false, error: 'payload.changes field required' };
        break;
      }
      result = { success: true, data: updateStatus(payload.id, payload.changes) };
      break;

    case 'deleteStatus':
      if (!payload.id) {
        result = { success: false, error: 'payload.id field required' };
        break;
      }
      deleteStatus(payload.id);
      result = { success: true };
      break;

    default:
      result = { success: false, error: 'Unknown action: "' + action + '"' };
  }

  return result;
}

/**
 * Shared handler for `doGet` and the form-encoded branch of `doPost` (#264).
 * Resolves which credential the request is making its case with, enforces
 * it, then runs `dispatchAction`.
 * @param {Object} params - `e.parameter`-shaped request parameters
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function handleRequest(params) {
  var result;

  try {
    var credential = resolveCredential(params);

    if (credential.type === 'token') {
      var verdict = verifyAccessToken(credential.token);
      if (verdict !== 'ok') {
        return jsonOutput(tokenRefusal(verdict));
      }
      if (TOKEN_READ_ACTIONS.indexOf(params.action) === -1) {
        return jsonOutput(readOnlyRefusal(params.action));
      }
    } else if (!validateApiKey(credential.key)) {
      return jsonOutput({ success: false, error: 'Invalid or missing API key' });
    }

    var payload = params.payload ? JSON.parse(params.payload) : {};
    result = dispatchAction(params.action, params, payload);
  } catch (err) {
    result = { success: false, error: err.message || String(err) };
    // #244: a rejected confirm carries the fresh preview, so the caller can see
    // what changed and retry without a second round trip.
    if (err && err.preview) {
      result.data = err.preview;
    }
  }

  return jsonOutput(result);
}

function doGet(e) {
  return handleRequest(e.parameter || {});
}

function doPost(e) {
  var params = e.parameter || {};

  // #264, AC6: a form-encoded body fills `e.parameter` exactly like a query
  // string, so `action` being set there means the same path as GET — same
  // credential rules, same read allow-list, same envelope.
  if (params.action) {
    return handleRequest(params);
  }

  // JSON-body path: today's write-only flow for `key` callers, unchanged.
  var result;

  try {
    var body = JSON.parse(e.postData.contents);

    // A token caller reaching this path is refused outright — it only
    // writes, and a token can never write (AC6).
    var token = params.access_token || body.access_token;
    if (token) {
      return jsonOutput(readOnlyRefusal(body.action || ''));
    }

    // Authenticate
    if (!validateApiKey(body.key)) {
      return jsonOutput({ success: false, error: 'Invalid or missing API key' });
    }

    var action = body.action;
    var actor = body.actor || 'api';

    switch (action) {
      case 'createItem':
        if (!body.data) {
          result = { success: false, error: 'data field required' };
          break;
        }
        result = { success: true, data: createItem(body.data, actor) };
        break;

      case 'updateItem':
        if (!body.id) {
          result = { success: false, error: 'id field required' };
          break;
        }
        if (!body.changes) {
          result = { success: false, error: 'changes field required' };
          break;
        }
        result = { success: true, data: updateItem(body.id, body.changes, actor) };
        break;

      // #244: same dry-run contract as doGet — no `confirm`, no write.
      case 'deleteItem':
        if (!body.id) {
          result = { success: false, error: 'id field required' };
          break;
        }
        result = {
          success: true,
          data: deleteItem(body.id, actor, { confirm: body.confirm, token: body.token }),
        };
        break;

      default:
        result = { success: false, error: 'Unknown action: "' + action + '"' };
    }
  } catch (err) {
    result = { success: false, error: err.message || String(err) };
    if (err && err.preview) {
      result.data = err.preview;
    }
  }

  return jsonOutput(result);
}
