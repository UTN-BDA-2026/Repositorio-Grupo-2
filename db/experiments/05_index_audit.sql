-- =============================================================================
-- 05_index_audit.sql — Auditoría de índices (Persona E)
--
-- Ejecutar DESPUÉS de 03_with_indexes.sql (índices de experimentación creados)
-- y de haber corrido al menos una vez las queries de 01/03 para que pg_stat
-- refleje uso (idx_scan > 0).
--
-- Uso:
--   psql $DATABASE_URL -f db/experiments/05_index_audit.sql
-- =============================================================================

\echo '=== 1. Inventario de índices en productos ==='
SELECT
    i.indexname,
    i.indexdef,
    pg_size_pretty(pg_relation_size(i.indexname::regclass)) AS tamanio
FROM pg_indexes i
WHERE i.tablename = 'productos'
ORDER BY pg_relation_size(i.indexname::regclass) DESC;

\echo '=== 2. Uso acumulado (pg_stat_user_indexes) ==='
SELECT
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS tamanio
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname = 'productos'
ORDER BY idx_scan DESC, indexrelname;

\echo '=== 3. Índices nunca usados desde último reset (candidatos a revisar) ==='
SELECT
    indexrelname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS tamanio
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND relname = 'productos'
  AND idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

\echo '=== 4. Columnas duplicadas entre índices (prefijo / solapamiento) ==='
-- Detecta pares donde las columnas indexadas de A son prefijo de B (posible redundancia).
WITH idx_cols AS (
    SELECT
        c.oid,
        c.relname AS index_name,
        array_agg(a.attname ORDER BY k.n) AS cols
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, n) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE t.relname = 'productos'
      AND c.relkind = 'i'
    GROUP BY c.oid, c.relname
)
SELECT
    a.index_name AS indice_a,
    b.index_name AS indice_b,
    a.cols       AS columnas_a,
    b.cols       AS columnas_b,
    'A es prefijo de B — revisar si ambos son necesarios' AS nota
FROM idx_cols a
JOIN idx_cols b ON a.oid <> b.oid
WHERE a.cols = b.cols[1:array_length(a.cols, 1)]
ORDER BY a.index_name, b.index_name;

\echo '=== 5. Propuesta hipotética: índice parcial solo por fecha (Q2) ==='
-- No crea nada; muestra el DDL alternativo discutido en informe/seccion_E.md.
SELECT $ddl$
-- Alternativa más chica que idx_productos_created_at_desc para el badge NUEVO:
-- CREATE INDEX idx_productos_nuevos_activos
--   ON productos (created_at DESC)
--   WHERE activo = TRUE;
$ddl$ AS ddl_alternativo_q2;

\echo '=== 6. EXPLAIN sin ejecutar: qué índice elegiría el planner (Q1/Q2/Q3) ==='
EXPLAIN (FORMAT TEXT)
SELECT p.id FROM productos p
JOIN subcategorias s ON s.id = p.subcategoria_id
JOIN categorias c ON c.id = s.categoria_id
WHERE p.activo = TRUE AND c.slug = 'indumentaria'
ORDER BY p.created_at DESC;

EXPLAIN (FORMAT TEXT)
SELECT p.id FROM productos p
WHERE p.activo = TRUE
  AND p.created_at >= now() - INTERVAL '14 days'
ORDER BY p.created_at DESC;

EXPLAIN (FORMAT TEXT)
SELECT p.id FROM productos p
JOIN subcategorias s ON s.id = p.subcategoria_id
JOIN categorias c ON c.id = s.categoria_id
ORDER BY p.created_at DESC;
