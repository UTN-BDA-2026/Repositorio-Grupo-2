'use strict';

const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');

const { getBackupConfig } = require('./config');
const { getConnectionInfo } = require('./connection');
const { verifyChecksum } = require('./integrity');
const { getBackupById } = require('./backup-service');
const { runCommand } = require('./backup-service');

async function validateBackupIntegrity(id) {
  const { manifest, backupFile } = getBackupById(id);

  if (!fs.existsSync(backupFile)) {
    return {
      id,
      valid: false,
      reason: `Archivo de backup no encontrado: ${backupFile}`,
    };
  }

  const checksumResult = verifyChecksum(backupFile, manifest.checksum);
  if (!checksumResult.valid) {
    return { id, valid: false, ...checksumResult };
  }

  const stats = fs.statSync(backupFile);
  if (stats.size !== manifest.sizeBytes) {
    return {
      id,
      valid: false,
      reason: 'El tamaño del archivo no coincide con el manifiesto',
      expectedSize: manifest.sizeBytes,
      actualSize: stats.size,
    };
  }

  return {
    id,
    valid: true,
    checksum: checksumResult.checksum,
    sizeBytes: stats.size,
    format: manifest.format,
    createdAt: manifest.createdAt,
  };
}

async function restoreCustomBackup({ config, connection, backupFile, pgEnv }) {
  await runCommand(
    config.pgRestorePath,
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-acl',
      '--dbname',
      connection.connectionString,
      backupFile,
    ],
    pgEnv,
  );
}

async function restorePlainBackup({ config, connection, backupFile, pgEnv }) {
  const tmpSql = `${backupFile}.restore.tmp.sql`;
  const source = fs.createReadStream(backupFile);
  const gunzip = zlib.createGunzip();
  const destination = fs.createWriteStream(tmpSql);

  try {
    await pipeline(source, gunzip, destination);
    await runCommand(config.psqlPath, [connection.connectionString, '-f', tmpSql], pgEnv);
  } finally {
    fs.rmSync(tmpSql, { force: true });
  }
}

async function restoreBackup(id, options = {}) {
  const { skipValidation = false, dryRun = false } = options;

  if (!skipValidation) {
    const validation = await validateBackupIntegrity(id);
    if (!validation.valid) {
      const error = new Error(`Backup inválido (${id}): ${validation.reason}`);
      error.validation = validation;
      throw error;
    }
  }

  const { manifest, backupFile } = getBackupById(id);
  const config = getBackupConfig();
  const connection = getConnectionInfo();
  const pgEnv = connection.pgEnv;

  if (dryRun) {
    return {
      id,
      dryRun: true,
      format: manifest.format,
      database: connection.database,
      file: backupFile,
    };
  }

  if (manifest.format === 'custom') {
    await restoreCustomBackup({ config, connection, backupFile, pgEnv });
  } else if (manifest.format === 'plain') {
    await restorePlainBackup({ config, connection, backupFile, pgEnv });
  } else {
    throw new Error(`Formato de backup no soportado: ${manifest.format}`);
  }

  return {
    id,
    restoredAt: new Date().toISOString(),
    database: connection.database,
    format: manifest.format,
    file: backupFile,
  };
}

module.exports = {
  restoreBackup,
  validateBackupIntegrity,
};
