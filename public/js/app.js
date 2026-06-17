// ============================================================================
//  Quiniela Mundial 2026 — Frontend (SPA, sin dependencias)
// ============================================================================
(function () {
  const $app = () => document.getElementById('app');
  const APP_BASE = (() => {
    const src = document.currentScript?.getAttribute('src') || 'js/app.js';
    const url = new URL(src, window.location.href);
    return url.pathname.replace(/\/js\/app\.js$/, '');
  })();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (iso) => new Date(iso).toLocaleString('es-ES',
    { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-ES',
    { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const euro = (n) => `${Number(n || 0).toLocaleString('es-ES')} €`;

  let STATE = null, ME = null;
  const ui = { tab: 'ranking', notice: null, bracketPicks: null, groupDraft: {}, adminUsers: null, testPhases: null, mvpPick: null, finalChamp: null, finalScore: {} };

  async function api(path, opts = {}) {
    const r = await fetch(APP_BASE + '/api' + path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
    let data = {}; try { data = await r.json(); } catch {}
    if (!r.ok) throw new Error(data.error || ('Error ' + r.status));
    return data;
  }
  const setNotice = (msg, type = 'info') => { ui.notice = { msg, type }; };

  async function boot() {
    try { const { me } = await api('/me'); ME = me; await loadState(); }
    catch { renderLogin(); }
  }
  async function loadState() { STATE = await api('/state'); ME = STATE.me; render(); }

  // ----------------------------------------------------------- Login -------
  function renderLogin() {
    const n = ui.notice ? `<div class="notice ${ui.notice.type}" role="alert">${esc(ui.notice.msg)}</div>` : '';
    $app().innerHTML = `
      <div class="auth-wrap">
        <div class="brand"><img class="wc26-logo" src="${APP_BASE}/img/world-cup-26.png" alt="FIFA World Cup 26"><h1>Quiniela Mundial 2026</h1>
          <p class="tagline">Clasificación · Grupos · Llave eliminatoria</p></div>
        <div class="card">${n}
          <form id="login-form" autocomplete="off">
            <label>Usuario<input name="username" required></label>
            <label>Contraseña<input name="password" type="password" required></label>
            <button class="btn primary block" type="submit">Entrar</button>
          </form>
          <p class="hint">Las cuentas las crea el administrador. Si no tienes, pídesela.</p>
        </div>
      </div>`;
    ui.notice = null;
  }

  // ------------------------------------------------------- App shell -------
  function render() {
    const s = STATE;
    const nav = [['ranking', '🏆 Clasificación'], ['grupos', '📝 Grupos']];
    if (ME.isAdmin || s.bracket.open || s.bracket.submitted) nav.push(['llave', '🗝️ Llave']);
    if (ME.isAdmin || (s.final.teams && (s.final.open || s.final.submitted))) nav.push(['final', '🏆 Final']);
    if (ME.isAdmin || s.mvp.open || s.mvp.submitted) nav.push(['mvp', '⭐ Bota de Oro']);
    nav.push(['cuenta', '👤 Cuenta']);
    if (ME.isAdmin) nav.push(['admin', '⚙️ Admin']);
    if (!nav.some(([k]) => k === ui.tab)) ui.tab = 'ranking';
    const navHtml = nav.map(([k, l]) => `<button class="nav-btn ${ui.tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${l}</button>`).join('');
    let content = '';
    if (ui.tab === 'ranking') content = renderRanking();
    else if (ui.tab === 'grupos') content = renderGroups();
    else if (ui.tab === 'llave') content = renderBracket();
    else if (ui.tab === 'final') content = renderFinal();
    else if (ui.tab === 'mvp') content = renderMvp();
    else if (ui.tab === 'cuenta') content = renderAccount();
    else if (ui.tab === 'admin') content = renderAdmin();
    const src = s.source === 'datos-de-ejemplo' ? '🟡 Datos de ejemplo' : '🟢 ' + esc(s.source);
    const clock = (s.simulated ? '🕒 (simulado) ' : '🕒 ') + fmt(s.now);
    $app().innerHTML = `
      <header class="topbar">
        <div class="topbar-left"><span class="logo">⚽ Quiniela Mundial 2026</span>
          <span class="source">${src} · ${clock}</span></div>
        <div class="topbar-right">
          <span class="user-chip">👤 ${esc(ME.name)}${ME.isAdmin ? ' · admin' : ''}</span>
          <button class="btn ghost sm" data-action="logout">Salir</button>
        </div>
      </header>
      <nav class="mainnav">${navHtml}</nav>
      <main class="content">${ui.notice ? `<div class="notice ${ui.notice.type}" role="alert">${esc(ui.notice.msg)}</div>` : ''}${content}</main>`;
    ui.notice = null;
  }

  // -------------------------------------------------------- Ranking --------
  function renderRanking() {
    const rows = STATE.ranking;
    const head = `<div class="section-head"><h2>🏆 Clasificación</h2><p>Total = grupos + llave + final + Bota de Oro.</p></div>`;
    const p = STATE.prize || {};
    const prize = `<div class="notice info">Premios: <b>${euro(p.pot)}</b> (${p.players || 0} jugadores × ${euro(p.perPlayer)}). Reparto: <b>${euro(p.first)}</b> para el 1.º y <b>${euro(p.second)}</b> para el 2.º. La clasificación finaliza el <b>${fmtDate(p.closeAt || '2026-07-20T12:00:00Z')}</b>.</div>`;
    if (!rows.length) return head + prize + `<div class="empty">Aún no hay jugadores con datos.</div>`;
    const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r;
    return head + prize + `
      <table class="ranking"><thead><tr><th>#</th><th>Jugador</th><th>Total</th><th>Grupos</th><th>Llave</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.username === ME.username ? 'me' : ''}">
        <td class="rank">${medal(r.rank)}</td>
        <td>${esc(r.name)}${r.username === ME.username ? ' <span class="youtag">tú</span>' : ''}
          <div class="sub">grupos ${r.group.combined} pts (${r.group.exactHits} exactos, ${r.group.winnerHits || 0} ganador/empate) · llave ${r.bracket.points} pts (${r.bracket.correct} cruces, ${r.bracket.top4} top4) · final ${r.final.points} pts · Bota de Oro ${r.mvp.points} pts${r.mvp.hit ? ' ⭐' : ''}</div></td>
        <td class="pts-cell">${r.total}</td><td>${r.group.combined}</td><td>${r.bracket.points}</td></tr>`).join('')}
      </tbody></table>`;
  }

  // --------------------------------------------------------- Grupos --------
  function flagImg(url, cls = 'flag') { return url ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy">` : ''; }
  function teamCell(team, side) {
    const name = team.code ? team.name : (team.label || '—');
    const flag = flagImg(team.flag);
    const info = `<div class="tinfo"><span class="tname">${esc(name)}</span><span class="tcode">${esc(team.code || '')}</span></div>`;
    return side === 'home'
      ? `<div class="team home">${info}${flag}</div>`
      : `<div class="team away">${flag}${info}</div>`;
  }
  function byGroup(matches) {
    const g = {}; matches.forEach(m => { (g[m.group || '?'] = g[m.group || '?'] || []).push(m); }); return g;
  }
  function renderStandings(st) {
    const keys = Object.keys(st || {});
    if (!keys.length) return '';
    return `<h3 class="group-title" style="margin-top:1.2rem">Clasificación de grupos (según resultados)</h3>
      <div class="standings-grid">${keys.map(g => `
        <div class="card"><b>Grupo ${esc(g)}</b>
          <table class="standings"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>Pts</th><th>DG</th></tr></thead><tbody>
          ${st[g].map((r, i) => `<tr><td>${i + 1}</td><td>${flagImg(r.team.flag, 'flag flag-sm')} ${esc(r.team.name)}</td><td>${r.pj}</td><td><b>${r.pts}</b></td><td>${r.gf - r.ga}</td></tr>`).join('')}
          </tbody></table></div>`).join('')}</div>`;
  }
  function groupRowReadOnly(m) {
    let mid, foot;
    if (m.score) { mid = `<span class="goals">${m.score.home}</span><span class="dash">-</span><span class="goals">${m.score.away}</span>`; }
    else { mid = `<span class="goals muted">·</span><span class="dash">-</span><span class="goals muted">·</span>`; }
    if (m.yourPred) {
      foot = `<span>J${m.matchday} · ${fmt(m.utcDate)}</span><span>Tu pronóstico: ${m.yourPred.home}-${m.yourPred.away}`;
      if (m.points && m.points.hasResult) {
        foot += ` · <span class="pts ${m.points.exactHit ? 'hit' : ''}">Exacto +${m.points.exact}</span>`;
        if (!m.points.exactHit) foot += `<span class="pts ${m.points.signHit ? 'hit' : ''}">Ganador/empate +${m.points.winner || 0}</span>`;
        if (m.points.sign > 0) foot += `<span class="pts ${m.points.signHit ? 'hit' : ''}">1X2 extra +${m.points.sign}</span>`;
      }
      foot += `</span>`;
    } else {
      foot = `<span>J${m.matchday} · ${fmt(m.utcDate)}</span><span class="sub">${m.score ? 'no incluido' : 'pendiente'}</span>`;
    }
    return `<div class="match">${teamCell(m.home, 'home')}<div class="match-center"><div class="score-area">${mid}</div></div>${teamCell(m.away, 'away')}<div class="match-foot">${foot}</div></div>`;
  }
  function groupRowForm(m) {
    const d = ui.groupDraft[m.id] || {};
    return `<div class="match" data-match-row>${teamCell(m.home, 'home')}
      <div class="match-center"><div class="score-area">
        <input class="score-input" type="number" min="0" max="99" inputmode="numeric" data-match="${m.id}" data-side="home" value="${d.home ?? ''}" aria-label="Goles ${esc(m.home.name)}">
        <span class="dash">-</span>
        <input class="score-input" type="number" min="0" max="99" inputmode="numeric" data-match="${m.id}" data-side="away" value="${d.away ?? ''}" aria-label="Goles ${esc(m.away.name)}">
      </div></div>${teamCell(m.away, 'away')}
      <div class="match-foot"><span>J${m.matchday} · ${fmt(m.utcDate)}</span></div></div>`;
  }
  function renderGroups() {
    const g = STATE.group;
    const head = `<div class="section-head"><h2>📝 Fase de grupos</h2><p>Predice el marcador de cada partido. Se envía <b>todo a la vez y una sola vez</b>.</p></div>`;
    const extra = STATE.rules.group.sign > 0 ? `, y <b>${STATE.rules.group.sign} pt</b> extra por el 1X2` : '';
    const rules = `<div class="notice info">Reglas: <b>${STATE.rules.group.exactScore} pts</b> por marcador exacto y <b>${STATE.rules.group.signPartial} pts</b> por acertar solo el ganador/empate${extra}. Ejemplo: si el partido acaba 2-1, poner 2-1 da ${STATE.rules.group.exactScore} pts, poner 1-0 da ${STATE.rules.group.signPartial} pts y poner 0-1 da 0 pts.</div>`;
    const standings = renderStandings(g.standings);

    if (g.submitted) {
      const blocks = Object.entries(byGroup(g.matches)).sort().map(([k, ms]) =>
        `<div class="group-block"><h3 class="group-title">Grupo ${esc(k)}</h3>${ms.map(groupRowReadOnly).join('')}</div>`).join('');
      return head + `<div class="notice ok">✓ Enviaste tus predicciones el ${fmt(g.submittedAt)}. No se pueden cambiar.</div>` + standings + blocks;
    }
    if (g.open) {
      const up = new Set(g.upcomingIds);
      const formMatches = g.matches.filter(m => up.has(m.id));
      const blocks = Object.entries(byGroup(formMatches)).sort().map(([k, ms]) =>
        `<div class="group-block"><h3 class="group-title">Grupo ${esc(k)}</h3>${ms.map(groupRowForm).join('')}</div>`).join('');
      return head + rules +
        `<div class="notice warn">⚠️ Una vez envíes, <b>no podrás cambiarlo</b>. Rellena todos los partidos.</div>
         <form id="group-form">${blocks}
           <div class="sticky-submit"><span class="sub">${formMatches.length} partidos por pronosticar</span>
             <button class="btn primary" type="submit">Enviar predicciones (definitivo)</button></div>
         </form>` + standings;
    }
    return head + `<div class="empty">No hay partidos de grupos disponibles para predecir ahora mismo.</div>` + standings;
  }

  // ---------------------------------------------------------- Llave --------
  const teamObj = (t) => (t && t.code) ? { name: t.name, code: t.code, flag: t.flag || null } : (t && t.label ? { label: t.label, code: null } : null);
  function computeCandidates(tree, picks) {
    const cand = {};
    tree.r32.forEach(n => { cand[n.id] = { a: teamObj(n.teams.a), b: teamObj(n.teams.b) }; });
    const winner = (id) => { const c = cand[id]; const code = picks[id]; if (!code || !c) return null; if (c.a && c.a.code === code) return c.a; if (c.b && c.b.code === code) return c.b; return null; };
    [tree.r16, tree.qf, tree.sf, [tree.final]].forEach(nodes => nodes.forEach(n => { cand[n.id] = { a: winner(n.childA), b: winner(n.childB) }; }));
    return cand;
  }
  function prunePicks(tree, picks) {
    let changed = true;
    while (changed) {
      changed = false;
      const cand = computeCandidates(tree, picks);
      [...tree.r16, ...tree.qf, ...tree.sf, tree.final].forEach(n => {
        const c = cand[n.id], code = picks[n.id];
        const valid = [c.a && c.a.code, c.b && c.b.code].filter(Boolean);
        if (code && !valid.includes(code)) { delete picks[n.id]; changed = true; }
      });
    }
  }
  function slotHtml(node, which, team, picks, interactive, actualSet) {
    const code = team && team.code;
    const picked = code && picks[node.id] === code;
    const cls = ['slot'];
    if (picked) cls.push('pick');
    if (!code) cls.push('label');
    if (actualSet && code && actualSet.has(code)) cls.push(picked ? 'correct' : 'real-adv');
    const clickAttr = (interactive && code) ? ` data-action="pick" data-node="${node.id}" data-code="${esc(code)}"` : '';
    const name = team ? (code ? team.name : (team.label || '—')) : '—';
    const flag = team && team.flag ? flagImg(team.flag, 'flag flag-sm') : '';
    return `<div class="${cls.join(' ')}"${clickAttr}>${flag}<span class="scode">${esc(code || '')}</span><span class="sname">${esc(name)}</span></div>`;
  }
  function renderBracketGrid(interactive) {
    const b = STATE.bracket, tree = b.tree;
    const picks = interactive ? ui.bracketPicks : b.yourPicks;
    const cand = computeCandidates(tree, picks || {});
    // Conjuntos reales que avanzaron (para resaltar aciertos cuando ya está enviado).
    const ar = b.actualReached || {};
    const setFor = { R32: new Set(ar.R16 || []), R16: new Set(ar.QF || []), QF: new Set(ar.SF || []), SF: new Set(ar.FINAL || []), FINAL: new Set(ar.CHAMP || []) };
    const cols = [
      { head: '1/16', nodes: tree.r32, round: 'R32' },
      { head: 'Octavos', nodes: tree.r16, round: 'R16' },
      { head: 'Cuartos', nodes: tree.qf, round: 'QF' },
      { head: 'Semis', nodes: tree.sf, round: 'SF' },
      { head: 'Final', nodes: [tree.final], round: 'FINAL' },
    ];
    const showActual = b.submitted;
    const colHtml = cols.map(col => `
      <div class="round"><div class="round-head">${col.head}</div>
        ${col.nodes.map(n => {
          const c = cand[n.id];
          return `<div class="tie ${interactive ? 'clickable' : ''} ${col.round === 'FINAL' ? 'final-tie' : ''}">
            ${slotHtml(n, 'a', c.a, picks || {}, interactive, showActual ? setFor[col.round] : null)}
            ${slotHtml(n, 'b', c.b, picks || {}, interactive, showActual ? setFor[col.round] : null)}
          </div>`;
        }).join('')}
      </div>`).join('');
    const champCode = (picks || {})[tree.final.id];
    const champTeam = cand[tree.final.id] && [cand[tree.final.id].a, cand[tree.final.id].b].find(t => t && t.code === champCode);
    const champ = champTeam ? `<div class="champ-box"><span class="champ">🏆 Tu campeón: ${esc(champTeam.name)}</span></div>` : '';
    return `<div class="bracket-scroll"><div class="bracket">${colHtml}</div></div>${champ}`;
  }
  function rulesBracket() {
    return `<div class="notice info">Reglas de la llave: <b>${STATE.rules.bracket.perWinner} pts</b> por cada cruce acertado y <b>+${STATE.rules.bracket.top4Bonus} pts</b> por cada semifinalista acertado. Ejemplo: eliges a España en un cruce y avanza, +${STATE.rules.bracket.perWinner}; si además la metiste entre los 4 semifinalistas reales, +${STATE.rules.bracket.top4Bonus} extra.</div>`;
  }
  function renderBracket() {
    const b = STATE.bracket;
    const head = `<div class="section-head"><h2>🗝️ Llave eliminatoria</h2><p>Elige quién avanza en cada cruce hasta el campeón. Se envía <b>una sola vez</b>.</p></div>`;
    if (b.submitted) {
      return head + `<div class="notice ok">✓ Enviaste tu llave el ${fmt(b.submittedAt)}. No se puede cambiar.</div>` + rulesBracket() + renderBracketGrid(false);
    }
    if (!b.window.open) {
      const why = b.window.passedDeadline ? 'La llave ya está cerrada.' : 'La llave se abrirá cuando terminen los grupos y se conozcan los 32 equipos.';
      return head + `<div class="notice info">${why} Vista previa del cuadro:</div>` + renderBracketGrid(false);
    }
    if (!ui.bracketPicks) ui.bracketPicks = { ...(b.yourPicks || {}) };
    const total = b.tree.r32.length + b.tree.r16.length + b.tree.qf.length + b.tree.sf.length + 1;
    const done = Object.keys(ui.bracketPicks).filter(k => ui.bracketPicks[k]).length;
    const complete = done >= total;
    return head + rulesBracket() +
      `<div class="notice warn">⚠️ Una vez envíes, <b>no podrás cambiarlo</b>. Haz clic en el equipo que avanza en cada cruce.</div>` +
      renderBracketGrid(true) +
      `<div class="sticky-submit"><span class="sub">${done}/${total} cruces elegidos</span>
        <button class="btn primary" data-action="bracket-submit" ${complete ? '' : 'disabled'}>Enviar llave (definitivo)</button></div>`;
  }

  // ---------------------------------------------------------- Final --------
  function finalCard(A, B, f) {
    const ps = f.your && f.your.score;
    const mid = ps
      ? `<span class="goals">${ps.home}</span><span class="dash">-</span><span class="goals">${ps.away}</span>`
      : `<span class="goals muted">·</span><span class="dash">-</span><span class="goals muted">·</span>`;
    return `<div class="card"><div class="final-row">${teamCell(A, 'home')}<div class="match-center"><div class="score-area">${mid}</div></div>${teamCell(B, 'away')}</div></div>`;
  }
  function finalScoreReady(fs) {
    return fs.home !== '' && fs.home != null && fs.away !== '' && fs.away != null;
  }
  function finalScoreDraw(fs) {
    return finalScoreReady(fs) && Number(fs.home) === Number(fs.away);
  }
  function finalChampionFromScore(A, B, fs) {
    if (!finalScoreReady(fs) || finalScoreDraw(fs)) return null;
    return Number(fs.home) > Number(fs.away) ? A : B;
  }
  function syncFinalForm() {
    const f = STATE && STATE.final;
    if (!f || !f.teams || ui.tab !== 'final') return;
    const A = f.teams.home, B = f.teams.away, fs = ui.finalScore || {};
    const readyScore = finalScoreReady(fs);
    const isDraw = finalScoreDraw(fs);
    const implied = finalChampionFromScore(A, B, fs);
    const ready = readyScore && (!isDraw || !!ui.finalChamp);
    const champWrap = document.querySelector('[data-final-champ-wrap]');
    const impliedBox = document.querySelector('[data-final-implied]');
    const status = document.querySelector('[data-final-status]');
    const btn = document.querySelector('[data-action="final-submit"]');
    document.querySelectorAll('[data-action="final-champ"]').forEach(x => x.classList.toggle('sel', ui.finalChamp === x.dataset.code));
    if (champWrap) champWrap.style.display = isDraw ? '' : 'none';
    if (impliedBox) {
      impliedBox.style.display = implied ? '' : 'none';
      impliedBox.textContent = implied ? `Campeón según tu marcador: ${implied.name}` : '';
    }
    if (status) status.textContent = ready ? 'listo para enviar' : (isDraw ? 'elige campeón' : 'pon el marcador');
    if (btn) btn.disabled = !ready;
  }
  function finalForm(A, B) {
    const champ = ui.finalChamp, fs = ui.finalScore || {};
    const teamBtn = (T) => `<button class="champ-btn ${champ === T.code ? 'sel' : ''}" data-action="final-champ" data-code="${esc(T.code)}">${flagImg(T.flag)}<span>${esc(T.name)}</span></button>`;
    const isDraw = finalScoreDraw(fs);
    const implied = finalChampionFromScore(A, B, fs);
    const ready = finalScoreReady(fs) && (!isDraw || !!champ);
    return `
      <div class="card">
        <div class="final-row">
          ${teamCell(A, 'home')}
          <div class="match-center"><div class="score-area">
            <input class="score-input" type="number" min="0" max="99" inputmode="numeric" data-final-side="home" value="${fs.home ?? ''}">
            <span class="dash">-</span>
            <input class="score-input" type="number" min="0" max="99" inputmode="numeric" data-final-side="away" value="${fs.away ?? ''}">
          </div></div>
          ${teamCell(B, 'away')}
        </div>
        <p class="sub" data-final-implied style="text-align:center;margin:.8rem 0 .3rem;${implied ? '' : 'display:none'}">${implied ? `Campeón según tu marcador: ${esc(implied.name)}` : ''}</p>
        <div data-final-champ-wrap style="${isDraw ? '' : 'display:none'}">
          <p class="sub" style="text-align:center;margin:.8rem 0 .3rem">Si pronosticas empate, elige quién levanta la copa en prórroga/penaltis.</p>
          <div class="champ-pick">${teamBtn(A)}${teamBtn(B)}</div>
        </div>
      </div>
      <div class="sticky-submit"><span class="sub" data-final-status>${ready ? 'listo para enviar' : (isDraw ? 'elige campeón' : 'pon el marcador')}</span>
        <button class="btn primary" data-action="final-submit" ${ready ? '' : 'disabled'}>Enviar apuesta de la final (definitivo)</button></div>`;
  }
  function renderFinal() {
    const f = STATE.final;
    const head = `<div class="section-head"><h2>🏆 La Final</h2><p>Apuesta el <b>marcador exacto</b>. El campeón se deduce del marcador; si pronosticas empate, eliges quién levanta la copa. Se envía una sola vez.</p></div>`;
    if (!f.teams) return head + `<div class="empty">Se abrirá cuando se conozcan los dos finalistas (tras las semifinales).</div>`;
    const A = f.teams.home, B = f.teams.away;
    const champName = (code) => code === A.code ? A.name : (code === B.code ? B.name : '—');
    const rules = `<div class="notice info">Reglas: <b>${f.rules.exactScore} pts</b> por marcador exacto y <b>+${f.rules.championBonus} pts</b> por acertar el campeón. Ejemplo: pones 2-1 y queda 1-0, no hay exacto, pero si gana el equipo que pusiste como ganador sumas ${f.rules.championBonus} pts. Si pones empate, eliges quién levanta la copa.</div>`;
    if (f.submitted) {
      let res = '';
      if (f.actual) {
        const ps = f.your.score, as = f.actual.score;
        const exact = ps.home === as.home && ps.away === as.away;
        const champHit = f.your.champion && f.actual.winner && f.your.champion === f.actual.winner;
        res = `<div class="notice ${exact || champHit ? 'ok' : 'warn'}">Final real: ${as.home}-${as.away}, campeón ${esc(champName(f.actual.winner))}. ${exact ? '✓ marcador exacto' : '✗ marcador exacto'}${champHit ? ' · ✓ campeón' : ''}</div>`;
      }
      return head + `<div class="notice ok">Tu apuesta: <b>${esc(A.name)} ${f.your.score.home}-${f.your.score.away} ${esc(B.name)}</b> · campeón: <b>${esc(champName(f.your.champion))}</b> (enviada ${fmt(f.submittedAt)}).</div>` + res + finalCard(A, B, f);
    }
    if (!f.open) return head + `<div class="notice info">La apuesta de la final está cerrada.</div>` + finalCard(A, B, f);
    return head + rules + `<div class="notice warn">⚠️ Una sola vez. Pon el marcador; solo tendrás que elegir campeón si marcas empate.</div>` + finalForm(A, B);
  }

  // ----------------------------------------------------- Bota de Oro -------
  function mvpGrid(m, selected) {
    return `<div class="mvp-grid">${m.candidates.map(p => {
      const sel = selected === p.id || (m.submitted && m.yourPick === p.id);
      const flag = flagImg(p.flag, 'flag flag-lg');
      const click = (m.open && !m.submitted) ? ` data-action="mvp-pick" data-player="${esc(p.id)}"` : '';
      const star = m.actual === p.id ? ' ⭐' : '';
      const goals = p.goals != null ? ` · ${p.goals} goles` : '';
      return `<div class="mvp-card ${sel ? 'sel' : ''}"${click}>${flag}<div><div class="mvp-name">${esc(p.name)}${star}</div><div class="sub">${esc(p.team)}${goals}</div></div></div>`;
    }).join('')}</div>`;
  }
  function renderMvp() {
    const m = STATE.mvp;
    const source = m.candidatesSource === 'api-scorers'
      ? 'Candidatos congelados desde football-data.org al abrirse la llave.'
      : (m.candidatesSource === 'test' ? 'Candidatos ficticios del modo pruebas.' : 'Candidatos manuales de respaldo.');
    const head = `<div class="section-head"><h2>⭐ Bota de Oro</h2><p>Apuesta por el goleador del torneo entre los 20 mejores goleadores de la fase de grupos. Se envía <b>una sola vez</b>.</p></div>`;
    const rules = `<div class="notice info">Reglas: <b>${m.points} pts</b> si aciertas el goleador del torneo. ${source} Ejemplo: eliges a un goleador de la lista y termina ganando la Bota de Oro, sumas ${m.points} pts; si gana otro jugador, sumas 0.</div>`;
    if (m.submitted) {
      const pick = m.candidates.find(p => p.id === m.yourPick);
      let res = '';
      if (m.actual) res = (m.actual === m.yourPick)
        ? `<div class="notice ok">✓ ¡Acertaste la Bota de Oro! +${m.points} pts</div>`
        : `<div class="notice warn">Esta vez no acertaste la Bota de Oro.</div>`;
      return head + rules + `<div class="notice ok">Tu apuesta: <b>${esc(pick ? pick.name : '—')}</b> (enviada ${fmt(m.submittedAt)}). No se puede cambiar.</div>` + res + mvpGrid(m, null);
    }
    if (!m.open) {
      const why = (m.window && m.window.passedDeadline) ? 'La apuesta de Bota de Oro ya está cerrada.' : 'Se abrirá en la fase eliminatoria (cuando terminen los grupos).';
      return head + rules + `<div class="notice info">${why} Estos son los candidatos previstos:</div>` + mvpGrid(m, null);
    }
    return head + rules
      + `<div class="notice warn">⚠️ Una sola vez. Elige un jugador y envía.</div>`
      + mvpGrid(m, ui.mvpPick)
      + `<div class="sticky-submit"><span class="sub">${ui.mvpPick ? '1 jugador elegido' : 'elige un jugador'}</span>
         <button class="btn primary" data-action="mvp-submit" ${ui.mvpPick ? '' : 'disabled'}>Enviar Bota de Oro (definitivo)</button></div>`;
  }

  // --------------------------------------------------------- Cuenta --------
  function renderAccount() {
    return `<div class="section-head"><h2>👤 Mi cuenta</h2><p>Usuario: <b>${esc(ME.username)}</b>. Puedes cambiar tu nombre visible y tu contraseña.</p></div>
      <div class="card" style="max-width:420px;margin-bottom:1rem">
        <form id="account-name-form" autocomplete="off">
          <label>Nombre a mostrar<input name="name" required minlength="2" maxlength="40" value="${esc(ME.name)}"></label>
          <button class="btn primary block" type="submit">Guardar nombre</button>
        </form>
      </div>
      <div class="card" style="max-width:420px">
        <form id="account-form" autocomplete="off">
          <label>Contraseña actual<input name="current" type="password" required></label>
          <label>Nueva contraseña<input name="new" type="password" required minlength="4"></label>
          <label>Repite la nueva<input name="confirm" type="password" required minlength="4"></label>
          <button class="btn primary block" type="submit">Cambiar contraseña</button>
        </form>
      </div>`;
  }

  // ---------------------------------------------------------- Admin --------
  function renderAdmin() {
    const users = ui.adminUsers || [];
    const test = ui.testPhases || { phases: [], active: null };
    const rows = users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${u.isAdmin ? '👑' : ''}</td>
      <td class="row-actions">
        <button class="btn sm" data-action="admin-reset" data-user="${esc(u.username)}">Reset clave</button>
        ${u.isAdmin ? '' : `<button class="btn sm danger" data-action="admin-delete" data-user="${esc(u.username)}">Borrar</button>`}
      </td></tr>`).join('');
    const phaseButtons = test.phases.map(p =>
      `<button class="btn sm ${test.active && test.active.id === p.id ? 'primary' : ''}" data-action="admin-test-phase" data-phase="${esc(p.id)}" title="${esc(p.description)}">${esc(p.name)}</button>`
    ).join('');
    return `<div class="section-head"><h2>⚙️ Administración</h2><p>Crea cuentas para tus amigos y gestiona resultados.</p></div>
      <div class="grid2">
        <div class="card"><h3 class="group-title">Crear usuario</h3>
          <form id="admin-create-form" autocomplete="off">
            <label>Usuario (sin espacios)<input name="username" required></label>
            <label>Nombre a mostrar<input name="name"></label>
            <label>Contraseña inicial<input name="password" required minlength="4"></label>
            <button class="btn primary block" type="submit">Crear cuenta</button>
          </form>
        </div>
        <div class="card"><h3 class="group-title">Resultados (football-data.org)</h3>
          <p class="sub">Descarga partidos y resultados reales. La llave se rellenará al terminar los grupos.</p>
          <button class="btn" data-action="admin-refresh">↻ Actualizar resultados ahora</button>
        </div>
        <div class="card"><h3 class="group-title">Modo pruebas</h3>
          <p class="sub">Activa datos ficticios para validar fases sin cambiar predicciones. Estado: <b>${esc(test.active ? test.active.name : 'inactivo')}</b>.</p>
          <div class="row-actions" style="flex-wrap:wrap">${phaseButtons || '<span class="sub">Cargando fases…</span>'}</div>
          <button class="btn sm danger" style="margin-top:.6rem" data-action="admin-test-clear">Volver a datos reales</button>
        </div>
      </div>
      <div class="card" style="margin-top:1rem"><h3 class="group-title">Usuarios</h3>
        <table class="user-list"><thead><tr><th>Nombre</th><th>Usuario</th><th></th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="sub">Cargando…</td></tr>'}</tbody></table>
      </div>`;
  }
  async function refreshAdmin() {
    try {
      const [{ users }, phases] = await Promise.all([api('/admin/users'), api('/admin/test-phases')]);
      ui.adminUsers = users;
      ui.testPhases = phases;
    }
    catch (e) { setNotice(e.message, 'err'); }
    render();
  }

  // --------------------------------------------------------- Eventos -------
  function collectGroupPicks() {
    const picks = {};
    document.querySelectorAll('#group-form [data-match-row]').forEach(row => {
      const h = row.querySelector('[data-side="home"]'), a = row.querySelector('[data-side="away"]');
      picks[h.dataset.match] = { home: h.value, away: a.value };
    });
    return picks;
  }

  function attach() {
    const root = $app();
    root.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) return;
      const a = t.dataset.action;
      if (a === 'tab') {
        ui.tab = t.dataset.tab;
        if (ui.tab === 'admin') { render(); refreshAdmin(); } else render();
      } else if (a === 'logout') {
        try { await api('/logout', { method: 'POST' }); } catch {}
        STATE = null; ME = null; ui.tab = 'ranking'; renderLogin();
      } else if (a === 'pick') {
        ui.bracketPicks = ui.bracketPicks || {};
        ui.bracketPicks[t.dataset.node] = t.dataset.code;
        prunePicks(STATE.bracket.tree, ui.bracketPicks);
        render();
      } else if (a === 'bracket-submit') {
        try { await api('/bracket', { method: 'POST', body: JSON.stringify({ picks: ui.bracketPicks }) }); ui.bracketPicks = null; setNotice('✓ Llave enviada.', 'ok'); await loadState(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'mvp-pick') {
        ui.mvpPick = t.dataset.player; render();
      } else if (a === 'mvp-submit') {
        try { await api('/mvp', { method: 'POST', body: JSON.stringify({ playerId: ui.mvpPick }) }); ui.mvpPick = null; setNotice('✓ Apuesta de Bota de Oro enviada.', 'ok'); await loadState(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'final-champ') {
        ui.finalChamp = t.dataset.code; render();
      } else if (a === 'final-submit') {
        try { await api('/final', { method: 'POST', body: JSON.stringify({ score: ui.finalScore, champion: ui.finalChamp }) }); ui.finalChamp = null; ui.finalScore = {}; setNotice('✓ Apuesta de la final enviada.', 'ok'); await loadState(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'admin-refresh') {
        try { const r = await api('/admin/refresh', { method: 'POST' }); setNotice(`✓ ${r.count} partidos (${r.finished} finalizados)${r.mvpCandidates ? ` · Bota de Oro ${r.mvpCandidates} candidatos` : ''}.`, 'ok'); await loadState(); ui.tab = 'admin'; render(); refreshAdmin(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'admin-test-phase') {
        try { const r = await api('/admin/test-phase', { method: 'POST', body: JSON.stringify({ phaseId: t.dataset.phase }) }); setNotice(`✓ Modo prueba activo: ${r.phase.name}.`, 'ok'); await loadState(); ui.tab = 'admin'; render(); refreshAdmin(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'admin-test-clear') {
        try { const r = await api('/admin/test-phase/clear', { method: 'POST' }); setNotice(r.restored === 'api' ? '✓ Datos reales restaurados desde la API.' : '✓ Modo prueba desactivado; usando datos de ejemplo.', 'ok'); await loadState(); ui.tab = 'admin'; render(); refreshAdmin(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'admin-reset') {
        const pw = prompt('Nueva contraseña para ' + t.dataset.user + ':');
        if (pw) { try { await api('/admin/reset', { method: 'POST', body: JSON.stringify({ username: t.dataset.user, password: pw }) }); setNotice('✓ Contraseña cambiada.', 'ok'); } catch (err) { setNotice(err.message, 'err'); } render(); refreshAdmin(); }
      } else if (a === 'admin-delete') {
        if (confirm('¿Borrar a ' + t.dataset.user + '?')) { try { await api('/admin/delete', { method: 'POST', body: JSON.stringify({ username: t.dataset.user }) }); setNotice('Usuario borrado.', 'ok'); } catch (err) { setNotice(err.message, 'err'); } render(); refreshAdmin(); }
      }
    });

    root.addEventListener('input', (e) => {
      const inp = e.target.closest('#group-form [data-match]');
      if (inp) {
        const id = inp.dataset.match;
        ui.groupDraft[id] = ui.groupDraft[id] || {};
        ui.groupDraft[id][inp.dataset.side] = inp.value;
        return;
      }
      const fin = e.target.closest('[data-final-side]');
      if (fin) {
        ui.finalScore = ui.finalScore || {};
        ui.finalScore[fin.dataset.finalSide] = fin.value;
        if (!finalScoreDraw(ui.finalScore)) ui.finalChamp = null;
        syncFinalForm();
      }
    });

    root.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.id === 'login-form') {
        const d = new FormData(f);
        try { const r = await api('/login', { method: 'POST', body: JSON.stringify({ username: d.get('username'), password: d.get('password') }) }); ME = r.me; ui.tab = 'ranking'; await loadState(); }
        catch (err) { setNotice(err.message, 'err'); renderLogin(); }
      } else if (f.id === 'group-form') {
        try { await api('/group', { method: 'POST', body: JSON.stringify({ picks: collectGroupPicks() }) }); ui.groupDraft = {}; setNotice('✓ Predicciones de grupos enviadas.', 'ok'); await loadState(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (f.id === 'account-form') {
        const d = new FormData(f);
        if (d.get('new') !== d.get('confirm')) { setNotice('Las contraseñas nuevas no coinciden.', 'err'); render(); return; }
        try { await api('/account/password', { method: 'POST', body: JSON.stringify({ current: d.get('current'), new: d.get('new') }) }); setNotice('✓ Contraseña cambiada.', 'ok'); render(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (f.id === 'account-name-form') {
        const d = new FormData(f);
        try { const r = await api('/account/name', { method: 'POST', body: JSON.stringify({ name: d.get('name') }) }); ME = r.me; if (STATE) STATE.me = r.me; setNotice('✓ Nombre actualizado.', 'ok'); render(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (f.id === 'admin-create-form') {
        const d = new FormData(f);
        try { await api('/admin/users', { method: 'POST', body: JSON.stringify({ username: d.get('username'), name: d.get('name'), password: d.get('password') }) }); setNotice('✓ Usuario creado.', 'ok'); render(); refreshAdmin(); }
        catch (err) { setNotice(err.message, 'err'); render(); refreshAdmin(); }
      }
    });
  }

  attach();
  boot();
})();
