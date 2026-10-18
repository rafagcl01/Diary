// Misiones semanales: se repiten cada semana (de lunes a domingo) y dan más XP que una actividad.
//  - Modo «actividad»: «hacer X actividad N veces». Cuenta los registros no anulados de esa semana; al llegar a N
//    la misión se completa SOLA y da su recompensa (sin botón de reclamar).
//  - Modo «checks»: N casillas que marcas tú (1 casilla = un solo check; sirve también para una misión de solo descripción).
//  - La recompensa es una clave única por misión y semana (`weekly:<misión>:<semana>`): no puede darse dos veces.
// Se guardan en rpg/weekly.json (plantillas + casillas marcadas por semana). El estado «completada» sale del registro de XP.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/weekly.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  var DAY_MS = 86400000;
  R.WEEKLY_LIMITS = { name: 60, description: 200, target: 14, count: 60 };
  R.WEEKLY_ID_RE = /^wm_[0-9a-f]{8}$/;
  R.newWeeklyId = function () { return 'wm_' + R.newSubId().slice(3); };
  R.sizeXp = function (id) { var z = R.QUEST_SIZES.filter(function (q) { return q.id === id; })[0]; return z ? z.xp : 0; };

  // ---- Semanas ISO (lunes a domingo): clave «2026-W42» ----
  function utc(day) { var p = String(day).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmt(d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  R.weekKey = function (day) {
    var d = utc(day), dow = (d.getUTCDay() + 6) % 7;
    var thu = new Date(d.getTime() - dow * DAY_MS + 3 * DAY_MS), y = thu.getUTCFullYear();
    var jan4 = new Date(Date.UTC(y, 0, 4)), jan4dow = (jan4.getUTCDay() + 6) % 7;
    var week = 1 + Math.round(((thu.getTime() - jan4.getTime()) / DAY_MS - 3 + jan4dow) / 7);
    return y + '-W' + ('0' + week).slice(-2);
  };
  R.weekRange = function (key) {
    var m = /^(\d{4})-W(\d{2})$/.exec(key);
    var jan4 = new Date(Date.UTC(+m[1], 0, 4)), dow = (jan4.getUTCDay() + 6) % 7;
    var from = new Date(jan4.getTime() - dow * DAY_MS + (+m[2] - 1) * 7 * DAY_MS);
    return { from: fmt(from), to: fmt(new Date(from.getTime() + 6 * DAY_MS)) };
  };

  R.sanitizeWeekly = function (input, structure, base) {
    if (!input || typeof input !== 'object') throw invalid('La misión no es válida.');
    var name = R.cleanText(input.name, R.WEEKLY_LIMITS.name);
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
    var target = Number(input.target);
    if (!isFinite(target) || Math.floor(target) !== target || target < 1 || target > R.WEEKLY_LIMITS.target) throw invalid('El número debe ser un entero entre 1 y ' + R.WEEKLY_LIMITS.target + '.');
    var activity = null;
    if (input.mode === 'activity') {
      activity = String(input.activity || '');
      if (!R.ACT_ID_RE.test(activity) || activity === 'puntual') throw invalid('Elige la actividad que cuenta para esta misión.');
    } else if (input.mode !== 'checks') throw invalid('Elige cómo se completa la misión.');
    // «Solo esta semana» (repeat: false) se borra el lunes a las 3:00; «repetir» vuelve a empezar cada semana.
    // Sin elegir: una nueva es de una semana; una que ya existía conserva lo que tenía (las antiguas, sin el campo, repiten).
    var repeat = input.repeat === undefined ? (base ? base.repeat !== false : false) : !!input.repeat;
    var week = repeat ? null : (base && base.repeat === false && base.week ? base.week : R.currentWeek());
    return {
      id: base && base.id ? base.id : R.newWeeklyId(), name: name, description: R.cleanText(input.description, R.WEEKLY_LIMITS.description),
      size: input.size, shares: shares, mode: input.mode, activity: activity, target: target, repeat: repeat, week: week,
      createdAt: base && base.createdAt ? base.createdAt : new Date().toISOString()
    };
  };
  // Semana en curso para las misiones de una sola semana: cambia el lunes a las 3:00 (ver R.logicalDay).
  R.currentWeek = function (now) { return R.weekKey(R.logicalDay(now)); };
  // Una misión de una sola semana caduca cuando ya ha empezado otra semana. Las que repiten nunca caducan.
  R.weeklyExpired = function (m, now) { return !!m && m.repeat === false && typeof m.week === 'string' && m.week < R.currentWeek(now); };

  // Estado de una misión en una semana: progreso, si está hecha (por el registro) y sus casillas.
  R.weeklyView = function (m, weekKey, entries, progress) {
    var range = R.weekRange(weekKey), byKey = {};
    entries.forEach(function (e) { byKey[e.key] = e; });
    var reward = byKey['weekly:' + m.id + ':' + weekKey];
    var checks = [], count;
    if (m.mode === 'checks') {
      var saved = (progress[m.id + '|' + weekKey] || {}).checks || [];
      for (var i = 0; i < m.target; i++) checks.push(saved[i] === true);
      count = checks.filter(Boolean).length;
    } else count = R.activityCount(entries, m.activity, range.from, range.to);
    var done = !!reward;
    var weeksDone = entries.filter(function (e) { return e.key.indexOf('weekly:' + m.id + ':') === 0; }).length;
    return Object.assign({}, m, { week: weekKey, xp: R.sizeXp(m.size), count: count, checks: checks, done: done, rewardXp: reward ? reward.xp : null, ready: !done && count >= m.target, weeksDone: weeksDone });
  };

  App.createWeeklyRepo = function (store, rpg) {
    var cache = null;
    function ensure(doc) {
      if (doc && (typeof doc !== 'object' || !Array.isArray(doc.missions))) throw invalid('El archivo de misiones semanales está dañado. No lo toco; revísalo en GitHub.');
      return doc ? { missions: doc.missions, progress: doc.progress && typeof doc.progress === 'object' ? doc.progress : {} } : { missions: [], progress: {} };
    }
    var pending = null;
    // Lo que ve la aplicación: sin las archivadas (sistema anterior) ni las de una semana ya pasada. Se calcula cada vez,
    // así que a las 3:00 del lunes desaparecen aunque la página lleve horas abierta. cleanup() las borra del archivo.
    function live(raw) {
      var gone = function (m) { return !m || !R.WEEKLY_ID_RE.test(m.id) || m.archived || R.weeklyExpired(m); };
      return { missions: raw.missions.filter(function (m) { return !gone(m); }), progress: raw.progress, stale: raw.missions.some(function (m) { return m && (m.archived || R.weeklyExpired(m)); }) };
    }
    function loadRaw(force) {
      if (cache && !force) return Promise.resolve(live(cache));
      if (pending && !force) return pending.then(live);
      var p = store.readJson(PATH, null).then(function (doc) {
        cache = ensure(doc); pending = null;
        return cache;
      }, function (e) { pending = null; throw e; });
      pending = p;
      return p.then(live);
    }
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          var d = ensure(doc), missions = d.missions.slice(), progress = Object.assign({}, d.progress);
          result = change({ missions: missions, progress: progress }, st);
          return { version: 1, missions: missions, progress: progress };
        }, { fallback: null, message: message });
      }).then(function (written) { cache = ensure(written); return result; });   // lo recién guardado es lo último: sin releer
    }
    function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; throw invalid('Esa misión ya no existe.'); }

    var api = {
      // Misiones de una semana (la actual por defecto), con su progreso.
      state: function (force, week) {
        week = week || R.weekKey(R.today());
        return Promise.all([loadRaw(force), rpg.state(force)]).then(function (r) {
          return { week: week, range: R.weekRange(week), missions: r[0].missions.map(function (m) { return R.weeklyView(m, week, r[1].entries, r[0].progress); }), entries: r[1].entries };
        });
      },
      create: function (input) {
        return Promise.resolve().then(function () {
          return mutate('Crea una misión semanal', function (d, st) {
            if (d.missions.length >= R.WEEKLY_LIMITS.count) throw invalid('Ya tienes el máximo de misiones semanales.');
            var m = R.sanitizeWeekly(input, st.structure, null);
            d.missions.push(m); return m;
          });
        });
      },
      update: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita una misión semanal', function (d, st) {
            var i = find(d.missions, id);
            d.missions[i] = R.sanitizeWeekly(input, st.structure, d.missions[i]); return d.missions[i];
          });
        });
      },
      // Elimina la misión y sus casillas marcadas. La XP que ya dio (en el registro) se queda.
      remove: function (id) {
        return Promise.resolve().then(function () {
          return mutate('Elimina una misión semanal', function (d) {
            var i = find(d.missions, id), m = d.missions[i];
            d.missions.splice(i, 1);
            Object.keys(d.progress).forEach(function (k) { if (k.indexOf(id + '|') === 0) delete d.progress[k]; });
            return m;
          });
        });
      },
      // Borra del archivo las misiones de una semana ya pasada y las archivadas del sistema anterior (con sus casillas).
      // Solo escribe si hay alguna. La XP que dieron se queda en el registro.
      cleanup: function () {
        return loadRaw().then(function (c) {
          if (!c.stale) return 0;
          var n = 0;
          return mutate('Limpia las misiones de semanas pasadas', function (d) {
            for (var i = d.missions.length - 1; i >= 0; i--) {
              var m = d.missions[i];
              if (!m || !(m.archived || R.weeklyExpired(m))) continue;
              d.missions.splice(i, 1); n++;
              Object.keys(d.progress).forEach(function (k) { if (k.indexOf(m.id + '|') === 0) delete d.progress[k]; });
            }
          }).then(function () { return n; });
        });
      },
      // Marca o desmarca una casilla de esta semana. Si la misión ya está completada, no se toca. Devuelve los eventos de recompensa.
      toggleCheck: function (id, index, checked, week) {
        week = week || R.weekKey(R.today());
        return Promise.all([loadRaw(), rpg.state()]).then(function (r) {
          var m = r[0].missions.filter(function (x) { return x.id === id; })[0];
          if (!m) throw invalid('Esa misión ya no existe.');
          if (m.mode !== 'checks') throw invalid('Esta misión se completa sola al registrar la actividad.');
          if (r[1].entries.some(function (e) { return e.key === 'weekly:' + id + ':' + week; })) throw invalid('Esta misión ya está completada esta semana.');
          if (!(index >= 0 && index < m.target)) throw invalid('Esa casilla no existe.');
          return mutate('Marca una casilla', function (d) {
            var k = id + '|' + week, cur = (d.progress[k] && d.progress[k].checks) || [], checks = [];
            for (var i = 0; i < m.target; i++) checks.push(cur[i] === true);
            checks[index] = !!checked; d.progress[k] = { checks: checks };
          });
        }).then(function () { return api.sync([week]); });
      },
      // Da las recompensas que falten (misiones completadas en las semanas indicadas). Idempotente. Devuelve [{ type, label, xp }].
      sync: function (weeks) {
        weeks = (weeks && weeks.length ? weeks : [R.weekKey(R.today())]).filter(function (w, i, a) { return a.indexOf(w) === i; });
        return Promise.all([loadRaw(), rpg.state()]).then(function (r) {
          var todo = [];
          r[0].missions.forEach(function (m) {
            weeks.forEach(function (w) { var v = R.weeklyView(m, w, r[1].entries, r[0].progress); if (v.ready) todo.push(v); });
          });
          var events = [];
          return todo.reduce(function (chain, v) {
            return chain.then(function () {
              return rpg.addEntry({ kind: 'quest', key: 'weekly:' + v.id + ':' + v.week, quest: v.id, label: v.name, xp: v.xp, shares: v.shares }).then(function (res) {
                if (!res.duplicate) events.push({ type: 'weekly', label: v.name, xp: v.xp });
              });
            });
          }, Promise.resolve()).then(function () { return events; });
        });
      }
    };
    return api;
  };

  var current = { store: null, repo: null };
  R.weekly = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createWeeklyRepo(store, rpg) };
    return current.repo;
  };
})(window.App = window.App || {});
