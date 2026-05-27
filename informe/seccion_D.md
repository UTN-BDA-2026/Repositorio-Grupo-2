# Sección D — Planes de ejecución y dimensionamiento en disco

**Responsable:** Persona D (Perez, Juan Ignacio)  
**Datos de planes:** Persona C — outputs de `EXPLAIN (ANALYZE, BUFFERS)`  
**Dimensionamiento:** `db/experiments/D_disk_sizing.sql`

---

## Introducción

Un plan de ejecución en PostgreSQL es la descripción, en forma de árbol de operadores, de cómo el motor accederá a las tablas e índices para resolver una consulta SQL. El optimizador basado en costes genera varios candidatos y elige el que minimiza su función de coste estimada, usando estadísticas del catálogo (`pg_statistic`). Comando `EXPLAIN` muestra ese plan sin ejecutarlo; `EXPLAIN ANALYZE` lo ejecuta realmente y añade tiempos y cardinalidades observadas, lo que permite contrastar estimación y realidad. En un catálogo de e-commerce con decenas de miles de productos, la diferencia entre un Seq Scan con ordenamiento en memoria y un Index Scan alineado al filtro `activo` y al `ORDER BY` se traduce en latencia perceptible para el usuario y en mayor consumo de I/O en instancias cloud como Railway.

---

## Comparativa de planes por query

### Query 1: Catálogo público — productos activos de una categoría

Listado del frontend al filtrar por categoría: join `productos` → `subcategorias` → `categorias`, filtro `activo = TRUE` y `c.slug = 'indumentaria'`, orden por novedad.

**SQL:**

```sql
[QUERY_1]
```

| Métrica | Sin índice | Con índice |
|---------|-----------|------------|
| Tipo de nodo principal | | |
| Costo estimado (startup) | | |
| Costo estimado (total) | | |
| Tiempo real (ms) | | |
| Filas estimadas | | |
| Filas reales | | |
| Buffers shared hit | | |
| Buffers shared read | | |

**Análisis nodo a nodo sin índice:**

```
[PLAN_SIN_INDICE_1]
```

> [EXPLICACION_SIN_INDICE_1]

**Análisis nodo a nodo con índice:**

```
[PLAN_CON_INDICE_1]
```

> [EXPLICACION_CON_INDICE_1]

---

### Query 2: Badge NUEVO — productos activos de los últimos 14 días

Consulta de la home y las cards: solo tabla `productos`, filtro por `activo` y ventana temporal en `created_at`, orden descendente por fecha.

**SQL:**

```sql
[QUERY_2]
```

| Métrica | Sin índice | Con índice |
|---------|-----------|------------|
| Tipo de nodo principal | | |
| Costo estimado (startup) | | |
| Costo estimado (total) | | |
| Tiempo real (ms) | | |
| Filas estimadas | | |
| Filas reales | | |
| Buffers shared hit | | |
| Buffers shared read | | |

**Análisis nodo a nodo sin índice:**

```
[PLAN_SIN_INDICE_2]
```

> [EXPLICACION_SIN_INDICE_2]

**Análisis nodo a nodo con índice:**

```
[PLAN_CON_INDICE_2]
```

> [EXPLICACION_CON_INDICE_2]

---

### Query 3: Panel admin — listado completo con taxonomía

Listado administrativo sin filtrar por `activo`: join a categorías y subcategorías, orden global por `created_at DESC`.

**SQL:**

```sql
[QUERY_3]
```

| Métrica | Sin índice | Con índice |
|---------|-----------|------------|
| Tipo de nodo principal | | |
| Costo estimado (startup) | | |
| Costo estimado (total) | | |
| Tiempo real (ms) | | |
| Filas estimadas | | |
| Filas reales | | |
| Buffers shared hit | | |
| Buffers shared read | | |

**Análisis nodo a nodo sin índice:**

```
[PLAN_SIN_INDICE_3]
```

> [EXPLICACION_SIN_INDICE_3]

**Análisis nodo a nodo con índice:**

```
[PLAN_CON_INDICE_3]
```

> [EXPLICACION_CON_INDICE_3]

---

## Dimensionamiento en disco

Mediciones obtenidas con `db/experiments/D_disk_sizing.sql`. Registrar dos corridas si el informe lo requiere: tras `01_baseline.sql` y tras `02_create_indexes.sql`.

| Objeto | Tamaño heap | Tamaño índices | Total |
|--------|-------------|----------------|-------|
| productos | [PRODUCTOS_HEAP] | [PRODUCTOS_INDICES] | [PRODUCTOS_TOTAL] |
| categorias | [CATEGORIAS_HEAP] | [CATEGORIAS_INDICES] | [CATEGORIAS_TOTAL] |
| subcategorias | [SUBCATEGORIAS_HEAP] | [SUBCATEGORIAS_INDICES] | [SUBCATEGORIAS_TOTAL] |

