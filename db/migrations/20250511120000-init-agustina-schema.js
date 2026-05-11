'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Aplica el mismo DDL que `db/schema.sql` para mantener una sola fuente de verdad.
 * Quita BEGIN/COMMIT porque sequelize-cli ya envuelve la migración en transacción.
 */
function loadSchemaSql() {
  const filePath = path.join(__dirname, '..', 'schema.sql');
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => !/^\s*BEGIN\s*;?\s*$/i.test(line) && !/^\s*COMMIT\s*;?\s*$/i.test(line))
    .join('\n');
}

module.exports = {
  async up(queryInterface) {
    const sql = loadSchemaSql();
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP VIEW IF EXISTS v_productos_catalogo CASCADE;
      DROP TABLE IF EXISTS productos CASCADE;
      DROP TABLE IF EXISTS subcategorias CASCADE;
      DROP TABLE IF EXISTS categorias CASCADE;
    `);
  },
};
