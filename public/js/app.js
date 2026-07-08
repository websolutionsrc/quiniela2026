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
  const rankBadge = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : (rank ? `#${rank}` : '');
  const euro = (n) => `${Number(n || 0).toLocaleString('es-ES')} €`;
  const bettingDeadlineText = (iso) => {
    if (!iso) return 'hasta el inicio del primer partido de 1/16';
    const d = new Date(iso);
    const now = STATE?.now ? new Date(STATE.now) : new Date();
    const dateKey = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
    const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    if (dateKey(now) === dateKey(d)) {
      const weekday = d.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'Europe/Madrid' });
      return `hasta hoy ${weekday} a las ${time}`;
    }
    const day = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
    return `hasta el ${day} a las ${time}`;
  };

  let STATE = null, ME = null;
  const ui = { tab: 'ranking', notice: null, bracketPicks: null, bracketView: 'tree', recoveryEdit: null, recoveryConfirm: null, groupDraft: {}, adminUsers: null, testPhases: null, mvpPick: null, finalChamp: null, finalScore: {}, playerProfile: null, playerTreeOpen: false, branchDetailNode: null };

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
  function tabActionCount(tab) {
    return (STATE.actions || []).filter(a => a.tab === tab && (a.level === 'warn' || a.badge)).length;
  }
  function renderActionAlerts() {
    const actions = STATE.actions || [];
    if (!actions.length) return '';
    return `<div class="action-alerts">${actions.map(a =>
      `<button class="action-alert ${esc(a.level || 'info')}" data-action="tab" data-tab="${esc(a.tab)}">
        <b>${esc(a.label)}</b><span>${esc(a.text)}</span>
      </button>`).join('')}</div>`;
  }
  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      const box = document.querySelector('.chat-box');
      if (box) box.scrollTop = box.scrollHeight;
    });
  }
  function render() {
    const s = STATE;
    const nav = [['ranking', '🏆 Clasificación'], ['grupos', '📝 Grupos']];
    if (ME.isAdmin || s.bracket.visible || s.bracket.open || s.bracket.submitted) nav.push(['llave', '🗝️ Llave']);
    if (ME.isAdmin || s.final.visible || (s.final.teams && (s.final.open || s.final.submitted))) nav.push(['final', '🏆 Final']);
    if (ME.isAdmin || s.mvp.visible || s.mvp.open || s.mvp.submitted) nav.push(['mvp', '⭐ Bota de Oro']);
    nav.push(['cuenta', '👤 Cuenta']);
    if (ME.isAdmin) nav.push(['admin', '⚙️ Admin']);
    if (!nav.some(([k]) => k === ui.tab) && ui.tab !== 'player') ui.tab = 'ranking';
    const navHtml = nav.map(([k, l]) => {
      const count = tabActionCount(k);
      return `<button class="nav-btn ${ui.tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${l}${count ? `<span class="nav-badge">${count}</span>` : ''}</button>`;
    }).join('');
    let content = '';
    if (ui.tab === 'ranking') content = renderRanking();
    else if (ui.tab === 'player') content = renderPlayerPredictions();
    else if (ui.tab === 'grupos') content = renderGroups();
    else if (ui.tab === 'llave') content = renderBracket();
    else if (ui.tab === 'final') content = renderFinal();
    else if (ui.tab === 'mvp') content = renderMvp();
    else if (ui.tab === 'cuenta') content = renderAccount();
    else if (ui.tab === 'admin') content = renderAdmin();
    const src = s.source === 'datos-de-ejemplo' ? '🟡 Datos de ejemplo' : '🟢 ' + esc(s.source);
    const clock = (s.simulated ? '🕒 (simulado) ' : '🕒 ') + fmt(s.now);
    const viewedUser = ui.tab === 'player' && ui.playerProfile?.user;
    const viewedRank = ui.tab === 'player' ? ui.playerProfile?.totals?.rank : null;
    const viewedBadge = rankBadge(viewedRank);
    const myRank = s.ranking?.find(r => r.username === ME.username)?.rank;
    const myBadge = rankBadge(myRank);
    const userChip = viewedUser
      ? `<button class="btn ghost sm player-top-back" data-action="player-back">← Volver</button><span>${viewedBadge ? `<span class="rank-badge">${esc(viewedBadge)}</span>` : ''} Predicciones de ${esc(viewedUser.name)}</span>`
      : `${myBadge ? `<span class="rank-badge">${esc(myBadge)}</span>` : '👤'} ${esc(ME.name)}${ME.isAdmin ? ' · admin' : ''}`;
    $app().innerHTML = `
      <header class="topbar">
        <div class="topbar-left"><span class="logo">⚽ Quiniela Mundial 2026</span>
          <span class="source">${src} · ${clock}</span></div>
        <div class="topbar-right">
          <div class="user-chip ${viewedUser ? 'player-header-chip' : ''}">${userChip}</div>
          <button class="btn ghost sm" data-action="logout">Salir</button>
        </div>
      </header>
      <nav class="mainnav">${navHtml}</nav>
      <main class="content">${ui.notice ? `<div class="notice ${ui.notice.type}" role="alert">${esc(ui.notice.msg)}</div>` : ''}${renderActionAlerts()}${content}</main>`;
    ui.notice = null;
    scrollChatToBottom();
  }

  // -------------------------------------------------------- Ranking --------
  function renderRanking() {
    const rows = STATE.ranking;
    const head = `<div class="section-head"><h2>🏆 Clasificación</h2><p>Pincha en un jugador para ver su desglose y sus predicciones ya resueltas.</p></div>`;
    const p = STATE.prize || {};
    const prize = `<div class="notice info">Premios: <b>${euro(p.pot)}</b> (${p.players || 0} jugadores × ${euro(p.perPlayer)}). Reparto: <b>${euro(p.first)}</b> para el 1.º y <b>${euro(p.second)}</b> para el 2.º. La clasificación finaliza el <b>${fmtDate(p.closeAt || '2026-07-20T12:00:00Z')}</b>.</div>`;
    if (!rows.length) return head + prize + `<div class="empty">Aún no hay jugadores con datos.</div>`;
    const medal = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : r;
    return head + prize + `
      <table class="ranking"><thead><tr><th>#</th><th>Jugador</th><th>Total</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.username === ME.username ? 'me rank-row' : 'rank-row'}" data-action="rank-user" data-user="${esc(r.username)}" title="Ver partidos ya jugados de ${esc(r.name)}">
        <td class="rank">${medal(r.rank)}</td>
        <td><span class="rank-user-name">${esc(r.name)}</span>${r.username === ME.username ? ' <span class="youtag">tú</span>' : ''}</td>
        <td class="pts-cell">${r.total}</td></tr>`).join('')}
      </tbody></table>${renderSocialFeed()}`;
  }

  function renderSocialFeed() {
    const feed = STATE.feed || [];
    const chat = STATE.chat || [];
    const body = feed.length
      ? feed.map(e => `<div class="feed-msg ${esc(e.kind || '')}"><div>${esc(e.text)}</div><time>${fmt(e.at)}</time></div>`).join('')
      : `<div class="empty slim">Aun no hay eventos resueltos para mostrar.</div>`;
    const chatBody = chat.length
      ? chat.map(m => {
        const mine = m.username === ME.username;
        return `<div class="chat-msg ${mine ? 'mine' : ''}" style="--chat-color:${chatColor(m.username)}">
          <div class="chat-bubble"><b>${esc(m.name || m.username)}</b><span>${esc(m.text)}</span><time>${fmt(m.at)}</time></div>
        </div>`;
      }).join('')
      : `<div class="empty slim">Aun no hay comentarios. Puedes abrir el marcador.</div>`;
    return `<section class="social-feed"><h3>Feed de la quiniela</h3><p class="sub">Eventos automaticos y chat persistente de los participantes.</p>
      <div class="feed-layout">
        <div class="feed-panel"><div class="feed-panel-head">Eventos</div><div class="feed-box">${body}</div></div>
        <div class="feed-panel chat-panel"><div class="feed-panel-head">Chat</div><div class="chat-box">${chatBody}</div>
          <form id="chat-form" class="chat-form" autocomplete="off">
            <input name="text" maxlength="220" placeholder="Escribe un comentario..." required>
            <button class="btn primary sm" type="submit">Enviar</button>
          </form>
        </div>
      </div></section>`;
  }

  function chatColor(username) {
    let h = 0;
    String(username || '').split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) % 360; });
    return `hsl(${h} 72% 58%)`;
  }

  function playerTotals(t, fallbackGroup) {
    const group = (t && t.group) || fallbackGroup || {};
    const bracket = (t && t.bracket) || {};
    const final = (t && t.final) || {};
    const mvp = (t && t.mvp) || {};
    const action = bracket.actionRequired ? `, requiere accion ${bracket.actionRequired}` : '';
    const winnerOnly = group.winnerHits ?? Math.max(0, (group.signHits || 0) - (group.exactHits || 0));
    const total = t && t.total != null
      ? t.total
      : (group.combined || 0) + (bracket.points || 0) + (final.points || 0) + (mvp.points || 0);
    const rank = t && t.rank ? `<span class="sub">Puesto #${t.rank}</span>` : '';
    return `<div class="notice info score-summary">
      <div class="score-total"><span>Total</span><b>${total} pts</b>${rank}</div>
      <div class="score-breakdown">
        <span>Grupos <b>${group.combined || 0}</b></span>
        <span>Llave <b>${bracket.points || 0}</b></span>
        <span>Final <b>${final.points || 0}</b></span>
        <span>Goleador <b>${mvp.points || 0}</b></span>
      </div>
      <div class="sub">Grupos: ${group.exactHits || 0} exactos, ${winnerOnly} ganador/empate adicionales. Llave: ${bracket.originalLive || 0} originales vivas, ${bracket.recoveredLive || 0} recuperadas vivas${action}, mejor racha activa +${bracket.bestActive || 0}.</div>
    </div>`;
  }

  function miniTeam(t) {
    if (!t) return '<span class="sub">—</span>';
    return `<span class="mini-team">${flagImg(t.flag, 'flag flag-sm')}<span>${esc(t.name || t.code || '—')}</span></span>`;
  }
  function miniPlayer(p) {
    if (!p) return '<span class="sub">sin prediccion</span>';
    const goals = p.goals != null ? ` · ${p.goals} goles` : '';
    return `<span class="mini-team">${flagImg(p.flag, 'flag flag-sm')}<span>${esc(p.name || p.id)}${goals}</span></span>`;
  }
  function renderBracketDetailLegacy(d) {
    if (!d || !d.submitted) return `<div class="detail-card"><h3>Llave</h3><p class="sub">Sin llave enviada.</p></div>`;
    const correct = d.correctPicks || [];
    const rows = correct.length
      ? correct.map(p => `<div class="detail-line ok"><span>${esc(p.roundName)}</span>${miniTeam(p.pick)}<b>+${STATE.rules.bracket.perWinner}${p.top4Bonus ? ` +${STATE.rules.bracket.top4Bonus}` : ''}${p.finalistBonus ? ` +${STATE.rules.bracket.finalistBonus || 0}` : ''}</b></div>`).join('')
      : `<p class="sub">${d.hasResult ? 'No tiene cruces acertados resueltos todavía.' : 'La llave aún no tiene resultados para comparar.'}</p>`;
    return `<div class="detail-card"><h3>Llave</h3>
      <p class="sub">${d.points || 0} pts · ${d.correct || 0} cruces · ${d.top4 || 0} top4 · ${d.finalists || 0} finalistas</p>
      ${rows}</div>`;
  }
  function branchLabelLegacy(n) {
    if (!n) return '';
    if (n.hit) return `Gano +${n.points || 0} · proximo +${n.nextValue || 0}`;
    if (n.status === 'broken') return 'Rota';
    if (n.status === 'closed') return 'Cerrada';
    if (n.branchType === 'recovered') return `Recuperada · +${n.branchValue || bracketBaseV2()} si pasa`;
    if (n.branchType === 'original') return `Original · +${n.branchValue || bracketBaseV2()} si pasa`;
    if (n.recoveryOpen) return 'Recuperacion abierta';
    return 'Pendiente';
  }
  function branchClassLegacy(n) {
    if (!n) return '';
    if (n.status === 'broken') return 'broken';
    if (n.status === 'closed') return 'closed';
    if (n.hit) return 'won';
    return n.branchType || (n.recoveryOpen ? 'recovery-open' : '');
  }
  function renderBranchTreeLegacy(d, compact = false) {
    const nodes = d?.nodes || [];
    if (!nodes.length) return '';
    const rounds = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
    const title = compact ? '' : '<h3>Arbol de llaves estimadas</h3>';
    return `<div class="branch-tree">${title}${rounds.map(round => {
      const items = nodes.filter(n => n.round === round);
      if (!items.length) return '';
      return `<div class="branch-round"><div class="round-head">${esc(items[0].roundName || round)}</div>${items.map(n => {
        const team = n.activePickTeam || n.originalPickTeam || n.recoveryPickTeam;
        return `<button class="branch-node ${branchClass(n)}" data-action="branch-detail" data-node="${esc(n.nodeId)}">
          <span class="branch-team">${miniTeam(team)}</span><span class="branch-meta">${esc(branchLabel(n))}</span>
        </button>`;
      }).join('')}</div>`;
    }).join('')}</div>`;
  }
  function renderSelectedBranchDetailLegacy(d) {
    const n = (d?.nodes || []).find(x => x.nodeId === ui.branchDetailNode);
    if (!n) return '';
    const real = n.match ? `${esc(n.match.home.name)} - ${esc(n.match.away.name)}` : 'Cruce real no disponible';
    const hit = n.hit ? miniTeam(n.activePickTeam) : '<span class="sub">sin acierto</span>';
    const recovered = n.recoveryPickTeam ? miniTeam(n.recoveryPickTeam) : '<span class="sub">sin recuperacion</span>';
    return `<div class="branch-detail-panel">
      <button class="btn ghost sm" data-action="branch-detail-close">Cerrar detalle</button>
      <div class="detail-line"><span>Ronda</span><b>${esc(n.roundName)}</b></div>
      <div class="detail-line"><span>Prediccion original</span>${miniTeam(n.originalPickTeam)}</div>
      <div class="detail-line"><span>Cruce real</span><b>${real}</b></div>
      <div class="detail-line"><span>Equipo acertado</span>${hit}</div>
      <div class="detail-line"><span>Rama recuperada</span>${recovered}</div>
      <div class="detail-line"><span>Puntos</span><b>+${n.points || 0}</b><span class="sub">Proximo valor: ${n.nextValue ? '+' + n.nextValue : 'sin racha activa'}</span></div>
    </div>`;
  }
  function renderBracketDetailLegacyV2(d) {
    if (!d || !d.submitted) return `<div class="detail-card"><h3>Llave</h3><p class="sub">Sin llave enviada.</p></div>`;
    const rows = (d.nodes || []).filter(n => n.resolved || n.recoveryOpen).slice(0, 8);
    const body = rows.length
      ? rows.map(n => `<div class="detail-line ${n.hit ? 'ok' : ''}"><span>${esc(n.roundName)}</span>${miniTeam(n.activePickTeam || n.originalPickTeam || n.recoveryPickTeam)}<b>${esc(branchLabel(n))}</b></div>`).join('')
      : `<p class="sub">${d.hasResult ? 'No tiene cruces acertados resueltos todavia.' : 'La llave aun no tiene resultados para comparar.'}</p>`;
    const tree = ui.playerTreeOpen ? renderBranchTree(d, true) + renderSelectedBranchDetail(d) : '';
    return `<div class="detail-card detail-wide"><h3>Llave</h3>
      <p class="sub">${d.points || 0} pts · ${d.correct || 0} aciertos · ${d.originalLive || 0} originales vivas · ${d.recoveredLive || 0} recuperadas vivas · mejor +${d.bestActive || 0}</p>
      <button class="btn sm" data-action="player-tree-toggle">${ui.playerTreeOpen ? 'Ocultar arbol' : 'Ver arbol de llaves estimadas'}</button>
      ${body}${tree}</div>`;
  }

  function renderGoldenBootDetail(d) {
    if (d?.locked) {
      const status = d.submitted
        ? `<span class="pts hit">Enviada${d.submittedAt ? ` ${fmt(d.submittedAt)}` : ''}</span>`
        : '<span class="pts">No enviada</span>';
      return `<div class="detail-card"><h3>Bota de Oro</h3>
        <div class="detail-line"><span>Estado</span>${status}</div>
        <p class="sub">La prediccion de Bota de Oro se mostrara despues del inicio del primer partido: ${fmt(d.unlockAt)}.</p>
      </div>`;
    }
    if (!d || !d.submitted) return `<div class="detail-card"><h3>Bota de Oro</h3><p class="sub">Sin prediccion enviada.</p></div>`;
    const status = d.hasResult
      ? (d.hit ? `<span class="pts hit">Acertada +${d.points || 0}</span>` : `<span class="pts">Fallada +0</span>`)
      : `<span class="pts">Pendiente</span>`;
    const actual = d.actual ? `<div class="detail-line"><span>Ganador real</span>${miniPlayer(d.actual)}</div>` : '';
    return `<div class="detail-card"><h3>Bota de Oro</h3>
      <div class="detail-line"><span>Prediccion</span>${miniPlayer(d.picked)}${status}</div>
      ${actual}</div>`;
  }
  function renderFinalDetail(d) {
    if (!d || !d.submitted) return `<div class="detail-card"><h3>Final</h3><p class="sub">Sin prediccion enviada.</p></div>`;
    const teams = d.teams ? `${esc(d.teams.home.name)} vs ${esc(d.teams.away.name)}` : 'Final';
    const pred = d.score ? `${d.score.home}-${d.score.away}` : '—';
    const actual = d.actual ? `<div class="detail-line"><span>Resultado real</span><b>${d.actual.score.home}-${d.actual.score.away}</b>${miniTeam(d.actual.winner)}</div>` : '';
    const exact = d.hasResult ? `<span class="pts ${d.exactHit ? 'hit' : ''}">Exacto +${d.exactHit ? STATE.rules.final.exactScore : 0}</span>` : '';
    const champ = d.hasResult ? `<span class="pts ${d.champHit ? 'hit' : ''}">Campeón +${d.champHit ? STATE.rules.final.championBonus : 0}</span>` : `<span class="pts">Pendiente</span>`;
    return `<div class="detail-card"><h3>Final</h3>
      <p class="sub">${esc(teams)} · ${d.points || 0} pts</p>
      <div class="detail-line"><span>Prediccion</span><b>${pred}</b>${miniTeam(d.champion)}${exact}${champ}</div>
      ${actual}</div>`;
  }
  function renderPredictionDetails(p) {
    return `<div class="prediction-sections">
      ${renderBracketDetail(p.bracketDetail)}
      ${renderGoldenBootDetail(p.goldenBootDetail)}
      ${renderFinalDetail(p.finalDetail)}
    </div>`;
  }

  function renderPlayerPredictionsLegacy() {
    const p = ui.playerProfile;
    const back = `<button class="btn ghost sm back-btn" data-action="player-back">← Volver a clasificación</button>`;
    if (!p) return back + `<div class="empty">Cargando predicciones...</div>`;
    const matches = p.matches || [];
    const s = p.summary || {};
    const head = `<div class="section-head"><h2>Predicciones de ${esc(p.user.name)}</h2><p>Solo se muestran partidos de grupos que ya se han jugado.</p></div>`;
    const summary = playerTotals(p.totals, s);
    const details = renderPredictionDetails(p);
    if (!matches.length) return back + head + summary + details + `<div class="empty">Todavía no hay partidos jugados para mostrar.</div>`;
    const blocks = Object.entries(byGroup(matches)).sort().map(([k, ms]) =>
      `<div class="group-block"><h3 class="group-title">Grupo ${esc(k)}</h3>${ms.map(m => groupRowReadOnly(m, 'Pronóstico')).join('')}</div>`).join('');
    return back + head + summary + details + blocks;
  }

  function renderPlayerPredictions() {
    const p = ui.playerProfile;
    const back = `<button class="btn ghost sm back-btn" data-action="player-back">← Volver</button>`;
    if (!p) return back + `<div class="empty">Cargando predicciones...</div>`;
    const matches = p.matches || [];
    const s = p.summary || {};
    const badge = rankBadge(p.totals?.rank);
    const head = `<div class="section-head player-detail-head"><h2>${badge ? `<span class="rank-badge">${esc(badge)}</span>` : ''} Predicciones de ${esc(p.user.name)}</h2><p>Partidos y cruces ya resueltos</p></div>`;
    const summary = playerTotals(p.totals, s);
    const details = renderPredictionDetails(p);
    if (!matches.length) return head + summary + details + `<div class="empty">Todavia no hay partidos jugados para mostrar.</div>`;
    const blocks = Object.entries(byGroup(matches)).sort().map(([k, ms]) =>
      `<div class="group-block"><h3 class="group-title">Grupo ${esc(k)}</h3>${ms.map(m => groupRowReadOnly(m, 'Pronostico')).join('')}</div>`).join('');
    return head + summary + details + blocks;
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
  function groupRowReadOnly(m, predictionLabel = 'Pronóstico') {
    let mid, foot;
    if (m.score) { mid = `<span class="goals">${m.score.home}</span><span class="dash">-</span><span class="goals">${m.score.away}</span>`; }
    else { mid = `<span class="goals muted">·</span><span class="dash">-</span><span class="goals muted">·</span>`; }
    if (m.yourPred) {
      let points = '';
      if (m.points && m.points.hasResult) {
        const exactPts = m.points.exact ?? (m.points.exactHit ? STATE.rules.group.exactScore : 0);
        const winnerPts = m.points.signHit ? (m.points.winner || STATE.rules.group.signPartial) : (m.points.winner || 0);
        points += `<span class="pts ${m.points.exactHit ? 'hit' : ''}">Exacto +${exactPts}</span>`;
        points += `<span class="pts ${m.points.signHit ? 'hit' : ''}">Ganador/empate +${winnerPts}</span>`;
        if (m.points.sign > 0) points += `<span class="pts ${m.points.signHit ? 'hit' : ''}">1X2 extra +${m.points.sign}</span>`;
      }
      foot = `<span>J${m.matchday} · ${fmt(m.utcDate)} · ${esc(predictionLabel)}: ${m.yourPred.home}-${m.yourPred.away}</span><span class="pred-points">${points}</span>`;
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
    const headOpen = `<div class="section-head"><h2>📝 Fase de grupos</h2><p>Predice el marcador de cada partido. Se envía <b>todo a la vez y una sola vez</b>.</p></div>`;
    const headSubmitted = `<div class="section-head"><h2>📝 Fase de grupos</h2><p>Tus predicciones ya fueron enviadas. Aqui solo veras los partidos pendientes o en juego con tu pronostico.</p></div>`;
    const headClosed = `<div class="section-head"><h2>📝 Fase de grupos</h2><p>Consulta los partidos y la clasificación de grupos según los resultados disponibles.</p></div>`;
    const extra = STATE.rules.group.sign > 0 ? `, y <b>${STATE.rules.group.sign} pt</b> extra por el 1X2` : '';
    const exactTotal = STATE.rules.group.exactScore + STATE.rules.group.signPartial + STATE.rules.group.sign;
    const rules = `<div class="notice info">Reglas: <b>${STATE.rules.group.exactScore} pts</b> por marcador exacto y <b>${STATE.rules.group.signPartial} pts</b> por acertar ganador/empate${extra}. El exacto acumula ambos: si acaba 2-1, poner 2-1 da ${exactTotal} pts; poner 1-0 da ${STATE.rules.group.signPartial} pts y poner 0-1 da 0 pts.</div>`;
    const standings = renderStandings(g.standings);

    if (g.submitted) {
      const pendingMatches = g.matches.filter(m => m.status !== 'FINISHED' && m.state !== 'finished');
      const blocks = Object.entries(byGroup(pendingMatches)).sort().map(([k, ms]) =>
        `<div class="group-block"><h3 class="group-title">Grupo ${esc(k)}</h3>${ms.map(m => groupRowReadOnly(m)).join('')}</div>`).join('');
      const body = pendingMatches.length
        ? blocks
        : `<div class="empty">Todos los partidos de grupos ya finalizaron. Puedes consultar el desglose de puntos desde Clasificacion.</div>`;
      return headSubmitted + `<div class="notice ok">✓ Enviaste tus predicciones el ${fmt(g.submittedAt)}. No se pueden cambiar.</div>` + body + standings;
    }
    if (g.open) {
      const up = new Set(g.upcomingIds);
      const formMatches = g.matches.filter(m => up.has(m.id));
      const blocks = Object.entries(byGroup(formMatches)).sort().map(([k, ms]) =>
        `<div class="group-block"><h3 class="group-title">Grupo ${esc(k)}</h3>${ms.map(groupRowForm).join('')}</div>`).join('');
      return headOpen + rules +
        `<div class="notice warn">⚠️ Una vez envíes, <b>no podrás cambiarlo</b>. Rellena todos los partidos.</div>
         <form id="group-form">${blocks}
           <div class="sticky-submit"><span class="sub">${formMatches.length} partidos por pronosticar</span>
             <button class="btn primary" type="submit">Enviar predicciones (definitivo)</button></div>
         </form>` + standings;
    }
    return headClosed + `<div class="empty">No hay partidos de grupos disponibles para predecir ahora mismo.</div>` + standings;
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
  function computeCandidatesWithReal(tree, picks, detail, forcedIds = []) {
    const forced = new Set(forcedIds);
    const by = detailByNode(detail);
    const cand = {};
    const knownReal = (m) => !!(m?.home?.code && m?.away?.code && !m.home.tbd && !m.away.tbd);
    tree.r32.forEach(n => { cand[n.id] = { a: teamObj(n.teams.a), b: teamObj(n.teams.b) }; });
    const winner = (id) => {
      const c = cand[id], code = picks[id];
      if (!code || !c) return null;
      const nd = by[id];
      if (nd?.resolved && nd.actualWinner) {
        return [c.a, c.b].find(t => t?.code === nd.actualWinner) || detailTeamByCode(detail, nd.actualWinner);
      }
      if (c.a && c.a.code === code) return c.a;
      if (c.b && c.b.code === code) return c.b;
      return null;
    };
    [tree.r16, tree.qf, tree.sf, [tree.final]].forEach(nodes => nodes.forEach(n => {
      const real = by[n.id]?.match;
      cand[n.id] = forced.has(n.id) && knownReal(real)
        ? { a: real.home, b: real.away }
        : { a: winner(n.childA), b: winner(n.childB) };
    }));
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
  function pruneRecoveryPicks(tree, picks, detail, allowedIds) {
    const allowed = new Set(allowedIds || []);
    let changed = true;
    while (changed) {
      changed = false;
      const cand = computeCandidatesWithReal(tree, picks, detail, allowedIds);
      [...tree.r16, ...tree.qf, ...tree.sf, tree.final].forEach(n => {
        if (!allowed.has(n.id)) return;
        const c = cand[n.id], code = picks[n.id];
        const valid = [c.a && c.a.code, c.b && c.b.code].filter(Boolean);
        if (code && !valid.includes(code)) { delete picks[n.id]; changed = true; }
      });
    }
  }
  function bracketNodesInOrder(tree) {
    return [...tree.r32, ...tree.r16, ...tree.qf, ...tree.sf, tree.final];
  }
  function roundRank(round) {
    return { R32: 0, R16: 1, QF: 2, SF: 3, FINAL: 4 }[round] ?? 0;
  }
  function roundShort(round) {
    return { R32: '1/16', R16: '8vos', QF: '4tos', SF: 'Semifinales', FINAL: 'Final' }[round] || round;
  }
  function openRecoveryNodes(detail) {
    return (detail?.nodes || []).filter(n => n.recoveryOpen || n.revisionOpen);
  }
  function recoveryEditIds(tree, detail, fromNodeId) {
    const by = detailByNode(detail);
    const from = by[fromNodeId];
    const startRank = roundRank(from?.round);
    const ids = bracketNodesInOrder(tree)
      .filter(n => {
        const nd = by[n.id];
        if (!nd || nd.resolved) return false;
        return roundRank(n.round) >= startRank;
      })
      .map(n => n.id);
    return ids.length ? ids : recoveryPath(tree, fromNodeId);
  }
  function activeChildPickForNode(tree, detail, nodeId, valid) {
    const live = incomingLiveBranches(tree, detail, nodeId, valid);
    return live.length === 1 ? live[0].code : null;
  }
  function detailTeamByCode(detail, code) {
    if (!code) return null;
    const teams = [];
    (detail?.nodes || []).forEach(n => {
      [n.originalPickTeam, n.recoveryPickTeam, n.activePickTeam, n.actualWinnerTeam, n.match?.home, n.match?.away]
        .filter(Boolean)
        .forEach(t => teams.push(t));
      (n.recoveryOptions || []).forEach(t => teams.push(t));
    });
    return teams.find(t => t.code === code) || { code, name: code };
  }
  function incomingLiveBranches(tree, detail, nodeId, validCodes = null, branchInfo = null) {
    const node = bracketNodesInOrder(tree).find(n => n.id === nodeId);
    if (!node?.childA) return [];
    const by = detailByNode(detail);
    const valid = validCodes ? new Set(validCodes) : null;
    const children = [by[node.childA], by[node.childB]].filter(Boolean);
    const fromDraft = [node.childA, node.childB].map(id => branchInfo?.[id]).filter(Boolean).map(info => {
      if (!info.code || (valid && !valid.has(info.code))) return null;
      return {
        code: info.code,
        team: detailTeamByCode(detail, info.code),
        type: info.type || 'original',
        value: info.nextValue || (info.currentValue || bracketBaseV2()) + bracketBaseV2(),
        nodeId: info.nodeId,
        round: by[info.nodeId]?.roundName,
      };
    }).filter(Boolean);
    if (fromDraft.length) return fromDraft;
    return children.map(ch => {
      const code = ch.hit ? ch.activePick : (ch.activePick && ch.branchType ? ch.activePick : null);
      if (!code || (valid && !valid.has(code))) return null;
      const currentValue = ch.branchValue || bracketBaseV2();
      const projectedValue = ch.hit
        ? (ch.nextValue || currentValue + bracketBaseV2())
        : (ch.branchType ? currentValue + bracketBaseV2() : currentValue);
      return {
        code,
        team: ch.activePickTeam || ch.actualWinnerTeam || ch.recoveryPickTeam || ch.originalPickTeam || detailTeamByCode(detail, code),
        type: ch.branchType || 'original',
        value: projectedValue,
        nodeId: ch.nodeId,
        round: ch.roundName,
      };
    }).filter(Boolean);
  }
  function draftBranchInfoMap(tree, detail, picks, allowedIds = []) {
    const by = detailByNode(detail);
    const cand = computeCandidatesWithReal(tree, picks || {}, detail, allowedIds);
    const info = {};
    const base = bracketBaseV2();
    const validCodes = (id) => [cand[id]?.a?.code, cand[id]?.b?.code].filter(Boolean);
    [tree.r32, tree.r16, tree.qf, tree.sf, [tree.final]].forEach(nodes => nodes.forEach(n => {
      const pick = picks?.[n.id];
      if (!pick || !validCodes(n.id).includes(pick)) return;
      const nd = by[n.id];
      if (nd?.resolved) {
        if (nd.actualWinner && pick !== nd.actualWinner) return;
        const currentValue = nd.branchValue || Math.max((nd.nextValue || base + base) - base, base);
        info[n.id] = { nodeId: n.id, code: pick, type: nd.branchType || 'original', currentValue, nextValue: nd.nextValue || currentValue + base };
        return;
      }
      const incoming = n.childA ? [info[n.childA], info[n.childB]].find(x => x?.code === pick) : null;
      let currentValue = null;
      let type = 'original';
      if (incoming) {
        currentValue = incoming.nextValue;
        type = incoming.type;
      } else if (nd?.activePick === pick && nd.branchType) {
        currentValue = nd.branchValue || base;
        type = nd.branchType;
      } else if (nd?.recoveryPick === pick && nd.branchType) {
        currentValue = nd.branchValue || base;
        type = 'recovered';
      } else if (nd?.recoveryOpen) {
        currentValue = base;
        type = 'recovered';
      } else if (nd?.revisionOpen && pick !== nd.activePick) {
        currentValue = base;
        type = 'recovered';
      } else if (!n.childA) {
        currentValue = base;
      }
      if (currentValue != null) info[n.id] = { nodeId: n.id, code: pick, type, currentValue, nextValue: currentValue + base };
    }));
    return info;
  }
  function defaultRecoveryPick(tree, detail, id, picks, allowedIds) {
    const by = detailByNode(detail);
    const n = by[id];
    const cand = computeCandidatesWithReal(tree, picks, detail, allowedIds);
    const valid = [cand[id]?.a?.code, cand[id]?.b?.code].filter(Boolean);
    if (!valid.length) return null;
    if (n?.activePick && valid.includes(n.activePick)) return n.activePick;
    if (n?.revisionOpen && Array.isArray(n.projectedOverlap)) {
      const keep = n.projectedOverlap.find(code => valid.includes(code));
      if (keep) return keep;
    }
    const childPick = activeChildPickForNode(tree, detail, id, valid);
    if (childPick) return childPick;
    if (n?.recoveryPick && valid.includes(n.recoveryPick)) return n.recoveryPick;
    if (n?.originalPick && valid.includes(n.originalPick)) return n.originalPick;
    return null;
  }
  function fillRecoveryDefaults(tree, picks, detail, allowedIds) {
    allowedIds.forEach(id => {
      const cand = computeCandidatesWithReal(tree, picks, detail, allowedIds);
      const valid = [cand[id]?.a?.code, cand[id]?.b?.code].filter(Boolean);
      if (picks[id] && valid.includes(picks[id])) return;
      delete picks[id];
      const fallback = defaultRecoveryPick(tree, detail, id, picks, allowedIds);
      if (fallback) picks[id] = fallback;
    });
    pruneRecoveryPicks(tree, picks, detail, allowedIds);
  }
  function propagateRecoveryPicks(tree, picks, detail, allowedIds, fromNodeId) {
    const allowed = new Set(allowedIds || []);
    const path = recoveryPath(tree, fromNodeId).filter(id => allowed.has(id));
    const start = 0;
    const original = currentPickMapFromDetail(detail);
    path.slice(start + 1).forEach(id => { delete picks[id]; });
    for (let i = start + 1; i < path.length; i++) {
      const id = path[i];
      const cand = computeCandidatesWithReal(tree, picks, detail, allowedIds);
      const valid = [cand[id]?.a?.code, cand[id]?.b?.code].filter(Boolean);
      const previousPick = picks[path[i - 1]];
      const originalPick = original[id];
      if (originalPick && valid.includes(originalPick)) picks[id] = originalPick;
      else if (previousPick && valid.includes(previousPick)) picks[id] = previousPick;
    }
    pruneRecoveryPicks(tree, picks, detail, allowedIds);
    fillRecoveryDefaults(tree, picks, detail, allowedIds);
  }
  function parentMap(tree) {
    const out = {};
    [...tree.r16, ...tree.qf, ...tree.sf, tree.final].forEach(n => {
      out[n.childA] = n.id;
      out[n.childB] = n.id;
    });
    return out;
  }
  function recoveryPath(tree, nodeId) {
    const parents = parentMap(tree);
    const path = [];
    let id = nodeId;
    while (id) {
      path.push(id);
      id = parents[id];
    }
    return path;
  }
  function detailByNode(detail) {
    return Object.fromEntries((detail?.nodes || []).map(n => [n.nodeId, n]));
  }
  function recoveryConflictSummary(tree, detail, picks, allowedIds) {
    const by = detailByNode(detail);
    const conflicts = [];
    const seen = new Set();
    const branchInfo = draftBranchInfoMap(tree, detail, picks, allowedIds);
    allowedIds.forEach(id => {
      const n = by[id], pick = picks[id];
      if (!n || !pick) return;
      if (n.activePick && pick !== n.activePick && !!n.branchType && !n.resolved) {
        const key = `${id}:${n.activePick}`;
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push({ team: n.activePickTeam || detailTeamByCode(detail, n.activePick), round: n.roundName, type: n.branchType, value: n.branchValue || bracketBaseV2(), source: 'current' });
        }
      }
      const cand = computeCandidatesWithReal(tree, picks, detail, allowedIds);
      const valid = [cand[id]?.a?.code, cand[id]?.b?.code].filter(Boolean);
      const plannedContinuations = [n.activePick, n.recoveryPick, n.originalPick].filter(Boolean);
      incomingLiveBranches(tree, detail, id, valid, branchInfo).forEach(br => {
        if (!plannedContinuations.includes(br.code)) return;
        if (br.code === pick) return;
        const key = `${id}:${br.code}`;
        if (seen.has(key)) return;
        seen.add(key);
        conflicts.push({ team: br.team, round: n.roundName, type: br.type, value: br.value || bracketBaseV2(), source: 'incoming' });
      });
    });
    const total = conflicts.reduce((s, x) => s + x.value, 0);
    return { conflicts, total };
  }
  function recoveryDraft(nodeId, pick, edit = null) {
    const tree = STATE.bracket.tree;
    const detail = STATE.bracket.detail;
    const allowedIds = edit?.allowedIds || recoveryEditIds(tree, detail, nodeId);
    const picks = edit?.picks ? { ...edit.picks } : currentPickMapFromDetail(detail);
    if (pick) picks[nodeId] = pick;
    propagateRecoveryPicks(tree, picks, detail, allowedIds, nodeId);
    return { nodeId, pick, allowedIds, picks, conflicts: recoveryConflictSummary(tree, detail, picks, allowedIds) };
  }
  function startRecoveryConfirm(nodeId, pick, edit = null) {
    if (!edit) ui.recoveryEdit = null;
    ui.recoveryConfirm = { ...recoveryDraft(nodeId, pick, edit), mode: edit ? 'edit' : 'start' };
  }
  function currentTreeStatusText(n) {
    if (!n) return '';
    if (n.resolved) return n.hit ? `+${n.points || 0}` : '+0';
    if (n.recoveryPending) return 'rota · espera';
    if (n.recoveryOpen) return 'accion';
    if (n.revisionOpen) return 'opcional';
    if (n.branchType) return `racha +${n.branchValue || bracketBaseV2()}`;
    return 'pendiente';
  }
  function editTreeStatusText(n, pick, incoming = [], currentInfo = null) {
    if (!n) return '';
    if (n.resolved) return n.hit ? `+${n.points || 0}` : '+0';
    if (!pick) return n.recoveryOpen ? 'elige ganador' : 'pendiente';
    if (n.recoveryOpen) return `recuperada +${currentInfo?.currentValue || bracketBaseV2()} si pasa`;
    if (n.revisionOpen && pick !== n.activePick) return `cambio +${currentInfo?.currentValue || bracketBaseV2()} si pasa`;
    if (currentInfo?.code === pick) return `mantiene racha +${currentInfo.currentValue || bracketBaseV2()}`;
    if (pick === n.activePick && n.branchType) return `mantiene racha +${n.branchValue || bracketBaseV2()}`;
    const incomingBranch = incoming.find(br => br.code === pick);
    if (incomingBranch) return `mantiene racha +${incomingBranch.value || bracketBaseV2()}`;
    if (incoming.length && incoming.every(br => br.code !== pick)) return `cambia rama +${bracketBaseV2()} si pasa`;
    return `reedicion +${bracketBaseV2()} si pasa`;
  }
  function editTieClass(n, pick, incoming = [], currentInfo = null) {
    if (!n) return '';
    if (n.recoveryOpen) return pick && pick !== n.activePick ? 'recovery-open draft-change' : 'recovery-open';
    if (n.revisionOpen) return pick && pick !== n.activePick ? 'revision-open draft-change' : 'revision-open';
    if (currentInfo?.type === 'recovered') return 'recovered';
    if (currentInfo?.type === 'original') return 'original';
    const incomingBranch = incoming.find(br => br.code === pick);
    if (incomingBranch?.type === 'recovered') return 'recovered';
    if (incomingBranch?.type === 'original') return 'original';
    if (pick && incoming.length && incoming.every(br => br.code !== pick)) return 'revision-open draft-change';
    if (pick && pick !== n.activePick && n.recoveryOpen) return 'recovery-open draft-change';
    if (pick && pick !== n.activePick && n.revisionOpen) return 'revision-open draft-change';
    if (pick === n.activePick && n.branchType === 'recovered') return 'recovered';
    if (pick === n.activePick && n.branchType === 'original') return 'original';
    if (!pick && n.recoveryOpen) return 'recovery-open';
    if (!pick && n.revisionOpen) return 'revision-open';
    if (!pick && incoming[0]?.type === 'recovered') return 'recovered';
    if (!pick && incoming[0]?.type === 'original') return 'original';
    return '';
  }
  function sameCandidateSet(a, b) {
    const codes = (x) => [x?.a?.code, x?.b?.code].filter(Boolean).sort().join('|');
    return codes(a) === codes(b);
  }
  function editSlotClass(n, team, changedCandidates = false) {
    if (!n || !team?.code) return '';
    if (n.recoveryOpen) return 'action-required-option';
    if (n.revisionOpen || changedCandidates) return 'optional-action-option';
    return '';
  }
  function slotHtml(node, which, team, picks, interactive, actualSet, actionName = 'pick', extraClass = '') {
    const code = team && team.code;
    const picked = code && picks[node.id] === code;
    const cls = ['slot'];
    if (extraClass) cls.push(extraClass);
    if (picked) cls.push('pick');
    if (!code) cls.push('label');
    if (actualSet && code && actualSet.has(code)) cls.push(picked ? 'correct' : 'real-adv');
    const clickAttr = (interactive && code) ? ` data-action="${actionName}" data-node="${node.id}" data-code="${esc(code)}"` : '';
    const name = team ? (code ? team.name : (team.label || '—')) : '—';
    const flag = team && team.flag ? flagImg(team.flag, 'flag flag-sm') : '';
    return `<div class="${cls.join(' ')}"${clickAttr}>${flag}<span class="scode">${esc(code || '')}</span><span class="sname">${esc(name)}</span></div>`;
  }
  function renderBracketGrid(interactive, opts = {}) {
    const b = STATE.bracket, tree = b.tree;
    const picks = opts.picks || (interactive ? ui.bracketPicks : b.yourPicks);
    const allowed = opts.allowedIds ? new Set(opts.allowedIds) : null;
    const actionName = opts.action || 'pick';
    const detailMap = opts.detail ? detailByNode(opts.detail) : {};
    const realForcedIds = opts.useReal ? bracketNodesInOrder(tree).map(n => n.id) : opts.allowedIds;
    const cand = (opts.detail && realForcedIds)
      ? computeCandidatesWithReal(tree, picks || {}, opts.detail, realForcedIds)
      : computeCandidates(tree, picks || {});
    const editMode = opts.detail && actionName === 'recovery-edit-pick';
    const branchInfo = editMode ? draftBranchInfoMap(tree, opts.detail, picks || {}, opts.allowedIds || []) : {};
    const initialEditPicks = editMode ? (ui.recoveryEdit?.initialPicks || currentPickMapFromDetail(opts.detail)) : null;
    const initialCand = editMode ? computeCandidatesWithReal(tree, initialEditPicks || {}, opts.detail, opts.allowedIds || []) : {};
    // Conjuntos reales que avanzaron (para resaltar aciertos cuando ya está enviado).
    const ar = b.actualReached || {};
    const setFor = { R32: new Set(ar.R16 || []), R16: new Set(ar.QF || []), QF: new Set(ar.SF || []), SF: new Set(ar.FINAL || []), FINAL: new Set(ar.CHAMP || []) };
    const cols = [
      { head: '1/16', nodes: tree.r32, round: 'R32' },
      { head: '8vos', nodes: tree.r16, round: 'R16' },
      { head: '4tos', nodes: tree.qf, round: 'QF' },
      { head: 'Semifinales', nodes: tree.sf, round: 'SF' },
      { head: 'Final', nodes: [tree.final], round: 'FINAL' },
    ];
    const showActual = b.submitted;
    const colHtml = cols.map(col => `
      <div class="round"><div class="round-head">${col.head}</div>
        ${col.nodes.map(n => {
          const c = cand[n.id];
          const nd = detailMap[n.id];
          const currentPick = (picks || {})[n.id];
          const validCodes = [c.a?.code, c.b?.code].filter(Boolean);
          const currentInfo = branchInfo[n.id] || null;
          const incoming = editMode ? incomingLiveBranches(tree, opts.detail, n.id, validCodes, branchInfo) : [];
          const changedCandidates = editMode && !sameCandidateSet(c, initialCand[n.id]);
          const editNeedsChoice = editMode ? (!currentInfo || nd?.recoveryOpen || nd?.revisionOpen || changedCandidates) : false;
          const nodeInteractive = editMode
            ? interactive && (!allowed || allowed.has(n.id)) && editNeedsChoice
            : interactive && (!allowed || allowed.has(n.id));
          const statusText = editMode
            ? editTreeStatusText(nd, currentPick, incoming, currentInfo)
            : currentTreeStatusText(nd);
          const status = opts.detail ? `<div class="tie-status">${esc(statusText)}</div>` : '';
          const editClass = editMode ? editTieClass(nd, currentPick, incoming, currentInfo) : '';
          const slotClassA = editMode && nodeInteractive ? editSlotClass(nd, c.a, changedCandidates) : '';
          const slotClassB = editMode && nodeInteractive ? editSlotClass(nd, c.b, changedCandidates) : '';
          return `<div class="tie ${interactive ? 'clickable' : ''} ${editClass} ${col.round === 'FINAL' ? 'final-tie' : ''}">
            ${status}
            ${slotHtml(n, 'a', c.a, picks || {}, nodeInteractive, showActual ? setFor[col.round] : null, actionName, slotClassA)}
            ${slotHtml(n, 'b', c.b, picks || {}, nodeInteractive, showActual ? setFor[col.round] : null, actionName, slotClassB)}
          </div>`;
        }).join('')}
      </div>`).join('');
    const champCode = (picks || {})[tree.final.id];
    const champTeam = cand[tree.final.id] && [cand[tree.final.id].a, cand[tree.final.id].b].find(t => t && t.code === champCode);
    const champ = champTeam ? `<div class="champ-box"><span class="champ">🏆 Tu campeón: ${esc(champTeam.name)}</span></div>` : '';
    return `<div class="bracket-scroll"><div class="bracket">${colHtml}</div></div>${champ}`;
  }
  function rulesBracketLegacy() {
    return `<div class="notice info">Reglas de la llave: <b>${STATE.rules.bracket.perWinner} pts</b> por cada cruce acertado, <b>+${STATE.rules.bracket.top4Bonus} pts</b> por cada semifinalista acertado y <b>+${STATE.rules.bracket.finalistBonus || 0} pts</b> por cada finalista acertado. Ejemplo: eliges a España en un cruce y avanza, +${STATE.rules.bracket.perWinner}; si la metiste en semifinales reales, +${STATE.rules.bracket.top4Bonus} extra; si además llega a la final, +${STATE.rules.bracket.finalistBonus || 0} extra.</div>`;
  }
  function rulesBracketOld() {
    return `<div class="notice info">Reglas de la llave: cada rama viva empieza en <b>+${bracketBaseV2()}</b>. Si el equipo pasa, suma ese valor y la siguiente ronda sube otros <b>+${bracketBaseV2()}</b>. Si la rama se rompe, solo puedes recuperar el cruce real abierto; una rama recuperada vuelve a empezar en <b>+${bracketBaseV2()}</b>.</div>`;
  }
  function renderRecoveryPanel(detail) {
    const open = (detail?.nodes || []).filter(n => n.recoveryOpen);
    if (!open.length) return '';
    return `<div class="recovery-panel"><h3>Recuperaciones abiertas</h3><p class="sub">Solo aparecen cruces reales donde tu rama inicial ya no esta viva. Si aciertas, nace una rama recuperada desde +${bracketBaseV2()}.</p>
      ${open.map(n => `<div class="recovery-card"><b>${esc(n.roundName)}</b><div class="recovery-options">
        ${(n.recoveryOptions || []).map(t => `<button class="btn sm" data-action="recovery-pick" data-node="${esc(n.nodeId)}" data-code="${esc(t.code)}">${flagImg(t.flag, 'flag flag-sm')} ${esc(t.name)}</button>`).join('')}
      </div></div>`).join('')}</div>`;
  }

  function renderBracketLegacy() {
    const b = STATE.bracket;
    const head = `<div class="section-head"><h2>🗝️ Llave eliminatoria</h2><p>Elige quién avanza en cada cruce hasta el campeón. Se envía <b>una sola vez</b>.</p></div>`;
    const submittedHead = `<div class="section-head"><h2>🗝️ Llave eliminatoria</h2><p>Tu llave ya fue enviada. Revisa el cuadro, los avances acertados y los bonus aplicados.</p></div>`;
    if (b.submitted) {
      return submittedHead + `<div class="notice ok">✓ Enviaste tu llave el ${fmt(b.submittedAt)}. No se puede cambiar.</div>` + rulesBracket() + renderBracketGrid(false);
    }
    if (!b.window.open) {
      const why = b.window.passedDeadline ? 'La llave ya está cerrada.' : 'La llave se abrirá cuando terminen los grupos y se conozcan los 32 equipos.';
      return head + `<div class="notice info">${why} Vista previa del cuadro:</div>` + renderBracketGrid(false);
    }
    if (!ui.bracketPicks) ui.bracketPicks = { ...(b.yourPicks || {}) };
    const total = b.tree.r32.length + b.tree.r16.length + b.tree.qf.length + b.tree.sf.length + 1;
    const done = Object.keys(ui.bracketPicks).filter(k => ui.bracketPicks[k]).length;
    const complete = done >= total;
    const deadline = bettingDeadlineText(b.window?.deadline);
    return head + rulesBracket() +
      `<div class="notice warn">Se acepta envio de llaves ${deadline}. Una vez envies, <b>no podras cambiarlo</b>.</div>` +
      renderBracketGrid(true) +
      `<div class="sticky-submit"><span class="sub">${done}/${total} cruces elegidos</span>
        <button class="btn primary" data-action="bracket-submit" ${complete ? '' : 'disabled'}>Enviar llave (definitivo)</button></div>`;
  }

  function renderBracketOld() {
    const b = STATE.bracket;
    const head = `<div class="section-head"><h2>Llave eliminatoria</h2><p>Elige quien avanza en cada cruce hasta el campeon. Se envia <b>una sola vez</b>.</p></div>`;
    const submittedHead = `<div class="section-head"><h2>Llave eliminatoria</h2><p>Tu llave ya fue enviada. Revisa ramas, rachas y recuperaciones disponibles.</p></div>`;
    if (b.submitted) {
      return submittedHead + `<div class="notice ok">Enviaste tu llave el ${fmt(b.submittedAt)}. No se puede cambiar.</div>` + rulesBracket() + renderRecoveryPanel(b.detail) + renderBranchTree(b.detail) + renderBracketGrid(false);
    }
    if (!b.window.open) {
      const why = !b.window.groupsFinished
        ? 'La llave se abrira cuando terminen los grupos.'
        : (!b.window.bracketComplete
          ? 'La llave se abrira cuando se asignen los mejores terceros y queden completos los 32 equipos.'
          : 'La llave ya esta cerrada.');
      return head + `<div class="notice info">${why} Vista previa del cuadro:</div>` + renderBracketGrid(false);
    }
    if (!ui.bracketPicks) ui.bracketPicks = { ...(b.yourPicks || {}) };
    const total = b.tree.r32.length + b.tree.r16.length + b.tree.qf.length + b.tree.sf.length + 1;
    const done = Object.keys(ui.bracketPicks).filter(k => ui.bracketPicks[k]).length;
    const complete = done >= total;
    const deadline = bettingDeadlineText(b.window?.deadline);
    return head + rulesBracket() +
      `<div class="notice warn">Se acepta envio de llaves ${deadline}. Una vez envies, <b>no podras cambiarlo</b>.</div>` +
      renderBracketGrid(true) +
      `<div class="sticky-submit"><span class="sub">${done}/${total} cruces elegidos</span>
        <button class="btn primary" data-action="bracket-submit" ${complete ? '' : 'disabled'}>Enviar llave (definitivo)</button></div>`;
  }

  function bracketBaseV2() {
    return STATE?.rules?.bracket?.perWinner || 2;
  }
  function matchMiniV2(n) {
    if (!n?.match) return '<span class="sub">Cruce real pendiente</span>';
    return `<span class="branch-match">${miniTeam(n.match.home)}<span class="vs">vs</span>${miniTeam(n.match.away)}</span>`;
  }
  function branchDisplayTeamV2(n) {
    if (!n) return null;
    if (n.hit || n.resolved) return n.actualWinnerTeam || n.activePickTeam || n.recoveryPickTeam || null;
    return n.activePickTeam || n.recoveryPickTeam || null;
  }
  function branchNodeMainV2(n) {
    const team = branchDisplayTeamV2(n);
    if (team) return miniTeam(team);
    return matchMiniV2(n);
  }
  function branchLabel(n) {
    if (!n) return '';
    if (n.recoveryOpen) return 'Requiere accion: elige quien pasa';
    if (n.recoveryPending) return 'Rama rota · recuperacion pendiente de cierre de ronda';
    if (n.revisionOpen) return 'Puedes cambiar antes del partido';
    if (n.hit) return `Acerto +${n.points || 0} · proximo +${n.nextValue || 0}`;
    if (n.status === 'broken') return n.actualWinnerTeam ? `Rama rota · paso ${n.actualWinnerTeam.name}` : 'Rama rota';
    if (n.branchType === 'recovered') return `Recuperada · +${n.branchValue || bracketBaseV2()} si pasa`;
    if (n.branchType === 'original') return `Original · +${n.branchValue || bracketBaseV2()} si pasa`;
    if (n.status === 'closed') return 'Racha cerrada';
    return 'Sin rama activa';
  }
  function branchClass(n) {
    if (!n) return '';
    if (n.recoveryPending) return 'recovery-pending';
    if (n.recoveryOpen) return 'recovery-open';
    if (n.revisionOpen) return 'revision-open';
    if (n.hit) return 'won';
    if (n.status === 'broken') return 'broken';
    if (n.branchType) return n.branchType;
    return 'inactive';
  }
  function renderBranchTree(d, compact = false) {
    const nodes = d?.nodes || [];
    if (!nodes.length) return '';
    const rounds = ['R32', 'R16', 'QF', 'SF', 'FINAL'];
    const title = compact ? '' : '<h3>Arbol de llaves estimadas</h3>';
    return `<div class="branch-tree">${title}${rounds.map(round => {
      const items = nodes.filter(n => n.round === round);
      if (!items.length) return '';
      return `<div class="branch-round"><div class="round-head">${esc(items[0].roundName || round)}</div>${items.map(n => {
        const options = n.revisionOpen ? (n.recoveryOptions || []).filter(t => t.code !== n.activePick) : (n.recoveryOptions || []);
        const actions = (n.recoveryOpen || n.revisionOpen) && options.length
          ? `<div class="branch-actions">${options.map(t => `<button class="btn sm" data-action="recovery-pick" data-node="${esc(n.nodeId)}" data-code="${esc(t.code)}">${flagImg(t.flag, 'flag flag-sm')} ${esc(t.name)}</button>`).join('')}</div>`
          : '';
        return `<div class="branch-node ${branchClass(n)}" data-action="branch-detail" data-node="${esc(n.nodeId)}">
          <span class="branch-team">${branchNodeMainV2(n)}</span><span class="branch-meta">${esc(branchLabel(n))}</span>${actions}
        </div>`;
      }).join('')}</div>`;
    }).join('')}</div>`;
  }
  function pickMapFromDetail(d) {
    const out = {};
    (d?.nodes || []).forEach(n => { if (n.originalPick) out[n.nodeId] = n.originalPick; });
    return out;
  }
  function currentPickMapFromDetail(d) {
    const out = {};
    (d?.nodes || []).forEach(n => {
      const pick = n.recoveryPick || n.originalPick;
      if (pick) out[n.nodeId] = pick;
    });
    return out;
  }
  function validRecoveryPickCount(tree, picks, detail, ids) {
    const cand = computeCandidatesWithReal(tree, picks, detail, ids);
    return ids.filter(id => {
      const pick = picks[id];
      const valid = [cand[id]?.a?.code, cand[id]?.b?.code].filter(Boolean);
      return pick && valid.includes(pick);
    }).length;
  }
  function bracketNodeDetailMap(d) {
    return Object.fromEntries((d?.nodes || []).map(n => [n.nodeId, n]));
  }
  function statusTeamsForNode(n, cand, detail) {
    if (detail?.match?.home && detail?.match?.away) return { a: detail.match.home, b: detail.match.away };
    const predicted = detail?.activePickTeam || detail?.recoveryPickTeam || null;
    const base = cand[n.id] || { a: null, b: null };
    if (!predicted) return base;
    if (base.a?.code === predicted.code || base.b?.code === predicted.code) return base;
    if (!base.a) return { a: predicted, b: base.b || null };
    if (!base.b) return { a: base.a, b: predicted };
    return base;
  }
  function statusSlotHtml(team, detail) {
    const code = team && team.code;
    const cls = ['slot'];
    const original = code && detail?.originalPick === code;
    const recovered = code && detail?.recoveryPick === code;
    const active = code && detail?.activePick === code;
    const actual = code && detail?.actualWinner === code;
    if (!code) cls.push('label');
    if (detail?.recoveryOpen) cls.push('action-required-option');
    if (detail?.revisionOpen) cls.push('optional-action-option');
    if (original || recovered) cls.push(recovered ? 'recovery-pick' : 'pick');
    if (detail?.resolved && actual) cls.push('actual-winner');
    if (detail?.hit && active && actual) cls.push('hit-pick');
    if (detail?.status === 'broken' && active && !actual) cls.push('broken-pick');
    if (!detail?.activePick && !detail?.recoveryOpen && (original || recovered)) cls.push('dead-pick');
    const name = team ? (code ? team.name : (team.label || '—')) : '—';
    const flag = team && team.flag ? flagImg(team.flag, 'flag flag-sm') : '';
    const tags = [
      original ? '<small>tu rama</small>' : '',
      recovered ? '<small>recuperada</small>' : '',
      actual ? '<small>paso real</small>' : '',
    ].filter(Boolean).join('');
    return `<div class="${cls.join(' ')}">${flag}<span class="scode">${esc(code || '')}</span><span class="sname">${esc(name)}${tags}</span></div>`;
  }
  function tieStatusText(n) {
    if (!n) return 'Pendiente';
    if (n.recoveryOpen) return 'Requiere accion';
    if (n.recoveryPending) return 'Rama rota · espera cierre de ronda';
    if (n.revisionOpen) return 'Puedes cambiar';
    if (n.hit) return `+${n.points || 0} · proximo +${n.nextValue || 0}`;
    if (n.status === 'broken') return 'Rama rota';
    if (n.branchType === 'recovered') return `Recuperada +${n.branchValue || bracketBaseV2()} si pasa`;
    if (n.branchType === 'original') return `Original +${n.branchValue || bracketBaseV2()} si pasa`;
    if (n.resolved && n.actualWinnerTeam) return `Paso ${n.actualWinnerTeam.name}`;
    return 'Sin rama activa';
  }
  function renderBracketStatusGrid(detail, compact = false) {
    const b = STATE.bracket, tree = b.tree;
    const nodes = bracketNodeDetailMap(detail);
    const picks = currentPickMapFromDetail(detail);
    const cand = computeCandidatesWithReal(tree, picks, detail, []);
    const cols = [
      { head: '1/16', nodes: tree.r32 },
      { head: '8vos', nodes: tree.r16 },
      { head: '4tos', nodes: tree.qf },
      { head: 'Semifinales', nodes: tree.sf },
      { head: 'Final', nodes: [tree.final] },
    ];
    const title = compact ? '' : '<h3 class="group-title">Arbol de llaves</h3>';
    const colHtml = cols.map(col => `
      <div class="round"><div class="round-head">${esc(col.head)}</div>
        ${col.nodes.map(node => {
          const nd = nodes[node.id] || null;
          const teams = statusTeamsForNode(node, cand, nd);
          const options = nd?.revisionOpen ? (nd.recoveryOptions || []).filter(t => t.code !== nd.activePick) : (nd?.recoveryOptions || []);
          const actions = (nd?.recoveryOpen || nd?.revisionOpen) && options.length
            ? `<div class="tie-actions">${options.map(t => `<button class="btn sm ${nd.recoveryOpen ? 'action-choice' : 'optional-choice'}" data-action="recovery-pick" data-node="${esc(nd.nodeId)}" data-code="${esc(t.code)}">${flagImg(t.flag, 'flag flag-sm')} ${esc(t.name)}</button>`).join('')}</div>`
            : '';
          return `<div class="tie status-tie ${branchClass(nd)} ${ui.branchDetailNode === node.id ? 'selected' : ''}" data-action="branch-detail" data-node="${esc(node.id)}">
            <div class="tie-status">${esc(tieStatusText(nd))}</div>
            ${statusSlotHtml(teams.a, nd)}
            ${statusSlotHtml(teams.b, nd)}
            ${actions}
          </div>`;
        }).join('')}
      </div>`).join('');
    return `${title}<div class="bracket-scroll"><div class="bracket bracket-status">${colHtml}</div></div>`;
  }
  function renderSelectedBranchDetail(d) {
    const n = (d?.nodes || []).find(x => x.nodeId === ui.branchDetailNode);
    if (!n) return '';
    const real = n.match ? `${esc(n.match.home.name)} - ${esc(n.match.away.name)}` : 'Cruce real no disponible';
    const hit = n.hit ? miniTeam(n.activePickTeam || n.actualWinnerTeam) : '<span class="sub">sin acierto</span>';
    const recovered = n.recoveryPickTeam ? miniTeam(n.recoveryPickTeam) : '<span class="sub">sin recuperacion</span>';
    const actual = n.actualWinnerTeam ? miniTeam(n.actualWinnerTeam) : '<span class="sub">pendiente</span>';
    const action = n.recoveryOpen
      ? `<div class="detail-line warn"><span>Accion pendiente</span><b>Recupera este cruce en amarillo</b></div>`
      : (n.revisionOpen ? `<div class="detail-line warn"><span>Cambio opcional</span><b>Puedes cambiar de equipo antes del partido</b></div>` : '');
    return `<div class="branch-detail-panel">
      <button class="btn ghost sm" data-action="branch-detail-close">Cerrar detalle</button>
      <div class="detail-line"><span>Ronda</span><b>${esc(n.roundName)}</b></div>
      <div class="detail-line"><span>Prediccion original</span>${miniTeam(n.originalPickTeam)}</div>
      <div class="detail-line"><span>Cruce real</span><b>${real}</b></div>
      <div class="detail-line"><span>Paso realmente</span>${actual}</div>
      <div class="detail-line"><span>Equipo acertado</span>${hit}</div>
      <div class="detail-line"><span>Rama recuperada</span>${recovered}</div>
      <div class="detail-line"><span>Puntos</span><b>+${n.points || 0}</b><span class="sub">Proximo valor: ${n.nextValue ? '+' + n.nextValue : 'sin racha activa'}</span></div>${action}
    </div>`;
  }
  function renderBracketDetail(d) {
    if (d?.locked) {
      const status = d.submitted
        ? `<span class="pts hit">Enviada${d.submittedAt ? ` ${fmt(d.submittedAt)}` : ''}</span>`
        : '<span class="pts">No enviada</span>';
      return `<div class="detail-card detail-wide"><h3>Llave</h3>
        <div class="detail-line"><span>Estado</span>${status}</div>
        <p class="sub">La prediccion de llaves se mostrara despues del inicio del primer partido: ${fmt(d.unlockAt)}.</p>
      </div>`;
    }
    if (!d || !d.submitted) return `<div class="detail-card"><h3>Llave</h3><p class="sub">Sin llave enviada.</p></div>`;
    const publicVisible = Array.isArray(d.visibleRounds);
    const rows = publicVisible ? (d.nodes || []) : (d.nodes || []).filter(n => n.resolved || n.recoveryOpen || n.recoveryPending).slice(0, 8);
    const nextUnlock = publicVisible && d.nextUnlockAt ? `<p class="sub">La siguiente ronda se mostrara al empezar: ${fmt(d.nextUnlockAt)}.</p>` : '';
    const bodyRows = rows.length
      ? rows.map(n => `<div class="detail-line ${n.hit ? 'ok' : ''}"><span>${esc(n.roundName)}</span>${branchNodeMainV2(n)}<b>${esc(branchLabel(n))}</b></div>`).join('')
      : `<p class="sub">${d.hasResult ? 'No tiene cruces acertados resueltos todavia.' : 'La llave aun no tiene resultados para comparar.'}</p>`;
    const body = `${nextUnlock}${bodyRows}`;
    const tree = ui.playerTreeOpen ? renderBracketStatusGrid(d, true) + renderSelectedBranchDetail(d) : '';
    const action = d.actionRequired ? ` · requiere accion ${d.actionRequired}` : '';
    return `<div class="detail-card detail-wide"><h3>Llave</h3>
      <p class="sub">${d.points || 0} pts · ${d.correct || 0} aciertos · ${d.originalLive || 0} originales vivas · ${d.recoveredLive || 0} recuperadas vivas · mejor +${d.bestActive || 0}${action}</p>
      <button class="btn sm" data-action="player-tree-toggle">${ui.playerTreeOpen ? 'Ocultar arbol' : 'Ver arbol de llaves estimadas'}</button>
      ${body}${tree}</div>`;
  }
  function startRecoveryEdit(nodeId, pick) {
    const tree = STATE.bracket.tree;
    const allowedIds = recoveryEditIds(tree, STATE.bracket.detail, nodeId);
    const picks = currentPickMapFromDetail(STATE.bracket.detail);
    if (pick) picks[nodeId] = pick;
    ui.recoveryEdit = { nodeId, allowedIds, picks, initialPicks: null };
    if (pick) propagateRecoveryPicks(tree, ui.recoveryEdit.picks, STATE.bracket.detail, allowedIds, nodeId);
    else fillRecoveryDefaults(tree, ui.recoveryEdit.picks, STATE.bracket.detail, allowedIds);
    ui.recoveryEdit.initialPicks = { ...ui.recoveryEdit.picks };
  }
  function ensureRecoveryEdit(detail) {
    if (ui.recoveryEdit) return ui.recoveryEdit;
    const first = openRecoveryNodes(detail)[0];
    if (!first) return null;
    startRecoveryEdit(first.nodeId, null);
    return ui.recoveryEdit;
  }
  function renderRecoveryConfirm() {
    const c = ui.recoveryConfirm;
    if (!c) return '';
    const detail = STATE.bracket.detail;
    const node = (detail?.nodes || []).find(n => n.nodeId === c.nodeId);
    const chosen = (node?.recoveryOptions || []).find(t => t.code === c.pick) || c.conflicts.conflicts.find(x => x.team?.code === c.pick)?.team || { code: c.pick, name: c.pick };
    const next = node?.advancesTo === 'CHAMP' ? 'campeon' : roundShort(node?.advancesTo || '');
    const gain = node?.activePick === c.pick ? (node?.branchValue || bracketBaseV2()) : bracketBaseV2();
    const conflictText = c.conflicts.conflicts.length
      ? `<p class="sub">Rompes ${c.conflicts.conflicts.length} racha${c.conflicts.conflicts.length === 1 ? '' : 's'} viva${c.conflicts.conflicts.length === 1 ? '' : 's'}, incluyendo ramas que vienen de la fase anterior, y renuncias a <b>+${c.conflicts.total}</b> puntos potenciales: ${c.conflicts.conflicts.map(x => `${esc(x.team?.name || x.team?.code || 'equipo')} (+${x.value})`).join(', ')}.</p>`
      : (node?.recoveryOpen ? `<p class="sub">Recuperas una rama rota. Si aciertas este cruce, suma <b>+${gain}</b> y la siguiente racha sube.</p>` : '<p class="sub">No rompes ninguna racha viva en este cambio.</p>');
    return `<div class="modal-backdrop" data-action="recovery-confirm-cancel">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="recovery-confirm-title" data-modal-card>
        <h3 id="recovery-confirm-title">Confirmar cambio de seguimiento</h3>
        <p>Si aceptas, ${miniTeam(chosen)} pasa a ${esc(next)} en tu arbol pendiente y se propagara hacia el campeon.</p>
        <p>Si acierta este cruce, suma <b>+${gain}</b>.</p>
        ${conflictText}
        <div class="modal-actions">
          <button class="btn ghost" data-action="recovery-confirm-cancel">Volver atras</button>
          <button class="btn primary" data-action="recovery-confirm-accept">${c.mode === 'edit' ? 'Aceptar cambio' : 'Aceptar y editar arbol'}</button>
        </div>
      </div>
    </div>`;
  }
  function renderRecoveryEditor() {
    const edit = ui.recoveryEdit;
    if (!edit) return '';
    const detail = STATE.bracket.detail;
    const node = (detail?.nodes || []).find(n => n.nodeId === edit.nodeId);
    const clearLabel = node?.roundName || 'esta ronda';
    const selectedCount = validRecoveryPickCount(STATE.bracket.tree, edit.picks, detail, edit.allowedIds);
    const complete = selectedCount === edit.allowedIds.length;
    const conflicts = recoveryConflictSummary(STATE.bracket.tree, detail, edit.picks, edit.allowedIds);
    const conflictNotice = conflicts.conflicts.length
      ? `<div class="notice warn">Recuerda: esta reedicion rompe ${conflicts.conflicts.length} racha viva, incluyendo ramas que vienen de la fase anterior. Renuncias a <b>+${conflicts.total}</b> puntos potenciales si esa rama pasaba: ${conflicts.conflicts.map(c => `${esc(c.team?.name || c.team?.code || 'equipo')} (+${c.value})`).join(', ')}.</div>`
      : '';
    return `<div class="recovery-editor">
      <div class="notice info"><b>Seguimiento de ${esc(clearLabel)}:</b> revisa el arbol pendiente hasta el campeon. Las ramas vivas quedan por defecto; puedes enviarlo aunque mantengas todo igual para dejar evidencia.</div>
      ${conflictNotice}
      ${renderBracketGrid(true, { picks: edit.picks, allowedIds: edit.allowedIds, action: 'recovery-edit-pick', detail })}
      <div class="sticky-submit"><span class="sub">${selectedCount}/${edit.allowedIds.length} cruces pendientes coherentes</span>
        <button class="btn ghost" data-action="recovery-edit-cancel">Cancelar</button>
        <button class="btn ghost" data-action="recovery-edit-clear-round">Restaurar inicio de ${esc(clearLabel)}</button>
        <button class="btn primary" data-action="recovery-edit-submit" ${complete ? '' : 'disabled'}>Enviar seguimiento del arbol</button>
      </div>
    </div>`;
  }
  function rulesBracket() {
    const base = bracketBaseV2();
    return `<div class="notice info">Reglas de la llave: cada rama viva empieza en <b>+${base}</b>. Si el equipo pasa, suma ese valor y la siguiente ronda sube otros <b>+${base}</b>. Si una rama se rompe, desaparece como prediccion activa y el cruce recuperable se marca en amarillo.</div>`;
  }
  function renderBracketSubmissionHistory(detail) {
    const history = (detail?.submissionHistory || []).filter(x => x.at);
    if (!history.length) return '';
    const latest = history[history.length - 1];
    const older = history.slice(0, -1).reverse();
    const latestLabel = latest.type === 'initial'
      ? `Enviaste tu llave de ${esc(latest.phaseName || '1/16')}`
      : `Enviaste seguimiento de ${esc(latest.phaseName || 'esta fase')}`;
    const latestMeta = latest.type === 'reedit'
      ? ` · ${latest.changed || 0} cambios, ${latest.reviewed || 0} revisados`
      : '';
    const current = `<div class="notice ok"><b>${latestLabel}</b> el ${fmt(latest.at)}${latestMeta}.</div>`;
    if (!older.length) return current;
    const rows = older.map(item => {
      const label = item.type === 'initial'
        ? `Llave de ${esc(item.phaseName || '1/16')}`
        : `Seguimiento de ${esc(item.phaseName || 'fase')}`;
      const meta = item.type === 'reedit' ? ` · ${item.changed || 0} cambios` : '';
      return `<div class="detail-line"><span>${label}</span><b>${fmt(item.at)}${meta}</b></div>`;
    }).join('');
    return current + `<details class="notice info bracket-history"><summary>Historial de envios anteriores</summary>${rows}</details>`;
  }
  function renderBracket() {
    const b = STATE.bracket;
    const head = `<div class="section-head"><h2>Llave eliminatoria</h2><p>Elige quien avanza en cada cruce hasta el campeon. Se envia <b>una sola vez</b>.</p></div>`;
    const submittedHead = `<div class="section-head"><h2>Llave eliminatoria</h2><p>Tu llave ya fue enviada. El arbol se actualiza con los equipos reales que avanzan.</p></div>`;
    if (b.submitted) {
      const actionCount = b.detail?.actionRequired || 0;
      const pendingCount = b.detail?.recoveryPending || 0;
      const editCount = openRecoveryNodes(b.detail).length;
      const actionNotice = actionCount
        ? `<button class="notice warn action-jump" data-action="bracket-view" data-view="tracking">Requiere accion: tienes ${actionCount} cruce${actionCount === 1 ? '' : 's'} pendiente${actionCount === 1 ? '' : 's'}. Abrir seguimiento.</button>`
        : (editCount
          ? `<button class="notice info action-jump" data-action="bracket-view" data-view="tracking">Seguimiento disponible: revisa ${editCount} cruce${editCount === 1 ? '' : 's'} antes de enviar el arbol pendiente.</button>`
          : (pendingCount
          ? `<div class="notice info">${pendingCount} rama${pendingCount === 1 ? '' : 's'} rota${pendingCount === 1 ? '' : 's'}. La recuperacion se abrira cuando cierre la ronda completa.</div>`
          : `<div class="notice ok">Sin acciones pendientes ahora mismo.</div>`));
      const view = ui.bracketView || 'tree';
      const switcher = `<div class="segmented">
        <button class="${view === 'tree' ? 'active' : ''}" data-action="bracket-view" data-view="tree">Tu arbol actual</button>
        <button class="${view === 'tracking' ? 'active' : ''}" data-action="bracket-view" data-view="tracking">Seguimiento</button>
      </div>`;
      const currentPicks = currentPickMapFromDetail(b.detail);
      const fullTree = `<h3 class="group-title">Tu arbol actual</h3>${renderBracketGrid(false, { picks: currentPicks, detail: b.detail, useReal: true })}`;
      if (view === 'tracking') ensureRecoveryEdit(b.detail);
      const trackingBody = renderRecoveryEditor() || (renderBracketStatusGrid(b.detail, true) + renderSelectedBranchDetail(b.detail));
      const trackingTitle = 'Seguimiento del arbol';
      const tracking = `<h3 class="group-title">${trackingTitle}</h3>${trackingBody}${renderRecoveryConfirm()}`;
      return submittedHead + renderBracketSubmissionHistory(b.detail) + rulesBracket() + actionNotice + switcher + (view === 'tracking' ? tracking : fullTree);
    }
    if (!b.window.open) {
      const why = b.window.passedDeadline ? 'La llave ya esta cerrada.' : 'La llave se abrira cuando terminen los grupos y se conozcan los 32 equipos.';
      return head + `<div class="notice info">${why} Vista previa del cuadro:</div>` + renderBracketGrid(false);
    }
    if (!ui.bracketPicks) ui.bracketPicks = { ...(b.yourPicks || {}) };
    const total = b.tree.r32.length + b.tree.r16.length + b.tree.qf.length + b.tree.sf.length + 1;
    const done = Object.keys(ui.bracketPicks).filter(k => ui.bracketPicks[k]).length;
    const complete = done >= total;
    const deadline = bettingDeadlineText(b.window?.deadline);
    return head + rulesBracket() +
      `<div class="notice warn">Se acepta envio de llaves ${deadline}. Una vez envies, <b>no podras cambiarlo</b>.</div>` +
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
  function projectedFinalChampion() {
    const finalNode = (STATE?.bracket?.detail?.nodes || []).find(n => n.round === 'FINAL');
    return finalNode?.activePickTeam || null;
  }
  function syncFinalFormLegacy() {
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
  function syncFinalForm() {
    const f = STATE && STATE.final;
    if (!f || !f.teams || ui.tab !== 'final') return;
    const A = f.teams.home, B = f.teams.away, fs = ui.finalScore || {};
    const readyScore = finalScoreReady(fs);
    const isDraw = finalScoreDraw(fs);
    const implied = finalChampionFromScore(A, B, fs);
    const projected = projectedFinalChampion();
    const chosenCode = isDraw ? ui.finalChamp : implied?.code;
    const contradicts = !!(projected && chosenCode && chosenCode !== projected.code);
    const ready = readyScore && (!isDraw || !!ui.finalChamp) && !contradicts;
    const champWrap = document.querySelector('[data-final-champ-wrap]');
    const impliedBox = document.querySelector('[data-final-implied]');
    const status = document.querySelector('[data-final-status]');
    const btn = document.querySelector('[data-action="final-submit"]');
    document.querySelectorAll('[data-action="final-champ"]').forEach(x => x.classList.toggle('sel', ui.finalChamp === x.dataset.code));
    if (champWrap) champWrap.style.display = isDraw ? '' : 'none';
    if (impliedBox) {
      impliedBox.style.display = implied ? '' : 'none';
      impliedBox.textContent = implied ? `Campeon segun tu marcador: ${implied.name}` : '';
    }
    if (status) status.textContent = contradicts ? `debe ganar ${projected.name}` : (ready ? 'listo para enviar' : (isDraw ? 'elige campeon' : 'pon el marcador'));
    if (btn) btn.disabled = !ready;
  }

  function finalFormLegacy(A, B) {
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
        <button class="btn primary" data-action="final-submit" ${ready ? '' : 'disabled'}>Enviar prediccion de la final (definitivo)</button></div>`;
  }
  function renderFinalLegacy() {
    const f = STATE.final;
    const head = `<div class="section-head"><h2>🏆 La Final</h2><p>Predice el <b>marcador exacto</b>. El campeón se deduce del marcador; si pronosticas empate, eliges quién levanta la copa. Se envía una sola vez.</p></div>`;
    const submittedHead = `<div class="section-head"><h2>🏆 La Final</h2><p>Tu prediccion de la final ya fue enviada. Revisa tu marcador, campeón elegido y puntos conseguidos.</p></div>`;
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
      return submittedHead + `<div class="notice ok">Tu prediccion: <b>${esc(A.name)} ${f.your.score.home}-${f.your.score.away} ${esc(B.name)}</b> · campeón: <b>${esc(champName(f.your.champion))}</b> (enviada ${fmt(f.submittedAt)}).</div>` + res + finalCard(A, B, f);
    }
    if (!f.open) return head + `<div class="notice info">La prediccion de la final está cerrada.</div>` + finalCard(A, B, f);
    return head + rules + `<div class="notice warn">⚠️ Una sola vez. Pon el marcador; solo tendrás que elegir campeón si marcas empate.</div>` + finalForm(A, B);
  }

  function finalForm(A, B) {
    const champ = ui.finalChamp, fs = ui.finalScore || {};
    const teamBtn = (T) => `<button class="champ-btn ${champ === T.code ? 'sel' : ''}" data-action="final-champ" data-code="${esc(T.code)}">${flagImg(T.flag)}<span>${esc(T.name)}</span></button>`;
    const isDraw = finalScoreDraw(fs);
    const implied = finalChampionFromScore(A, B, fs);
    const projected = projectedFinalChampion();
    const chosenCode = isDraw ? champ : implied?.code;
    const contradicts = !!(projected && chosenCode && chosenCode !== projected.code);
    const ready = finalScoreReady(fs) && (!isDraw || !!champ) && !contradicts;
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
        <p class="sub" data-final-implied style="text-align:center;margin:.8rem 0 .3rem;${implied ? '' : 'display:none'}">${implied ? `Campeon segun tu marcador: ${esc(implied.name)}` : ''}</p>
        <div data-final-champ-wrap style="${isDraw ? '' : 'display:none'}">
          <p class="sub" style="text-align:center;margin:.8rem 0 .3rem">Si pronosticas empate tras prorroga, elige quien gana en penales.</p>
          <div class="champ-pick">${teamBtn(A)}${teamBtn(B)}</div>
        </div>
      </div>
      <div class="sticky-submit"><span class="sub" data-final-status>${contradicts ? `debe ganar ${esc(projected.name)}` : (ready ? 'listo para enviar' : (isDraw ? 'elige campeon' : 'pon el marcador'))}</span>
        <button class="btn primary" data-action="final-submit" ${ready ? '' : 'disabled'}>Enviar prediccion de la final (definitivo)</button></div>`;
  }
  function renderFinal() {
    const f = STATE.final;
    const head = `<div class="section-head"><h2>La Final</h2><p>Predice el <b>marcador exacto</b>. Si marcas empate tras prorroga, debes elegir el ganador en penales.</p></div>`;
    const submittedHead = `<div class="section-head"><h2>La Final</h2><p>Tu prediccion de la final ya fue enviada.</p></div>`;
    if (!f.teams) return head + `<div class="empty">Se abrira cuando se conozcan los dos finalistas.</div>`;
    const A = f.teams.home, B = f.teams.away;
    const champName = (code) => code === A.code ? A.name : (code === B.code ? B.name : '—');
    const rules = `<div class="notice info">Reglas: <b>${f.rules.exactScore} pts</b> por marcador exacto y <b>+${f.rules.championBonus} pts</b> por acertar el campeon. En empate, debes acertar tambien quien gana en penales.</div>`;
    const projected = projectedFinalChampion();
    const projectedNotice = projected ? `<div class="notice info">Tu llave mantiene como campeon proyectado a <b>${esc(projected.name)}</b>. El marcador de final debe ser acorde.</div>` : '';
    if (f.submitted) {
      let res = '';
      if (f.actual) {
        const ps = f.your.score, as = f.actual.score;
        const exact = ps.home === as.home && ps.away === as.away;
        const champHit = f.your.champion && f.actual.winner && f.your.champion === f.actual.winner;
        res = `<div class="notice ${exact || champHit ? 'ok' : 'warn'}">Final real: ${as.home}-${as.away}, campeon ${esc(champName(f.actual.winner))}. ${exact ? 'marcador exacto acertado' : 'marcador exacto fallado'}${champHit ? ' · campeon acertado' : ''}</div>`;
      }
      return submittedHead + `<div class="notice ok">Tu prediccion: <b>${esc(A.name)} ${f.your.score.home}-${f.your.score.away} ${esc(B.name)}</b> · campeon: <b>${esc(champName(f.your.champion))}</b> (enviada ${fmt(f.submittedAt)}).</div>` + res + finalCard(A, B, f);
    }
    if (!f.open) return head + `<div class="notice info">La prediccion de la final esta cerrada.</div>` + finalCard(A, B, f);
    return head + rules + projectedNotice + `<div class="notice warn">Una sola vez. Pon el marcador; solo tendras que elegir campeon si marcas empate.</div>` + finalForm(A, B);
  }

  // ----------------------------------------------------- Bota de Oro -------
  function mvpGrid(m, selected) {
    const players = (m.window?.passedDeadline && m.liveScorers?.length) ? m.liveScorers : m.candidates;
    return `<div class="mvp-grid">${players.map(p => {
      const sel = selected === p.id || (m.submitted && m.yourPick === p.id);
      const flag = flagImg(p.flag, 'flag flag-lg');
      const click = (m.open && !m.submitted) ? ` data-action="mvp-pick" data-player="${esc(p.id)}"` : '';
      const star = m.actual === p.id ? ' ⭐' : '';
      const goals = p.goals != null ? ` · ${p.goals} goles` : '';
      return `<div class="mvp-card ${sel ? 'sel' : ''}"${click}>${flag}<div><div class="mvp-name">${esc(p.name)}${star}</div><div class="sub">${esc(p.team)}${goals}</div></div></div>`;
    }).join('')}</div>`;
  }
  function mvpSubmittedSummary(m) {
    const frozenPick = m.candidates.find(p => p.id === m.yourPick);
    const live = (m.window?.passedDeadline && m.liveScorers?.length) ? m.liveScorers : m.candidates;
    const livePick = live.find(p => p.id === m.yourPick);
    const pick = livePick || frozenPick;
    const top = live.slice(0, 5);
    const row = (p, i, extra = '') => {
      const goals = p?.goals != null ? `${p.goals} goles` : 'goles no disponibles';
      return `<div class="mvp-row ${p?.id === m.yourPick ? 'sel' : ''}"><span>${i ? `${i}.` : 'Tu eleccion'}</span>${flagImg(p?.flag, 'flag flag-sm')}<b>${esc(p?.name || '—')}</b><em>${esc(goals)}</em>${extra}</div>`;
    };
    const actual = m.actual
      ? (m.actual === m.yourPick ? `<span class="pts hit">+${m.points} pts</span>` : '<span class="pts">+0 pts</span>')
      : '<span class="pts">Pendiente</span>';
    const updatedAt = m.liveScorersAt ? `<p class="sub">Goleadores actualizados: ${fmt(m.liveScorersAt)}</p>` : '';
    return `<div class="mvp-compact">
      ${row(pick, 0, actual)}
      <h3>Top 5 goleadores del Mundial</h3>
      ${updatedAt}
      ${top.map((p, i) => row(p, i + 1)).join('')}
    </div>`;
  }
  function renderMvp() {
    const m = STATE.mvp;
    const source = m.candidatesSource === 'api-scorers'
      ? 'Candidatos congelados desde football-data.org al abrirse la llave.'
      : (m.candidatesSource === 'test' ? 'Candidatos ficticios del modo pruebas.' : 'Candidatos manuales de respaldo.');
    const head = `<div class="section-head"><h2>⭐ Bota de Oro</h2><p>Elige el goleador del torneo entre los 20 mejores goleadores de la fase de grupos. Se envía <b>una sola vez</b>.</p></div>`;
    const submittedHead = `<div class="section-head"><h2>⭐ Bota de Oro</h2><p>Tu prediccion de Bota de Oro ya fue enviada. Revisa el jugador elegido y si suma puntos.</p></div>`;
    const rules = `<div class="notice info">Reglas: <b>${m.points} pts</b> si aciertas el goleador del torneo. ${source} Ejemplo: eliges a un goleador de la lista y termina ganando la Bota de Oro, sumas ${m.points} pts; si gana otro jugador, sumas 0.</div>`;
    if (m.submitted) return submittedHead + `<div class="notice ok">Enviada ${fmt(m.submittedAt)}. No se puede cambiar.</div>` + mvpSubmittedSummary(m);
    if (m.submitted) {
      const pick = m.candidates.find(p => p.id === m.yourPick);
      let res = '';
      if (m.actual) res = (m.actual === m.yourPick)
        ? `<div class="notice ok">✓ ¡Acertaste la Bota de Oro! +${m.points} pts</div>`
        : `<div class="notice warn">Esta vez no acertaste la Bota de Oro.</div>`;
      return submittedHead + rules + `<div class="notice ok">Tu prediccion: <b>${esc(pick ? pick.name : '—')}</b> (enviada ${fmt(m.submittedAt)}). No se puede cambiar.</div>` + res + mvpGrid(m, null);
    }
    if (!m.open) {
      const why = (m.window && m.window.passedDeadline) ? 'La prediccion de Bota de Oro ya está cerrada.' : 'Se abrirá en la fase eliminatoria (cuando terminen los grupos).';
      return head + rules + `<div class="notice info">${why} Estos son los candidatos previstos:</div>` + mvpGrid(m, null);
    }
    return head + rules
      + `<div class="notice warn">Se acepta envio de Bota de Oro ${bettingDeadlineText(m.window?.deadline)}. Una sola vez: elige un jugador y envia.</div>`
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
        ui.playerProfile = null;
        if (ui.tab === 'admin') { render(); refreshAdmin(); } else render();
      } else if (a === 'rank-user') {
        try {
          ui.playerProfile = await api(`/users/${encodeURIComponent(t.dataset.user)}/group-predictions`);
          ui.playerTreeOpen = false;
          ui.branchDetailNode = null;
          ui.tab = 'player';
          render();
        } catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'player-back') {
        ui.playerProfile = null;
        ui.tab = 'ranking';
        render();
      } else if (a === 'player-tree-toggle') {
        ui.playerTreeOpen = !ui.playerTreeOpen;
        ui.branchDetailNode = null;
        render();
      } else if (a === 'branch-detail') {
        ui.branchDetailNode = t.dataset.node;
        ui.playerTreeOpen = true;
        render();
      } else if (a === 'branch-detail-close') {
        ui.branchDetailNode = null;
        render();
      } else if (a === 'logout') {
        try { await api('/logout', { method: 'POST' }); } catch {}
        STATE = null; ME = null; ui.tab = 'ranking'; ui.playerProfile = null; renderLogin();
      } else if (a === 'pick') {
        ui.bracketPicks = ui.bracketPicks || {};
        ui.bracketPicks[t.dataset.node] = t.dataset.code;
        prunePicks(STATE.bracket.tree, ui.bracketPicks);
        render();
      } else if (a === 'bracket-view') {
        ui.bracketView = t.dataset.view || 'tree';
        if (ui.bracketView !== 'tracking') { ui.recoveryEdit = null; ui.recoveryConfirm = null; }
        render();
      } else if (a === 'bracket-submit') {
        try { await api('/bracket', { method: 'POST', body: JSON.stringify({ picks: ui.bracketPicks }) }); ui.bracketPicks = null; setNotice('✓ Llave enviada.', 'ok'); await loadState(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'recovery-pick') {
        ui.bracketView = 'tracking';
        startRecoveryConfirm(t.dataset.node, t.dataset.code);
        render();
      } else if (a === 'recovery-confirm-cancel') {
        if (t.classList.contains('modal-backdrop') && e.target !== t) return;
        ui.recoveryConfirm = null;
        render();
      } else if (a === 'recovery-confirm-accept') {
        if (!ui.recoveryConfirm) return;
        const { nodeId, pick, allowedIds, picks, mode } = ui.recoveryConfirm;
        ui.recoveryConfirm = null;
        if (mode === 'edit') ui.recoveryEdit = { nodeId: ui.recoveryEdit?.nodeId || nodeId, allowedIds, picks, initialPicks: ui.recoveryEdit?.initialPicks || { ...picks } };
        else startRecoveryEdit(nodeId, pick);
        render();
      } else if (a === 'recovery-edit-pick') {
        if (!ui.recoveryEdit) return;
        const nodeId = t.dataset.node;
        const by = detailByNode(STATE.bracket.detail);
        const node = by[nodeId];
        const draft = recoveryDraft(nodeId, t.dataset.code, ui.recoveryEdit);
        const currentConflicts = recoveryConflictSummary(STATE.bracket.tree, STATE.bracket.detail, ui.recoveryEdit.picks, ui.recoveryEdit.allowedIds);
        const cand = computeCandidatesWithReal(STATE.bracket.tree, ui.recoveryEdit.picks, STATE.bracket.detail, ui.recoveryEdit.allowedIds);
        const valid = [cand[nodeId]?.a?.code, cand[nodeId]?.b?.code].filter(Boolean);
        const plannedContinuations = [node?.activePick, node?.recoveryPick, node?.originalPick].filter(Boolean);
        const branchInfo = draftBranchInfoMap(STATE.bracket.tree, STATE.bracket.detail, ui.recoveryEdit.picks, ui.recoveryEdit.allowedIds);
        const breaksIncoming = incomingLiveBranches(STATE.bracket.tree, STATE.bracket.detail, nodeId, valid, branchInfo).some(br => plannedContinuations.includes(br.code) && br.code !== t.dataset.code);
        const breaksLive = !!(node?.branchType && !node.resolved && node.activePick && t.dataset.code !== node.activePick) || breaksIncoming;
        if (breaksLive || draft.conflicts.total > currentConflicts.total) startRecoveryConfirm(nodeId, t.dataset.code, ui.recoveryEdit);
        else ui.recoveryEdit.picks = draft.picks;
        render();
      } else if (a === 'recovery-edit-cancel') {
        ui.recoveryEdit = null;
        render();
      } else if (a === 'recovery-edit-clear-round') {
        if (!ui.recoveryEdit) return;
        ui.recoveryEdit.picks = { ...(ui.recoveryEdit.initialPicks || currentPickMapFromDetail(STATE.bracket.detail)) };
        fillRecoveryDefaults(STATE.bracket.tree, ui.recoveryEdit.picks, STATE.bracket.detail, ui.recoveryEdit.allowedIds);
        render();
      } else if (a === 'recovery-edit-submit') {
        try {
          await api('/bracket/recovery', { method: 'POST', body: JSON.stringify({ nodeId: ui.recoveryEdit.nodeId, picks: ui.recoveryEdit.picks }) });
          ui.recoveryEdit = null;
          ui.recoveryConfirm = null;
          ui.branchDetailNode = null;
          ui.bracketView = 'tree';
          setNotice('Reedicion del arbol enviada.', 'ok');
          await loadState();
        }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'mvp-pick') {
        ui.mvpPick = t.dataset.player; render();
      } else if (a === 'mvp-submit') {
        try { await api('/mvp', { method: 'POST', body: JSON.stringify({ playerId: ui.mvpPick }) }); ui.mvpPick = null; setNotice('✓ Prediccion de Bota de Oro enviada.', 'ok'); await loadState(); }
        catch (err) { setNotice(err.message, 'err'); render(); }
      } else if (a === 'final-champ') {
        ui.finalChamp = t.dataset.code; render();
      } else if (a === 'final-submit') {
        try { await api('/final', { method: 'POST', body: JSON.stringify({ score: ui.finalScore, champion: ui.finalChamp }) }); ui.finalChamp = null; ui.finalScore = {}; setNotice('✓ Prediccion de la final enviada.', 'ok'); await loadState(); }
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
      } else if (f.id === 'chat-form') {
        const d = new FormData(f);
        try {
          await api('/chat', { method: 'POST', body: JSON.stringify({ text: d.get('text') }) });
          f.reset();
          await loadState();
        } catch (err) { setNotice(err.message, 'err'); render(); }
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
