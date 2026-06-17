# AGUSTINA — Proyecto Base de Datos Avanzada

Catálogo e-commerce de moda y accesorios con **PostgreSQL**, panel de administración, experimentos de rendimiento (índices / `EXPLAIN ANALYZE`), backup-restore y **transacciones ACID** en operaciones críticas del catálogo.

**Grupo 2:** Conforti Angelo · Contreras Facundo · Perez Juan Ignacio · Romero Tomas · Vergara Juan Ignacio

---

## Descripción

El proyecto modela el negocio de **AGUSTINA**: categorías, subcategorías y productos normalizados en PostgreSQL. Un servidor Node.js expone una **API REST local** que alimenta el frontend estático (catálogo, detalle de producto y admin). Las imágenes se suben a Cloudinary desde el navegador; los metadatos y precios viven en la base de datos.

El DDL canónico está en [`db/schema.sql`](db/schema.sql). Las migraciones Sequelize aplican ese esquema para mantener repo y base alineados.

---

## Tecnologías utilizadas

| Capa | Tecnología |
|------|------------|
| Base de datos | **PostgreSQL** (Railway u otro host) |
| ORM / migraciones | **Sequelize 6** + **sequelize-cli** |
| Backend local | **Node.js 18+** (`server.js`, HTTP nativo) |
| Frontend | HTML5, CSS3, JavaScript vanilla |
| Animaciones | GSAP 3 + ScrollTrigger |
| Imágenes | Cloudinary (upload desde el admin) |
| Backup | `pg_dump` / `pg_restore` vía módulo `lib/backup/` |
| Tests | Node.js built-in test runner (`node --test`) |

---

## Requisitos previos

- **Node.js 18 o superior** (`node -v`)
- **PostgreSQL** accesible (instancia compartida del grupo, p. ej. Railway)
- **Cliente PostgreSQL** en PATH para backup/restore: `pg_dump`, `pg_restore`, `psql` (opcional salvo módulo backup)
- Credenciales de conexión (`DATABASE_URL`) provistas por el docente o el grupo

---

## Instalación y configuración

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd Repositorio-Grupo-2
npm install
```

### 2. Variables de entorno

Copiar el ejemplo y completar la URL de Postgres:

| Shell | Comando |
|-------|---------|
| PowerShell | `Copy-Item .env.example .env` |
| cmd | `copy .env.example .env` |
| bash | `cp .env.example .env` |

Editar `.env`:

```env
DATABASE_URL=postgresql://usuario:password@host:puerto/base
DATABASE_SSL=true
```

> **Windows + Railway:** dejar `DATABASE_SSL=true`. Si aparece error de certificado autofirmado, no activar `DATABASE_SSL_REJECT_UNAUTHORIZED=true` salvo indicación del docente.

Variables opcionales útiles:

| Variable | Default | Uso |
|----------|---------|-----|
| `PORT` | `5173` | Puerto del servidor local |
| `SEED_PRODUCT_COUNT` | `15000` | Filas sintéticas para experimentos de índices |
| `OPEN_BROWSER` | abre navegador | `false` para no abrir al iniciar |
| `BACKUP_DIR` | `./backups` | Carpeta de respaldos |

Ver [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md) para el resto de variables de backup.

### 3. Crear esquema y datos iniciales

```bash
npm run db:migrate
npm run db:seed
```

**Atajo (migrate + seed):**

```bash
npm run db:setup
```

Sin el paso de **seed**, las tablas existen pero pueden verse vacías en el catálogo (solo taxonomía + productos de experimento `[seed-exp]`).

---

## Guía de ejecución

### Servidor de desarrollo

```bash
npm run dev
```

Abre automáticamente:

| URL | Contenido |
|-----|-----------|
| http://127.0.0.1:5173/ | Catálogo público |
| http://127.0.0.1:5173/admin.html | Panel admin (contraseña demo: `1234`) |
| http://127.0.0.1:5173/metricas.html | Métricas e informes de rendimiento |

Si `DATABASE_URL` no está configurada, la API responde **503** con un mensaje claro.

### API REST local

Toda la persistencia del catálogo pasa por PostgreSQL (ya no se usa `data/productos-demo.json` en runtime).

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/productos` | Catálogo público (`activo = true`) |
| `GET` | `/api/producto?id=` | Detalle de un producto |
| `GET` | `/api/admin/productos` | Listado admin (incluye inactivos) |
| `POST` | `/api/guardar-producto` | Alta de producto |
| `PATCH` | `/api/producto` | Actualización parcial |
| `DELETE` | `/api/producto` | Eliminación |
| `GET` | `/api/metricas` | Datos para la página de métricas |

