'use strict';

/**
 * Importa productos de demostración desde JSON a PostgreSQL.
 * Opt-in: no se ejecuta en migrate/seed/dev. Marca filas con prefijo [demo-json] en nombre.
 *
 * Uso:
 *   node scripts/import-demo-products.js
 *   node scripts/import-demo-products.js --clean
 *   node scripts/import-demo-products.js --undo
 *   node scripts/import-demo-products.js --dry-run
 *   node scripts/import-demo-products.js --file ruta/al/archivo.json
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const DEMO_MARKER = '[demo-json]';
const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'productos-demo.json');

function usage() {
  console.log(`
Importar productos demo (JSON → PostgreSQL)

  npm run db:import-demo
  npm run db:import-demo -- --clean
  npm run db:import-demo -- --undo
  npm run db:import-demo -- --dry-run
  npm run db:import-demo -- --file data/productos-demo.json

Opciones:
  --clean    Borra importaciones previas [demo-json] e importa de nuevo (transacción)
  --undo     Solo elimina filas importadas con prefijo [demo-json]
  --dry-run  Muestra qué haría sin escribir en la base
  --file     Ruta al JSON (default: data/productos-demo.json o DEMO_IMPORT_FILE)
  --help     Esta ayuda
`);
}

function parseArgs(argv) {
  const opts = {
    clean: false,
    undo: false,
    dryRun: false,
    help: false,
    file: process.env.DEMO_IMPORT_FILE || DEFAULT_FILE,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--clean') opts.clean = true;
    else if (arg === '--undo') opts.undo = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--file') {
      opts.file = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`Opción desconocida: ${arg}`);
    }
  }

  if (opts.clean && opts.undo) {
    throw new Error('Usá --clean o --undo, no ambos.');
  }

  return opts;
}

function markedName(name) {
  const base = String(name || '').trim();
  if (!base) return '';
  if (base.startsWith(`${DEMO_MARKER} `)) return base;
  return `${DEMO_MARKER} ${base}`;
}

function readProducts(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Archivo no encontrado: ${abs}`);
  }

  const raw = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('El JSON debe ser un array de productos');
  }
  return { abs, products: data };
}

function parseCreatedAt(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeProduct(row, index) {
  const name = String(row.name || '').trim();
  if (!name) {
    throw new Error(`Fila ${index + 1}: falta name`);
  }

  const price = Number(row.price);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Fila ${index + 1} (${name}): price inválido`);
  }

  const imageUrl = row.image_url;
  if (!imageUrl) {
    throw new Error(`Fila ${index + 1} (${name}): falta image_url`);
  }

  const images =
    Array.isArray(row.images) && row.images.length ? row.images : [imageUrl];

  const precioEfectivo =
    row.precio_efectivo != null && row.precio_efectivo !== ''
      ? Number(row.precio_efectivo)
      : null;

  if (precioEfectivo != null && (!Number.isFinite(precioEfectivo) || precioEfectivo < 0)) {
    throw new Error(`Fila ${index + 1} (${name}): precio_efectivo inválido`);
  }

  return {
    name: markedName(name),
    price,
    precio_efectivo: precioEfectivo,
    cat: String(row.cat || '').trim(),
    sub: String(row.sub || '').trim(),
    image_url: imageUrl,
    images,
    descripcion: row.descripcion ?? null,
    activo: row.activo != null ? Boolean(row.activo) : true,
    created_at: parseCreatedAt(row.created_at),
  };
}

async function countDemoRows(sequelize, transaction) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*)::int AS n FROM productos WHERE nombre LIKE $1`,
    { bind: [`${DEMO_MARKER} %`], transaction }
  );
  return Number(rows[0].n);
}

async function deleteDemoRows(sequelize, transaction) {
  await sequelize.query(`DELETE FROM productos WHERE nombre LIKE $1`, {
    bind: [`${DEMO_MARKER} %`],
    transaction,
  });
}

async function productExists(sequelize, nombre, transaction) {
  const [rows] = await sequelize.query(
    `SELECT id FROM productos WHERE nombre = $1 LIMIT 1`,
    { bind: [nombre], transaction }
  );
  return rows.length > 0;
}

async function insertProduct(sequelize, product, subcategoriaId, transaction) {
  const createdAt = product.created_at || new Date().toISOString();
  await sequelize.query(
    `
    INSERT INTO productos (
      nombre, precio, precio_efectivo, subcategoria_id,
      image_url, images, descripcion, activo, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6::text[], $7, $8, $9::timestamptz, NOW()
    )
    `,
    {
      bind: [
        product.name,
        product.price,
        product.precio_efectivo,
        subcategoriaId,
        product.image_url,
        product.images,
        product.descripcion,
        product.activo,
        createdAt,
      ],
      transaction,
    }
  );
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    usage();
    return;
  }

  const { abs, products: rawProducts } = readProducts(opts.file);
  const products = rawProducts.map(normalizeProduct);

  if (opts.dryRun) {
    console.log(`[dry-run] Archivo: ${abs}`);
    console.log(`[dry-run] Productos en JSON: ${products.length}`);
    if (opts.undo) console.log('[dry-run] Acción: DELETE filas con prefijo [demo-json]');
    else if (opts.clean) {
      console.log('[dry-run] Acción: DELETE previas [demo-json] + INSERT todas');
    } else {
      console.log('[dry-run] Acción: INSERT omitiendo nombres [demo-json] ya existentes');
    }
    products.slice(0, 3).forEach((p) => {
      console.log(`  · ${p.name} (${p.cat}${p.sub ? ` / ${p.sub}` : ''}) — $${p.price}`);
    });
    if (products.length > 3) console.log(`  … y ${products.length - 3} más`);
    return;
  }

  if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
    throw new Error('DATABASE_URL no configurada. Copiá .env.example a .env y pegá la URL.');
  }

  const db = require('../db/models');
  const { resolveSubcategoriaId } = require('../lib/catalog/product-service');

  await db.sequelize.authenticate();

  try {
    if (opts.undo) {
      const removed = await db.sequelize.transaction(async (transaction) => {
        const before = await countDemoRows(db.sequelize, transaction);
        await deleteDemoRows(db.sequelize, transaction);
        return before;
      });
      console.log(`Eliminados ${removed} producto(s) importados ([demo-json]).`);
      return;
    }

    let inserted = 0;
    let skipped = 0;

    await db.sequelize.transaction(async (transaction) => {
      if (opts.clean) {
        await deleteDemoRows(db.sequelize, transaction);
      }

      for (const product of products) {
        if (!opts.clean) {
          const exists = await productExists(db.sequelize, product.name, transaction);
          if (exists) {
            skipped += 1;
            continue;
          }
        }

        const subcategoriaId = await resolveSubcategoriaId(
          product.cat,
          product.sub,
          transaction
        );
        await insertProduct(db.sequelize, product, subcategoriaId, transaction);
        inserted += 1;
      }
    });

    console.log(`Importación demo completada desde ${abs}`);
    console.log(`  Insertados: ${inserted}`);
    if (skipped) console.log(`  Omitidos (ya existían): ${skipped}`);
    console.log(`  Marcador en nombre: "${DEMO_MARKER} …"`);
    console.log('  Para revertir: npm run db:import-demo:undo');
  } finally {
    await db.sequelize.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
