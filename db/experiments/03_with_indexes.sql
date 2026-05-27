-- =============================================================================
-- 03_with_indexes.sql — Mismas queries del baseline CON los índices nuevos
-- Ejecutar DESPUÉS de 02_create_indexes.sql.
-- Copiar cada salida y compararla con la de 01_baseline.sql en el informe.
--
-- Nota: si los planes no cambian, forzar recarga de estadísticas:
--   ANALYZE productos;
-- =============================================================================

-- Refrescar estadísticas para que el planner use los índices recién creados
ANALYZE productos;

-- ─────────────────────────────────────────────────────────────
-- Q1 CON ÍNDICE — Catálogo por categoría, solo activos
-- Se espera: Index Scan o Bitmap Index Scan usando idx_productos_activos
-- en lugar del Seq Scan del baseline.
-- ─────────────────────────────────────────────────────────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
    p.id,
    p.nombre        AS name,
    p.precio        AS price,
    p.precio_efectivo,
    c.slug          AS cat,
    s.slug          AS sub,
    p.image_url,
    p.images,
    p.descripcion,
    p.created_at
FROM productos      p
JOIN subcategorias  s ON s.id = p.subcategoria_id
JOIN categorias     c ON c.id = s.categoria_id
WHERE p.activo = TRUE
  AND c.slug   = 'indumentaria'
ORDER BY p.created_at DESC;

-- ─────────────────────────────────────────────────────────────
-- Q2 CON ÍNDICE — Badge "NUEVO" (últimos 14 días, activos)
-- Se espera: Index Scan usando idx_productos_created_at_desc sin Sort.
-- ─────────────────────────────────────────────────────────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
    p.id,
    p.nombre,
    p.precio,
    p.image_url,
    p.created_at
FROM productos p
WHERE p.activo     = TRUE
  AND p.created_at >= now() - INTERVAL '14 days'
ORDER BY p.created_at DESC;

-- ─────────────────────────────────────────────────────────────
-- Q3 CON ÍNDICE — Panel admin: todos los productos con join
-- Se espera: mejora menor que en Q1/Q2 porque trae activos e inactivos
-- (el índice parcial no aplica acá, pero idx_created_at_desc sí al Sort).
-- ─────────────────────────────────────────────────────────────
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
    p.id,
    p.nombre,
    p.precio,
    p.activo,
    c.slug  AS cat,
    s.slug  AS sub,
    p.created_at
FROM productos      p
JOIN subcategorias  s ON s.id = p.subcategoria_id
JOIN categorias     c ON c.id = s.categoria_id
ORDER BY p.created_at DESC;
