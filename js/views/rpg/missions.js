// Misiones: crearlas, seguir su objetivo y subtareas, y reclamar la recompensa (una sola vez).
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, P = App.rpgViews, U = P.util, K = P.pickers;

  var STATE_LABEL = {}; R.QUEST_STATES.forEach(function (s) { STATE_LABEL[s.id] = s.label; });

  function card(q, names, actNames) {
    var done = q.status === 'completada', open = q.status === 'pendiente' || q.status === 'en_curso';
    var sizeLabel = R.QUEST_SIZES.filter(function (z) { return z.id === q.size; })[0].label;
    var split = q.shares.length ? q.shares.map(function (s) { return '<span class="chip">' + esc(names[s.sub] || s.sub) + ' <small>' + s.pct + '%</small></span>'; }).join('') : '<span class="chip">Solo nivel general</span>';
    var obj = '';
    if (q.objective) {
      var n = Math.min(q.progress, q.objective.count);
      obj = '<p class="mq-obj">Objetivo: <strong>' + esc(actNames[q.objective.activity] || 'actividad') + '</strong> · ' + q.progress + ' de ' + q.objective.count + '</p>' + U.bar(n / q.objective.count, 'Objetivo: ' + n + ' de ' + q.objective.count);
    }
    var steps = q.steps.length ? '<ul class="mq-steps" aria-label="Subtareas (no dan XP)">' + q.steps.map(function (s) {
      return '<li><label><input type="checkbox" data-step="' + esc(s.id) + '" data-id="' + esc(q.id) + '"' + (s.done ? ' checked' : '') + (done ? ' disabled' : '') + '><span>' + esc(s.text) + '</span></label></li>';
    }).join('') + '</ul>' : '';
    var tools = '';
    if (open) tools += '<button type="button" class="btn" data-act="claim" data-id="' + esc(q.id) + '"' + (q.ready ? '' : ' disabled') + '>Completar</button>';
    if (q.status === 'pendiente') tools += '<button type="button" class="mini" data-act="state" data-to="en_curso" data-id="' + esc(q.id) + '">Empezar</button>';
    if (q.status === 'en_curso') tools += '<button type="button" class="mini" data-act="state" data-to="pendiente" data-id="' + esc(q.id) + '">Dejar pendiente</button>';
    if (open) tools += '<button type="button" class="mini" data-act="state" data-to="pausada" data-id="' + esc(q.id) + '">Pausar</button>';
    if (q.status === 'pausada') tools += '<button type="button" class="mini" data-act="state" data-to="en_curso" data-id="' + esc(q.id) + '">Retomar</button>';
    if (q.status === 'abandonada') tools += '<button type="button" class="mini" data-act="state" data-to="pendiente" data-id="' + esc(q.id) + '">Reabrir</button>';
    if (!done && q.status !== 'abandonada') tools += '<button type="button" class="mini" data-act="state" data-to="abandonada" data-id="' + esc(q.id) + '">Abandonar</button>';
    if (!done) tools += '<button type="button" class="mini" data-act="edit" data-id="' + esc(q.id) + '">Editar</button>';
    var dates = (q.dueDay ? 'Hasta el ' + U.fmtDay(q.dueDay) : '') + (q.objective ? (q.dueDay ? ' · ' : '') + 'desde el ' + U.fmtDay(q.startDay) : '');
    return '<li class="mq-card" data-status="' + q.status + '"><div class="mq-head"><h3>' + esc(q.name) + '</h3><span class="tag">' + STATE_LABEL[q.status] + '</span></div>' +
      (q.description ? '<p class="soft">' + esc(q.description) + '</p>' : '') +
      '<p class="soft mq-meta">' + sizeLabel + ' · ' + (done && q.rewardXp ? '+' + q.rewardXp : q.xp) + ' XP' + (dates ? ' · ' + dates : '') + (done && q.completedAt ? ' · completada el ' + U.fmtDay(q.completedAt.slice(0, 10)) : '') + '</p>' +
      '<div class="act-chips">' + split + '</div>' + obj + steps + '<div class="sub-tools">' + tools + '</div></li>';
  }

  P.missions = {
    render: function (host) {
      var qr = R.quests(), acts = R.activities();
      host.innerHTML = '<div class="mq-view"><div id="mq-body"></div><dialog class="confirm rpg-dialog" id="mq-dialog" aria-labelledby="mq-dtitle"></dialog></div>';
      var view = host.querySelector('.mq-view'), $ = function (s) { return host.querySelector(s); }, body = $('#mq-body');
      if (!qr) {
        body.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + icon('grim') + '</div><h2>Conecta tus datos para ver tus misiones</h2><p>Las misiones se guardan en tu repositorio de datos.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>';
        return;
      }
      body.innerHTML = '<div class="skeleton" style="margin: 14px 0"></div>';
      var st = null, actList = [], form = null, note = '', busy = false;

      function names() { return U.subNames(st.structure); }
      function actNames() { var o = {}; actList.forEach(function (a) { o[a.id] = a.name; }); return o; }
      function section(title, list, open) {
        if (!list.length) return '';
        return '<details class="mq-sec"' + (open ? ' open' : '') + '><summary>' + title + ' (' + list.length + ')</summary><ul class="mq-list">' + list.map(function (q) { return card(q, names(), actNames()); }).join('') + '</ul></details>';
      }
      function paint() {
        var qs = st.quests, by = function (s) { return qs.filter(function (q) { return s.indexOf(q.status) >= 0; }); };
        body.innerHTML = '<div class="toolbar"><p class="soft" style="margin:0">Completar una misión da XP una sola vez. Las subtareas no dan XP.</p><button type="button" class="btn" data-act="new">Nueva misión</button></div>' +
          '<p class="msg" id="mq-msg" role="status" data-kind="ok">' + esc(note) + '</p>' +
          (qs.length ? '' : '<section class="card stitched empty"><div class="empty-icon">' + icon('grim') + '</div><h2>No hay misiones</h2><p>Crea la primera: puede ser algo de una vez o un objetivo, como «ir 3 veces al gimnasio».</p></section>') +
          section('Activas', by(['pendiente', 'en_curso']), true) + section('Pausadas', by(['pausada']), true) +
          section('Completadas', by(['completada']), false) + section('Abandonadas', by(['abandonada']), false);
      }
      function reload() {
        return Promise.all([qr.state(true), acts ? acts.list(true) : Promise.resolve([])]).then(function (r) { st = r[0]; actList = r[1]; paint(); });
      }
      function say(msg) { note = msg; var el = $('#mq-msg'); if (el) el.textContent = msg; }
      function dmsg(text, kind) { var el = $('#mq-dmsg'); if (el) { el.textContent = text || ''; el.setAttribute('data-kind', kind || 'error'); } }
      function dlg() { return $('#mq-dialog'); }

      // ---- Formulario ----
      function pickHtml() { return K.html(K.groups(st.structure, false), names(), form.shares, 'pct'); }
      function objHtml() {
        if (!form.objective) return '';
        return '<ul class="emo-caps pk-caps" aria-label="Actividad del objetivo">' + actList.filter(function (a) { return !a.archived; }).map(function (a) {
          return '<li><button type="button" class="emo-cap" data-obj="' + esc(a.id) + '" aria-pressed="' + (form.objective.activity === a.id) + '">' + icon(a.icon) + '<span>' + esc(a.name) + '</span></button></li>';
        }).join('') + '</ul><label class="field"><span>¿Cuántas veces?</span><input id="mf-count" type="number" inputmode="numeric" min="1" max="' + R.QUEST_LIMITS.target + '" step="1" value="' + form.objective.count + '"></label>';
      }
      function openForm(q) {
        form = { id: q ? q.id : null, size: q ? q.size : 'normal', shares: {}, objective: q && q.objective ? { activity: q.objective.activity, count: q.objective.count } : null, steps: q ? q.steps : [] };
        if (q) q.shares.forEach(function (s) { form.shares[s.sub] = s.pct; });
        dlg().innerHTML = '<h3 id="mq-dtitle">' + (q ? 'Editar misión' : 'Nueva misión') + '</h3>' +
          '<label class="field"><span>Nombre</span><input id="mf-name" type="text" maxlength="' + R.QUEST_LIMITS.name + '" autocomplete="off" value="' + esc(q ? q.name : '') + '"></label>' +
          '<label class="field"><span>Descripción (opcional)</span><input id="mf-desc" type="text" maxlength="' + R.QUEST_LIMITS.description + '" autocomplete="off" value="' + esc(q ? q.description : '') + '"></label>' +
          '<fieldset class="symbols"><legend>Tamaño (XP al completarla)</legend><ul class="emo-caps" aria-label="Tamaño">' + R.QUEST_SIZES.map(function (z) {
            return '<li><button type="button" class="emo-cap" data-size="' + z.id + '" aria-pressed="' + (z.id === form.size) + '"><span>' + z.label + ' · ' + z.xp + ' XP</span></button></li>';
          }).join('') + '</ul></fieldset>' +
          '<fieldset class="shares"><legend>¿A qué subcategorías va la XP?</legend><p class="soft">Opcional. Si no eliges ninguna, solo sube el nivel general.</p><div id="mf-pick">' + pickHtml() + '</div></fieldset>' +
          '<fieldset class="shares"><legend>Objetivo</legend><label class="checkline"><input type="checkbox" id="mf-hasobj"' + (form.objective ? ' checked' : '') + '><span>Se cumple haciendo una actividad varias veces</span></label><div id="mf-obj">' + objHtml() + '</div></fieldset>' +
          '<div class="adj-row"><label class="field"><span>Desde</span><input id="mf-start" type="date" value="' + (q ? q.startDay : R.today()) + '"></label>' +
          '<label class="field"><span>Hasta (opcional)</span><input id="mf-due" type="date" value="' + (q && q.dueDay ? q.dueDay : '') + '"></label></div>' +
          '<label class="field"><span>Subtareas (una por línea, no dan XP)</span><textarea id="mf-steps" rows="3" maxlength="1600">' + esc(form.steps.map(function (s) { return s.text; }).join('\n')) + '</textarea></label>' +
          '<p class="msg" id="mq-dmsg" role="status" data-kind="error"></p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="save">Guardar misión</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>';
        dlg().showModal();
      }
      function stepsFromText(text) {
        var old = {}; form.steps.forEach(function (s) { old[s.text] = s; });
        return text.split('\n').map(function (l) { return R.cleanText(l, R.QUEST_LIMITS.step); }).filter(Boolean).map(function (t) { return old[t] ? { id: old[t].id, text: t, done: old[t].done } : { text: t, done: false }; });
      }
      function guarded(promise, okMsg) {
        return promise.then(function () { return reload(); }).then(function () { if (okMsg) say(okMsg); }).catch(function (e) { say((e && e.message) || 'No se pudo guardar.'); });
      }

      view.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-pk],[data-size],[data-obj]') : null;
        if (!t) return;
        if (t.getAttribute('data-pk') && form) { K.toggle(form.shares, t.getAttribute('data-pk'), 'pct'); $('#mf-pick').innerHTML = pickHtml(); return; }
        if (t.getAttribute('data-size') && form) {
          form.size = t.getAttribute('data-size');
          Array.prototype.forEach.call(dlg().querySelectorAll('[data-size]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === form.size)); });
          return;
        }
        if (t.getAttribute('data-obj') && form) { form.objective.activity = t.getAttribute('data-obj'); var c = $('#mf-count'); if (c) form.objective.count = Number(c.value) || 1; $('#mf-obj').innerHTML = objHtml(); return; }
        var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
        if (act === 'close') return dlg().close();
        if (act === 'new') return openForm(null);
        if (act === 'edit') return openForm(st.quests.filter(function (q) { return q.id === id; })[0]);
        if (act === 'state') return guarded(qr.setStatus(id, t.getAttribute('data-to')));
        if (act === 'claim') {
          if (busy) return; busy = true; t.disabled = true;
          var before = st.computed.general.level;
          return qr.claim(id).then(function (r) {
            return reload().then(function () {
              say(r.duplicate ? 'Esa misión ya estaba completada: no se ha contado dos veces.' : '¡Misión completada! +' + r.entry.xp + ' XP · ' + r.quest.name + U.levelNote(before, st.computed.general.level));
            });
          }).catch(function (e) { say((e && e.message) || 'No se pudo completar. No se ha sumado nada.'); t.disabled = false; }).then(function () { busy = false; });
        }
        if (act === 'save') {
          var hasObj = $('#mf-hasobj').checked;
          var data = {
            name: $('#mf-name').value, description: $('#mf-desc').value, size: form.size, shares: K.toList(form.shares, 'pct'),
            objective: hasObj ? { activity: form.objective && form.objective.activity, count: Number($('#mf-count') ? $('#mf-count').value : 1) } : null,
            startDay: $('#mf-start').value, dueDay: $('#mf-due').value || null, steps: stepsFromText($('#mf-steps').value)
          };
          return (form.id ? qr.update(form.id, data) : qr.create(data)).then(reload).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
        }
      });
      view.addEventListener('change', function (ev) {
        var t = ev.target;
        if (t && t.id === 'mf-hasobj' && form) {
          form.objective = t.checked ? (form.objective || { activity: null, count: 3 }) : null;
          $('#mf-obj').innerHTML = objHtml(); return;
        }
        var sid = t && t.getAttribute ? t.getAttribute('data-step') : null;
        if (sid) guarded(qr.toggleStep(t.getAttribute('data-id'), sid, t.checked));
      });
      view.addEventListener('input', function (ev) {
        var t = ev.target, id = t && t.getAttribute ? t.getAttribute('data-pkval') : null;
        if (!id || !form) return;
        form.shares[id] = Math.floor(Number(t.value)) || 0;
        var el = $('[data-pk-total]'); if (el) el.textContent = K.summaryText(form.shares, 'pct');
      });
      reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las misiones. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>'; });
    }
  };
})(window.App = window.App || {});
