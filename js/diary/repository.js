// Repositorio del diario: guarda y lee entradas en el almacén (entries/AAAA-MM.json, un archivo por mes).
// Reglas: nunca tocar entradas ajenas ni archivos dañados, escribir primero y borrar después al cambiar de mes,
// y avisar si un mes ya es demasiado grande para un archivo.
(function (App) {
  var D = App.diary;
  var MONTH_FILE_RE = /^entries\/(\d{4}-\d{2})\.json$/;
  var MAX_MONTH_CHARS = 850000;

  function pathFor(month) { return 'entries/' + month + '.json'; }
  function invalid(msg) { return App.storageError('invalid', msg); }

  function ensureDoc(doc) {
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.entries)) {
      throw invalid('El archivo de este mes está dañado. No lo toco para no perder nada; revísalo en GitHub.');
    }
    return doc;
  }
  function sortEntries(list) {
    return list.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1); });
  }

  App.createDiaryRepo = function (store) {
    var cache = null;   // { list: [...], byId: {}, where: { id: 'AAAA-MM' }, problems: [] }

    function load(force) {
      if (cache && !force) return Promise.resolve(cache);
      return store.listFiles('entries/').then(function (paths) {
        var months = paths.map(function (p) { var m = MONTH_FILE_RE.exec(p); return m ? m[1] : null; }).filter(Boolean);
        var found = {}, problems = [];
        return months.reduce(function (chain, month) {
          return chain.then(function () {
            return store.readJson(pathFor(month), null).then(function (doc) {
              if (!doc || !Array.isArray(doc.entries)) { problems.push(month); return; }
              doc.entries.forEach(function (raw) {
                var e = D.normalizeLoaded(raw);
                if (!e) { problems.push(month); return; }
                // Si una entrada aparece en dos meses (un movimiento a medias), gana la más reciente.
                if (!found[e.id] || found[e.id].entry.updatedAt < e.updatedAt) found[e.id] = { entry: e, month: month };
              });
            }).catch(function (err) {
              if (err && err.code === 'invalid') problems.push(month); else throw err;
            });
          });
        }, Promise.resolve()).then(function () {
          var next = { list: [], byId: Object.create(null), where: Object.create(null), problems: problems };
          Object.keys(found).forEach(function (id) {
            next.list.push(found[id].entry); next.byId[id] = found[id].entry; next.where[id] = found[id].month;
          });
          next.list.sort(D.byDateDesc);
          cache = next;
          return cache;
        });
      });
    }

    function remember(entry, month) {
      cache.byId[entry.id] = entry; cache.where[entry.id] = month;
      cache.list = cache.list.filter(function (e) { return e.id !== entry.id; }).concat([entry]).sort(D.byDateDesc);
    }

    var repo = {
      // Todas las entradas, de la más reciente a la más antigua.
      list: function (force) { return load(force).then(function (c) { return c.list.slice(); }); },
      problems: function () { return cache ? cache.problems.slice() : []; },
      get: function (id) { return load().then(function (c) { return c.byId[id] || null; }); },

      // Crea o actualiza (según exista el id). Devuelve la entrada guardada.
      save: function (input) {
        return load().then(function (c) {
          var prev = input && input.id ? c.byId[input.id] : null;
          var now = new Date().toISOString();
          var merged = Object.assign({}, prev || {}, input || {}, { updatedAt: now });
          merged.createdAt = prev ? prev.createdAt : (merged.createdAt || now);
          var entry = D.sanitizeEntry(merged);
          var month = D.monthKey(entry.date);
          var oldMonth = c.where[entry.id];

          return store.updateJson(pathFor(month), function (doc) {
            ensureDoc(doc);
            var next = { month: month, entries: sortEntries(doc.entries.filter(function (e) { return !e || e.id !== entry.id; }).concat([entry])) };
            if (JSON.stringify(next).length > MAX_MONTH_CHARS) {
              throw invalid('Este mes ya tiene demasiado texto para guardarlo en un solo archivo. Avísame y lo repartimos.');
            }
            return next;
          }, { fallback: { month: month, entries: [] }, message: (prev ? 'Edita' : 'Añade') + ' entrada' }).then(function () {
            if (oldMonth && oldMonth !== month) {
              // La entrada ya está a salvo en el mes nuevo; ahora se quita del antiguo.
              return store.updateJson(pathFor(oldMonth), function (doc) {
                ensureDoc(doc);
                return Object.assign({}, doc, { entries: doc.entries.filter(function (e) { return !e || e.id !== entry.id; }) });
              }, { message: 'Mueve entrada' });
            }
          }).then(function () { remember(entry, month); return entry; });
        });
      },

      // Borra una entrada. Devuelve true si existía.
      remove: function (id) {
        return load().then(function (c) {
          var month = c.where[id];
          if (!month) return false;
          return store.updateJson(pathFor(month), function (doc) {
            ensureDoc(doc);
            return Object.assign({}, doc, { entries: doc.entries.filter(function (e) { return !e || e.id !== id; }) });
          }, { message: 'Elimina entrada' }).then(function () {
            delete c.byId[id]; delete c.where[id];
            c.list = c.list.filter(function (e) { return e.id !== id; });
            return true;
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
