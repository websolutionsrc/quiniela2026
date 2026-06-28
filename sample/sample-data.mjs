// ============================================================================
//  Datos de EJEMPLO (Mundial 2026) para probar sin token de la API.
//  Pensados para "ahora" simulado = 2026-06-13T16:00:00Z (ver config.mjs).
// ============================================================================
const T = (name, code) => ({ name, code });
const FT = (h, a) => ({ home: h, away: a });

const G = {
  A: [T('México', 'MEX'), T('Corea del Sur', 'KOR'), T('Croacia', 'CRO'), T('Ghana', 'GHA')],
  B: [T('Canadá', 'CAN'), T('Bélgica', 'BEL'), T('Marruecos', 'MAR'), T('Japón', 'JPN')],
  C: [T('Estados Unidos', 'USA'), T('Países Bajos', 'NED'), T('Senegal', 'SEN'), T('Ecuador', 'ECU')],
  D: [T('Brasil', 'BRA'), T('Suiza', 'SUI'), T('Nigeria', 'NGA'), T('Australia', 'AUS')],
};

let n = 0;
const id = () => 'demo-' + (++n);
const m = (o) => Object.assign({ id: id(), phase: 'GROUP', group: null, matchday: null, score: null }, o);

const matches = [
  // GRUPO A — J1 terminada, J2/J3 abiertas
  m({ group: 'A', matchday: 1, utcDate: '2026-06-11T18:00:00Z', status: 'FINISHED', home: G.A[0], away: G.A[1], score: FT(2, 1) }),
  m({ group: 'A', matchday: 1, utcDate: '2026-06-11T21:00:00Z', status: 'FINISHED', home: G.A[2], away: G.A[3], score: FT(0, 0) }),
  m({ group: 'A', matchday: 2, utcDate: '2026-06-15T18:00:00Z', status: 'TIMED', home: G.A[0], away: G.A[2] }),
  m({ group: 'A', matchday: 2, utcDate: '2026-06-15T21:00:00Z', status: 'TIMED', home: G.A[3], away: G.A[1] }),
  m({ group: 'A', matchday: 3, utcDate: '2026-06-19T18:00:00Z', status: 'TIMED', home: G.A[3], away: G.A[0] }),
  m({ group: 'A', matchday: 3, utcDate: '2026-06-19T18:00:00Z', status: 'TIMED', home: G.A[1], away: G.A[2] }),
  // GRUPO B — J1 terminada
  m({ group: 'B', matchday: 1, utcDate: '2026-06-12T18:00:00Z', status: 'FINISHED', home: G.B[0], away: G.B[1], score: FT(1, 3) }),
  m({ group: 'B', matchday: 1, utcDate: '2026-06-12T21:00:00Z', status: 'FINISHED', home: G.B[2], away: G.B[3], score: FT(2, 2) }),
  m({ group: 'B', matchday: 2, utcDate: '2026-06-16T18:00:00Z', status: 'TIMED', home: G.B[0], away: G.B[2] }),
  m({ group: 'B', matchday: 2, utcDate: '2026-06-16T21:00:00Z', status: 'TIMED', home: G.B[3], away: G.B[1] }),
  m({ group: 'B', matchday: 3, utcDate: '2026-06-20T18:00:00Z', status: 'TIMED', home: G.B[3], away: G.B[0] }),
  m({ group: 'B', matchday: 3, utcDate: '2026-06-20T18:00:00Z', status: 'TIMED', home: G.B[1], away: G.B[2] }),
  // GRUPO C — hoy: uno terminado y uno EN JUEGO
  m({ group: 'C', matchday: 1, utcDate: '2026-06-13T11:00:00Z', status: 'FINISHED', home: G.C[2], away: G.C[3], score: FT(0, 1) }),
  m({ group: 'C', matchday: 1, utcDate: '2026-06-13T14:00:00Z', status: 'IN_PLAY', home: G.C[0], away: G.C[1], score: FT(1, 1) }),
  m({ group: 'C', matchday: 2, utcDate: '2026-06-17T18:00:00Z', status: 'TIMED', home: G.C[0], away: G.C[2] }),
  m({ group: 'C', matchday: 2, utcDate: '2026-06-17T21:00:00Z', status: 'TIMED', home: G.C[3], away: G.C[1] }),
  m({ group: 'C', matchday: 3, utcDate: '2026-06-21T18:00:00Z', status: 'TIMED', home: G.C[3], away: G.C[0] }),
  m({ group: 'C', matchday: 3, utcDate: '2026-06-21T18:00:00Z', status: 'TIMED', home: G.C[1], away: G.C[2] }),
  // GRUPO D — abre hoy más tarde y mañana
  m({ group: 'D', matchday: 1, utcDate: '2026-06-13T20:00:00Z', status: 'TIMED', home: G.D[0], away: G.D[1] }),
  m({ group: 'D', matchday: 1, utcDate: '2026-06-14T18:00:00Z', status: 'TIMED', home: G.D[2], away: G.D[3] }),
  m({ group: 'D', matchday: 2, utcDate: '2026-06-18T18:00:00Z', status: 'TIMED', home: G.D[0], away: G.D[2] }),
  m({ group: 'D', matchday: 2, utcDate: '2026-06-18T21:00:00Z', status: 'TIMED', home: G.D[3], away: G.D[1] }),
  m({ group: 'D', matchday: 3, utcDate: '2026-06-22T18:00:00Z', status: 'TIMED', home: G.D[3], away: G.D[0] }),
  m({ group: 'D', matchday: 3, utcDate: '2026-06-22T18:00:00Z', status: 'TIMED', home: G.D[1], away: G.D[2] }),
];

