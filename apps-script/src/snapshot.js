// #294: a daily copy of the Hive sheet into a Drive folder, newest 60 kept.
//
// Google's version history rolls off after about 30 days or 100 versions; a
// snapshot is the copy that outlives it. `takeSnapshot` runs from a time-driven
// trigger (`installSnapshotTrigger`, one-time owner step) as the deploying
// account, which is also the inbox Apps Script mails when a run fails.
//
// Not part of the web-app path: nothing here is reachable from doGet/doPost.

var SNAPSHOT_PREFIX = 'Hive snapshot ';
var SNAPSHOT_NAME_PATTERN = /^Hive snapshot (\d{4}-\d{2}-\d{2})$/;
var SNAPSHOT_KEEP = 60;
var SNAPSHOT_HANDLER = 'takeSnapshot';
var SNAPSHOT_FOLDER_ERROR = 'SNAPSHOT_FOLDER_ID is not set or not writable';

/**
 * The folder named by SNAPSHOT_FOLDER_ID, or a throw. It never falls back to
 * the Drive root: a snapshot of the whole family board must not land anywhere
 * the owner did not choose.
 * @returns {GoogleAppsScript.Drive.Folder}
 */
function getSnapshotFolder() {
  var id = PropertiesService.getScriptProperties().getProperty('SNAPSHOT_FOLDER_ID');
  if (!id || !String(id).trim()) throw new Error(SNAPSHOT_FOLDER_ERROR);
  try {
    var folder = DriveApp.getFolderById(String(id).trim());
    var access = folder.getAccess(Session.getEffectiveUser());
    if (access !== DriveApp.Permission.OWNER && access !== DriveApp.Permission.EDIT) {
      throw new Error('not writable');
    }
    return folder;
  } catch (err) {
    throw new Error(SNAPSHOT_FOLDER_ERROR);
  }
}

/** Copy the sheet to `Hive snapshot YYYY-MM-DD` (AUDIT_TIMEZONE), once per date, then prune. */
function takeSnapshot() {
  var folder = getSnapshotFolder();
  var date = Utilities.formatDate(new Date(), AUDIT_TIMEZONE, 'yyyy-MM-dd');
  var name = SNAPSHOT_PREFIX + date;

  if (folder.getFilesByName(name).hasNext()) {
    Logger.log('Snapshot for ' + date + ' already exists');
    return;
  }

  DriveApp.getFileById(getSpreadsheetId()).makeCopy(name, folder);
  Logger.log('Snapshot ' + name + ' created');
  pruneSnapshots(folder);
}

/**
 * Trash all but the newest SNAPSHOT_KEEP snapshots. Sorted by the date in the
 * name, not creation time, so a re-run or a restore never reorders them; files
 * whose names do not match are never touched.
 */
function pruneSnapshots(folder) {
  var snapshots = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var match = SNAPSHOT_NAME_PATTERN.exec(file.getName());
    if (match) snapshots.push({ date: match[1], file: file });
  }
  snapshots.sort(function(a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  for (var i = SNAPSHOT_KEEP; i < snapshots.length; i++) {
    snapshots[i].file.setTrashed(true);
  }
}

/** Install the daily trigger, 03:00 AUDIT_TIMEZONE. Safe to run again: leaves exactly one. */
function installSnapshotTrigger() {
  removeSnapshotTrigger();
  ScriptApp.newTrigger(SNAPSHOT_HANDLER)
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .inTimezone(AUDIT_TIMEZONE)
    .create();
}

/** Remove only the `takeSnapshot` triggers. */
function removeSnapshotTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === SNAPSHOT_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
