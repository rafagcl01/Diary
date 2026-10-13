(function (App) {
  App.views = App.views || {};
  App.views.diary = {
    render: function (root) {
      root.innerHTML = '<div class="view">' +
        App.pageHeader('Diario', 'Tus entradas, con búsqueda, calendario y borradores.', 'cuaderno privado') +
        App.lace() +
        App.emptyState({
          icon: 'book',
          title: 'Aquí vivirán tus entradas',
          text: 'Dos líneas o dos páginas: las dos cuentan igual. Escribir se activa en la fase 3.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
