// Panel «Misiones semanales» de la ficha. Cada una es «solo esta semana» (se borra el lunes a las 3:00) o «se repite
// cada semana» (vuelve a empezar cada lunes). Las ligadas a una actividad se completan solas.
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
        return '<li><label><input type="checkbox" data-check="' + i + '" data-id="' + esc(m.id) + '"' + (c ? ' checked' : '') + (m.done ? ' disabled' : '') + '><span>' + (m.target === 1 ? esc(m.description || 'Completada esta semana') : 'Casilla ' + (i + 1)) + '</span></label></li>';
      }).join('') + '</ul>' + (m.target > 1 ? U.bar(pct, m.name + ': ' + m.count + ' de ' + m.target) : '');
    }
    var split = m.shares.length ? m.shares.map(function (s) { return '<span class="chip">' + esc(names[s.sub] || s.sub) + ' <small>' + s.pct + '%</small></span>'; }).join('') : '<span class="chip">Nivel general</span>';
    return '<li class="wk-card has-edit" data-done="' + m.done + '"><div class="wk-head"><h3>' + esc(m.name) + '</h3>' +
      (m.done ? '<span class="tag ok card-tag">Completada ✓</span>' : '<span class="tag card-tag">+' + m.xp + ' XP</span>') + '</div>' +
      (m.description && m.target !== 1 ? '<p class="soft">' + esc(m.description) + '</p>' : '') + body +
      '<div class="act-chips">' + split + '</div>' +
      (m.weeksDone && m.repeat !== false ? '<p class="soft wk-weeks">' + m.weeksDone + (m.weeksDone === 1 ? ' semana completada' : ' semanas completadas') + '</p>' : '') +
      '<span class="expire-tag">' + icon('clock') + (m.repeat === false ? 'Solo esta semana · se borra el lunes a las 3:00' : 'Se repite cada semana') + '</span>' +
      App.ui.editButton('data-act="edit" data-id="' + esc(m.id) + '"', 'Editar ' + m.name) + '</li>';
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
      var live = state.missions;
      $('#wk-range').textContent = 'Del ' + U.fmtDay(state.range.from) + ' al ' + U.fmtDay(state.range.to);
      body.innerHTML = live.length ? '<ul class="wk-list">' + live.map(function (m) { return card(m, names(), actNames()); }).join('') + '</ul>' :
        '<p class="soft">Aún no tienes misiones semanales. Crea una, por ejemplo «Ir al gimnasio 3 veces».</p>';
    }
    // Antes de pintar, se borran las archivadas del sistema anterior (si las hay).
    function reload() {
      return weekly.cleanup().catch(function () {}).then(function () {
        return Promise.all([weekly.state(), acts.list(), rpg.state()]);
      }).then(function (r) { state = r[0]; actList = r[1]; st = r[2]; paint(); });
    }
    function actionsHtml() {
      return '<button type="button" class="btn" data-act="save">Guardar</button>' +
        (form.id ? '<button type="button" class="btn secondary" data-act="del">Eliminar</button>' : '') +
        '<button type="button" class="btn secondary" data-act="close">Cancelar</button>';
    }
    function askHtml() {
      return '<p class="del-ask">¿Eliminar esta misión? No se puede deshacer. La XP que ya te dio se queda.</p>' +
        '<button type="button" class="btn danger" data-act="del-yes">Sí, eliminar</button><button type="button" class="btn secondary" data-act="del-no">No</button>';
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
      form = { id: m ? m.id : null, size: m ? m.size : 'normal', mode: m ? m.mode : 'activity', activity: m ? m.activity : null, shares: {}, repeat: m ? m.repeat !== false : false };
      if (m) m.shares.forEach(function (s) { form.shares[s.sub] = s.pct; });
      dlg().innerHTML = '<h3 id="wk-dtitle">' + (m ? 'Editar misión semanal' : 'Nueva misión semanal') + '</h3>' +
        '<label class="field"><span>Nombre</span><input id="wf-name" type="text" maxlength="' + R.WEEKLY_LIMITS.name + '" autocomplete="off" value="' + esc(m ? m.name : '') + '"></label>' +
        '<label class="field"><span>Descripción (opcional)</span><input id="wf-desc" type="text" maxlength="' + R.WEEKLY_LIMITS.description + '" autocomplete="off" value="' + esc(m ? m.description : '') + '"></label>' +
        '<fieldset class="symbols"><legend>¿Cuánto dura?</legend><ul class="emo-caps" aria-label="Duración">' +
          '<li><button type="button" class="emo-cap" data-repeat="0" aria-pressed="' + !form.repeat + '"><span>Solo esta semana</span></button></li>' +
          '<li><button type="button" class="emo-cap" data-repeat="1" aria-pressed="' + form.repeat + '"><span>Repetir cada semana</span></button></li></ul>' +
          '<p class="soft">«Solo esta semana» se borra el lunes a las 3:00. La XP que haya dado se queda.</p></fieldset>' +
        '<fieldset class="symbols"><legend>¿Cómo se completa?</legend><ul class="emo-caps" aria-label="Modo">' +
          '<li><button type="button" class="emo-cap" data-mode="activity" aria-pressed="' + (form.mode === 'activity') + '"><span>Haciendo una actividad varias veces (se completa sola)</span></button></li>' +
          '<li><button type="button" class="emo-cap" data-mode="checks" aria-pressed="' + (form.mode === 'checks') + '"><span>Casillas que marco yo</span></button></li></ul>' +
          '<div id="wf-act">' + actPicker() + '</div>' +
          '<div class="field"><span id="wf-tl">' + targetLabel() + '</span>' + App.ui.stepper({ id: 'wf-target', value: m ? m.target : 3, min: 1, max: R.WEEKLY_LIMITS.target, attrs: 'aria-labelledby="wf-tl"' }) + '</div></fieldset>' +
        '<fieldset class="symbols"><legend>XP al completarla (más que una actividad)</legend><ul class="emo-caps" aria-label="Tamaño">' + R.QUEST_SIZES.map(function (z) {
          return '<li><button type="button" class="emo-cap" data-size="' + z.id + '" aria-pressed="' + (z.id === form.size) + '"><span>' + z.label + ' · ' + z.xp + ' XP</span></button></li>';
        }).join('') + '</ul></fieldset>' +
        '<fieldset class="shares"><legend>¿A qué subcategorías va la XP?</legend><p class="soft">Opcional. Sin ninguna, solo sube el nivel general.</p><div id="wf-pick">' + pickHtml() + '</div></fieldset>' +
        '<p class="msg" id="wk-dmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row" id="wk-actions">' + actionsHtml() + '</div>';
      dlg().showModal();
    }
    function setPressed(sel, attr, val) { Array.prototype.forEach.call(dlg().querySelectorAll(sel), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val)); }); }

    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-pk],[data-size],[data-mode],[data-wact],[data-repeat]') : null;
      if (!t) return;
      if (t.getAttribute('data-repeat') && form) { form.repeat = t.getAttribute('data-repeat') === '1'; return setPressed('[data-repeat]', 'data-repeat', form.repeat ? '1' : '0'); }
      if (t.getAttribute('data-pk') && form) { K.toggle(form.shares, t.getAttribute('data-pk'), 'pct'); $('#wf-pick').innerHTML = pickHtml(); return; }
      if (t.getAttribute('data-size') && form) { form.size = t.getAttribute('data-size'); return setPressed('[data-size]', 'data-size', form.size); }
      if (t.getAttribute('data-mode') && form) { form.mode = t.getAttribute('data-mode'); setPressed('[data-mode]', 'data-mode', form.mode); $('#wf-act').innerHTML = actPicker(); $('#wf-tl').textContent = targetLabel(); return; }
      if (t.getAttribute('data-wact') && form) { form.activity = t.getAttribute('data-wact'); return setPressed('[data-wact]', 'data-wact', form.activity); }
      var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
      if (act === 'close') return dlg().close();
      if (act === 'new') return openForm(null);
      if (act === 'edit') return openForm(state.missions.filter(function (m) { return m.id === id; })[0]);
      if (act === 'del') { $('#wk-actions').innerHTML = askHtml(); var y = $('[data-act="del-yes"]'); if (y && y.focus) y.focus(); return; }
      if (act === 'del-no') { $('#wk-actions').innerHTML = actionsHtml(); return; }
      if (act === 'del-yes') {
        if (busy) return; busy = true;
        var name = $('#wf-name').value;
        return weekly.remove(form.id).then(reload).then(function () { dlg().close(); say('Misión eliminada' + (name ? ': ' + name : '') + '.'); })
          .catch(function (e) { dmsg(e.message); $('#wk-actions').innerHTML = actionsHtml(); }).then(function () { busy = false; });
      }
      if (act === 'save') {
        var data = { name: $('#wf-name').value, description: $('#wf-desc').value, size: form.size, shares: K.toList(form.shares, 'pct'), mode: form.mode, activity: form.activity, target: Number($('#wf-target').value), repeat: form.repeat };
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
