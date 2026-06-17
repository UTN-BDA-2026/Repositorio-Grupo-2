'use strict';

const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD != null ? String(process.env.ADMIN_PASSWORD) : '';
}

function isAuthConfigured() {
  return getAdminPassword().length > 0;
}

function login(password) {
  if (!isAuthConfigured()) {
    return { ok: false, status: 503, error: 'ADMIN_PASSWORD no configurada en el servidor (.env)' };
  }
  if (String(password) !== getAdminPassword()) {
    return { ok: false, status: 401, error: 'Contraseña incorrecta' };
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
  return { ok: true, token };
}

function validateToken(token) {
  if (!token || !isAuthConfigured()) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function checkAdminRequest(req) {
  if (!isAuthConfigured()) {
    return { ok: false, status: 503, error: 'ADMIN_PASSWORD no configurada en el servidor (.env)' };
  }
  const token = extractBearerToken(req);
  if (!validateToken(token)) {
    return { ok: false, status: 401, error: 'No autorizado. Iniciá sesión en el panel admin.' };
  }
  return { ok: true };
}

module.exports = {
  login,
  checkAdminRequest,
  isAuthConfigured,
  validateToken,
  extractBearerToken,
};
