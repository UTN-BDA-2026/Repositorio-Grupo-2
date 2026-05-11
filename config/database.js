require('dotenv').config();

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  process.env.NODE_ENV === 'production';

const dialectOptions = useSsl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
      },
    }
  : {};

const common = {
  dialect: 'postgres',
  dialectOptions,
  logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
};

const development =
  process.env.DATABASE_URL != null && process.env.DATABASE_URL !== ''
    ? { ...common, use_env_variable: 'DATABASE_URL' }
    : {
        ...common,
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
      };

module.exports = {
  development,
  test: development,
  production:
    process.env.DATABASE_URL != null && process.env.DATABASE_URL !== ''
      ? { ...common, use_env_variable: 'DATABASE_URL' }
      : development,
};
