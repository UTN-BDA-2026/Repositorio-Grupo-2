require('dotenv').config();

function isLocalDatabaseHost(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

const hasDatabaseUrl =
  process.env.DATABASE_URL != null && process.env.DATABASE_URL !== '';

let useSsl =
  process.env.DATABASE_SSL === 'true' ||
  process.env.NODE_ENV === 'production';

if (hasDatabaseUrl) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    if (isLocalDatabaseHost(u.hostname)) useSsl = false;
  } catch (_) {
    /* URL inválida: sequelize fallará después con un error claro */
  }
} else {
  const host = process.env.DB_HOST || '127.0.0.1';
  if (isLocalDatabaseHost(host)) useSsl = false;
}

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

const development = hasDatabaseUrl
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
  production: hasDatabaseUrl
      ? { ...common, use_env_variable: 'DATABASE_URL' }
      : development,
};
