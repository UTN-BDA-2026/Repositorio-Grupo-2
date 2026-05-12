'use strict';

const { QueryTypes } = require('sequelize');

/**
 * Volumen para EXPLAIN / índices: productos sintéticos con prefijo [seed-exp] en nombre.
 *
 * Cantidad: variable de entorno SEED_PRODUCT_COUNT (default 15000). Ej.: 50000
 * Requiere haber corrido antes el seeder de taxonomía (subcategorias no vacía).
 *
 * Inserción en chunks para no saturar memoria en Railway.
 */
const DEFAULT_COUNT = 15000;
const CHUNK_SIZE = 5000;

function parseCount() {
  const raw = process.env.SEED_PRODUCT_COUNT;
  if (raw == null || String(raw).trim() === '') return DEFAULT_COUNT;
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_COUNT;
  return Math.min(n, 500000);
}

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const total = parseCount();
    if (total === 0) {
      // eslint-disable-next-line no-console
      console.log('[seed-experiment-productos-bulk] SEED_PRODUCT_COUNT=0, se omite inserción.');
      return;
    }

    const countRows = await sequelize.query(`SELECT count(*)::int AS cnt FROM subcategorias;`, {
      type: QueryTypes.SELECT,
    });
    const cnt = Number(countRows[0]?.cnt ?? 0);
    if (!cnt) {
      throw new Error(
        '[seed-experiment-productos-bulk] No hay subcategorías. Ejecutá antes: npx sequelize-cli db:seed --seed 20250511140001-seed-catalogo-taxonomia.js'
      );
    }

    await sequelize.query(`DELETE FROM productos WHERE nombre LIKE '[seed-exp] %';`);

    // eslint-disable-next-line no-console
    console.log(
      `[seed-experiment-productos-bulk] Insertando ${total} filas en bloques de ${CHUNK_SIZE}…`
    );

    for (let start = 1; start <= total; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, total);
      const subCount = Number(cnt);
      const a = Number(start);
      const b = Number(end);
      await sequelize.query(
        `
        INSERT INTO productos (
          nombre, precio, precio_efectivo, subcategoria_id,
          image_url, images, descripcion, activo, created_at, updated_at
        )
        SELECT
          '[seed-exp] Artículo ' || i::text,
          (1500 + (i * 37) % 120000)::int,
          CASE WHEN i % 11 = 0 THEN NULL ELSE (1000 + (i * 19) % 45000)::int END,
          pick.sub_id,
          'https://placehold.co/600x800/png?text=' || ((i % 9000) + 1)::text,
          ARRAY[
            'https://placehold.co/600x800/png?text=a' || ((i % 9000) + 1)::text,
            'https://placehold.co/600x800/png?text=b' || ((i % 9000) + 1)::text
          ]::text[],
          'Seed experimento índices / planes. Fila ' || i::text || '.',
          ((i % 17) <> 0),
          (now() - ((i % 900)::text || ' days')::interval
                 - ((i % 86400)::text || ' seconds')::interval),
          (now() - ((i % 120)::text || ' days')::interval)
        FROM generate_series($1, $2) AS i
        CROSS JOIN LATERAL (
          SELECT s.id AS sub_id
          FROM subcategorias s
          ORDER BY s.id
          OFFSET ((i::bigint - 1) % $3::int)
          LIMIT 1
        ) pick;
        `,
        { bind: [a, b, subCount] }
      );
    }

    await sequelize.query(`ANALYZE productos;`);
    // eslint-disable-next-line no-console
    console.log('[seed-experiment-productos-bulk] ANALYZE productos hecho.');
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(`DELETE FROM productos WHERE nombre LIKE '[seed-exp] %';`);
    await sequelize.query(`ANALYZE productos;`);
  },
};
