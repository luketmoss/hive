// Entry points for the Apps Script web app.
// All operations go through doGet since Apps Script redirects break POST
// for anonymous callers. Write operations pass data via a `payload` query param.
//
// Read examples:
//   ?action=getOwners
//   ?action=getItems&status=To+Do&owner=Luke
//
// Write examples:
//   ?action=createItem&payload={"data":{"title":"Test","owner":"Luke"},"actor":"smoke-test"}
//   ?action=updateItem&payload={"id":"uuid","changes":{"status":"Done"},"actor":"smoke-test"}
//   ?action=deleteItem&payload={"id":"uuid","actor":"smoke-test"}

function doGet(e) {
  var action = e.parameter.action;
  var result;

  try {
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
            roots_only: e.parameter.roots_only,
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
        result = { success: true, data: getLabels() };
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

      case 'deleteItem':
        if (!payload.id) {
          result = { success: false, error: 'payload.id field required' };
          break;
        }
        deleteItem(payload.id, payload.actor || 'api');
        result = { success: true };
        break;

      default:
        result = { success: false, error: 'Unknown action: "' + action + '"' };
    }
  } catch (err) {
    result = { success: false, error: err.message || String(err) };
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

      case 'deleteItem':
        if (!body.id) {
          result = { success: false, error: 'id field required' };
          break;
        }
        deleteItem(body.id, actor);
        result = { success: true };
        break;

      default:
        result = { success: false, error: 'Unknown action: "' + action + '"' };
    }
  } catch (err) {
    result = { success: false, error: err.message || String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
