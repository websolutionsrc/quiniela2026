// ============================================================================
//  Quiniela Mundial 2026 — Configuración del servidor
// ============================================================================
export const CONFIG = {
  appName: 'Quiniela Mundial 2026',
  port: Number(process.env.PORT || 8026),

  // --- Admin inicial -------------------------------------------------------
  // Se crea automáticamente la primera vez que arranca el servidor.
  // Cámbialo con variables de entorno o edítalo aquí antes del primer arranque.
  admin: {
    username: (process.env.ADMIN_USER || 'admin').toLowerCase(),
    password: process.env.ADMIN_PASS || 'quiniela2026',
  },

  // --- football-data.org ---------------------------------------------------
  api: {
    token: process.env.FOOTBALL_DATA_TOKEN || '',
    competition: 'WC',
    baseUrl: 'https://api.football-data.org/v4',
  },

  // --- Reloj ---------------------------------------------------------------
  // Fecha "ahora" simulada para la DEMO (fase de grupos del Mundial 2026).
  // Pon null para usar la fecha real del servidor en producción.
  simulatedNow: process.env.REAL_CLOCK ? null : '2026-06-13T16:00:00Z',

  // --- Demo ----------------------------------------------------------------
  demo: {
    // Si no hay token de la API, usa los datos de ejemplo de sample/.
    useSampleWhenNoToken: true,
    // Permite abrir la llave aunque los grupos no hayan terminado (solo para
    // poder probar la interfaz de llave en la demo). En producción: false.
    forceOpenBracket: !process.env.REAL_CLOCK,
  },

  // --- Puntuación ----------------------------------------------------------
  scoring: {
    // Fase de grupos: predices el marcador de cada partido.
    group: {
      exactScore: 3,  // marcador exacto
      signPartial: 1, // solo el ganador/empate (sin marcador exacto)
      sign: 1,        // formato 1X2 (acertar el signo)
    },
    // Llave: predices quién avanza en cada cruce.
    bracket: {
      perWinner: 2,   // por cada cruce acertado (igual en TODAS las rondas)
      top4Bonus: 5,   // extra por cada semifinalista (top 4) acertado
    },
  },

  // --- Fases (para etiquetas e interfaz) -----------------------------------
  phases: [
    { key: 'GROUP', name: 'Fase de grupos' },
    { key: 'BRACKET', name: 'Eliminatorias (llave)' },
  ],
};

// ============================================================================
//  Árbol de la llave del Mundial 2026 (48 equipos)
//  R32 (1/16) -> R16 (octavos) -> QF (cuartos) -> SF (semis) -> Final (+ 3.º)
//  Los pares se emparejan por índice: R16[j] = ganador(R32[2j]) vs ganador(R32[2j+1]).
//  Las etiquetas (1E, 2A, 3.º ...) son las posiciones del cuadro oficial; antes
//  de que terminen los grupos se muestran tal cual; después se rellenan con los
//  equipos reales.
// ============================================================================
export const BRACKET = {
  // 16 cruces de 1/16, en orden de cuadro (mitad izquierda 0-7, derecha 8-15).
  r32: [
    { id: 'r32-1',  a: '1E', b: '3.º ABCDF', date: '2026-06-29', venue: 'Boston' },
    { id: 'r32-2',  a: '1I', b: '3.º CDFGH', date: '2026-06-30', venue: 'Nueva York' },
    { id: 'r32-3',  a: '2A', b: '2B',        date: '2026-06-28', venue: 'Los Ángeles' },
    { id: 'r32-4',  a: '1F', b: '2C',        date: '2026-06-29', venue: 'Monterrey' },
    { id: 'r32-5',  a: '2K', b: '2L',        date: '2026-07-02', venue: 'Toronto' },
    { id: 'r32-6',  a: '1H', b: '2J',        date: '2026-07-02', venue: 'Los Ángeles' },
    { id: 'r32-7',  a: '1D', b: '3.º BEFIJ', date: '2026-07-01', venue: 'San Francisco' },
    { id: 'r32-8',  a: '1G', b: '3.º AEHIJ', date: '2026-07-01', venue: 'Seattle' },
    { id: 'r32-9',  a: '1C', b: '2F',        date: '2026-06-29', venue: 'Houston' },
    { id: 'r32-10', a: '2E', b: '2I',        date: '2026-06-30', venue: 'Dallas' },
    { id: 'r32-11', a: '1A', b: '3.º GEFHI', date: '2026-06-30', venue: 'Ciudad de México' },
    { id: 'r32-12', a: '1L', b: '3.º EHIJK', date: '2026-07-01', venue: 'Atlanta' },
    { id: 'r32-13', a: '1J', b: '2H',        date: '2026-07-03', venue: 'Miami' },
    { id: 'r32-14', a: '2D', b: '2G',        date: '2026-07-03', venue: 'Dallas' },
    { id: 'r32-15', a: '1B', b: '3.º EFGIJ', date: '2026-07-02', venue: 'Vancouver' },
    { id: 'r32-16', a: '1K', b: '3.º DEIJK', date: '2026-07-03', venue: 'Kansas City' },
  ],
  // Metadatos por ronda (las rondas se calculan emparejando por índice).
  rounds: [
    { key: 'R32',   name: '1/16 de final', size: 16 },
    { key: 'R16',   name: 'Octavos',       size: 8 },
    { key: 'QF',    name: 'Cuartos',       size: 4 },
    { key: 'SF',    name: 'Semifinales',   size: 2 },
    { key: 'FINAL', name: 'Final',         size: 1 },
  ],
};
