# Sección D — Planes de ejecución y dimensionamiento en disco

**Responsable:** Persona D (Perez, Juan Ignacio)  
**Datos de planes:** Persona C — `informe/seccion_C.md` (generado con `npm run informe:c`)  
**Dimensionamiento:** `db/experiments/D_disk_sizing.sql` · mediciones post-índices (15 000 productos)

---

## Introducción

Un plan de ejecución en PostgreSQL describe, en forma de árbol de operadores, cómo el motor accederá a tablas e índices para resolver una consulta. `EXPLAIN ANALYZE` ejecuta la query y contrasta tiempos estimados vs reales. En un catálogo con decenas de miles de productos, la diferencia entre un Seq Scan con Sort y un Index Scan alineado al filtro `activo` y al `ORDER BY` impacta latencia e I/O en instancias cloud (Railway).

**Entorno de medición:** 10 categorías, 22 subcategorías, 15 000 productos (`[seed-exp]`).

---

## Comparativa de planes por query

### Query 1: Catálogo público — productos activos de una categoría

Listado al filtrar por categoría: join `productos` → `subcategorias` → `categorias`, filtro `activo = TRUE` y `c.slug = 'indumentaria'`, orden por novedad.

**SQL:**

```sql
SELECT
    p.id, p.nombre AS name, p.precio AS price, p.precio_efectivo,
    c.slug AS cat, s.slug AS sub, p.image_url, p.images,
    p.descripcion, p.created_at
FROM productos p
JOIN subcategorias s ON s.id = p.subcategoria_id
JOIN categorias c ON c.id = s.categoria_id
WHERE p.activo = TRUE AND c.slug = 'indumentaria'
ORDER BY p.created_at DESC;
```

| Métrica | Sin índice exp. | Con índice exp. |
|---------|-----------------|-----------------|
| Tipo de nodo principal | Sort | Sort |
| Costo estimado (total) | ~50.67 | ~50.67 |
| Tiempo real (ms) | 3.642 | 3.293 |
| Filas reales | 2568 | 2568 |
| Buffers shared hit | 2266 | 2263 |
| Buffers shared read | 0 | 0 |

**Análisis nodo a nodo sin índice:**

```text
Sort  (actual time=3.255..3.497 rows=2568 loops=1)
  Sort Key: p.created_at DESC
  Sort Method: quicksort  Memory: 859kB
  ->  Nested Loop  (actual time=0.034..2.127 rows=2568 loops=1)
        ->  Nested Loop  (rows=4) — categorias + subcategorias por slug
        ->  Index Scan using idx_productos_subcategoria_id on productos p
              Filter: activo  — Rows Removed by Filter: 40
```

> El planner resuelve la taxonomía con índices en `categorias.slug` y `subcategorias`. En `productos` usa el índice de FK (`idx_productos_subcategoria_id`), aplica `Filter: activo` en heap y ordena 2568 filas en memoria (`Sort` ~859 kB). No hay Seq Scan masivo gracias al índice de FK heredado del esquema.

**Análisis nodo a nodo con índice:**

```text
Sort  (actual time=2.929..3.187 rows=2568 loops=1)
  Sort Key: p.created_at DESC
  ->  Index Scan using idx_productos_subcategoria_id on productos p
        Filter: activo
```

> Con los índices de experimentación creados, el plan **no cambia** a `idx_productos_activos`: el optimizador sigue prefiriendo el índice de FK + Sort. Mejora marginal (~10 % en tiempo). Para forzar uso del parcial haría falta más volumen, `ANALYZE` tras carga masiva o revisar selectividad. **Conclusión:** el índice parcial queda justificado por diseño (catálogo activo) pero la evidencia Q1 con 15k filas es débil; conviene repetir con 50k+.

---

### Query 2: Badge NUEVO — productos activos de los últimos 14 días

Consulta de home/cards: solo `productos`, filtro `activo` y ventana de 14 días en `created_at`.

**SQL:**

```sql
SELECT p.id, p.nombre, p.precio, p.image_url, p.created_at
FROM productos p
WHERE p.activo = TRUE
  AND p.created_at >= now() - INTERVAL '14 days'
ORDER BY p.created_at DESC;
```

| Métrica | Sin índice exp. | Con índice exp. |
|---------|-----------------|-----------------|
| Tipo de nodo principal | Sort → Seq Scan | Index Scan (`idx_productos_created_at_desc`) |
| Tiempo real (ms) | 2.518 | 0.023 |
| Filas reales | 0 | 0 |
| Buffers shared hit | 563 | 2 |
| Buffers shared read | 0 | 0 |

**Análisis sin índice:**

```text
Sort  (actual time=2.502..2.503 rows=0 loops=1)
  ->  Seq Scan on productos p
        Filter: (activo AND created_at >= now() - '14 days')
        Rows Removed by Filter: 15000
```

