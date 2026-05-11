-- =============================================================================
-- AGUSTINA — esquema lógico/físico (PostgreSQL)
-- Alineado al catálogo y al panel admin: categoría, subcategoría, precios,
-- imágenes (URL principal + galería), descripción, flag activo y fechas.
-- Los índices de experimentación (EXPLAIN ANALYZE) se agregan aparte;
-- aquí solo PK, unicidades y el índice de apoyo a la FK en productos.
-- =============================================================================

-- Para recrear en desarrollo (descomentar y ejecutar antes del resto):
-- DROP VIEW IF EXISTS v_productos_catalogo CASCADE;
-- DROP TABLE IF EXISTS productos CASCADE;
-- DROP TABLE IF EXISTS subcategorias CASCADE;
-- DROP TABLE IF EXISTS categorias CASCADE;

BEGIN;

CREATE TABLE categorias (
    id          SMALLSERIAL PRIMARY KEY,
    slug        VARCHAR(64)  NOT NULL UNIQUE,
    nombre      VARCHAR(120) NOT NULL,
    CONSTRAINT categorias_slug_chk CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

COMMENT ON TABLE categorias IS 'Rubros del catálogo (slugs usados en filtros del frontend: indumentaria, giftcards, etc.).';
COMMENT ON COLUMN categorias.slug IS 'Identificador estable en URL y API; coincide con el campo cat del JSON público.';

CREATE TABLE subcategorias (
    id            SERIAL PRIMARY KEY,
    categoria_id  SMALLINT NOT NULL REFERENCES categorias (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    slug          VARCHAR(64)  NOT NULL,
    nombre        VARCHAR(120) NOT NULL,
    CONSTRAINT subcategorias_categoria_slug_uk UNIQUE (categoria_id, slug),
    CONSTRAINT subcategorias_slug_chk CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

COMMENT ON TABLE subcategorias IS 'Subrubro bajo una categoría; el slug corresponde al campo sub del JSON público.';
COMMENT ON COLUMN subcategorias.categoria_id IS 'FK a categorias; ON DELETE RESTRICT evita borrar una categoría con productos.';

CREATE TABLE productos (
    id                BIGSERIAL PRIMARY KEY,
    nombre            VARCHAR(255) NOT NULL,
    precio            INTEGER      NOT NULL CHECK (precio >= 0),
    precio_efectivo   INTEGER CHECK (precio_efectivo IS NULL OR precio_efectivo >= 0),
    subcategoria_id   INTEGER      NOT NULL REFERENCES subcategorias (id) ON UPDATE CASCADE ON DELETE RESTRICT,
    image_url         TEXT         NOT NULL,
    images            TEXT[]       NOT NULL DEFAULT '{}'::text[],
    descripcion       TEXT,
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT productos_nombre_len_chk CHECK (char_length(trim(nombre)) > 0)
);

COMMENT ON TABLE productos IS 'Artículos del catálogo; nombre/precio/imagen alineados a los campos name, price, image_url del API.';
COMMENT ON COLUMN productos.precio IS 'Precio de lista en ARS (entero), como en el frontend.';
COMMENT ON COLUMN productos.precio_efectivo IS 'Precio promocional en efectivo; NULL si no aplica.';
COMMENT ON COLUMN productos.images IS 'URLs adicionales (Cloudinary u otro CDN); la principal sigue en image_url.';
COMMENT ON COLUMN productos.activo IS 'Si FALSE, el producto no debería mostrarse en el catálogo público.';

CREATE INDEX idx_productos_subcategoria_id ON productos (subcategoria_id);

CREATE OR REPLACE VIEW v_productos_catalogo AS
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
    p.activo,
    p.created_at,
    p.updated_at
FROM productos p
JOIN subcategorias s ON s.id = p.subcategoria_id
JOIN categorias    c ON c.id = s.categoria_id;

COMMENT ON VIEW v_productos_catalogo IS 'Proyección tipo JSON del catálogo: expone cat/sub por join sin duplicar slugs en productos.';

COMMIT;
