// ============================================================================
//  Quiniela Mundial 2026 — Servidor (Node sin dependencias)
//  Arranque:  node server.mjs
// ============================================================================
import { createServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

import { CONFIG } from './config.mjs';
import { db, saveDB, writeResults, clearResults } from './lib/store.mjs';
import * as Auth from './lib/auth.mjs';
import * as Data from './lib/data.mjs';
import * as Score from './lib/scoring.mjs';
import { buildTree, candidatesFor, validateBracket } from './lib/bracket.mjs';
import { flagUrl, flagUrlFromCode } from './lib/flags.mjs';
import { TEST_PHASES, buildTestPhase } from './sample/test-phases.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const RESULTS_IDLE_REFRESH_MS = 5 * 60 * 1000;
const RESULTS_LIVE_REFRESH_MS = 60 * 1000;
const RESULTS_LIVE_LEAD_MS = 10 * 60 * 1000;
const RESULTS_LIVE_TAIL_MS = 3 * 60 * 60 * 1000;

Auth.ensureAdmin(CONFIG.admin);

// ----------------------------------------------------------- utilidades ----
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};
const MOUNTED_STATIC_PREFIXES = ['api', 'css', 'js', 'img'];
const NO_CACHE_EXT = new Set(['.html', '.js', '.css']);
function sendJSON(res, status, obj, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0;
    req.on('data', c => { size += c.length; if (size > 1e6) { reject(new Error('Body demasiado grande')); req.destroy(); } data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}
function currentUser(req) {
  const token = Auth.parseCookies(req)[Auth.SESSION_COOKIE];
  return { token, user: Auth.userFromToken(token) };
}
function stripMountedPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 1 && MOUNTED_STATIC_PREFIXES.includes(parts[1])) {
    return '/' + parts.slice(1).join('/');
  }
  return pathname;
}
function mountedBase(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 1 && !parts[0].includes('.')) return '/' + parts[0];
  if (parts.length > 1 && MOUNTED_STATIC_PREFIXES.includes(parts[1])) return '/' + parts[0];
  return '';
}
function publicLoginError(e) {
  const msg = e?.message || '';
  if (/EPERM|EACCES|db\.json|\.tmp/i.test(msg)) {
    return 'No se pudo iniciar sesión porque el servidor no pudo guardar la sesión. Revisa permisos de la carpeta data o reinicia el servidor.';
  }
  return msg || 'No se pudo iniciar sesión.';
}
async function refreshResultsFromAPI(source = 'manual') {
  const r = await Data.fetchFromAPI();
  const mvpInfo = r.mvpCandidates ? ` · Bota de Oro ${r.mvpCandidates} candidatos` : '';
  console.log(`[resultados:${source}] ${r.count} partidos (${r.finished} finalizados)${mvpInfo}.`);
  return r;
}
function hasActiveMatchRefreshWindow() {
  const current = Data.now().getTime();
  return Data.getData().matches.some(m => {
    if (!m || Data.isFinished(m)) return false;
    if (Data.isLive(m)) return true;
    const kickoff = new Date(m.utcDate).getTime();
    if (!Number.isFinite(kickoff)) return false;
    return current >= kickoff - RESULTS_LIVE_LEAD_MS && current <= kickoff + RESULTS_LIVE_TAIL_MS;
  });
}
function startResultsRefreshTimer() {
  if (!CONFIG.api.token) return;
  const run = async (source) => {
    if (Data.getData().testMode) {
      console.log(`[resultados:${source}] omitido: modo prueba activo.`);
      return;
    }
    try { await refreshResultsFromAPI(source); }
    catch (e) { console.warn(`[resultados:${source}] ${e.message}`); }
  };
  const schedule = () => {
    const liveWindow = hasActiveMatchRefreshWindow();
    const delay = liveWindow ? RESULTS_LIVE_REFRESH_MS : RESULTS_IDLE_REFRESH_MS;
    setTimeout(async () => {
      await run(liveWindow ? 'auto-live' : 'auto');
      schedule();
    }, delay).unref?.();
  };
  run('inicio').finally(schedule);
}

// --------------------------------------------------------- estado/API ------
const wf = (t) => t ? { ...t, flag: flagUrl(t) } : t; // añade la bandera al equipo
function enrichStandings(st) {
  const out = {};
  for (const g of Object.keys(st)) out[g] = st[g].map(r => ({ ...r, team: wf(r.team) }));
  return out;
}

function sortGroupMatch(a, b) {
  return (a.group || '').localeCompare(b.group || '')
    || (a.matchday || 0) - (b.matchday || 0)
    || new Date(a.utcDate) - new Date(b.utcDate);
}

