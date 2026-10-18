// Panel «Misiones semanales» de la ficha. Se renuevan cada lunes. Las ligadas a una actividad se completan solas.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util, K = V.pickers;

  function card(m, names, actNames) {
    var pct = Math.min(1, m.count / m.target);
    var body;
    if (m.mode === 'activity') {
      body = '<p class="wk-line">' + esc(actNames[m.activity] || 'Actividad') + ' · <strong>' + Math.min(m.count, m.target) + ' de ' + m.target + '</strong> esta semana</p>' + U.bar(pct, m.name + ': ' + Math.min(m.count, m.target) + ' de ' + m.target) +
        (m.done ? '' : '<p class="soft wk-note">Se completa sola al registrar la actividad.</p>');
    } else {
      body = '<ul class="wk-checks" aria-label="Casillas de ' + esc(m.name) + '">' + m.checks.map(function (c, i) {
        return '<li><label><input type="checkbox" data-check="' + i + '" data-id="' + esc(m.id) + '"' + (c ? ' checked' : '') + (m.done ? ' disabled' : '') + '><span>' + (m.target === 1 ? esc(m.description || 'Hecho') : 'Casilla ' + (i + 1)) + '</span></label></li>';
      }).join('') + '</ul>' + (m.target > 1 ? U.bar(pct, m.name + ': ' + m.count + ' de ' + m.target) : '');
    }
    var split = m.shares.length ? m.shares.map(function (s) { return '<span class="chip">' + esc(names[s.sub] || s.sub) + ' <small>' + s.pct + '%</small></span>'; }).join('') : '<span class="chip">Nivel general</span>';
    return '<li class="wk-card" data-done="' + m.done + '"><div class="wk-head"><h3>' + esc(m.name) + '</h3>' +
      (m.done ? '<span class="tag ok">Completada ✓</span>' : '<span class="tag">+' + m.xp + ' XP</span>') + '</div>' +
      (m.description && m.target !== 1 ? '<p class="soft">' + esc(m.description) + '</p>' : '') + body +
      '<div class="act-chips">' + split + '</div>' +
      '<div class="sub-tools">' + (m.weeksDone ? '<span class="soft wk-weeks">' + m.weeksDone + (m.weeksDone === 1 ? ' semana completada' : ' semanas completadas') + '</span>' : '') +
      '<button type="button" class="mini" data-act="edit" data-id="' + esc(m.id) + '">Editar</button></div></li>';
  }

  V.weeklyPanel = function (host, ctx) {
    var weekly = ctx.weekly, acts = ctx.acts, rpg = ctx.rpg;
    host.innerHTML = '<div class="col-head"><h2>Misiones semanales</h2><button type="button" class="btn secondary" data-act="new">Nueva</button></div>' +
      '<p class="soft col-lead" id="wk-range"></p><p class="msg" id="wk-msg" role="status" data-kind="ok"></p><div id="wk-body" class="col-scroll"></div>' +
      '<dialog class="confirm rpg-dialog" id="wk-dialog" aria-labelledby="wk-dtitle"></dialog>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#wk-body');
    var state = null, st = null, actList = [], form = null, busy = false;

    function names() { return U.subNames(st.structure); }
    function actNames() { var o = {}; actList.forEach(function (a) { o[a.id] = a.name; }); return o; }
    function paint() {
      var live = state.missions.filter(function (m) { return !m.archived; }), arch = state.missions.filter(function (m) { return m.archived; });
      $('#wk-range').textContent = 'Del ' + U.fmtDay(state.range.from) + ' al ' + U.fmtDay(state.range.to) + ' · se renuevan cada lunes';
      body.innerHTML = (live.length ? '<ul class="wk-list">' + live.map(function (m) { return card(m, names(), actNames()); }).join('') + '</ul>' :
        '<p class="soft">Aún no tienes misiones semanales. Crea una, por ejemplo «Ir al gimnasio 3 veces».</p>') +
        (arch.length ? '<details class="archived"><summary>Archivadas (' + arch.length + ')</summary><ul class="wk-list">' + arch.map(function (m) { return card(m, names(), actNames()); }).join('') + '</ul></details>' : '');
    }
    function reload() {
      return Promise.all([weekly.state(true), acts.list(), rpg.state()]).then(function (r) { state = r[0]; actList = r[1]; st = r[2]; paint(); });
    }
    function say(t) { $('#wk-msg').textContent = t || ''; }
    function dlg() { return $('#wk-dialog'); }
    function dmsg(t) { var el = $('#wk-dmsg'); if (el) el.textContent = t || ''; }
    function pickHtml() { return K.html(K.groups(st.structure, false), names(), form.shares, 'pct'); }
    function actPicker() {
      if (form.mode !== 'activity') return '';
      return '<ul class="emo-caps pk-caps" aria-label="Actividad que cuenta">' + actList.filter(function (a) { return !a.archived; }).map(function (a) {
        return '<li><button type="button" class="emo-cap" data-wact="' + esc(a.id) + '" aria-pressed="' + (form.activity === a.id) + '">' + icon(a.icon) + '<span>' + esc(a.name) + '</span></button></li>';
      }).join('') + '</ul>';
    }
    function targetLabel() { return form.mode === 'activity' ? '¿Cuántas veces a la semana?' : '¿Cuántas casillas? (1 = un solo check)'; }

    function openForm(m) {
      form = { id: m ? m.id : null, size: m ? m.size : 'normal', mode: m ? m.mode : 'activity', activity: m ? m.activity : null, shares: {} };
      if (m) m.shares.forEach(function (s) { form.shares[s.sub] = s.pct; });
      dlg().innerHTML = '<h3 id="wk-dtitle">' + (m ? 'Editar misión semanal' : 'Nueva misión semanal') + '</h3>' +
        '<label class="field"><span>Nombre</span><input id="wf-name" type="text" maxlength="' + R.WEEKLY_LIMITS.name + '" autocomplete="off" value="' + esc(m ? m.name : '') + '"></label>' +
        '<label class="field"><span>Descripción (opcional)</span><input id="wf-desc" type="text" maxlength="' + R.WEEKLY_LIMITS.description + '" autocomplete="off" value="' + esc(m ? m.description : '') + '"></label>' +
        '<fieldset class="symbols"><legend>¿Cómo se completa?</legend><ul class="emo-caps" aria-label="Modo">' +
          '<li><button type="button" class="emo-cap" data-mode="activity" aria-pressed="' + (form.mode === 'activity') + '"><span>Haciendo una actividad varias veces (se completa sola)</span></button></li>' +
          '<li><button type="button" class="emo-cap" data-mode="checks" aria-pressed="' + (form.mode === 'checks') + '"><span>Casillas que marco yo</span></button></li></ul>' +
          '<div id="wf-act">' + actPicker() + '</div>' +
          '<label class="field"><span id="wf-tl">' + targetLabel() + '</span><input id="wf-target" type="number" inputmode="numeric" min="1" max="' + R.WEEKLY_LIMITS.target + '" step="1" value="' + (m ? m.target : 3) + '"></label></fieldset>' +
        '<fieldset class="symbols"><legend>XP al completarla (más que una actividad)</legend><ul class="emo-caps" aria-label="Tamaño">' + R.QUEST_SIZES.map(function (z) {
          return '<li><button type="button" class="emo-cap" data-size="' + z.id + '" aria-pressed="' + (z.id === form.size) + '"><span>' + z.label + ' · ' + z.xp + ' XP</span></button></li>';
        }).join('') + '</ul></fieldset>' +
        '<fieldset class="shares"><legend>¿A qué subcategorías va la XP?</legend><p class="soft">Opcional. Sin ninguna, solo sube el nivel general.</p><div id="wf-pick">' + pickHtml() + '</div></fieldset>' +
        '<p class="msg" id="wk-dmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="save">Guardar</button>' +
        (m ? '<button type="button" class="btn secondary" data-act="archive" data-to="' + (m.archived ? '0' : '1') + '">' + (m.archived ? 'Recuperar' : 'Archivar') + '</button>' : '') +
        '<button type="button" class="btn secondary" data-act="close">Cancelar</button></div>';
      dlg().showModal();
    }
    function setPressed(sel, attr, val) { Array.prototype.forEach.call(dlg().querySelectorAll(sel), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val)); }); }

    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-pk],[data-size],[data-mode],[data-wact]') : null;
      if (!t) return;
      if (t.getAttribute('data-pk') && form) { K.toggle(form.shares, t.getAttribute('data-pk'), 'pct'); $('#wf-pick').innerHTML = pickHtml(); return; }
      if (t.getAttribute('data-size') && form) { form.size = t.getAttribute('data-size'); return setPressed('[data-size]', 'data-size', form.size); }
      if (t.getAttribute('data-mode') && form) { form.mode = t.getAttribute('data-mode'); setPressed('[data-mode]', 'data-mode', form.mode); $('#wf-act').innerHTML = actPicker(); $('#wf-tl').textContent = targetLabel(); return; }
      if (t.getAttribute('data-wact') && form) { form.activity = t.getAttribute('data-wact'); return setPressed('[data-wact]', 'data-wact', form.activity); }
      var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
      if (act === 'close') return dlg().close();
      if (act === 'new') return openForm(null);
      if (act === 'edit') return openForm(state.missions.filter(function (m) { return m.id === id; })[0]);
      if (act === 'archive') return weekly.setArchived(form.id, t.getAttribute('data-to') === '1').then(reload).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
      if (act === 'save') {
        var data = { name: $('#wf-name').value, description: $('#wf-desc').value, size: form.size, shares: K.toList(form.shares, 'pct'), mode: form.mode, activity: form.activity, target: Number($('#wf-target').value) };
        var p = form.id ? weekly.update(form.id, data) : weekly.create(data);
        return p.then(function () { return ctx.afterChange(); }).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
      }
    });
    host.addEventListener('input', function (ev) {
      var t = ev.target, id = t && t.getAttribute ? t.getAttribute('data-pkval') : null;
      if (!id || !form) return;
      form.shares[id] = Math.floor(Number(t.value)) || 0;
      var el = host.querySelector('[data-pk-total]'); if (el) el.textContent = K.summaryText(form.shares, 'pct');
    });
    host.addEventListener('change', function (ev) {
      var t = ev.target, i = t && t.getAttribute ? t.getAttribute('data-check') : null;
      if (i === null || i === undefined || busy) return;
      busy = true;
      weekly.toggleCheck(t.getAttribute('data-id'), Number(i), t.checked).then(function (events) { return ctx.afterChange(null, events); })
        .catch(function (e) { say(e.message); return reload(); }).then(function () { busy = false; });
    });

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las misiones. ' + esc(err.message || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
