// ============================================================================
//  Datos de partidos: fuente (API/ejemplo), reloj, clasificación de grupos,
//  ventanas de fase y resolución de equipos de la llave.
// ============================================================================
import { CONFIG, BRACKET } from '../config.mjs';
import { SAMPLE } from '../sample/sample-data.mjs';
import { readResults, writeResults } from './store.mjs';
import { countryNameEs, localizeTeam } from './countries-es.mjs';

const KO_PHASES = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
// football-data entrega los 1/16 por calendario, pero el arbol oficial se
// empareja por posicion de cuadro. Mantener este orden evita mezclar ramas.
const API_R32_TREE_ORDER = [
  'fd-537417', 'fd-537415', 'fd-537418', 'fd-537416',
  'fd-537422', 'fd-537421', 'fd-537420', 'fd-537419',
  'fd-537423', 'fd-537424', 'fd-537425', 'fd-537426',
  'fd-537429', 'fd-537430', 'fd-537428', 'fd-537427',
];

export function now() {
  const live = readResults();
  if (live?.testMode && live.testNow) return new Date(live.testNow);
  return CONFIG.simulatedNow ? new Date(CONFIG.simulatedNow) : new Date();
}

export function getData() {
  const live = readResults();
  return localizeData((live && Array.isArray(live.matches) && live.matches.length) ? live : SAMPLE);
}
export function mvpCandidates() {
  const data = getData();
  const list = Array.isArray(data.mvpCandidates) && data.mvpCandidates.length
    ? data.mvpCandidates
    : CONFIG.mvp.candidates.map(p => ({ ...p, source: 'config' }));
  return list.slice(0, 20).map(localizePlayerTeam);
}
export function actualMvp() {
  return getData().mvpActual || CONFIG.mvp.actual || null;
}

export const isFinished = (m) => !!(m && m.status === 'FINISHED' && m.score && m.score.home != null && m.score.away != null);
export const isLive = (m) => !!(m && (m.status === 'IN_PLAY' || m.status === 'PAUSED'));
export const teamsKnown = (m) => !!(m && m.home && m.away && !m.home.tbd && !m.away.tbd);

function localizePlayerTeam(player) {
  return player?.code ? { ...player, team: countryNameEs(player.code, player.team) } : player;
}

function localizeData(data) {
  const out = {
    ...data,
    matches: (data.matches || []).map(m => ({
      ...m,
      home: localizeTeam(m.home),
      away: localizeTeam(m.away),
    })),
  };
  if (data.bracketDemo) {
    out.bracketDemo = Object.fromEntries(Object.entries(data.bracketDemo).map(([id, tie]) => [
      id,
      { ...tie, a: localizeTeam(tie.a), b: localizeTeam(tie.b) },
    ]));
  }
  if (Array.isArray(data.mvpCandidates)) {
    out.mvpCandidates = data.mvpCandidates.map(localizePlayerTeam);
  }
  return out;
}

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
function groupPhaseFinishedIn(matches) {
  const gm = matches.filter(m => m.phase === 'GROUP');
  return gm.length > 0 && gm.every(isFinished);
}

function finishedGroupSet() {
  const groups = {};
  groupMatches().forEach(m => {
    const g = m.group || '?';
    groups[g] = groups[g] || [];
    groups[g].push(m);
  });
  return new Set(Object.entries(groups)
    .filter(([, ms]) => ms.length > 0 && ms.every(isFinished))
    .map(([g]) => g));
}

export function bracketPreviewAvailable() {
  const data = getData();
  if (data.bracketDemo) return true;
  if (knockoutMatches().some(teamsKnown)) return true;
  return finishedGroupSet().size > 0;
}

function thirdPlaceCandidates(standings = computeStandings()) {
  return Object.entries(standings)
    .map(([group, rows]) => ({ group, row: rows?.[2] || null }))
    .filter(x => x.row?.team?.code)
    .sort((a, b) =>
      b.row.pts - a.row.pts ||
      ((b.row.gf - b.row.ga) - (a.row.gf - a.row.ga)) ||
      b.row.gf - a.row.gf ||
      a.row.team.name.localeCompare(b.row.team.name));
}

function thirdSlotGroups(label) {
  const m = /^3\.\s*º?\s*([A-L]+)$/i.exec(String(label || '').replace(/\s+/g, ' ').trim());
  return m ? m[1].toUpperCase().split('') : null;
}

