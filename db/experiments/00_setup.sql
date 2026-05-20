-- =============================================================================
-- 00_setup.sql — Verificación de entorno antes de correr los experimentos
-- Ejecutar primero para confirmar que las tablas y datos están listos.
-- =============================================================================

-- 1. Contar filas por tabla
SELECT 'categorias'   AS tabla, COUNT(*) AS filas FROM categorias
UNION ALL
SELECT 'subcategorias',          COUNT(*)          FROM subcategorias
UNION ALL
SELECT 'productos',              COUNT(*)          FROM productos;

-- 2. Índices existentes en "productos" (antes de los experimentos)
SELECT
    indexname                          AS nombre_indice,
    indexdef                           AS definicion
FROM pg_indexes
WHERE tablename = 'productos'
ORDER BY indexname;

-- 3. Tamaño actual de la tabla e índices
SELECT
    pg_size_pretty(pg_total_relation_size('productos')) AS tamanio_total,
    pg_size_pretty(pg_relation_size('productos'))       AS tamanio_tabla,
    pg_size_pretty(pg_indexes_size('productos'))        AS tamanio_indices;
