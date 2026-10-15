// Misiones: reparte según la dirección:
//   #/misiones               tus misiones
//   #/misiones/actividades   actividades (registro rápido, poca XP)
(function (App) {
  App.views = App.views || {};
  App.views.quests = {
    render: function (root, ctx) {
      var p = (ctx && ctx.params) || [], tab = p[0] === 'actividades' ? 'actividades' : 'misiones';
      root.innerHTML = '<div class="view quests-view">' +
        App.pageHeader('Misiones', 'Misiones, actividades y retos que decides tú.', 'grimorio de misiones') + App.lace() +
        '<nav class="tabs" aria-label="Misiones y actividades">' +
          '<a class="tab" href="#/misiones"' + (tab === 'misiones' ? ' aria-current="page"' : '') + '>Misiones</a>' +
          '<a class="tab" href="#/misiones/actividades"' + (tab === 'actividades' ? ' aria-current="page"' : '') + '>Actividades</a></nav>' +
        '<div id="q-host"></div></div>';
      var host = root.querySelector('#q-host');
      if (tab === 'actividades') App.rpgViews.activities.render(host); else App.rpgViews.missions.render(host);
    }
  };
})(window.App = window.App || {});