function publicMatch(m, picks, submitted) {
  const out = {
    id: m.id, group: m.group, matchday: m.matchday, utcDate: m.utcDate,
    status: m.status, state: Data.matchState(m),
    home: wf(m.home), away: wf(m.away), score: m.score || null,
  };
  if (submitted && picks[m.id]) out.yourPred = picks[m.id];
  if (submitted && Data.isFinished(m)) out.points = Score.groupPointsFor(picks[m.id], m);
  return out;
}
function publicUserGroupMatch(m, picks) {
  const out = {
    id: m.id, group: m.group, matchday: m.matchday, utcDate: m.utcDate,
    status: m.status, state: Data.matchState(m),
    home: wf(m.home), away: wf(m.away), score: m.score || null,
    points: Score.groupPointsFor(picks[m.id], m),
  };
  if (picks[m.id]) out.yourPred = picks[m.id];
  return out;
}
const ROUND_LABELS = {
  R32: '1/16',
  R16: '8vos',
  QF: '4tos',
  SF: 'Semifinales',
  FINAL: 'Final',
};
const ADVANCED_TO = {
  R32: 'R16',
  R16: 'QF',
  QF: 'SF',
  SF: 'FINAL',
  FINAL: 'CHAMP',
};
function teamFromCode(code) {
  if (!code) return null;
  const all = Data.getData().matches.flatMap(m => [m.home, m.away]).filter(Boolean);
  return all.find(t => t.code === code && !t.tbd) || { code, name: code };
}
function selectedTeamForNode(nodeId, code, cand) {
  const c = cand[nodeId];
  if (c?.a?.code === code) return c.a;
  if (c?.b?.code === code) return c.b;
  return teamFromCode(code);
}
function buildUserBracketDetail(username, totals) {
  const ev = Score.evaluateBracket(username);
  const toTeam = (code) => code ? wf(teamFromCode(code)) : null;
  const nodes = ev.nodes.map(n => ({
    ...n,
    originalPickTeam: toTeam(n.originalPick),
    recoveryPickTeam: toTeam(n.recoveryPick),
    activePickTeam: toTeam(n.activePick),
    actualWinnerTeam: toTeam(n.actualWinner),
    recoveryOptions: (n.recoveryOptions || []).map(wf),
    match: n.match ? { ...n.match, home: wf(n.match.home), away: wf(n.match.away) } : null,
  }));
  return {
    submitted: ev.submitted,
    submittedAt: ev.submittedAt,
    points: ev.points,
    correct: ev.correct,
    top4: totals.top4 || 0,
    finalists: totals.finalists || 0,
    hasResult: ev.hasResult,
    originalLive: ev.originalLive,
    recoveredLive: ev.recoveredLive,
    broken: ev.broken,
    closed: ev.closed,
    bestActive: ev.bestActive,
    actionRequired: ev.actionRequired,
    recoveryPending: ev.recoveryPending,
    branches: ev.branches.map(b => ({ ...b, team: wf(b.team) })),
    nodes,
    picks: nodes,
    correctPicks: nodes.filter(p => p.hit),
  };
}
function playerById(playerId) {
  if (!playerId) return null;
  const p = Data.mvpCandidates().find(x => x.id === playerId);
  return p ? { ...p, flag: flagUrlFromCode(p.code) } : { id: playerId, name: playerId };
}
function buildUserGoldenBootDetail(username, totals) {
  const pred = db.predictions[username]?.mvp || {};
  const actual = Data.actualMvp();
  return {
    submitted: !!pred.submitted,
    submittedAt: pred.at || null,
    points: totals.points || 0,
    picked: playerById(pred.playerId || null),
    actual: playerById(actual),
    hasResult: !!actual,
    hit: !!totals.hit,
  };
}
function teamNameForFinal(code, af, predTeams) {
  if (!code) return null;
  const teams = [af?.home, af?.away, predTeams?.home, predTeams?.away].filter(Boolean);
  const team = teams.find(t => t.code === code) || teamFromCode(code);
  return wf(team);
}
function buildUserFinalDetail(username, totals) {
  const pred = db.predictions[username]?.final || null;
  const af = Data.actualFinal();
  const fw = Data.finalWindow();
  const teams = fw.teams || (af ? { home: af.home, away: af.away } : null);
  return {
    submitted: !!pred?.submitted,
    submittedAt: pred?.at || null,
    points: totals.points || 0,
    predicted: !!totals.predicted,
    hasResult: !!totals.hasResult,
    exactHit: !!totals.exactHit,
    champHit: !!totals.champHit,
    score: pred?.score || null,
    champion: teamNameForFinal(pred?.champion || null, af, teams),
    teams: teams ? { home: wf(teams.home), away: wf(teams.away) } : null,
    actual: af ? { score: af.score, winner: teamNameForFinal(af.winner, af, teams), home: wf(af.home), away: wf(af.away) } : null,
  };
}
function lockedBracketDetail(username, unlockAt) {
  const pred = db.predictions[username]?.bracket || {};
  return {
    locked: true,
    unlockAt,
    submitted: !!pred.submitted,
    submittedAt: pred.at || null,
  };
}
function lockedGoldenBootDetail(username, unlockAt) {
  const pred = db.predictions[username]?.mvp || {};
  return {
    locked: true,
    unlockAt,
    submitted: !!pred.submitted,
    submittedAt: pred.at || null,
  };
}
function buildUserGroupPredictions(username) {
  const target = db.users[username];
  if (!target) return null;
  const groupPred = db.predictions[username]?.group || {};
  const picks = groupPred.picks || {};
  const groupSummary = Score.userGroupTotals(username);
  const bracketSummary = Score.userBracketTotals(username);
  const finalSummary = Score.userFinalTotals(username);
  const mvpSummary = Score.userMvpTotals(username);
  const rankRow = Score.ranking().find(r => r.username === username);
  const win = Data.bracketWindow();
  const showLockedPredictions = !!win.passedDeadline;
  const matches = Data.groupMatches()
    .filter(Data.isFinished)
    .slice()
    .sort(sortGroupMatch)
    .map(m => publicUserGroupMatch(m, picks));
  return {
    user: { username: target.username, name: target.name, isAdmin: !!target.isAdmin },
    group: { submitted: !!groupPred.submitted, submittedAt: groupPred.at || null },
    summary: groupSummary,
    totals: {
      rank: rankRow ? rankRow.rank : null,
      total: groupSummary.combined + bracketSummary.points + finalSummary.points + mvpSummary.points,
      group: groupSummary,
      bracket: bracketSummary,
      final: finalSummary,
      mvp: mvpSummary,
    },
    bracketDetail: showLockedPredictions ? buildUserBracketDetail(username, bracketSummary) : lockedBracketDetail(username, win.deadline),
    goldenBootDetail: showLockedPredictions ? buildUserGoldenBootDetail(username, mvpSummary) : lockedGoldenBootDetail(username, win.deadline),
    finalDetail: buildUserFinalDetail(username, finalSummary),
    matches,
  };
}
function prizeInfo() {
  const players = Object.values(db.users).filter(u => !u.isAdmin).length;
  const perPlayer = 5;
  const pot = players * perPlayer;
  const second = Math.ceil(pot / 4);
  const first = pot - second;
  const fw = Data.finalWindow();
  const closeAt = fw.deadline ? new Date(fw.deadline) : new Date('2026-07-19T18:00:00Z');
  closeAt.setUTCDate(closeAt.getUTCDate() + 1);
  return {
    players,
    perPlayer,
    pot,
    first,
    second,
    closeAt: closeAt.toISOString(),
  };
}

