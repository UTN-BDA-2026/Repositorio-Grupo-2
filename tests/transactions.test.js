'use strict';

const assert = require('assert');
const { describe, it, before, after } = require('node:test');

const hasDatabase =
  process.env.DATABASE_URL != null && String(process.env.DATABASE_URL).trim() !== '';

describe('transacciones — catálogo', { skip: !hasDatabase }, () => {
  let catalog;
  let sequelize;

  before(async () => {
    require('dotenv').config();
    catalog = require('../lib/catalog');
    ({ sequelize } = require('../db/models'));
    await sequelize.authenticate();
  });

  after(async () => {
    if (sequelize) await sequelize.close();
  });

  it('createProduct hace rollback si la subcategoría no existe', async () => {
    const [beforeRows] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM productos`);
    const beforeCount = Number(beforeRows[0].n);

    await assert.rejects(
      () =>
        catalog.createProduct({
          name: 'Test rollback transacción',
          price: 1000,
          cat: 'indumentaria',
          sub: 'subcategoria-inexistente-xyz',
          image_url: 'https://example.com/img.webp',
        }),
      (err) => err.message.includes('no encontrada')
    );

    const [afterRows] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM productos`);
    assert.strictEqual(Number(afterRows[0].n), beforeCount);
  });

  it('createProduct confirma alta válida y updateProduct revierte cambios inválidos', async () => {
    const created = await catalog.createProduct({
      name: '[tx-test] Producto transaccional',
      price: 2500,
      cat: 'skincare',
      sub: 'limpieza',
      image_url: 'https://example.com/tx-test.webp',
      images: ['https://example.com/tx-test.webp'],
      descripcion: 'Prueba de transacciones',
    });

    assert.ok(created.id);
    assert.strictEqual(created.cat, 'skincare');
    assert.strictEqual(created.sub, 'limpieza');

    await assert.rejects(
      () => catalog.updateProduct(created.id, { cat: 'giftcards', sub: 'slug-invalido' }),
      (err) => err.message.includes('no encontrada')
    );

    const unchanged = await catalog.getProductById(created.id);
    assert.strictEqual(unchanged.cat, 'skincare');
    assert.strictEqual(unchanged.sub, 'limpieza');

    await catalog.deleteProduct(created.id);
  });
});

describe('transacciones — módulo exportado', () => {
  it('expone operaciones CRUD del servicio', () => {
    const catalog = require('../lib/catalog');
    assert.strictEqual(typeof catalog.createProduct, 'function');
    assert.strictEqual(typeof catalog.updateProduct, 'function');
    assert.strictEqual(typeof catalog.deleteProduct, 'function');
    assert.strictEqual(typeof catalog.listProducts, 'function');
  });
});