> Seq Scan completo de 15 000 filas aunque el resultado sea vacío (ningún producto seed en ventana de 14 días). Costo fijo alto para una query frecuente en la home.

**Análisis con índice:**

```text
Index Scan using idx_productos_created_at_desc on productos p
  Index Cond: (created_at >= now() - '14 days')
  Filter: activo
  Buffers: shared hit=2
  Execution Time: 0.023 ms
```

> El índice en `created_at DESC` acota el rango temporal sin recorrer la tabla. **Mejora ~100×** en tiempo de ejecución. Este es el caso más claro de retorno de la inversión en disco.

---

### Query 3: Panel admin — listado completo con taxonomía

Listado sin filtrar `activo`: join a categorías/subcategorías, orden global por `created_at DESC`.

**SQL:**

```sql
SELECT p.id, p.nombre, p.precio, p.activo, c.slug AS cat, s.slug AS sub, p.created_at
FROM productos p
JOIN subcategorias s ON s.id = p.subcategoria_id
JOIN categorias c ON c.id = s.categoria_id
ORDER BY p.created_at DESC;
```

| Métrica | Sin índice exp. | Con índice exp. |
|---------|-----------------|-----------------|
| Tipo de nodo principal | Sort → Hash Join | Nested Loop + Index Scan (`created_at`) |
| Tiempo real (ms) | 14.947 | 14.679 |
| Filas reales | 15000 | 15000 |
| Buffers shared hit | 565 | 15066 |
| Buffers shared read | 0 | 40 |

**Análisis sin índice:**

```text
Sort  (Memory: 1700kB, actual time=12.087..14.272 rows=15000)
  ->  Hash Join  (productos Seq Scan 15000 rows + subcategorias + categorias)
```

> Plan clásico: seq scan de toda la tabla, hash join con tablas dimensión pequeñas, sort en memoria de 15k filas.

**Análisis con índice:**

```text
Nested Loop
  ->  Index Scan using idx_productos_created_at_desc on productos p (15000 rows)
  ->  Memoize + Index Scan subcategorias_pkey / categorias_pkey
```

> El índice evita el `Sort` explícito (orden ya viene del index scan), pero el nested loop con 15k iteraciones incrementa buffers hit. Mejora de tiempo modesta (~2 %); el beneficio principal es eliminar el sort de 1700 kB en RAM.

---

## Dimensionamiento en disco

Mediciones con índices de experimentación aplicados (`db:migrate` + `20250520130000-add-catalog-indexes.js`), 15 000 productos:

| Objeto | Tamaño heap | Tamaño índices | Total |
|--------|-------------|----------------|-------|
| productos | 4504 kB | 1336 kB | 5880 kB |
| categorias | 8192 bytes | 32 kB | 40 kB |
| subcategorias | 8192 bytes | 32 kB | 40 kB |

**Desglose de índices en `productos`:**

| Índice | Tamaño |
|--------|--------|
| `idx_productos_activos` | 456 kB |
| `idx_productos_created_at_desc` | 344 kB |
| `productos_pkey` | 344 kB |
| `idx_productos_subcategoria_id` | 192 kB |

En `productos`, el heap ocupa **4504 kB** frente a **1336 kB** en índices (total **5880 kB**). La proporción índices/total es de aproximadamente **23 %**. Las tablas de taxonomía (`categorias`, `subcategorias`) suman **40 kB** cada una — el espacio relevante para la decisión de diseño se concentra en `productos`.

Los dos índices nuevos (`idx_productos_activos` + `idx_productos_created_at_desc`) ocupan **~800 kB** combinados. Q2 demostró ahorro de I/O y tiempo que justifica ese overhead; Q1 requiere más volumen para validar el parcial.

---

## Relación costo-beneficio de los índices

| Índice | Rol | Evidencia Q1–Q3 | Decisión |
|--------|-----|-----------------|----------|
| `idx_productos_subcategoria_id` | FK, joins | Usado en Q1 (4 loops) | **Mantener** — estructural |
| `idx_productos_activos` | Catálogo activo + orden | `idx_scan` bajo con 15k; plan no lo elige aún | **Mantener** — diseño correcto; monitorear con más datos |
| `idx_productos_created_at_desc` | Q2 badge, Q3 admin | Q2: 2.5 ms → 0.02 ms; `idx_scan` > 0 | **Mantener** — beneficio medido |

La tríada de cierre: (a) mejora en plan/tiempo — **Q2 sí, Q1 marginal, Q3 leve**; (b) tamaño en disco — **23 % del total, aceptable**; (c) uso en `pg_stat_user_indexes` — ver sección E.

---

*Generado a partir de `informe/seccion_C.md` y `scripts/run-informe-de.js` · junio 2026.*
