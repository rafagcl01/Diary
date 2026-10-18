// Diario: la página de un día. La fecha y el título van dentro de la propia hoja, con el porcentaje de ánimo arriba,
// y debajo todas las entradas del día en orden, cada una con su estado, sus emociones, sus personas y sus etiquetas.
(function (App) {
  var D = App.diary, H = App.diaryHtml, P = App.percentUi, esc = App.escapeHtml;
  App.diaryViews = App.diaryViews || {};

  // Hoja con la fecha arriba y un cuerpo cualquiera (carga, avisos, errores).
  function shell(day, body) {
    return '<div class="view day-page"><article class="card paper sheet">' + H.sheetHead(day, '', '') + body + '</article></div>';
  }

  App.diaryViews.read = {
    render: function (root, day) {
      var repo = D.repo(), emoRepo = D.emotions(), pplRepo = D.people();
      var back = '<p class="btn-row"><a class="btn secondary" href="#/diario">Volver al diario</a></p>';

      if (!repo) {
        root.innerHTML = shell(day, '<h2 class="sheet-note">Conecta tus datos para leer esta página</h2>' +
          '<p class="soft">Tu diario vive en tu repositorio privado de GitHub.</p><p class="btn-row"><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></p>');
        return;
      }
      root.innerHTML = shell(day, '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>');

      function paint(entry, list, byId, peopleById, actsById) {
        root.innerHTML = '<div class="view day-page read-view">' +
          H.pageNav(D.neighbors(list, day)) +
          '<div class="btn-row page-actions">' +
            '<a class="btn" href="#/diario/' + esc(day) + '/editar/nuevo">Escribir una entrada</a>' +
            '<a class="btn secondary" href="#/diario/' + esc(day) + '/editar">Editar la página</a>' +
            '<button type="button" class="btn secondary" id="r-fav" aria-pressed="' + entry.favorite + '">' + (entry.favorite ? 'Quitar de favoritas' : 'Marcar como favorita') + '</button>' +
            '<button type="button" class="btn secondary" id="r-del">Eliminar la página</button>' +
          '</div>' +
          '<p class="msg" id="r-msg" role="status" data-kind="info"></p>' +
          H.sheet(entry, byId, peopleById, actsById) +
          '<dialog class="confirm" id="r-dialog" aria-labelledby="r-dialog-title">' +
            '<h3 id="r-dialog-title">¿Eliminar esta página?</h3>' +
            '<p>Se borran todas las entradas de este día de tu repositorio de datos. GitHub conserva el historial de cambios, pero la aplicación no podrá recuperarlas.</p>' +
            '<div class="btn-row"><button type="button" class="btn" id="r-confirm">Eliminar</button><button type="button" class="btn secondary" id="r-cancel">Cancelar</button></div>' +
          '</dialog></div>';

        function $(sel) { return root.querySelector(sel); }
        function say(text, kind) { var m = $('#r-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
        P.paint($('#pct-slot'), D.dayMood(entry), day, { fromZero: true });

        $('#r-fav').addEventListener('click', function () {
          say('Guardando…', 'info');
          repo.save(Object.assign({}, entry, { favorite: !entry.favorite }), { base: entry.updatedAt })
            .then(function (updated) { return repo.list().then(function (l) { paint(updated, l, byId, peopleById, actsById); }); })
            .catch(function (err) { say(err.message, 'error'); });
        });
        $('#r-del').addEventListener('click', function () { $('#r-dialog').showModal(); });
        $('#r-cancel').addEventListener('click', function () { $('#r-dialog').close(); });
        $('#r-confirm').addEventListener('click', function () {
          $('#r-dialog').close();
          say('Eliminando…', 'info');
          repo.remove(day).then(function () {
            App.drafts.remove(day);
            location.hash = '#/diario';
          }).catch(function (err) { say(err.message, 'error'); });
        });
      }

      // Las emociones son un extra: si no se pueden cargar, la página se muestra igual.
      var emotions = emoRepo ? emoRepo.list().catch(function () { return []; }) : Promise.resolve([]);
      var people = pplRepo ? pplRepo.list().catch(function () { return []; }) : Promise.resolve([]);
      var actRepo = App.rpg && App.rpg.activities ? App.rpg.activities() : null;
      var acts = actRepo ? actRepo.list().catch(function () { return []; }) : Promise.resolve([]);
      Promise.all([repo.list(), emotions, people, acts]).then(function (r) {
        var list = r[0], entry = null;
        list.forEach(function (e) { if (e.day === day) entry = e; });
        if (!entry) {
          root.innerHTML = shell(day, '<h2 class="sheet-note">Todavía no hay nada escrito este día</h2><p class="btn-row"><a class="btn" href="#/diario/' + esc(day) + '/editar">Escribir ese día</a>' +
            '<a class="btn secondary" href="#/diario">Volver al diario</a></p>');
          return;
        }
        var actsById = {}; r[3].forEach(function (a) { actsById[a.id] = a; });
        paint(entry, list, D.emotionMap(r[1]), D.personMap(r[2]), actsById);
      }).catch(function (err) {
        root.innerHTML = shell(day, '<div class="msg" data-kind="error">No se pudo cargar. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>' + back);
      });
    }
  };
})(window.App = window.App || {});
