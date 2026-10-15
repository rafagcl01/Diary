// Guardado del personaje en el repositorio de datos (carpeta rpg/):
//   rpg/profile.json         nombre y avatar
//   rpg/attributes.json      atributos y subcategorías (nombres, descripciones, iconos, orden, archivadas)
//   rpg/ledger-AAAA.json     registro de experiencia del año (solo se añaden apuntes; nunca se borran)
// El nivel nunca se guarda: se calcula del registro. Un apunte con la misma clave no se vuelve a contar.
(function (App) {
  var R = App.rpg;
  var PROFILE = 'rpg/profile.json', ATTRS = 'rpg/attributes.json', LEDGER_PREFIX = 'rpg/ledger-';
  function invalid(msg) { return App.storageError('invalid', msg); }
  function ledgerPath(year) { return LEDGER_PREFIX + year + '.json'; }

  R.AVATARS = ['mended', 'moon', 'star', 'rose', 'eye', 'key', 'locket', 'ghost', 'skull', 'cat', 'butterfly', 'cherry', 'crown', 'bow'];

  App.createRpgRepo = function (store) {
    var cache = { structure: null, entries: null, profile: null };

    function loadStructure(force) {
      if (cache.structure && !force) return Promise.resolve(cache.structure);
      return store.readJson(ATTRS, null).then(function (doc) {
        if (doc && !Array.isArray(doc.attributes)) throw invalid('El archivo de atributos está dañado. No lo toco para no perder nada; revísalo en GitHub.');
        cache.structure = R.buildStructure(doc);
        return cache.structure;
      });
    }
    function loadEntries(force) {
      if (cache.entries && !force) return Promise.resolve(cache.entries);
      return store.listFiles(LEDGER_PREFIX).then(function (paths) {
        return Promise.all(paths.map(function (p) {
          return store.readJson(p, null).then(function (doc) {
            if (doc && !Array.isArray(doc.entries)) throw invalid('Un registro de experiencia está dañado («' + p + '»). No lo toco; revísalo en GitHub.');
            return doc ? doc.entries : [];
          });
        }));
      }).then(function (lists) {
        var all = [].concat.apply([], lists).filter(function (e) { return e && typeof e.key === 'string' && typeof e.xp === 'number'; });
        all.sort(function (a, b) { return (a.at || '') < (b.at || '') ? -1 : (a.at || '') > (b.at || '') ? 1 : 0; });
        cache.entries = all;
        return all;
      });
    }
    function loadProfile(force) {
      if (cache.profile && !force) return Promise.resolve(cache.profile);
      return store.readJson(PROFILE, null).then(function (doc) {
        var d = doc && typeof doc === 'object' ? doc : {};
        cache.profile = { name: R.cleanText(d.name, R.LIMITS.name), avatar: R.AVATARS.indexOf(d.avatar) >= 0 ? d.avatar : 'mended' };
        return cache.profile;
      });
    }

    // Cambia la estructura y la guarda entera (ver R.structureToDoc). `change(structure)` modifica y puede lanzar.
    function mutate(message, change) {
      var result;
      return store.updateJson(ATTRS, function (doc) {
        if (doc && !Array.isArray(doc.attributes)) throw invalid('El archivo de atributos está dañado. No lo toco; revísalo en GitHub.');
        var st = R.buildStructure(doc);
        result = change(st);
        return R.structureToDoc(st);
      }, { fallback: null, message: message }).then(function () { return loadStructure(true); }).then(function () { return result; });
    }
    function checkName(main, name, exceptId) {
      var n = R.cleanText(name, R.LIMITS.name);
      if (!n) throw invalid('Ponle un nombre.');
      var key = R.fold(n);
      if (main.subs.some(function (s) { return s.id !== exceptId && R.fold(s.name) === key; })) throw invalid('Ya hay una subcategoría con ese nombre en este atributo.');
      return n;
    }
    function fields(input, base) {
      var out = {};
      out.description = input.description === undefined ? base.description : R.cleanText(input.description, R.LIMITS.description);
      out.icon = input.icon === undefined ? base.icon : input.icon;
      if (!R.isIcon(out.icon)) throw invalid('Elige un icono de la galería.');
      return out;
    }

    return {
      // Todo lo necesario para pintar la ficha.
      state: function (force) {
        return Promise.all([loadProfile(force), loadStructure(force), loadEntries(force)]).then(function (r) {
          return { profile: r[0], structure: r[1], entries: r[2], computed: R.computeState(r[1], r[2]) };
        });
      },
      entries: function (force) { return loadEntries(force).then(function (l) { return l.slice(); }); },

      saveProfile: function (input) {
        var name = R.cleanText(input && input.name, R.LIMITS.name);
        var avatar = input && R.AVATARS.indexOf(input.avatar) >= 0 ? input.avatar : 'mended';
        return store.writeJson(PROFILE, { version: 1, name: name, avatar: avatar }, { force: true, message: 'Actualiza el personaje' })
          .then(function () { return loadProfile(true); });
      },

      // ---- Atributos y subcategorías ----
      updateMain: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita un atributo', function (st) {
            var m = st.filter(function (a) { return a.id === id; })[0];
            if (!m) throw invalid('Ese atributo no existe.');
            var n = R.cleanText(input && input.name, R.LIMITS.name);
            if (!n) throw invalid('Ponle un nombre.');
            if (st.some(function (a) { return a.id !== id && R.fold(a.name) === R.fold(n); })) throw invalid('Ya hay un atributo con ese nombre.');
            var f = fields(input || {}, m);
            m.name = n; m.description = f.description; m.icon = f.icon;
            return m;
          });
        });
      },
      createSub: function (mainId, input) {
        return Promise.resolve().then(function () {
          return mutate('Crea una subcategoría', function (st) {
            var m = st.filter(function (a) { return a.id === mainId; })[0];
            if (!m) throw invalid('Ese atributo no existe.');
            if (m.subs.length >= R.LIMITS.subs) throw invalid('Ya tienes el máximo de subcategorías en este atributo.');
            var name = checkName(m, input && input.name, null);
            var f = fields(input || {}, { description: '', icon: 'star' });
            var sub = { id: R.newSubId(), name: name, icon: f.icon, description: f.description, archived: false, order: m.subs.length };
            m.subs.push(sub);
            return sub;
          });
        });
      },
      updateSub: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita una subcategoría', function (st) {
            var f0 = R.findSub(st, id);
            if (!f0) throw invalid('Esa subcategoría ya no existe.');
            var name = checkName(f0.main, input && input.name, id);
            var f = fields(input || {}, f0.sub);
            f0.sub.name = name; f0.sub.description = f.description; f0.sub.icon = f.icon;   // el id no cambia: la historia se conserva
            return f0.sub;
          });
        });
      },
      // Archivar oculta la subcategoría de las listas de nuevas recompensas, pero conserva su XP, su nivel y su historial.
      setArchived: function (id, archived) {
        return Promise.resolve().then(function () {
          return mutate(archived ? 'Archiva una subcategoría' : 'Recupera una subcategoría', function (st) {
            var f0 = R.findSub(st, id);
            if (!f0) throw invalid('Esa subcategoría ya no existe.');
            f0.sub.archived = !!archived;
            return f0.sub;
          });
        });
      },
      moveSub: function (id, dir) {
        return Promise.resolve().then(function () {
          return mutate('Reordena subcategorías', function (st) {
            var f0 = R.findSub(st, id);
            if (!f0) throw invalid('Esa subcategoría ya no existe.');
            var subs = f0.main.subs, i = subs.indexOf(f0.sub), j = i + (dir < 0 ? -1 : 1);
            if (j < 0 || j >= subs.length) return f0.sub;
            subs[i] = subs[j]; subs[j] = f0.sub;
            return f0.sub;
          });
        });
      },

      // Anula un apunte con un ajuste visible que lo compensa exactamente (nada se borra). Solo una vez por apunte.
      // Las recompensas de misiones y logros no se anulan así.
      voidEntry: function (key) {
        var self = this;
        return loadEntries().then(function (all) {
          var e = all.filter(function (x) { return x.key === key; })[0];
          if (!e) throw invalid('Ese apunte ya no existe.');
          if (e.kind !== 'manual' && e.kind !== 'activity') throw invalid('Este apunte no se puede anular desde aquí.');
          var label = ('Anulado: ' + e.label).slice(0, R.LIMITS.label);
          var day = R.today();
          return self.addEntry({
            kind: 'adjustment', key: 'void:' + key, label: label, reason: 'Apunte anulado (' + e.label + ', ' + e.day + ')', xp: -e.xp, reverses: key, day: day,
            points: (e.splits || []).map(function (p) { return { sub: p.sub, xp: -p.xp }; })
          });
        });
      },

      // ---- Experiencia ----
      // Añade un apunte al registro. Si ya existe uno con la misma clave NO se vuelve a contar (devuelve { duplicate: true }).
      // Solo se da por hecho cuando GitHub ha confirmado la escritura; si falla, lanza el error y no queda nada a medias.
      addEntry: function (input) {
        return Promise.all([loadStructure(), loadEntries()]).then(function (r) {
          var entry = R.sanitizeEntry(input, r[0]);
          if (r[1].some(function (e) { return e.key === entry.key; })) return { duplicate: true, entry: r[1].filter(function (e) { return e.key === entry.key; })[0] };
          var year = entry.day.slice(0, 4), dup = false;
          return store.updateJson(ledgerPath(year), function (doc) {
            if (doc && !Array.isArray(doc.entries)) throw invalid('El registro de experiencia de ' + year + ' está dañado. No lo toco; revísalo en GitHub.');
            var list = doc ? doc.entries : [];
            if (list.some(function (e) { return e && e.key === entry.key; })) { dup = true; return doc; }
            var id = 'xp_' + (list.length + 1);
            return { version: 1, year: Number(year), entries: list.concat([Object.assign({ id: id }, entry)]) };
          }, { fallback: null, message: entry.kind === 'adjustment' ? 'Ajusta la experiencia' : 'Suma experiencia' }).then(function () {
            return loadEntries(true);
          }).then(function (all) {
            return { duplicate: dup, entry: all.filter(function (e) { return e.key === entry.key; })[0] };
          });
        });
      }
    };
  };

  var current = { store: null, repo: null };
  R.repo = function () {
    var store = App.connection.getStore();
    if (!store) return null;
    if (current.store !== store) current = { store: store, repo: App.createRpgRepo(store) };
    return current.repo;
  };
})(window.App = window.App || {});
