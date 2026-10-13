(function (App) {
  App.views = App.views || {};
  App.views.collection = {
    render: function (root) {
      root.innerHTML = '<div class="view">' +
        App.pageHeader('Colección y recuerdos', 'Recompensas, hitos y recuerdos de otros años.', 'caja de recuerdos') +
        App.lace() +
        App.emptyState({
          icon: 'locket',
          title: 'Tu colección está vacía',
          text: 'Se activa entre las fases 7 y 8.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