En la tabla `productos`, el heap ocupa [PRODUCTOS_HEAP] frente a [PRODUCTOS_INDICES] en índices (total [PRODUCTOS_TOTAL]). La proporción índices/total es de aproximadamente [RATIO_INDICES_PRODUCTOS] %. Las tablas de taxonomía (`categorias`, `subcategorias`) permanecen en órdenes de magnitud menores ([CATEGORIAS_TOTAL] y [SUBCATEGORIAS_TOTAL] respectivamente), por lo que el espacio adicional relevante para la decisión de diseño se concentra en `productos`. Tras crear `idx_productos_activos` e `idx_productos_created_at_desc`, conviene contrastar el desglose por índice del script `D_disk_sizing.sql` con el incremento respecto a la corrida baseline: si el índice parcial es notablemente más chico que un índice completo sobre las mismas columnas, el costo en disco está acotado. La pregunta de negocio es si ese overhead se compensa con la reducción de `Execution Time` y de `shared read` documentada en las tablas de las queries 1 y 2; completar esa comparación con los números reales antes de cerrar el informe.

---

## Relación costo-beneficio de los índices

El índice `idx_productos_subcategoria_id`, creado con el esquema inicial sobre la clave foránea, cumple un rol estructural distinto del de rendimiento de catálogo: garantiza que los joins y las operaciones de integridad referencial no degeneren en seq scans sobre el lado hijo cuando el optimizador resuelve `Nested Loop` desde `subcategorias` hacia `productos`. Su mantenimiento es razonable incluso si el espacio en disco es modesto frente al heap, porque sustenta la query 1 en la rama del join y cualquier listado filtrado por subcategoría. En el plan de ejecución debería observarse un acceso indexado o nested loop eficiente en el lado de `productos` cuando la cardinalidad del lado externo es baja; si en los planes pegados el cuello de botella sigue siendo un seq scan masivo sobre `productos`, el problema no es la FK sino la falta de un índice compuesto alineado al predicado `activo` y al ordenamiento.

El índice parcial `idx_productos_activos` sobre `(subcategoria_id, created_at DESC) WHERE activo = TRUE` está orientado explícitamente a la query 1 y a cualquier listado público que filtre productos activos. Al excluir filas con `activo = FALSE`, el árbol B-tree solo indexa el subconjunto que el frontend muestra, lo que reduce tamaño en disco respecto a un índice completo y aumenta la selectividad útil. En un plan favorable de la query 1 con índices aplicados, se espera dejar de recorrer todo el heap de `productos` y reducir o eliminar un `Sort` costoso sobre `created_at`, evidenciado por `Index Scan` (o `Bitmap` seguido de heap scan acotado) sobre ese nombre de índice y por una caída de `shared read` en el nodo principal. Si tras la migración el plan no lo usa, conviene revisar estadísticas (`ANALYZE`) y la selectividad real del filtro por categoría antes de descartar el índice.

`idx_productos_created_at_desc` sobre `created_at DESC` ataca la query 2 (badge NUEVO) y cualquier ordenamiento global por fecha, incluida en parte la query 3 del panel admin. Su beneficio se manifiesta cuando el rango temporal de catorce días, combinado con `activo = TRUE`, deja de implicar leer y ordenar un porcentaje alto de la tabla. En el `EXPLAIN` de la query 2, un escenario positivo muestra acceso por índice en `created_at` con menor `Execution Time` que el baseline y, idealmente, ausencia de `Sort` sobre un volumen grande de filas. El costo en disco es una estructura adicional que crece con el número de filas indexadas (todas, no solo activas); por eso su justificación depende de la frecuencia de esa consulta en producción frente al costo de mantenimiento en escrituras (`INSERT`/`UPDATE` que tocan `created_at` o `activo`).

La query 3, al no filtrar por `activo`, no puede aprovechar el índice parcial y puede seguir requiriendo un `Sort` o un scan amplio aun con `idx_productos_created_at_desc`; mantener ambos índices nuevos solo por el admin sería discutible si el único beneficio medible está en Q1 y Q2. Un índice redundante o poco usado se detecta en `pg_stat_user_indexes` con `idx_scan` bajo tras ejecutar la batería de pruebas: el script `D_disk_sizing.sql` incluye esa consulta para `productos`. En conjunto, la decisión de conservar `idx_productos_activos` e `idx_productos_created_at_desc` debe apoyarse en la tríada evidencia del plan (menor tiempo real y menos buffers leídos), evidencia de uso (`idx_scan` > 0 en las queries representativas) y evidencia de espacio (incremento de `pg_indexes_size` acotado frente al ahorro de I/O). Si los planes con índice no mejoran sensiblemente respecto al baseline con el volumen acordado del seed, el informe debe plantear ajuste de definición o de estadísticas antes de asumir que el overhead en Railway está justificado.
