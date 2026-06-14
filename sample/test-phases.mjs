// ============================================================================
//  Fixtures de validación para administradores.
//  No tocan predicciones: solo sustituyen temporalmente data/results.json.
// ============================================================================
import { SAMPLE } from './sample-data.mjs';

const FT = (home, away) => ({ home, away });
const clone = (x) => JSON.parse(JSON.stringify(x));

export const TEST_PHASES = [
  { id: 'groups_open', name: 'Grupos abiertos', description: 'Partidos de grupo pendientes para probar predicciones.' },
  { id: 'bracket_open', name: 'Llave abierta', description: 'Grupos terminados y cuadro listo para enviar llave/MVP.' },
  { id: 'final_open', name: 'Final abierta', description: 'Finalistas conocidos y apuesta de final disponible.' },
  { id: 'tournament_finished', name: 'Torneo terminado', description: 'Final terminada para validar puntuaciones finales.' },
];

const groupScores = [
  FT(2, 1), FT(0, 0), FT(1, 1), FT(2, 0), FT(0, 2), FT(1, 3),
  FT(1, 3), FT(2, 2), FT(0, 1), FT(1, 2), FT(2, 0), FT(3, 1),
  FT(0, 1), FT(1, 1), FT(3, 0), FT(0, 2), FT(2, 2), FT(1, 0),
  FT(2, 1), FT(1, 1), FT(3, 2), FT(0, 1), FT(1, 3), FT(2, 0),
];
const testMvpCandidates = [
  { id: 'test-mvp-1', name: 'Kylian Mbappé', team: 'Francia', code: 'FRA', goals: 5, source: 'test' },
  { id: 'test-mvp-2', name: 'Lionel Messi', team: 'Argentina', code: 'ARG', goals: 4, source: 'test' },
  { id: 'test-mvp-3', name: 'Harry Kane', team: 'Inglaterra', code: 'ENG', goals: 4, source: 'test' },
  { id: 'test-mvp-4', name: 'Lamine Yamal', team: 'España', code: 'ESP', goals: 3, source: 'test' },
  { id: 'test-mvp-5', name: 'Vinícius Júnior', team: 'Brasil', code: 'BRA', goals: 3, source: 'test' },
  { id: 'test-mvp-6', name: 'Cristiano Ronaldo', team: 'Portugal', code: 'POR', goals: 3, source: 'test' },
  { id: 'test-mvp-7', name: 'Jude Bellingham', team: 'Inglaterra', code: 'ENG', goals: 2, source: 'test' },
  { id: 'test-mvp-8', name: 'Jamal Musiala', team: 'Alemania', code: 'GER', goals: 2, source: 'test' },
  { id: 'test-mvp-9', name: 'Christian Pulisic', team: 'Estados Unidos', code: 'USA', goals: 2, source: 'test' },
  { id: 'test-mvp-10', name: 'Lautaro Martínez', team: 'Argentina', code: 'ARG', goals: 2, source: 'test' },
];

function meta(id, testNow, matches, extra = {}) {
  const phase = TEST_PHASES.find(x => x.id === id);
  return {
    source: `modo-prueba: ${phase.name}`,
    testMode: true,
    testPhase: id,
    testPhaseName: phase.name,
    testNow,
    fetchedAt: new Date().toISOString(),
    matches,
    ...extra,
  };
}

function finishedGroups() {
  let i = 0;
  return clone(SAMPLE.matches).map(m => {
    if (m.phase !== 'GROUP') return m;
    return { ...m, status: 'FINISHED', score: groupScores[i++] || FT(1, 0) };
  });
}

function ko(id, phase, home, away, score, winner, utcDate) {
  return { id, phase, group: null, matchday: null, utcDate, status: 'FINISHED', home, away, score, winner };
}