// Equipos de ejemplo para la llave (solo para demostrar el cuadro interactivo).
const B = (name, code) => ({ name, code });
const bracketDemo = {
  'r32-1':  { a: B('South Africa', 'RSA'),   b: B('Canada', 'CAN') },
  'r32-2':  { a: B('Netherlands', 'NED'),    b: B('Morocco', 'MAR') },
  'r32-3':  { a: B('Germany', 'GER'),        b: B('Paraguay', 'PAR') },
  'r32-4':  { a: B('France', 'FRA'),         b: B('Sweden', 'SWE') },
  'r32-5':  { a: B('Belgium', 'BEL'),        b: B('Senegal', 'SEN') },
  'r32-6':  { a: B('United States', 'USA'),  b: B('Bosnia-Herzegovina', 'BIH') },
  'r32-7':  { a: B('Spain', 'ESP'),          b: B('Austria', 'AUT') },
  'r32-8':  { a: B('Portugal', 'POR'),       b: B('Croatia', 'CRO') },
  'r32-9':  { a: B('Brazil', 'BRA'),         b: B('Japan', 'JPN') },
  'r32-10': { a: B('Ivory Coast', 'CIV'),    b: B('Norway', 'NOR') },
  'r32-11': { a: B('Mexico', 'MEX'),         b: B('Ecuador', 'ECU') },
  'r32-12': { a: B('England', 'ENG'),        b: B('Congo DR', 'COD') },
  'r32-13': { a: B('Switzerland', 'SUI'),    b: B('Algeria', 'ALG') },
  'r32-14': { a: B('Colombia', 'COL'),       b: B('Ghana', 'GHA') },
  'r32-15': { a: B('Australia', 'AUS'),      b: B('Egypt', 'EGY') },
  'r32-16': { a: B('Argentina', 'ARG'),      b: B('Cape Verde Islands', 'CPV') },
};

// Finalistas de ejemplo (solo para poder probar la apuesta de la Final en la demo).
const finalDemo = { home: B('Argentina', 'ARG'), away: B('Francia', 'FRA') };

export const SAMPLE = {
  source: 'datos-de-ejemplo',
  fetchedAt: '2026-06-13T16:00:00Z',
  matches,
  bracketDemo,
  finalDemo,
};
