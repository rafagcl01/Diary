// Router mínimo basado en el hash (#/diario). Funciona abriendo el archivo en local y en GitHub Pages.
(function (App) {
  function safeDecode(part) {
    try { return decodeURIComponent(part); } catch (e) { return part; }
  }

  // "#/diario/e_abc/editar" => { section: "diario", params: ["e_abc", "editar"] }
  App.parseHash = function (hash) {
    var parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(safeDecode);
    return { section: parts[0] || '', params: parts.slice(1) };
  };

  App.startRouter = function (sections, onRoute) {
    var initial = true;

    function resolve() {
      var route = App.parseHash(location.hash);
      var section = sections.filter(function (s) { return s.id === route.section; })[0] || sections[0];
      onRoute(section, { initial: initial, params: section.id === route.section ? route.params : [] });
      initial = false;
    }

    window.addEventListener('hashchange', resolve);
    resolve();
  };
})(window.App = window.App || {});
