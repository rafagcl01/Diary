(function (App) {
  App.views = App.views || {};
  App.views.collection = {
    render: function (root) {
      root.innerHTML = '<div class="view">' +
        App.pageHeader('Colección', 'Tus logros, títulos y recompensas.', 'caja de tesoros') +
        App.lace() +
        App.emptyState({
          icon: 'locket',
          title: 'Tu colección está vacía',
          text: 'Aquí irán los logros, títulos y adornos que desbloquees. No hay moneda: solo se consiguen cumpliendo condiciones.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
