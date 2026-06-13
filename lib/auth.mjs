// ============================================================================
//  Autenticación: contraseñas con scrypt + sesiones por cookie (sin dependencias)
// ============================================================================
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { db, saveDB } from './store.mjs';

const SESSION_COOKIE = 'qm_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// --- Hash de contraseñas ----------------------------------------------------
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${key}`;
}
export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, key] = stored.split(':');
  const hashed = scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  return keyBuf.length === hashed.length && timingSafeEqual(keyBuf, hashed);
}

// --- Usuarios ---------------------------------------------------------------
export function createUser({ username, name, password, isAdmin = false }) {
  username = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error('Usuario no válido (3-20 caracteres: letras, números o _).');
  }
  if (!password || String(password).length < 4) {
    throw new Error('La contraseña debe tener al menos 4 caracteres.');
  }
  if (db.users[username]) throw new Error('Ese usuario ya existe.');
  db.users[username] = {
    username,
    name: (name || username).trim(),
    passHash: hashPassword(password),
    isAdmin: !!isAdmin,
    createdAt: new Date().toISOString(),
  };
  saveDB();
  return db.users[username];
}

export function setPassword(username, newPassword) {
  const u = db.users[username];
  if (!u) throw new Error('Usuario no encontrado.');
  if (!newPassword || String(newPassword).length < 4) {
    throw new Error('La nueva contraseña debe tener al menos 4 caracteres.');
  }
  u.passHash = hashPassword(newPassword);
  saveDB();
}

export function ensureAdmin(adminCfg) {
  const username = adminCfg.username;
  if (!db.users[username]) {
    db.users[username] = {
      username,
      name: 'Administrador',
      passHash: hashPassword(adminCfg.password),
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };
    saveDB();
    console.log(`👑 Admin creado: "${username}" (contraseña inicial: la de ADMIN_PASS/config).`);
  } else {
    // Garantiza que sigue siendo admin.
    db.users[username].isAdmin = true;
  }
}

// --- Sesiones ---------------------------------------------------------------
export function login(username, password) {
  username = String(username || '').trim().toLowerCase();
  const u = db.users[username];
  if (!u || !verifyPassword(password, u.passHash)) {
    throw new Error('Usuario o contraseña incorrectos.');
  }
  const token = randomBytes(32).toString('hex');
  db.sessions[token] = { username, exp: Date.now() + SESSION_TTL_MS };
  saveDB();
  return token;
}
export function logout(token) {
  if (token && db.sessions[token]) { delete db.sessions[token]; saveDB(); }
}
export function userFromToken(token) {
  const s = token && db.sessions[token];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[token]; saveDB(); return null; }
  return db.users[s.username] || null;
}

// --- Cookies ----------------------------------------------------------------
export function parseCookies(req) {
  const out = {};
  const header = req.headers.cookie;
  if (!header) return out;
  header.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
export function sessionCookie(token, req) {
  const https = (req.headers['x-forwarded-proto'] || '').includes('https');
  const secure = https ? ' Secure;' : '';
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax;${secure} Max-Age=${maxAge}`;
}
export function clearCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
export { SESSION_COOKIE };
