'use strict';

const {
  createBackup,
  deleteBackup,
  getBackupConfig,
  listBackups,
  pruneOldBackups,
  restoreBackup,
  validateBackupIntegrity,
} = require('../lib/backup');

const COMMANDS = ['create', 'list', 'restore', 'delete', 'validate', 'prune'];

function printUsage() {
  console.log(`
Uso: node scripts/db-backup-cli.js <comando> [opciones]

Comandos:
  create              Crear un backup manual de PostgreSQL
  list                Listar backups disponibles
  restore <id>        Restaurar un backup por ID
  delete <id>         Eliminar un backup por ID
  validate [id]       Validar integridad (uno o todos)
  prune               Eliminar backups según política de retención

Opciones:
  --force             Restaurar sin confirmación interactiva
  --dry-run           Simular restore sin aplicar cambios
  --skip-validation   Restaurar sin validar checksum (no recomendado)

Variables de entorno (ver .env.example):
  BACKUP_DIR, BACKUP_FORMAT, BACKUP_RETENTION_COUNT, BACKUP_RETENTION_DAYS
  DATABASE_URL o DB_* , DATABASE_SSL

Ejemplos:
  npm run db:backup
  npm run db:backup:list
  npm run db:backup:validate
  npm run db:backup:restore -- 2026-06-05T12-00-00-000Z
  npm run db:backup:delete -- 2026-06-05T12-00-00-000Z
  npm run db:backup:prune
`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function positionalArgs(args) {
  return args.filter((arg) => !arg.startsWith('--'));
}

async function confirmRestore(id) {
  if (process.env.BACKUP_RESTORE_CONFIRM === 'yes') return true;
  if (!process.stdin.isTTY) {
    throw new Error(
      'Restore en entorno no interactivo requiere --force o BACKUP_RESTORE_CONFIRM=yes',
    );
  }

  process.stdout.write(
    `⚠️  Restaurar "${id}" SOBRESCRIBIRÁ datos en la base configurada. Escribí "RESTORE" para continuar: `,
  );

  return new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (data) => {
      resolve(data.trim() === 'RESTORE');
    });
  });
}

async function cmdCreate() {
  const config = getBackupConfig();
  console.log(`Creando backup (formato: ${config.format})...`);
  const result = await createBackup();
  console.log('✓ Backup creado');
  console.log(`  ID:       ${result.id}`);
  console.log(`  Archivo:  ${result.file}`);
  console.log(`  Tamaño:   ${formatBytes(result.manifest.sizeBytes)}`);
  console.log(`  Checksum: ${result.manifest.checksum}`);
}

function cmdList() {
  const backups = listBackups();

  if (backups.length === 0) {
    console.log('No hay backups disponibles.');
    return;
  }

  console.log(`Backups disponibles (${backups.length}):\n`);
  backups.forEach((b) => {
    if (!b.valid) {
      console.log(`- ${b.id} [INVÁLIDO] ${b.error || 'archivo faltante'}`);
      return;
    }
    console.log(
      `- ${b.id} | ${b.createdAt} | ${b.database} | ${b.format} | ${formatBytes(b.sizeBytes)}`,
    );
  });
}

async function cmdRestore(args) {
  const [id] = positionalArgs(args);
  if (!id) throw new Error('Falta el ID del backup. Uso: restore <id>');

  const force = hasFlag(args, '--force');
  const dryRun = hasFlag(args, '--dry-run');
  const skipValidation = hasFlag(args, '--skip-validation');

  if (!dryRun && !force) {
    const confirmed = await confirmRestore(id);
    if (!confirmed) {
      console.log('Restore cancelado.');
      return;
    }
  }

  console.log(dryRun ? `Simulando restore de ${id}...` : `Restaurando ${id}...`);
  const result = await restoreBackup(id, { skipValidation, dryRun });

  if (result.dryRun) {
    console.log('✓ Dry-run completado (sin cambios en la base)');
    console.log(`  Base:    ${result.database}`);
    console.log(`  Archivo: ${result.file}`);
    return;
  }

  console.log('✓ Restore completado');
  console.log(`  Base:      ${result.database}`);
  console.log(`  Restaurado: ${result.restoredAt}`);
}

async function cmdDelete(args) {
  const [id] = positionalArgs(args);
  if (!id) throw new Error('Falta el ID del backup. Uso: delete <id>');

  const result = deleteBackup(id);
  console.log(`✓ Backup eliminado: ${result.id}`);
}

async function cmdValidate(args) {
  const [id] = positionalArgs(args);
  const backups = id ? [{ id }] : listBackups().filter((b) => b.valid || b.id);

  if (backups.length === 0) {
    console.log('No hay backups para validar.');
    return;
  }

  let validCount = 0;

  for (const backup of backups) {
    try {
      const result = await validateBackupIntegrity(backup.id);
      if (result.valid) {
        validCount += 1;
        console.log(`✓ ${backup.id} — integridad OK (${formatBytes(result.sizeBytes)})`);
      } else {
        console.log(`✗ ${backup.id} — ${result.reason}`);
      }
    } catch (err) {
      console.log(`✗ ${backup.id} — ${err.message}`);
    }
  }

  console.log(`\nResumen: ${validCount}/${backups.length} backups válidos`);
  if (validCount !== backups.length) process.exitCode = 1;
}

function cmdPrune() {
  const result = pruneOldBackups();
  if (result.deleted.length === 0) {
    console.log('No hay backups para eliminar según la política de retención.');
    return;
  }

  console.log(`✓ Eliminados ${result.deleted.length} backup(s):`);
  result.deleted.forEach((entry) => console.log(`  - ${entry.id}`));
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    return;
  }

  if (!COMMANDS.includes(command)) {
    printUsage();
    throw new Error(`Comando desconocido: ${command}`);
  }

  switch (command) {
    case 'create':
      await cmdCreate();
      break;
    case 'list':
      cmdList();
      break;
    case 'restore':
      await cmdRestore(args);
      break;
    case 'delete':
      await cmdDelete(args);
      break;
    case 'validate':
      await cmdValidate(args);
      break;
    case 'prune':
      cmdPrune();
      break;
    default:
      printUsage();
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
