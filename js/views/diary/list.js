// Diario: cronología (un día por entrada), búsqueda, filtros y calendario.
(function (App) {
  var D = App.diary, H = App.diaryHtml, esc = App.escapeHtml;
  App.diaryViews = App.diaryViews || {};

  var SKELETON = '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 80%; margin-bottom: 14px"></div><div class="skeleton" style="width: 60%"></div>';
  function emptyQuery() { return { text: '', tags: [], mood: '', favoritesOnly: false, day: '', from: '', to: '' }; }

  App.diaryViews.list = {
    render: function (root) {
      var now = new Date();
      var state = {
        entries: [], problems: [], legacy: { months: [], count: 0 }, loaded: false, error: '', disconnected: false, shown: 40, firstLoad: true,
        y: now.getFullYear(), m: now.getMonth(), q: emptyQuery()
      };
      var todayKey = D.today();

      root.innerHTML = '<div class="view diary-view">' +
        App.pageHeader('Diario', '', 'cuaderno privado') +
        '<div class="btn-row page-actions">' +
          '<a class="btn" href="#/diario/hoy">Escribir una entrada hoy</a>' +
          '<label class="otherday"><span class="sr">Escribir en otra fecha</span><input id="other-day" type="date" max="' + todayKey + '"></label>' +
          '<button type="button" class="btn secondary" id="other-go">Escribir en esa fecha</button>' +
        '</div>' +
        App.lace() +
        '<div id="drafts"></div><div id="legacy"></div>' +
        '<div class="toolbar">' +
          '<label class="searchbox"><span class="sr">Buscar en el diario</span>' +
            '<input id="q" type="search" placeholder="Buscar en el diario" autocomplete="off" spellcheck="false"></label>' +
          '<button type="button" class="chip" id="f-fav" aria-pressed="false">Favoritos</button>' +
          '<details class="more-filters"><summary>Más filtros</summary>' +
            '<div class="filters-grid">' +
              '<label class="field"><span>Desde</span><input id="f-from" type="date"></label>' +
              '<label class="field"><span>Hasta</span><input id="f-to" type="date"></label>' +
              '<button type="button" class="btn secondary" id="f-clear">Limpiar filtros</button>' +
            '</div>' +
            '<div class="mood-filter" role="group" aria-label="Filtrar por estado de ánimo">' +
              D.MOODS.map(function (m) {
                return '<button type="button" class="chip" data-mood-filter="' + m.id + '" aria-pressed="false">' + H.face(m.id, 'tiny') + esc(m.label) + '</button>';
              }).join('') +
            '</div></details>' +
        '</div>' +
        '<div id="tags" class="chips tagbar"></div>' +
        '<p id="summary" class="soft summary" role="status"></p>' +
        '<div class="diary-grid"><div id="list"></div><aside id="cal-wrap" aria-label="Calendario"></aside></div>' +
        '</div>';

      var view = root.querySelector('.diary-view');
      function $(sel) { return root.querySelector(sel); }

      function filtersActive() {
        var q = state.q;
        return !!(q.text.trim() || q.tags.length || q.mood || q.favoritesOnly || q.day || q.from || q.to);
      }
      function paintDrafts() { $('#drafts').innerHTML = H.drafts(App.drafts.list()); }
      function paintLegacy() { $('#legacy').innerHTML = H.legacy(state.legacy); }

      function paintTags() {
        var selected = state.q.tags.map(D.fold);
        $('#tags').innerHTML = D.allTags(state.entries).slice(0, 12).map(function (t) {
          return '<button type="button" class="chip" data-tag="' + esc(t.tag) + '" aria-pressed="' + (selected.indexOf(D.fold(t.tag)) >= 0) + '">#' + esc(t.tag) + ' <small>' + t.count + '</small></button>';
        }).join('');
      }
      function paintCal() {
        $('#cal-wrap').innerHTML = H.calendar(D.monthGrid(state.y, state.m, state.entries), todayKey);
      }

      function paintList() {
        var box = $('#list'), summary = $('#summary');
        if (state.disconnected) {
          summary.textContent = '';
          box.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + App.icon('book') + '</div>' +
            '<h2>Conecta tus datos para ver tus páginas</h2>' +
            '<p>Tu diario vive en tu repositorio privado de GitHub. Puedes escribir ya: el texto se guarda como borrador en este navegador hasta que conectes.</p>' +
            '<a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>';
          return;
        }
        if (state.error) {
          summary.textContent = '';
          box.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar tus entradas. ' + esc(state.error) + '</div>' +
            '<p style="margin-top: 14px"><button type="button" class="btn secondary" id="retry">Reintentar</button></p>';
          return;
        }
        if (!state.loaded) { summary.textContent = ''; box.innerHTML = SKELETON; return; }
        if (!state.entries.length) {
          summary.textContent = '';
          box.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + App.icon('book') + '</div>' +
            '<h2>Todavía no hay páginas</h2><p>Cuando quieras, empieza con una entrada de dos líneas. Valen lo mismo que dos folios.</p>' +
            '<a class="btn" href="#/diario/hoy">Escribir hoy</a></section>';
          return;
        }
        var found = D.search(state.entries, state.q);
        summary.textContent = filtersActive()
          ? (found.length ? 'Mostrando ' + found.length + ' de ' + state.entries.length + ' páginas.' : 'Ninguna página coincide con esos filtros.')
          : state.entries.length + (state.entries.length === 1 ? ' página.' : ' páginas.');
        box.innerHTML = (state.problems.length
          ? '<p class="msg" data-kind="error">Hay ' + state.problems.length + ' archivo(s) del diario que no se pueden leer del todo. No se ha tocado nada; puedes revisarlos en GitHub.</p>' : '') +
          (found.length ? H.list(found, state.shown) : '');
      }

      function paintAll() { paintDrafts(); paintLegacy(); paintTags(); paintCal(); paintList(); }
      function setFilter(fn) { fn(state.q); state.shown = 40; paintTags(); paintCal(); paintList(); }

      function load(force) {
        var repo = D.repo();
        state.error = ''; state.disconnected = !repo; state.loaded = !repo;
        paintAll();
        if (!repo) return;
        repo.list(force).then(function (entries) {
          state.entries = entries; state.problems = repo.problems(); state.legacy = repo.legacy(); state.loaded = true;
          if (state.firstLoad && entries.length) {
            var latest = D.parseDay(entries[0].day);
            if (latest) { state.y = latest.getFullYear(); state.m = latest.getMonth(); }
          }
          state.firstLoad = false;
          paintAll();
        }).catch(function (err) {
          state.error = err && err.message ? err.message : 'Inténtalo de nuevo.'; state.loaded = true; paintAll();
        });
      }

      view.addEventListener('click', function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var nav = t.closest('[data-nav]'), tag = t.closest('[data-tag]'), mood = t.closest('[data-mood-filter]');
        if (nav) {
          state.m += Number(nav.dataset.nav);
          if (state.m < 0) { state.m = 11; state.y--; } else if (state.m > 11) { state.m = 0; state.y++; }
          paintCal(); return;
        }
        if (tag) {
          setFilter(function (q) {
            var k = D.fold(tag.dataset.tag), i = q.tags.map(D.fold).indexOf(k);
            if (i >= 0) q.tags.splice(i, 1); else q.tags.push(tag.dataset.tag);
          });
          return;
        }
        if (mood) {
          setFilter(function (q) { q.mood = q.mood === mood.dataset.moodFilter ? '' : mood.dataset.moodFilter; });
          view.querySelectorAll('[data-mood-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.moodFilter === state.q.mood)); });
          return;
        }
        if (t.closest('#f-fav')) {
          setFilter(function (q) { q.favoritesOnly = !q.favoritesOnly; });
          $('#f-fav').setAttribute('aria-pressed', String(state.q.favoritesOnly)); return;
        }
        if (t.closest('#f-clear')) {
          state.q = emptyQuery();
          $('#q').value = ''; $('#f-from').value = ''; $('#f-to').value = ''; $('#f-fav').setAttribute('aria-pressed', 'false');
          view.querySelectorAll('[data-mood-filter]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          state.shown = 40; paintTags(); paintCal(); paintList(); return;
        }
        if (t.closest('#show-more')) { state.shown += 40; paintList(); return; }
        if (t.closest('#retry')) { load(true); return; }
        if (t.closest('#other-go')) {
          var picked = $('#other-day').value;
          if (D.isDay(picked) && picked <= todayKey) location.hash = '#/diario/' + picked + '/editar';
          else $('#other-day').focus();
          return;
        }
        if (t.closest('#migrate')) {
          var repo = D.repo(), msg = $('#migrate-msg');
          if (!repo) return;
          t.closest('#migrate').disabled = true;
          msg.textContent = 'Actualizando…';
          repo.migrateLegacy().then(function (r) {
            load(true);
          }).catch(function (err) { msg.textContent = err.message; msg.setAttribute('data-kind', 'error'); t.closest('#migrate').disabled = false; });
          return;
        }
        var discard = t.closest('[data-draft-discard]');
        if (discard && window.confirm('¿Descartar este borrador? El texto sin guardar se perderá.')) {
          App.drafts.remove(discard.dataset.draftDiscard); paintDrafts();
        }
      });

      var timer;
      $('#q').addEventListener('input', function (e) {
        clearTimeout(timer);
        var value = e.target.value;
        timer = setTimeout(function () { setFilter(function (q) { q.text = value; }); }, 150);
      });
      $('#f-from').addEventListener('change', function (e) { setFilter(function (q) { q.from = e.target.value; }); });
      $('#f-to').addEventListener('change', function (e) { setFilter(function (q) { q.to = e.target.value; }); });

      load(false);
    }
  };
})(window.App = window.App || {});
