# Sección E — Optimización de índices y conclusiones de ingeniería

**Responsable:** Persona E  
**Scripts reproducibles:** `db/experiments/` (ver `db/experiments/README.md`)  
**Queries de negocio:** Q1–Q3 en `01_baseline.sql` / `03_with_indexes.sql` (Persona C)  
**Evidencia de planes y disco:** Personas C y D

---

## 1. Inventario de índices en `productos`

Tras `db:migrate` y la migración `20250520130000-add-catalog-indexes.js` (o `02_create_indexes.sql`), la tabla `productos` queda con:

| Índice | Tipo | Columnas | Condición | Rol |
|--------|------|----------|-----------|-----|
| `productos_pkey` | B-tree único | `id` | — | PK; obligatorio |
| `idx_productos_subcategoria_id` | B-tree | `subcategoria_id` | — | FK / joins por subcategoría (schema inicial) |
| `idx_productos_activos` | B-tree parcial | `(subcategoria_id, created_at DESC)` | `WHERE activo = TRUE` | Catálogo público (Q1) |
| `idx_productos_created_at_desc` | B-tree | `created_at DESC` | — | Badge NUEVO (Q2), orden admin (Q3) |

Las tablas `categorias` y `subcategorias` solo tienen PK y unicidades de slug; el volumen y el costo de índices se concentran en `productos`.

Completar tras ejecutar `05_index_audit.sql`:

| Índice | Tamaño en disco | `idx_scan` (tras batería 01+03) |
|--------|-----------------|----------------------------------|
| `productos_pkey` | 344 kB | 0 |
| `idx_productos_subcategoria_id` | 192 kB | 49 |
| `idx_productos_activos` | 456 kB | 0 |
| `idx_productos_created_at_desc` | 344 kB | 7 |

> Mediciones con 15 000 productos en Railway (junio 2026). `idx_productos_activos` con `idx_scan = 0` confirma que el planner prefirió el índice de FK en Q1; ejecutar de nuevo tras `ANALYZE` o con 50k filas antes de evaluar `DROP`.

---

## 2. Análisis de redundancia y solapamiento

### 2.1 `idx_productos_subcategoria_id` vs `idx_productos_activos`

**No son redundantes en producción.**

- El índice de FK indexa **todas** las filas (`activo` true y false). PostgreSQL lo usa en joins desde `subcategorias`, en `ON DELETE RESTRICT` y en el panel admin (Q3) cuando el plan necesita muchas filas por `subcategoria_id` sin filtrar activos.
- `idx_productos_activos` es **parcial**: solo filas con `activo = TRUE` y además incluye `created_at DESC` para alinear filtro + orden del catálogo (Q1).

**Solapamiento parcial:** la primera columna de `idx_productos_activos` es `subcategoria_id`. Para consultas del tipo “productos activos de una subcategoría ordenados por fecha”, el planner debería preferir el índice parcial. Para “todos los productos de una subcategoría” (admin), sigue siendo necesario el índice de FK o un seq scan según cardinalidad.

**Acción:** **mantener ambos**. No eliminar `idx_productos_subcategoria_id` aunque exista el parcial.

### 2.2 `idx_productos_created_at_desc` vs `idx_productos_activos`

**Solapamiento funcional limitado, no redundancia total.**

- Q2 (badge NUEVO) filtra `activo = TRUE` y un rango en `created_at`. El índice global en `created_at` puede usarse para el rango temporal, pero luego debe descartar inactivos en el heap (`Filter: activo`).
- Q1 ya está cubierta por el parcial compuesto `(subcategoria_id, created_at)` con `activo = TRUE`.
- Q3 (admin, sin filtro `activo`) **sí** se beneficia de `idx_productos_created_at_desc` para el `ORDER BY` global.

**Índice alternativo (evaluado, no aplicado por defecto):**

```sql
CREATE INDEX idx_productos_nuevos_activos
  ON productos (created_at DESC)
  WHERE activo = TRUE;
```

| Opción | Ventaja | Desventaja |
|--------|---------|------------|
| Mantener `idx_productos_created_at_desc` | Sirve Q2 y Q3 con un solo índice | Mayor tamaño (indexa inactivos); Q2 puede hacer más heap fetches |
| Reemplazar por parcial `… WHERE activo = TRUE` | Menor disco; Q2 más alineada | Q3 pierde índice dedicado al orden global; admin puede volver a `Sort` costoso |

**Acción recomendada:** mantener `idx_productos_created_at_desc` **si** Q3 se ejecuta con frecuencia (panel admin). Si en producción el admin es marginal y el catálogo público domina, valorar en un segundo sprint sustituir por el parcial y medir Q3 con `EXPLAIN` antes de hacer `DROP`.

