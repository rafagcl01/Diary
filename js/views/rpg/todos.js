// Panel «Tareas» de la ficha: la lista del día (una sola). Cada tarea da su XP al marcarla (hasta 40 XP al día por tareas)
// y completar la lista da +20 si tiene al menos 3 tareas; toda va al nivel general. Las tareas se añaden escribiendo en la
// tarjeta (Intro); cada una se puede editar en su fila (lápiz), subir, bajar y quitar.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, V = App.rpgViews, icon = App.icon;

  function sizeSelect(attrs, current) {
    return '<select ' + attrs + '>' + R.TASK_SIZES.map(function (z) {
      return '<option value="' + z.id + '"' + (z.id === current ? ' selected' : '') + '>' + z.label + ' · +' + z.xp + '</option>';
    }).join('') + '</select>';
  }
  function progress(l) {
    var n = l.tasks.length, f = n ? l.doneCount / n : 0;
    return '<div class="td-prog"><div class="xpbar" role="img" aria-label="' + l.doneCount + ' de ' + n + ' tareas"><span style="width:' + Math.round(f * 100) + '%"></span></div>' +
      '<span class="soft td-count">' + l.doneCount + ' de ' + n + '</span></div>' +
      '<p class="soft td-cap">XP de tareas hoy: <b>' + l.usedXp + ' / ' + l.capXp + '</b>' + (l.leftXp ? '' : ' · ya tienes el máximo: las siguientes cuentan para la lista, sin XP') + '</p>';
  }
  function bonusTag(l) {
    if (l.completed) return '<span class="tag ok card-tag">Completada ✓ +' + l.rewardXp + '</span>';
    if (!l.eligible) return '<span class="tag card-tag">+' + l.xp + ' XP con ' + R.TODO_MIN_TASKS + ' tareas o más</span>';
    return '<span class="tag card-tag">+' + l.xp + ' XP al terminar</span>';
  }
  function taskXp(t) { return '+' + t.xp; }   // la que dio (hecha) o la que daría ahora (con el tope, puede ser menos o 0)
  function row(l, t, i, editing) {
    var id = esc(t.id), first = i === 0, last = i === l.tasks.length - 1;
    if (editing === t.id && !t.done) {
      return '<li class="td-editing"><div class="td-row"><input type="text" class="td-edit" data-task="' + id + '" maxlength="' + R.TODO_LIMITS.task + '" value="' + esc(t.text) + '" aria-label="Texto de la tarea">' +
        sizeSelect('class="td-edit-size" data-task="' + id + '" aria-label="Tamaño de la tarea"', t.size) + '</div>' +
        '<div class="sub-tools"><button type="button" class="mini" data-act="edit-save" data-task="' + id + '">Guardar</button><button type="button" class="mini" data-act="edit-no">Cancelar</button></div></li>';
    }
    return '<li data-menu-host data-done="' + t.done + '"' + (t.capped && !t.done ? ' data-capped="true"' : '') + '><label class="bs-check"><input type="checkbox" data-tk="' + id + '" data-list="' + esc(l.id) + '"' + (t.done ? ' checked' : '') + (t.done && l.completed ? ' disabled' : '') + '>' +
      '<span class="bs-text">' + esc(t.text) + '</span></label><span class="td-xp" title="' + (t.capped ? 'Tope de XP de tareas de hoy' : '') + '">' + taskXp(t) + '</span>' +
      '<span class="td-tools">' +
        '<button type="button" class="td-move" data-act="up" data-task="' + id + '" data-menu-label="Subir"' + (first ? ' disabled' : '') + ' aria-label="Subir ' + esc(t.text) + '">' + icon('chev-l') + '</button>' +
        '<button type="button" class="td-move down" data-act="down" data-task="' + id + '" data-menu-label="Bajar"' + (last ? ' disabled' : '') + ' aria-label="Bajar ' + esc(t.text) + '">' + icon('chev-l') + '</button>' +
        '<button type="button" class="td-edit-btn" data-act="edit-task" data-task="' + id + '" data-menu-label="Editar la tarea"' + (t.done ? ' disabled' : '') + ' aria-label="Editar ' + esc(t.text) + '">' + icon('pencil') + '</button>' +
        '<button type="button" class="td-del" data-act="task-del" data-task="' + id + '" data-menu-label="Quitar la tarea"' + (t.done ? ' disabled' : '') + ' aria-label="Quitar la tarea ' + esc(t.text) + '">×</button>' +
      '</span></li>';
  }
  function card(l, editing) {
    var tasks = l.tasks.map(function (t, i) { return row(l, t, i, editing); }).join('');
    return '<div class="td-card" data-list-id="' + esc(l.id) + '"><div class="wk-head"><h3>Tareas de hoy</h3>' + bonusTag(l) + '</div>' +
      progress(l) +
      (tasks ? '<ul class="bs-steps td-tasks" aria-label="Tareas de hoy">' + tasks + '</ul>' : '<p class="soft">Todavía sin tareas para hoy: escribe la primera aquí debajo.</p>') +
      newRow(l.id) + '</div>';
  }
  function newRow(id) {
    return '<div class="td-new-row"><input type="text" class="td-new" data-list="' + esc(id || '') + '" maxlength="' + R.TODO_LIMITS.task + '" autocomplete="off" placeholder="Añadir tarea… (Intro)" aria-label="Nueva tarea">' +
      sizeSelect('class="td-new-size" aria-label="Tamaño de la nueva tarea"', 'normal') + '</div>';
  }

  V.todoPanel = function (host, ctx) {
    var todos = ctx.todos;
    host.innerHTML = '<div class="col-head"><h2>Tareas</h2></div>' +
      '<p class="expire-tag">' + icon('clock') + 'Mañana a las 3:00 · lo pendiente pasa al día siguiente</p>' +
      '<p class="msg" id="td-msg" role="status" data-kind="ok"></p><div id="td-body" class="col-scroll"></div>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#td-body');
    var state = null, busy = false, editing = null;

    function say(t, kind) { var m = $('#td-msg'); m.textContent = t || ''; m.setAttribute('data-kind', kind || 'ok'); }
    function paint() {
      var l = state.list;
      body.innerHTML = l ? card(l, editing) :
        '<div class="td-card"><div class="wk-head"><h3>Tareas de hoy</h3><span class="tag card-tag">+' + R.TODO_BONUS_XP + ' XP con ' + R.TODO_MIN_TASKS + ' tareas o más</span></div>' +
        '<p class="soft">Todavía sin tareas para hoy: escribe la primera aquí debajo.</p>' + newRow('') + '</div>';
      if (App.ui.enhanceMenus) App.ui.enhanceMenus(body);
    }
    // Antes de pintar, la limpieza de las 3:00 si toca (lo hecho ayer se va; lo pendiente pasa a hoy).
    function reload() {
      return todos.cleanup().catch(function () {}).then(function () { return todos.state(); })
        .then(function (s) { state = s; paint(); });
    }
    function run(job) {
      if (busy) return null; busy = true;
      return Promise.resolve().then(job).catch(function (e) { say(e.message, 'error'); }).then(function () { busy = false; });
    }

    // ---- Marcar y desmarcar: la tarjeta cambia al momento y el guardado va en cola (como en los jefes) ----
    var queue = Promise.resolve(), pendingN = 0, queuedEvents = [], queuedError = null;
    function paintCardNow(cardEl) {
      var boxes = cardEl.querySelectorAll('[data-tk]'), done = 0;
      Array.prototype.forEach.call(boxes, function (c) {
        if (c.checked) done++;
        var li = c.closest('li'); li.setAttribute('data-done', String(c.checked));
        Array.prototype.forEach.call(li.querySelectorAll('.td-del, .td-edit-btn'), function (b) { b.disabled = c.checked; });
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
    function taskById(taskId) { return state.list && state.list.tasks.filter(function (x) { return x.id === taskId; })[0]; }

    host.addEventListener('change', function (ev) {
      var t = ev.target, taskId = t && t.getAttribute ? t.getAttribute('data-tk') : null;
      if (!taskId) return;
      var cardEl = t.closest('.td-card'), id = t.getAttribute('data-list');
      if (t.checked) {
        if (cardEl) paintCardNow(cardEl);
        var done = taskById(taskId); if (V.fx) V.fx.sparks(t, done ? done.xp : 0);   // chispas de la casilla a la barra de XP
        enqueue(function () { return todos.completeTask(id, taskId); });
        return;
      }
      // Desmarcar quita su XP: primero se pregunta en la misma fila.
      var tk = taskById(taskId);
      App.ui.askUncheck(t, 'li', '¿Desmarcar <b>' + esc(tk ? tk.text : 'la tarea') + '</b>?' + (tk && tk.xp ? ' Se quitan sus ' + App.ui.xpText(tk.xp) + '.' : ''), function () {
        if (cardEl) paintCardNow(cardEl);
        enqueue(function () { return todos.uncompleteTask(id, taskId); });
      });
    });
    host.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (!t || !t.classList || ev.key !== 'Enter') return;
      if (t.classList.contains('td-edit')) { ev.preventDefault(); var sv = host.querySelector('[data-act="edit-save"]'); if (sv) sv.click(); return; }
      if (!t.classList.contains('td-new')) return;
      ev.preventDefault();
      var text = t.value.trim(); if (!text || busy) return;
      var sizeEl = host.querySelector('.td-new-size');
      busy = true; t.disabled = true;
      todos.addTask({ text: text, size: sizeEl ? sizeEl.value : 'normal' }).then(reload).then(function () {
        say('');
        var again = host.querySelector('.td-new'); if (again && again.focus) again.focus();   // para seguir añadiendo
      }).catch(function (e) { t.disabled = false; say(e.message, 'error'); }).then(function () { busy = false; });
    });
    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
      if (!t) return;
      var act = t.getAttribute('data-act'), taskId = t.getAttribute('data-task');
      if (act === 'edit-task') { editing = taskId; paint(); var inp = host.querySelector('.td-edit'); if (inp && inp.focus) inp.focus(); return; }
      if (act === 'edit-no') { editing = null; return paint(); }
      if (act === 'edit-save') {
        var txt = host.querySelector('.td-edit'), sz = host.querySelector('.td-edit-size');
        return run(function () { return todos.updateTask(taskId, { text: txt ? txt.value : '', size: sz ? sz.value : 'normal' }).then(function () { editing = null; return reload(); }); });
      }
      if (act === 'up' || act === 'down') {
        return run(function () {
          return todos.moveTask(taskId, act === 'up' ? -1 : 1).then(reload).then(function () {
            var b = host.querySelector('[data-act="' + act + '"][data-task="' + taskId + '"]'); if (b && !b.disabled && b.focus) b.focus();
          });
        });
      }
      if (act === 'task-del') {
        return run(function () { return todos.removeTask(taskId).then(function (events) { return events.length ? ctx.afterChange(null, events) : reload(); }); });
      }
    });

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las tareas. ' + esc(err.message || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
