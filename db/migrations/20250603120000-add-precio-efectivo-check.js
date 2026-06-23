'use strict';

/**
 * Corrige la restricción lógica entre precio de lista y precio promocional.
 * Reemplaza el CHECK que solo validaba precio_efectivo >= 0 por uno que exige
 * precio_efectivo <= precio cuando no es NULL.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE productos
        DROP CONSTRAINT IF EXISTS productos_precio_efectivo_check;

      ALTER TABLE productos
        DROP CONSTRAINT IF EXISTS productos_precio_efectivo_chk;

      ALTER TABLE productos
        ADD CONSTRAINT productos_precio_efectivo_chk CHECK (
          precio_efectivo IS NULL
          OR (precio_efectivo >= 0 AND precio_efectivo <= precio)
        );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE productos
        DROP CONSTRAINT IF EXISTS productos_precio_efectivo_chk;

      ALTER TABLE productos
        ADD CONSTRAINT productos_precio_efectivo_check CHECK (
          precio_efectivo IS NULL OR precio_efectivo >= 0
        );
    `);
  },
};
