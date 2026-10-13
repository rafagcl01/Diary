(function (App) {
  App.views = App.views || {};
  App.views.quests = {
    render: function (root) {
      root.innerHTML = '<div class="view">' +
        App.pageHeader('Misiones', 'Misiones, aventuras y retos que decides tú.', 'grimorio de misiones') +
        App.lace() +
        App.emptyState({
          icon: 'grim',
          title: 'No hay misiones',
          text: 'Las crearás tú; las sugerencias serán siempre opcionales. Se activa en la fase 7.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
