// Diario: lectura de la entrada de un día (cada bloque con su texto, su ánimo y sus etiquetas).
(function (App) {
  var D = App.diary, H = App.diaryHtml, esc = App.escapeHtml;
  App.diaryViews = App.diaryViews || {};

  function page(title, note, body) { return '<div class="view">' + App.pageHeader(title, '', note) + App.lace() + body + '</div>'; }

  App.diaryViews.read = {
    render: function (root, day) {
      var repo = D.repo();
      var back = '<p><a class="btn secondary" href="#/diario">Volver al diario</a></p>';
      var longDate = esc(D.formatLong(day));

      if (!repo) {
        root.innerHTML = page('Entrada del día', longDate,
          '<section class="card stitched empty"><div class="empty-icon">' + App.icon('book') + '</div><h2>Conecta tus datos para leer esta entrada</h2>' +
          '<p>Las entradas viven en tu repositorio privado de GitHub.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>');
        return;
      }
      root.innerHTML = page('Cargando…', longDate, '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>');

      function paint(entry) {
        root.innerHTML = '<div class="view read-view">' +
          App.pageHeader(esc(D.displayTitle(entry)), '', entry.title ? longDate : '') +
          '<div class="btn-row page-actions">' +
            '<a class="btn secondary" href="#/diario">Volver al diario</a>' +
            '<a class="btn" href="#/diario/' + esc(entry.day) + '/editar/nuevo">Añadir bloque</a>' +
            '<a class="btn secondary" href="#/diario/' + esc(entry.day) + '/editar">Editar</a>' +
            '<button type="button" class="btn secondary" id="r-fav" aria-pressed="' + entry.favorite + '">' + (entry.favorite ? 'Quitar de favoritos' : 'Marcar como favorito') + '</button>' +
            '<button type="button" class="btn secondary" id="r-del">Eliminar</button>' +
          '</div>' +
          '<p class="msg" id="r-msg" role="status" data-kind="info"></p>' +
          H.sheet(entry) +
          '<dialog class="confirm" id="r-dialog" aria-labelledby="r-dialog-title">' +
            '<h3 id="r-dialog-title">¿Eliminar este día?</h3>' +
            '<p>Se borran todos los bloques de este día de tu repositorio de datos. GitHub conserva el historial de cambios, pero la aplicación no podrá recuperarlos.</p>' +
            '<div class="btn-row"><button type="button" class="btn" id="r-confirm">Eliminar</button><button type="button" class="btn secondary" id="r-cancel">Cancelar</button></div>' +
          '</dialog></div>';

        function $(sel) { return root.querySelector(sel); }
        function say(text, kind) { var m = $('#r-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }

        $('#r-fav').addEventListener('click', function () {
          say('Guardando…', 'info');
          repo.save(Object.assign({}, entry, { favorite: !entry.favorite }), { base: entry.updatedAt }).then(paint)
            .catch(function (err) { say(err.message, 'error'); });
        });
        $('#r-del').addEventListener('click', function () { $('#r-dialog').showModal(); });
        $('#r-cancel').addEventListener('click', function () { $('#r-dialog').close(); });
        $('#r-confirm').addEventListener('click', function () {
          $('#r-dialog').close();
          say('Eliminando…', 'info');
          repo.remove(entry.day).then(function () {
            App.drafts.remove(entry.day);
            location.hash = '#/diario';
          }).catch(function (err) { say(err.message, 'error'); });
        });
      }

      repo.get(day).then(function (entry) {
        if (!entry) {
          root.innerHTML = page('No hay entrada este día', longDate,
            '<p class="soft">Todavía no escribiste nada ese día.</p><p class="btn-row"><a class="btn" href="#/diario/' + esc(day) + '/editar">Escribir ese día</a><a class="btn secondary" href="#/diario">Volver al diario</a></p>');
          return;
        }
        paint(entry);
      }).catch(function (err) {
        root.innerHTML = page('No se pudo cargar', longDate, '<div class="msg" data-kind="error">' + esc(err.message || 'Inténtalo de nuevo.') + '</div>' + back);
      });
    }
  };
})(window.App = window.App || {});
