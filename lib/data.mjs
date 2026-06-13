// ============================================================================
//  Datos de partidos: fuente (API/ejemplo), reloj, clasificación de grupos,
//  ventanas de fase y resolución de equipos de la llave.
// ============================================================================
import { CONFIG, BRACKET } from '../config.mjs';
import { SAMPLE } from '../sample/sample-data.mjs';
import { readResults, writeResults } from './store.mjs';

const KO_PHASES = ['R32', 'R16', 'QF', 'SF', 'FINAL'];

export function now() {
  return CONFIG.simulatedNow ? new Date(CONFIG.simulatedNow) : new Date();
}

export function getData() {
  const live = readResults();
  return (live && Array.isArray(live.matches) && live.matches.length) ? live : SAMPLE;
}

export const isFinished = (m) => m.status === 'FINISHED' && m.score && m.score.home != null && m.score.away != null;
export const isLive = (m) => m.status === 'IN_PLAY' || m.status === 'PAUSED';
export const teamsKnown = (m) => !!(m.home && m.away && !m.home.tbd && !m.away.tbd);

export function groupMatches() {
  return getData().matches.filter(m => m.phase === 'GROUP');
}
export function knockoutMatches() {
  return getData().matches.filter(m => KO_PHASES.includes(m.phase));
}

// Estado de un partido de grupos para la interfaz.
export function matchState(m) {
  if (isFinished(m)) return 'finished';
  if (isLive(m)) return 'live';
  if (now() >= new Date(m.utcDate)) return 'started';
  return 'open';
}

// Clasificación por grupos a partir de los partidos terminados.
export function computeStandings() {
  const groups = {};
  groupMatches().forEach(m => {
    const g = m.group || '?';
    groups[g] = groups[g] || {};
    const ensure = (t) => (groups[g][t.code] = groups[g][t.code] || { team: t, pts: 0, gf: 0, ga: 0, pj: 0 });
    if (!teamsKnown(m)) return;
    const H = ensure(m.home), A = ensure(m.away);
    if (isFinished(m)) {
      H.pj++; A.pj++;
      H.gf += m.score.home; H.ga += m.score.away;
      A.gf += m.score.away; A.ga += m.score.home;
      if (m.score.home > m.score.away) H.pts += 3;
      else if (m.score.home < m.score.away) A.pts += 3;
      else { H.pts++; A.pts++; }
    }
  });
  const out = {};
  Object.keys(groups).sort().forEach(g => {
    out[g] = Object.values(groups[g]).sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
  });
  return out;
}

export function groupPhaseFinished() {
  const gm = groupMatches();
  return gm.length > 0 && gm.every(isFinished);
}

