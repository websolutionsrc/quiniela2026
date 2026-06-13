// ============================================================================
//  Puntuación: grupos (exacto + 1X2) y llave (avances + bonus top 4)
// ============================================================================
import { CONFIG } from '../config.mjs';
import { db } from './store.mjs';
import { groupMatches, isFinished, actualReached } from './data.mjs';
import { buildTree, userReached } from './bracket.mjs';

export const signOf = (h, a) => (h > a ? '1' : h < a ? '2' : 'X');

// --- Grupos -----------------------------------------------------------------
export function groupPointsFor(pred, match) {
  if (!isFinished(match)) return { exact: 0, sign: 0, combined: 0, hasResult: false, predicted: !!pred };
  if (!pred || pred.home == null || pred.away == null)
    return { exact: 0, sign: 0, combined: 0, hasResult: true, predicted: false };
  const r = CONFIG.scoring.group;
  const exactHit = pred.home === match.score.home && pred.away === match.score.away;
  const signHit = signOf(pred.home, pred.away) === signOf(match.score.home, match.score.away);
  const exact = exactHit ? r.exactScore : (signHit ? r.signPartial : 0);
  const sign = signHit ? r.sign : 0;
  return { exact, sign, combined: exact + sign, hasResult: true, predicted: true, exactHit, signHit };
}

function userGroupPicks(username) {
  const p = db.predictions[username];
  return (p && p.group && p.group.picks) || {};
}
export function userGroupTotals(username) {
  const picks = userGroupPicks(username);
  const t = { exact: 0, sign: 0, combined: 0, exactHits: 0, signHits: 0, scored: 0 };
  groupMatches().forEach(m => {
    const r = groupPointsFor(picks[m.id], m);
    if (!r.hasResult) return;
    t.exact += r.exact; t.sign += r.sign; t.combined += r.combined;
    if (r.predicted) { t.scored++; if (r.exactHit) t.exactHits++; if (r.signHit) t.signHits++; }
  });
  return t;
}

// --- Llave ------------------------------------------------------------------
function userBracketPicks(username) {
  const p = db.predictions[username];
  return (p && p.bracket && p.bracket.picks) || {};
}
export function userBracketTotals(username) {
  const picks = userBracketPicks(username);
  const tree = buildTree();
  const ur = userReached(tree, picks);
  const ar = actualReached();
  const s = CONFIG.scoring.bracket;
  const inSet = (arr, codes) => { const set = new Set(codes); return arr.filter(x => set.has(x)).length; };

  // Aciertos de "cruce" = equipos que el usuario hizo avanzar y realmente avanzaron.
  const correct =
    inSet(ur.R16, ar.R16) +   // ganadores de 1/16
    inSet(ur.QF, ar.QF) +     // ganadores de octavos
    inSet(ur.SF, ar.SF) +     // ganadores de cuartos (a semis)
    inSet(ur.FINAL, ar.FINAL) + // ganadores de semis (a la final)
    inSet(ur.CHAMP, ar.CHAMP);  // campeón
  const top4 = inSet(ur.SF, ar.SF); // semifinalistas acertados

  const points = correct * s.perWinner + top4 * s.top4Bonus;
  return { points, correct, top4, hasResult: ar.R16.length > 0 || ar.CHAMP.length > 0 };
}

// --- Ranking combinado ------------------------------------------------------
export function ranking() {
  const hasPredictions = (u) =>
    Object.keys(db.predictions[u.username]?.group?.picks || {}).length > 0 ||
    Object.keys(db.predictions[u.username]?.bracket?.picks || {}).length > 0;
  const rows = Object.values(db.users)
    // El admin solo aparece si además juega (tiene predicciones).
    .filter(u => !u.isAdmin || hasPredictions(u))
    .map(u => {
      const g = userGroupTotals(u.username);
      const b = userBracketTotals(u.username);
      return {
        username: u.username, name: u.name, isAdmin: !!u.isAdmin,
        group: g, bracket: b,
        total: g.combined + b.points,
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
