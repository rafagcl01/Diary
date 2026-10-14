// Personas: la ficha de una persona, con su historial cronológico de fragmentos y el enlace a cada página original.
(function (App) {
  var D = App.diary, H = App.peopleHtml, esc = App.escapeHtml;
  App.peopleViews = App.peopleViews || {};

  function shell(inner) { return '<div class="view people-view">' + inner + '</div>'; }
  function notFound(root, text) {
    root.innerHTML = shell(App.pageHeader('No encuentro esa ficha', text || '', 'álbum de personas') + '<p><a class="btn secondary" href="#/personas">Volver a Personas</a></p>');
  }

  App.peopleViews.card = {
    render: function (root, id) {
      var repo = D.people(), diary = D.repo();
      if (!repo || !diary) { root.innerHTML = shell(App.pageHeader('Ficha', '', 'álbum de personas') + '<div class="msg" data-kind="info">Conecta tus datos para ver esta ficha. <a href="#/ajustes">Conectar mis datos</a></div>'); return; }
      root.innerHTML = shell('<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>');
      var view = root.querySelector('.people-view');     // los manejadores van aquí, no en `root` (que se reutiliza entre pantallas)

      Promise.all([repo.list(), diary.list()]).then(function (r) {
        var people = r[0], entries = r[1], byId = D.personMap(people), p = byId[id];
        if (!p) { notFound(root, 'Puede que se haya borrado o que el enlace esté mal.'); return; }
        var fragments = D.fragmentsOf(entries, id), newestFirst = false, current = p;

        function starred(f) { return current.highlights.some(function (h) { return h.day === f.day && h.block === f.block.id; }); }
        function paint() {
          var m = H.meta(current), a = H.aliases(current);
          var shown = fragments.slice(); if (newestFirst) shown.reverse();
          var stars = fragments.filter(starred);
          view.innerHTML = (
            '<div class="editbar"><a class="btn secondary" href="#/personas">Volver a Personas</a>' +
              '<a class="btn secondary" href="#/personas/' + esc(current.id) + '/editar">Editar ficha</a></div>' +
            '<article class="card paper sheet person-sheet" aria-label="Ficha de ' + esc(current.name) + '">' +
              '<header class="person-head">' + H.avatar(current, 'large') + '<div class="sheet-titles">' +
                '<h1 id="page-title" class="date-h1" tabindex="-1">' + esc(current.name) + '</h1>' +
                (a ? '<p class="soft">' + a + '</p>' : '') + (m ? '<p class="soft">' + m + '</p>' : '') + '</div></header>' +
              (current.tags.length ? '<ul class="chips" aria-label="Etiquetas">' + current.tags.map(function (t) { return '<li class="chip">#' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
              (current.notes ? '<section aria-labelledby="pn"><h2 id="pn" class="sec-title">Notas</h2>' + App.diaryHtml.paragraphs(current.notes) + '</section>' : '') +
              '<section aria-labelledby="ph"><h2 id="ph" class="sec-title">Recuerdos destacados</h2>' +
                (stars.length ? '<ul class="fragments">' + stars.map(function (f) { return H.fragment(f, byId, id, true); }).join('') + '</ul>'
                  : '<p class="soft">Todavía no has destacado ninguno. Pulsa <b>Destacar</b> en un fragmento del historial para guardarlo aquí.</p>') + '</section>' +
              '<section aria-labelledby="pf"><div class="sec-row"><h2 id="pf" class="sec-title">Historial</h2>' +
                (fragments.length > 1 ? '<button type="button" class="mini" id="p-order" aria-pressed="' + newestFirst + '">' + (newestFirst ? 'Ver primero lo más antiguo' : 'Ver primero lo más reciente') + '</button>' : '') + '</div>' +
                (fragments.length ? '<p class="soft">' + H.plural(fragments.length, 'fragmento', 'fragmentos') + ', en orden ' + (newestFirst ? 'del más reciente al más antiguo' : 'cronológico') + '.</p>' +
                  '<ul class="fragments">' + shown.map(function (f) { return H.fragment(f, byId, id, starred(f)); }).join('') + '</ul>'
                  : '<p class="soft">Todavía no hay entradas vinculadas a esta persona. En el editor del diario, el botón <b>Personas</b> de cada entrada las vincula.</p>') +
              '</section>' +
              '<p class="msg" id="p-msg" role="status" data-kind="info"></p>' +
            '</article>');
          var focus = view.querySelector('#page-title'); if (focus && focus.focus && !paint.done) { paint.done = true; focus.focus(); }
        }
        paint();

        view.addEventListener('click', function (e) {
          var t = e.target; if (!t || !t.closest) return;
          if (t.closest('#p-order')) { newestFirst = !newestFirst; paint(); return; }
          var star = t.closest('[data-star]');
          if (!star) return;
          var parts = star.dataset.star.split('|'), ref = { day: parts[0], block: parts[1] };
          var on = star.getAttribute('aria-pressed') !== 'true';
          star.disabled = true;
          repo.setHighlight(id, ref, on).then(function (updated) { current = updated; paint(); }).catch(function (err) {
            star.disabled = false;
            var msg = view.querySelector('#p-msg'); if (msg) { msg.textContent = err && err.message ? err.message : 'No se pudo guardar.'; msg.setAttribute('data-kind', 'error'); }
          });
        });
      }).catch(function (err) {
        root.innerHTML = shell(App.pageHeader('Ficha', '', 'álbum de personas') + '<div class="msg" data-kind="error">No se pudo cargar. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>');
      });
    }
  };
})(window.App = window.App || {});
