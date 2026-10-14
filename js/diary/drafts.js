// Borradores: lo que escribes a medias, guardado en este navegador para no perder nada si cierras la pestaña.
// Hay como mucho uno por día (la clave es el día, "2026-10-13").
// OJO: viven en localStorage, sin cifrar, hasta que guardes la entrada o los descartes.
(function (App) {
  var D = App.diary;
  var KEY = 'diario-rpg.drafts.v2';
  var OLD_KEY = 'diario-rpg.drafts.v1';     // formato de la fase 3 (una sola caja de texto)
  var MAX_DRAFTS = 20;

  function validKey(key) { return typeof key === 'string' && D.isDay(key); }
  function safeJson(raw) { try { return JSON.parse(raw); } catch (e) { return null; } }

  function cleanBlock(b) {
    if (!b || typeof b !== 'object') return null;
    return {
      id: typeof b.id === 'string' && /^b_[0-9a-f]{8}$/.test(b.id) ? b.id : D.newBlockId(),
      text: typeof b.text === 'string' ? b.text.slice(0, D.LIMITS.text) : '',
      tags: Array.isArray(b.tags) ? b.tags.filter(function (t) { return typeof t === 'string'; }).slice(0, D.LIMITS.tags) : [],
      mood: typeof b.mood === 'string' && /^[a-z][a-z0-9-]{0,29}$/.test(b.mood) ? b.mood : null,
      emotions: D.uniqueEmotionIds(b.emotions)
    };
  }
  function clean(key, d) {
    if (!validKey(key) || !d || typeof d !== 'object') return null;
    return {
      key: key, day: key,
      title: typeof d.title === 'string' ? d.title.slice(0, D.LIMITS.title) : '',
      favorite: d.favorite === true,
      blocks: (Array.isArray(d.blocks) ? d.blocks : []).slice(0, D.LIMITS.blocks).map(cleanBlock).filter(Boolean),
      updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : ''
    };
  }
  function isEmpty(d) {
    return !d || (!d.title.trim() && !d.blocks.some(function (b) { return D.blockHasContent({ text: b.text, tags: b.tags, mood: b.mood, emotions: b.emotions }); }));
  }

  // Lee los borradores del formato de la fase 3 y los pasa al nuevo (una caja de texto = un bloque).
  function upgradeOld(all) {
    var old = null;
    try { old = safeJson(localStorage.getItem(OLD_KEY)); } catch (e) { return all; }
    if (!old || !old.drafts || typeof old.drafts !== 'object') return all;
    Object.keys(old.drafts).forEach(function (k) {
      var d = old.drafts[k];
      if (!d || typeof d !== 'object') return;
      var day = typeof d.date === 'string' && D.isDay(d.date.slice(0, 10)) ? d.date.slice(0, 10) : D.today();
      var block = { id: D.newBlockId(), text: typeof d.text === 'string' ? d.text : '', tags: Array.isArray(d.tags) ? d.tags : [], mood: null };
      var existing = all[day];
      var merged = clean(day, existing
        ? { title: existing.title || d.title, favorite: existing.favorite || d.favorite === true, blocks: existing.blocks.concat([block]), updatedAt: existing.updatedAt }
        : { title: d.title, favorite: d.favorite === true, blocks: [block], updatedAt: d.updatedAt });
      if (merged && !isEmpty(merged)) all[day] = merged;
    });
    try {
      localStorage.setItem(KEY, JSON.stringify({ drafts: all }));
      localStorage.removeItem(OLD_KEY);
    } catch (e) { /* si no se puede escribir, lo antiguo se queda donde está */ }
    return all;
  }

  function readAll() {
    var all = {};
    try {
      var data = safeJson(localStorage.getItem(KEY));
      if (data && data.drafts && typeof data.drafts === 'object') {
        Object.keys(data.drafts).forEach(function (k) { var c = clean(k, data.drafts[k]); if (c) all[k] = c; });
      }
    } catch (e) { return {}; }
    return upgradeOld(all);
  }
  function writeAll(all) {
    try { localStorage.setItem(KEY, JSON.stringify({ drafts: all })); return true; } catch (e) { return false; }
  }

  App.drafts = {
    isEmpty: isEmpty,
    get: function (key) { var all = readAll(); return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null; },

    // Devuelve true si se pudo guardar. Un borrador vacío se elimina.
    save: function (key, data) {
      if (!validKey(key)) return false;
      var all = readAll();
      var d = clean(key, Object.assign({}, data, { updatedAt: new Date().toISOString() }));
      if (isEmpty(d)) delete all[key]; else all[key] = d;
      Object.keys(all).sort(function (a, b) { return all[b].updatedAt < all[a].updatedAt ? -1 : 1; })
        .slice(MAX_DRAFTS).forEach(function (k) { delete all[k]; });
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
      return Object.keys(all).map(function (k) { return all[k]; }).filter(function (d) { return !isEmpty(d); })
        .sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; });
    }
  };
})(window.App = window.App || {});