function assignThirdPlaceSlots(slotLabels, standings = computeStandings()) {
  const bestThirds = thirdPlaceCandidates(standings).slice(0, 8);
  if (bestThirds.length < 8) return {};
  const thirdByGroup = Object.fromEntries(bestThirds.map(x => [x.group, x.row.team]));
  const slots = slotLabels.map((label, index) => ({ index, label, groups: thirdSlotGroups(label) || [] }));
  const order = slots.slice().sort((a, b) => a.groups.length - b.groups.length);
  const assigned = {};
  const used = new Set();
  const solve = (i) => {
    if (i >= order.length) return true;
    const slot = order[i];
    for (const group of slot.groups) {
      if (used.has(group) || !thirdByGroup[group]) continue;
      used.add(group);
      assigned[slot.index] = thirdByGroup[group];
      if (solve(i + 1)) return true;
      used.delete(group);
      delete assigned[slot.index];
    }
    return false;
  };
  return solve(0) ? assigned : {};
}

export function bracketComplete() {
  const slots = Object.values(resolveR32Teams()).flatMap(tie => [tie.a, tie.b]);
  return slots.length > 0 && slots.every(t => t?.code);
}

// Partidos de grupos que aún se pueden predecir (no han empezado).
export function upcomingGroupMatches() {
  return groupMatches()
    .filter(m => teamsKnown(m) && !isFinished(m) && now() < new Date(m.utcDate))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

// ¿Está abierta la entrega de la llave? (tras los grupos, antes del 1.er cruce)
export function bracketWindow() {
  const firstApiKo = knockoutMatches()
    .filter(m => m.utcDate)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0];
  const firstKo = BRACKET.r32.reduce((min, x) => (x.date < min ? x.date : min), '9999');
  const deadline = firstApiKo ? new Date(firstApiKo.utcDate) : new Date(firstKo + 'T23:59:59Z');
  const complete = groupPhaseFinished() && bracketComplete();
  const passedDeadline = complete && now() >= deadline;
  const open = complete && !passedDeadline;
  return { open, groupsFinished: groupPhaseFinished(), bracketComplete: complete, passedDeadline, deadline: deadline.toISOString() };
}

