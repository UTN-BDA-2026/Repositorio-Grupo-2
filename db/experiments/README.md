# Experimentos SQL — Persona E (reproducibles)

Scripts numerados para que **cualquier integrante** repita la batería de `EXPLAIN` y la auditoría de índices sobre la misma base (PostgreSQL en Railway + datos del seed).

## Prerrequisitos

1. `.env` con `DATABASE_URL` (y `DATABASE_SSL=true` en Windows → Railway).
2. `npm install` y `npx sequelize-cli db:migrate`
3. Datos de volumen: `npx sequelize-cli db:seed:all` (Persona B). Sin filas, los planes serán triviales.
4. Cliente `psql` instalado **o** ejecutar el SQL desde DBeaver / pgAdmin pegando cada archivo.

## Orden de ejecución

| Paso | Archivo | Qué hace |
|------|---------|----------|
| 0 | `00_setup.sql` | Cuenta filas, lista índices y tamaños iniciales |
| 1 | `01_baseline.sql` | `EXPLAIN (ANALYZE, BUFFERS)` **sin** índices IDX-1/IDX-2 |
| 2 | `02_create_indexes.sql` | Crea `idx_productos_activos` e `idx_productos_created_at_desc` |
| 3 | `03_with_indexes.sql` | Mismas queries que (1), con índices + `ANALYZE` |
| 4 | `04_drop_indexes.sql` | Opcional: limpia índices de experimento para repetir |
| 5 | `05_index_audit.sql` | Inventario, uso (`idx_scan`), solapamientos, `EXPLAIN` de coste |

**Persona D (dimensionamiento):** `D_disk_sizing.sql` — correr en baseline y tras paso 2.

**Producción:** los índices definitivos viven en la migración `db/migrations/20250520130000-add-catalog-indexes.js`. Los scripts `02`/`04` sirven para repetir mediciones sin tocar migraciones.

## Comandos (bash / Git Bash)

```bash
export DATABASE_URL="postgresql://..."
psql "$DATABASE_URL" -f db/experiments/00_setup.sql
psql "$DATABASE_URL" -f db/experiments/01_baseline.sql
psql "$DATABASE_URL" -f db/experiments/02_create_indexes.sql
psql "$DATABASE_URL" -f db/experiments/03_with_indexes.sql
psql "$DATABASE_URL" -f db/experiments/05_index_audit.sql
```

## Windows (PowerShell)

Si `psql` no está en el PATH, usar la consola SQL de Railway o DBeaver. Con `psql`:

```powershell
$env:PGSSLMODE = "require"
psql $env:DATABASE_URL -f db/experiments/00_setup.sql
```

## Salidas para el informe

| Persona | Qué pegar |
|---------|-----------|
| C | Salida completa de `01_baseline.sql` y `03_with_indexes.sql` |
| D | Tablas de `D_disk_sizing.sql` + análisis en `informe/seccion_D.md` |
| E | Resultados de `05_index_audit.sql` + `informe/seccion_E.md` |
