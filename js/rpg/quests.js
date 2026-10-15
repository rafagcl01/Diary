// Misiones: las crea el usuario (nombre, tamaño, reparto de XP por subcategorías, objetivo opcional de actividades,
// fechas y una lista de subtareas sin XP). Se guardan en rpg/quests.json.
//  - La recompensa se da UNA vez: clave `quest:<id>` en el registro de experiencia. Se escribe primero el registro y después
//    se marca la misión; si falla lo segundo, la misión se ve completada igualmente (la verdad es el registro).
//  - Una misión completada es de solo lectura: editarla no vuelve a dar ni quita nada.
//  - Con objetivo («3 veces Ir al gimnasio»), las visitas dan su propia XP y la misión añade un bonus al cumplirlo.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/quests.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  R.QUEST_STATES = [
    { id: 'pendiente', label: 'Pendiente' }, { id: 'en_curso', label: 'En curso' }, { id: 'pausada', label: 'Pausada' },
    { id: 'completada', label: 'Completada' }, { id: 'abandonada', label: 'Abandonada' }
  ];
  R.QUEST_LIMITS = { name: 60, description: 200, step: 80, steps: 20, count: 300, target: 99 };
  R.QUEST_ID_RE = /^qu_[0-9a-f]{8}$/;
  R.newQuestId = function () { return 'qu_' + R.newSubId().slice(3); };
  R.sizeXp = function (id) { var z = R.QUEST_SIZES.filter(function (q) { return q.id === id; })[0]; return z ? z.xp : 0; };

  R.sanitizeQuest = function (input, structure, base) {
    if (!input || typeof input !== 'object') throw invalid('La misión no es válida.');
    var name = R.cleanText(input.name, R.QUEST_LIMITS.name);
    if (!name) throw invalid('Ponle un nombre a la misión.');
    if (!R.sizeXp(input.size)) throw invalid('Elige un tamaño.');
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
    var objective = null;
    if (input.objective) {
      var count = Number(input.objective.count);
      if (!R.ACT_ID_RE.test(String(input.objective.activity || ''))) throw invalid('Elige la actividad del objetivo.');
      if (!isFinite(count) || Math.floor(count) !== count || count < 1 || count > R.QUEST_LIMITS.target) throw invalid('El objetivo debe ser un número entero entre 1 y ' + R.QUEST_LIMITS.target + '.');
      objective = { activity: input.objective.activity, count: count };
    }
    var startDay = DAY_RE.test(String(input.startDay || '')) ? input.startDay : (base && base.startDay) || R.today();
    var dueDay = input.dueDay ? String(input.dueDay) : null;
    if (dueDay && !DAY_RE.test(dueDay)) throw invalid('La fecha límite no es válida.');
    if (dueDay && dueDay < startDay) throw invalid('La fecha límite no puede ser anterior al inicio.');
    var steps = (input.steps || []).map(function (st) {
      var text = R.cleanText(st && st.text, R.QUEST_LIMITS.step);
      if (!text) return null;
      return { id: typeof st.id === 'string' && /^st_[0-9a-f]{8}$/.test(st.id) ? st.id : 'st_' + R.newSubId().slice(3), text: text, done: st.done === true };
    }).filter(Boolean);
    if (steps.length > R.QUEST_LIMITS.steps) throw invalid('Demasiadas subtareas (máximo ' + R.QUEST_LIMITS.steps + ').');
    var now = new Date().toISOString();
    return {
      id: base && base.id ? base.id : R.newQuestId(), name: name, description: R.cleanText(input.description, R.QUEST_LIMITS.description),
      size: input.size, shares: shares, objective: objective, startDay: startDay, dueDay: dueDay, steps: steps,
      status: base && base.status ? base.status : 'pendiente', createdAt: base && base.createdAt ? base.createdAt : now, updatedAt: now
    };
  };

  // Estado visible de cada misión: completada si el registro tiene su recompensa; con su progreso de objetivo.
  R.questView = function (q, entries) {
    var byKey = {}; (entries || []).forEach(function (e) { byKey[e.key] = e; });
    var reward = byKey['quest:' + q.id];
    var out = Object.assign({}, q);
    if (reward) { out.status = 'completada'; out.completedAt = reward.at; out.rewardXp = reward.xp; }
    out.xp = R.sizeXp(q.size);
    out.progress = q.objective ? R.activityCount(entries, q.objective.activity, q.startDay, q.dueDay) : null;
    out.ready = out.status !== 'completada' && (out.status === 'pendiente' || out.status === 'en_curso') && (!q.objective || out.progress >= q.objective.count);
    return out;
  };
  var TRANSITIONS = { pendiente: ['en_curso', 'pausada', 'abandonada'], en_curso: ['pendiente', 'pausada', 'abandonada'], pausada: ['pendiente', 'en_curso', 'abandonada'], abandonada: ['pendiente'] };

  App.createQuestRepo = function (store, rpg) {
    var cache = null;
    function ensure(doc) {
      if (doc && (typeof doc !== 'object' || !Array.isArray(doc.quests))) throw invalid('El archivo de misiones está dañado. No lo toco; revísalo en GitHub.');
      return doc ? doc.quests : [];
    }
    function loadRaw(force) {
      if (cache && !force) return Promise.resolve(cache);
      return store.readJson(PATH, null).then(function (doc) { cache = ensure(doc).filter(function (q) { return q && R.QUEST_ID_RE.test(q.id); }); return cache; });
    }
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          var list = ensure(doc).slice();
          result = change(list, st);
          return { version: 1, quests: list };
        }, { fallback: null, message: message });
      }).then(function () { return loadRaw(true); }).then(function () { return result; });
    }
    function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; throw invalid('Esa misión ya no existe.'); }
    function locked(entries, id) {
      if (entries.some(function (e) { return e.key === 'quest:' + id; })) throw invalid('Una misión completada no se puede cambiar.');
    }

    return {
      // Misiones con su estado y progreso.
      state: function (force) {
        return Promise.all([loadRaw(force), rpg.state(force)]).then(function (r) {
          return { quests: r[0].map(function (q) { return R.questView(q, r[1].entries); }), entries: r[1].entries, structure: r[1].structure, computed: r[1].computed, profile: r[1].profile };
        });
      },
      create: function (input) {
        return Promise.resolve().then(function () {
          return mutate('Crea una misión', function (list, st) {
            if (list.length >= R.QUEST_LIMITS.count) throw invalid('Ya tienes el máximo de misiones.');
            var q = R.sanitizeQuest(input, st.structure, null);
            list.push(q); return q;
          });
        });
      },
      update: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita una misión', function (list, st) {
            var i = find(list, id); locked(st.entries, id);
            var q = R.sanitizeQuest(Object.assign({}, input, { steps: input.steps === undefined ? list[i].steps : input.steps }), st.structure, list[i]);
            list[i] = q; return q;
          });
        });
      },
      setStatus: function (id, status) {
        return Promise.resolve().then(function () {
          return mutate('Cambia el estado de una misión', function (list, st) {
            var i = find(list, id); locked(st.entries, id);
            if ((TRANSITIONS[list[i].status] || []).indexOf(status) < 0) throw invalid('No se puede pasar de «' + list[i].status + '» a «' + status + '».');
            list[i] = Object.assign({}, list[i], { status: status, updatedAt: new Date().toISOString() });
            return list[i];
          });
        });
      },
      toggleStep: function (id, stepId, done) {
        return Promise.resolve().then(function () {
          return mutate('Marca una subtarea', function (list, st) {
            var i = find(list, id); locked(st.entries, id);
            var steps = list[i].steps.map(function (s) { return s.id === stepId ? Object.assign({}, s, { done: !!done }) : s; });
            list[i] = Object.assign({}, list[i], { steps: steps, updatedAt: new Date().toISOString() });
            return list[i];
          });
        });
      },
      // Reclama la recompensa. Si ya estaba dada, no vuelve a darse (devuelve { duplicate: true }).
      claim: function (id) {
        return Promise.all([loadRaw(true), rpg.state(true)]).then(function (r) {
          var raw = r[0].filter(function (q) { return q.id === id; })[0];
          if (!raw) throw invalid('Esa misión ya no existe.');
          var q = R.questView(raw, r[1].entries);
          if (q.status === 'completada') return { duplicate: true, quest: q };
          if (q.status !== 'pendiente' && q.status !== 'en_curso') throw invalid('Solo se completan misiones pendientes o en curso.');
          if (q.objective && q.progress < q.objective.count) throw invalid('Todavía no has llegado al objetivo (' + q.progress + ' de ' + q.objective.count + ').');
          return rpg.addEntry({ kind: 'quest', key: 'quest:' + id, quest: id, label: q.name, xp: q.xp, shares: q.shares }).then(function (res) {
            // Marca la misión como completada; si esto fallara, el registro ya manda y se verá completada igualmente.
            return store.updateJson(PATH, function (doc) {
              var list = ensure(doc).slice(), i = find(list, id);
              list[i] = Object.assign({}, list[i], { status: 'completada', completedAt: res.entry.at, updatedAt: new Date().toISOString() });
              return { version: 1, quests: list };
            }, { fallback: null, message: 'Completa una misión' }).catch(function () { return null; }).then(function () {
              return loadRaw(true);
            }).then(function () { return { duplicate: res.duplicate, entry: res.entry, quest: q }; });
          });
        });
      }
    };
  };

  var current = { store: null, repo: null };
  R.quests = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createQuestRepo(store, rpg) };
    return current.repo;
  };
})(window.App = window.App || {});
