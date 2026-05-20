-- =============================================================================
-- 04_drop_indexes.sql — Limpieza: eliminar los índices de experimento
-- Ejecutar solo si necesitás volver al estado baseline (ej. para repetir
-- las mediciones o si la migración definitiva los re-crea).
-- Los índices de PRODUCCIÓN se manejan desde db/migrations/, no desde acá.
-- =============================================================================

DROP INDEX IF EXISTS idx_productos_activos;
DROP INDEX IF EXISTS idx_productos_created_at_desc;

-- Confirmar que quedaron solo los índices originales
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'productos'
ORDER BY indexname;
