// Preferencias de la interfaz (nombre, efectos, tema).
// Se guardan solo en este navegador. NO son datos del diario.
(function (App) {
  var KEY = 'diario-rpg.prefs.v1';
  var MOTION = ['auto', 'on', 'off'];
  var THEME = ['auto', 'light', 'dark'];
  var cache = null;

  function get() {
    if (!cache) {
      var stored = {};
      try {
        stored = JSON.parse(localStorage.getItem(KEY)) || {};
      } catch (e) {
        stored = {};
      }
      cache = {
        name: typeof stored.name === 'string' ? stored.name : '',
        motion: MOTION.indexOf(stored.motion) >= 0 ? stored.motion : 'auto',
        theme: THEME.indexOf(stored.theme) >= 0 ? stored.theme : 'auto'
      };
    }
    return { name: cache.name, motion: cache.motion, theme: cache.theme };
  }

  // Devuelve true si se pudo guardar en el navegador.
  function set(patch) {
    var next = get();
    for (var k in patch) next[k] = patch[k];
    cache = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
      return true;
    } catch (e) {
      return false;
    }
  }

  function apply() {
    var p = get(), root = document.documentElement;
    root.dataset.motion = p.motion;
    if (p.theme === 'auto') {
      if (root.removeAttribute) root.removeAttribute('data-theme');
      else delete root.dataset.theme;
    } else {
      root.dataset.theme = p.theme;
    }
  }

  App.prefs = { get: get, set: set, apply: apply, MOTION: MOTION, THEME: THEME };
})(window.App = window.App || {});
