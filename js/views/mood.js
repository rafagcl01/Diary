(function (App) {
  App.views = App.views || {};
  App.views.mood = {
    render: function (root) {
      root.innerHTML = '<div class="view">' +
        App.pageHeader('Estado de ánimo', 'Registro rápido de cómo te sientes, con actividades y calendario.', 'sin escribir nada, si quieres') +
        App.lace() +
        App.emptyState({
          icon: 'mood',
          title: 'Sin registros todavía',
          text: 'Elegirás un ánimo en dos toques. Ningún ánimo vale más que otro. Se activa en la fase 5.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
