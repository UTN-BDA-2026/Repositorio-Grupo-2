'use strict';

require('dotenv').config();
const path = require('path');

const FORMATS = Object.freeze({
  custom: { ext: '.dump', flag: '-Fc', restoreTool: 'pg_restore' },
  plain: { ext: '.sql.gz', flag: '-Fp', restoreTool: 'psql', compress: true },
});

function resolveBackupDir() {
  const raw = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function getBackupConfig() {
  const format = (process.env.BACKUP_FORMAT || 'custom').toLowerCase();
  if (!FORMATS[format]) {
    throw new Error(
      `BACKUP_FORMAT inválido: "${format}". Valores permitidos: custom, plain`,
    );
  }

  const retentionCount = Number(process.env.BACKUP_RETENTION_COUNT || 10);
  const retentionDays = process.env.BACKUP_RETENTION_DAYS
    ? Number(process.env.BACKUP_RETENTION_DAYS)
    : null;

  if (!Number.isFinite(retentionCount) || retentionCount < 1) {
    throw new Error('BACKUP_RETENTION_COUNT debe ser un entero >= 1');
  }
  if (retentionDays != null && (!Number.isFinite(retentionDays) || retentionDays < 1)) {
    throw new Error('BACKUP_RETENTION_DAYS debe ser un entero >= 1');
  }

  return {
    dir: resolveBackupDir(),
    prefix: process.env.BACKUP_PREFIX || 'agustina',
    format,
    formatMeta: FORMATS[format],
    retentionCount,
    retentionDays,
    pgDumpPath: process.env.PG_DUMP_PATH || 'pg_dump',
    pgRestorePath: process.env.PG_RESTORE_PATH || 'pg_restore',
    psqlPath: process.env.PSQL_PATH || 'psql',
  };
}

module.exports = { FORMATS, getBackupConfig, resolveBackupDir };
