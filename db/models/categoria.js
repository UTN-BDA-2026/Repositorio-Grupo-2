'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Categoria extends Model {
    static associate(models) {
      Categoria.hasMany(models.Subcategoria, {
        foreignKey: 'categoria_id',
        as: 'subcategorias',
      });
    }
  }

  Categoria.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      slug: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Categoria',
      tableName: 'categorias',
      underscored: true,
      timestamps: false,
    }
  );

  return Categoria;
};
