'use strict';

require('dotenv').config();

function isLocalDatabaseHost(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function buildConnectionString() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.trim() !== '') {
    return databaseUrl.trim();
  }

  const user = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || '';
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '5432';
  const database = process.env.DB_NAME || 'postgres';

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}

function getDatabaseName(connectionString) {
  try {
    const url = new URL(connectionString);
    return decodeURIComponent(url.pathname.replace(/^\//, '') || 'postgres');
  } catch (_) {
    return 'postgres';
  }
}

function getPgToolEnv(connectionString) {
  const env = { ...process.env };

  let useSsl =
    process.env.DATABASE_SSL === 'true' ||
    process.env.NODE_ENV === 'production';

  try {
    const url = new URL(connectionString);
    if (isLocalDatabaseHost(url.hostname)) useSsl = false;
  } catch (_) {
    const host = process.env.DB_HOST || '127.0.0.1';
    if (isLocalDatabaseHost(host)) useSsl = false;
  }

  if (useSsl) {
    env.PGSSLMODE = process.env.PGSSLMODE || 'require';
  } else {
    env.PGSSLMODE = process.env.PGSSLMODE || 'prefer';
  }

  return env;
}

function getConnectionInfo() {
  const connectionString = buildConnectionString();
  return {
    connectionString,
    database: getDatabaseName(connectionString),
    pgEnv: getPgToolEnv(connectionString),
  };
}

module.exports = {
  buildConnectionString,
  getConnectionInfo,
  getDatabaseName,
  getPgToolEnv,
  isLocalDatabaseHost,
};
