'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { describe, it, before, after } = require('node:test');

const {
  computeFileChecksum,
  verifyChecksum,
  createBackupId,
  writeManifest,
  readManifest,
  getBackupFilePath,
  getBackupFolder,
  ensureBackupRoot,
  selectBackupsForPrune,
  getBackupConfig,
  buildConnectionString,
  getDatabaseName,
  listBackups,
  deleteBackup,
  validateBackupIntegrity,
  pruneOldBackups,
} = require('../lib/backup');

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'agustina-backup-test-'));

function withEnv(overrides, fn) {
  const previous = {};
  Object.keys(overrides).forEach((key) => {
    previous[key] = process.env[key];
    if (overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  });

  try {
    return fn();
  } finally {
    Object.keys(overrides).forEach((key) => {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

describe('integrity', () => {
  it('calcula y verifica checksum sha256', () => {
    const file = path.join(TMP_ROOT, 'sample.txt');
    fs.writeFileSync(file, 'agustina-backup-test');

    const checksum = computeFileChecksum(file);
    assert.ok(checksum.startsWith('sha256:'));

    const ok = verifyChecksum(file, checksum);
    assert.strictEqual(ok.valid, true);

    const bad = verifyChecksum(file, 'sha256:deadbeef');
    assert.strictEqual(bad.valid, false);
  });
});

describe('storage', () => {
  it('crea y lee manifiestos de backup', () => {
    const folder = path.join(TMP_ROOT, 'backup-folder');
    fs.mkdirSync(folder, { recursive: true });

    const manifest = {
      id: '2026-06-05T10-00-00-000Z',
      createdAt: '2026-06-05T10:00:00.000Z',
      database: 'agustina',
      format: 'custom',
      filename: 'backup.dump',
      filenameExt: '.dump',
      sizeBytes: 100,
      checksum: 'sha256:abc',
    };

    writeManifest(folder, manifest);
    const loaded = readManifest(folder);
    assert.deepStrictEqual(loaded, manifest);
  });

  it('genera IDs de backup ordenables', () => {
    const id = createBackupId(new Date('2026-06-05T12:30:45.123Z'));
    assert.ok(id.includes('2026-06-05'));
    assert.ok(!id.includes(':'));
  });
});

describe('config', () => {
  it('resuelve BACKUP_DIR y formato', () => {
    withEnv(
      {
        BACKUP_DIR: path.join(TMP_ROOT, 'mis-backups'),
        BACKUP_FORMAT: 'plain',
        BACKUP_RETENTION_COUNT: '5',
      },
      () => {
        const config = getBackupConfig();
        assert.strictEqual(config.format, 'plain');
        assert.strictEqual(config.retentionCount, 5);
        assert.ok(config.dir.endsWith('mis-backups'));
      },
    );
  });

  it('rechaza BACKUP_FORMAT inválido', () => {
    withEnv({ BACKUP_FORMAT: 'invalid' }, () => {
      assert.throws(() => getBackupConfig(), /BACKUP_FORMAT inválido/);
    });
  });
});

describe('connection', () => {
  it('arma connection string desde DB_*', () => {
    withEnv(
      {
        DATABASE_URL: null,
        DB_USER: 'postgres',
        DB_PASSWORD: 'secret',
        DB_HOST: '127.0.0.1',
        DB_PORT: '5432',
        DB_NAME: 'agustina',
      },
      () => {
        const cs = buildConnectionString();
        assert.ok(cs.includes('postgresql://postgres:secret@127.0.0.1:5432/agustina'));
        assert.strictEqual(getDatabaseName(cs), 'agustina');
      },
    );
  });

  it('usa DATABASE_URL cuando está definida', () => {
    withEnv(
      {
        DATABASE_URL: 'postgresql://user:pass@host:5432/railway',
      },
      () => {
        assert.strictEqual(buildConnectionString(), 'postgresql://user:pass@host:5432/railway');
      },
    );
  });
});

describe('retention policy', () => {
  it('selecciona backups antiguos por cantidad', () => {
    const backups = [
      { id: 'b1', valid: true, createdAt: '2026-06-05T10:00:00.000Z' },
      { id: 'b2', valid: true, createdAt: '2026-06-04T10:00:00.000Z' },
      { id: 'b3', valid: true, createdAt: '2026-06-03T10:00:00.000Z' },
    ];

    const ids = selectBackupsForPrune(backups, { retentionCount: 2, retentionDays: null });
    assert.deepStrictEqual(ids, ['b3']);
  });

  it('selecciona backups antiguos por días', () => {
    const backups = [
      { id: 'recent', valid: true, createdAt: new Date().toISOString() },
      { id: 'old', valid: true, createdAt: '2020-01-01T00:00:00.000Z' },
    ];

    const ids = selectBackupsForPrune(backups, { retentionCount: 99, retentionDays: 7 });
    assert.deepStrictEqual(ids, ['old']);
  });
});

describe('backup file layout', () => {
  it('resuelve ruta del archivo de backup', () => {
    const folder = path.join(TMP_ROOT, 'layout');
    const file = getBackupFilePath(folder, '.dump');
    assert.strictEqual(file, path.join(folder, 'backup.dump'));
  });
});

describe('ciclo completo sin base de datos', () => {
  const backupRoot = path.join(TMP_ROOT, 'integration-backups');
  const backupId = '2026-06-05T15-00-00-000Z';

  before(() => {
    withEnv({ BACKUP_DIR: backupRoot, BACKUP_RETENTION_COUNT: '2' }, () => {
      ensureBackupRoot(backupRoot);
      const folder = getBackupFolder(backupRoot, backupId);
      fs.mkdirSync(folder, { recursive: true });
      const file = getBackupFilePath(folder, '.dump');
      fs.writeFileSync(file, 'fake-pg-dump-content-for-test');
      const checksum = computeFileChecksum(file);
      writeManifest(folder, {
        id: backupId,
        prefix: 'agustina',
        createdAt: '2026-06-05T15:00:00.000Z',
        database: 'agustina_test',
        format: 'custom',
        filename: 'backup.dump',
        filenameExt: '.dump',
        sizeBytes: fs.statSync(file).size,
        checksum,
        toolVersion: 'pg_dump test',
        connectionMode: 'DB_*',
      });
    });
  });

  it('lista backups simulados', () => {
    withEnv({ BACKUP_DIR: backupRoot }, () => {
      const backups = listBackups();
      assert.strictEqual(backups.length, 1);
      assert.strictEqual(backups[0].id, backupId);
      assert.strictEqual(backups[0].valid, true);
    });
  });

  it('valida integridad del backup simulado', async () => {
    const previous = process.env.BACKUP_DIR;
    process.env.BACKUP_DIR = backupRoot;
    try {
      const result = await validateBackupIntegrity(backupId);
      assert.strictEqual(result.valid, true);
    } finally {
      if (previous == null) delete process.env.BACKUP_DIR;
      else process.env.BACKUP_DIR = previous;
    }
  });

  it('elimina backup por ID', () => {
    withEnv({ BACKUP_DIR: backupRoot }, () => {
      deleteBackup(backupId);
      const backups = listBackups();
      assert.strictEqual(backups.length, 0);
    });
  });

  it('aplica prune según retención', () => {
    withEnv({ BACKUP_DIR: path.join(TMP_ROOT, 'prune-backups'), BACKUP_RETENTION_COUNT: '1' }, () => {
      const dir = getBackupConfig().dir;
      ensureBackupRoot(dir);

      ['b-new', 'b-old'].forEach((id, index) => {
        const folder = getBackupFolder(dir, id);
        fs.mkdirSync(folder, { recursive: true });
        const file = getBackupFilePath(folder, '.dump');
        fs.writeFileSync(file, `content-${id}`);
        writeManifest(folder, {
          id,
          createdAt: index === 0 ? '2026-06-05T12:00:00.000Z' : '2026-06-01T12:00:00.000Z',
          database: 'agustina_test',
          format: 'custom',
          filename: 'backup.dump',
          filenameExt: '.dump',
          sizeBytes: fs.statSync(file).size,
          checksum: computeFileChecksum(file),
        });
      });

      const result = pruneOldBackups();
      assert.strictEqual(result.deleted.length, 1);
      assert.strictEqual(result.deleted[0].id, 'b-old');
      assert.strictEqual(listBackups().length, 1);
    });
  });
});

after(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});
