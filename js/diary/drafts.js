// Borradores: texto a medias guardado en este navegador, para no perder nada si cierras la pestaña.
// OJO: viven en localStorage, sin cifrar, hasta que guardes la entrada o los descartes.
(function (App) {
  var KEY = 'diario-rpg.drafts.v1';
  var MAX_DRAFTS = 20;
  var MAX_TEXT = 200000;
  var KEY_RE = /^(new|e_[0-9a-f]{12})$/;

  function readAll() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY));
      return data && typeof data === 'object' && data.drafts && typeof data.drafts === 'object' ? data.drafts : {};
    } catch (e) { return {}; }
  }
  function writeAll(drafts) {
    try { localStorage.setItem(KEY, JSON.stringify({ drafts: drafts })); return true; } catch (e) { return false; }
  }
  function clean(key, d) {
    if (!KEY_RE.test(key) || !d || typeof d !== 'object') return null;
    return {
      key: key,
      entryId: key === 'new' ? null : key,
      date: typeof d.date === 'string' ? d.date : '',
      title: typeof d.title === 'string' ? d.title.slice(0, 200) : '',
      text: typeof d.text === 'string' ? d.text.slice(0, MAX_TEXT) : '',
      tags: Array.isArray(d.tags) ? d.tags.filter(function (t) { return typeof t === 'string'; }).slice(0, 20) : [],
      favorite: d.favorite === true,
      updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : ''
    };
  }

  App.drafts = {
    isEmpty: function (d) { return !d || (!d.title.trim() && !d.text.trim()); },

    get: function (key) {
      var all = readAll();
      return Object.prototype.hasOwnProperty.call(all, key) ? clean(key, all[key]) : null;
    },

    // Devuelve true si se pudo guardar. Un borrador vacío se elimina.
    save: function (key, data) {
      if (!KEY_RE.test(key)) return false;
      var all = readAll();
      var d = clean(key, Object.assign({}, data, { updatedAt: new Date().toISOString() }));
      if (App.drafts.isEmpty(d)) delete all[key]; else all[key] = d;
      var keys = Object.keys(all).sort(function (a, b) { return all[b].updatedAt < all[a].updatedAt ? -1 : 1; });
      keys.slice(MAX_DRAFTS).forEach(function (k) { delete all[k]; });
      return writeAll(all);
    },

    remove: function (key) {
      var all = readAll();
      if (Object.prototype.hasOwnProperty.call(all, key)) { delete all[key]; return writeAll(all); }
      return true;
    },

    // Borradores con contenido, del más reciente al más antiguo.
    list: function () {
      var all = readAll();
      return Object.keys(all).map(function (k) { return clean(k, all[k]); })
        .filter(function (d) { return d && !App.drafts.isEmpty(d); })
        .sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    }
  };
})(window.App = window.App || {});
