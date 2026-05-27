'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../db/models');

const QUERIES = [
  {
    id: 'Q1',
    label: 'Catálogo activo por categoría (slug indumentaria)',
    sql: `
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
ORDER BY p.created_at DESC`,
  },
  {
    id: 'Q2',
    label: 'Badge NUEVO (activos, últimos 14 días)',
    sql: `
SELECT
    p.id,
    p.nombre,
    p.precio,
    p.image_url,
    p.created_at
FROM productos p
WHERE p.activo     = TRUE
  AND p.created_at >= now() - INTERVAL '14 days'
ORDER BY p.created_at DESC`,
  },
  {
    id: 'Q3',
    label: 'Admin — todos los productos con join',
    sql: `
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
ORDER BY p.created_at DESC`,
  },
];

function parseMetrics(planText) {
  const planning = planText.match(/Planning Time: ([\d.]+) ms/);
  const execution = planText.match(/Execution Time: ([\d.]+) ms/);
  const buffersLine = planText.match(/Buffers: shared hit=(\d+)(?: read=(\d+))?/);
  return {
    planningMs: planning ? Number(planning[1]) : null,
    executionMs: execution ? Number(execution[1]) : null,
    buffersHit: buffersLine ? Number(buffersLine[1]) : null,
    buffersRead: buffersLine && buffersLine[2] != null ? Number(buffersLine[2]) : 0,
    rootNode: (planText.match(/^\s*(->\s*)?(\w[\w ]+)/m) || [])[2] || null,
  };
}

async function runExplain(label, sql) {
  const [rows] = await sequelize.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`);
  const plan = rows.map((r) => r['QUERY PLAN']).join('\n');
  return { label, plan, metrics: parseMetrics(plan) };
}

async function dropExperimentIndexes() {
  await sequelize.query(`
    DROP INDEX IF EXISTS idx_productos_activos;
    DROP INDEX IF EXISTS idx_productos_created_at_desc;
  `);
}

async function createExperimentIndexes() {
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_productos_activos
      ON productos (subcategoria_id, created_at DESC)
      WHERE activo = TRUE`);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_productos_created_at_desc
      ON productos (created_at DESC)`);
  await sequelize.query('ANALYZE productos;');
}

async function envSnapshot() {
  const [counts] = await sequelize.query(`
    SELECT 'categorias' AS tabla, COUNT(*)::bigint AS filas FROM categorias
    UNION ALL SELECT 'subcategorias', COUNT(*) FROM subcategorias
    UNION ALL SELECT 'productos', COUNT(*) FROM productos`);
  const [indexes] = await sequelize.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'productos'
    ORDER BY indexname`);
  const [sizes] = await sequelize.query(`
    SELECT
      pg_size_pretty(pg_total_relation_size('productos')) AS tamanio_total,
      pg_size_pretty(pg_relation_size('productos'))       AS tamanio_tabla,
      pg_size_pretty(pg_indexes_size('productos'))         AS tamanio_indices`);
  return { counts, indexes, sizes: sizes[0] };
}

function metricsTable(rows) {
  const header =
    '| Query | Escenario | Planning (ms) | Execution (ms) | Buffers hit | Buffers read | Nodo raíz (aprox.) |';
  const sep =
    '|-------|-----------|---------------|----------------|-------------|--------------|---------------------|';
  const body = rows
    .map(
      (r) =>
        `| ${r.id} | ${r.scenario} | ${r.metrics.planningMs ?? '—'} | ${r.metrics.executionMs ?? '—'} | ${r.metrics.buffersHit ?? '—'} | ${r.metrics.buffersRead ?? '—'} | ${r.metrics.rootNode ?? '—'} |`
    )
    .join('\n');
  return `${header}\n${sep}\n${body}`;
}

