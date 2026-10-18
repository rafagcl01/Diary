// Jefes finales: como una misión, pero mucho más grande. Tienen varios pasos; cada paso da un poquito de XP al
// completarse y, al completar todos, el jefe es derrotado y da la XP grande (según su nivel).
//  - Un paso puede ser un check que marcas tú (una sola vez) o «hacer X actividad N veces» (se completa solo).
//  - Todo sale del registro de XP: paso = clave `boss:<jefe>:<paso>`, derrota = clave `boss:<jefe>`. Nada se da dos veces.
//  - La imagen es opcional: un dibujo de la batería incluida o el enlace directo a un GIF/imagen de internet (no se descarga ni se guarda,
//    solo se guarda el enlace; solo se admiten unos pocos sitios de GIFs).
// Se guardan en rpg/bosses.json.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/bosses.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  R.BOSS_TIERS = [{ id: 'jefe', label: 'Jefe', xp: 250 }, { id: 'mayor', label: 'Jefe mayor', xp: 400 }, { id: 'final', label: 'Jefe final', xp: 600 }];
  R.BOSS_STEP_XP = 5;
  R.BOSS_LIMITS = { name: 60, description: 200, step: 80, steps: 12, count: 40, target: 99, url: 300 };
  R.BOSS_ID_RE = /^bo_[0-9a-f]{8}$/;
  R.STEP_ID_RE = /^st_[0-9a-f]{8}$/;
  R.BOSS_ART = [
    { id: 'fantasma', label: 'Rey Fantasma' }, { id: 'polilla', label: 'Polilla calavera' }, { id: 'gato', label: 'Gato gigante' },
    { id: 'corazon', label: 'Corazón roto' }, { id: 'ojo', label: 'Ojo que todo lo ve' }, { id: 'luna', label: 'Luna hambrienta' }
  ];
  R.isBossArt = function (id) { return R.BOSS_ART.some(function (a) { return a.id === id; }); };
  R.newBossId = function () { return 'bo_' + R.newSubId().slice(3); };
  R.tierXp = function (id) { var t = R.BOSS_TIERS.filter(function (x) { return x.id === id; })[0]; return t ? t.xp : 0; };
  // Sitios de GIFs admitidos (el enlace debe ser directo a la imagen).
  var HOSTS = /^(media[0-9]*\.giphy\.com|i\.giphy\.com|media[0-9]*\.tenor\.com|c\.tenor\.com|i\.imgur\.com)$/i;
  R.gifUrl = function (url) {
    var u; try { u = new URL(String(url || '')); } catch (e) { return null; }
    if (u.protocol !== 'https:' || !HOSTS.test(u.hostname) || String(url).length > R.BOSS_LIMITS.url) return null;
    return u.href;
  };

  R.sanitizeBoss = function (input, structure, base) {
    if (!input || typeof input !== 'object') throw invalid('El jefe no es válido.');
    var name = R.cleanText(input.name, R.BOSS_LIMITS.name);
    if (!name) throw invalid('Ponle un nombre al jefe.');
    if (!R.tierXp(input.tier)) throw invalid('Elige el nivel del jefe.');
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
    var image = null;
    if (input.image && input.image.kind === 'url') {
      var u = R.gifUrl(input.image.url);
      if (!u) throw invalid('El enlace de la imagen no vale: debe ser https y directo (acabar en .gif) de Giphy, Tenor o Imgur.');
      image = { kind: 'url', url: u };
    } else if (input.image && input.image.kind === 'art') {
      if (!R.isBossArt(input.image.id)) throw invalid('Elige un dibujo de la lista.');
      image = { kind: 'art', id: input.image.id };
    }
    var startDay = /^\d{4}-\d{2}-\d{2}$/.test(String(input.startDay || '')) ? input.startDay : (base && base.startDay) || R.today();
    var steps = (input.steps || []).map(function (st) {
      var text = R.cleanText(st && st.text, R.BOSS_LIMITS.step);
      if (!text) return null;
      var out = { id: st.id && R.STEP_ID_RE.test(st.id) ? st.id : 'st_' + R.newSubId().slice(3), text: text, activity: null, count: 1 };
      if (st.activity) {
        if (!R.ACT_ID_RE.test(String(st.activity)) || st.activity === 'puntual') throw invalid('Elige la actividad del paso «' + text + '».');
        var n = Number(st.count);
        if (!isFinite(n) || Math.floor(n) !== n || n < 1 || n > R.BOSS_LIMITS.target) throw invalid('Las veces del paso «' + text + '» deben ser un entero entre 1 y ' + R.BOSS_LIMITS.target + '.');
        out.activity = st.activity; out.count = n;
      }
      return out;
    }).filter(Boolean);
    if (!steps.length) throw invalid('Un jefe necesita al menos un paso.');
    if (steps.length > R.BOSS_LIMITS.steps) throw invalid('Demasiados pasos (máximo ' + R.BOSS_LIMITS.steps + ').');
    return {
      id: base && base.id ? base.id : R.newBossId(), name: name, description: R.cleanText(input.description, R.BOSS_LIMITS.description),
      tier: input.tier, shares: shares, image: image, startDay: startDay, steps: steps,
      createdAt: base && base.createdAt ? base.createdAt : new Date().toISOString()
    };
  };

  // Estado de un jefe a partir del registro: pasos hechos, vida restante y si está derrotado.
  R.bossView = function (b, entries) {
    var byKey = {}; entries.forEach(function (e) { byKey[e.key] = e; });
    var steps = b.steps.map(function (s) {
      var done = !!byKey['boss:' + b.id + ':' + s.id];
      var count = s.activity ? R.activityCount(entries, s.activity, b.startDay, null) : (done ? 1 : 0);
      return Object.assign({}, s, { done: done, count: Math.min(count, s.activity ? s.count : 1), target: s.activity ? s.count : 1, ready: !done && !!s.activity && count >= s.count });
    });
    var doneN = steps.filter(function (s) { return s.done; }).length;
    var defeated = !!byKey['boss:' + b.id];
    return Object.assign({}, b, { steps: steps, doneCount: doneN, defeated: defeated, xp: R.tierXp(b.tier), rewardXp: defeated ? byKey['boss:' + b.id].xp : null,
      defeatedAt: defeated ? byKey['boss:' + b.id].day : null, allDone: doneN === steps.length });
  };

  App.createBossRepo = function (store, rpg) {
    var cache = null;
    function ensure(doc) {
      if (doc && (typeof doc !== 'object' || !Array.isArray(doc.bosses))) throw invalid('El archivo de jefes está dañado. No lo toco; revísalo en GitHub.');
      return doc ? doc.bosses : [];
    }
    var pending = null, hasArchived = false;
    function loadRaw(force) {
      if (cache && !force) return Promise.resolve(cache);
      if (pending && !force) return pending;
      // Los archivados (sistema anterior) ya no existen para la aplicación: purgeArchived los borra del archivo.
      var p = store.readJson(PATH, null).then(function (doc) {
        var all = ensure(doc);
        hasArchived = all.some(function (b) { return b && b.archived; });
        cache = all.filter(function (b) { return b && R.BOSS_ID_RE.test(b.id) && !b.archived; }); pending = null; return cache;
      }, function (e) { pending = null; throw e; });
      pending = p;
      return p;
    }
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          var list = ensure(doc).slice();
          result = change(list, st);
          return { version: 1, bosses: list };
        }, { fallback: null, message: message });
      }).then(function () { return loadRaw(true); }).then(function () { return result; });
    }
    function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return i; throw invalid('Ese jefe ya no existe.'); }
    function grant(b, key, label, xp, events, type) {
      return rpg.addEntry({ kind: 'quest', key: key, quest: b.id, label: label, xp: xp, shares: b.shares }).then(function (res) {
        if (!res.duplicate) events.push({ type: type, label: label, xp: xp, boss: b.name });
      });
    }

    var api = {
      state: function (force) {
        return Promise.all([loadRaw(force), rpg.state(force)]).then(function (r) {
          return { bosses: r[0].map(function (b) { return R.bossView(b, r[1].entries); }), entries: r[1].entries };
        });
      },
      create: function (input) {
        return Promise.resolve().then(function () {
          return mutate('Crea un jefe', function (list, st) {
            if (list.length >= R.BOSS_LIMITS.count) throw invalid('Ya tienes el máximo de jefes.');
            var b = R.sanitizeBoss(input, st.structure, null); list.push(b); return b;
          });
        });
      },
      // Edita un jefe vivo. Los pasos ya completados no se pueden quitar (su XP ya está en el historial).
      update: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita un jefe', function (list, st) {
            var i = find(list, id);
            if (st.entries.some(function (e) { return e.key === 'boss:' + id; })) throw invalid('Un jefe derrotado no se puede cambiar.');
            var b = R.sanitizeBoss(input, st.structure, list[i]);
            list[i].steps.forEach(function (old) {
              if (st.entries.some(function (e) { return e.key === 'boss:' + id + ':' + old.id; }) && !b.steps.some(function (s) { return s.id === old.id; })) {
                throw invalid('El paso «' + old.text + '» ya está completado y no se puede quitar.');
              }
            });
            list[i] = b; return b;
          });
        });
      },
      // Elimina el jefe (vivo o derrotado). La XP que ya dieron sus pasos y su derrota (en el registro) se queda.
      remove: function (id) {
        return Promise.resolve().then(function () {
          return mutate('Elimina un jefe', function (list) { var i = find(list, id), b = list[i]; list.splice(i, 1); return b; });
        });
      },
      // Borra del archivo los jefes archivados con el sistema anterior. Solo escribe si hay alguno.
      purgeArchived: function () {
        return loadRaw().then(function () {
          if (!hasArchived) return 0;
          var n = 0;
          return mutate('Elimina los jefes archivados', function (list) {
            for (var i = list.length - 1; i >= 0; i--) if (list[i] && list[i].archived) { list.splice(i, 1); n++; }
          }).then(function () { return n; });
        });
      },
      // Marca un paso de tipo check (da sus 5 XP una sola vez; ver uncompleteStep para desmarcarlo). Devuelve los eventos de recompensa.
      completeStep: function (id, stepId) {
        return Promise.all([loadRaw(), rpg.state(true)]).then(function (r) {
          var b = r[0].filter(function (x) { return x.id === id; })[0];
          if (!b) throw invalid('Ese jefe ya no existe.');
          var s = b.steps.filter(function (x) { return x.id === stepId; })[0];
          if (!s) throw invalid('Ese paso no existe.');
          if (s.activity) throw invalid('Este paso se completa solo al registrar la actividad.');
          if (r[1].entries.some(function (e) { return e.key === 'boss:' + id; })) throw invalid('Ese jefe ya está derrotado.');
          var events = [];
          return grant(b, 'boss:' + id + ':' + stepId, s.text, R.BOSS_STEP_XP, events, 'step').then(function () { return events; });
        }).then(function (first) { return api.sync().then(function (more) { return first.concat(more); }); });
      },
      // Desmarca un paso de tipo check: se borra su apunte (sus 5 XP dejan de contar). Volver a marcarlo los da otra vez,
      // una sola vez (la clave es la misma). Con el jefe ya derrotado, los pasos quedan fijos.
      uncompleteStep: function (id, stepId) {
        return Promise.all([loadRaw(), rpg.state(true)]).then(function (r) {
          var b = r[0].filter(function (x) { return x.id === id; })[0];
          if (!b) throw invalid('Ese jefe ya no existe.');
          var s = b.steps.filter(function (x) { return x.id === stepId; })[0];
          if (!s) throw invalid('Ese paso no existe.');
          if (s.activity) throw invalid('Este paso se completa solo al registrar la actividad.');
          if (r[1].entries.some(function (e) { return e.key === 'boss:' + id; })) throw invalid('Ese jefe ya está derrotado: sus pasos no se pueden desmarcar.');
          var key = 'boss:' + id + ':' + stepId;
          if (!r[1].entries.some(function (e) { return e.key === key; })) return [];
          return rpg.removeEntry(key).then(function () { return []; });
        });
      },
      // Da las recompensas que falten: pasos de actividad cumplidos y derrota del jefe. Idempotente. Devuelve eventos.
      sync: function () {
        var events = [];
        return Promise.all([loadRaw(), rpg.state(true)]).then(function (r) {
          return r[0].reduce(function (chain, raw) {
            return chain.then(function () { return rpg.state(true); }).then(function (st) {
              var v = R.bossView(raw, st.entries);
              if (v.defeated) return null;
              var ready = v.steps.filter(function (s) { return s.ready; });
              return ready.reduce(function (c, s) { return c.then(function () { return grant(raw, 'boss:' + raw.id + ':' + s.id, s.text, R.BOSS_STEP_XP, events, 'step'); }); }, Promise.resolve())
                .then(function () { return rpg.state(true); }).then(function (st2) {
                  var v2 = R.bossView(raw, st2.entries);
                  if (!v2.defeated && v2.allDone) return grant(raw, 'boss:' + raw.id, raw.name, R.tierXp(raw.tier), events, 'boss');
                });
            });
          }, Promise.resolve());
        }).then(function () { return events; });
      }
    };
    return api;
  };

  var current = { store: null, repo: null };
  R.bosses = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createBossRepo(store, rpg) };
    return current.repo;
  };

  // Tras registrar una actividad (o marcar algo): da las recompensas de misiones y jefes que se hayan cumplido.
  // `day` es el día del registro (para evaluar también esa semana). Devuelve los eventos para avisar al usuario.
  R.syncRewards = function (day) {
    var weekly = R.weekly(), bosses = R.bosses(), events = [];
    var weeks = [R.weekKey(R.today())]; if (day) weeks.push(R.weekKey(day));
    return Promise.resolve(weekly ? weekly.sync(weeks) : []).then(function (e1) {
      events = events.concat(e1);
      return bosses ? bosses.sync() : [];
    }).then(function (e2) { return events.concat(e2); });
  };
})(window.App = window.App || {});
