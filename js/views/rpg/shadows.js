// Panel «Sombras» de la ficha: una tarjeta por sombra con sus contrahechizos, la tira de los últimos 14 días
// (vacío / apareció / purificada), el recuento del mes y «Apareció hoy» (con «Deshacer»). Con 4 apariciones en 14 días,
// la oferta de convertirla en jefe. «Frecuencia» abre las barras de los últimos 6 meses. Nunca toca la XP.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util;
  var MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function stripHtml(s) {
    var label = { none: 'no apareció', ap: 'apareció', ok: 'purificada' };
    return '<ol class="sh-strip" aria-label="Últimos ' + R.SHADOW_STRIP + ' días">' + s.strip.map(function (d, i) {
      return '<li class="sh-day" data-state="' + d.state + '"' + (i === s.strip.length - 1 ? ' data-today="true"' : '') + ' title="' + esc(U.fmtDay(d.day)) + ': ' + label[d.state] + '">' +
        '<span class="sr">' + esc(U.fmtDay(d.day)) + ': ' + label[d.state] + '</span></li>';
    }).join('') + '</ol><p class="sh-strip-cap" aria-hidden="true"><span>hace ' + R.SHADOW_STRIP + ' días</span><span>hoy</span></p>';
  }
  function card(s, actNames, busyId) {
    var counters = s.counters.map(function (id) { return '<b>' + esc(actNames[id] || 'Actividad') + '</b>'; }).join(' · ');
    var now = s.today
      ? '<p class="sh-now' + (s.today.purified ? ' ok' : '') + '">' + (s.today.purified ? 'Apareció hoy · purificada' : 'Apareció hoy · sin purificar') +
        (s.today.from === 'diario' ? ' <span class="soft">(desde el diario)</span>' : '') + '</p>' +
        '<button type="button" class="sh-undo" data-act="sh-undo" data-id="' + esc(s.id) + '"' + (busyId === s.id ? ' disabled' : '') + '>Deshacer</button>'
      : '<button type="button" class="btn sh-appear" data-act="sh-appear" data-id="' + esc(s.id) + '"' + (busyId === s.id ? ' disabled' : '') + '>Apareció hoy</button>';
    return '<li class="sh-card has-edit' + (s.today && !s.today.purified ? ' sh-live' : '') + '" data-id="' + esc(s.id) + '">' +
      '<div class="sh-top"><span class="sh-ic">' + icon(s.icon) + '</span><div class="sh-id"><h3>' + esc(s.name) + '</h3>' +
        '<p class="sh-counter">Contrahechizos: ' + (counters || '<span class="soft">ninguno</span>') + '</p></div></div>' +
      stripHtml(s) +
      '<p class="sh-stat">Este mes: <b>' + plural(s.monthCount, 'aparición', 'apariciones') + '</b> · <b>' + s.monthPurified + '</b> ' + (s.monthPurified === 1 ? 'purificada' : 'purificadas') + '</p>' +
      '<div class="sh-act">' + now + '</div>' +
      (s.offer ? '<div class="sh-offer"><p>' + esc(s.name) + ' ha aparecido <b>' + s.recentCount + ' veces en ' + R.SHADOW_OFFER.days + ' días</b>. ¿La conviertes en un jefe para enfrentarla poco a poco?</p>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="sh-boss" data-id="' + esc(s.id) + '">Convertir en jefe</button>' +
        '<button type="button" class="btn secondary" data-act="sh-offer-no" data-id="' + esc(s.id) + '">Ahora no</button></div></div>' : '') +
      App.ui.editButton('data-act="sh-edit" data-id="' + esc(s.id) + '"', 'Editar ' + s.name) + '</li>';
  }

  // Barras apiladas por mes: purificadas abajo (rosa), sin purificar encima (lavanda). Una escala, el total encima.
  function chart(rows) {
    var W = 560, H = 230, L = 34, B = 196, T = 24, n = rows.length, step = (W - L - 10) / n, bw = Math.min(46, step - 14);
    var top = rows.reduce(function (m, r) { return Math.max(m, r.purified + r.open); }, 0);
    var max = Math.max(4, Math.ceil(top / 2) * 2), ticks = [0, max / 2, max];
    function y(v) { return B - (B - T) * v / max; }
    function bar(x, base, h, round) {
      if (h <= 0) return '';
      var r = round ? Math.min(4, h) : 0, t = base - h;
      return 'M' + x + ',' + base + 'V' + (t + r) + (r ? 'Q' + x + ',' + t + ' ' + (x + r) + ',' + t : '') + 'H' + (x + bw - r) + (r ? 'Q' + (x + bw) + ',' + t + ' ' + (x + bw) + ',' + (t + r) : '') + 'V' + base + 'Z';
    }
    var out = '<svg class="sh-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Apariciones por mes: ' + rows.map(function (r) {
      return MONTHS[Number(r.key.slice(5)) - 1] + ' ' + (r.purified + r.open) + ' (' + r.purified + ' purificadas)';
    }).join(', ') + '">';
    ticks.forEach(function (v) { out += '<line class="shc-grid" x1="' + L + '" x2="' + (W - 6) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="shc-axis" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>'; });
    rows.forEach(function (r, i) {
      var x = L + step * i + (step - bw) / 2, tot = r.purified + r.open, hOk = (B - T) * r.purified / max, hAp = (B - T) * r.open / max, mon = MONTHS[Number(r.key.slice(5)) - 1];
      if (r.purified) out += '<path class="shc-ok" d="' + bar(x, B, hOk, !r.open) + '"/>';
      if (r.open) out += '<path class="shc-ap" d="' + bar(x, B - hOk - (r.purified ? 2 : 0), Math.max(1, hAp - (r.purified ? 2 : 0)), true) + '"/>';
      out += '<text class="shc-val" x="' + (x + bw / 2) + '" y="' + (y(tot) - 6) + '" text-anchor="middle">' + tot + '</text>' +
        '<text class="shc-axis" x="' + (x + bw / 2) + '" y="' + (B + 18) + '" text-anchor="middle">' + mon + '</text>' +
        '<g class="shc-hit" tabindex="0"><title>' + mon + ': ' + plural(tot, 'aparición', 'apariciones') + ' · ' + r.purified + ' purificadas · ' + r.open + ' sin purificar</title>' +
        '<rect x="' + (x - 6) + '" y="' + T + '" width="' + (bw + 12) + '" height="' + (B - T) + '" fill="transparent"/></g>';
    });
    return out + '</svg>';
  }

  V.shadowPanel = function (host, ctx) {
    var shadows = ctx.shadows, acts = ctx.acts;
    host.innerHTML = '<div class="col-head"><h2>Sombras</h2><div class="sh-tools"><button type="button" class="btn secondary" data-act="sh-stats" aria-haspopup="dialog">Frecuencia</button>' +
      '<button type="button" class="btn secondary" data-act="sh-new" aria-haspopup="dialog">Nueva sombra</button></div></div>' +
      '<p class="soft col-lead">Apuntar que apareció nunca quita XP. Una sombra queda purificada si ese día o el siguiente registras uno de sus contrahechizos.</p>' +
      '<p class="msg" id="sh-msg" role="status" data-kind="ok"></p><div id="sh-body"></div>' +
      '<dialog class="confirm rpg-dialog sh-dialog" id="sh-dialog" aria-labelledby="sh-dtitle"></dialog>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#sh-body');
    var state = null, actList = [], form = null, busy = null, statsFor = null;

    function actNames() { var o = {}; actList.forEach(function (a) { o[a.id] = a.name; }); return o; }
    function say(t, kind) { var el = $('#sh-msg'); el.textContent = t || ''; el.setAttribute('data-kind', kind || 'ok'); }
    function dlg() { return $('#sh-dialog'); }
    function dmsg(t) { var el = $('#sh-dmsg'); if (el) el.textContent = t || ''; }

    function paint() {
      var names = actNames(), live = state.shadows, arch = state.archived;
      body.innerHTML = (live.length ? '<ul class="sh-list">' + live.map(function (s) { return card(s, names, busy); }).join('') + '</ul>' +
          '<p class="sh-legend" aria-hidden="true"><span><i data-state="none"></i>No apareció</span><span><i data-state="ap"></i>Apareció</span><span><i data-state="ok"></i>Purificada</span></p>'
        : '<div class="sh-empty"><p>Todavía no tienes sombras. Una sombra es algo que vuelve y no quieres que mande: el insomnio, rumiar, el móvil a deshoras.</p>' +
          '<p class="soft">Le pones sus contrahechizos (actividades) y, cuando aparezca, lo apuntas con un toque. Nunca quita XP.</p></div>') +
        (arch.length ? '<details class="archived"><summary>Archivadas (' + arch.length + ')</summary><ul class="sh-arch">' + arch.map(function (s) {
          return '<li><span class="sh-ic">' + icon(s.icon) + '</span><span>' + esc(s.name) + '</span><button type="button" class="mini" data-act="sh-restore" data-id="' + esc(s.id) + '">Recuperar</button></li>';
        }).join('') + '</ul></details>' : '');
      if (App.ui.enhanceMenus) App.ui.enhanceMenus(body);
    }
    function reload() {
      return Promise.all([shadows.state(), acts ? acts.list() : []]).then(function (r) { state = r[0]; actList = r[1]; paint(); });
    }
    // Tras apuntar, deshacer o editar: se repinta el panel y la ficha (el glitch del avatar y «Estado actual»).
    function changed(msg) { return reload().then(function () { if (msg !== undefined) say(msg); return ctx.onShadows ? ctx.onShadows() : null; }); }
    function run(id, job, okMsg) {
      if (busy) return; busy = id; paint();
      return job().then(function () { busy = null; return changed(okMsg); }, function (e) { busy = null; paint(); say((e && e.message) || 'No se pudo guardar.', 'error'); });
    }

    // ---- Crear o editar ----
    function counterCaps() {
      return actList.filter(function (a) { return !a.archived || form.counters.indexOf(a.id) >= 0; }).map(function (a) {
        return '<li><button type="button" class="emo-cap act-cap" data-sh-counter="' + esc(a.id) + '" aria-pressed="' + (form.counters.indexOf(a.id) >= 0) + '">' + icon(a.icon) + '<span>' + esc(a.name) + '</span></button></li>';
      }).join('');
    }
    function openForm(s) {
      form = { id: s ? s.id : null, counters: s ? s.counters.slice() : [], archived: s ? s.archived : false };
      dlg().innerHTML = '<h3 id="sh-dtitle">' + (s ? 'Editar sombra' : 'Nueva sombra') + '</h3>' +
        '<label class="field"><span>Nombre</span><input id="shf-name" type="text" maxlength="' + R.SHADOW_LIMITS.name + '" autocomplete="off" value="' + esc(s ? s.name : '') + '" placeholder="Por ejemplo, Insomnio"></label>' +
        U.symbolGrid('shf-icon', R.ICONS, s ? s.icon : 'moon') +
        '<fieldset class="shares"><legend>Contrahechizos</legend><p class="soft">Las actividades que la purifican si las registras ese día o el siguiente. No dan XP extra.</p>' +
          '<ul class="emo-caps act-caps" id="shf-counters" aria-label="Contrahechizos">' + counterCaps() + '</ul></fieldset>' +
        '<p class="msg" id="sh-dmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="shf-save">Guardar</button>' +
          (s ? '<button type="button" class="btn secondary" data-act="shf-archive">Archivar</button>' : '') +
          '<button type="button" class="btn secondary" data-act="shf-close">Cancelar</button></div>' +
        (s ? '<p class="soft">Archivar la esconde; sus apariciones (su historial) se quedan.</p>' : '');
      if (!dlg().open) dlg().showModal();
      var n = $('#shf-name'); if (n && n.focus) n.focus();
    }
    function checkedIcon() { var el = dlg().querySelector('input[name="shf-icon"]:checked'); return el ? el.value : 'moon'; }

    // ---- Frecuencia ----
    function openStats(id) {
      statsFor = id || null;
      var all = state.all, rows = R.shadowStats(all, state.appearances, state.entries, state.today, statsFor, 6);
      var last = rows[rows.length - 1], prev = rows[rows.length - 2], tl = last.purified + last.open, tp = prev.purified + prev.open;
      var withData = all.filter(function (s) { return !s.archived || state.appearances.some(function (a) { return a.shadow === s.id; }); });
      dlg().innerHTML = '<h3 id="sh-dtitle">Frecuencia de tus sombras</h3>' +
        '<div class="rd-compare sh-seg" role="group" aria-label="Sombra"><button type="button" data-act="sh-stats-for" data-id="" aria-pressed="' + !statsFor + '">Todas</button>' +
          withData.map(function (s) { return '<button type="button" data-act="sh-stats-for" data-id="' + esc(s.id) + '" aria-pressed="' + (statsFor === s.id) + '">' + esc(s.name) + '</button>'; }).join('') + '</div>' +
        chart(rows) +
        '<p class="rd-legend sh-chart-legend"><span><i class="k-ok"></i>Purificadas</span><span><i class="k-ap"></i>Sin purificar</span></p>' +
        '<ul class="sh-facts"><li>Este mes<b>' + tl + '</b></li><li>Purificadas este mes<b>' + last.purified + ' de ' + tl + '</b></li><li>Mes pasado<b>' + tp + '</b></li></ul>' +
        '<p class="soft">Los últimos 6 meses. Solo cuenta lo que tú has apuntado: no hay rachas ni castigos.</p>' +
        '<div class="btn-row"><button type="button" class="btn secondary" data-act="shf-close">Cerrar</button></div>';
      if (!dlg().open) dlg().showModal();
    }

    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-sh-counter]') : null;
      if (!t) return;
      var cid = t.getAttribute('data-sh-counter');
      if (cid && form) {
        var i = form.counters.indexOf(cid);
        if (i >= 0) form.counters.splice(i, 1); else form.counters.push(cid);
        t.setAttribute('aria-pressed', String(i < 0)); dmsg(''); return;
      }
      var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
      var s = state && state.shadows.concat(state.archived).filter(function (x) { return x.id === id; })[0];
      if (act === 'sh-new') return openForm(null);
      if (act === 'sh-edit') return s && openForm(s);
      if (act === 'shf-close') return dlg().close();
      if (act === 'sh-stats') return state && openStats(null);
      if (act === 'sh-stats-for') return openStats(id);
      if (act === 'shf-save') {
        var input = { name: $('#shf-name').value, icon: checkedIcon(), counters: form.counters };
        var p = form.id ? shadows.update(form.id, input) : shadows.create(input), isNew = !form.id;
        return p.then(function (sh) { dlg().close(); return changed(isNew ? '«' + sh.name + '» creada. Cuando aparezca, pulsa «Apareció hoy».' : 'Sombra guardada.'); })
          .catch(function (e) { dmsg((e && e.message) || 'No se pudo guardar.'); });
      }
      if (act === 'shf-archive') {
        return shadows.setArchived(form.id, true).then(function () { dlg().close(); return changed('Sombra archivada. Su historial se queda.'); }).catch(function (e) { dmsg(e.message); });
      }
      if (act === 'sh-restore') return run(id, function () { return shadows.setArchived(id, false); }, 'Sombra recuperada.');
      if (act === 'sh-appear') return run(id, function () { return shadows.appear(id, R.logicalDay(), 'ficha'); }, s ? s.name + ': apuntada. No quita XP.' : '');
      if (act === 'sh-undo') return run(id, function () { return R.removeShadowAppearance(id, R.logicalDay()); }, 'Quitada la aparición de hoy.');
      if (act === 'sh-offer-no') return run(id, function () { return shadows.dismissOffer(id); }, '');
      if (act === 'sh-boss') {
        if (!s) return;
        var names = actNames();
        var pre = { name: s.name, description: 'Una sombra que vuelve a menudo. Cada contrahechizo la debilita.',
          steps: s.counters.map(function (cid2) { return { text: (names[cid2] || 'Contrahechizo') + ' × 5', activity: cid2, count: 5 }; }) };
        var job = run(id, function () { return shadows.dismissOffer(id); }, '');
        return job && job.then(function () { return ctx.openBoss ? ctx.openBoss(pre) : null; });
      }
    });

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar tus sombras. ' + esc((err && err.message) || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
