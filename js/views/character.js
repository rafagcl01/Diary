(function (App) {
  App.views = App.views || {};
  App.views.character = {
    render: function (root) {
      root.innerHTML = '<div class="view">' +
        App.pageHeader('Tu personaje', 'Tu nivel, tus atributos y tu progreso.', 'ficha de personaje') +
        App.lace() +
        App.emptyState({
          icon: 'star',
          title: 'Tu personaje empieza en el nivel 1',
          text: 'El sistema de experiencia se activa en la fase 6. Nunca se perderá XP ni nivel.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
