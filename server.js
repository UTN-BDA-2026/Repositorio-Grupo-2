'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;

const productosPath = path.join(ROOT, 'data', 'productos-demo.json');
const metricasPath = path.join(ROOT, 'data', 'metricas.json');

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return map[ext] || 'application/octet-stream';
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  rel = rel.split('?')[0];
  const filePath = path.normalize(path.join(ROOT, rel));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
}

async function metricasPayload() {
  const base = readJson(metricasPath, { queries: [], environment: { counts: [] } });

  if (!process.env.DATABASE_URL) return base;

  try {
    const { sequelize } = require('./db/models');
    const [counts] = await sequelize.query(`
      SELECT 'categorias' AS tabla, COUNT(*)::bigint AS filas FROM categorias
      UNION ALL SELECT 'subcategorias', COUNT(*) FROM subcategorias
      UNION ALL SELECT 'productos', COUNT(*) FROM productos`);
    const [sizes] = await sequelize.query(`
      SELECT
        pg_size_pretty(pg_total_relation_size('productos')) AS total,
        pg_size_pretty(pg_relation_size('productos'))       AS tabla,
        pg_size_pretty(pg_indexes_size('productos'))         AS indices`);
    return {
      ...base,
      live: true,
      environment: {
        ...base.environment,
        counts: counts.map((c) => ({ table: c.tabla, rows: Number(c.filas) })),
        sizes: {
          total: sizes[0].total,
          table: sizes[0].tabla,
          indexes: sizes[0].indices,
        },
      },
    };
  } catch {
    return base;
  }
}

function openBrowser(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/api/productos' && req.method === 'GET') {
    const products = readJson(productosPath, []);
    sendJson(res, 200, products);
    return;
  }

  if (url.pathname === '/api/producto' && req.method === 'GET') {
    const id = url.searchParams.get('id');
    const products = readJson(productosPath, []);
    const product = products.find((p) => String(p.id) === String(id));
    if (!product) {
      sendJson(res, 404, { error: 'Producto no encontrado' });
      return;
    }
    sendJson(res, 200, product);
    return;
  }

  if (url.pathname === '/api/metricas' && req.method === 'GET') {
    const payload = await metricasPayload();
    sendJson(res, 200, payload);
    return;
  }

  serveStatic(req, res, url.pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/index.html`;
  console.log(`\n  AGUSTINA — servidor local`);
  console.log(`  → ${url}`);
  console.log(`  → Métricas: http://127.0.0.1:${PORT}/metricas.html\n`);
  if (process.env.OPEN_BROWSER !== 'false') openBrowser(url);
});
