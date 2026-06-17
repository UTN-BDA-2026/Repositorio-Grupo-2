# Decisión arquitectónica — NoSQL vs PostgreSQL relacional

**Proyecto AGUSTINA · Grupo 2 · Base de Datos Avanzada**

---

## Contexto

La consigna del Trabajo Final permite combinar una base relacional con NoSQL o usar NoSQL en exclusivo, **explicando la decisión**. Este documento justifica por qué el grupo adoptó **PostgreSQL como única base de datos transaccional** del catálogo.

---

## Dominio del negocio

AGUSTINA es un catálogo e-commerce con:

- **Taxonomía normalizada:** categorías → subcategorías → productos (relaciones 1:N con integridad referencial).
- **Consultas predecibles:** listado por categoría, detalle por id, panel admin con joins, badge “NUEVO” por fecha.
- **Consistencia fuerte:** precios, flags `activo`, FKs y operaciones CRUD que deben ser atómicas (transacciones ACID).

Este perfil encaja en el modelo relacional; no hay requisitos de esquema flexible por documento ni de agregación masiva desnormalizada.

---

## Alternativas evaluadas

| Opción | Ventaja teórica | Por qué no la adoptamos |
|--------|-----------------|-------------------------|
| **MongoDB** (documentos) | Flexibilidad de campos por producto | Duplicaríamos slugs `cat`/`sub` en cada documento o perderíamos normalización; las queries del frontend son joins estables ya resueltos en SQL |
| **Redis** (cache/KV) | Latencia ultra baja en lecturas | El volumen del catálogo (~15k–50k filas de experimento) no justifica otra capa operativa; PostgreSQL con índices cubre Q1–Q3 |
| **PostgreSQL + JSONB** híbrido | Atributos semi-estructurados | `images` ya es `text[]`; no hay campos dinámicos por categoría que obliguen document store |
| **Supabase / BaaS externo** (histórico) | Setup rápido | Para la materia necesitábamos DDL versionado, migraciones, EXPLAIN, backup y transacciones bajo nuestro control — resuelto con Railway + Sequelize |

---

## Qué queda fuera de PostgreSQL (y por qué no es “NoSQL del proyecto”)

| Dato | Dónde vive | Rol |
|------|------------|-----|
| Imágenes binarias | **Cloudinary** (CDN) | Solo URLs en `productos.image_url` e `images`; no almacenamos blobs en la DB |
| Carrito de compras | **`localStorage`** del navegador | Estado efímero del cliente; no es persistencia de negocio |
| Métricas estáticas de demo | `data/metricas.json` | Complemento para `metricas.html`; la API `/api/metricas` enriquece con datos live de Postgres |

Cloudinary y localStorage **no sustituyen** la base relacional: no participan en integridad referencial ni en el informe de índices/transacciones.

---

## Conclusión

**Decisión:** PostgreSQL exclusivo para datos de catálogo, con ORM (Sequelize) y SQL crudo donde corresponde.

**Motivos resumidos:**

1. Modelo entidad–relación natural para categorías, subcategorías y productos.
2. ACID en altas/ediciones admin (`lib/catalog/product-service.js`).
3. Índices B-tree y parciales medibles con `EXPLAIN ANALYZE`.
4. Backup/restore estándar con `pg_dump` / `pg_restore`.
5. Volumen y patrones de acceso no requieren particionado horizontal ni document store.

Si el catálogo creciera a millones de filas o aparecieran búsquedas full-text complejas en descripciones, se reevaluaría un índice GIN o un motor de búsqueda dedicado (Elasticsearch), manteniendo Postgres como fuente de verdad transaccional.
