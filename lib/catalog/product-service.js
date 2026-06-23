'use strict';

const db = require('../../db/models');

const CATALOG_VIEW_SQL = `
  SELECT
    id,
    name,
    price,
    precio_efectivo,
    cat,
    sub,
    image_url,
    images,
    descripcion,
    activo,
    created_at,
    updated_at
  FROM v_productos_catalogo
`;

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function mapRow(row) {
  return {
    id: Number(row.id),
    name: row.name,
    price: Number(row.price),
    precio_efectivo: row.precio_efectivo != null ? Number(row.precio_efectivo) : null,
    cat: row.cat,
    sub: row.sub || '',
    image_url: row.image_url,
    images: Array.isArray(row.images) ? row.images : [],
    descripcion: row.descripcion,
    activo: Boolean(row.activo),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function queryCatalog(sql, options = {}) {
  const [rows] = await db.sequelize.query(sql, options);
  return rows;
}

async function fetchProductFromView(id, transaction) {
  const rows = await queryCatalog(`${CATALOG_VIEW_SQL} WHERE id = $1 LIMIT 1`, {
    bind: [id],
    transaction,
  });
  return rows.length ? mapRow(rows[0]) : null;
}

/**
 * Resuelve subcategoria_id a partir de slugs cat/sub dentro de una transacción.
 * Si sub viene vacío, usa la primera subcategoría de la categoría (compat. frontend).
 */
async function resolveSubcategoriaId(cat, sub, transaction) {
  const catSlug = String(cat || '').trim();
  const subSlug = String(sub || '').trim();

  if (!catSlug) {
    throw httpError('La categoría es obligatoria');
  }

  const sql = subSlug
    ? `
      SELECT s.id
      FROM subcategorias s
      INNER JOIN categorias c ON c.id = s.categoria_id
      WHERE c.slug = $1 AND s.slug = $2
      LIMIT 1
    `
    : `
      SELECT s.id
      FROM subcategorias s
      INNER JOIN categorias c ON c.id = s.categoria_id
      WHERE c.slug = $1
      ORDER BY s.id
      LIMIT 1
    `;

  const bind = subSlug ? [catSlug, subSlug] : [catSlug];
  const rows = await queryCatalog(sql, { bind, transaction });

  if (!rows.length) {
    throw httpError(
      subSlug
        ? `Combinación categoría/subcategoría no encontrada: ${catSlug} / ${subSlug}`
        : `Categoría sin subcategorías: ${catSlug}`
    );
  }

  return Number(rows[0].id);
}

async function listProducts({ activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE activo = TRUE' : '';
  const rows = await queryCatalog(
    `${CATALOG_VIEW_SQL} ${where} ORDER BY created_at DESC, id DESC`
  );
  return rows.map(mapRow);
}

async function getProductById(id, { activeOnly = false } = {}) {
  const conditions = ['id = $1'];
  const bind = [id];

  if (activeOnly) {
    conditions.push('activo = TRUE');
  }

  const rows = await queryCatalog(
    `${CATALOG_VIEW_SQL} WHERE ${conditions.join(' AND ')} LIMIT 1`,
    { bind }
  );

  return rows.length ? mapRow(rows[0]) : null;
}

/**
 * Alta de producto: resolución de taxonomía + INSERT en una transacción ACID.
 */
async function createProduct(payload) {
  return db.sequelize.transaction(async (transaction) => {
    const nombre = String(payload.name || '').trim();
    if (!nombre) throw httpError('El nombre es obligatorio');

    const precio = Number(payload.price);
    if (!Number.isInteger(precio) || precio < 0) {
      throw httpError('El precio debe ser un número entero no negativo');
    }

    const imageUrl = payload.image_url;
    if (!imageUrl) throw httpError('image_url es obligatorio');

    const images = Array.isArray(payload.images) && payload.images.length
      ? payload.images
      : [imageUrl];

    const precioEfectivo =
      payload.precio_efectivo != null && payload.precio_efectivo !== ''
        ? Number(payload.precio_efectivo)
        : null;

    if (precioEfectivo != null && (!Number.isInteger(precioEfectivo) || precioEfectivo < 0)) {
      throw httpError('El precio efectivo debe ser un número entero no negativo');
    }

    if (precioEfectivo != null && precioEfectivo > precio) {
      throw httpError('El precio efectivo no puede ser mayor al precio de lista');
    }

    const subcategoriaId = await resolveSubcategoriaId(payload.cat, payload.sub, transaction);

    const inserted = await queryCatalog(
      `
      INSERT INTO productos (
        nombre, precio, precio_efectivo, subcategoria_id,
        image_url, images, descripcion, activo, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6::text[], $7, TRUE, NOW(), NOW()
      )
      RETURNING id
      `,
      {
        bind: [
          nombre,
          precio,
          precioEfectivo,
          subcategoriaId,
          imageUrl,
          images,
          payload.descripcion ?? null,
        ],
        transaction,
      }
    );

    const product = await fetchProductFromView(inserted[0].id, transaction);
    if (!product) throw httpError('No se pudo leer el producto recién creado', 500);
    return product;
  });
}

/**
 * Actualización parcial con bloqueo de fila (SELECT FOR UPDATE) y re-resolución de FK si cambia cat/sub.
 */
async function updateProduct(id, payload) {
  const productId = Number(id);
  if (!Number.isFinite(productId)) throw httpError('ID inválido');

  return db.sequelize.transaction(async (transaction) => {
    const locked = await queryCatalog(
      `SELECT id FROM productos WHERE id = $1 FOR UPDATE`,
      { bind: [productId], transaction }
    );

    if (!locked.length) throw httpError('Producto no encontrado', 404);

    const current = await fetchProductFromView(productId, transaction);
    if (!current) throw httpError('Producto no encontrado', 404);

    const sets = [];
    const bind = [];
    let param = 1;

    if (payload.name != null) {
      const nombre = String(payload.name).trim();
      if (!nombre) throw httpError('El nombre no puede estar vacío');
      sets.push(`nombre = $${param++}`);
      bind.push(nombre);
    }

    if (payload.price != null) {
      const precio = Number(payload.price);
      if (!Number.isInteger(precio) || precio < 0) {
        throw httpError('El precio debe ser un número entero no negativo');
      }
      sets.push(`precio = $${param++}`);
      bind.push(precio);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'precio_efectivo')) {
      const pe =
        payload.precio_efectivo != null && payload.precio_efectivo !== ''
          ? Number(payload.precio_efectivo)
          : null;
      if (pe != null && (!Number.isInteger(pe) || pe < 0)) {
        throw httpError('El precio efectivo debe ser un número entero no negativo');
      }
      sets.push(`precio_efectivo = $${param++}`);
      bind.push(pe);
    }

    if (payload.cat != null || payload.sub != null) {
      const cat = payload.cat != null ? payload.cat : current.cat;
      const sub = payload.sub != null ? payload.sub : current.sub;
      const subcategoriaId = await resolveSubcategoriaId(cat, sub, transaction);
      sets.push(`subcategoria_id = $${param++}`);
      bind.push(subcategoriaId);
    }

    if (payload.image_url != null) {
      sets.push(`image_url = $${param++}`);
      bind.push(payload.image_url);
    }

    if (payload.images != null) {
      sets.push(`images = $${param++}::text[]`);
      bind.push(Array.isArray(payload.images) ? payload.images : []);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'descripcion')) {
      sets.push(`descripcion = $${param++}`);
      bind.push(payload.descripcion);
    }

    if (payload.activo != null) {
      sets.push(`activo = $${param++}`);
      bind.push(Boolean(payload.activo));
    }

    if (!sets.length) {
      return current;
    }

    const effectivePrecio =
      payload.price != null ? Number(payload.price) : Number(current.price);
    const effectivePrecioEfectivo = Object.prototype.hasOwnProperty.call(
      payload,
      'precio_efectivo'
    )
      ? payload.precio_efectivo != null && payload.precio_efectivo !== ''
        ? Number(payload.precio_efectivo)
        : null
      : current.precio_efectivo;

    if (
      effectivePrecioEfectivo != null &&
      effectivePrecioEfectivo > effectivePrecio
    ) {
      throw httpError('El precio efectivo no puede ser mayor al precio de lista');
    }

    sets.push('updated_at = NOW()');
    bind.push(productId);

    await queryCatalog(`UPDATE productos SET ${sets.join(', ')} WHERE id = $${param}`, {
      bind,
      transaction,
    });

    const updated = await fetchProductFromView(productId, transaction);
    if (!updated) throw httpError('No se pudo leer el producto actualizado', 500);
    return updated;
  });
}

/**
 * Baja lógica/física de producto con bloqueo previo a la eliminación.
 */
async function deleteProduct(id) {
  const productId = Number(id);
  if (!Number.isFinite(productId)) throw httpError('ID inválido');

  return db.sequelize.transaction(async (transaction) => {
    const locked = await queryCatalog(
      `SELECT id FROM productos WHERE id = $1 FOR UPDATE`,
      { bind: [productId], transaction }
    );

    if (!locked.length) throw httpError('Producto no encontrado', 404);

    await queryCatalog(`DELETE FROM productos WHERE id = $1`, {
      bind: [productId],
      transaction,
    });

    return { id: productId, deleted: true };
  });
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  resolveSubcategoriaId,
};
