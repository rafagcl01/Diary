// Panel «Actividades» de la ficha: registro rápido (el día y «Registrar actividad», que abre la ventana con todas,
// ver activity-picker.js) y debajo las 2 últimas, también las apuntadas desde el diario, cada una con el icono y el nombre
// de su atributo. Sin scroll: el resto, en «Ver historial». Todas dan 5 XP. Quitar una pide confirmar (y quita su XP).
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util;
  var RECENT = 2;

  function monthLabel(key) {
    var d = new Date(key + '-15T12:00:00');
    return isNaN(d.getTime()) ? key : d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }

  V.activitiesPanel = function (host, ctx) {
    var acts = ctx.acts, rpg = ctx.rpg;
    host.innerHTML = '<div class="col-head"><h2>Actividades</h2></div>' +
      '<p class="soft col-lead">Todas dan ' + R.ACTIVITY_XP + ' XP. También puedes apuntarlas en una entrada del diario.</p>' +
      '<div class="act-top"><label class="field inline act-day"><span>Día</span><input id="act-day" type="date" value="' + R.today() + '" max="' + R.today() + '"></label>' +
      '<button type="button" class="act-add" data-act="add" aria-haspopup="dialog">' + icon('pencil') + '<span>Registrar actividad</span></button></div>' +
      '<p class="msg" id="act-msg" role="status" data-kind="ok"></p>' +
      '<h3 class="act-recent-h">Últimas registradas</h3><div id="act-body"></div>' +
      '<button type="button" class="act-hist-link" data-act="hist" aria-haspopup="dialog">Ver historial</button>' +
      '<dialog class="confirm rpg-dialog act-dialog" id="act-dialog"></dialog>' +
      '<dialog class="confirm rpg-dialog act-hist" id="act-hist" aria-labelledby="act-hist-title"></dialog>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#act-body');
    var all = [], asking = null, busy = false, structure = [];
    // El atributo de un registro: el de la subcategoría que más XP se llevó (sale del propio apunte, así vale también
    // para las puntuales y para actividades que ya no existen).
    function mainOf(e) {
      var best = null; (e.splits || []).forEach(function (s) { if (!best || s.xp > best.xp) best = s; });
      var f = best ? R.findSub(structure, best.sub) : null;
      return f ? f.main : null;
    }

    function day() { return $('#act-day').value || R.today(); }
    function note(text, kind) { var el = $('#act-msg'); el.textContent = text || ''; el.setAttribute('data-kind', kind || 'ok'); }

    // Lo registrado, del más reciente al más antiguo. Lo anulado con el sistema anterior no se enseña.
    function done() {
      var voided = R.voidedKeys(all);
      return all.filter(function (e) { return e.kind === 'activity' && !voided[e.key]; })
        .sort(function (a, b) { return a.day !== b.day ? (a.day < b.day ? 1 : -1) : ((a.at || '') < (b.at || '') ? 1 : -1); });
    }
    // Quitar una actividad quita su XP: antes se pregunta en la misma fila, diciendo cuánta.
    function row(e) {
      var ask = asking === e.key, m = mainOf(e);
      return '<li data-menu-host' + (ask ? ' data-asking="true"' : '') + '><span class="act-ai" aria-hidden="true">' + icon(m ? m.icon : 'star') + '</span><span>' + esc(e.label) +
        (R.isDiaryKey(e.key) ? ' <span class="act-from" title="Apuntada en el diario">Diario</span>' : '') +
        '<small>' + (m ? '<b class="act-main">' + esc(m.name) + '</b>' : '') + esc(U.fmtDay(e.day)) + '</small></span><span class="act-end"><span class="act-xp">+' + e.xp + ' XP</span>' +
        (ask ? '' : '<button type="button" class="act-del" data-act="del" data-key="' + esc(e.key) + '" data-menu-label="Quitar (−' + e.xp + ' XP)" aria-label="Quitar:' + esc(e.label) + ', ' + esc(U.fmtDay(e.day)) + '">×</button>') + '</span>' +
        (ask ? App.ui.askRow('¿Quitar <b>' + esc(e.label) + '</b>? Se quitan sus ' + App.ui.xpText(e.xp) + (R.isDiaryKey(e.key) ? ' y sale de su entrada del diario.' : '.'),
          'data-act="del-yes" data-key="' + esc(e.key) + '"', 'data-act="del-no"') : '') + '</li>';
    }
    function paintRecent() {
      var last = done().slice(0, RECENT);
      body.innerHTML = last.length ? '<ul class="act-recent">' + last.map(row).join('') + '</ul>' : '<p class="soft">Todavía no has registrado ninguna.</p>';
    }
    function paintHistory() {
      var list = done(), xp = list.reduce(function (t, e) { return t + e.xp; }, 0), groups = [], last = null;
      list.forEach(function (e) {
        var k = String(e.day).slice(0, 7);
        if (!last || last.key !== k) { last = { key: k, items: [] }; groups.push(last); }
        last.items.push(e);
      });
      $('#act-hist').innerHTML = '<h3 id="act-hist-title">Historial de actividades</h3>' +
        '<p class="soft act-total">' + list.length + (list.length === 1 ? ' actividad' : ' actividades') + ' · <b>' + xp + ' XP</b> en total</p>' +
        '<p class="msg" id="act-hmsg" role="status" data-kind="error"></p>' +
        (groups.length ? groups.map(function (g) {
          return '<h4 class="act-month">' + esc(monthLabel(g.key)) + '</h4><ul class="act-recent">' + g.items.map(row).join('') + '</ul>';
        }).join('') : '<p class="soft">Todavía no has registrado ninguna.</p>') +
        '<div class="btn-row"><button type="button" class="btn secondary" data-act="hist-close">Cerrar</button></div>';
    }
    function paint() { paintRecent(); if ($('#act-hist').open) paintHistory(); }
    function reload() {
      return rpg.state().then(function (s) { all = s.entries; structure = s.structure; paint(); });
    }

    // Registra las elegidas de una en una con el día del selector; luego avisos y refresco de la ficha.
    function logMany(ids) {
      var d = day(), saved = [];
      return ids.reduce(function (p, id) {
        return p.then(function () { return acts.log(id, { req: R.newRequestId(), day: d }).then(function (r) { if (!r.duplicate) saved.push(r.entry); }); });
      }, Promise.resolve()).then(function () { return finish(saved, d); }, function (e) {
        if (saved.length) finish(saved, d);   // lo que ya se guardó se queda; se avisa del resto
        throw e;
      });
    }
    function finish(saved, d) {
      var xp = saved.reduce(function (t, e) { return t + e.xp; }, 0);
      note(saved.length ? '+' + xp + ' XP · ' + saved.map(function (e) { return e.label; }).join(', ') : 'Esos registros ya estaban guardados.');
      return ctx.afterChange(d);
    }

    var picker = V.activityPicker($('#act-dialog'), {
      acts: acts, rpg: rpg, allowOnce: true, requireOne: true,
      acceptLabel: function (n, xp) { return n ? 'Registrar ' + n + ' · +' + xp + ' XP' : 'Registrar'; },
      onAccept: logMany,
      onOnce: function (input) {
        var d = day();
        return acts.logOnce({ name: input.name, points: input.points, req: R.newRequestId(), day: d }).then(function (r) { return finish(r.duplicate ? [] : [r.entry], d); });
      }
    });

    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act'), inHist = !!t.closest('#act-hist');
      if (act === 'add') { note(''); return picker.open({ title: 'Añadir actividad' }); }
      if (act === 'hist') { asking = null; paintHistory(); paintRecent(); return $('#act-hist').showModal(); }
      if (act === 'hist-close') { asking = null; paintRecent(); return $('#act-hist').close(); }
      if (act === 'del') { asking = t.getAttribute('data-key'); paint(); var y = host.querySelector((inHist ? '#act-hist ' : '#act-body ') + '[data-act="del-yes"]'); if (y && y.focus) y.focus(); return; }
      if (act === 'del-no') { asking = null; return paint(); }
      if (act === 'del-yes') {
        if (busy) return; busy = true;
        var key = t.getAttribute('data-key'), e0 = all.filter(function (x) { return x.key === key; })[0];
        return R.deleteActivityEntry(key).then(function () {
          asking = null;
          note('Borrado: ' + (e0 ? e0.label + ' (−' + e0.xp + ' XP)' : 'la actividad') + (e0 && R.isDiaryKey(key) ? '. También se ha quitado de su entrada del diario.' : '.'));
          return ctx.afterChange();
        }).catch(function (e) {
          asking = null; paint();
          var m = (e && e.message) || 'No se pudo borrar.';
          if (inHist) { var hm = $('#act-hmsg'); if (hm) hm.textContent = m; } else note(m, 'error');
        }).then(function () { busy = false; });
      }
    });
    // Esc o cerrar la ventana del historial: se olvida la confirmación pendiente.
    $('#act-hist').addEventListener('close', function () { if (asking) { asking = null; paintRecent(); } });

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las actividades. ' + esc(err.message || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
