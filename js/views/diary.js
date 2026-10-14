// Diario: reparte según la dirección (#/diario, #/diario/nueva, #/diario/<id>, #/diario/<id>/editar).
(function (App) {
  var V = App.diaryViews;

  App.views = App.views || {};
  App.views.diary = {
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || [];
      if (p.length === 0) return V.list.render(root);
      if (p.length === 1 && p[0] === 'nueva') return V.editor.render(root, null);
      if (App.diary.isEntryId(p[0]) && p.length === 1) return V.read.render(root, p[0]);
      if (App.diary.isEntryId(p[0]) && p.length === 2 && p[1] === 'editar') return V.editor.render(root, p[0]);
      root.innerHTML = '<div class="view">' + App.pageHeader('No encuentro esa página', '', 'cuaderno privado') +
        '<p><a class="btn secondary" href="#/diario">Volver al diario</a></p></div>';
    }
  };
})(window.App = window.App || {});
