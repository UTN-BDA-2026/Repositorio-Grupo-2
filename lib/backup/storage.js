'use strict';

const fs = require('fs');
const path = require('path');

const MANIFEST_FILE = 'manifest.json';
const BACKUP_FILE = 'backup';

function ensureBackupRoot(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createBackupId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function getBackupFolder(dir, id) {
  return path.join(dir, id);
}

function getManifestPath(backupFolder) {
  return path.join(backupFolder, MANIFEST_FILE);
}

function getBackupFilePath(backupFolder, ext) {
  return path.join(backupFolder, `${BACKUP_FILE}${ext}`);
}

function writeManifest(backupFolder, manifest) {
  const manifestPath = getManifestPath(backupFolder);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

function readManifest(backupFolder) {
  const manifestPath = getManifestPath(backupFolder);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifiesto no encontrado en ${backupFolder}`);
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function listBackupFolders(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
}

function loadAllManifests(dir) {
  return listBackupFolders(dir).map((folder) => {
    try {
      const manifest = readManifest(folder);
      return {
        folder,
        manifest,
        backupFile: getBackupFilePath(folder, manifest.filenameExt || ''),
      };
    } catch (err) {
      return {
        folder,
        manifest: null,
        error: err.message,
      };
    }
  });
}

function removeBackupFolder(folder) {
  fs.rmSync(folder, { recursive: true, force: true });
}

module.exports = {
  BACKUP_FILE,
  MANIFEST_FILE,
  createBackupId,
  ensureBackupRoot,
  getBackupFilePath,
  getBackupFolder,
  getManifestPath,
  listBackupFolders,
  loadAllManifests,
  readManifest,
  removeBackupFolder,
  writeManifest,
};
