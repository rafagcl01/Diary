// Almacén del diario: archivos JSON sobre un adaptador (hoy GitHub).
// Aquí viven las reglas: rutas válidas, un solo escritor a la vez, conflictos,
// exportación e importación. El "codec" permite añadir cifrado más adelante sin tocar nada más.
(function (App) {
  var FORMAT = 'diario-rpg-export';
  var FORMAT_VERSION = 1;
  var SCHEMA_VERSION = 1;
  var MAX_FILES = 500;
  var MAX_FILE_CHARS = 900000;     // la API de GitHub lee cómodamente hasta ~1 MB por archivo
  var PATH_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*\.json$/;
  var HARMLESS_FILES = /^(README(\.md)?|\.gitignore|LICENSE(\.[a-z]+)?)$/i;

  function validPath(path) {
    return typeof path === 'string' && path.length <= 200 && PATH_RE.test(path) && path.indexOf('..') === -1;
  }
  // Devuelve una promesa rechazada (no lanza) para que quien llama siempre pueda usar .catch.
  function guarded(path, task) {
    if (!validPath(path)) return Promise.reject(App.storageError('invalid', 'Ruta no permitida: «' + path + '».'));
    return task();
  }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function randomId() {
    var a = new Uint8Array(8);
    (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); });
    return 'u_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  App.validStoragePath = validPath;

  App.createStore = function (adapter, options) {
    var codec = (options && options.codec) || {
      encode: function (data) { return JSON.stringify(data, null, 2) + '\n'; },
      decode: function (text) { return JSON.parse(text); }
    };
    var shas = Object.create(null);      // último sha conocido de cada archivo
    var chain = Promise.resolve();

    // Todas las operaciones van una detrás de otra: GitHub falla si se escribe en paralelo.
    function enqueue(task) {
      var run = chain.then(task);
      chain = run.then(function () {}, function () {});
      return run;
    }

    function fetchRemote(path) {
      return adapter.read(path).then(function (r) {
        if (!r) { delete shas[path]; return null; }
        var data;
        try { data = codec.decode(r.text); } catch (e) { throw App.storageError('invalid', '«' + path + '» no es un JSON válido.'); }
        shas[path] = r.sha;
        return { data: data, sha: r.sha };
      });
    }

    function putRemote(path, data, sha, message) {
      return adapter.write(path, codec.encode(data), { sha: sha, message: message }).then(function (r) {
        shas[path] = r.sha;
        return r.sha;
      });
    }

    var store = {
      label: adapter.label,

      readJson: function (path, fallback) {
        return guarded(path, function () {
          return enqueue(function () {
            return fetchRemote(path).then(function (r) { return r ? r.data : clone(fallback); });
          });
        });
      },

      // Escribe un archivo. Por defecto usa el último sha conocido: si el archivo existe y no se ha
      // leído antes, falla con "conflict" en vez de pisarlo. `force: true` lo sobrescribe a sabiendas.
      writeJson: function (path, data, opts) {
        opts = opts || {};
        return guarded(path, function () {
          return enqueue(function () {
            var known = opts.force ? fetchRemote(path).then(function (r) { return r ? r.sha : undefined; })
                                   : Promise.resolve(shas[path]);
            return known.then(function (sha) { return putRemote(path, data, sha, opts.message); }).then(function () {});
          });
        });
      },

      // Leer, modificar y guardar. Si otro dispositivo cambió el archivo, lo vuelve a leer y reaplica `fn`.
      // `fn` debe ser una función pura: recibe una copia de los datos y devuelve los nuevos.
      updateJson: function (path, fn, opts) {
        opts = opts || {};
        var attempts = (opts.retries === undefined ? 3 : opts.retries) + 1;
        return guarded(path, function () {
          return enqueue(function () {
            function attempt(n) {
              return fetchRemote(path).then(function (r) {
                var next = fn(r ? clone(r.data) : clone(opts.fallback));
                if (next === undefined) throw App.storageError('invalid', 'La modificación no devolvió datos.');
                return putRemote(path, next, r ? r.sha : undefined, opts.message).then(function () { return next; });
              }).catch(function (err) {
                if (err && err.code === 'conflict' && n < attempts) return attempt(n + 1);
                throw err;
              });
            }
            return attempt(1);
          });
        });
      },

      remove: function (path, message) {
        return guarded(path, function () {
          return enqueue(function () {
            return fetchRemote(path).then(function (r) {
              if (!r) return false;
              return adapter.remove(path, r.sha, message).then(function () { delete shas[path]; return true; });
            });
          });
        });
      },

      listFiles: function (prefix) {
        return enqueue(function () {
          return adapter.listPaths().then(function (paths) {
            return paths.filter(function (p) { return validPath(p) && p.indexOf(prefix || '') === 0; }).sort();
          });
        });
      },

      // Prepara un repositorio nuevo: crea meta.json solo si está vacío (o solo tiene README, .gitignore o licencia).
      // Si ya hay otras cosas, se niega: así nunca escribe datos en el repositorio equivocado.
      initRepo: function () {
        return enqueue(function () {
          return adapter.listPaths().then(function (paths) {
            if (paths.indexOf('meta.json') >= 0) {
              return fetchRemote('meta.json').then(function (r) {
                if (!r.data || r.data.app !== 'diario-rpg') {
                  throw App.storageError('invalid', 'Este repositorio tiene un meta.json que no es de este diario.');
                }
                return r.data;
              });
            }
            var foreign = paths.filter(function (p) { return !HARMLESS_FILES.test(p); });
            if (foreign.length) {
              throw App.storageError('invalid', 'Este repositorio ya contiene otros archivos. Usa un repositorio vacío solo para tus datos.');
            }
            var meta = { app: 'diario-rpg', schemaVersion: SCHEMA_VERSION, userId: randomId(), createdAt: new Date().toISOString() };
            return putRemote('meta.json', meta, undefined, 'Inicia el diario').then(function () { return meta; });
          });
        });
      },

      // ---- Copia de seguridad ----
      exportBundle: function () {
        return enqueue(function () {
          return adapter.listPaths().then(function (paths) {
            var wanted = paths.filter(validPath).sort();
            var files = {};
            return wanted.reduce(function (p, path) {
              return p.then(function () {
                return fetchRemote(path).then(function (r) { if (r) files[path] = r.data; });
              });
            }, Promise.resolve()).then(function () {
              return { format: FORMAT, formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), files: files };
            });
          });
        });
      },

      // Comprueba un archivo de copia y dice qué haría. No escribe nada.
      planImport: function (bundle) {
        var errors = [];
        if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) errors.push('El archivo no es una copia de este diario.');
        else {
          if (bundle.format !== FORMAT) errors.push('El archivo no es una copia de este diario.');
          if (typeof bundle.formatVersion !== 'number' || bundle.formatVersion > FORMAT_VERSION) errors.push('La copia es de una versión más nueva de la aplicación.');
          if (!bundle.files || typeof bundle.files !== 'object' || Array.isArray(bundle.files)) errors.push('La copia no contiene archivos.');
        }
        if (errors.length) return Promise.resolve({ ok: false, errors: errors, files: [] });

        var names = Object.keys(bundle.files);
        if (names.length > MAX_FILES) errors.push('La copia tiene demasiados archivos (' + names.length + ').');
        names.forEach(function (p) {
          if (!validPath(p)) errors.push('Ruta no permitida en la copia: «' + p + '».');
          else if (String(JSON.stringify(bundle.files[p])).length > MAX_FILE_CHARS) errors.push('«' + p + '» es demasiado grande.');
        });
        if (errors.length) return Promise.resolve({ ok: false, errors: errors, files: [] });

        return store.listFiles().then(function (existing) {
          var have = Object.create(null);
          existing.forEach(function (p) { have[p] = true; });
          var files = names.sort().map(function (p) {
            return { path: p, status: p === 'meta.json' ? 'skipped' : have[p] ? 'overwrite' : 'new' };
          });
          return { ok: true, errors: [], files: files };
        });
      },

      // Escribe lo que dice el plan. Sin `overwrite`, los archivos que ya existen no se tocan.
      // meta.json del destino nunca se sustituye. Se detiene en el primer fallo y cuenta lo hecho.
      applyImport: function (bundle, opts) {
        var overwrite = !!(opts && opts.overwrite);
        return store.planImport(bundle).then(function (plan) {
          if (!plan.ok) throw App.storageError('invalid', plan.errors[0]);
          var result = { written: 0, skipped: 0, failed: null };
          return plan.files.reduce(function (p, f) {
            return p.then(function () {
              if (result.failed) return;
              if (f.status === 'skipped' || (f.status === 'overwrite' && !overwrite)) { result.skipped++; return; }
              return store.writeJson(f.path, bundle.files[f.path], { force: true, message: 'Importa ' + f.path })
                .then(function () { result.written++; })
                .catch(function (err) { result.failed = { path: f.path, message: err.message }; });
            });
          }, Promise.resolve()).then(function () { return result; });
        });
      }
    };
    return store;
  };
})(window.App = window.App || {});
