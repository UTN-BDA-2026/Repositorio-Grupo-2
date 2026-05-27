# Sección C — Comparación de rendimiento (EXPLAIN ANALYZE)

**Persona C** · Actividad Informe · PostgreSQL (Railway)

> Salidas generadas con `scripts/run-explain-c.js` contra la base del grupo.  
> Requisito de la cátedra: evidencia con transcripción literal de `EXPLAIN (ANALYZE, BUFFERS)`.

## Entorno al momento de la medición

| Tabla | Filas |
|-------|------:|
| categorias | 10 |
| subcategorias | 22 |
| productos | 15000 |

| Métrica | Valor |
|---------|-------|
| Tamaño total `productos` | 5880 kB |
| Tamaño tabla | 4504 kB |
| Tamaño índices | 1336 kB |

### Índices en `productos` (después de `02_create_indexes.sql`)

| Nombre | Definición |
|--------|------------|
| `idx_productos_activos` | `CREATE INDEX idx_productos_activos ON public.productos USING btree (subcategoria_id, created_at DESC) WHERE (activo = true)` |
| `idx_productos_created_at_desc` | `CREATE INDEX idx_productos_created_at_desc ON public.productos USING btree (created_at DESC)` |
| `idx_productos_subcategoria_id` | `CREATE INDEX idx_productos_subcategoria_id ON public.productos USING btree (subcategoria_id)` |
| `productos_pkey` | `CREATE UNIQUE INDEX productos_pkey ON public.productos USING btree (id)` |

| Métrica (post-índices) | Valor |
|------------------------|-------|
| Tamaño total `productos` | 5880 kB |
| Tamaño índices | 1336 kB |

## Tabla comparativa (antes / después)

| Query | Escenario | Planning (ms) | Execution (ms) | Buffers hit | Buffers read | Nodo raíz (aprox.) |
|-------|-----------|---------------|----------------|-------------|--------------|---------------------|
| Q1 | Sin índices de experimentación | 0.448 | 3.642 | 2266 | 0 | Sort   |
| Q2 | Sin índices de experimentación | 0.095 | 2.518 | 563 | 0 | Sort   |
| Q3 | Sin índices de experimentación | 0.212 | 14.947 | 565 | 0 | Sort   |
| Q1 | Con índices (02_create_indexes) | 0.314 | 3.293 | 2263 | 0 | Sort   |
| Q2 | Con índices (02_create_indexes) | 0.204 | 0.023 | 2 | 0 | Index Scan using idx_productos_created_at_desc on productos p   |
| Q3 | Con índices (02_create_indexes) | 0.171 | 14.679 | 15066 | 40 | Nested Loop   |

---

## Q1 — Catálogo activo por categoría (slug indumentaria)

### Baseline (sin índices de experimentación)

```text
Sort  (cost=50.47..50.67 rows=78 width=547) (actual time=3.255..3.497 rows=2568.00 loops=1)
  Sort Key: p.created_at DESC
  Sort Method: quicksort  Memory: 859kB
  Buffers: shared hit=2266
  ->  Nested Loop  (cost=0.57..48.02 rows=78 width=547) (actual time=0.034..2.127 rows=2568.00 loops=1)
        Buffers: shared hit=2263
        ->  Nested Loop  (cost=0.29..16.34 rows=1 width=296) (actual time=0.024..0.028 rows=4.00 loops=1)
              Buffers: shared hit=4
              ->  Index Scan using categorias_slug_key on categorias c  (cost=0.14..8.16 rows=1 width=148) (actual time=0.017..0.017 rows=1.00 loops=1)
                    Index Cond: ((slug)::text = 'indumentaria'::text)
                    Index Searches: 1
                    Buffers: shared hit=2
              ->  Index Scan using subcategorias_categoria_slug_uk on subcategorias s  (cost=0.14..8.16 rows=1 width=152) (actual time=0.004..0.006 rows=4.00 loops=1)
                    Index Cond: (categoria_id = c.id)
                    Index Searches: 1
                    Buffers: shared hit=2
        ->  Index Scan using idx_productos_subcategoria_id on productos p  (cost=0.29..25.26 rows=642 width=259) (actual time=0.006..0.459 rows=642.00 loops=4)
              Index Cond: (subcategoria_id = s.id)
              Filter: activo
              Rows Removed by Filter: 40
              Index Searches: 4
              Buffers: shared hit=2259
Planning:
  Buffers: shared hit=232
Planning Time: 0.448 ms
Execution Time: 3.642 ms
```

