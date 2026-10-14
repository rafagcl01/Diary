// Diario: reparte según la dirección:
//   #/diario                        cronología
//   #/diario/hoy                    escribir (o seguir escribiendo) hoy, con un bloque nuevo
//   #/diario/AAAA-MM-DD             leer ese día
//   #/diario/AAAA-MM-DD/editar      editar ese día (o crearlo)
//   #/diario/AAAA-MM-DD/editar/nuevo  editar ese día abriendo un bloque nuevo
(function (App) {
  var V = App.diaryViews;

  App.views = App.views || {};
  App.views.diary = {
    render: function (root, ctx) {
      var D = App.diary, p = (ctx && ctx.params) || [];
      if (p.length === 0) return V.list.render(root);
      if (p.length === 1 && p[0] === 'hoy') return V.editor.render(root, D.today(), { addBlock: true });
      if (D.isDay(p[0])) {
        if (p.length === 1) return V.read.render(root, p[0]);
        if (p.length === 2 && p[1] === 'editar') return V.editor.render(root, p[0], {});
        if (p.length === 3 && p[1] === 'editar' && p[2] === 'nuevo') return V.editor.render(root, p[0], { addBlock: true });
      }
      root.innerHTML = '<div class="view">' + App.pageHeader('No encuentro esa página', '', 'cuaderno privado') +
        '<p><a class="btn secondary" href="#/diario">Volver al diario</a></p></div>';
    }
  };
})(window.App = window.App || {});
