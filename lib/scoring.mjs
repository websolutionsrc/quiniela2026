// ============================================================================
//  Puntuacion: grupos, llave dinamica con rachas, Bota de Oro y final.
// ============================================================================
import { CONFIG } from '../config.mjs';
import { db } from './store.mjs';
import {
  groupMatches,
  isFinished,
  actualFinal,
  actualMvp,
  knockoutMatches,
  resolveR32Teams,
  winnerCode,
  now,
  teamsKnown,
} from './data.mjs';
import { buildTree, candidatesFor } from './bracket.mjs';

export const signOf = (h, a) => (h > a ? '1' : h < a ? '2' : 'X');

export function groupPointsFor(pred, match) {
  if (!isFinished(match)) return { exact: 0, winner: 0, sign: 0, combined: 0, hasResult: false, predicted: !!pred };
  if (!pred || pred.home == null || pred.away == null)
    return { exact: 0, winner: 0, sign: 0, combined: 0, hasResult: true, predicted: false };
  const r = CONFIG.scoring.group;
  const exactHit = pred.home === match.score.home && pred.away === match.score.away;
  const signHit = signOf(pred.home, pred.away) === signOf(match.score.home, match.score.away);
  const exact = exactHit ? r.exactScore : 0;
  const winner = signHit ? r.signPartial : 0;
  const sign = signHit ? r.sign : 0;
  return { exact, winner, sign, combined: exact + winner + sign, hasResult: true, predicted: true, exactHit, signHit };
}

function userGroupPicks(username) {
  const p = db.predictions[username];
  return (p && p.group && p.group.picks) || {};
}

export function userGroupTotals(username) {
  const picks = userGroupPicks(username);
  const t = { exact: 0, winner: 0, sign: 0, combined: 0, exactHits: 0, signHits: 0, winnerHits: 0, scored: 0 };
  groupMatches().forEach(m => {
    const r = groupPointsFor(picks[m.id], m);
    if (!r.hasResult) return;
    t.exact += r.exact; t.winner += r.winner || 0; t.sign += r.sign; t.combined += r.combined;
    if (r.predicted) {
      t.scored++;
      if (r.exactHit) t.exactHits++;
      if (r.signHit) t.signHits++;
      if (r.signHit && !r.exactHit) t.winnerHits++;
    }
  });
  return t;
}

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
const NEXT_ROUND = { R32: 'R16', R16: 'QF', QF: 'SF', SF: 'FINAL', FINAL: 'CHAMP' };
const ROUND_LABELS = { R32: '1/16', R16: 'Octavos', QF: 'Cuartos', SF: 'Semifinal', FINAL: 'Final' };
const PREV_ROUND = { R16: 'R32', QF: 'R16', SF: 'QF', FINAL: 'SF' };

function treeNodes(tree) {
  return [...tree.r32, ...tree.r16, ...tree.qf, ...tree.sf, tree.final];
}

function nodesByRound(tree) {
  return { R32: tree.r32, R16: tree.r16, QF: tree.qf, SF: tree.sf, FINAL: [tree.final] };
}

function roundFinished(round, tree, matchesByNode) {
  const nodes = nodesByRound(tree)[round] || [];
  return nodes.length > 0 && nodes.every(n => isFinished(matchesByNode[n.id]));
}

function matchTeams(match) {
  return [match?.home, match?.away].filter(t => t && !t.tbd && t.code);
}

function codeInMatch(code, match) {
  return !!code && (match?.home?.code === code || match?.away?.code === code);
}

function sameCodeSet(a, b) {
  const left = a.filter(Boolean).sort().join('|');
  const right = b.filter(Boolean).sort().join('|');
  return left.length > 0 && left === right;
}

function branchTeam(code) {
  if (!code) return null;
  const all = knockoutMatches().flatMap(m => [m.home, m.away]).filter(Boolean);
  return all.find(t => t.code === code && !t.tbd) || { code, name: code };
}

