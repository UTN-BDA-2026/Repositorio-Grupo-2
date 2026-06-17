'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;

const metricasPath = path.join(ROOT, 'data', 'metricas.json');
const hasDatabase =
  process.env.DATABASE_URL != null && String(process.env.DATABASE_URL).trim() !== '';

let catalog;
if (hasDatabase) {
  catalog = require('./lib/catalog');
}

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function dbRequired(res) {
  sendJson(res, 503, {
    error: 'Base de datos no configurada. Copiá .env.example a .env y definí DATABASE_URL.',
  });
}

function handleApiError(res, err) {
  const status = err.status || 500;
  sendJson(res, status, {
    error: err.message || 'Error interno del servidor',
  });
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

  if (!hasDatabase) return base;

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

  try {
    if (url.pathname === '/api/productos' && req.method === 'GET') {
      if (!hasDatabase) return dbRequired(res);
      const products = await catalog.listProducts({ activeOnly: true });
      sendJson(res, 200, products);
      return;
    }

    if (url.pathname === '/api/admin/productos' && req.method === 'GET') {
      if (!hasDatabase) return dbRequired(res);
      const products = await catalog.listProducts({ activeOnly: false });
      sendJson(res, 200, products);
      return;
    }

    if (url.pathname === '/api/producto' && req.method === 'GET') {
      if (!hasDatabase) return dbRequired(res);
      const id = url.searchParams.get('id');
      if (!id) {
        sendJson(res, 400, { error: 'Parámetro id requerido' });
        return;
      }
      const product = await catalog.getProductById(id);
      if (!product) {
        sendJson(res, 404, { error: 'Producto no encontrado' });
        return;
      }
      sendJson(res, 200, product);
      return;
    }

    if (url.pathname === '/api/guardar-producto' && req.method === 'POST') {
      if (!hasDatabase) return dbRequired(res);
      const body = await readBody(req);
      const product = await catalog.createProduct(body || {});
      sendJson(res, 201, product);
      return;
    }

    if (url.pathname === '/api/producto' && req.method === 'PATCH') {
      if (!hasDatabase) return dbRequired(res);
      const body = await readBody(req);
      if (!body || body.id == null) {
        sendJson(res, 400, { error: 'Campo id requerido' });
        return;
      }
      const { id, ...fields } = body;
      const product = await catalog.updateProduct(id, fields);
      sendJson(res, 200, product);
      return;
    }

    if (url.pathname === '/api/producto' && req.method === 'DELETE') {
      if (!hasDatabase) return dbRequired(res);
      const body = await readBody(req);
      if (!body || body.id == null) {
        sendJson(res, 400, { error: 'Campo id requerido' });
        return;
      }
      const result = await catalog.deleteProduct(body.id);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === '/api/metricas' && req.method === 'GET') {
      const payload = await metricasPayload();
      sendJson(res, 200, payload);
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (err) {
    handleApiError(res, err);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/index.html`;
  console.log('\n  AGUSTINA — servidor local');
  console.log(`  → ${url}`);
  console.log(`  → Admin: http://127.0.0.1:${PORT}/admin.html`);
  console.log(`  → Métricas: http://127.0.0.1:${PORT}/metricas.html`);
  if (hasDatabase) {
    console.log('  → API catálogo: PostgreSQL (DATABASE_URL configurada)\n');
  } else {
    console.log('  ⚠ DATABASE_URL no configurada — la API devolverá 503\n');
  }
  if (process.env.OPEN_BROWSER !== 'false') openBrowser(url);
});