Contrato JSON alineado a la vista `v_productos_catalogo`: `id`, `name`, `price`, `precio_efectivo`, `cat`, `sub`, `image_url`, `images`, `descripcion`, `activo`, `created_at`, `updated_at`.

### Backup y restore

```bash
npm run db:backup
npm run db:backup:list
npm run db:backup:restore -- <id>
npm test
```

Documentación completa: [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md).

### Experimentos de índices (EXPLAIN)

Scripts en [`db/experiments/`](db/experiments/). Requieren datos de volumen (`SEED_PRODUCT_COUNT`).

```bash
npm run informe:c
```

Informes del grupo: [`informe/seccion_C.md`](informe/seccion_C.md), [`informe/seccion_D.md`](informe/seccion_D.md), [`informe/seccion_E.md`](informe/seccion_E.md).

---

## Modelo de datos

```mermaid
erDiagram
    categorias ||--o{ subcategorias : "1 N"
    subcategorias ||--o{ productos : "1 N"

    categorias {
        smallserial id PK
        varchar slug UK
        varchar nombre
    }

    subcategorias {
        serial id PK
        smallint categoria_id FK
        varchar slug
        varchar nombre
    }

    productos {
        bigserial id PK
        varchar nombre
        int precio
        int precio_efectivo
        int subcategoria_id FK
        text image_url
        text images
        text descripcion
        boolean activo
        timestamptz created_at
        timestamptz updated_at
    }
```

La vista `v_productos_catalogo` proyecta slugs `cat`/`sub` y campos `name`/`price` para el frontend.

---

## Temas de la cursada implementados

Referencia rápida para la corrección: **qué** se implementó y **dónde** está en el repo.

### 1. Modelado y normalización

- **Dónde:** [`db/schema.sql`](db/schema.sql), migración [`db/migrations/20250511120000-init-agustina-schema.js`](db/migrations/20250511120000-init-agustina-schema.js), modelos en [`db/models/`](db/models/).
- **Qué:** Tres entidades normalizadas (categorías → subcategorías → productos), constraints `CHECK`, unicidades, FKs con `ON DELETE RESTRICT`, vista de proyección al JSON del frontend.

### 2. Índices y optimización de consultas

- **Dónde:** migración [`db/migrations/20250520130000-add-catalog-indexes.js`](db/migrations/20250520130000-add-catalog-indexes.js), scripts [`db/experiments/`](db/experiments/), informes [`informe/seccion_C.md`](informe/seccion_C.md) y [`informe/seccion_E.md`](informe/seccion_E.md).
- **Qué:** Índices B-tree parciales y de ordenamiento; batería reproducible de `EXPLAIN (ANALYZE, BUFFERS)`; seeder de volumen [`db/seeders/20250511140002-seed-experiment-productos-bulk.js`](db/seeders/20250511140002-seed-experiment-productos-bulk.js).

| Índice | Columnas | Uso |
|--------|----------|-----|
| `idx_productos_subcategoria_id` | `subcategoria_id` | JOIN por FK |
| `idx_productos_activos` | `(subcategoria_id, created_at DESC)` WHERE `activo` | Catálogo por categoría |
| `idx_productos_created_at_desc` | `created_at DESC` | Badge “NUEVO” |