### Con índices

```text
Sort  (cost=50.47..50.67 rows=78 width=547) (actual time=2.929..3.187 rows=2568.00 loops=1)
  Sort Key: p.created_at DESC
  Sort Method: quicksort  Memory: 859kB
  Buffers: shared hit=2263
  ->  Nested Loop  (cost=0.57..48.02 rows=78 width=547) (actual time=0.024..2.054 rows=2568.00 loops=1)
        Buffers: shared hit=2263
        ->  Nested Loop  (cost=0.29..16.34 rows=1 width=296) (actual time=0.014..0.018 rows=4.00 loops=1)
              Buffers: shared hit=4
              ->  Index Scan using categorias_slug_key on categorias c  (cost=0.14..8.16 rows=1 width=148) (actual time=0.007..0.008 rows=1.00 loops=1)
                    Index Cond: ((slug)::text = 'indumentaria'::text)
                    Index Searches: 1
                    Buffers: shared hit=2
              ->  Index Scan using subcategorias_categoria_slug_uk on subcategorias s  (cost=0.14..8.16 rows=1 width=152) (actual time=0.004..0.006 rows=4.00 loops=1)
                    Index Cond: (categoria_id = c.id)
                    Index Searches: 1
                    Buffers: shared hit=2
        ->  Index Scan using idx_productos_subcategoria_id on productos p  (cost=0.29..25.26 rows=642 width=259) (actual time=0.006..0.446 rows=642.00 loops=4)
              Index Cond: (subcategoria_id = s.id)
              Filter: activo
              Rows Removed by Filter: 40
              Index Searches: 4
              Buffers: shared hit=2259
Planning:
  Buffers: shared hit=48 read=2
Planning Time: 0.314 ms
Execution Time: 3.293 ms
```

### Lectura rápida

- **Baseline:** tiempo de ejecución 3.642 ms · buffers read 0
- **Con índices:** tiempo de ejecución 3.293 ms · buffers read 0

---

## Q2 — Badge NUEVO (activos, últimos 14 días)

### Baseline (sin índices de experimentación)

```text
Sort  (cost=825.51..825.51 rows=1 width=88) (actual time=2.502..2.503 rows=0.00 loops=1)
  Sort Key: created_at DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=563
  ->  Seq Scan on productos p  (cost=0.00..825.50 rows=1 width=88) (actual time=2.498..2.498 rows=0.00 loops=1)
        Filter: (activo AND (created_at >= (now() - '14 days'::interval)))
        Rows Removed by Filter: 15000
        Buffers: shared hit=563
Planning:
  Buffers: shared hit=8
Planning Time: 0.095 ms
Execution Time: 2.518 ms
```

### Con índices

```text
Index Scan using idx_productos_created_at_desc on productos p  (cost=0.29..8.31 rows=1 width=88) (actual time=0.006..0.006 rows=0.00 loops=1)
  Index Cond: (created_at >= (now() - '14 days'::interval))
  Filter: activo
  Index Searches: 1
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=1 read=2
Planning Time: 0.204 ms
Execution Time: 0.023 ms
```

### Lectura rápida

- **Baseline:** tiempo de ejecución 2.518 ms · buffers read 0
- **Con índices:** tiempo de ejecución 0.023 ms · buffers read 0

---

## Q3 — Admin — todos los productos con join

### Baseline (sin índices de experimentación)

