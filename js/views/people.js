// Personas: reparte según la dirección:
//   #/personas                 lista de fichas
//   #/personas/nueva           crear una ficha
//   #/personas/pe_xxxxxxxx     la ficha (con su historial)
//   #/personas/pe_xxxxxxxx/editar
(function (App) {
  var V = App.peopleViews;
  App.views = App.views || {};
  App.views.people = {
    render: function (root, ctx) {
      var D = App.diary, p = (ctx && ctx.params) || [];
      if (p.length === 0) return V.list.render(root);
      if (p.length === 1 && p[0] === 'nueva') return V.form.render(root, null);
      if (D.PERSON_ID_RE.test(p[0] || '')) {
        if (p.length === 1) return V.card.render(root, p[0]);
        if (p.length === 2 && p[1] === 'editar') return V.form.render(root, p[0]);
      }
      root.innerHTML = '<div class="view">' + App.pageHeader('No encuentro esa página', '', 'álbum de personas') +
        '<p><a class="btn secondary" href="#/personas">Volver a Personas</a></p></div>';
    }
  };
})(window.App = window.App || {});
