-- =============================================================================
-- D_disk_sizing.sql — Dimensionamiento en disco (Persona D)
--
-- Ejecutar contra la base de Railway después de cargar datos de volumen
-- (seed de Persona B) y, si corresponde al informe, en dos momentos:
--   A) después de 01_baseline.sql (solo índice FK en productos)
--   B) después de 02_create_indexes.sql (índices de experimentación)
--
-- Uso:
--   psql $DATABASE_URL -f db/experiments/D_disk_sizing.sql
--
-- Nota: pg_stat_user_indexes acumula desde el último reset del servidor o
-- desde CREATE INDEX / reinicio. Para comparar uso de índices entre pruebas,
-- anotar idx_scan justo antes y después de correr 03_with_indexes.sql.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCTOS — tamaños agregados
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tamaño total: heap + todos los índices + TOAST asociado a la relación.
SELECT pg_size_pretty(pg_total_relation_size('productos')) AS productos_tamanio_total;

-- 2. Tamaño del heap (solo filas almacenadas en la tabla principal).
SELECT pg_size_pretty(pg_relation_size('productos')) AS productos_tamanio_heap;

-- 3. Suma del espacio de todos los índices de la tabla (sin contar el heap).
SELECT pg_size_pretty(pg_indexes_size('productos')) AS productos_tamanio_indices_total;

-- 4. Desglose por índice: útil para ver cuánto ocupa cada uno (PK, FK, parciales…).
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS tamanio
FROM pg_indexes
WHERE tablename = 'productos'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- CATEGORIAS — mismas métricas que productos
-- ─────────────────────────────────────────────────────────────────────────────

SELECT pg_size_pretty(pg_total_relation_size('categorias')) AS categorias_tamanio_total;

SELECT pg_size_pretty(pg_relation_size('categorias')) AS categorias_tamanio_heap;

SELECT pg_size_pretty(pg_indexes_size('categorias')) AS categorias_tamanio_indices_total;

SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS tamanio
FROM pg_indexes
WHERE tablename = 'categorias'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- SUBCATEGORIAS — mismas métricas que productos
-- ─────────────────────────────────────────────────────────────────────────────

SELECT pg_size_pretty(pg_total_relation_size('subcategorias')) AS subcategorias_tamanio_total;

SELECT pg_size_pretty(pg_relation_size('subcategorias')) AS subcategorias_tamanio_heap;

SELECT pg_size_pretty(pg_indexes_size('subcategorias')) AS subcategorias_tamanio_indices_total;

SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS tamanio
FROM pg_indexes
WHERE tablename = 'subcategorias'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCTOS — uso de índices (catálogo de estadísticas)
-- idx_scan: cuántas veces el planificador eligió ese índice para un scan.
-- idx_tup_read / idx_tup_fetch: filas leídas desde el índice / recuperadas de la tabla.
-- Valores en 0 tras un deploy nuevo no implican que el índice sea inútil, solo que
-- aún no se ejecutaron queries que lo usen en esta instancia.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
    schemaname,
    relname AS tablename,
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'productos'
ORDER BY idx_scan DESC, indexrelname;

-- ─────────────────────────────────────────────────────────────────────────────
-- Resumen comparativo (opcional): las tres tablas en una sola salida
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
    relname AS tabla,
    pg_size_pretty(pg_relation_size(oid))        AS heap,
    pg_size_pretty(pg_indexes_size(oid))        AS indices,
    pg_size_pretty(pg_total_relation_size(oid)) AS total
FROM pg_class
WHERE relname IN ('categorias', 'subcategorias', 'productos')
  AND relkind = 'r'
ORDER BY pg_total_relation_size(oid) DESC;
