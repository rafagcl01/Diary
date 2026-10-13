// Adaptador de GitHub: lee y escribe archivos de texto en un repositorio con la API "contents".
// Solo habla con https://api.github.com. No sabe nada del diario: solo de archivos.
(function (App) {
  var API = 'https://api.github.com';

  function toBase64(text) { return btoa(unescape(encodeURIComponent(text))); }
  function fromBase64(b64) { return decodeURIComponent(escape(atob(String(b64).replace(/\s/g, '')))); }
  function encodePath(path) { return path.split('/').map(encodeURIComponent).join('/'); }

  App.createGithubAdapter = function (cfg) {
    var owner = cfg.owner, repo = cfg.repo, branch = cfg.branch || 'main', token = cfg.token;

    function send(method, path, body, accept) {
      var headers = { Accept: accept || 'application/vnd.github+json', Authorization: 'Bearer ' + token };
      var opts = { method: method, headers: headers, cache: 'no-store' };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      var url = API + path;
      var pending;
      try {
        pending = cfg.fetch ? cfg.fetch(url, opts) : fetch(url, opts);
      } catch (e) {
        return Promise.reject(App.storageError('network'));
      }
      return Promise.resolve(pending).catch(function () { throw App.storageError('network'); });
    }

    function readJsonBody(res) {
      return Promise.resolve(res.json()).catch(function () { return {}; });
    }

    // Convierte una respuesta de error en un StorageError con código.
    function fail(res, body) {
      var s = res.status;
      var message = (body && body.message) || '';
      var remaining = res.headers && res.headers.get ? res.headers.get('x-ratelimit-remaining') : null;
      if (s === 401) return App.storageError('auth');
      if (s === 429) return App.storageError('ratelimit');
      if (s === 403) {
        return (remaining === '0' || /rate limit/i.test(message)) ? App.storageError('ratelimit') : App.storageError('forbidden');
      }
      if (s === 404) return App.storageError('notfound');
      if (s === 409 || (s === 422 && /sha/i.test(message))) return App.storageError('conflict');
      if (s === 422) return App.storageError('invalid', 'GitHub no ha aceptado el cambio: ' + message);
      return App.storageError('unknown', 'GitHub respondió con el código ' + s + '.');
    }

    var base = '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo);

    return {
      label: owner + '/' + repo,

      // Datos del repositorio: si es privado y si el token puede escribir.
      getRepo: function () {
        return send('GET', base).then(function (res) {
          return readJsonBody(res).then(function (b) {
            if (!res.ok) throw fail(res, b);
            return {
              isPrivate: b.private === true,
              canPush: b.permissions && typeof b.permissions.push === 'boolean' ? b.permissions.push : null
            };
          });
        });
      },

      // Devuelve { text, sha } o null si el archivo no existe.
      read: function (path) {
        var url = base + '/contents/' + encodePath(path) + '?ref=' + encodeURIComponent(branch);
        return send('GET', url).then(function (res) {
          return readJsonBody(res).then(function (b) {
            if (res.status === 404) return null;
            if (!res.ok) throw fail(res, b);
            if (Array.isArray(b) || b.type !== 'file') throw App.storageError('invalid', '«' + path + '» no es un archivo.');
            if (b.encoding === 'base64' && typeof b.content === 'string' && b.content !== '') {
              return { text: fromBase64(b.content), sha: b.sha };
            }
            // Archivos de más de 1 MB: se piden en bruto.
            return send('GET', url, undefined, 'application/vnd.github.raw+json').then(function (raw) {
              if (!raw.ok) return readJsonBody(raw).then(function (rb) { throw fail(raw, rb); });
              return Promise.resolve(raw.text()).then(function (text) { return { text: text, sha: b.sha }; });
            });
          });
        });
      },

      // Crea (sin sha) o actualiza (con sha) un archivo. Devuelve { sha }.
      write: function (path, text, opts) {
        var body = { message: (opts && opts.message) || 'Actualiza ' + path, content: toBase64(text), branch: branch };
        if (opts && opts.sha) body.sha = opts.sha;
        return send('PUT', base + '/contents/' + encodePath(path), body).then(function (res) {
          return readJsonBody(res).then(function (b) {
            if (!res.ok) throw fail(res, b);
            return { sha: b.content && b.content.sha };
          });
        });
      },

      remove: function (path, sha, message) {
        var body = { message: message || 'Elimina ' + path, sha: sha, branch: branch };
        return send('DELETE', base + '/contents/' + encodePath(path), body).then(function (res) {
          return readJsonBody(res).then(function (b) {
            if (!res.ok) throw fail(res, b);
          });
        });
      },

      // Lista las rutas de todos los archivos. Un repositorio vacío devuelve [].
      listPaths: function () {
        return send('GET', base + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1').then(function (res) {
          return readJsonBody(res).then(function (b) {
            if (res.status === 409) return [];
            if (!res.ok) throw fail(res, b);
            if (b.truncated) throw App.storageError('invalid', 'El repositorio tiene demasiados archivos para listarlos.');
            return (b.tree || []).filter(function (n) { return n.type === 'blob'; }).map(function (n) { return n.path; });
          });
        });
      }
    };
  };
})(window.App = window.App || {});
