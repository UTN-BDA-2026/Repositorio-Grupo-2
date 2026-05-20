'use strict';

/**
 * Migración: índices de rendimiento para el catálogo público (Persona C).
 *
 * IDX-1 idx_productos_activos
 *   Índice parcial (WHERE activo = TRUE) sobre (subcategoria_id, created_at DESC).
 *   Cubre la query del catálogo público: filtra por categoría y activo,
 *   ordena por novedad. Al ser parcial, excluye filas inactivas y ocupa
 *   menos espacio en disco que un índice completo.
 *
 * IDX-2 idx_productos_created_at_desc
 *   Índice sobre created_at DESC para el badge "NUEVO" (productos de los
 *   últimos 14 días) y cualquier listado ordenado por fecha de carga.
 *   Evita un Sort en memoria cuando la query no filtra por subcategoría.
 */
module.exports = {
  async up(queryInterface) {
    // IDX-1: índice parcial para catálogo público
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_productos_activos
        ON productos (subcategoria_id, created_at DESC)
        WHERE activo = TRUE;

      COMMENT ON INDEX idx_productos_activos IS
        'Índice parcial para el catálogo público: solo filas activas, '
        'ordenadas por fecha descendente por subcategoría.';
    `);

    // IDX-2: índice para ordenamiento por fecha de creación
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_productos_created_at_desc
        ON productos (created_at DESC);

      COMMENT ON INDEX idx_productos_created_at_desc IS
        'Índice para el badge NUEVO y listados ordenados por novedad.';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_productos_activos;
      DROP INDEX IF EXISTS idx_productos_created_at_desc;
    `);
  },
};
