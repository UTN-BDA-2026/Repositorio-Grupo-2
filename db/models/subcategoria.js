'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subcategoria extends Model {
    static associate(models) {
      Subcategoria.belongsTo(models.Categoria, {
        foreignKey: 'categoria_id',
        as: 'categoria',
      });
      Subcategoria.hasMany(models.Producto, {
        foreignKey: 'subcategoria_id',
        as: 'productos',
      });
    }
  }

  Subcategoria.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      categoria_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Subcategoria',
      tableName: 'subcategorias',
      underscored: true,
      timestamps: false,
    }
  );

  return Subcategoria;
};