// Resuelve los equipos reales de cada cruce de 1/16.
// Devuelve { nodeId: { a:{name,code}|{label}, b:{...} } }.
export function resolveR32Teams() {
  const data = getData();
  if (data.bracketDemo) return data.bracketDemo; // demo: equipos de ejemplo

  const apiR32 = knockoutMatches()
    .filter(m => m.phase === 'R32' && teamsKnown(m))
    .slice()
    .sort((a, b) => {
      const ia = API_R32_TREE_ORDER.indexOf(a.id);
      const ib = API_R32_TREE_ORDER.indexOf(b.id);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return new Date(a.utcDate) - new Date(b.utcDate) || String(a.id).localeCompare(String(b.id));
    });
  if (apiR32.length >= BRACKET.r32.length) {
    const out = {};
    BRACKET.r32.forEach((n, i) => {
      out[n.id] = { a: apiR32[i].home, b: apiR32[i].away };
    });
    return out;
  }

  const st = computeStandings();
  const finishedGroups = finishedGroupSet();
  const thirdLabels = BRACKET.r32.flatMap(n => [n.a, n.b]).filter(thirdSlotGroups);
  const thirdAssignments = groupPhaseFinished() ? assignThirdPlaceSlots(thirdLabels, st) : {};
  let thirdIndex = 0;
  const resolveSeed = (label) => {
    const mPos = /^([12])([A-L])$/.exec(label); // p.ej. 1E, 2A
    if (mPos) {
      if (!finishedGroups.has(mPos[2])) return { label };
      const pos = mPos[1] === '1' ? 0 : 1;
      const t = st[mPos[2]] && st[mPos[2]][pos];
      return t ? t.team : { label };
    }
    if (thirdSlotGroups(label)) {
      const team = thirdAssignments[thirdIndex++];
      return team || { label };
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
  const c = finalMatch ? winnerCode(finalMatch) : null;
  return {
    R16: codesIn('R16'), QF: codesIn('QF'), SF: codesIn('SF'), FINAL: codesIn('FINAL'), CHAMP: c ? [c] : [],
  };
}

// Ganador real de un partido (prórroga/penaltis incluidos si la API lo indica).
export function winnerCode(m) {
  if (!m || !isFinished(m)) return null;
  if (m.winner) return m.winner;
  if (m.score.home > m.score.away) return m.home.code;
  if (m.score.away > m.score.home) return m.away.code;
  return null; // empate sin ganador conocido
}

// Equipos de la final (cuando la fase ya está disponible).
export function finalTeams() {
  const data = getData();
  const fm = data.matches.find(m => m.phase === 'FINAL');
  if (fm && teamsKnown(fm)) return { home: fm.home, away: fm.away, utcDate: fm.utcDate };
  return null;
}

// ¿Está abierta la apuesta de la final?
export function finalWindow() {
  const ft = finalTeams();
  if (!ft) return { open: false, teamsKnown: false, teams: null };
  const kickoff = new Date(ft.utcDate);
  const passed = now() >= kickoff;
  const open = !passed;
  return { open, teamsKnown: true, passed, deadline: kickoff.toISOString(), teams: ft };
}

// Resultado real de la final (para puntuar), o null si no ha terminado.
export function actualFinal() {
  const fm = getData().matches.find(m => m.phase === 'FINAL');
  if (!fm || !isFinished(fm)) return null;
  return { score: fm.score, winner: winnerCode(fm), home: fm.home, away: fm.away, utcDate: fm.utcDate };
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
  const home = homeKnown ? { name: m.homeTeam.name, code: m.homeTeam.tla || '', crest: m.homeTeam.crest || null } : { name: 'Por definir', code: 'TBD', tbd: true };
  const away = awayKnown ? { name: m.awayTeam.name, code: m.awayTeam.tla || '', crest: m.awayTeam.crest || null } : { name: 'Por definir', code: 'TBD', tbd: true };
  const ft = (m.score && m.score.fullTime) || {};
  const finished = m.status === 'FINISHED' && ft.home != null && ft.away != null;
  const live = m.status === 'IN_PLAY' || m.status === 'PAUSED';
  let score = null;
  if (finished) score = { home: ft.home, away: ft.away };
  else if (live) score = { home: ft.home ?? 0, away: ft.away ?? 0 };
  // Ganador real (incluye prórroga/penaltis) según el campo winner de la API.
  let winner = null;
  const w = m.score && m.score.winner;
  if (w === 'HOME_TEAM') winner = home.code;
  else if (w === 'AWAY_TEAM') winner = away.code;
  return {
    id: 'fd-' + m.id,
    phase: STAGE_MAP[m.stage] || m.stage || 'GROUP',
    group: m.group ? String(m.group).replace(/^GROUP_?/i, '') : null,
    matchday: m.matchday || null,
    utcDate: m.utcDate,
    status: m.status,
    home, away, score, winner,
  };
}

function scorerTeam(s) {
  return s.team || s.teamOfPlayer || s.player?.currentTeam || {};
}
function normalizeScorer(s, i) {
  const player = s.player || s.scorer || {};
  const team = scorerTeam(s);
  const code = team.tla || team.code || '';
  return {
    id: player.id ? `fd-${player.id}` : `scorer-${i + 1}`,
    name: player.name || s.name || `Goleador ${i + 1}`,
    team: team.name || '',
    code,
    goals: Number(s.goals || 0),
    source: 'api-scorers',
  };
}
async function fetchMvpCandidatesFromAPI(token) {
  const url = `${CONFIG.api.baseUrl}/competitions/${CONFIG.api.competition}/scorers?limit=20`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': token } });
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    throw new Error('403 acceso restringido al ranking de goleadores. ' + (body?.message || 'Revisa el token o el plan para WC.'));
  }
  if (!res.ok) throw new Error(`Error ${res.status} de la API de goleadores.`);
  const data = await res.json();
  return (data.scorers || []).map(normalizeScorer).filter(p => p.name).slice(0, 20);
}

export function protectFinishedMatches(previous, incoming) {
  const fresh = Array.isArray(incoming) ? incoming : [];
  if (previous?.testMode || !Array.isArray(previous?.matches)) return fresh;

  const byId = new Map(fresh.map(m => [m.id, m]));
  previous.matches.forEach(prev => {
    if (!isFinished(prev)) return;
    const next = byId.get(prev.id);
    if (!next || !isFinished(next)) byId.set(prev.id, prev);
  });

  const originalOrder = new Map(previous.matches.map((m, i) => [m.id, i]));
  return [...byId.values()].sort((a, b) => {
    const da = new Date(a.utcDate).getTime();
    const db = new Date(b.utcDate).getTime();
    if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return da - db;
    return (originalOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (originalOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
  });
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
  const previous = readResults();
  const stableMatches = protectFinishedMatches(previous, matches);
  const payload = { source: 'football-data.org', fetchedAt: new Date().toISOString(), matches: stableMatches };
  if (!previous?.testMode && previous?.mvpCandidatesLocked && Array.isArray(previous.mvpCandidates) && previous.mvpCandidates.length) {
    payload.mvpCandidates = previous.mvpCandidates;
    payload.mvpCandidatesLocked = true;
    payload.mvpCandidatesAt = previous.mvpCandidatesAt || previous.fetchedAt || null;
    payload.mvpCandidatesSource = previous.mvpCandidatesSource || 'api-scorers';
  } else if (groupPhaseFinishedIn(stableMatches)) {
    const candidates = await fetchMvpCandidatesFromAPI(token);
    if (candidates.length) {
      payload.mvpCandidates = candidates;
      payload.mvpCandidatesLocked = true;
      payload.mvpCandidatesAt = payload.fetchedAt;
      payload.mvpCandidatesSource = 'api-scorers';
    }
  }
  writeResults(payload);
  return {
    count: stableMatches.length,
    finished: stableMatches.filter(isFinished).length,
    mvpCandidates: payload.mvpCandidates?.length || 0,
  };
}