function bettingDeadlineText(win) {
  if (!win?.deadline) return 'hasta el inicio del primer partido de 1/16';
  const deadline = new Date(win.deadline);
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Data.now());
  const deadlineKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(deadline);
  const time = deadline.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  if (todayKey === deadlineKey) {
    const weekday = deadline.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'Europe/Madrid' });
    return `hasta hoy ${weekday} a las ${time}`;
  }
  const day = deadline.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
  return `hasta el ${day} a las ${time}`;
}

function madridShortDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

function bracketParentMap(tree) {
  const out = {};
  [...tree.r16, ...tree.qf, ...tree.sf, tree.final].forEach(n => {
    out[n.childA] = n.id;
    out[n.childB] = n.id;
  });
  return out;
}

function bracketNodesInOrder(tree) {
  return [...tree.r32, ...tree.r16, ...tree.qf, ...tree.sf, tree.final];
}

function roundRank(round) {
  return { R32: 0, R16: 1, QF: 2, SF: 3, FINAL: 4 }[round] ?? 0;
}

function bracketPathToFinal(tree, nodeId) {
  const parents = bracketParentMap(tree);
  const path = [];
  let id = nodeId;
  while (id) {
    path.push(id);
    id = parents[id];
  }
  return path;
}

function recoveryEditNodeIds(tree, detail, fromNodeId) {
  const byNode = Object.fromEntries((detail?.nodes || []).map(n => [n.nodeId, n]));
  const from = byNode[fromNodeId];
  const startRank = roundRank(from?.round);
  const ids = bracketNodesInOrder(tree)
    .filter(n => {
      const nd = byNode[n.id];
      if (!nd || nd.resolved) return false;
      return roundRank(n.round) >= startRank;
    })
    .map(n => n.id);
  return ids.length ? ids : bracketPathToFinal(tree, fromNodeId);
}

function currentBracketPicks(pred) {
  const out = { ...(pred?.bracket?.picks || {}) };
  Object.entries(pred?.bracket?.recoveries || {}).forEach(([nodeId, r]) => {
    const pick = typeof r === 'string' ? r : r?.pick;
    if (pick) out[nodeId] = pick;
  });
  return out;
}

