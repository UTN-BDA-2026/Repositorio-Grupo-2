'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const { getBackupConfig } = require('./config');
const { getConnectionInfo } = require('./connection');
const { computeFileChecksum } = require('./integrity');
const {
  createBackupId,
  ensureBackupRoot,
  getBackupFilePath,
  getBackupFolder,
  loadAllManifests,
  readManifest,
  removeBackupFolder,
  writeManifest,
} = require('./storage');

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(
          `${command} falló (código ${code}): ${stderr.trim() || stdout.trim()}`,
        );
        error.exitCode = code;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

async function getPgDumpVersion(pgDumpPath, pgEnv) {
  const { stdout } = await runCommand(pgDumpPath, ['--version'], pgEnv);
  return stdout.trim();
}

async function createCustomBackup({ config, connection, backupFile, pgEnv }) {
  await runCommand(
    config.pgDumpPath,
    ['--format=custom', '--no-owner', '--no-acl', '--file', backupFile, connection.connectionString],
    pgEnv,
  );
}

async function createPlainBackup({ config, connection, backupFile, pgEnv }) {
  const tmpSql = `${backupFile}.tmp.sql`;
  await runCommand(
    config.pgDumpPath,
    ['--format=plain', '--no-owner', '--no-acl', '--file', tmpSql, connection.connectionString],
    pgEnv,
  );

  const source = fs.createReadStream(tmpSql);
  const destination = fs.createWriteStream(backupFile);
  const gzip = zlib.createGzip({ level: 9 });

  try {
    await pipeline(source, gzip, destination);
  } finally {
    fs.rmSync(tmpSql, { force: true });
  }
}

async function createBackup(options = {}) {
  const config = getBackupConfig();
  const connection = getConnectionInfo();
  const id = options.id || createBackupId();
  const backupFolder = getBackupFolder(config.dir, id);
  const ext = config.formatMeta.ext;
  const backupFile = getBackupFilePath(backupFolder, ext);

  ensureBackupRoot(config.dir);
  fs.mkdirSync(backupFolder, { recursive: true });

  const pgEnv = connection.pgEnv;

  if (config.format === 'custom') {
    await createCustomBackup({ config, connection, backupFile, pgEnv });
  } else {
    await createPlainBackup({ config, connection, backupFile, pgEnv });
  }

  const stats = fs.statSync(backupFile);
  const checksum = computeFileChecksum(backupFile);
  const toolVersion = await getPgDumpVersion(config.pgDumpPath, pgEnv);

  const manifest = {
    id,
    prefix: config.prefix,
    createdAt: new Date().toISOString(),
    database: connection.database,
    format: config.format,
    filename: path.basename(backupFile),
    filenameExt: ext,
    sizeBytes: stats.size,
    checksum,
    toolVersion,
    connectionMode: process.env.DATABASE_URL ? 'DATABASE_URL' : 'DB_*',
  };

  writeManifest(backupFolder, manifest);

  return {
    id,
    folder: backupFolder,
    file: backupFile,
    manifest,
  };
}

function listBackups() {
  const config = getBackupConfig();
  const entries = loadAllManifests(config.dir);

  return entries.map((entry) => {
    if (!entry.manifest) {
      return {
        id: path.basename(entry.folder),
        valid: false,
        error: entry.error,
        folder: entry.folder,
      };
    }

    const backupFile = getBackupFilePath(entry.folder, entry.manifest.filenameExt);
    const exists = fs.existsSync(backupFile);

    return {
      id: entry.manifest.id,
      createdAt: entry.manifest.createdAt,
      database: entry.manifest.database,
      format: entry.manifest.format,
      sizeBytes: entry.manifest.sizeBytes,
      checksum: entry.manifest.checksum,
      folder: entry.folder,
      file: backupFile,
      fileExists: exists,
      valid: exists,
    };
  });
}

function getBackupById(id) {
  const config = getBackupConfig();
  const folder = getBackupFolder(config.dir, id);

  if (!fs.existsSync(folder)) {
    throw new Error(`Backup no encontrado: ${id}`);
  }

  const manifest = readManifest(folder);
  const backupFile = getBackupFilePath(folder, manifest.filenameExt);

  return { folder, manifest, backupFile };
}

function deleteBackup(id) {
  const { folder, manifest } = getBackupById(id);
  removeBackupFolder(folder);
  return { id: manifest.id, folder };
}

function selectBackupsForPrune(backups, config) {
  const sorted = [...backups]
    .filter((b) => b.valid && b.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const toDelete = new Set();

  if (config.retentionCount && sorted.length > config.retentionCount) {
    sorted.slice(config.retentionCount).forEach((b) => toDelete.add(b.id));
  }

  if (config.retentionDays) {
    const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
    sorted.forEach((b) => {
      if (new Date(b.createdAt).getTime() < cutoff) {
        toDelete.add(b.id);
      }
    });
  }

  return [...toDelete];
}

function pruneOldBackups() {
  const config = getBackupConfig();
  const backups = listBackups();
  const ids = selectBackupsForPrune(backups, config);

  const deleted = ids.map((id) => deleteBackup(id));
  return { deleted, retentionCount: config.retentionCount, retentionDays: config.retentionDays };
}

module.exports = {
  createBackup,
  deleteBackup,
  getBackupById,
  listBackups,
  pruneOldBackups,
  runCommand,
  selectBackupsForPrune,
};
