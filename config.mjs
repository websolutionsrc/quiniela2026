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
  },

  // --- Puntuación ----------------------------------------------------------
  scoring: {
    // Fase de grupos: predices el marcador de cada partido.
    group: {
      exactScore: 3,  // marcador exacto
      signPartial: 2, // ganador/empate, acumulable con marcador exacto
      sign: 0,        // extra por formato 1X2
    },
    // Llave: predices quién avanza en cada cruce.
    bracket: {
      perWinner: 2,     // valor inicial y paso de cada racha: +2, +4, +6...
      top4Bonus: 5,     // extra por cada semifinalista (top 4) acertado
      finalistBonus: 6, // extra por cada finalista acertado
    },
    // La Final: apuesta especial cuando se conocen los finalistas.
    final: {
      exactScore: 7,     // marcador exacto de la final (90'/tiempo reglamentario)
      signPartial: 0,    // sin puntos por signo en la final
      sign: 0,           // sin extra por 1X2 en la final
      championBonus: 10, // por acertar el CAMPEÓN (incluye prórroga/penaltis)
    },
  },

  // --- Fases (para etiquetas e interfaz) -----------------------------------
  phases: [
    { key: 'GROUP', name: 'Fase de grupos' },
    { key: 'BRACKET', name: 'Eliminatorias (llave)' },
  ],

  // --- Bota de Oro / Goleador del torneo -----------------------------------
  // Se abre con la fase eliminatoria. En producción los 20 candidatos se
  // congelan desde football-data.org/scorers cuando terminan los grupos.
  // `candidates` queda como respaldo si no hay API o en desarrollo local.
  // Pon `actual` con el id ganador de la Bota de Oro para repartir puntos.
  mvp: {
    points: 10,        // puntos por acertar la Bota de Oro
    actual: null,      // id del goleador ganador (p.ej. 'p2'); null hasta conocerse
    candidates: [
      { id: 'p1',  name: 'Lionel Messi',     team: 'Argentina',      code: 'ARG' },
      { id: 'p2',  name: 'Kylian Mbappé',    team: 'Francia',        code: 'FRA' },
      { id: 'p3',  name: 'Jude Bellingham',  team: 'Inglaterra',     code: 'ENG' },
      { id: 'p4',  name: 'Vinícius Júnior',  team: 'Brasil',         code: 'BRA' },
      { id: 'p5',  name: 'Lamine Yamal',     team: 'España',         code: 'ESP' },
      { id: 'p6',  name: 'Harry Kane',       team: 'Inglaterra',     code: 'ENG' },
      { id: 'p7',  name: 'Kevin De Bruyne',  team: 'Bélgica',        code: 'BEL' },
      { id: 'p8',  name: 'Rodrygo',          team: 'Brasil',         code: 'BRA' },
      { id: 'p9',  name: 'Pedri',            team: 'España',         code: 'ESP' },
      { id: 'p10', name: 'Christian Pulisic',team: 'Estados Unidos', code: 'USA' },
    ],
  },
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
    { id: 'r32-1',  a: '2A', b: '2B',        date: '2026-06-28', venue: 'Los Ángeles' },
    { id: 'r32-2',  a: '1F', b: '2C',        date: '2026-06-30', venue: 'Monterrey' },
    { id: 'r32-3',  a: '1E', b: '3.º ABCDF', date: '2026-06-29', venue: 'Boston' },
    { id: 'r32-4',  a: '1I', b: '3.º CDFGH', date: '2026-06-30', venue: 'Nueva York' },
    { id: 'r32-5',  a: '1G', b: '3.º AEHIJ', date: '2026-07-01', venue: 'Seattle' },
    { id: 'r32-6',  a: '1D', b: '3.º BEFIJ', date: '2026-07-01', venue: 'San Francisco' },
    { id: 'r32-7',  a: '1H', b: '2J',        date: '2026-07-02', venue: 'Los Ángeles' },
    { id: 'r32-8',  a: '2K', b: '2L',        date: '2026-07-02', venue: 'Toronto' },
    { id: 'r32-9',  a: '1C', b: '2F',        date: '2026-06-29', venue: 'Houston' },
    { id: 'r32-10', a: '2E', b: '2I',        date: '2026-06-30', venue: 'Dallas' },
    { id: 'r32-11', a: '1A', b: '3.º CEFHI', date: '2026-06-30', venue: 'Ciudad de México' },
    { id: 'r32-12', a: '1L', b: '3.º EHIJK', date: '2026-07-01', venue: 'Atlanta' },
    { id: 'r32-13', a: '1B', b: '3.º EFGIJ', date: '2026-07-02', venue: 'Vancouver' },
    { id: 'r32-14', a: '1K', b: '3.º DEIJK', date: '2026-07-03', venue: 'Kansas City' },
    { id: 'r32-15', a: '2D', b: '2G',        date: '2026-07-03', venue: 'Dallas' },
    { id: 'r32-16', a: '1J', b: '2H',        date: '2026-07-03', venue: 'Miami' },
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
