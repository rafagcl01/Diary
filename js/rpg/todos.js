// Tareas: UNA lista por día. Cada tarea da su XP al marcarla (Pequeña 2, Normal 5, Grande 10) con un tope de 40 XP al día
// por tareas; completar la lista da +20 si tiene al menos 3 tareas (valores en config.js). Toda la XP de tareas va solo al
// nivel general (el `shares` que traen los archivos antiguos se conserva pero no se usa).
//  - Desmarcar una tarea borra su apunte (su XP deja de contar); volver a marcarla la da otra vez, una sola vez.
//    Con la lista completada, lo marcado queda fijo; se pueden seguir añadiendo y marcando tareas nuevas.
//  - Pasado el tope, las tareas se marcan igual con 0 XP (`capped`); la que lo cruza da lo que queda.
//  - Todo sale del registro de XP: tarea = clave `todo:<lista>:<tarea>`, lista completada = clave `todo:<lista>`.
//  - A las 3:00 (ver R.logicalDay) lo hecho se borra y lo pendiente pasa a la lista del día siguiente (con otro id,
//    mismo `shares`). La XP ganada siempre se queda.
// Se guarda en rpg/todos.json: { version: 2, list: { id, day, shares, tasks: [{ id, text, size }], createdAt } }.
// Las versiones anteriores (varias listas) se juntan en la lista de hoy (ver R.migrateTodos).
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/todos.json';
  var T = R.CONFIG.tasks;
  function invalid(msg) { return App.storageError('invalid', msg); }
  R.TASK_SIZES = T.sizes;
  R.TASK_XP_PER_DAY = T.perDay;
  R.TODO_BONUS_XP = T.listBonus;
  R.TODO_MIN_TASKS = T.listMin;
  R.TODO_LIMITS = { task: 100, tasks: 40 };
  R.TODO_ID_RE = /^tl_[0-9a-f]{8}$/;
  R.TASK_ID_RE = /^tk_[0-9a-f]{8}$/;
  R.taskXp = function (size) { var z = R.TASK_SIZES.filter(function (s) { return s.id === size; })[0]; return z ? z.xp : 0; };
  R.isTodoTaskKey = function (key) { return /^todo:tl_[0-9a-f]{8}:tk_[0-9a-f]{8}$/.test(String(key)); };
  function newId(prefix) { return prefix + R.newSubId().slice(3); }

  function cleanTask(t) {
    var text = R.cleanText(t && t.text, R.TODO_LIMITS.task);
    if (!text) return null;
    return { id: t.id && R.TASK_ID_RE.test(t.id) ? t.id : newId('tk_'), text: text, size: R.taskXp(t.size) ? t.size : 'normal' };
  }
  function validList(l) { return !!l && R.TODO_ID_RE.test(l.id) && Array.isArray(l.tasks); }
  function newList(day, shares, tasks, from) {
    var l = { id: newId('tl_'), day: day, shares: shares || [], tasks: tasks || [], createdAt: new Date().toISOString() };
    if (from) l.carriedFrom = from;
    return l;
  }
  function doneKeys(entries) { var o = {}; (entries || []).forEach(function (e) { o[e.key] = true; }); return o; }

  // De cualquier versión del archivo a la lista única (sin escribir nada). Versión 1 (varias listas): la lista de hoy
  // conserva su id y sus tareas (las hechas siguen hechas); lo pendiente de las demás se le añade al final. Lo hecho en
  // otras listas no pasa: su XP ya está en el registro (si pasara, se podría volver a marcar). El reparto se conserva si
  // todas las listas tenían el mismo; si no, se queda sin reparto (`mixedShares` para avisar).
  // Devuelve { list, migrated, mixedShares }.
  R.migrateTodos = function (doc, entries, today) {
    if (!doc) return { list: null, migrated: false };
    if (doc.version === 2 || doc.list !== undefined) return { list: validList(doc.list) ? doc.list : null, migrated: false };
    var lists = (Array.isArray(doc.lists) ? doc.lists : []).filter(validList);
    if (!lists.length) return { list: null, migrated: true };
    var have = doneKeys(entries);
    function pending(l) { return have['todo:' + l.id] ? [] : l.tasks.filter(function (t) { return !have['todo:' + l.id + ':' + t.id]; }); }
    var keys = lists.map(function (l) { return JSON.stringify(l.shares || []); });
    var same = keys.every(function (k) { return k === keys[0]; }), shares = same ? (lists[0].shares || []) : [];
    // La de hoy (las de antes de tener día también eran de hoy: la limpieza de las 3:00 las fechaba hoy).
    var base = lists.filter(function (l) { return l.day === today && !have['todo:' + l.id]; })[0] ||
      lists.filter(function (l) { return !l.day && !have['todo:' + l.id]; })[0] || null;
    var list = base ? { id: base.id, day: today, shares: shares, tasks: base.tasks.slice(), createdAt: base.createdAt || new Date().toISOString() } : newList(today, shares, []);
    var ids = {}; list.tasks.forEach(function (t) { ids[t.id] = true; });
    lists.forEach(function (l) {
      if (l === base) return;
      pending(l).forEach(function (t) { if (!ids[t.id] && list.tasks.length < R.TODO_LIMITS.tasks) { ids[t.id] = true; list.tasks.push({ id: t.id, text: t.text, size: t.size }); } });
    });
    if (!base && !list.tasks.length) return { list: null, migrated: true, mixedShares: !same };
    return { list: list, migrated: true, mixedShares: !same };
  };

  // XP de tareas ya ganada un día (para el tope).
  R.taskXpOn = function (entries, day) {
    var voided = R.voidedKeys(entries);
    return (entries || []).reduce(function (t, e) { return t + (e && R.isTodoTaskKey(e.key) && e.day === day && !voided[e.key] ? Math.max(0, e.xp) : 0); }, 0);
  };

  // Estado de la lista a partir del registro: tareas hechas (con la XP que dieron), si está completada, tope del día.
  R.todoView = function (l, entries) {
    var byKey = {}; entries.forEach(function (e) { byKey[e.key] = e; });
    var used = R.taskXpOn(entries, l.day), left = Math.max(0, R.TASK_XP_PER_DAY - used);
    var tasks = l.tasks.map(function (t) {
      var e = byKey['todo:' + l.id + ':' + t.id];
      return Object.assign({}, t, { done: !!e, xp: e ? e.xp : Math.min(R.taskXp(t.size), left), sizeXp: R.taskXp(t.size), capped: e ? e.xp < R.taskXp(t.size) : left < R.taskXp(t.size) });
    });
    var doneN = tasks.filter(function (t) { return t.done; }).length, fin = byKey['todo:' + l.id];
    return Object.assign({}, l, { name: 'Tareas de hoy', tasks: tasks, doneCount: doneN, xp: R.TODO_BONUS_XP, completed: !!fin, rewardXp: fin ? fin.xp : null,
      allDone: tasks.length > 0 && doneN === tasks.length, eligible: tasks.length >= R.TODO_MIN_TASKS, usedXp: used, leftXp: left, capXp: R.TASK_XP_PER_DAY });
  };

  App.createTodoRepo = function (store, rpg) {
    var cache, pending = null;   // cache: el documento tal cual está en el archivo (undefined = sin leer)
    function ensure(doc) {
      if (doc && (typeof doc !== 'object' || (doc.list === undefined && !Array.isArray(doc.lists)) || (doc.list !== undefined && doc.list !== null && typeof doc.list !== 'object'))) {
        throw invalid('El archivo de tareas está dañado. No lo toco; revísalo en GitHub.');
      }
      return doc;
    }
    function loadDoc(force) {
      if (cache !== undefined && !force) return Promise.resolve(cache);
      if (pending && !force) return pending;
      var p = store.readJson(PATH, null).then(function (doc) { cache = ensure(doc); pending = null; return cache; }, function (e) { pending = null; throw e; });
      pending = p;
      return p;
    }
    // La lista que ve la aplicación: la de hoy (de un día pasado no se ve; cleanup() hace el cambio en el archivo).
    function current(doc, entries) {
      var m = R.migrateTodos(doc, entries, R.logicalDay());
      return m.list && m.list.day >= R.logicalDay() ? m.list : null;
    }
    // Lee, cambia y escribe la lista. `change(list, st)` recibe la lista de hoy (o null) y devuelve { list, result }.
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          var cur = current(ensure(doc), st.entries);
          var out = change(cur ? JSON.parse(JSON.stringify(cur)) : null, st);
          result = out.result;
          return { version: 2, list: out.list };
        }, { fallback: null, message: message });
      }).then(function (written) { cache = written; return result; });
    }
    function need(list) { if (!list) throw invalid('Hoy todavía no hay tareas.'); return list; }
    function findTask(list, taskId) { for (var i = 0; i < list.tasks.length; i++) if (list.tasks[i].id === taskId) return i; throw invalid('Esa tarea ya no existe.'); }
    function isDone(entries, key) { return entries.some(function (e) { return e.key === key; }); }
    // Si todas las tareas están hechas y hay al menos 3, da el bonus de la lista (una sola vez, por su clave).
    function finishIfDone(l, events) {
      return rpg.state().then(function (st) {
        var v = R.todoView(l, st.entries);
        if (v.completed || !v.allDone || !v.eligible) return events;
        return rpg.addEntry({ kind: 'quest', key: 'todo:' + l.id, quest: l.id, label: 'Lista del día completa', xp: R.TODO_BONUS_XP, day: l.day }).then(function (res) {
          if (!res.duplicate) events.push({ type: 'todo', label: 'Lista del día', xp: R.TODO_BONUS_XP });
          return events;
        });
      });
    }
    function today() { return Promise.all([loadDoc(), rpg.state()]).then(function (r) { return { list: current(r[0], r[1].entries), st: r[1] }; }); }

    var api = {
      // { list: vista o null, lists: [vista] (para quien aún lee varias) }
      state: function (force) {
        return Promise.all([loadDoc(force), rpg.state()]).then(function (r) {
          var l = current(r[0], r[1].entries), v = l ? R.todoView(l, r[1].entries) : null;
          return { list: v, lists: v ? [v] : [], usedXp: v ? v.usedXp : R.taskXpOn(r[1].entries, R.logicalDay()), capXp: R.TASK_XP_PER_DAY };
        });
      },
      // Añade una tarea al final (crea la lista de hoy si no la hay). Acepta addTask(task) o addTask(idLista, task).
      addTask: function (a, b) {
        var task = typeof a === 'string' ? b : a;
        return mutate('Añade una tarea', function (list) {
          list = list || newList(R.logicalDay(), [], []);
          if (list.tasks.length >= R.TODO_LIMITS.tasks) throw invalid('La lista ya tiene el máximo de tareas.');
          var t = cleanTask(task || {});
          if (!t) throw invalid('Escribe la tarea.');
          list.tasks.push(t);
          return { list: list, result: t };
        });
      },
      // Cambia el texto o el tamaño de una tarea sin marcar.
      updateTask: function (taskId, input) {
        return mutate('Edita una tarea', function (list, st) {
          need(list);
          var i = findTask(list, taskId);
          if (isDone(st.entries, 'todo:' + list.id + ':' + taskId)) throw invalid('Esa tarea ya está marcada: desmárcala para cambiarla.');
          var t = cleanTask(Object.assign({}, list.tasks[i], input || {}, { id: taskId }));
          if (!t) throw invalid('Escribe la tarea.');
          list.tasks[i] = t;
          return { list: list, result: t };
        });
      },
      // Sube (−1) o baja (+1) una tarea en la lista.
      moveTask: function (taskId, dir) {
        return mutate('Reordena las tareas', function (list) {
          need(list);
          var i = findTask(list, taskId), j = i + (dir < 0 ? -1 : 1);
          if (j < 0 || j >= list.tasks.length) return { list: list, result: false };
          var tmp = list.tasks[i]; list.tasks[i] = list.tasks[j]; list.tasks[j] = tmp;
          return { list: list, result: true };
        });
      },
      // Quita una tarea sin marcar (las marcadas, primero se desmarcan). Puede completar la lista si las demás ya estaban hechas.
      removeTask: function (a, b) {
        var taskId = b === undefined ? a : b, id = null;
        return mutate('Quita una tarea', function (list, st) {
          need(list); id = list.id;
          var i = findTask(list, taskId);
          if (isDone(st.entries, 'todo:' + list.id + ':' + taskId)) throw invalid('Esa tarea está marcada: desmárcala antes de quitarla.');
          list.tasks.splice(i, 1);
          return { list: list, result: list };
        }).then(function (l) { return finishIfDone(l, []); });
      },
      // Marca una tarea: da su XP (una sola vez; con el tope del día, lo que quede o 0) y, si era la última, el bonus.
      completeTask: function (id, taskId) {
        return today().then(function (r) {
          var l = need(r.list);
          if (id && id !== l.id) throw invalid('Esa lista ya no existe.');
          var t = l.tasks.filter(function (x) { return x.id === taskId; })[0];
          if (!t) throw invalid('Esa tarea ya no existe.');
          var left = Math.max(0, R.TASK_XP_PER_DAY - R.taskXpOn(r.st.entries, l.day)), xp = Math.min(R.taskXp(t.size), left);
          var entry = { kind: 'quest', key: 'todo:' + l.id + ':' + taskId, quest: l.id, label: t.text, xp: xp, day: l.day };   // solo nivel general
          if (!xp) entry.capped = true;
          return rpg.addEntry(entry).then(function () { return finishIfDone(l, []); });
        });
      },
      // Limpieza de las 3:00: la lista de otro día se cambia por una nueva de hoy con lo pendiente (mismo reparto; las tareas
      // conservan su id). Las versiones antiguas del archivo se pasan a la lista única. Solo escribe si hay algo que hacer.
      // Devuelve cuántas tareas se han pasado a hoy.
      cleanup: function () {
        return Promise.all([loadDoc(), rpg.state()]).then(function (r) {
          var doc = r[0], m = R.migrateTodos(doc, r[1].entries, R.logicalDay());
          var stale = m.list && m.list.day < R.logicalDay();
          if (!m.migrated && !stale) return 0;
          var carried = 0;
          return store.updateJson(PATH, function (d) {
            var mm = R.migrateTodos(ensure(d), r[1].entries, R.logicalDay()), l = mm.list;
            if (l && l.day < R.logicalDay()) {
              var have = doneKeys(r[1].entries), left = have['todo:' + l.id] ? [] : l.tasks.filter(function (t) { return !have['todo:' + l.id + ':' + t.id]; });
              carried = left.length;
              l = left.length ? newList(R.logicalDay(), l.shares, left, l.day) : null;
            }
            return { version: 2, list: l };
          }, { fallback: null, message: m.migrated ? 'Junta las listas de tareas en la lista del día' : 'Pasa las tareas pendientes a hoy' })
            .then(function (written) { cache = written; return carried; });
        });
      },
      // Da el bonus si la lista ya cumple (por ejemplo, tras quitar la última pendiente). Idempotente. Devuelve eventos.
      sync: function () {
        return today().then(function (r) { return r.list ? finishIfDone(r.list, []) : []; });
      },
      // Tareas elegidas en las entradas de una página del diario (block.tasks = [{ list, task, text }]): al guardar la página
      // se marcan, una sola vez (la clave es la de la tarea). Las que ya estaban hechas o ya no existen se ignoran.
      // (Quitar una tarea de la entrada la desmarca al guardar, con confirmación: ver R.diaryRemovals.) Devuelve { logged, events }.
      completeFromBlocks: function (blocks) {
        var out = { logged: [], events: [] };
        return today().then(function (r) {
          var l = r.list; if (!l) return null;
          var have = doneKeys(r.st.entries), todo = [];
          (blocks || []).forEach(function (b) {
            (b.tasks || []).forEach(function (ref) {
              var t = ref.list === l.id && l.tasks.filter(function (x) { return x.id === ref.task; })[0];
              var key = 'todo:' + l.id + ':' + ref.task;
              if (!t || have[key]) return;
              have[key] = true; todo.push(t);
            });
          });
          return todo.reduce(function (p, t) {
            return p.then(function () {
              return api.completeTask(l.id, t.id).then(function (ev) {
                return rpg.entries().then(function (all) {
                  var e = all.filter(function (x) { return x.key === 'todo:' + l.id + ':' + t.id; })[0];
                  out.logged.push({ key: 'todo:' + l.id + ':' + t.id, label: t.text, xp: e ? e.xp : 0 });
                  out.events = out.events.concat(ev);
                });
              }, function () { /* la lista cambió entretanto: se ignora */ });
            });
          }, Promise.resolve());
        }).then(function () { return out; });
      },
      // Desmarca una tarea: su XP deja de contar. Con la lista completada, lo marcado queda fijo.
      uncompleteTask: function (id, taskId) {
        return today().then(function (r) {
          var l = r.list;
          if (!l || (id && id !== l.id)) throw invalid('Esa lista ya no existe.');
          if (isDone(r.st.entries, 'todo:' + l.id)) throw invalid('La lista de hoy ya está completada: sus tareas marcadas quedan fijas.');
          var key = 'todo:' + l.id + ':' + taskId;
          if (!isDone(r.st.entries, key)) return [];
          return rpg.removeEntry(key).then(function () { return []; });
        });
      }
    };
    return api;
  };

  var current = { store: null, repo: null };
  R.todos = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createTodoRepo(store, rpg) };
    return current.repo;
  };
})(window.App = window.App || {});
