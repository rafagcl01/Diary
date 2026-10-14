// Diario: lectura de una entrada (solo el texto; los controles quedan fuera de la hoja).
(function (App) {
  var D = App.diary, H = App.diaryHtml, esc = App.escapeHtml;
  App.diaryViews = App.diaryViews || {};

  function simplePage(title, note, body) {
    return '<div class="view">' + App.pageHeader(title, '', note) + App.lace() + body + '</div>';
  }

  App.diaryViews.read = {
    render: function (root, id) {
      var repo = D.repo();
      var back = '<p><a class="btn secondary" href="#/diario">Volver al diario</a></p>';

      if (!repo) {
        root.innerHTML = simplePage('Entrada', 'cuaderno privado',
          '<section class="card stitched empty"><div class="empty-icon">' + App.icon('book') + '</div><h2>Conecta tus datos para leer esta entrada</h2>' +
          '<p>Las entradas viven en tu repositorio privado de GitHub.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>');
        return;
      }

      root.innerHTML = simplePage('Cargando…', 'cuaderno privado', '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>');

      function paint(entry) {
        root.innerHTML = '<div class="view read-view">' +
          App.pageHeader(esc(D.displayTitle(entry)), '', esc(D.formatLong(entry.date) + ', ' + D.formatTime(entry.date))) +
          '<div class="btn-row page-actions">' +
            '<a class="btn secondary" href="#/diario">Volver al diario</a>' +
            '<a class="btn" href="#/diario/' + esc(entry.id) + '/editar">Editar</a>' +
            '<button type="button" class="btn secondary" id="r-fav" aria-pressed="' + entry.favorite + '">' + (entry.favorite ? 'Quitar de favoritas' : 'Marcar como favorita') + '</button>' +
            '<button type="button" class="btn secondary" id="r-del">Eliminar</button>' +
          '</div>' +
          '<p class="msg" id="r-msg" role="status" data-kind="info"></p>' +
          H.sheet(entry) +
          '<dialog class="confirm" id="r-dialog" aria-labelledby="r-dialog-title">' +
            '<h3 id="r-dialog-title">¿Eliminar esta entrada?</h3>' +
            '<p>Se borra el texto de tu repositorio de datos. GitHub conserva el historial de cambios, pero la aplicación no podrá recuperarla.</p>' +
            '<div class="btn-row"><button type="button" class="btn" id="r-confirm">Eliminar</button><button type="button" class="btn secondary" id="r-cancel">Cancelar</button></div>' +
          '</dialog></div>';

        var view = root.querySelector('.read-view');
        function $(sel) { return root.querySelector(sel); }
        function say(text, kind) { var m = $('#r-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }

        $('#r-fav').addEventListener('click', function () {
          say('Guardando…', 'info');
          repo.save(Object.assign({}, entry, { favorite: !entry.favorite })).then(paint)
            .catch(function (err) { say(err.message, 'error'); });
        });
        $('#r-del').addEventListener('click', function () { $('#r-dialog').showModal(); });
        $('#r-cancel').addEventListener('click', function () { $('#r-dialog').close(); });
        $('#r-confirm').addEventListener('click', function () {
          $('#r-dialog').close();
          say('Eliminando…', 'info');
          repo.remove(entry.id).then(function () {
            App.drafts.remove(entry.id);
            location.hash = '#/diario';
          }).catch(function (err) { say(err.message, 'error'); });
        });
        void view;
      }

      repo.get(id).then(function (entry) {
        if (!entry) {
          root.innerHTML = simplePage('No encuentro esta entrada', 'cuaderno privado',
            '<p class="soft">Puede que la hayas eliminado o que aún no se haya cargado desde otro dispositivo.</p>' + back);
          return;
        }
        paint(entry);
      }).catch(function (err) {
        root.innerHTML = simplePage('No se pudo cargar', 'cuaderno privado',
          '<div class="msg" data-kind="error">' + esc(err.message || 'Inténtalo de nuevo.') + '</div>' + back);
      });
    }
  };
})(window.App = window.App || {});