### 3. Backup y restore

- **Dónde:** [`lib/backup/`](lib/backup/), CLI [`scripts/db-backup-cli.js`](scripts/db-backup-cli.js), docs [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md), tests [`tests/backup.test.js`](tests/backup.test.js).
- **Qué:** Respaldos formato custom o plain comprimido, manifiesto con checksum SHA-256, validación de integridad, política de retención y restore con confirmación.

### 4. Seguridad

- **Dónde:** [`config/database.js`](config/database.js), [`.env.example`](.env.example), constraints del DDL.
- **Qué:** Credenciales fuera del código (`.env`, ignorado por git); conexión TLS a Railway (`DATABASE_SSL`); integridad referencial (`RESTRICT`); validación de slugs en CHECK.  
  **Nota:** la contraseña del admin en el frontend (`admin.html`) es solo demo local; en producción la autenticación debería moverse al servidor.

### 5. Transacciones ACID

- **Dónde:** [`lib/catalog/product-service.js`](lib/catalog/product-service.js), rutas en [`server.js`](server.js), seeders en [`db/seeders/`](db/seeders/), tests [`tests/transactions.test.js`](tests/transactions.test.js).
- **Qué:** Operaciones multi-paso envueltas en `sequelize.transaction()` con **COMMIT** automático al éxito y **ROLLBACK** ante cualquier error.

| Flujo | Operaciones atómicas | Archivo |
|-------|----------------------|---------|
| Alta de producto | Resolver `cat`/`sub` → `subcategoria_id` + `INSERT` | `lib/catalog/product-service.js` → `createProduct` |
| Actualización | `SELECT … FOR UPDATE` + re-resolución FK + `UPDATE` | `updateProduct` |
| Eliminación | Bloqueo de fila + `DELETE` | `deleteProduct` |
| Seed taxonomía | `INSERT` categorías + subcategorías; `down`: deletes encadenados | `20250511140001-seed-catalogo-taxonomia.js` |
| Seed volumen | `DELETE` previo + INSERT masivo por chunks | `20250511140002-seed-experiment-productos-bulk.js` |

Ejemplo de patrón usado:

```javascript
return db.sequelize.transaction(async (transaction) => {
  const subcategoriaId = await resolveSubcategoriaId(cat, sub, transaction);
  await queryCatalog(`INSERT INTO productos (...) VALUES (...)`, { bind, transaction });
  return fetchProductFromView(id, transaction);
});
// Sequelize hace COMMIT; ante excepción, ROLLBACK.
```

---

## Seeds

Orden de ejecución (`npm run db:seed`):

1. **`20250511140001-seed-catalogo-taxonomia.js`** — categorías y subcategorías (transacción ACID).
2. **`20250511140002-seed-experiment-productos-bulk.js`** — productos sintéticos `[seed-exp]` para EXPLAIN (transacción ACID; `ANALYZE` post-commit).

Cantidad configurable: `SEED_PRODUCT_COUNT` (default **15000**, tope **500000**). Valor `0` omite el bulk.

```powershell
$env:SEED_PRODUCT_COUNT=50000; npm run db:seed
```

---

## Importar productos demo desde JSON

Script **opcional** para cargar el catálogo de muestra (`data/productos-demo.json`) en PostgreSQL. **No** forma parte de `db:setup`, `db:seed` ni del arranque del servidor: solo corre cuando lo invocás explícitamente.

**Requisitos previos:** `.env` con `DATABASE_URL`, taxonomía cargada (`npm run db:seed` o al menos el seeder de categorías/subcategorías).

### Funcionalidad

