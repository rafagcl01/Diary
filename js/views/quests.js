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
          text: 'Las crearás tú y, al completarlas, repartirán experiencia entre tus atributos. Llega en la siguiente fase.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