// Partidos de grupos que aún se pueden predecir (no han empezado).
export function upcomingGroupMatches() {
  return groupMatches()
    .filter(m => teamsKnown(m) && !isFinished(m) && now() < new Date(m.utcDate))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

// ¿Está abierta la entrega de la llave? (tras los grupos, antes del 1.er cruce)
export function bracketWindow() {
  const firstKo = BRACKET.r32.reduce((min, x) => (x.date < min ? x.date : min), '9999');
  const deadline = new Date(firstKo + 'T00:00:00Z');
  const passedDeadline = now() >= deadline;
  const open = CONFIG.demo.forceOpenBracket || (groupPhaseFinished() && !passedDeadline);
  return { open, groupsFinished: groupPhaseFinished(), passedDeadline, deadline: deadline.toISOString() };
}

// Resuelve los equipos reales de cada cruce de 1/16.
// Devuelve { nodeId: { a:{name,code}|{label}, b:{...} } }.
export function resolveR32Teams() {
  const data = getData();
  if (data.bracketDemo) return data.bracketDemo; // demo: equipos de ejemplo

  const st = computeStandings();
  const resolveSeed = (label) => {
    const mPos = /^([12])([A-L])$/.exec(label); // p.ej. 1E, 2A
    if (mPos) {
      const pos = mPos[1] === '1' ? 0 : 1;
      const t = st[mPos[2]] && st[mPos[2]][pos];
      return t ? t.team : { label };
    }
    return { label }; // terceros u otros: se muestran como etiqueta hasta conocerse
  };
  const out = {};
  BRACKET.r32.forEach(n => { out[n.id] = { a: resolveSeed(n.a), b: resolveSeed(n.b) }; });
  return out;
}

// Equipos que REALMENTE alcanzaron cada ronda (según resultados).
// reachedR16 = equipos que aparecen en cruces de octavos, etc.
export function actualReached() {
  const ko = knockoutMatches();
  const codesIn = (phase) => {
    const set = new Set();
    ko.filter(m => m.phase === phase).forEach(m => {
      if (m.home && m.home.code && !m.home.tbd) set.add(m.home.code);
      if (m.away && m.away.code && !m.away.tbd) set.add(m.away.code);
    });
    return [...set];
  };
  const finalMatch = ko.find(m => m.phase === 'FINAL');
  let champ = [];
  if (finalMatch && isFinished(finalMatch)) {
    champ = [finalMatch.score.home > finalMatch.score.away ? finalMatch.home.code : finalMatch.away.code];
  }
  return {
    R16: codesIn('R16'), QF: codesIn('QF'), SF: codesIn('SF'), FINAL: codesIn('FINAL'), CHAMP: champ,
  };
}

// --- Descarga desde football-data.org --------------------------------------
const STAGE_MAP = {
  GROUP_STAGE: 'GROUP', LAST_32: 'R32', LAST_16: 'R16',
  QUARTER_FINALS: 'QF', QUARTER_FINAL: 'QF',
  SEMI_FINALS: 'SF', SEMI_FINAL: 'SF', THIRD_PLACE: '3RD', FINAL: 'FINAL',
};
function mapMatch(m) {
  const homeKnown = !!(m.homeTeam && m.homeTeam.id);
  const awayKnown = !!(m.awayTeam && m.awayTeam.id);
  const ft = (m.score && m.score.fullTime) || {};
  const finished = m.status === 'FINISHED' && ft.home != null && ft.away != null;
  const live = m.status === 'IN_PLAY' || m.status === 'PAUSED';
  let score = null;
  if (finished) score = { home: ft.home, away: ft.away };
  else if (live) score = { home: ft.home ?? 0, away: ft.away ?? 0 };
  return {
    id: 'fd-' + m.id,
    phase: STAGE_MAP[m.stage] || m.stage || 'GROUP',
    group: m.group ? String(m.group).replace(/^GROUP_?/i, '') : null,
    matchday: m.matchday || null,
    utcDate: m.utcDate,
    status: m.status,
    home: homeKnown ? { name: m.homeTeam.name, code: m.homeTeam.tla || '' } : { name: 'Por definir', code: 'TBD', tbd: true },
    away: awayKnown ? { name: m.awayTeam.name, code: m.awayTeam.tla || '' } : { name: 'Por definir', code: 'TBD', tbd: true },
    score,
  };
}

export async function fetchFromAPI() {
  const token = CONFIG.api.token;
  if (!token) throw new Error('No hay token de football-data.org (FOOTBALL_DATA_TOKEN).');
  const url = `${CONFIG.api.baseUrl}/competitions/${CONFIG.api.competition}/matches`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    throw new Error('403 acceso restringido. ' + (body?.message || 'Revisa el token o el plan para WC.'));
  }
  if (!res.ok) throw new Error(`Error ${res.status} de la API.`);
  const data = await res.json();
  const matches = (data.matches || []).map(mapMatch);
  if (!matches.length) throw new Error('La API no devolvió partidos.');
  const payload = { source: 'football-data.org', fetchedAt: new Date().toISOString(), matches };
  writeResults(payload);
  return { count: matches.length, finished: matches.filter(m => m.status === 'FINISHED').length };
}