```text
Sort  (cost=4221.15..4258.65 rows=15000 width=339) (actual time=12.087..14.272 rows=15000.00 loops=1)
  Sort Key: p.created_at DESC
  Sort Method: quicksort  Memory: 1700kB
  Buffers: shared hit=565
  ->  Hash Join  (cost=28.10..821.70 rows=15000 width=339) (actual time=0.039..6.734 rows=15000.00 loops=1)
        Hash Cond: (s.categoria_id = c.id)
        Buffers: shared hit=565
        ->  Hash Join  (cost=14.05..767.35 rows=15000 width=195) (actual time=0.018..4.463 rows=15000.00 loops=1)
              Hash Cond: (p.subcategoria_id = s.id)
              Buffers: shared hit=564
              ->  Seq Scan on productos p  (cost=0.00..713.00 rows=15000 width=51) (actual time=0.004..1.038 rows=15000.00 loops=1)
                    Buffers: shared hit=563
              ->  Hash  (cost=11.80..11.80 rows=180 width=152) (actual time=0.009..0.011 rows=22.00 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 10kB
                    Buffers: shared hit=1
                    ->  Seq Scan on subcategorias s  (cost=0.00..11.80 rows=180 width=152) (actual time=0.004..0.006 rows=22.00 loops=1)
                          Buffers: shared hit=1
        ->  Hash  (cost=11.80..11.80 rows=180 width=148) (actual time=0.017..0.018 rows=10.00 loops=1)
              Buckets: 1024  Batches: 1  Memory Usage: 9kB
              Buffers: shared hit=1
              ->  Seq Scan on categorias c  (cost=0.00..11.80 rows=180 width=148) (actual time=0.011..0.012 rows=10.00 loops=1)
                    Buffers: shared hit=1
Planning Time: 0.212 ms
Execution Time: 14.947 ms
```

### Con índices

```text
Nested Loop  (cost=0.60..3477.23 rows=15000 width=339) (actual time=0.036..14.139 rows=15000.00 loops=1)
  Buffers: shared hit=15066 read=40
  ->  Nested Loop  (cost=0.44..3026.08 rows=15000 width=195) (actual time=0.030..10.306 rows=15000.00 loops=1)
        Buffers: shared hit=15046 read=40
        ->  Index Scan using idx_productos_created_at_desc on productos p  (cost=0.29..2648.50 rows=15000 width=51) (actual time=0.014..4.835 rows=15000.00 loops=1)
              Index Searches: 1
              Buffers: shared hit=15002 read=40
        ->  Memoize  (cost=0.15..0.18 rows=1 width=152) (actual time=0.000..0.000 rows=1.00 loops=15000)
              Cache Key: p.subcategoria_id
              Cache Mode: logical
              Hits: 14978  Misses: 22  Evictions: 0  Overflows: 0  Memory Usage: 3kB
              Buffers: shared hit=44
              ->  Index Scan using subcategorias_pkey on subcategorias s  (cost=0.14..0.17 rows=1 width=152) (actual time=0.001..0.001 rows=1.00 loops=22)
                    Index Cond: (id = p.subcategoria_id)
                    Index Searches: 22
                    Buffers: shared hit=44
  ->  Memoize  (cost=0.15..0.44 rows=1 width=148) (actual time=0.000..0.000 rows=1.00 loops=15000)
        Cache Key: s.categoria_id
        Cache Mode: logical
        Hits: 14990  Misses: 10  Evictions: 0  Overflows: 0  Memory Usage: 2kB
        Buffers: shared hit=20
        ->  Index Scan using categorias_pkey on categorias c  (cost=0.14..0.43 rows=1 width=148) (actual time=0.001..0.001 rows=1.00 loops=10)
              Index Cond: (id = s.categoria_id)
              Index Searches: 10
              Buffers: shared hit=20
Planning Time: 0.171 ms
Execution Time: 14.679 ms
```

### Lectura rápida

- **Baseline:** tiempo de ejecución 14.947 ms · buffers read 0
- **Con índices:** tiempo de ejecución 14.679 ms · buffers read 40


## Notas para el informe final (Docx/PDF)

1. Copiar cada bloque `text` anterior como captura o transcripción en el documento entregable.
2. Si los tiempos son muy bajos (< 1 ms), conviene que **Persona B** cargue más filas (50k+) y repetir `01_baseline.sql` → `02` → `03`.
3. Interpretación de nodos (`Seq Scan`, `Index Scan`, etc.) corresponde ampliar en conjunto con **Persona D**.