function recoveryCandidatesFor(tree, r32Teams, picks, detail, forcedIds = []) {
  const forced = new Set(forcedIds);
  const byNode = Object.fromEntries((detail?.nodes || []).map(n => [n.nodeId, n]));
  const knownReal = (m) => !!(m?.home?.code && m?.away?.code && !m.home.tbd && !m.away.tbd);
  const out = {};
  tree.r32.forEach(n => { out[n.id] = r32Teams[n.id] || { a: { label: n.a }, b: { label: n.b } }; });
  const winner = (id) => {
    const c = out[id];
    const code = picks[id];
    if (!code || !c) return null;
    const nd = byNode[id];
    if (nd?.resolved && nd.actualWinner && code !== nd.actualWinner) return null;
    return [c.a, c.b].find(t => t?.code === code) || null;
  };
  [...tree.r16, ...tree.qf, ...tree.sf, tree.final].forEach(n => {
    const match = byNode[n.id]?.match;
    out[n.id] = forced.has(n.id) && knownReal(match)
      ? { a: match.home, b: match.away }
      : { a: winner(n.childA), b: winner(n.childB) };
  });
  return out;
}

function publicChat(limit = 120) {
  const rows = Array.isArray(db.chat) ? db.chat : [];
  return rows.slice(-limit).map(m => ({
    id: m.id,
    username: m.username,
    name: m.name || db.users[m.username]?.name || m.username,
    text: m.text,
    at: m.at,
  }));
}

function publicRankingFor(user) {
  const rows = Score.ranking().filter(r => user.isAdmin || !r.isAdmin);
  let rank = 0, prev = null;
  rows.forEach((r, i) => {
    if (prev === null || r.total !== prev) {
      rank = i + 1;
      prev = r.total;
    }
    r.rank = rank;
  });
  return rows;
}

function buildState(user) {
  const data = Data.getData();
  const groupPred = db.predictions[user.username]?.group || {};
  const bracketPred = db.predictions[user.username]?.bracket || {};
  const mvpPred = db.predictions[user.username]?.mvp || {};
  const finalPred = db.predictions[user.username]?.final || {};
  const gPicks = groupPred.picks || {};
  const mvpCandidates = Data.mvpCandidates();
  const mvpLiveScorers = Data.mvpLiveScorers();

  // --- Grupos ---
  const allGroup = Data.groupMatches().slice().sort(sortGroupMatch);
  const upcoming = Data.upcomingGroupMatches();
  const groupOpen = !groupPred.submitted && upcoming.length > 0;

  // --- Llave ---
  const win = Data.bracketWindow();
  const tree = buildTree();
  const r32Teams = Data.resolveR32Teams();
  tree.r32.forEach(n => {
    const t = r32Teams[n.id] || { a: { label: n.a }, b: { label: n.b } };
    n.teams = { a: wf(t.a), b: wf(t.b) };
  });
  const bracketOpen = win.open && !bracketPred.submitted;
  const bracketVisible = !!bracketPred.submitted || win.groupsFinished || Data.bracketPreviewAvailable();
  const bracketDetail = buildUserBracketDetail(user.username, Score.userBracketTotals(user.username));
  const mvpVisible = win.groupsFinished || !!mvpPred.submitted || !!Data.actualMvp();
  const mvpOpen = win.groupsFinished && !win.passedDeadline && mvpCandidates.length > 0 && !mvpPred.submitted && !Data.actualMvp();
  const fw = Data.finalWindow();
  const finalVisible = fw.teamsKnown || !!finalPred.submitted || !!Data.actualFinal();
  const finalState = {
    visible: finalVisible,
    open: fw.open && !finalPred.submitted,
    window: { teamsKnown: fw.teamsKnown, passed: !!fw.passed },
    submitted: !!finalPred.submitted,
    submittedAt: finalPred.at || null,
    teams: fw.teams ? { home: wf(fw.teams.home), away: wf(fw.teams.away), utcDate: fw.teams.utcDate } : null,
    your: finalPred.submitted ? { score: finalPred.score, champion: finalPred.champion } : null,
    actual: Data.actualFinal(),
    rules: CONFIG.scoring.final,
  };
  const actions = [];
  const deadlineText = bettingDeadlineText(win);
  if (bracketOpen) actions.push({ tab: 'llave', level: 'warn', label: 'Llave pendiente', text: `Se acepta envio de llaves ${deadlineText}.` });
  const actionNodes = bracketDetail.nodes.filter(n => n.recoveryOpen);
  const actionDeadline = actionNodes.map(n => n.match?.utcDate).filter(Boolean).sort()[0];
  if (bracketDetail.actionRequired) actions.push({ tab: 'llave', level: 'warn', label: 'Revisar llave', text: `${bracketDetail.actionRequired} accion${bracketDetail.actionRequired === 1 ? '' : 'es'} pendiente${bracketDetail.actionRequired === 1 ? '' : 's'} antes de ${madridShortDate(actionDeadline)}.` });
  if (!bracketDetail.actionRequired && bracketDetail.recoveryPending) actions.push({ tab: 'llave', level: 'info', label: 'Ramas rotas', text: `${bracketDetail.recoveryPending} rama${bracketDetail.recoveryPending === 1 ? '' : 's'} rota${bracketDetail.recoveryPending === 1 ? '' : 's'}; la recuperacion se abrira cuando cierre la ronda.` });
  if (mvpOpen) actions.push({ tab: 'mvp', level: 'warn', label: 'Bota de Oro pendiente', text: `Se acepta envio de Bota de Oro ${deadlineText}.` });
  if (finalState.open) actions.push({ tab: 'final', level: 'warn', label: 'Final pendiente', text: 'Falta enviar la prediccion de la final.' });

  return {
    now: Data.now().toISOString(),
    simulated: !!CONFIG.simulatedNow,
    source: data.source,
    fetchedAt: data.fetchedAt || null,
    me: { username: user.username, name: user.name, isAdmin: !!user.isAdmin },
    rules: CONFIG.scoring,
    prize: prizeInfo(),
    group: {
      open: groupOpen,
      submitted: !!groupPred.submitted,
      submittedAt: groupPred.at || null,
      upcomingIds: upcoming.map(m => m.id),
      matches: allGroup.map(m => publicMatch(m, gPicks, !!groupPred.submitted)),
      standings: enrichStandings(Data.computeStandings()),
    },
    bracket: {
      visible: bracketVisible,
      open: bracketOpen,
      window: win,
      submitted: !!bracketPred.submitted,
      submittedAt: bracketPred.at || null,
      tree,
      yourPicks: bracketPred.picks || {},
      detail: bracketDetail,
      actualReached: Data.actualReached(),
    },
    mvp: {
      visible: mvpVisible,
      open: mvpOpen,
      window: win,
      submitted: !!mvpPred.submitted,
      submittedAt: mvpPred.at || null,
      yourPick: mvpPred.playerId || null,
      actual: Data.actualMvp(),
      points: CONFIG.mvp.points,
      candidates: mvpCandidates.map(p => ({ ...p, flag: flagUrlFromCode(p.code) })),
      liveScorers: mvpLiveScorers.map(p => ({ ...p, flag: flagUrlFromCode(p.code) })),
      candidatesSource: data.mvpCandidatesSource || (data.testMode ? 'test' : 'config'),
      candidatesLocked: !!data.mvpCandidatesLocked,
      candidatesAt: data.mvpCandidatesAt || null,
      liveScorersAt: data.mvpLiveScorersAt || null,
      liveScorersSource: data.mvpLiveScorersSource || null,
    },
    final: finalState,
    actions,
    ranking: publicRankingFor(user),
    feed: Score.socialFeed(80),
    chat: publicChat(120),
  };
}

