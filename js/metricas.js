document.addEventListener("DOMContentLoaded", async () => {
  const liveBadge = document.getElementById("metricsLive");
  const countsGrid = document.getElementById("metricsCounts");
  const sizesGrid = document.getElementById("metricsSizes");
  const indexList = document.getElementById("metricsIndexes");
  const queriesEl = document.getElementById("metricsQueries");
  const reproduceEl = document.getElementById("metricsReproduce");

  let data;
  try {
    const res = await fetch("/api/metricas");
    data = await res.json();
  } catch {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<p style="text-align:center;padding:2rem;color:#999;">No se pudieron cargar las métricas.</p>'
    );
    return;
  }

  if (data.live && liveBadge) liveBadge.hidden = false;

  renderCounts(data.environment?.counts || []);
  renderSizes(data.environment?.sizes || {});
  renderIndexes(data.indexes || []);
  renderQueries(data.queries || []);
  renderReproduce(data.reproduce || []);

  function renderCounts(counts) {
    if (!countsGrid) return;
    countsGrid.innerHTML = counts
      .map(
        (c) => `
      <div class="metric-card">
        <div class="metric-card__label">${c.table}</div>
        <div class="metric-card__value">${Number(c.rows).toLocaleString("es-AR")}</div>
        <div class="metric-card__hint">filas</div>
      </div>`
      )
      .join("");
  }

  function renderSizes(sizes) {
    if (!sizesGrid || !sizes.total) return;
    const items = [
      { label: "Tamaño total", value: sizes.total },
      { label: "Solo tabla", value: sizes.table },
      { label: "Índices", value: sizes.indexes },
    ];
    sizesGrid.innerHTML = items
      .map(
        (s) => `
      <div class="metric-card">
        <div class="metric-card__label">${s.label}</div>
        <div class="metric-card__value">${s.value}</div>
        <div class="metric-card__hint">tabla productos</div>
      </div>`
      )
      .join("");
  }

  function renderIndexes(indexes) {
    if (!indexList) return;
    indexList.innerHTML = indexes
      .map(
        (idx) => `
      <div class="index-item">
        <code class="index-item__name">${idx.name}</code>
        <span class="index-item__tag">${idx.partial ? "Parcial" : "B-tree"}</span>
        <p class="index-item__desc">${idx.description}${idx.condition ? ` · <em>${idx.condition}</em>` : ""}</p>
      </div>`
      )
      .join("");
  }

  function renderQueries(queries) {
    if (!queriesEl) return;
    const maxMs = Math.max(
      ...queries.flatMap((q) => [q.baseline.executionMs, q.withIndexes.executionMs])
    );

    queriesEl.innerHTML = queries
      .map((q) => {
        const basePct = (q.baseline.executionMs / maxMs) * 100;
        const idxPct = (q.withIndexes.executionMs / maxMs) * 100;
        const speedup =
          q.baseline.executionMs > 0
            ? (q.baseline.executionMs / q.withIndexes.executionMs).toFixed(1)
            : "—";

        return `
        <article class="query-block">
          <div class="query-block__head">
            <span class="query-block__id">${q.id}</span>
            <h3 class="query-block__label">${q.label}</h3>
          </div>
          <p class="query-block__desc">${q.description}</p>

          <div class="chart-row">
            <span class="chart-row__label">Sin índices</span>
            <div class="chart-row__bar-wrap">
              <div class="chart-row__bar chart-row__bar--baseline" style="width:${Math.max(basePct, 2)}%"></div>
            </div>
            <span class="chart-row__ms">${q.baseline.executionMs} ms</span>
          </div>
          <div class="chart-row">
            <span class="chart-row__label">Con índices</span>
            <div class="chart-row__bar-wrap">
              <div class="chart-row__bar chart-row__bar--indexed" style="width:${Math.max(idxPct, 2)}%"></div>
            </div>
            <span class="chart-row__ms">${q.withIndexes.executionMs} ms</span>
          </div>

          <div class="query-meta">
            <div class="query-meta__item">Speedup<strong>${speedup}×</strong></div>
            <div class="query-meta__item">Nodo sin índice<strong>${q.baseline.rootNode}</strong></div>
            <div class="query-meta__item">Nodo con índice<strong>${q.withIndexes.rootNode}</strong></div>
            <div class="query-meta__item">Buffers read<strong>${q.baseline.buffersRead} → ${q.withIndexes.buffersRead}</strong></div>
          </div>

          ${q.highlight ? `<p class="query-block__highlight">${q.highlight}</p>` : ""}
        </article>`;
      })
      .join("");
  }

  function renderReproduce(steps) {
    if (!reproduceEl) return;
    reproduceEl.innerHTML = `<ol>${steps.map((s) => `<li><code>${s}</code></li>`).join("")}</ol>`;
  }
});
