// ============================================================================
//  Árbol de la llave: construcción, validación y propagación de ganadores
// ============================================================================
import { BRACKET } from '../config.mjs';

// Construye el árbol completo con las relaciones padre/hijo por índice.
export function buildTree() {
  const r32 = BRACKET.r32.map((x, i) => ({ id: x.id, round: 'R32', index: i, a: x.a, b: x.b, date: x.date, venue: x.venue }));
  const mk = (round, count, prefix) =>
    Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i + 1}`, round, index: i, childA: null, childB: null }));
  const r16 = mk('R16', 8, 'r16');
  const qf = mk('QF', 4, 'qf');
  const sf = mk('SF', 2, 'sf');
  const final = { id: 'final', round: 'FINAL', index: 0, childA: null, childB: null };

  r16.forEach((nd, j) => { nd.childA = r32[2 * j].id; nd.childB = r32[2 * j + 1].id; });
  qf.forEach((nd, k) => { nd.childA = r16[2 * k].id; nd.childB = r16[2 * k + 1].id; });
  sf.forEach((nd, l) => { nd.childA = qf[2 * l].id; nd.childB = qf[2 * l + 1].id; });
  final.childA = sf[0].id; final.childB = sf[1].id;

  return { r32, r16, qf, sf, final, rounds: ['R32', 'R16', 'QF', 'SF', 'FINAL'] };
}

// IDs de nodo por ronda.
export function roundNodeIds(tree) {
  return {
    R32: tree.r32.map(n => n.id),
    R16: tree.r16.map(n => n.id),
    QF: tree.qf.map(n => n.id),
    SF: tree.sf.map(n => n.id),
    FINAL: [tree.final.id],
  };
}

// Devuelve un mapa nodeId -> { a, b } con los códigos de equipo candidatos,
// dado el sembrado real de 1/16 (r32Teams: { nodeId: {a:{code,..}, b:{code,..}} })
// y los picks del usuario (para propagar a rondas superiores).
export function candidatesFor(tree, r32Teams, picks) {
  const cand = {};
  tree.r32.forEach(n => {
    const t = r32Teams[n.id];
    cand[n.id] = t ? { a: t.a || null, b: t.b || null } : { a: null, b: null };
  });
  const winnerOf = (nodeId) => {
    const code = picks[nodeId];
    if (!code) return null;
    const c = cand[nodeId];
    if (c && c.a && c.a.code === code) return c.a;
    if (c && c.b && c.b.code === code) return c.b;
    return null;
  };
  const fill = (nodes) => nodes.forEach(n => {
    cand[n.id] = { a: winnerOf(n.childA), b: winnerOf(n.childB) };
  });
  fill(tree.r16); fill(tree.qf); fill(tree.sf); fill([tree.final]);
  return cand;
}

// Valida que los picks sean coherentes con el cuadro (cada ganador elegido es
// uno de los dos candidatos reales de ese nodo). Devuelve {ok, error}.
export function validateBracket(tree, r32Teams, picks) {
  const cand = {};
  tree.r32.forEach(n => { cand[n.id] = r32Teams[n.id] || { a: null, b: null }; });
  const codeIn = (c) => [c?.a?.code, c?.b?.code].filter(Boolean);
  const winnerOf = (nodeId) => {
    const code = picks[nodeId];
    const c = cand[nodeId];
    if (!code) return null;
    if (!codeIn(c).includes(code)) return false; // pick inválido
    return code === c.a?.code ? c.a : c.b;
  };
  const order = [tree.r32, tree.r16, tree.qf, tree.sf, [tree.final]];
  for (const nodes of order) {
    for (const n of nodes) {
      if (n.childA) cand[n.id] = { a: winnerOf(n.childA), b: winnerOf(n.childB) };
      const c = cand[n.id];
      if (c.a === false || c.b === false) return { ok: false, error: `Selección incoherente en ${n.id}.` };
    }
  }
  return { ok: true };
}

// Conjuntos de equipos que el usuario hace AVANZAR a cada ronda (códigos).
// reachedR16 = ganadores de 1/16; reachedQF = ganadores de octavos; etc.
export function userReached(tree, picks) {
  const codes = (ids) => ids.map(id => picks[id]).filter(Boolean);
  return {
    R16: codes(tree.r32.map(n => n.id)),   // avanzan de 1/16
    QF: codes(tree.r16.map(n => n.id)),    // avanzan de octavos
    SF: codes(tree.qf.map(n => n.id)),     // semifinalistas (top 4)
    FINAL: codes(tree.sf.map(n => n.id)),  // finalistas
    CHAMP: picks[tree.final.id] ? [picks[tree.final.id]] : [],
  };
}
