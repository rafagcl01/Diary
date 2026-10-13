(function (App) {
  App.views = App.views || {};
  App.views.people = {
    render: function (root) {
      root.innerHTML = '<div class="view">' +
        App.pageHeader('Personas', 'Fichas de la gente de tu vida y los recuerdos que compartes con cada una.', 'álbum de personas') +
        App.lace() +
        App.emptyState({
          icon: 'people',
          title: 'Todavía no hay fichas',
          text: 'Podrás crear fichas y vincular párrafos concretos de tus entradas a cada persona. Se activa en la fase 4.'
        }) +
        '</div>';
    }
  };
})(window.App = window.App || {});
