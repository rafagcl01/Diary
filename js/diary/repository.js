// Repositorio del diario: guarda y lee entradas en el almacén (entries/AAAA-MM.json, un archivo por mes).
// Reglas: una entrada por día; nunca pisar cambios hechos desde otro dispositivo sin avisar; nunca tocar
// archivos dañados ni entradas que no se entienden; avisar si un mes ya es demasiado grande para un archivo.
(function (App) {
  var D = App.diary;
  var MONTH_FILE_RE = /^entries\/(\d{4}-\d{2})\.json$/;
  var MAX_MONTH_CHARS = 850000;
  var VERSION = 2;
  var LEGACY_MESSAGE = 'Tus entradas anteriores usan el formato antiguo. Actualízalo desde el Diario antes de guardar cambios.';

  function pathFor(month) { return 'entries/' + month + '.json'; }
  function invalid(msg) { return App.storageError('invalid', msg); }
  function ensureDoc(doc) {
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.entries)) {
      throw invalid('El archivo de este mes está dañado. No lo toco para no perder nada; revísalo en GitHub.');
    }
    return doc;
  }
  function dayOf(e) { return e && typeof e === 'object' && typeof e.day === 'string' ? e.day : ''; }
  function sortEntries(list) {
    return list.slice().sort(function (a, b) { return dayOf(a) < dayOf(b) ? -1 : dayOf(a) > dayOf(b) ? 1 : 0; });
  }
  function docOf(month, entries) {
    var doc = { month: month, version: VERSION, entries: sortEntries(entries) };
    if (JSON.stringify(doc).length > MAX_MONTH_CHARS) {
      throw invalid('Este mes ya tiene demasiado texto para guardarlo en un solo archivo. Avísame y lo repartimos.');
    }
    return doc;
  }

  App.createDiaryRepo = function (store) {
    var cache = null;   // { list, byDay, problems, legacyMonths, legacyWinner }

    function load(force) {
      if (cache && !force) return Promise.resolve(cache);
      return store.listFiles('entries/').then(function (paths) {
        var months = paths.map(function (p) { var m = MONTH_FILE_RE.exec(p); return m ? m[1] : null; }).filter(Boolean);
        var found = {}, problems = [], legacyRaw = [], legacyMonths = [];
        return months.reduce(function (chain, month) {
          return chain.then(function () {
            return store.readJson(pathFor(month), null).then(function (doc) {
              if (!doc || !Array.isArray(doc.entries)) { problems.push(month); return; }
              doc.entries.forEach(function (raw) {
                if (D.isLegacy(raw)) {
                  legacyRaw.push({ raw: raw, month: month });
                  if (legacyMonths.indexOf(month) < 0) legacyMonths.push(month);
                  return;
                }
                var e = D.normalizeLoaded(raw);
                if (!e) { problems.push(month); return; }
                found[e.day] = found[e.day] ? D.mergeDayEntries([found[e.day], e]) : e;
              });
            }).catch(function (err) {
              if (err && err.code === 'invalid') problems.push(month); else throw err;
            });
          });
        }, Promise.resolve()).then(function () {
          // Entradas antiguas: si una aparece en dos meses (un movimiento a medias), gana la más reciente.
          var winner = {}, winnerMonth = {};
          legacyRaw.forEach(function (x) {
            var id = typeof x.raw.id === 'string' ? x.raw.id : null;
            if (id === null) return;
            if (!winner[id] || winner[id].updatedAt < x.raw.updatedAt) { winner[id] = x.raw; winnerMonth[id] = x.month; }
          });
          var effective = legacyRaw.filter(function (x) { return typeof x.raw.id !== 'string' || winnerMonth[x.raw.id] === x.month; }).map(function (x) { return x.raw; });
          // Vista previa de lo antiguo ya convertido (no se guarda hasta que se actualice el formato).
          D.upgradeLegacy(effective).forEach(function (u) { found[u.day] = found[u.day] ? D.mergeDayEntries([u, found[u.day]]) : u; });

          var next = { list: [], byDay: Object.create(null), problems: problems, legacyMonths: legacyMonths, legacyWinner: winnerMonth, legacyCount: effective.length };
          Object.keys(found).forEach(function (day) { next.list.push(found[day]); next.byDay[day] = found[day]; });
          next.list.sort(D.byDayDesc);
          cache = next;
          return cache;
        });
      });
    }

    function guardLegacy(c) { if (c.legacyMonths.length) throw invalid(LEGACY_MESSAGE); }
    function remember(entry) {
      cache.byDay[entry.day] = entry;
      cache.list = cache.list.filter(function (e) { return e.day !== entry.day; }).concat([entry]).sort(D.byDayDesc);
    }
    function findDay(doc, day) {
      for (var i = 0; i < doc.entries.length; i++) if (dayOf(doc.entries[i]) === day) return doc.entries[i];
      return null;
    }

    var repo = {
      list: function (force) { return load(force).then(function (c) { return c.list.slice(); }); },
      get: function (day) { return load().then(function (c) { return c.byDay[day] || null; }); },
      problems: function () { return cache ? cache.problems.slice() : []; },
      // Entradas en el formato antiguo pendientes de actualizar.
      legacy: function () { return cache ? { months: cache.legacyMonths.slice(), count: cache.legacyCount } : { months: [], count: 0 }; },

      // Guarda la entrada de un día (la crea o la sustituye entera).
      // opts.base: la versión (updatedAt) que se cargó para editar, o null si el día no tenía entrada.
      // Si alguien (otro dispositivo) cambió el día mientras tanto, se niega en vez de pisarlo.
      save: function (input, opts) {
        return load().then(function (c) {
          guardLegacy(c);
          var prev = input && c.byDay[input.day] ? c.byDay[input.day] : null;
          var base = opts && opts.base !== undefined ? opts.base : (prev ? prev.updatedAt : null);
          var now = new Date().toISOString();
          var entry = D.sanitizeEntry(Object.assign({}, prev || {}, input || {}, { createdAt: prev ? prev.createdAt : now, updatedAt: now }));
          var month = D.monthKey(entry.day);

          return store.updateJson(pathFor(month), function (doc) {
            ensureDoc(doc);
            var existing = findDay(doc, entry.day);
            if (existing && existing.updatedAt !== base) throw App.storageError('stale');
            if (!existing && base) throw App.storageError('stale');
            return docOf(month, doc.entries.filter(function (e) { return dayOf(e) !== entry.day; }).concat([entry]));
          }, { fallback: { month: month, entries: [] }, message: (prev ? 'Edita' : 'Añade') + ' entrada' }).then(function () {
            remember(entry); return entry;
          });
        });
      },

      // Añade un bloque al final de la entrada del día (la crea si no existe). Sirve para registrar
      // un ánimo con un toque. No pisa nada: si otro dispositivo escribió, se suma.
      appendBlock: function (day, block) {
        return load().then(function (c) {
          guardLegacy(c);
          if (!D.isDay(day)) throw invalid('La fecha no es válida.');
          var b = D.sanitizeBlock(block || {});
          if (!D.blockHasContent(b)) throw invalid('Elige un ánimo, escribe algo o añade una etiqueta.');
          var month = D.monthKey(day), now = new Date().toISOString(), result = null;
          return store.updateJson(pathFor(month), function (doc) {
            ensureDoc(doc);
            var existing = findDay(doc, day);
            result = existing
              ? D.sanitizeEntry(Object.assign({}, existing, { blocks: (existing.blocks || []).concat([b]), updatedAt: now }))
              : D.sanitizeEntry({ day: day, title: '', favorite: false, blocks: [b], createdAt: now, updatedAt: now });
            return docOf(month, doc.entries.filter(function (e) { return dayOf(e) !== day; }).concat([result]));
          }, { fallback: { month: month, entries: [] }, message: 'Añade bloque' }).then(function () {
            remember(result); return result;
          });
        });
      },

      // Borra la entrada de un día. Devuelve true si existía.
      remove: function (day) {
        return load().then(function (c) {
          guardLegacy(c);
          if (!c.byDay[day]) return false;
          return store.updateJson(pathFor(D.monthKey(day)), function (doc) {
            ensureDoc(doc);
            return Object.assign({}, doc, { entries: doc.entries.filter(function (e) { return dayOf(e) !== day; }) });
          }, { message: 'Elimina entrada' }).then(function () {
            delete c.byDay[day];
            c.list = c.list.filter(function (e) { return e.day !== day; });
            return true;
          });
        });
      },

      // Pasa las entradas del formato antiguo al nuevo (una por día). No pierde texto; GitHub conserva el historial.
      migrateLegacy: function () {
        return load().then(function (c) {
          if (!c.legacyMonths.length) return { months: 0, entries: 0 };
          var winner = c.legacyWinner, perMonth = {};
          return c.legacyMonths.reduce(function (chain, month) {
            return chain.then(function () {
              return store.updateJson(pathFor(month), function (doc) {
                ensureDoc(doc);
                var legacy = doc.entries.filter(D.isLegacy).filter(function (raw) { return typeof raw.id !== 'string' || winner[raw.id] === month; });
                var rest = doc.entries.filter(function (e) { return !D.isLegacy(e); });
                var upgraded = D.upgradeLegacy(legacy), next = rest.slice();
                upgraded.forEach(function (u) {
                  var i = -1;
                  next.forEach(function (e, k) { if (dayOf(e) === u.day) i = k; });
                  if (i < 0) { next.push(u); return; }
                  var existing = D.normalizeLoaded(next[i]);
                  if (!existing) throw invalid('El mes ' + month + ' tiene una entrada que no entiendo; no lo actualizo para no perder nada.');
                  next[i] = D.mergeDayEntries([u, existing]);
                });
                perMonth[month] = upgraded.length;
                return docOf(month, next);
              }, { message: 'Actualiza el formato del diario' });
            });
          }, Promise.resolve()).then(function () {
            return load(true).then(function () {
              var entries = Object.keys(perMonth).reduce(function (sum, m) { return sum + perMonth[m]; }, 0);
              return { months: c.legacyMonths.length, entries: entries };
            });
          });
        });
      }
    };
    return repo;
  };

  // Repositorio de la conexión actual (o null si no hay datos conectados).
  var current = { store: null, repo: null };
  D.repo = function () {
    var store = App.connection.getStore();
    if (!store) return null;
    if (current.store !== store) current = { store: store, repo: App.createDiaryRepo(store) };
    return current.repo;
  };
})(window.App = window.App || {});
