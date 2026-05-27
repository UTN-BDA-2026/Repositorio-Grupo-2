'use strict';

/**
 * Catálogo base: categorías y subcategorías (slugs compatibles con el CHECK del DDL y con el admin).
 * Idempotente: ON CONFLICT no duplica filas.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      INSERT INTO categorias (slug, nombre) VALUES
        ('indumentaria', 'Indumentaria'),
        ('maquillaje', 'Maquillaje'),
        ('skincare', 'Skincare'),
        ('tazas', 'Tazas'),
        ('botellas-y-vasos', 'Botellas y vasos'),
        ('regaleria', 'Regalería'),
        ('necesers', 'Necesers'),
        ('marroquineria', 'Marroquinería'),
        ('accesorios', 'Accesorios'),
        ('giftcards', 'Gift cards')
      ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre;
    `);

    await sequelize.query(`
      INSERT INTO subcategorias (categoria_id, slug, nombre) VALUES
        ((SELECT id FROM categorias WHERE slug = 'indumentaria'), 'para-el-cabello', 'Para el cabello'),
        ((SELECT id FROM categorias WHERE slug = 'indumentaria'), 'bijou', 'Bijou'),
        ((SELECT id FROM categorias WHERE slug = 'indumentaria'), 'llaveros', 'Llaveros'),
        ((SELECT id FROM categorias WHERE slug = 'indumentaria'), 'acero-quirurgico', 'Acero quirúrgico'),
        ((SELECT id FROM categorias WHERE slug = 'maquillaje'), 'labiales', 'Labiales'),
        ((SELECT id FROM categorias WHERE slug = 'maquillaje'), 'sombras', 'Sombras'),
        ((SELECT id FROM categorias WHERE slug = 'skincare'), 'limpieza', 'Limpieza'),
        ((SELECT id FROM categorias WHERE slug = 'skincare'), 'hidratacion', 'Hidratación'),
        ((SELECT id FROM categorias WHERE slug = 'tazas'), 'tazas-ceramica', 'Tazas cerámica'),
        ((SELECT id FROM categorias WHERE slug = 'tazas'), 'tazas-termicas', 'Tazas térmicas'),
        ((SELECT id FROM categorias WHERE slug = 'botellas-y-vasos'), 'botellas', 'Botellas'),
        ((SELECT id FROM categorias WHERE slug = 'botellas-y-vasos'), 'vasos', 'Vasos'),
        ((SELECT id FROM categorias WHERE slug = 'regaleria'), 'libreria', 'Librería'),
        ((SELECT id FROM categorias WHERE slug = 'regaleria'), 'agendas', 'Agendas'),
        ((SELECT id FROM categorias WHERE slug = 'necesers'), 'portacosmeticos', 'Portacosméticos'),
        ((SELECT id FROM categorias WHERE slug = 'necesers'), 'organizadores', 'Organizadores'),
        ((SELECT id FROM categorias WHERE slug = 'marroquineria'), 'carteras', 'Carteras'),
        ((SELECT id FROM categorias WHERE slug = 'marroquineria'), 'mochilas', 'Mochilas'),
        ((SELECT id FROM categorias WHERE slug = 'accesorios'), 'aros', 'Aros'),
        ((SELECT id FROM categorias WHERE slug = 'accesorios'), 'collares', 'Collares'),
        ((SELECT id FROM categorias WHERE slug = 'giftcards'), 'montos-fijos', 'Montos fijos'),
        ((SELECT id FROM categorias WHERE slug = 'giftcards'), 'personalizada', 'Personalizada')
      ON CONFLICT (categoria_id, slug) DO UPDATE SET nombre = EXCLUDED.nombre;
    `);
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(`DELETE FROM productos WHERE nombre LIKE '[seed-exp] %';`);
    await sequelize.query(`
      DELETE FROM subcategorias
      WHERE slug IN (
        'para-el-cabello', 'bijou', 'llaveros', 'acero-quirurgico',
        'labiales', 'sombras', 'limpieza', 'hidratacion',
        'tazas-ceramica', 'tazas-termicas', 'botellas', 'vasos',
        'libreria', 'agendas', 'portacosmeticos', 'organizadores',
        'carteras', 'mochilas', 'aros', 'collares', 'montos-fijos', 'personalizada'
      );
    `);
    await sequelize.query(`
      DELETE FROM categorias
      WHERE slug IN (
        'indumentaria', 'maquillaje', 'skincare', 'tazas', 'botellas-y-vasos',
        'regaleria', 'necesers', 'marroquineria', 'accesorios', 'giftcards'
      );
    `);
  },
};
