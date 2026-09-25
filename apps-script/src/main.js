// Entry points for the Apps Script web app.
// All operations go through doGet since Apps Script redirects break POST
// for anonymous callers. Write operations pass data via a `payload` query param.
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

function validateApiKey(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!expected) throw new Error('API_KEY not configured in script properties');
  if (key !== expected) return false;
  return true;
}

function doGet(e) {
  var action = e.parameter.action;
  var result;

  try {
    // Authenticate — every request must include a valid API key
    if (!validateApiKey(e.parameter.key)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Invalid or missing API key' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Parse payload for write operations
    var payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};

    switch (action) {
      // --- Read operations ---
      case 'getItems':
        result = {
          success: true,
          data: getItems({
            status: e.parameter.status,
            owner: e.parameter.owner,
            label: e.parameter.label,
            parent_id: e.parameter.parent_id,
            board_id: e.parameter.board_id,
            roots_only: e.parameter.roots_only,
            due_after: e.parameter.due_after,
            due_before: e.parameter.due_before,
          }),
        };
        break;

      case 'getItem':
        if (!e.parameter.id) {
          result = { success: false, error: 'id parameter required' };
          break;
        }
        var foundItem = getItem(e.parameter.id);
        if (!foundItem) {
          result = { success: false, error: 'Item "' + e.parameter.id + '" not found' };
        } else {
          result = { success: true, data: foundItem };
        }
        break;

      case 'getOwners':
        result = { success: true, data: getOwners() };
        break;

      case 'getLabels':
        result = { success: true, data: getLabels(e.parameter.board_id || '') };
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
            from: e.parameter.from,
            to: e.parameter.to,
            action: e.parameter.audit_action,
          }),
        };
        break;

      case 'getStatuses':
        if (e.parameter.board_id === undefined) {
          result = { success: true, data: getAllStatuses() };
          break;
        }
        if (e.parameter.board_id.trim() === '') {
          result = { success: false, error: 'board_id must not be empty' };
          break;
        }
        result = { success: true, data: getStatuses(e.parameter.board_id) };
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
  } catch (err) {
    result = { success: false, error: err.message || String(err) };
    // #244: a rejected confirm carries the fresh preview, so the caller can see
    // what changed and retry without a second round trip.
    if (err && err.preview) {
      result.data = err.preview;
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // Keep doPost as a fallback for authenticated callers (e.g. future voice/AI agents)
  var result;

  try {
    var body = JSON.parse(e.postData.contents);

    // Authenticate
    if (!validateApiKey(body.key)) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Invalid or missing API key' }))
        .setMimeType(ContentService.MimeType.JSON);
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

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
