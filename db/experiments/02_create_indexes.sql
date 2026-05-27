-- =============================================================================
-- 02_create_indexes.sql — Creación de índices de experimentación
-- Ejecutar DESPUÉS de registrar el baseline (01_baseline.sql).
--
-- Decisión de diseño: se eligen índices orientados a las queries del catálogo,
-- que son las que más tráfico generan en producción.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- IDX-1: Índice parcial en activo = TRUE
-- Justificación: el catálogo público siempre filtra por activo = TRUE.
-- Un índice parcial descarta de entrada las filas inactivas, reduciendo
-- el tamaño efectivo del índice y mejorando el Seq Scan en tablas grandes.
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_activos
    ON productos (subcategoria_id, created_at DESC)
    WHERE activo = TRUE;

COMMENT ON INDEX idx_productos_activos IS
    'Índice parcial para el catálogo público: solo filas activas, '
    'ordenadas por fecha descendente por subcategoría.';

-- ─────────────────────────────────────────────────────────────
-- IDX-2: Índice en created_at para el badge "NUEVO" (Q2)
-- Justificación: la query del badge filtra por rango de fecha reciente
-- y ordena por fecha. Sin este índice PostgreSQL hace Seq Scan + Sort.
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_created_at_desc
    ON productos (created_at DESC);

COMMENT ON INDEX idx_productos_created_at_desc IS
    'Índice para ordenamiento y filtros por fecha de creación (badge NUEVO, '
    'feeds ordenados por novedad).';

-- Verificar los índices creados
SELECT
    indexname   AS nombre,
    indexdef    AS definicion
FROM pg_indexes
WHERE tablename = 'productos'
ORDER BY indexname;
