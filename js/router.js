// Router mínimo basado en el hash (#/diario). Funciona abriendo el archivo en local y en GitHub Pages.
(function (App) {
  App.startRouter = function (sections, onRoute) {
    var initial = true;

    function resolve() {
      var id = location.hash.replace(/^#\/?/, '') || sections[0].id;
      var section = sections.filter(function (s) { return s.id === id; })[0] || sections[0];
      onRoute(section, { initial: initial });
      initial = false;
    }

    window.addEventListener('hashchange', resolve);
    resolve();
  };
})(window.App = window.App || {});