// --------------------------------------------------------- rutas API -------
async function handleApi(req, res, pathname) {
  const { token, user } = currentUser(req);
  const method = req.method;

  // --- Públicas ---
  if (pathname === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    try {
      const t = Auth.login(b.username, b.password);
      const u = Auth.userFromToken(t);
      return sendJSON(res, 200, { ok: true, me: { username: u.username, name: u.name, isAdmin: !!u.isAdmin } },
        { 'Set-Cookie': Auth.sessionCookie(t, req) });
    } catch (e) { return sendJSON(res, 401, { error: publicLoginError(e) }); }
  }
  if (pathname === '/api/logout' && method === 'POST') {
    Auth.logout(token);
    return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': Auth.clearCookie() });
  }
  if (pathname === '/api/me' && method === 'GET') {
    if (!user) return sendJSON(res, 401, { error: 'No autenticado' });
    return sendJSON(res, 200, { me: { username: user.username, name: user.name, isAdmin: !!user.isAdmin } });
  }

  // A partir de aquí, requiere sesión.
  if (!user) return sendJSON(res, 401, { error: 'No autenticado' });

  if (pathname === '/api/state' && method === 'GET') {
    return sendJSON(res, 200, buildState(user));
  }

  if (pathname === '/api/chat' && method === 'POST') {
    const b = await readBody(req);
    const text = String(b.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return sendJSON(res, 400, { error: 'Escribe un comentario antes de enviar.' });
    if (text.length > 220) return sendJSON(res, 400, { error: 'Comentario demasiado largo. Maximo 220 caracteres.' });
    db.chat = Array.isArray(db.chat) ? db.chat : [];
    db.chat.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      username: user.username,
      name: user.name,
      text,
      at: new Date().toISOString(),
    });
    saveDB();
    return sendJSON(res, 200, { ok: true, chat: publicChat(120) });
  }

  const userGroupMatch = /^\/api\/users\/([^/]+)\/group-predictions$/.exec(pathname);
  if (userGroupMatch && method === 'GET') {
    const target = String(userGroupMatch[1] || '').toLowerCase();
    const payload = buildUserGroupPredictions(target);
    if (!payload) return sendJSON(res, 404, { error: 'Usuario no encontrado.' });
    return sendJSON(res, 200, payload);
  }

  if (pathname === '/api/account/password' && method === 'POST') {
    const b = await readBody(req);
    if (!Auth.verifyPassword(b.current || '', user.passHash))
      return sendJSON(res, 400, { error: 'La contraseña actual no es correcta.' });
    try { Auth.setPassword(user.username, b.new); return sendJSON(res, 200, { ok: true }); }
    catch (e) { return sendJSON(res, 400, { error: e.message }); }
  }
  if (pathname === '/api/account/name' && method === 'POST') {
    const b = await readBody(req);
    const name = String(b.name || '').trim();
    if (name.length < 2 || name.length > 40)
      return sendJSON(res, 400, { error: 'El nombre debe tener entre 2 y 40 caracteres.' });
    const previous = user.name;
    try {
      user.name = name;
      saveDB();
      return sendJSON(res, 200, { ok: true, me: { username: user.username, name: user.name, isAdmin: !!user.isAdmin } });
    } catch (e) {
      user.name = previous;
      return sendJSON(res, 400, { error: publicLoginError(e) });
    }
  }

  // --- Enviar predicciones de grupos (una sola vez) ---
  if (pathname === '/api/group' && method === 'POST') {
    const b = await readBody(req);
    const pred = db.predictions[user.username] || (db.predictions[user.username] = {});
    if (pred.group && pred.group.submitted)
      return sendJSON(res, 409, { error: 'Ya enviaste tus predicciones de grupos.' });
    const upcoming = Data.upcomingGroupMatches();
    const ids = new Set(upcoming.map(m => m.id));
    const picks = {};
    for (const m of upcoming) {
      const p = (b.picks || {})[m.id];
      if (!p || p.home == null || p.away == null || `${p.home}` === '' || `${p.away}` === '')
        return sendJSON(res, 400, { error: 'Faltan marcadores: debes rellenar TODOS los partidos antes de enviar.' });
      const h = Number(p.home), a = Number(p.away);
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99)
        return sendJSON(res, 400, { error: 'Marcador no válido en algún partido (0-99).' });
      picks[m.id] = { home: h, away: a };
    }
    // Ignora cualquier id que no esté en los partidos por jugar.
    pred.group = { submitted: true, at: new Date().toISOString(), picks };
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  // --- Enviar predicción de la llave (una sola vez) ---
  if (pathname === '/api/bracket' && method === 'POST') {
    const b = await readBody(req);
    const win = Data.bracketWindow();
    const pred = db.predictions[user.username] || (db.predictions[user.username] = {});
    if (!win.open) return sendJSON(res, 403, { error: 'La llave no está abierta todavía.' });
    if (pred.bracket && pred.bracket.submitted)
      return sendJSON(res, 409, { error: 'Ya enviaste tu llave.' });

    const tree = buildTree();
    const r32Teams = Data.resolveR32Teams();
    const picks = b.picks || {};
    // Debe estar completa hasta el campeón.
    const allNodes = [...tree.r32, ...tree.r16, ...tree.qf, ...tree.sf, tree.final];
    for (const n of allNodes) if (!picks[n.id]) return sendJSON(res, 400, { error: 'La llave está incompleta: elige un ganador en cada cruce hasta el campeón.' });
    const v = validateBracket(tree, r32Teams, picks);
    if (!v.ok) return sendJSON(res, 400, { error: v.error });

    pred.bracket = { submitted: true, at: new Date().toISOString(), picks };
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  // --- Recuperar una rama rota en un cruce real de la llave ---
  if (pathname === '/api/bracket/recovery' && method === 'POST') {
    const b = await readBody(req);
    const pred = db.predictions[user.username] || (db.predictions[user.username] = {});
    if (!pred.bracket?.submitted) return sendJSON(res, 403, { error: 'Primero debes haber enviado tu llave inicial.' });
    const nodeId = String(b.nodeId || '');
    const tree = buildTree();
    const submittedPicks = b.picks && typeof b.picks === 'object' ? b.picks : { [nodeId]: String(b.pick || '') };
    const detail = buildUserBracketDetail(user.username, Score.userBracketTotals(user.username));
    const node = detail.nodes.find(n => n.nodeId === nodeId);
    if (!node || !(node.recoveryOpen || node.revisionOpen)) return sendJSON(res, 403, { error: 'Este cruce no permite recuperacion o cambio ahora mismo.' });
    const requiredIds = recoveryEditNodeIds(tree, detail, nodeId);
    const merged = currentBracketPicks(pred);
    requiredIds.forEach(id => {
      if (submittedPicks[id]) merged[id] = String(submittedPicks[id]);
      else delete merged[id];
    });
    const r32Teams = Data.resolveR32Teams();
    const cand = recoveryCandidatesFor(tree, r32Teams, merged, detail, requiredIds);
    for (const id of requiredIds) {
      const pick = merged[id];
      if (!pick) return sendJSON(res, 400, { error: 'La reedicion esta incompleta: completa el arbol pendiente antes de enviar.' });
      const validPick = [cand[id]?.a?.code, cand[id]?.b?.code].filter(Boolean).includes(pick);
      if (!validPick) return sendJSON(res, 400, { error: 'La reedicion no es coherente con el arbol.' });
    }
    pred.bracket.recoveries = pred.bracket.recoveries || {};
    const at = new Date().toISOString();
    requiredIds.forEach(id => {
      if (merged[id] && merged[id] !== pred.bracket.picks[id]) pred.bracket.recoveries[id] = { pick: merged[id], at, startedAt: nodeId };
      else delete pred.bracket.recoveries[id];
    });
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  // --- Enviar prediccion de Bota de Oro (una sola vez) ---
  if (pathname === '/api/mvp' && method === 'POST') {
    const b = await readBody(req);
    const win = Data.bracketWindow();
    const pred = db.predictions[user.username] || (db.predictions[user.username] = {});
    if (!(win.groupsFinished && !win.passedDeadline && Data.mvpCandidates().length > 0 && !Data.actualMvp())) {
      return sendJSON(res, 403, { error: 'La prediccion de Bota de Oro aun no esta abierta.' });
    }
    if (pred.mvp && pred.mvp.submitted) return sendJSON(res, 409, { error: 'Ya enviaste tu prediccion de Bota de Oro.' });
    const valid = Data.mvpCandidates().some(p => p.id === b.playerId);
    if (!valid) return sendJSON(res, 400, { error: 'Jugador no válido.' });
    pred.mvp = { submitted: true, at: new Date().toISOString(), playerId: b.playerId };
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  // --- Enviar prediccion de la Final (una sola vez) ---
  if (pathname === '/api/final' && method === 'POST') {
    const b = await readBody(req);
    const fw = Data.finalWindow();
    const pred = db.predictions[user.username] || (db.predictions[user.username] = {});
    if (!fw.open) return sendJSON(res, 403, { error: 'La prediccion de la final aun no esta disponible.' });
    if (pred.final && pred.final.submitted) return sendJSON(res, 409, { error: 'Ya enviaste tu prediccion de la final.' });
    const sc = b.score || {};
    const h = Number(sc.home), a = Number(sc.away);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99)
      return sendJSON(res, 400, { error: 'Marcador de la final no válido (0-99).' });
    let champ = h > a ? fw.teams.home.code : (h < a ? fw.teams.away.code : b.champion);
    const validChamp = fw.teams && (champ === fw.teams.home.code || champ === fw.teams.away.code);
    if (h === a && !validChamp) return sendJSON(res, 400, { error: 'Si pronosticas empate, elige quién levanta la copa.' });
    const finalNode = Score.evaluateBracket(user.username).nodes.find(n => n.round === 'FINAL');
    const projected = finalNode?.activePick || null;
    if (projected && validChamp && champ !== projected) {
      const projectedTeam = teamFromCode(projected);
      return sendJSON(res, 400, { error: `Tu llave mantiene como campeon proyectado a ${projectedTeam.name}. El resultado de final debe ser acorde.` });
    }
    pred.final = { submitted: true, at: new Date().toISOString(), score: { home: h, away: a }, champion: champ };
    saveDB();
    return sendJSON(res, 200, { ok: true });
  }

  // --- Admin ---
  if (pathname.startsWith('/api/admin/')) {
    if (!user.isAdmin) return sendJSON(res, 403, { error: 'Solo el administrador.' });

    if (pathname === '/api/admin/users' && method === 'GET') {
      const users = Object.values(db.users).map(u => ({
        username: u.username, name: u.name, isAdmin: !!u.isAdmin, createdAt: u.createdAt,
      }));
      return sendJSON(res, 200, { users });
    }
    if (pathname === '/api/admin/users' && method === 'POST') {
      const b = await readBody(req);
      try { const u = Auth.createUser({ username: b.username, name: b.name, password: b.password }); return sendJSON(res, 200, { ok: true, username: u.username }); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }
    }
    if (pathname === '/api/admin/reset' && method === 'POST') {
      const b = await readBody(req);
      try { Auth.setPassword(String(b.username || '').toLowerCase(), b.password); return sendJSON(res, 200, { ok: true }); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }
    }
    if (pathname === '/api/admin/delete' && method === 'POST') {
      const b = await readBody(req);
      const target = String(b.username || '').toLowerCase();
      if (target === user.username) return sendJSON(res, 400, { error: 'No puedes borrarte a ti mismo.' });
      if (!db.users[target]) return sendJSON(res, 404, { error: 'Usuario no encontrado.' });
      delete db.users[target]; delete db.predictions[target];
      Object.entries(db.sessions).forEach(([t, s]) => { if (s.username === target) delete db.sessions[t]; });
      saveDB();
      return sendJSON(res, 200, { ok: true });
    }
    if (pathname === '/api/admin/refresh' && method === 'POST') {
      try { const r = await refreshResultsFromAPI('manual'); return sendJSON(res, 200, { ok: true, ...r }); }
      catch (e) { return sendJSON(res, 400, { error: e.message }); }
    }
    if (pathname === '/api/admin/test-phases' && method === 'GET') {
      const data = Data.getData();
      return sendJSON(res, 200, {
        phases: TEST_PHASES,
        active: data.testMode ? { id: data.testPhase, name: data.testPhaseName, source: data.source } : null,
      });
    }
    if (pathname === '/api/admin/test-phase' && method === 'POST') {
      const b = await readBody(req);
      try {
        const payload = buildTestPhase(String(b.phaseId || ''));
        writeResults(payload);
        return sendJSON(res, 200, { ok: true, phase: { id: payload.testPhase, name: payload.testPhaseName } });
      } catch (e) { return sendJSON(res, 400, { error: e.message }); }
    }
    if (pathname === '/api/admin/test-phase/clear' && method === 'POST') {
      try {
        clearResults();
        if (CONFIG.api.token) {
          const r = await refreshResultsFromAPI('manual');
          return sendJSON(res, 200, { ok: true, restored: 'api', ...r });
        }
        return sendJSON(res, 200, { ok: true, restored: 'sample' });
      } catch (e) { return sendJSON(res, 400, { error: e.message }); }
    }
  }

  return sendJSON(res, 404, { error: 'Ruta no encontrada' });
}

// --------------------------------------------------------- estáticos -------
async function serveIndex(res, base = '') {
  const html = await readFile(join(PUBLIC, 'index.html'), 'utf8');
  const body = html.replaceAll('%APP_BASE%', base);
  res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
  res.end(body);
}
async function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const full = normalize(join(PUBLIC, rel));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    if (rel === '/index.html') return await serveIndex(res, mountedBase(decodeURIComponent((req.url || '/').split('?')[0])));
    const body = await readFile(full);
    const ext = extname(full).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (NO_CACHE_EXT.has(ext)) headers['Cache-Control'] = 'no-store';
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    // SPA fallback a index.html para rutas desconocidas que no sean de API.
    try {
      await serveIndex(res, mountedBase(decodeURIComponent((req.url || '/').split('?')[0])));
    } catch { res.writeHead(404); res.end('No encontrado'); }
  }
}