export function actualMatchesByNode(tree = buildTree()) {
  const byRound = nodesByRound(tree);
  const r32Teams = resolveR32Teams();
  const out = {};
  const used = new Set();
  const matchKey = (a, b) => [a, b].filter(Boolean).sort().join('|');
  const sameTeams = (match, a, b) =>
    !!match && matchKey(match.home?.code, match.away?.code) === matchKey(a, b);
  const winnerOfNode = (nodeId) => winnerCode(out[nodeId]);
  const expectedFor = (node) => {
    if (node.round === 'R32') {
      const seed = r32Teams[node.id];
      return [seed?.a?.code, seed?.b?.code];
    }
    return [winnerOfNode(node.childA), winnerOfNode(node.childB)];
  };
  for (const round of ROUND_ORDER) {
    const matches = knockoutMatches()
      .filter(m => m.phase === round)
      .slice()
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate) || String(a.id).localeCompare(String(b.id)));
    byRound[round].forEach((node, index) => {
      const [a, b] = expectedFor(node);
      const byTeams = a && b ? matches.find(m => !used.has(m.id) && sameTeams(m, a, b)) : null;
      const fallback = matches.find((m, i) => i >= index && !used.has(m.id)) || matches.find(m => !used.has(m.id));
      const match = byTeams || fallback;
      if (match) {
        out[node.id] = match;
        used.add(match.id);
      }
    });
  }
  return out;
}

function recoveryPickFor(pred, nodeId) {
  const r = pred?.recoveries?.[nodeId];
  if (!r) return null;
  return typeof r === 'string' ? r : r.pick || null;
}

function recoveryMetaFor(pred, nodeId) {
  const r = pred?.recoveries?.[nodeId];
  return r && typeof r === 'object' ? r : null;
}

function branchBase() {
  return CONFIG.scoring.bracket.perWinner || 2;
}
function branchStep() {
  return branchBase();
}

function makeBranch(code, type) {
  return { code, team: branchTeam(code), type, state: 'live', value: branchBase(), lastWon: 0 };
}