### 2.3 Índices que **no** conviene agregar (anti-patrones)

| Propuesta | Por qué evitarla |
|-----------|------------------|
| `(activo, subcategoria_id, created_at)` completo | Duplica al parcial `idx_productos_activos` con más filas indexadas |
| Segundo índice solo en `(subcategoria_id)` además del FK | Ya existe `idx_productos_subcategoria_id` |
| Índice en `c.slug` sin necesidad | Tabla `categorias` es pequeña; el join parte de `productos` o `subcategorias` |
| Índice GIN en `images` / `descripcion` | No hay búsqueda full-text en las Q1–Q3 del informe |

### 2.4 Duplicación script vs migración

`02_create_indexes.sql` repite el DDL de `20250520130000-add-catalog-indexes.js` a propósito: permite medir baseline → con índice en la misma sesión sin depender del orden de migraciones en cada máquina. **En producción** la fuente de verdad es la migración Sequelize, no ejecutar `02` manualmente en cada deploy.

---

## 3. Decisión por query (resumen para el informe)

Completar tiempos y buffers con las salidas de Persona C (`informe/seccion_C.md`).

| Query | Índice en plan favorable | Mejora medida | ¿DROP algún índice? |
|-------|---------------------------|---------------|---------------------|
| Q1 — catálogo por categoría, activos | `idx_productos_subcategoria_id` (+ Sort) | ~10 % tiempo; sin cambio de nodo | No |
| Q2 — badge 14 días, activos | `idx_productos_created_at_desc` | ~100× tiempo (2.5 ms → 0.02 ms) | No |
| Q3 — admin, todos los estados | `idx_productos_created_at_desc` | ~2 % tiempo; elimina Sort 1700 kB | No |

Si en `05_index_audit.sql` algún índice muestra `idx_scan = 0` **después** de correr 01 y 03, revisar estadísticas (`ANALYZE productos`) o definición desalineada antes de proponer `DROP`.

---

## 4. Qué dejaríamos en producción (AGUSTINA)

### Mantener siempre

1. **`productos_pkey`** — integridad y lookups por id (detalle de producto, PATCH admin).
2. **`idx_productos_subcategoria_id`** — FK, joins y escrituras referenciales.
3. **`idx_productos_activos`** — ruta crítica del catálogo público (Q1); índice parcial reduce tamaño frente a un índice completo sobre las mismas columnas.

### Mantener con la evidencia del grupo

4. **`idx_productos_created_at_desc`** — justificado si Q2 y/o Q3 mejoran de forma medible en `Execution Time` y `shared read` (Persona C) y el overhead en `pg_indexes_size` es aceptable (Persona D).

### No hacer en producción sin medición

- `DROP` de `idx_productos_subcategoria_id` “porque ya existe el parcial”.
- Índices extra en columnas de baja selectividad (`activo` solo) o en tablas dimensión pequeñas.
- Crear el parcial `idx_productos_nuevos_activos` **además** del actual sin dropear el global (triplicaría solapamiento en `created_at`).

### Operación y mantenimiento

- Tras cargas masivas (`db:seed:all` o importación): `ANALYZE productos;`.
- Monitoreo: `pg_stat_user_indexes` (incluido en `05_index_audit.sql` y `D_disk_sizing.sql`).
- Railway: mantener `DATABASE_SSL=true` en Windows según README.

---

## 5. Conclusiones accionables

1. **El diseño actual es coherente** con un e-commerce donde el catálogo filtrado (activos + categoría + novedad) concentra el tráfico de lectura; los dos índices de experimentación atacan Q1 y Q2 sin duplicar al índice de FK.
2. **La única zona gris** es el par `idx_productos_created_at_desc` vs un índice parcial solo-fecha para activos: la decisión depende del peso relativo de Q2 frente a Q3 en producción y debe cerrarse con números del informe, no solo con el DDL.
3. **La reproducibilidad del trabajo** queda en `db/experiments/00`–`05` + migración Sequelize; cualquier integrante puede repetir baseline → índices → auditoría siguiendo `db/experiments/README.md`.
4. **Criterio de cierre del informe:** para cada índice nuevo, documentar (a) mejora en plan/tiempo (C), (b) tamaño en disco (D), (c) `idx_scan` > 0 tras la batería (E). Si falla alguno, ajustar definición o estadísticas antes de entregar.

---

## 6. Checklist Persona E (entrega)

- [x] Correr `00` → `01` → `02` → `03` → `05` con seed de volumen acordado (15k productos)
- [x] Pegar tabla de tamaños y `idx_scan` de la sección 1
- [ ] Incorporar al PDF las conclusiones de las secciones 4 y 5
- [ ] PR con mensaje tipo `docs(informe): sección E optimización índices`
