-- =============================================================================
-- 01_baseline.sql — Planes de consulta SIN índices adicionales (línea base)
-- Ejecutar ANTES de crear ningún índice nuevo (solo existe el índice de FK).
--
-- Para cada query:
--   1. Copiar el resultado de EXPLAIN (ANALYZE, BUFFERS) completo al informe.
--   2. Anotar: Planning Time, Execution Time, tipo de nodo raíz, Buffers hit/read.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────
-- Q1: Catálogo público — todos los productos activos de una
--     categoría específica (lo que hace el frontend al filtrar).
--     Ruta crítica: FK join productos → subcategorias → categorias.
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
-- Q2: Badge "NUEVO" — productos creados en los últimos 14 días
--     activos (usado en la home y en las cards del catálogo).
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
-- Q3: Admin — listar TODOS los productos (activos e inactivos)
--     con su categoría y subcategoría para el panel de gestión.
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