export function evaluateBracket(username) {
  const pred = db.predictions[username]?.bracket || {};
  const picks = pred.picks || {};
  const tree = buildTree();
  const matchesByNode = actualMatchesByNode(tree);
  const originalCandidates = candidatesFor(tree, resolveR32Teams(), picks);
  const parentByChild = {};
  [...tree.r16, ...tree.qf, ...tree.sf, tree.final].forEach(n => {
    parentByChild[n.childA] = n.id;
    parentByChild[n.childB] = n.id;
  });
  const branches = {};
  const nodes = [];
  const events = [];
  let points = 0;
  let correct = 0;
  let brokenCount = 0;
  let closedCount = 0;

  const ensure = (code, type) => {
    if (!code) return null;
    if (!branches[code] || branches[code].state !== 'live') branches[code] = makeBranch(code, type);
    return branches[code];
  };
  const breakBranch = (branch) => {
    if (!branch || branch.state !== 'live') return;
    branch.state = 'broken';
    brokenCount++;
  };
  const closeBranch = (branch) => {
    if (!branch || branch.state !== 'live') return;
    branch.state = 'closed';
    closedCount++;
  };

  for (const node of treeNodes(tree)) {
    const match = matchesByNode[node.id] || null;
    const originalPick = picks[node.id] || null;
    const recoveryPick = recoveryPickFor(pred, node.id);
    const recoveryMeta = recoveryMetaFor(pred, node.id);
    const finished = isFinished(match);
    const winner = winnerCode(match);
    const realKnown = !!(match && teamsKnown(match));
    const beforeKickoff = match ? now() < new Date(match.utcDate) : false;
    const originalLive = originalPick && (
      node.round === 'R32'
        ? codeInMatch(originalPick, match)
        : branches[originalPick]?.state === 'live' && codeInMatch(originalPick, match)
    );
    const recoveredLive = recoveryPick && codeInMatch(recoveryPick, match);
    const prevRound = PREV_ROUND[node.round];
    const previousRoundClosed = prevRound ? roundFinished(prevRound, tree, matchesByNode) : false;
    const projected = originalCandidates[node.id] || {};
    const projectedCodes = [projected.a?.code, projected.b?.code].filter(Boolean);
    const realCodes = matchTeams(match).map(t => t.code);
    const projectedMatchChanged = projectedCodes.length === 2 && realCodes.length === 2 && !sameCodeSet(projectedCodes, realCodes);
    const canChooseAgain = !!pred.submitted && node.round !== 'R32' && realKnown && beforeKickoff && !recoveryPick;
    const canActNow = canChooseAgain && previousRoundClosed;
    const recoveryPending = canChooseAgain && !previousRoundClosed && !originalLive;
    const recoveryOpen = canActNow && !originalLive;
    const revisionOpen = canActNow && !!originalLive && projectedMatchChanged;
    const recoveryOverrides = !!(recoveredLive && originalLive && recoveryPick !== originalPick);
    if (recoveryOverrides) closeBranch(ensure(originalPick, 'original'));
    const activePick = recoveryOverrides ? recoveryPick : (originalLive ? originalPick : (recoveredLive ? recoveryPick : null));
    const activeType = recoveryOverrides ? 'recovered' : (originalLive ? 'original' : (recoveredLive ? 'recovered' : null));
    const branch = activePick ? ensure(activePick, activeType) : null;
    const value = branch?.value || branchBase();
    let status = finished ? 'closed' : 'pending';
    let wonPoints = 0;

    if (finished) {
      if (branch && activePick === winner) {
        wonPoints = value;
        points += wonPoints;
        correct++;
        branch.lastWon = wonPoints;
        branch.value += branchStep();
        const parentId = parentByChild[node.id];
        const continues = parentId && (picks[parentId] === activePick || recoveryPickFor(pred, parentId) === activePick);
        if (!continues) {
          branch.state = 'closed';
          closedCount++;
          status = 'closed';
        } else {
          status = 'won';
        }
        events.push({
          type: activeType === 'recovered' ? 'bracket-recovered-hit' : 'bracket-hit',
          at: match.utcDate,
          nodeId: node.id,
          round: node.round,
          team: branch.team,
          points: wonPoints,
          next: branch.value,
        });
      } else if (branch) {
        breakBranch(branch);
        status = 'broken';
        events.push({
          type: activeType === 'recovered' ? 'bracket-recovered-broken' : 'bracket-broken',
          at: match.utcDate,
          nodeId: node.id,
          round: node.round,
          team: branch.team,
          points: 0,
          next: null,
        });
      }
    }

    nodes.push({
      nodeId: node.id,
      round: node.round,
      roundName: ROUND_LABELS[node.round] || node.round,
      advancesTo: NEXT_ROUND[node.round],
      match: match ? { id: match.id, utcDate: match.utcDate, status: match.status, home: match.home, away: match.away, score: match.score } : null,
      actualWinner: winner,
      originalPick,
      recoveryPick,
      recoveryAt: recoveryMeta?.at || null,
      activePick,
      branchType: activeType,
      branchValue: value,
      status,
      resolved: finished,
      hit: wonPoints > 0,
      points: wonPoints,
      nextValue: wonPoints > 0 ? value + branchStep() : null,
      recoveryPending,
      recoveryOpen,
      revisionOpen,
      recoveryOptions: (recoveryOpen || revisionOpen) ? matchTeams(match) : [],
    });
  }

  const liveBranches = Object.values(branches).filter(b => b.state === 'live');
  const originalLive = liveBranches.filter(b => b.type === 'original').length;
  const recoveredLive = liveBranches.filter(b => b.type === 'recovered').length;
  const bestActive = liveBranches.reduce((m, b) => Math.max(m, b.value), 0);
  const actionRequired = nodes.filter(n => n.recoveryOpen).length;
  const recoveryPending = nodes.filter(n => n.recoveryPending).length;
  return {
    submitted: !!pred.submitted,
    submittedAt: pred.at || null,
    points,
    correct,
    hasResult: nodes.some(n => n.resolved),
    nodes,
    events,
    branches: Object.values(branches),
    originalLive,
    recoveredLive,
    broken: brokenCount,
    closed: closedCount,
    bestActive,
    actionRequired,
    recoveryPending,
    recoveries: pred.recoveries || {},
  };
}

export function userBracketTotals(username) {
  const ev = evaluateBracket(username);
  return {
    points: ev.points,
    correct: ev.correct,
    top4: 0,
    finalists: 0,
    hasResult: ev.hasResult,
    originalLive: ev.originalLive,
    recoveredLive: ev.recoveredLive,
    broken: ev.broken,
    closed: ev.closed,
    bestActive: ev.bestActive,
    actionRequired: ev.actionRequired,
    recoveryPending: ev.recoveryPending,
  };
}

