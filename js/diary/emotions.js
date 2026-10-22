// Emociones personalizables: una biblioteca propia (nombre + símbolo de una galería) que se guarda en
// emotions.json y se reutiliza en cualquier entrada. Son independientes del estado de ánimo: ninguna
// operación de este módulo toca los bloques ni el porcentaje de ánimo (que sale solo de `mood`).
(function (App) {
  var D = App.diary;
  var PATH = 'emotions.json';
  var LIMITS = { name: 30, count: 200 };

  // Símbolos: la galería única de toda la aplicación (icons.js). Los de antes siguen valiendo: estaban todos en ella.
  D.EMOTION_SYMBOLS = App.SYMBOLS;
  D.EMOTION_LIMITS = LIMITS;
  D.isSymbol = function (id) { return D.EMOTION_SYMBOLS.some(function (s) { return s.id === id; }); };
  D.symbolLabel = function (id) {
    for (var i = 0; i < D.EMOTION_SYMBOLS.length; i++) if (D.EMOTION_SYMBOLS[i].id === id) return D.EMOTION_SYMBOLS[i].label;
    return '';
  };

  function invalid(msg) { return App.storageError('invalid', msg); }
  function skipKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
  function cleanName(name) { return String(name == null ? '' : name).replace(/\s+/g, ' ').trim(); }
  D.emotionKey = function (name) { return D.fold(cleanName(name)); };

  D.newEmotionId = function () {
    var a = new Uint8Array(4);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return 'em_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  };

  // Valida una emoción (lanza un error claro). Conserva campos desconocidos.
  D.sanitizeEmotion = function (input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('La emoción no es válida.');
    var out = {};
    Object.keys(input).forEach(function (k) { if (!skipKey(k)) out[k] = input[k]; });
    if (out.id === undefined || out.id === null) out.id = D.newEmotionId();
    if (typeof out.id !== 'string' || !D.EMOTION_ID_RE.test(out.id)) throw invalid('El identificador de la emoción no es válido.');
    out.name = cleanName(out.name);
    if (!out.name) throw invalid('Ponle un nombre a la emoción.');
    if (out.name.length > LIMITS.name) throw invalid('El nombre es demasiado largo (máximo ' + LIMITS.name + ' caracteres).');
    if (!D.isSymbol(out.symbol)) throw invalid('Elige un símbolo de la galería.');
    var now = new Date().toISOString();
    out.createdAt = typeof out.createdAt === 'string' && !isNaN(Date.parse(out.createdAt)) ? out.createdAt : now;
    out.updatedAt = typeof out.updatedAt === 'string' && !isNaN(Date.parse(out.updatedAt)) ? out.updatedAt : now;
    return out;
  };
  D.normalizeEmotionLoaded = function (raw) { try { return D.sanitizeEmotion(raw); } catch (e) { return null; } };

  // De una lista de emociones a un mapa id -> emoción (para pintar las de cada entrada).
  D.emotionMap = function (list) {
    var map = {};
    (list || []).forEach(function (e) { map[e.id] = e; });
    return map;
  };

  App.createEmotionRepo = function (store) {
    var cache = null;

    function ensureDoc(doc) {
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.emotions)) {
        throw invalid('El archivo de emociones está dañado. No lo toco para no perder nada; revísalo en GitHub.');
      }
      return doc;
    }
    function sorted(list) {
      return list.slice().sort(function (a, b) { var x = D.emotionKey(a.name), y = D.emotionKey(b.name); return x < y ? -1 : x > y ? 1 : 0; });
    }
    function duplicateOf(doc, name, exceptId) {
      var key = D.emotionKey(name);
      return doc.emotions.some(function (raw) { return raw && raw.id !== exceptId && typeof raw.name === 'string' && D.emotionKey(raw.name) === key; });
    }

    function load(force) {
      if (cache && !force) return Promise.resolve(cache);
      return store.readJson(PATH, null).then(function (doc) {
        var list = [];
        if (doc) { ensureDoc(doc); list = doc.emotions.map(D.normalizeEmotionLoaded).filter(Boolean); }
        cache = sorted(list);
        return cache;
      });
    }

    return {
      // Todas las emociones, ordenadas por nombre.
      list: function (force) { return load(force).then(function (l) { return l.slice(); }); },

      // Crea una emoción nueva. Devuelve la emoción creada.
      create: function (input) {
        var candidate;
        try { candidate = D.sanitizeEmotion({ name: input && input.name, symbol: input && input.symbol }); }
        catch (err) { return Promise.reject(err); }     // siempre una promesa, para poder usar .catch
        var created = null;
        return store.updateJson(PATH, function (doc) {
          ensureDoc(doc);
          if (doc.emotions.length >= LIMITS.count) throw invalid('Ya tienes el máximo de emociones (' + LIMITS.count + ').');
          if (duplicateOf(doc, candidate.name, null)) throw invalid('Ya tienes una emoción con ese nombre.');
          created = D.sanitizeEmotion(Object.assign({}, candidate, { id: D.newEmotionId() }));
          return Object.assign({}, doc, { version: 1, emotions: doc.emotions.concat([created]) });
        }, { fallback: { version: 1, emotions: [] }, message: 'Crea una emoción' }).then(function () { return load(true); }).then(function () { return created; });
      },

      // Cambia el nombre y/o el símbolo. Las entradas que la usan no cambian (la referencian por identificador).
      update: function (id, input) {
        var updated = null;
        return store.updateJson(PATH, function (doc) {
          ensureDoc(doc);
          var index = -1;
          doc.emotions.forEach(function (e, i) { if (e && e.id === id) index = i; });
          if (index < 0) throw invalid('Esa emoción ya no existe.');
          var now = new Date().toISOString();
          updated = D.sanitizeEmotion(Object.assign({}, doc.emotions[index], { name: input && input.name, symbol: input && input.symbol, updatedAt: now }));
          if (duplicateOf(doc, updated.name, id)) throw invalid('Ya tienes una emoción con ese nombre.');
          var next = doc.emotions.slice(); next[index] = updated;
          return Object.assign({}, doc, { emotions: next });
        }, { fallback: { version: 1, emotions: [] }, message: 'Edita una emoción' }).then(function () { return load(true); }).then(function () { return updated; });
      }
    };
  };

  // Biblioteca de la conexión actual (o null si no hay datos conectados).
  var current = { store: null, repo: null };
  D.emotions = function () {
    var store = App.connection.getStore();
    if (!store) return null;
    if (current.store !== store) current = { store: store, repo: App.createEmotionRepo(store) };
    return current.repo;
  };
})(window.App = window.App || {});
