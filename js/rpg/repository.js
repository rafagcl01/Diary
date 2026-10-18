// Guardado del personaje en el repositorio de datos (carpeta rpg/):
//   rpg/profile.json         nombre y avatar
//   rpg/attributes.json      atributos y subcategorías (nombres, descripciones, iconos, orden, archivadas)
//   rpg/ledger-AAAA.json     registro de experiencia del año (se añaden apuntes; solo las actividades se pueden borrar)
// El nivel nunca se guarda: se calcula del registro. Un apunte con la misma clave no se vuelve a contar.
(function (App) {
  var R = App.rpg;
  var PROFILE = 'rpg/profile.json', ATTRS = 'rpg/attributes.json', LEDGER_PREFIX = 'rpg/ledger-';
  function invalid(msg) { return App.storageError('invalid', msg); }
  function ledgerPath(year) { return LEDGER_PREFIX + year + '.json'; }

  R.AVATARS = ['mended', 'moon', 'star', 'rose', 'eye', 'key', 'locket', 'ghost', 'skull', 'cat', 'butterfly', 'cherry', 'crown', 'bow'];
  // Imagen del avatar (opcional): { kind: 'photo', data: 'data:image/jpeg;base64,…' } o { kind: 'url', url } (imagen o GIF
  // por enlace, de los sitios de R.IMAGE_SITES; no se descarga). El símbolo se guarda siempre: es lo que se ve si no hay
  // imagen o si el enlace no carga. Devuelve null si no vale.
  R.cleanAvatarImage = function (img) {
    if (!img || typeof img !== 'object') return null;
    if (img.kind === 'photo' && R.isAvatarPhoto(img.data)) return { kind: 'photo', data: img.data };
    if (img.kind === 'url' && R.imageUrl) { var u = R.imageUrl(img.url); if (u) return { kind: 'url', url: u }; }
    return null;
  };

  R.isBossStepKey = function (key) { return /^boss:bo_[0-9a-f]{8}:st_[0-9a-f]{8}$/.test(String(key)); };

  App.createRpgRepo = function (store) {
    var cache = { structure: null, entries: null, profile: null }, stamp = {}, pending = {}, listeners = [];
    // Este repositorio es la única fuente de verdad del personaje: las pantallas (ficha, inicio…) leen de aquí y se apuntan
    // con onChange para repintarse cuando algo cambia (XP, perfil o atributos), sin recargar la página.
    function notify(kind) {
      listeners.slice().forEach(function (fn) { try { fn(kind); } catch (e) { /* una pantalla rota no debe frenar al resto */ } });
    }
    // Lecturas a GitHub: una sola a la vez por archivo, y un «recargar» suave (force) no repite lo leído hace menos de 4 s.
    // Tras escribir nosotros (hard) siempre se relee, y se avisa. Así abrir la ficha no hace decenas de llamadas repetidas.
    function cached(kind, force, hard, read) {
      if (cache[kind] && !(force && (hard || Date.now() - (stamp[kind] || 0) > 4000))) return Promise.resolve(cache[kind]);
      if (pending[kind] && !hard) return pending[kind];
      var p = read().then(function (v) {
        cache[kind] = v; stamp[kind] = Date.now(); pending[kind] = null;
        if (hard) notify(kind);
        return v;
      }, function (e) { pending[kind] = null; throw e; });
      pending[kind] = p;
      return p;
    }

    function loadStructure(force, hard) {
      return cached('structure', force, hard, function () {
        return store.readJson(ATTRS, null).then(function (doc) {
          if (doc && !Array.isArray(doc.attributes)) throw invalid('El archivo de atributos está dañado. No lo toco para no perder nada; revísalo en GitHub.');
          return R.buildStructure(doc);
        });
      });
    }
    function loadEntries(force, hard) {
      return cached('entries', force, hard, function () { return readEntries(); });
    }
    function validEntries(list) { return (list || []).filter(function (e) { return e && typeof e.key === 'string' && typeof e.xp === 'number'; }); }
    function byTime(a, b) { return (a.at || '') < (b.at || '') ? -1 : (a.at || '') > (b.at || '') ? 1 : 0; }
    function readEntries() {
      return store.listFiles(LEDGER_PREFIX).then(function (paths) {
        return Promise.all(paths.map(function (p) {
          return store.readJson(p, null).then(function (doc) {
            if (doc && !Array.isArray(doc.entries)) throw invalid('Un registro de experiencia está dañado («' + p + '»). No lo toco; revísalo en GitHub.');
            return doc ? doc.entries : [];
          });
        }));
      }).then(function (lists) {
        return validEntries([].concat.apply([], lists)).sort(byTime);
      });
    }
    // Tras escribir el registro de un año, la caché se pone al día con lo que acabamos de guardar (que viene recién leído
    // de GitHub, con lo de otros dispositivos incluido), sin volver a leer todos los años. Y se avisa a las pantallas.
    function applyYear(year, written) {
      var others = (cache.entries || []).filter(function (e) { return String(e.day).slice(0, 4) !== year; });
      cache.entries = others.concat(validEntries(written && written.entries)).sort(byTime);
      stamp.entries = Date.now();
      notify('entries');
      return cache.entries;
    }
    function loadProfile(force, hard) {
      return cached('profile', force, hard, function () {
        return store.readJson(PROFILE, null).then(function (doc) {
          var d = doc && typeof doc === 'object' ? doc : {};
          return { name: R.cleanText(d.name, R.LIMITS.name), avatar: R.AVATARS.indexOf(d.avatar) >= 0 ? d.avatar : 'mended', image: R.cleanAvatarImage(d.image),
            title: R.isTitle(d.title) ? d.title : null };
        });
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
      }, { fallback: null, message: message }).then(function () { return loadStructure(true, true); }).then(function () { return result; });
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
      // fn(kind) se llama tras cada cambio guardado ('entries' | 'profile' | 'structure'). Devuelve la función para darse de baja.
      onChange: function (fn) {
        listeners.push(fn);
        return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
      },

      // input: { name, avatar (símbolo), image: null | { kind: 'photo', data } | { kind: 'url', url }, title? }
      // Sin `title`, se conserva el título elegido que hubiera (null = el más alto conseguido).
      saveProfile: function (input) {
        return loadProfile().then(function (cur) {
          var name = R.cleanText(input && input.name, R.LIMITS.name);
          var avatar = input && R.AVATARS.indexOf(input.avatar) >= 0 ? input.avatar : 'mended';
          var image = null;
          if (input && input.image) {
            image = R.cleanAvatarImage(input.image);
            if (!image) throw invalid(input.image.kind === 'url'
              ? 'El enlace no vale: debe ser https y directo a la imagen, de ' + R.IMAGE_SITES + '.'
              : 'Esa foto no se puede guardar. Prueba a elegirla otra vez.');
          }
          var title = input && input.title !== undefined ? input.title : cur.title;
          if (title !== null && !R.isTitle(title)) throw invalid('Ese título no existe.');
          var doc = { version: 1, name: name, avatar: avatar };
          if (image) doc.image = image;
          if (title) doc.title = title;
          return store.writeJson(PROFILE, doc, { force: true, message: 'Actualiza el personaje' });
        }).then(function () { return loadProfile(true, true); });
      },
      // Elige el título que se ve (uno ya conseguido) o null para el más alto conseguido. Lo demás del perfil no cambia.
      setTitle: function (id) {
        var self = this;
        return Promise.all([loadProfile(), loadEntries(), loadStructure()]).then(function (r) {
          var level = R.computeState(r[2], r[1]).general.level;
          if (id !== null && !R.titlesFor(level).some(function (t) { return t.id === id; })) throw invalid('Ese título todavía no lo has conseguido.');
          var p = r[0];
          return self.saveProfile({ name: p.name, avatar: p.avatar, image: p.image, title: id });
        });
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

      // Borra del todo un registro (y el ajuste que lo anulara con el sistema anterior, para no restar dos veces).
      // Solo actividades y pasos de jefe (al desmarcarlos); el resto de recompensas no se tocan. Sus XP dejan de contar.
      // Usa lo que ya hay en memoria para saber en qué año está; solo relee todo si no lo encuentra (p. ej. lo apuntó otro
      // dispositivo). Lo que se borra se decide sobre el archivo recién leído al escribir, así que nada se queda a medias.
      removeEntry: function (key) {
        function find(all) { return all.filter(function (x) { return x.key === key; })[0]; }
        function gone(x) { return x && (x.key === key || (x.kind === 'adjustment' && x.reverses === key)); }
        return loadEntries().then(function (all) { return find(all) ? all : loadEntries(true, true); }).then(function (all) {
          var e = find(all);
          if (!e) throw invalid('Ese registro ya no existe.');
          var undoable = e.kind === 'activity' || R.isBossStepKey(key) || (R.isTodoTaskKey && R.isTodoTaskKey(key)) || (R.isDailyKey && R.isDailyKey(key));
          if (!undoable) throw invalid('Solo se pueden borrar actividades, pasos de jefe, tareas y misiones diarias.');
          var years = {}; all.filter(gone).forEach(function (x) { years[String(x.day).slice(0, 4)] = true; });
          return Object.keys(years).reduce(function (p, year) {
            return p.then(function () {
              return store.updateJson(ledgerPath(year), function (doc) {
                if (!doc || !Array.isArray(doc.entries)) throw invalid('El registro de experiencia de ' + year + ' está dañado. No lo toco; revísalo en GitHub.');
                return Object.assign({}, doc, { entries: doc.entries.filter(function (x) { return !gone(x); }) });
              }, { fallback: null, message: e.kind === 'activity' ? 'Borra una actividad' : R.isBossStepKey(key) ? 'Desmarca un paso de jefe' : R.isDailyKey && R.isDailyKey(key) ? 'Desmarca una misión diaria' : 'Desmarca una tarea' }).then(function (written) { applyYear(year, written); });
            });
          }, Promise.resolve()).then(function () { return e; });
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
          }, { fallback: null, message: entry.kind === 'adjustment' ? 'Ajusta la experiencia' : 'Suma experiencia' }).then(function (written) {
            var all = applyYear(year, written);
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
