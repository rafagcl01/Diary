// Conexión con el repositorio privado de datos: guarda dónde está, verifica que es seguro
// y entrega el almacén al resto de la aplicación.
// El token vive solo en este navegador: en localStorage si marcas "recordar", o solo en memoria si no.
(function (App) {
  var KEY = 'diario-rpg.conn.v1';
  var REPO_RE = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;

  var config = null;      // { owner, repo, branch, remember }
  var token = null;
  var store = null;
  var status = { state: 'disconnected', message: '', checkedAt: null };
  var listeners = [];

  function notify() { listeners.slice().forEach(function (fn) { fn(App.connection.describe()); }); }
  function setStatus(state, message) { status = { state: state, message: message || '', checkedAt: new Date().toISOString() }; notify(); }

  function persist() {
    try {
      if (!config) { localStorage.removeItem(KEY); return true; }
      var data = { owner: config.owner, repo: config.repo, branch: config.branch, remember: config.remember };
      if (config.remember && token) data.token = token;
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Acepta "usuario/repositorio" o la dirección completa de GitHub.
  function parseRepo(text) {
    var t = String(text || '').trim()
      .replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    var m = REPO_RE.exec(t);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  function buildStore(cfg, tok, fetchImpl) {
    var adapter = App.createGithubAdapter({ owner: cfg.owner, repo: cfg.repo, branch: cfg.branch, token: tok, fetch: fetchImpl });
    return { adapter: adapter, store: App.createStore(adapter) };
  }

  // Comprueba lo que no puede fallar en silencio: que el repositorio es privado y que se puede escribir.
  function verify(adapter) {
    return adapter.getRepo().then(function (info) {
      if (!info.isPrivate) throw App.storageError('public-repo');
      if (info.canPush === false) throw App.storageError('forbidden');
      return info;
    });
  }

  App.connection = {
    parseRepo: parseRepo,

    // Carga la configuración guardada (sin llamar a la red).
    init: function () {
      try {
        var saved = JSON.parse(localStorage.getItem(KEY));
        if (saved && parseRepo(saved.owner + '/' + saved.repo)) {
          config = { owner: saved.owner, repo: saved.repo, branch: saved.branch || 'main', remember: !!saved.remember };
          token = typeof saved.token === 'string' ? saved.token : null;
        }
      } catch (e) { config = null; token = null; }
      status = config && token ? { state: 'configured', message: '', checkedAt: null } : { state: 'disconnected', message: '', checkedAt: null };
      return App.connection.describe();
    },

    isConfigured: function () { return !!(config && token); },

    describe: function () {
      return {
        state: status.state,
        message: status.message,
        checkedAt: status.checkedAt,
        repo: config ? config.owner + '/' + config.repo : '',
        branch: config ? config.branch : 'main',
        remember: config ? config.remember : true,
        hasToken: !!token
      };
    },

    onChange: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
    },

    getStore: function () { return status.state === 'connected' ? store : null; },

    // input: { repo, branch, token, remember, fetch? }
    connect: function (input) {
      var parsed = parseRepo(input.repo);
      if (!parsed) return Promise.reject(App.storageError('invalid', 'Escribe el repositorio como usuario/repositorio.'));
      var branch = String(input.branch || 'main').trim() || 'main';
      if (!/^[A-Za-z0-9._\/-]{1,100}$/.test(branch)) return Promise.reject(App.storageError('invalid', 'El nombre de la rama no es válido.'));
      var sameRepo = config && config.owner === parsed.owner && config.repo === parsed.repo;
      var tok = String(input.token || '').trim() || (sameRepo ? token : '');
      if (!tok) return Promise.reject(App.storageError('invalid', 'Falta el token de acceso.'));

      var cfg = { owner: parsed.owner, repo: parsed.repo, branch: branch, remember: input.remember !== false };
      var built = buildStore(cfg, tok, input.fetch);
      return verify(built.adapter).then(function () {
        return built.store.initRepo();
      }).then(function (meta) {
        config = cfg; token = tok; store = built.store;
        persist();
        setStatus('connected');
        return { repo: cfg.owner + '/' + cfg.repo, meta: meta };
      });
    },

    // Reverifica una conexión guardada (por ejemplo al abrir la aplicación).
    check: function (fetchImpl) {
      if (!config || !token) return Promise.resolve(App.connection.describe());
      var built = buildStore(config, token, fetchImpl);
      return verify(built.adapter).then(function () {
        store = built.store;
        setStatus('connected');
        return App.connection.describe();
      }).catch(function (err) {
        store = null;
        setStatus('error', err && err.message ? err.message : 'No se pudo comprobar la conexión.');
        return App.connection.describe();
      });
    },

    // Olvida el repositorio y el token en este navegador. No borra nada en GitHub.
    disconnect: function () {
      config = null; token = null; store = null;
      persist();
      setStatus('disconnected');
    }
  };
})(window.App = window.App || {});