async function main() {
  const env = await envSnapshot();
  console.log('Filas:', env.counts);
  console.log('Índices:', env.indexes.map((i) => i.indexname).join(', '));

  await dropExperimentIndexes();
  console.log('\nBaseline: índices de experimentación eliminados (solo FK + PK).');

  const baseline = [];
  for (const q of QUERIES) {
    const result = await runExplain(q.label, q.sql);
    baseline.push({ id: q.id, scenario: 'Sin índices de experimentación', ...result });
    console.log(`\n--- ${q.id} baseline: ${result.metrics.executionMs} ms ---`);
  }

  await createExperimentIndexes();
  console.log('\nÍndices de experimentación creados (02_create_indexes).');

  const withIdx = [];
  for (const q of QUERIES) {
    const result = await runExplain(q.label, q.sql);
    withIdx.push({ id: q.id, scenario: 'Con índices (02_create_indexes)', ...result });
    console.log(`\n--- ${q.id} con índices: ${result.metrics.executionMs} ms ---`);
  }

  const allMetrics = [
    ...baseline.map((r) => ({ id: r.id, scenario: r.scenario, metrics: r.metrics })),
    ...withIdx.map((r) => ({ id: r.id, scenario: r.scenario, metrics: r.metrics })),
  ];

  const envFinal = await envSnapshot();

  const outDir = path.join(__dirname, '..', 'informe');
  fs.mkdirSync(outDir, { recursive: true });

  const md = `# Sección C — Comparación de rendimiento (EXPLAIN ANALYZE)

**Persona C** · Actividad Informe · PostgreSQL (Railway)

> Salidas generadas con \`scripts/run-explain-c.js\` contra la base del grupo.  
> Requisito de la cátedra: evidencia con transcripción literal de \`EXPLAIN (ANALYZE, BUFFERS)\`.

## Entorno al momento de la medición

| Tabla | Filas |
|-------|------:|
${env.counts.map((c) => `| ${c.tabla} | ${c.filas} |`).join('\n')}

| Métrica | Valor |
|---------|-------|
| Tamaño total \`productos\` | ${env.sizes.tamanio_total} |
| Tamaño tabla | ${env.sizes.tamanio_tabla} |
| Tamaño índices | ${env.sizes.tamanio_indices} |

### Índices en \`productos\` (después de \`02_create_indexes.sql\`)

| Nombre | Definición |
|--------|------------|
${envFinal.indexes.map((i) => `| \`${i.indexname}\` | \`${i.indexdef.replace(/`/g, "'")}\` |`).join('\n')}

| Métrica (post-índices) | Valor |
|------------------------|-------|
| Tamaño total \`productos\` | ${envFinal.sizes.tamanio_total} |
| Tamaño índices | ${envFinal.sizes.tamanio_indices} |

## Tabla comparativa (antes / después)

${metricsTable(allMetrics)}

---

${baseline
  .map(
    (r, i) => `## ${r.id} — ${r.label}

### Baseline (sin índices de experimentación)

\`\`\`text
${r.plan}
\`\`\`

### Con índices

\`\`\`text
${withIdx[i].plan}
\`\`\`

### Lectura rápida

- **Baseline:** tiempo de ejecución ${r.metrics.executionMs} ms · buffers read ${r.metrics.buffersRead ?? '—'}
- **Con índices:** tiempo de ejecución ${withIdx[i].metrics.executionMs} ms · buffers read ${withIdx[i].metrics.buffersRead ?? '—'}
`
  )
  .join('\n---\n\n')}

## Notas para el informe final (Docx/PDF)

1. Copiar cada bloque \`text\` anterior como captura o transcripción en el documento entregable.
2. Si los tiempos son muy bajos (< 1 ms), conviene que **Persona B** cargue más filas (50k+) y repetir \`01_baseline.sql\` → \`02\` → \`03\`.
3. Interpretación de nodos (\`Seq Scan\`, \`Index Scan\`, etc.) corresponde ampliar en conjunto con **Persona D**.
`;

  const outPath = path.join(outDir, 'seccion_C.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\nEscrito: ${outPath}`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err.message);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
