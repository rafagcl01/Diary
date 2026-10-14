// Personas: la lista de fichas, con búsqueda. Orden alfabético por defecto; sin rankings.
(function (App) {
  var D = App.diary, H = App.peopleHtml, esc = App.escapeHtml;
  App.peopleViews = App.peopleViews || {};

  App.peopleViews.list = {
    render: function (root) {
      var repo = D.people(), diary = D.repo();
      root.innerHTML = '<div class="view people-view">' +
        App.pageHeader('Personas', 'Fichas de la gente de tu vida y los recuerdos que compartes con cada una.', 'álbum de personas') +
        '<div class="btn-row page-actions"><a class="btn" href="#/personas/nueva">Nueva persona</a></div>' +
        App.lace() +
        '<div class="toolbar">' +
          '<label class="searchbox"><span class="sr">Buscar personas</span><input id="p-q" type="search" placeholder="Buscar por nombre, apodo, relación o etiqueta" autocomplete="off" spellcheck="false"></label>' +
          '<label class="field inline"><span class="sr">Orden</span><select id="p-sort"><option value="name">Por nombre</option><option value="recent">Con recuerdos recientes primero</option></select></label>' +
        '</div>' +
        '<p id="p-summary" class="soft summary" role="status"></p>' +
        '<div id="p-list"></div></div>';
      var $ = function (s) { return root.querySelector(s); };
      var list = $('#p-list');

      if (!repo) {
        list.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + App.icon('people') + '</div><h2>Conecta tus datos para ver tus fichas</h2>' +
          '<p>Las fichas se guardan en tu repositorio de datos, junto al diario.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>';
        return;
      }
      list.innerHTML = '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>';
      var state = { people: [], act: {} };

      function paint() {
        var found = D.searchPeople(state.people, $('#p-q').value);
        if ($('#p-sort').value === 'recent') {
          found = found.slice().sort(function (a, b) {
            var x = (state.act[a.id] && state.act[a.id].last) || '', y = (state.act[b.id] && state.act[b.id].last) || '';
            return x < y ? 1 : x > y ? -1 : 0;
          });
        }
        $('#p-summary').textContent = state.people.length ? (found.length === state.people.length ? H.plural(found.length, 'persona', 'personas') : found.length + ' de ' + state.people.length) : '';
        if (!state.people.length) {
          list.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + App.icon('people') + '</div><h2>Todavía no hay fichas</h2>' +
            '<p>Crea la primera y, al escribir, vincula a ella los momentos que quieras recordar. Todo es opcional y puedes cambiarlo cuando quieras.</p>' +
            '<a class="btn" href="#/personas/nueva">Crear la primera ficha</a></section>';
        } else if (!found.length) {
          list.innerHTML = '<p class="soft">Ninguna ficha coincide con esa búsqueda.</p>';
        } else {
          list.innerHTML = '<ul class="people-list">' + found.map(function (p) { return H.item(p, state.act[p.id]); }).join('') + '</ul>';
        }
      }
      var activity = diary ? diary.list().then(function (entries) { return D.peopleActivity(entries); }).catch(function () { return {}; }) : Promise.resolve({});
      Promise.all([repo.list(), activity]).then(function (r) {
        state.people = r[0]; state.act = r[1]; paint();
      }).catch(function (err) {
        list.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las fichas. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>';
      });
      $('#p-q').addEventListener('input', paint);
      $('#p-sort').addEventListener('change', paint);
    }
  };
})(window.App = window.App || {});
