// ============================================================================
//  Almacén en ficheros JSON (sin dependencias). Escritura atómica.
//  data/db.json       -> usuarios, sesiones, predicciones, meta
//  data/results.json  -> partidos/resultados (cache de la API o ejemplo)
// ============================================================================
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');
const RESULTS_FILE = join(DATA_DIR, 'results.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file, def) {
  try { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : def; }
  catch (e) { console.warn('No se pudo leer', file, e.message); return def; }
}
function writeJSONAtomic(file, obj) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  renameSync(tmp, file); // rename atómico
}

// --- Base de datos principal ------------------------------------------------
const db = readJSON(DB_FILE, {
  users: {},        // { username: { username, name, passHash, isAdmin, createdAt } }
  sessions: {},     // { token: { username, exp } }
  predictions: {},  // { username: { group:{submitted,at,picks}, bracket:{submitted,at,picks} } }
  meta: {},
});
// Asegurar forma
db.users = db.users || {};
db.sessions = db.sessions || {};
db.predictions = db.predictions || {};
db.meta = db.meta || {};

let saveTimer = null;
export function saveDB() {
  // Guardado inmediato pero coalescido si llegan muchas escrituras seguidas.
  clearTimeout(saveTimer);
  writeJSONAtomic(DB_FILE, db);
}

export { db };

// --- Resultados (cache de partidos) -----------------------------------------
export function readResults() {
  return readJSON(RESULTS_FILE, null);
}
export function writeResults(payload) {
  writeJSONAtomic(RESULTS_FILE, payload);
}
export function clearResults() {
  if (existsSync(RESULTS_FILE)) unlinkSync(RESULTS_FILE);
}