function knockoutThroughSemis() {
  const b = SAMPLE.bracketDemo;
  const r32Winners = ['MEX', 'NED', 'ARG', 'ESP', 'POR', 'ENG', 'USA', 'BEL', 'FRA', 'GER', 'COL', 'ITA', 'DEN', 'POL', 'NOR', 'CIV'];
  const teamByCode = {};
  Object.values(b).forEach(tie => [tie.a, tie.b].forEach(t => { teamByCode[t.code] = t; }));
  const matches = [];

  Object.entries(b)
    .sort(([a], [z]) => Number(a.split('-')[1]) - Number(z.split('-')[1]))
    .forEach(([nodeId, tie], i) => {
      const winner = r32Winners[i];
      matches.push(ko(`test-${nodeId}`, 'R32', tie.a, tie.b, FT(2, 1), winner, '2026-06-29T18:00:00Z'));
    });

  const r16 = [
    ['MEX', 'NED', 'MEX'], ['ARG', 'ESP', 'ARG'], ['POR', 'ENG', 'POR'], ['USA', 'BEL', 'USA'],
    ['FRA', 'GER', 'FRA'], ['COL', 'ITA', 'COL'], ['DEN', 'POL', 'DEN'], ['NOR', 'CIV', 'NOR'],
  ];
  r16.forEach(([h, a, w], i) => matches.push(ko(`test-r16-${i + 1}`, 'R16', teamByCode[h], teamByCode[a], FT(1, 0), w, '2026-07-05T18:00:00Z')));

  const qf = [['MEX', 'ARG', 'ARG'], ['POR', 'USA', 'POR'], ['FRA', 'COL', 'FRA'], ['DEN', 'NOR', 'DEN']];
  qf.forEach(([h, a, w], i) => matches.push(ko(`test-qf-${i + 1}`, 'QF', teamByCode[h], teamByCode[a], FT(2, 0), w, '2026-07-10T18:00:00Z')));

  const sf = [['ARG', 'POR', 'ARG'], ['FRA', 'DEN', 'FRA']];
  sf.forEach(([h, a, w], i) => matches.push(ko(`test-sf-${i + 1}`, 'SF', teamByCode[h], teamByCode[a], FT(2, 1), w, '2026-07-15T18:00:00Z')));

  return { matches, teamByCode };
}

export function buildTestPhase(id) {
  if (!TEST_PHASES.some(x => x.id === id)) throw new Error('Fase de prueba no válida.');

  if (id === 'groups_open') {
    return meta(id, '2026-06-13T16:00:00Z', clone(SAMPLE.matches));
  }

  const groupMatches = finishedGroups();
  if (id === 'bracket_open') {
    return meta(id, '2026-06-27T12:00:00Z', groupMatches, {
      bracketDemo: clone(SAMPLE.bracketDemo),
      mvpCandidates: clone(testMvpCandidates),
      mvpCandidatesLocked: true,
      mvpCandidatesAt: '2026-06-27T12:00:00Z',
      mvpCandidatesSource: 'test',
    });
  }

  const { matches: koMatches, teamByCode } = knockoutThroughSemis();
  const finalBase = {
    id: 'test-final',
    phase: 'FINAL',
    group: null,
    matchday: null,
    utcDate: '2026-07-19T18:00:00Z',
    home: teamByCode.ARG,
    away: teamByCode.FRA,
  };

  if (id === 'final_open') {
    return meta(id, '2026-07-18T12:00:00Z', [...groupMatches, ...koMatches, { ...finalBase, status: 'TIMED', score: null }], {
      bracketDemo: clone(SAMPLE.bracketDemo),
      mvpCandidates: clone(testMvpCandidates),
      mvpCandidatesLocked: true,
      mvpCandidatesAt: '2026-06-27T12:00:00Z',
      mvpCandidatesSource: 'test',
    });
  }

  return meta(id, '2026-07-20T12:00:00Z', [...groupMatches, ...koMatches, { ...finalBase, status: 'FINISHED', score: FT(1, 0), winner: 'ARG' }], {
    bracketDemo: clone(SAMPLE.bracketDemo),
    mvpCandidates: clone(testMvpCandidates),
    mvpCandidatesLocked: true,
    mvpCandidatesAt: '2026-06-27T12:00:00Z',
    mvpCandidatesSource: 'test',
  });
}
