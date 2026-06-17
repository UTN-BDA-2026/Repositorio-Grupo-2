'use strict';

/**
 * Genera métricas de disco e idx_scan para informe/seccion_E.md
 * y opcionalmente actualiza secciones. Ejecutar: node scripts/run-informe-de.js
 */
require('dotenv').config();
const { sequelize } = require('../db/models');

const QUERIES = [
  `SELECT p.id FROM productos p
   JOIN subcategorias s ON s.id = p.subcategoria_id
   JOIN categorias c ON c.id = s.categoria_id
   WHERE p.activo = TRUE AND c.slug = 'indumentaria'
   ORDER BY p.created_at DESC`,
  `SELECT p.id FROM productos p
   WHERE p.activo = TRUE AND p.created_at >= now() - INTERVAL '14 days'
   ORDER BY p.created_at DESC`,
  `SELECT p.id FROM productos p
   JOIN subcategorias s ON s.id = p.subcategoria_id
   JOIN categorias c ON c.id = s.categoria_id
   ORDER BY p.created_at DESC`,
];

async function main() {
  await sequelize.authenticate();
  for (const sql of QUERIES) {
    await sequelize.query(sql);
  }

  const [sizes] = await sequelize.query(`
    SELECT relname AS tabla,
      pg_size_pretty(pg_relation_size(oid)) AS heap,
      pg_size_pretty(pg_indexes_size(oid)) AS indices,
      pg_size_pretty(pg_total_relation_size(oid)) AS total
    FROM pg_class
    WHERE relname IN ('categorias', 'subcategorias', 'productos') AND relkind = 'r'
    ORDER BY pg_total_relation_size(oid) DESC`);

  const [idxStats] = await sequelize.query(`
    SELECT indexrelname, idx_scan,
      pg_size_pretty(pg_relation_size(indexrelid)) AS tamanio
    FROM pg_stat_user_indexes
    WHERE relname = 'productos'
    ORDER BY indexrelname`);

  console.log(JSON.stringify({ sizes, idxStats }, null, 2));
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
