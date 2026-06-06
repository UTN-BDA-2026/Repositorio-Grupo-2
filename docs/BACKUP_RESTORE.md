# Sistema de Backup y Restore — AGUSTINA

Guía operativa del módulo `lib/backup/` para respaldar y recuperar la base PostgreSQL del proyecto.

## Requisitos

- Node.js >= 18
- Cliente PostgreSQL instalado (`pg_dump`, `pg_restore`, `psql`)
- Variables de conexión en `.env` (ver `.env.example`)

## Comandos rápidos

```bash
# Crear backup manual
npm run db:backup

# Listar backups
npm run db:backup:list

# Validar integridad de todos los backups
npm run db:backup:validate

# Validar un backup específico
npm run db:backup:validate -- 2026-06-05T12-00-00-000Z

# Restaurar (pide confirmación escribiendo RESTORE)
npm run db:backup:restore -- <id>

# Restaurar sin confirmación (CI/scripts)
npm run db:backup:restore -- <id> --force

# Simular restore sin tocar la base
npm run db:backup:restore -- <id> --dry-run

# Eliminar un backup
npm run db:backup:delete -- <id>

# Aplicar política de retención
npm run db:backup:prune

# Ejecutar tests unitarios
npm test
```

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `BACKUP_DIR` | `./backups` | Directorio de almacenamiento |
| `BACKUP_FORMAT` | `custom` | `custom` (`.dump`) o `plain` (`.sql.gz`) |
| `BACKUP_PREFIX` | `agustina` | Prefijo lógico en metadatos |
| `BACKUP_RETENTION_COUNT` | `10` | Máximo de backups a conservar |
| `BACKUP_RETENTION_DAYS` | — | Eliminar backups más viejos que N días |
| `BACKUP_RESTORE_CONFIRM` | — | `yes` para saltar confirmación interactiva |
| `PG_DUMP_PATH` | `pg_dump` | Ruta al binario pg_dump |
| `PG_RESTORE_PATH` | `pg_restore` | Ruta al binario pg_restore |
| `PSQL_PATH` | `psql` | Ruta al binario psql |

Reutiliza las variables de conexión existentes: `DATABASE_URL`, `DB_*`, `DATABASE_SSL`.

## Estructura de almacenamiento

```
backups/
└── 2026-06-05T14-30-00-000Z/
    ├── backup.dump      # o backup.sql.gz
    └── manifest.json    # metadatos + checksum SHA-256
```

## Flujo interno

### Crear backup

1. Lee configuración y conexión desde `.env`.
2. Ejecuta `pg_dump` (formato custom o plain comprimido).
3. Calcula checksum SHA-256 del archivo.
4. Escribe `manifest.json` con metadatos.

### Restaurar

1. Valida checksum y tamaño contra el manifiesto.
2. Pide confirmación (`RESTORE`) salvo `--force`.
3. Ejecuta `pg_restore` (custom) o `psql` (plain).
4. Usa `--clean --if-exists` para reemplazar objetos existentes.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Sobrescribir datos en restore | Confirmación interactiva / `--dry-run` |
| Backup corrupto | Checksum SHA-256 en manifiesto + `validate` |
| Disco lleno | Monitorear `BACKUP_DIR`; usar `prune` |
| Falta de `pg_dump` | Verificar instalación del cliente PostgreSQL |
| SSL en Railway | `DATABASE_SSL=true` + `PGSSLMODE=require` |
| Restore en prod accidental | Usar base de staging; revisar `DATABASE_URL` antes |
