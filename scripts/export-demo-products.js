'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE = process.env.PRODUCTS_SOURCE_URL
  || 'https://api-agustina.juaniperez1243.workers.dev/productos';
const LIMIT = Number(process.env.DEMO_PRODUCT_LIMIT || 20);
const outPath = path.join(__dirname, '..', 'data', 'productos-demo.json');

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status} al obtener productos`);
  const all = await res.json();
  const slice = all.slice(0, LIMIT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(slice, null, 2), 'utf8');
  console.log(`Exportados ${slice.length} productos → ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
