// ============================================================================
//  Fixtures de validación para administradores.
//  No tocan predicciones: solo sustituyen temporalmente data/results.json.
// ============================================================================
import { SAMPLE } from './sample-data.mjs';

const FT = (home, away) => ({ home, away });
const clone = (x) => JSON.parse(JSON.stringify(x));

export const TEST_PHASES = [
  { id: 'groups_open', name: 'Grupos abiertos', description: 'Partidos de grupo pendientes para probar predicciones.' },
  { id: 'bracket_open', name: 'Llave abierta', description: 'Grupos terminados y cuadro listo para enviar llave/Bota de Oro.' },
  { id: 'r16_open', name: 'Octavos abiertos', description: '1/16 resueltos y octavos disponibles para validar ramas y recuperaciones.' },
  { id: 'qf_open', name: 'Cuartos abiertos', description: 'Octavos resueltos y cuartos disponibles para probar rachas v2.' },
  { id: 'sf_open', name: 'Semifinales abiertas', description: 'Cuartos resueltos y semifinales disponibles para validar top4 y ramas vivas.' },
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
  { id: 'test-mvp-11', name: 'Florian Wirtz', team: 'Alemania', code: 'GER', goals: 2, source: 'test' },
  { id: 'test-mvp-12', name: 'Rafael Leao', team: 'Portugal', code: 'POR', goals: 2, source: 'test' },
  { id: 'test-mvp-13', name: 'Julian Alvarez', team: 'Argentina', code: 'ARG', goals: 1, source: 'test' },
  { id: 'test-mvp-14', name: 'Bukayo Saka', team: 'Inglaterra', code: 'ENG', goals: 1, source: 'test' },
  { id: 'test-mvp-15', name: 'Raphinha', team: 'Brasil', code: 'BRA', goals: 1, source: 'test' },
  { id: 'test-mvp-16', name: 'Gavi', team: 'España', code: 'ESP', goals: 1, source: 'test' },
  { id: 'test-mvp-17', name: 'Federico Valverde', team: 'Uruguay', code: 'URU', goals: 1, source: 'test' },
  { id: 'test-mvp-18', name: 'Jonathan David', team: 'Canadá', code: 'CAN', goals: 1, source: 'test' },
  { id: 'test-mvp-19', name: 'Santiago Giménez', team: 'México', code: 'MEX', goals: 1, source: 'test' },
  { id: 'test-mvp-20', name: 'Takefusa Kubo', team: 'Japón', code: 'JPN', goals: 1, source: 'test' },
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

const r32Winners = ['MEX', 'NED', 'ARG', 'ESP', 'POR', 'ENG', 'USA', 'BEL', 'FRA', 'GER', 'COL', 'ITA', 'DEN', 'POL', 'NOR', 'CIV'];
const r16Ties = [
  ['MEX', 'NED', 'MEX'], ['ARG', 'ESP', 'ARG'], ['POR', 'ENG', 'POR'], ['USA', 'BEL', 'USA'],
  ['FRA', 'GER', 'FRA'], ['COL', 'ITA', 'COL'], ['DEN', 'POL', 'DEN'], ['NOR', 'CIV', 'NOR'],
];
const qfTies = [['MEX', 'ARG', 'ARG'], ['POR', 'USA', 'POR'], ['FRA', 'COL', 'FRA'], ['DEN', 'NOR', 'DEN']];
const sfTies = [['ARG', 'POR', 'ARG'], ['FRA', 'DEN', 'FRA']];

function ko(id, phase, home, away, score, winner, utcDate, status = 'FINISHED') {
  return { id, phase, group: null, matchday: null, utcDate, status, home, away, score, winner };
}

function teamIndex() {
  const b = SAMPLE.bracketDemo;
  const teamByCode = {};
  Object.values(b).forEach(tie => [tie.a, tie.b].forEach(t => { teamByCode[t.code] = t; }));
  return teamByCode;
}

function r32FinishedMatches() {
  const b = SAMPLE.bracketDemo;
  const matches = [];

  Object.entries(b)
    .sort(([a], [z]) => Number(a.split('-')[1]) - Number(z.split('-')[1]))
    .forEach(([nodeId, tie], i) => {
      const winner = r32Winners[i];
      matches.push(ko(`test-${nodeId}`, 'R32', tie.a, tie.b, FT(2, 1), winner, '2026-06-29T18:00:00Z'));
    });
  return matches;
}

function roundMatches(ties, phase, prefix, utcDate, status = 'FINISHED') {
  const teamByCode = teamIndex();
  return ties.map(([h, a, w], i) => ko(
    `test-${prefix}-${i + 1}`,
    phase,
    teamByCode[h],
    teamByCode[a],
    status === 'FINISHED' ? (phase === 'QF' ? FT(2, 0) : FT(1, 0)) : null,
    status === 'FINISHED' ? w : null,
    utcDate,
    status,
  ));
}

function knockoutForPhase(id) {
  const matches = [...r32FinishedMatches()];
  if (id === 'r16_open') return { matches: [...matches, ...roundMatches(r16Ties, 'R16', 'r16', '2026-07-05T18:00:00Z', 'TIMED')], teamByCode: teamIndex() };

  matches.push(...roundMatches(r16Ties, 'R16', 'r16', '2026-07-05T18:00:00Z'));
  if (id === 'qf_open') return { matches: [...matches, ...roundMatches(qfTies, 'QF', 'qf', '2026-07-10T18:00:00Z', 'TIMED')], teamByCode: teamIndex() };

  matches.push(...roundMatches(qfTies, 'QF', 'qf', '2026-07-10T18:00:00Z'));
  if (id === 'sf_open') return { matches: [...matches, ...roundMatches(sfTies, 'SF', 'sf', '2026-07-15T18:00:00Z', 'TIMED')], teamByCode: teamIndex() };

  matches.push(...roundMatches(sfTies, 'SF', 'sf', '2026-07-15T18:00:00Z').map(m => ({ ...m, score: FT(2, 1) })));
  return { matches, teamByCode: teamIndex() };
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

  if (id === 'r16_open' || id === 'qf_open' || id === 'sf_open') {
    const nowByPhase = {
      r16_open: '2026-07-04T12:00:00Z',
      qf_open: '2026-07-09T12:00:00Z',
      sf_open: '2026-07-14T12:00:00Z',
    };
    const { matches: koMatches } = knockoutForPhase(id);
    return meta(id, nowByPhase[id], [...groupMatches, ...koMatches], {
      bracketDemo: clone(SAMPLE.bracketDemo),
      mvpCandidates: clone(testMvpCandidates),
      mvpCandidatesLocked: true,
      mvpCandidatesAt: '2026-06-27T12:00:00Z',
      mvpCandidatesSource: 'test',
    });
  }

  const { matches: koMatches, teamByCode } = knockoutForPhase(id);
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
    mvpActual: 'test-mvp-1',
  });
}