| Aspecto | Detalle |
|---------|---------|
| Origen | `data/productos-demo.json` (array con `name`, `price`, `cat`, `sub`, `image_url`, etc.) |
| Destino | Tabla `productos`, resolviendo `subcategoria_id` por slugs `cat`/`sub` |
| Marcador | Prefijo **`[demo-json]`** en `nombre` (mismo criterio que `[seed-exp]` en seeds) |
| Transacción | Toda la importación en una transacción ACID; error → ROLLBACK |
| Aislamiento | No modifica seeders, API ni archivos del frontend |

Los productos importados se ven en el catálogo vía la API local (`npm run dev`). El prefijo `[demo-json]` permite identificarlos y borrarlos sin tocar productos reales ni los de experimento `[seed-exp]`.

### Comandos

```bash
# Importar omitiendo filas [demo-json] que ya existan (idempotente)
npm run db:import-demo

# Reimportar desde cero: borra [demo-json] previos e inserta de nuevo
npm run db:import-demo -- --clean

# Simular sin escribir en la base
npm run db:import-demo -- --dry-run

# Usar otro archivo JSON
npm run db:import-demo -- --file ruta/productos.json

# Eliminar solo productos importados por este script
npm run db:import-demo:undo
```

**PowerShell (archivo custom):**

```powershell
npm run db:import-demo -- --file data/productos-demo.json
```

Variable opcional: `DEMO_IMPORT_FILE` (ruta por defecto al JSON si no pasás `--file`).

Script: [`scripts/import-demo-products.js`](scripts/import-demo-products.js).

---

## Errores frecuentes

| Síntoma | Solución |
|---------|----------|
| `self-signed certificate` al migrar | `DATABASE_SSL=true` en `.env` |
| `ECONNREFUSED` / timeout | Revisar `DATABASE_URL`, firewall, VPN |
| `password authentication failed` | Copiar de nuevo la URL desde Railway |
| Tablas vacías tras migrate | Ejecutar `npm run db:seed` |
| API responde 503 | Falta `DATABASE_URL` en `.env` en la raíz del repo |
| `relation "categorias" already exists` | `npx sequelize-cli db:migrate:status`; coordinar con el grupo antes de undo |

---

## Estructura del repositorio

```
├── server.js              # Servidor local + API REST
├── lib/
│   ├── catalog/           # CRUD con transacciones
│   └── backup/            # Backup / restore PostgreSQL
├── db/
│   ├── schema.sql         # DDL canónico
│   ├── migrations/
│   ├── seeders/
│   ├── models/
│   └── experiments/       # Scripts EXPLAIN
├── js/                    # Frontend (catálogo, admin, carrito)
├── data/productos-demo.json   # Catálogo demo (import opcional con db:import-demo)
├── scripts/import-demo-products.js
├── docs/BACKUP_RESTORE.md
├── informe/               # Informes de rendimiento
└── tests/                 # Tests unitarios / integración
```

---

## Scripts npm

| Comando | Acción |
|---------|--------|
| `npm run dev` | Servidor local en `:5173` |
| `npm run db:migrate` | Aplicar migraciones |
| `npm run db:seed` | Cargar seeds |
| `npm run db:setup` | Migrate + seed |
| `npm run db:import-demo` | Importar `data/productos-demo.json` a PostgreSQL (opcional) |
| `npm run db:import-demo:undo` | Quitar productos importados con prefijo `[demo-json]` |
| `npm run db:backup` | Crear backup |
| `npm run informe:c` | Generar salidas EXPLAIN para informe C |
| `npm test` | Ejecutar tests (backup + transacciones si hay `DATABASE_URL`) |

---

## Flujo Git (grupo)

- Trabajar en **rama propia**; integrar en `main` vía **pull request**.
- Mensajes de commit descriptivos: `feat(catalog): …`, `docs(readme): …`, `fix(db): …`.

---

## Demo en producción (frontend histórico)

Sitio desplegado en Vercel (puede usar infraestructura anterior): [https://web-agustina.vercel.app/](https://web-agustina.vercel.app/)

Para la entrega académica de Base de Datos, la referencia operativa es este repo con **PostgreSQL + API local + transacciones**.
