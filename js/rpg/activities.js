// Actividades: la forma más sencilla (y la que menos XP da) de avanzar. Todas dan lo mismo: 5 XP,
// en puntos enteros repartidos entre subcategorías (por ejemplo, Leer: 2 Lectura + 3 Conocimiento).
// Vienen unas predefinidas; el usuario puede crear las suyas, editarlas y archivarlas. Se guardan en rpg/activities.json.
// Al registrar una, el apunte guarda una copia de sus puntos: cambiar la actividad después no cambia el pasado.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/activities.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  function pts() { var a = []; for (var i = 0; i < arguments.length; i += 2) a.push({ sub: arguments[i], xp: arguments[i + 1] }); return a; }

  R.DEFAULT_ACTIVITIES = [
    { id: 'gimnasio', name: 'Ir al gimnasio', icon: 'dumbbell', points: pts('fuerza', 3, 'disciplina', 2) },
    { id: 'cardio', name: 'Caminar o correr', icon: 'bolt', points: pts('resistencia', 4, 'salud', 1) },
    { id: 'comer-bien', name: 'Comer y beber bien', icon: 'leaf', points: pts('salud', 4, 'disciplina', 1) },
    { id: 'dormir-bien', name: 'Dormir bien', icon: 'moon', points: pts('descanso', 5) },
    { id: 'skincare', name: 'Rutina de skincare', icon: 'mirror', points: pts('autocuidado', 4, 'disciplina', 1) },
    { id: 'arreglarme', name: 'Arreglarme (pelo, uñas, ropa)', icon: 'mirror', points: pts('autocuidado', 5) },
    { id: 'estudiar', name: 'Estudiar un rato', icon: 'book', points: pts('conocimiento', 3, 'disciplina', 2) },
    { id: 'leer-libro', name: 'Leer un libro', icon: 'book', points: pts('lectura', 2, 'conocimiento', 3) },
    { id: 'leer-comic', name: 'Leer un cómic o manga', icon: 'book', points: pts('lectura', 5) },
    { id: 'tarot', name: 'Tirada de tarot o ritual', icon: 'tarot', points: pts('brujeria', 5) },
    { id: 'meditar', name: 'Meditar', icon: 'cloud', points: pts('disciplina', 3, 'descanso', 2) },
    { id: 'amigos', name: 'Quedar con amigos', icon: 'butterfly', points: pts('amistad', 3, 'conexion', 2) },
    { id: 'familia', name: 'Pasar tiempo con la familia', icon: 'locket', points: pts('familia', 3, 'conexion', 2) },
    { id: 'pareja', name: 'Tiempo con mi pareja', icon: 'rose', points: pts('amor', 4, 'conexion', 1) },
    { id: 'plan-nuevo', name: 'Hacer un plan nuevo', icon: 'sun', points: pts('experiencias', 3, 'exploracion', 2) },
    { id: 'lugar-nuevo', name: 'Visitar un lugar nuevo', icon: 'compass', points: pts('exploracion', 4, 'experiencias', 1) },
    { id: 'miedo', name: 'Hacer algo que da miedo', icon: 'candle', points: pts('valentia', 5) },
    { id: 'dibujar', name: 'Dibujar, esculpir o modelar', icon: 'pencil', points: pts('arte', 4, 'disciplina', 1) },
    { id: 'pelicula', name: 'Ver una película', icon: 'film', points: pts('peliculas', 4, 'experiencias', 1) }
  ];
  R.ACTIVITY_LIMITS = { name: 40, count: 120 };
  R.newActivityId = function () { return 'ac_' + R.newSubId().slice(3); };

  // Valida una actividad (lanza un error claro). Los puntos van en enteros ≥1 y suman de 1 a 5.
  R.sanitizeActivity = function (input, structure, base) {
    if (!input || typeof input !== 'object') throw invalid('La actividad no es válida.');
    var name = R.cleanText(input.name, R.ACTIVITY_LIMITS.name);
    if (!name) throw invalid('Ponle un nombre a la actividad.');
    var icon = R.isIcon(input.icon) ? input.icon : null;
    if (!icon) throw invalid('Elige un icono de la galería.');
    var total = 0, seen = {};
    var points = (input.points || []).map(function (p) {
      var v = Number(p && p.xp);
      if (!isFinite(v) || Math.floor(v) !== v || v < 1) throw invalid('Los puntos deben ser números enteros de 1 en adelante.');
      if (!R.findSub(structure, p.sub)) throw invalid('Esa subcategoría no existe.');
      if (seen[p.sub]) throw invalid('Una subcategoría aparece dos veces.');
      seen[p.sub] = true; total += v;
      return { sub: p.sub, xp: v };
    });
    if (!points.length) throw invalid('Elige al menos una subcategoría.');
    if (total !== R.ACTIVITY_XP) throw invalid('Toda actividad da ' + R.ACTIVITY_XP + ' XP: reparte exactamente ' + R.ACTIVITY_XP + ' puntos (ahora ' + total + ').');
    return { id: base && base.id ? base.id : R.newActivityId(), name: name, icon: icon, points: points, archived: !!(input.archived === undefined ? (base && base.archived) : input.archived) };
  };

  // Lista de actividades con las predefinidas: lo guardado manda; las de fábrica que falten vuelven (solo se archivan, no se pierden).
  R.buildActivities = function (doc) {
    var saved = doc && Array.isArray(doc.activities) ? doc.activities : [];
    var out = [], ids = {};
    saved.forEach(function (a) {
      if (!a || typeof a.id !== 'string' || !R.ACT_ID_RE.test(a.id) || ids[a.id]) return;
      var name = R.cleanText(a.name, R.ACTIVITY_LIMITS.name);
      var points = Array.isArray(a.points) ? a.points.filter(function (p) { return p && typeof p.sub === 'string' && Number.isInteger(p.xp) && p.xp >= 1; }).map(function (p) { return { sub: p.sub, xp: p.xp }; }) : [];
      if (!name) return;
      ids[a.id] = true;
      out.push({ id: a.id, name: name, icon: R.isIcon(a.icon) ? a.icon : 'star', points: points, archived: a.archived === true });
    });
    R.DEFAULT_ACTIVITIES.forEach(function (d) {
      if (!ids[d.id]) out.push({ id: d.id, name: d.name, icon: d.icon, points: d.points.map(function (p) { return { sub: p.sub, xp: p.xp }; }), archived: false });
    });
    return out;
  };
  R.activitiesToDoc = function (list) { return { version: 1, activities: list.map(function (a) { return { id: a.id, name: a.name, icon: a.icon, points: a.points, archived: !!a.archived }; }) }; };
  R.activityXp = function (a) { return a.points.reduce(function (t, p) { return t + p.xp; }, 0); };
  // Clave de una actividad apuntada en una entrada del diario (ver logBlocks). R.isDiaryKey reconoce sus apuntes.
  R.blockActivityReq = function (blockId, actId) { return 'blk:' + blockId + ':' + actId; };
  R.isDiaryKey = function (key) { return /^act:blk:/.test(String(key)); };

  App.createActivityRepo = function (store, rpg) {
    var cache = null;
    var pending = null;
    function load(force) {
      if (cache && !force) return Promise.resolve(cache);
      if (pending && !force) return pending;
      var p = store.readJson(PATH, null).then(function (doc) {
        if (doc && !Array.isArray(doc.activities)) throw invalid('El archivo de actividades está dañado. No lo toco; revísalo en GitHub.');
        cache = R.buildActivities(doc); pending = null;
        return cache;
      }, function (e) { pending = null; throw e; });
      pending = p;
      return p;
    }
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          if (doc && !Array.isArray(doc.activities)) throw invalid('El archivo de actividades está dañado. No lo toco; revísalo en GitHub.');
          var list = R.buildActivities(doc);
          result = change(list, st.structure);
          return R.activitiesToDoc(list);
        }, { fallback: null, message: message });
      }).then(function () { return load(true); }).then(function () { return result; });
    }
    function duplicate(list, name, exceptId) {
      var k = R.fold(name);
      return list.some(function (a) { return a.id !== exceptId && !a.archived && R.fold(a.name) === k; });
    }

    return {
      list: function (force) { return load(force).then(function (l) { return l.slice(); }); },
      create: function (input) {
        return Promise.resolve().then(function () {
          return mutate('Crea una actividad', function (list, structure) {
            if (list.length >= R.ACTIVITY_LIMITS.count) throw invalid('Ya tienes el máximo de actividades.');
            var a = R.sanitizeActivity(Object.assign({}, input, { archived: false }), structure, null);
            if (duplicate(list, a.name, null)) throw invalid('Ya tienes una actividad con ese nombre.');
            list.push(a); return a;
          });
        });
      },
      update: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita una actividad', function (list, structure) {
            var i = -1; list.forEach(function (x, n) { if (x.id === id) i = n; });
            if (i < 0) throw invalid('Esa actividad ya no existe.');
            var a = R.sanitizeActivity(input, structure, list[i]);
            if (duplicate(list, a.name, id)) throw invalid('Ya tienes una actividad con ese nombre.');
            list[i] = a; return a;
          });
        });
      },
      setArchived: function (id, archived) {
        return Promise.resolve().then(function () {
          return mutate(archived ? 'Archiva una actividad' : 'Recupera una actividad', function (list) {
            var a = list.filter(function (x) { return x.id === id; })[0];
            if (!a) throw invalid('Esa actividad ya no existe.');
            a.archived = !!archived; return a;
          });
        });
      },

      // Registra una actividad puntual (que no se guarda para repetir). Cuenta XP como cualquiera, pero no cuenta para objetivos.
      logOnce: function (o) {
        return rpg.state().then(function (st) {
          var a = R.sanitizeActivity({ name: o.name, icon: 'star', points: o.points }, st.structure, { id: 'puntual' });
          return rpg.addEntry({ kind: 'activity', key: 'act:' + (o.req || R.newRequestId()), activity: 'puntual', label: a.name, xp: R.activityXp(a), points: a.points, day: o.day });
        });
      },

      // Registra una actividad hecha el día `o.day` (hoy por defecto). `o.req` es la clave de este toque: repetirlo no suma otra vez.
      log: function (id, o) {
        o = o || {};
        return Promise.all([load(), rpg.state()]).then(function (r) {
          var a = r[0].filter(function (x) { return x.id === id; })[0];
          if (!a) throw invalid('Esa actividad ya no existe.');
          if (a.archived) throw invalid('Esa actividad está archivada.');
          if (R.activityXp(a) !== R.ACTIVITY_XP) throw invalid('Esta actividad no suma ' + R.ACTIVITY_XP + ' puntos: edítala para ajustarla.');
          return rpg.addEntry({ kind: 'activity', key: 'act:' + (o.req || R.newRequestId()), activity: a.id, label: a.name, xp: R.activityXp(a), points: a.points, day: o.day });
        });
      },

      // Registra las actividades de las entradas de una página del diario (tras guardarla). Cada par entrada + actividad
      // tiene una clave fija (act:blk:<entrada>:<actividad>), así que volver a guardar la página no suma otra vez.
      // (Quitar una actividad de la entrada sí quita su XP al guardar, con confirmación: ver R.diaryRemovals.)
      // Devuelve { logged: [apuntes nuevos], failed: [mensajes] }.
      logBlocks: function (day, blocks) {
        var self = this, out = { logged: [], failed: [] };
        return rpg.entries().then(function (all) {
          var have = {}; all.forEach(function (e) { have[e.key] = true; });
          var todo = [];
          (blocks || []).forEach(function (b) {
            (b.activities || []).forEach(function (id) {
              var req = R.blockActivityReq(b.id, id);
              if (!have['act:' + req]) todo.push({ id: id, req: req });
            });
          });
          // De una en una: el almacén ya escribe en orden y así un fallo no deja nada a medias.
          return todo.reduce(function (p, t) {
            return p.then(function () {
              return self.log(t.id, { req: t.req, day: day }).then(function (r) { if (!r.duplicate) out.logged.push(r.entry); },
                function (e) { out.failed.push((e && e.message) || 'No se pudo registrar una actividad.'); });
            });
          }, Promise.resolve());
        }).then(function () { return out; });
      }
    };
  };

  // Tras guardar una página del diario: registra sus actividades, marca en su lista las tareas elegidas en sus entradas
  // y da las recompensas de misiones, jefes y listas que se cumplan.
  // Devuelve { logged, failed, events, before, after } (niveles antes y después) o null si no hay datos conectados.
  R.recordDiaryActivities = function (day, blocks) {
    var acts = R.activities(), rpg = R.repo(), todos = R.todos ? R.todos() : null;
    if (!acts || !rpg) return Promise.resolve(null);
    var before = 1, res = null;
    return rpg.state().then(function (st) {
      before = st.computed.general.level;
      return acts.logBlocks(day, blocks);
    }).then(function (r) {
      res = r; res.events = []; res.before = before; res.after = before;
      var hasTasks = (blocks || []).some(function (b) { return b.tasks && b.tasks.length; });
      return todos && hasTasks ? todos.completeFromBlocks(blocks) : { logged: [], events: [] };
    }).then(function (t) {
      res.logged = res.logged.concat(t.logged);
      if (!res.logged.length) return res;
      return R.syncRewards(day).catch(function () { return []; }).then(function (ev) {
        res.events = t.events.concat(ev);
        return rpg.state().then(function (s) { res.after = s.computed.general.level; return res; });
      });
    });
  };

  // Al guardar (o borrar) una página del diario: qué XP se quitaría por lo que ya no está en sus entradas.
  // Compara las entradas guardadas (`before`) con las nuevas (`after`): una actividad que ya dio XP y ya no está en su
  // entrada se quita del registro; una tarea marcada que ya no está vuelve a estar pendiente (salvo con su lista completa,
  // que queda fija). Devuelve [{ kind: 'act' | 'task', key, list, task, label, xp, n (número de entrada) }].
  R.diaryRemovals = function (before, after) {
    var rpg = R.repo();
    if (!rpg || !before || !before.length) return Promise.resolve([]);
    var now = {}; (after || []).forEach(function (b) {
      (b.activities || []).forEach(function (a) { now['a:' + b.id + ':' + a] = true; });
      (b.tasks || []).forEach(function (r) { now['t:' + r.list + ':' + r.task] = true; });
    });
    return rpg.entries().then(function (all) {
      var byKey = {}; all.forEach(function (e) { byKey[e.key] = e; });
      var out = [], seen = {};
      before.forEach(function (b, i) {
        (b.activities || []).forEach(function (a) {
          var key = 'act:' + R.blockActivityReq(b.id, a), e = byKey[key];
          if (e && !now['a:' + b.id + ':' + a]) out.push({ kind: 'act', key: key, label: e.label, xp: e.xp, n: i + 1 });
        });
        (b.tasks || []).forEach(function (r) {
          var key = 'todo:' + r.list + ':' + r.task, e = byKey[key];
          if (!e || now['t:' + r.list + ':' + r.task] || byKey['todo:' + r.list] || seen[key]) return;
          seen[key] = true;
          out.push({ kind: 'task', key: key, list: r.list, task: r.task, label: e.label, xp: e.xp, n: i + 1 });
        });
      });
      return out;
    });
  };
  // Quita lo calculado por R.diaryRemovals (una cosa detrás de otra). Devuelve { removed, failed }.
  R.applyDiaryRemovals = function (items) {
    var rpg = R.repo(), todos = R.todos ? R.todos() : null, res = { removed: [], failed: [] };
    return (items || []).reduce(function (p, it) {
      return p.then(function () {
        var job = it.kind === 'act' ? rpg.removeEntry(it.key) : (todos ? todos.uncompleteTask(it.list, it.task) : Promise.resolve());
        return job.then(function () { res.removed.push(it); }, function (e) { res.failed.push((e && e.message) || 'No se pudo quitar «' + it.label + '».'); });
      });
    }, Promise.resolve()).then(function () { return res; });
  };

  // Borra del todo una actividad registrada (la cruz de la ficha). Si se apuntó en una entrada del diario, primero se quita
  // de esa entrada (y de su borrador): si no, al volver a guardar la página se sumaría otra vez.
  R.deleteActivityEntry = function (key) {
    var rpg = R.repo();
    if (!rpg) return Promise.reject(invalid('Conecta tus datos.'));
    var m = /^act:blk:(b_[0-9a-f]{8}):([a-z0-9][a-z0-9_-]{1,30})$/.exec(String(key));
    var unlink = Promise.resolve();
    if (m) unlink = rpg.entries().then(function (all) {
      var e = all.filter(function (x) { return x.key === key; })[0];
      return e ? R.unlinkDiaryActivity(e.day, m[1], m[2]) : null;
    });
    return unlink.then(function () { return rpg.removeEntry(key); });
  };
  R.unlinkDiaryActivity = function (day, blockId, actId) {
    var D = App.diary, repo = D && D.repo ? D.repo() : null;
    function strip(blocks) {
      var changed = false;
      var out = (blocks || []).map(function (b) {
        if (b.id !== blockId || (b.activities || []).indexOf(actId) < 0) return b;
        changed = true;
        return Object.assign({}, b, { activities: b.activities.filter(function (x) { return x !== actId; }) });
      });
      return changed ? out : null;
    }
    if (App.drafts) {
      var draft = App.drafts.get(day), db = draft && strip(draft.blocks);
      if (db) App.drafts.save(day, { title: draft.title, favorite: draft.favorite, blocks: db });
    }
    if (!repo) return Promise.resolve();
    return repo.get(day).then(function (entry) {
      var blocks = entry && strip(entry.blocks);
      if (!blocks) return;
      // Si la página solo tenía esa actividad, queda vacía: se borra (no hay nada más que conservar).
      if (!entry.title && !blocks.some(D.blockHasContent)) return repo.remove(day);
      return repo.save(Object.assign({}, entry, { blocks: blocks }), { base: entry.updatedAt });
    });
  };

  var current = { store: null, repo: null };
  R.activities = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createActivityRepo(store, rpg) };
    return current.repo;
  };
})(window.App = window.App || {});
