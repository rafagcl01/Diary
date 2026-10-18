// Listas de tareas: cada tarea da su XP al marcarla (Pequeña 2, Normal 5, Grande 10) y completar la lista entera da
// la recompensa grande, elegida como en las misiones (15 / 30 / 60 / 100). La XP va al reparto de atributos de la lista.
//  - Desmarcar una tarea borra su apunte (su XP deja de contar); volver a marcarla la da otra vez, una sola vez.
//  - Al completarse, la lista recibe su recompensa y queda fija como «Completada» hasta que la elimines.
//  - Todo sale del registro de XP: tarea = clave `todo:<lista>:<tarea>`, lista completada = clave `todo:<lista>`.
// Se guardan en rpg/todos.json. Eliminar una lista no quita la XP que ya dio.
// Son listas del día: a las 3:00 (ver R.logicalDay) lo hecho se borra y lo pendiente pasa a una lista nueva del día
// siguiente, con el mismo nombre, recompensa y reparto (ver cleanup). La XP ganada siempre se queda.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/todos.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  R.TASK_SIZES = [{ id: 'pequena', label: 'Pequeña', xp: 2 }, { id: 'normal', label: 'Normal', xp: 5 }, { id: 'grande', label: 'Grande', xp: 10 }];
  R.TODO_LIMITS = { name: 60, task: 100, tasks: 40, lists: 40 };
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
  // Valida una lista (lanza un error claro). Las tareas sin texto se descartan.
  R.sanitizeTodo = function (input, structure, base) {
    if (!input || typeof input !== 'object') throw invalid('La lista no es válida.');
    var name = R.cleanText(input.name, R.TODO_LIMITS.name);
    if (!name) throw invalid('Ponle un nombre a la lista.');
    if (!R.sizeXp(input.size)) throw invalid('Elige la recompensa de la lista.');
    var seen = {}, total = 0;
    var shares = (input.shares || []).map(function (s) {
      var pct = Number(s && s.pct);
      if (!isFinite(pct) || Math.floor(pct) !== pct || pct < 1 || pct > 100) throw invalid('Los porcentajes deben ser enteros entre 1 y 100.');
      var f = R.findSub(structure, s.sub);
      if (!f) throw invalid('Esa subcategoría no existe.');
      if (f.sub.archived) throw invalid('«' + f.sub.name + '» está archivada.');
      if (seen[s.sub]) throw invalid('Una subcategoría aparece dos veces.');
      seen[s.sub] = true; total += pct;
      return { sub: s.sub, pct: pct };
    });
    if (shares.length && total !== 100) throw invalid('Los porcentajes deben sumar 100 (ahora suman ' + total + ').');
    var ids = {};
    var tasks = (input.tasks || []).map(cleanTask).filter(function (t) { if (!t || ids[t.id]) return false; ids[t.id] = true; return true; });
    if (tasks.length > R.TODO_LIMITS.tasks) throw invalid('Demasiadas tareas (máximo ' + R.TODO_LIMITS.tasks + ').');
    return { id: base && base.id ? base.id : newId('tl_'), name: name, size: input.size, shares: shares, tasks: tasks,
      day: base && base.day ? base.day : R.logicalDay(), createdAt: base && base.createdAt ? base.createdAt : new Date().toISOString() };
  };

  // Estado de una lista a partir del registro: tareas hechas y si está completada.
  R.todoView = function (l, entries) {
    var byKey = {}; entries.forEach(function (e) { byKey[e.key] = e; });
    var tasks = l.tasks.map(function (t) { return Object.assign({}, t, { xp: R.taskXp(t.size), done: !!byKey['todo:' + l.id + ':' + t.id] }); });
    var doneN = tasks.filter(function (t) { return t.done; }).length, fin = byKey['todo:' + l.id];
    return Object.assign({}, l, { tasks: tasks, doneCount: doneN, xp: R.sizeXp(l.size), completed: !!fin, rewardXp: fin ? fin.xp : null, allDone: tasks.length > 0 && doneN === tasks.length });
  };

  App.createTodoRepo = function (store, rpg) {
    var cache = null, pending = null;
    function ensure(doc) {
      if (doc && (typeof doc !== 'object' || !Array.isArray(doc.lists))) throw invalid('El archivo de tareas está dañado. No lo toco; revísalo en GitHub.');
      return doc ? doc.lists : [];
    }
    function valid(l) { return l && R.TODO_ID_RE.test(l.id) && Array.isArray(l.tasks); }
    // De otro día (o sin día: listas de antes de este cambio, que se fechan hoy en la primera limpieza).
    function stale(l) { return !l.day || l.day < R.logicalDay(); }
    // Lo que ve la aplicación: solo las listas de hoy. Se calcula cada vez, así que a las 3:00 desaparecen aunque la
    // página lleve horas abierta (las sin día se ven hasta que cleanup les pone uno). cleanup() hace el cambio en el archivo.
    function live(all) { return all.filter(function (l) { return !l.day || l.day >= R.logicalDay(); }); }
    function loadAll(force) {
      if (cache && !force) return Promise.resolve(cache);
      if (pending && !force) return pending;
      var p = store.readJson(PATH, null).then(function (doc) {
        cache = ensure(doc).filter(valid); pending = null; return cache;
      }, function (e) { pending = null; throw e; });
      pending = p;
      return p;
    }
    function loadRaw(force) { return loadAll(force).then(live); }
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          var list = ensure(doc).slice();
          result = change(list, st);
          return { version: 1, lists: list };
        }, { fallback: null, message: message });
      }).then(function (written) { cache = written.lists.filter(valid); return result; });
    }
    function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; throw invalid('Esa lista ya no existe.'); }
    function isDone(entries, id) { return entries.some(function (e) { return e.key === 'todo:' + id; }); }
    function doneTasks(entries, id) { var out = {}; entries.forEach(function (e) { var m = /^todo:(tl_[0-9a-f]{8}):(tk_[0-9a-f]{8})$/.exec(e.key); if (m && m[1] === id) out[m[2]] = true; }); return out; }
    // Si todas las tareas están hechas, da la recompensa de la lista (una sola vez, por su clave).
    function finishIfDone(l, events) {
      return rpg.state().then(function (st) {
        var v = R.todoView(l, st.entries);
        if (v.completed || !v.allDone) return events;
        return rpg.addEntry({ kind: 'quest', key: 'todo:' + l.id, quest: l.id, label: l.name, xp: R.sizeXp(l.size), shares: l.shares }).then(function (res) {
          if (!res.duplicate) events.push({ type: 'todo', label: l.name, xp: R.sizeXp(l.size) });
          return events;
        });
      });
    }

    var api = {
      state: function (force) {
        return Promise.all([loadRaw(force), rpg.state()]).then(function (r) {
          return { lists: r[0].map(function (l) { return R.todoView(l, r[1].entries); }) };
        });
      },
      create: function (input) {
        return Promise.resolve().then(function () {
          return mutate('Crea una lista de tareas', function (list, st) {
            if (list.length >= R.TODO_LIMITS.lists) throw invalid('Ya tienes el máximo de listas.');
            var l = R.sanitizeTodo(input, st.structure, null); list.push(l); return l;
          });
        });
      },
      // Edita una lista sin completar. Las tareas ya marcadas no se pueden quitar (desmárcalas primero).
      update: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita una lista de tareas', function (list, st) {
            var i = find(list, id);
            if (isDone(st.entries, id)) throw invalid('Una lista completada no se puede cambiar.');
            var l = R.sanitizeTodo(input, st.structure, list[i]), done = doneTasks(st.entries, id);
            list[i].tasks.forEach(function (old) {
              if (done[old.id] && !l.tasks.some(function (t) { return t.id === old.id; })) throw invalid('«' + old.text + '» está marcada: desmárcala antes de quitarla.');
            });
            list[i] = l; return l;
          });
        });
      },
      // Añade una tarea al final (desde la propia tarjeta).
      addTask: function (id, task) {
        return Promise.resolve().then(function () {
          return mutate('Añade una tarea', function (list, st) {
            var i = find(list, id);
            if (isDone(st.entries, id)) throw invalid('Esta lista ya está completada.');
            if (list[i].tasks.length >= R.TODO_LIMITS.tasks) throw invalid('Esta lista ya tiene el máximo de tareas.');
            var t = cleanTask(task || {});
            if (!t) throw invalid('Escribe la tarea.');
            list[i] = Object.assign({}, list[i], { tasks: list[i].tasks.concat([t]) });
            return t;
          });
        });
      },
      // Quita una tarea sin marcar (las marcadas, primero se desmarcan). Puede completar la lista si las demás ya estaban hechas.
      removeTask: function (id, taskId) {
        return Promise.resolve().then(function () {
          return mutate('Quita una tarea', function (list, st) {
            var i = find(list, id);
            if (isDone(st.entries, id)) throw invalid('Esta lista ya está completada.');
            if (doneTasks(st.entries, id)[taskId]) throw invalid('Esa tarea está marcada: desmárcala antes de quitarla.');
            list[i] = Object.assign({}, list[i], { tasks: list[i].tasks.filter(function (t) { return t.id !== taskId; }) });
            return list[i];
          }).then(function (l) { return finishIfDone(l, []); });
        });
      },
      // Elimina la lista (completada o no). La XP que ya dio se queda.
      remove: function (id) {
        return Promise.resolve().then(function () {
          return mutate('Elimina una lista de tareas', function (list) { var i = find(list, id), l = list[i]; list.splice(i, 1); return l; });
        });
      },
      // Marca una tarea: da su XP (una sola vez) y, si era la última, la recompensa de la lista. Devuelve los eventos.
      completeTask: function (id, taskId) {
        return Promise.all([loadRaw(), rpg.state()]).then(function (r) {
          var l = r[0].filter(function (x) { return x.id === id; })[0];
          if (!l) throw invalid('Esa lista ya no existe.');
          var t = l.tasks.filter(function (x) { return x.id === taskId; })[0];
          if (!t) throw invalid('Esa tarea ya no existe.');
          if (isDone(r[1].entries, id)) throw invalid('Esta lista ya está completada.');
          return rpg.addEntry({ kind: 'quest', key: 'todo:' + id + ':' + taskId, quest: id, label: t.text, xp: R.taskXp(t.size), shares: l.shares })
            .then(function () { return finishIfDone(l, []); });
        });
      },
      // Limpieza de las 3:00: cada lista de otro día se borra y sus tareas pendientes pasan a una lista nueva de hoy
      // (mismo nombre, recompensa y reparto; las tareas conservan su id). Las listas sin día se fechan hoy.
      // Solo escribe si hay algo que hacer. Devuelve cuántas listas se han pasado a hoy.
      cleanup: function () {
        return loadAll().then(function (all) {
          if (!all.some(stale)) return 0;
          var carried = 0;
          return mutate('Limpia las tareas de días pasados', function (list, st) {
            var today = R.logicalDay();
            for (var i = list.length - 1; i >= 0; i--) {
              var l = list[i];
              if (!valid(l) || !stale(l)) continue;
              if (!l.day) { list[i] = Object.assign({}, l, { day: today }); continue; }
              var done = doneTasks(st.entries, l.id), left = isDone(st.entries, l.id) ? [] : l.tasks.filter(function (t) { return !done[t.id]; });
              list.splice(i, 1);
              if (left.length) { list.push({ id: newId('tl_'), name: l.name, size: l.size, shares: l.shares, tasks: left, day: today, carriedFrom: l.day, createdAt: new Date().toISOString() }); carried++; }
            }
          }).then(function () { return carried; });
        });
      },
      // Da la recompensa a las listas que tengan todas sus tareas hechas y aún no la tengan. Idempotente. Devuelve eventos.
      sync: function () {
        return loadRaw().then(function (lists) {
          return lists.reduce(function (chain, l) { return chain.then(function (ev) { return finishIfDone(l, ev); }); }, Promise.resolve([]));
        });
      },
      // Tareas elegidas en las entradas de una página del diario (block.tasks = [{ list, task, text }]): al guardar la página
      // se marcan en su lista, una sola vez (la clave es la de la tarea). Las que ya estaban hechas, o cuya lista ya no
      // existe o está completada, se ignoran. (Quitar una tarea de la entrada la desmarca al guardar, con confirmación:
      // ver R.diaryRemovals.) Devuelve { logged, events }.
      completeFromBlocks: function (blocks) {
        var out = { logged: [], events: [] };
        return Promise.all([loadRaw(), rpg.state()]).then(function (r) {
          var have = {}; r[1].entries.forEach(function (e) { have[e.key] = true; });
          var todo = [];
          (blocks || []).forEach(function (b) {
            (b.tasks || []).forEach(function (ref) {
              var l = r[0].filter(function (x) { return x.id === ref.list; })[0], t = l && l.tasks.filter(function (x) { return x.id === ref.task; })[0];
              if (!t || have['todo:' + l.id] || have['todo:' + l.id + ':' + t.id]) return;
              have['todo:' + l.id + ':' + t.id] = true;
              todo.push({ l: l, t: t });
            });
          });
          return todo.reduce(function (p, x) {
            return p.then(function () {
              return api.completeTask(x.l.id, x.t.id).then(function (ev) {
                out.logged.push({ key: 'todo:' + x.l.id + ':' + x.t.id, label: x.t.text, xp: R.taskXp(x.t.size) });
                out.events = out.events.concat(ev);
              }, function () { /* la lista cambió entretanto: se ignora */ });
            });
          }, Promise.resolve());
        }).then(function () { return out; });
      },
      // Desmarca una tarea: su XP deja de contar. Con la lista completada, todo queda fijo.
      uncompleteTask: function (id, taskId) {
        return Promise.all([loadRaw(), rpg.state()]).then(function (r) {
          var l = r[0].filter(function (x) { return x.id === id; })[0];
          if (!l) throw invalid('Esa lista ya no existe.');
          if (isDone(r[1].entries, id)) throw invalid('Esta lista ya está completada: sus tareas no se pueden desmarcar.');
          var key = 'todo:' + id + ':' + taskId;
          if (!r[1].entries.some(function (e) { return e.key === key; })) return [];
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