// --------------------------------------------------------- servidor --------
function redirectCloudflareHttp(req, res) {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const host = String(req.headers.host || '');
  if (proto !== 'http' || !host || /^localhost(:|$)|^127\.0\.0\.1(:|$)/i.test(host)) return false;
  res.writeHead(308, {
    Location: `https://${host}${req.url || '/'}`,
    'Cache-Control': 'no-store',
  });
  res.end();
  return true;
}

async function appHandler(req, res) {
  try {
    if (redirectCloudflareHttp(req, res)) return;
    const pathname = stripMountedPath(decodeURIComponent((req.url || '/').split('?')[0]));
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    return await serveStatic(req, res, pathname);
  } catch (e) {
    sendJSON(res, 500, { error: e.message || 'Error del servidor' });
  }
}

function startTlsOrigin() {
  if (!CONFIG.tls.port) return;
  if (!CONFIG.tls.cert || !CONFIG.tls.key || !existsSync(CONFIG.tls.cert) || !existsSync(CONFIG.tls.key)) {
    console.warn('   TLS local no iniciado: faltan TLS_CERT/TLS_KEY o los ficheros no existen.');
    return;
  }
  const tlsServer = createHttpsServer({
    cert: readFileSync(CONFIG.tls.cert),
    key: readFileSync(CONFIG.tls.key),
  }, appHandler);
  tlsServer.listen(CONFIG.tls.port, CONFIG.host, () => {
    console.log(`   Origen HTTPS local en https://${CONFIG.host}:${CONFIG.tls.port}`);
  });
}

const server = createServer(appHandler);

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`\n⚽ ${CONFIG.appName}`);
  console.log(`   Servidor en http://${CONFIG.host}:${CONFIG.port}`);
  if (CONFIG.simulatedNow) console.log(`   Reloj SIMULADO: ${CONFIG.simulatedNow} (pon REAL_CLOCK=1 para usar el real)`);
  console.log(`   Datos: ${CONFIG.api.token ? 'API football-data.org disponible' : 'sin token -> datos de ejemplo'}`);
  console.log('   Para exponerlo:  cloudflared tunnel --url http://' + CONFIG.host + ':' + CONFIG.port + '\n');
  startTlsOrigin();
  startResultsRefreshTimer();
});