export function userMvpTotals(username) {
  const pid = db.predictions[username]?.mvp?.playerId || null;
  const actual = actualMvp();
  const hit = !!(actual && pid && pid === actual);
  return { points: hit ? CONFIG.mvp.points : 0, picked: !!pid, hit, playerId: pid };
}

export function userFinalTotals(username) {
  const pred = db.predictions[username]?.final;
  const af = actualFinal();
  const r = CONFIG.scoring.final;
  if (!pred) return { points: 0, predicted: false, hasResult: !!af };
  if (!af) return { points: 0, predicted: true, hasResult: false };
  const ps = pred.score, as = af.score;
  const rawExactHit = ps && ps.home === as.home && ps.away === as.away;
  const signHit = ps && signOf(ps.home, ps.away) === signOf(as.home, as.away);
  const champHit = !!(pred.champion && af.winner && pred.champion === af.winner);
  const exactHit = rawExactHit && (as.home !== as.away || champHit);
  let points = exactHit ? r.exactScore : 0;
  if (champHit) points += r.championBonus;
  return { points, predicted: true, hasResult: true, exactHit, signHit, champHit };
}

export function socialFeed(limit = 80) {
  const events = [];
  for (const u of Object.values(db.users)) {
    if (u.isAdmin) continue;
    const name = u.name || u.username;
    const groupPicks = db.predictions[u.username]?.group?.picks || {};
    for (const m of groupMatches().filter(isFinished)) {
      const r = groupPointsFor(groupPicks[m.id], m);
      if (r.exactHit) {
        events.push({
          at: m.utcDate,
          kind: 'group-exact',
          text: `${name} acertó el resultado de ${m.home.name} - ${m.away.name} ${m.score.home}-${m.score.away}. +${r.combined}`,
        });
      }
    }
    for (const ev of evaluateBracket(u.username).events) {
      const team = ev.team?.name || ev.team?.code || 'un equipo';
      if (ev.type === 'bracket-hit') {
        events.push({ at: ev.at, kind: ev.type, text: `${name} pasó a ${team} en ${ROUND_LABELS[ev.round] || ev.round}. Sumó +${ev.points}. Próximo acierto: +${ev.next}.` });
      } else if (ev.type === 'bracket-recovered-hit') {
        events.push({ at: ev.at, kind: ev.type, text: `${name} recuperó ${team} y acertó que pasaba. Sumó +${ev.points}. Próximo acierto: +${ev.next}.` });
      } else {
        events.push({ at: ev.at, kind: ev.type, text: `${name} rompió la racha de ${team}. No suma puntos y puede recuperar el cruce real.` });
      }
    }
    const final = userFinalTotals(u.username);
    const pred = db.predictions[u.username]?.final;
    const af = actualFinal();
    if (af && pred?.submitted) {
      if (final.exactHit) events.push({ at: new Date().toISOString(), kind: 'final-exact', text: `${name} acertó el marcador exacto de la final. Sumó +${CONFIG.scoring.final.exactScore} extra.` });
      if (final.champHit) events.push({ at: new Date().toISOString(), kind: 'final-champ', text: `${name} acertó el campeón. Sumó +${CONFIG.scoring.final.championBonus}.` });
    }
  }
  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

export function ranking() {
  const hasPredictions = (u) =>
    Object.keys(db.predictions[u.username]?.group?.picks || {}).length > 0 ||
    Object.keys(db.predictions[u.username]?.bracket?.picks || {}).length > 0 ||
    !!db.predictions[u.username]?.mvp?.playerId ||
    !!db.predictions[u.username]?.final?.submitted;
  const rows = Object.values(db.users)
    .filter(u => !u.isAdmin || hasPredictions(u))
    .map(u => {
      const g = userGroupTotals(u.username);
      const b = userBracketTotals(u.username);
      const mv = userMvpTotals(u.username);
      const fn = userFinalTotals(u.username);
      return {
        username: u.username, name: u.name, isAdmin: !!u.isAdmin,
        group: g, bracket: b, mvp: mv, final: fn,
        total: g.combined + b.points + mv.points + fn.points,
      };
    });
  rows.sort((a, b) =>
    b.total - a.total ||
    b.group.exactHits - a.group.exactHits ||
    b.bracket.correct - a.bracket.correct ||
    a.name.localeCompare(b.name));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (prev === null || r.total !== prev) { rank = i + 1; prev = r.total; } r.rank = rank; });
  return rows;
}
