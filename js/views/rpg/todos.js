// Panel «Tareas» de la ficha: listas de tareas. Cada tarea da su XP al marcarla y completar la lista da la recompensa grande.
// Las tareas se añaden escribiendo en la propia tarjeta (Intro); el lápiz abre la edición completa de la lista.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, V = App.rpgViews, U = V.util, K = V.pickers;

  function sizeSelect(attrs, current) {
    return '<select ' + attrs + '>' + R.TASK_SIZES.map(function (z) {
      return '<option value="' + z.id + '"' + (z.id === current ? ' selected' : '') + '>' + z.label + ' · +' + z.xp + '</option>';
    }).join('') + '</select>';
  }
  function progress(l) {
    var n = l.tasks.length, f = n ? l.doneCount / n : 0;
    return '<div class="td-prog"><div class="xpbar" role="img" aria-label="' + l.doneCount + ' de ' + n + ' tareas"><span style="width:' + Math.round(f * 100) + '%"></span></div>' +
      '<span class="soft td-count">' + l.doneCount + ' de ' + n + '</span></div>';
  }
  function card(l, asking) {
    if (l.completed) {
      return '<li class="td-card" data-done="true"><div class="wk-head"><h3>' + esc(l.name) + '</h3><span class="tag ok">Completada ✓ +' + l.rewardXp + '</span></div>' +
        '<p class="soft">' + l.tasks.length + (l.tasks.length === 1 ? ' tarea hecha' : ' tareas hechas') + '</p>' +
        (asking === l.id
          ? '<div class="sub-tools del-row"><span class="del-ask">¿Eliminar esta lista? La XP que ya te dio se queda.</span><button type="button" class="mini danger" data-act="del-yes" data-id="' + esc(l.id) + '">Sí, eliminar</button><button type="button" class="mini" data-act="del-no">No</button></div>'
          : '<div class="sub-tools"><button type="button" class="mini" data-act="del-card" data-id="' + esc(l.id) + '">Eliminar</button></div>') + '</li>';
    }
    var tasks = l.tasks.map(function (t) {
      return '<li data-menu-host data-done="' + t.done + '"><label class="bs-check"><input type="checkbox" data-tk="' + esc(t.id) + '" data-list="' + esc(l.id) + '"' + (t.done ? ' checked' : '') + '>' +
        '<span class="bs-text">' + esc(t.text) + '</span></label><span class="td-xp">+' + t.xp + '</span>' +
        '<button type="button" class="td-del" data-act="task-del" data-id="' + esc(l.id) + '" data-task="' + esc(t.id) + '" data-menu-label="Quitar la tarea" aria-label="Quitar la tarea ' + esc(t.text) + '"' + (t.done ? ' disabled' : '') + '>×</button></li>';
    }).join('');
    return '<li class="td-card has-edit" data-list-id="' + esc(l.id) + '"><div class="wk-head"><h3>' + esc(l.name) + '</h3><span class="tag card-tag">+' + l.xp + ' XP al terminar</span></div>' +
      progress(l) +
      (tasks ? '<ul class="bs-steps td-tasks" aria-label="Tareas de ' + esc(l.name) + '">' + tasks + '</ul>' : '<p class="soft">Todavía sin tareas: escribe la primera aquí debajo.</p>') +
      '<div class="td-new-row"><input type="text" class="td-new" data-list="' + esc(l.id) + '" maxlength="' + R.TODO_LIMITS.task + '" autocomplete="off" placeholder="Añadir tarea… (Intro)" aria-label="Nueva tarea en ' + esc(l.name) + '">' +
        sizeSelect('class="td-new-size" data-list="' + esc(l.id) + '" aria-label="Tamaño de la nueva tarea"', 'normal') + '</div>' +
      App.ui.editButton('data-act="edit" data-id="' + esc(l.id) + '"', 'Editar la lista ' + l.name) + '</li>';
  }

  V.todoPanel = function (host, ctx) {
    var todos = ctx.todos, rpg = ctx.rpg;
    host.innerHTML = '<div class="col-head"><h2>Tareas</h2><button type="button" class="btn secondary" data-act="new">Nueva lista</button></div>' +
      '<p class="soft col-lead">Cada tarea da su XP al marcarla; completar la lista entera da la recompensa grande.</p>' +
      '<p class="expire-tag">' + App.icon('clock') + 'Mañana a las 3:00 · lo pendiente pasa al día siguiente</p>' +
      '<p class="msg" id="td-msg" role="status" data-kind="ok"></p><div id="td-body" class="col-scroll"></div>' +
      '<dialog class="confirm rpg-dialog" id="td-dialog" aria-labelledby="td-dtitle"></dialog>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#td-body');
    var state = null, st = null, form = null, busy = false, asking = null;

    function names() { return U.subNames(st.structure); }
    function say(t, kind) { var m = $('#td-msg'); m.textContent = t || ''; m.setAttribute('data-kind', kind || 'ok'); }
    function paint() {
      var live = state.lists.filter(function (l) { return !l.completed; }), done = state.lists.filter(function (l) { return l.completed; });
      var openDone = !!(asking && done.some(function (l) { return l.id === asking; }));
      body.innerHTML = (live.length ? '<ul class="wk-list">' + live.map(function (l) { return card(l, asking); }).join('') + '</ul>' :
        '<p class="soft">No tienes listas. Crea una, por ejemplo «Preparar la entrevista», y ve añadiendo tareas.</p>') +
        (done.length ? '<details class="archived"' + (openDone ? ' open' : '') + '><summary>Completadas (' + done.length + ')</summary><ul class="wk-list">' + done.map(function (l) { return card(l, asking); }).join('') + '</ul></details>' : '');
    }
    // Antes de pintar, la limpieza de las 3:00 si toca (lo hecho ayer se va; lo pendiente pasa a hoy).
    function reload() {
      return todos.cleanup().catch(function () {}).then(function () { return Promise.all([todos.state(), rpg.state()]); })
        .then(function (r) { state = r[0]; st = r[1]; paint(); });
    }

    // ---- Diálogo: nueva lista o editar ----
    function dlg() { return $('#td-dialog'); }
    function dmsg(t) { var el = $('#td-dmsg'); if (el) el.textContent = t || ''; }
    function pickHtml() { return K.html(K.groups(st.structure, false), names(), form.shares, 'pct'); }
    function rows() {
      return form.tasks.map(function (t, i) {
        return '<li class="td-row"><input type="text" data-ti="' + i + '" maxlength="' + R.TODO_LIMITS.task + '" placeholder="Tarea ' + (i + 1) + '" value="' + esc(t.text) + '" aria-label="Tarea ' + (i + 1) + '">' +
          sizeSelect('data-ts="' + i + '" aria-label="Tamaño de la tarea ' + (i + 1) + '"', t.size) +
          (t.done ? '<span class="tag ok">Marcada</span>' : '<button type="button" class="mini" data-act="row-del" data-i="' + i + '" aria-label="Quitar la tarea ' + (i + 1) + '">×</button>') + '</li>';
      }).join('');
    }
    function actionsHtml() {
      return '<button type="button" class="btn" data-act="save">Guardar</button>' +
        (form.id ? '<button type="button" class="btn secondary" data-act="del">Eliminar</button>' : '') +
        '<button type="button" class="btn secondary" data-act="close">Cancelar</button>';
    }
    function openForm(l) {
      form = { id: l ? l.id : null, size: l ? l.size : 'normal', shares: {}, tasks: l ? l.tasks.map(function (t) { return { id: t.id, text: t.text, size: t.size, done: t.done }; }) : [{ text: '', size: 'normal' }] };
      if (l) l.shares.forEach(function (s) { form.shares[s.sub] = s.pct; });
      dlg().innerHTML = '<h3 id="td-dtitle">' + (l ? 'Editar lista' : 'Nueva lista de tareas') + '</h3>' +
        '<label class="field"><span>Nombre</span><input id="tf-name" type="text" maxlength="' + R.TODO_LIMITS.name + '" autocomplete="off" value="' + esc(l ? l.name : '') + '" placeholder="Por ejemplo, Preparar la entrevista"></label>' +
        '<fieldset class="symbols"><legend>Recompensa al completarla entera</legend><ul class="emo-caps" aria-label="Recompensa">' + R.QUEST_SIZES.map(function (z) {
          return '<li><button type="button" class="emo-cap" data-size="' + z.id + '" aria-pressed="' + (z.id === form.size) + '"><span>' + z.label + ' · ' + z.xp + ' XP</span></button></li>';
        }).join('') + '</ul></fieldset>' +
        '<fieldset class="shares"><legend>Tareas (Pequeña +2, Normal +5, Grande +10)</legend><ul class="bs-rows" id="tf-rows">' + rows() + '</ul><button type="button" class="mini" data-act="row-add">Añadir tarea</button></fieldset>' +
        '<fieldset class="shares"><legend>¿A qué subcategorías va la XP?</legend><p class="soft">Vale para las tareas y para la recompensa. Sin ninguna, solo sube el nivel general.</p><div id="tf-pick">' + pickHtml() + '</div></fieldset>' +
        '<p class="msg" id="td-dmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row" id="td-actions">' + actionsHtml() + '</div>';
      dlg().showModal();
    }
    function input() {
      return { name: $('#tf-name').value, size: form.size, shares: K.toList(form.shares, 'pct'),
        tasks: form.tasks.map(function (t) { return { id: t.id, text: t.text, size: t.size }; }) };
    }

    // ---- Marcar y desmarcar: la tarjeta cambia al momento y el guardado va en cola (como en los jefes) ----
    var queue = Promise.resolve(), pendingN = 0, queuedEvents = [], queuedError = null;
    function paintCardNow(cardEl) {
      var boxes = cardEl.querySelectorAll('[data-tk]'), done = 0;
      Array.prototype.forEach.call(boxes, function (c) {
        if (c.checked) done++;
        var li = c.closest('li'); li.setAttribute('data-done', String(c.checked));
        var del = li.querySelector('.td-del'); if (del) del.disabled = c.checked;
      });
      var bar = cardEl.querySelector('.td-prog .xpbar span'), count = cardEl.querySelector('.td-count');
      if (bar && boxes.length) bar.style.width = Math.round(done / boxes.length * 100) + '%';
      if (count) count.textContent = done + ' de ' + boxes.length;
    }
    function enqueue(job) {
      pendingN++;
      queue = queue.then(job).then(function (events) { queuedEvents = queuedEvents.concat(events || []); }, function (e) { queuedError = e; })
        .then(function () {
          if (--pendingN) return null;
          var events = queuedEvents, err = queuedError; queuedEvents = []; queuedError = null;
          return ctx.afterChange(null, events).then(function () { if (err) say(err.message, 'error'); }, function (e) { say((err || e).message, 'error'); return reload(); });
        });
      return queue;
    }

    host.addEventListener('change', function (ev) {
      var t = ev.target, taskId = t && t.getAttribute ? t.getAttribute('data-tk') : null;
      if (taskId) {
        var cardEl = t.closest('.td-card'), id = t.getAttribute('data-list');
        if (t.checked) {
          if (cardEl) paintCardNow(cardEl);
          enqueue(function () { return todos.completeTask(id, taskId); });
          return;
        }
        // Desmarcar quita su XP: primero se pregunta en la misma fila.
        var l = state.lists.filter(function (x) { return x.id === id; })[0], tk = l && l.tasks.filter(function (x) { return x.id === taskId; })[0];
        App.ui.askUncheck(t, 'li', '¿Desmarcar <b>' + esc(tk ? tk.text : 'la tarea') + '</b>? Se quitan sus ' + App.ui.xpText(tk ? tk.xp : 0) + '.', function () {
          if (cardEl) paintCardNow(cardEl);
          enqueue(function () { return todos.uncompleteTask(id, taskId); });
        });
        return;
      }
      var ts = t && t.getAttribute ? t.getAttribute('data-ts') : null;
      if (ts !== null && form) form.tasks[Number(ts)].size = t.value;
    });
    host.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains('td-new') || ev.key !== 'Enter') return;
      ev.preventDefault();
      var text = t.value.trim(); if (!text || busy) return;
      var id = t.getAttribute('data-list'), sizeEl = host.querySelector('.td-new-size[data-list="' + id + '"]');
      busy = true; t.disabled = true;
      todos.addTask(id, { text: text, size: sizeEl ? sizeEl.value : 'normal' }).then(reload).then(function () {
        say('');
        var again = host.querySelector('.td-new[data-list="' + id + '"]'); if (again && again.focus) again.focus();   // para seguir añadiendo
      }).catch(function (e) { t.disabled = false; say(e.message, 'error'); }).then(function () { busy = false; });
    });
    host.addEventListener('input', function (ev) {
      var t = ev.target; if (!t || !form) return;
      var pid = t.getAttribute && t.getAttribute('data-pkval');
      if (pid) { form.shares[pid] = Math.floor(Number(t.value)) || 0; var el = host.querySelector('[data-pk-total]'); if (el) el.textContent = K.summaryText(form.shares, 'pct'); return; }
      var ti = t.getAttribute && t.getAttribute('data-ti');
      if (ti !== null && ti !== undefined) form.tasks[Number(ti)].text = t.value;
    });
    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-pk],[data-size]') : null;
      if (!t) return;
      if (t.getAttribute('data-pk') && form) { K.toggle(form.shares, t.getAttribute('data-pk'), 'pct'); $('#tf-pick').innerHTML = pickHtml(); return; }
      if (t.getAttribute('data-size') && form) {
        form.size = t.getAttribute('data-size');
        Array.prototype.forEach.call(dlg().querySelectorAll('[data-size]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === form.size)); });
        return;
      }
      var act = t.getAttribute('data-act'), id = t.getAttribute('data-id'), inDialog = !!t.closest('#td-dialog');
      if (act === 'close') return dlg().close();
      if (act === 'new') return openForm(null);
      if (act === 'edit') return openForm(state.lists.filter(function (l) { return l.id === id; })[0]);
      if (act === 'row-add') { if (form.tasks.length < R.TODO_LIMITS.tasks) { form.tasks.push({ text: '', size: 'normal' }); $('#tf-rows').innerHTML = rows(); } return; }
      if (act === 'row-del') { form.tasks.splice(Number(t.getAttribute('data-i')), 1); $('#tf-rows').innerHTML = rows(); return; }
      if (act === 'task-del') {
        if (busy) return; busy = true;
        return todos.removeTask(id, t.getAttribute('data-task')).then(function (events) { return events.length ? ctx.afterChange(null, events) : reload(); })
          .catch(function (e) { say(e.message, 'error'); }).then(function () { busy = false; });
      }
      if (act === 'del') { $('#td-actions').innerHTML = '<p class="del-ask">¿Eliminar esta lista? No se puede deshacer. La XP que ya te dio se queda.</p><button type="button" class="btn danger" data-act="del-yes" data-id="' + esc(form.id) + '">Sí, eliminar</button><button type="button" class="btn secondary" data-act="del-no">No</button>'; return; }
      if (act === 'del-card') { asking = id; return paint(); }
      if (act === 'del-no') { if (inDialog) $('#td-actions').innerHTML = actionsHtml(); else { asking = null; paint(); } return; }
      if (act === 'del-yes') {
        if (busy) return; busy = true;
        var l0 = state.lists.filter(function (x) { return x.id === id; })[0];
        return todos.remove(id).then(function () { asking = null; return reload(); }).then(function () {
          if (inDialog) dlg().close();
          say('Lista eliminada' + (l0 ? ': ' + l0.name : '') + '.');
        }).catch(function (e) { if (inDialog) dmsg(e.message); else say(e.message, 'error'); }).then(function () { busy = false; });
      }
      if (act === 'save') {
        if (busy) return; busy = true;
        // Al guardar, afterChange da las recompensas pendientes: si al quitar tareas pendientes la lista quedó completa, se completa.
        var p = form.id ? todos.update(form.id, input()) : todos.create(input());
        return p.then(function () { dlg().close(); return ctx.afterChange(null, []); })
          .catch(function (e) { dmsg(e.message); }).then(function () { busy = false; });
      }
    });

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las tareas. ' + esc(err.message || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
