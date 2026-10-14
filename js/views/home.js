(function (App) {
  var icon = App.icon;

  function greeting() {
    var h = new Date().getHours();
    var base = h >= 6 && h < 13 ? 'Buenos días' : h >= 13 && h < 21 ? 'Buenas tardes' : 'Buenas noches';
    var name = App.prefs.get().name;
    return name ? base + ', ' + App.escapeHtml(name) : base;
  }

  function today() {
    try {
      return new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) {
      return '';
    }
  }

  var moods = ['radiante', 'tranquila', 'normal', 'cansada', 'ansiosa', 'triste', 'enfadada'];
  var faces = moods.map(function (m) {
    return '<span class="face m-' + m + '">' + icon('f-' + m) + '</span>';
  }).join('');

  // Corazón remendado: la seña de identidad. Las estrellitas titilan salvo que se desactiven los efectos.
  var sigil =
    '<svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">' +
      '<path d="M30 52C12 40 8 29 13 22c4.5-6 13-5 17 2 4-7 12.5-8 17-2 5 7 1 18-17 30z" fill="#F08BB5" stroke="#FFF5F8" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M31 25l-4 7 5 3.5-3.5 8" fill="none" stroke="#19131B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path class="sparkle" d="M49 9l1.2 3.3 3.3 1.2-3.3 1.2L49 18l-1.2-3.3-3.3-1.2 3.3-1.2z" fill="#FFF5F8"/>' +
      '<path class="sparkle b" d="M10 12l.9 2.4 2.4.9-2.4.9L10 18.6l-.9-2.4-2.4-.9 2.4-.9z" fill="#C9B9E8"/>' +
    '</svg>';

  App.views = App.views || {};
  App.views.home = {
    render: function (root) {
      root.innerHTML =
        '<div class="view">' +
          App.pageHeader(greeting(), '', today()) +
          App.lace() +
          (App.connection.isConfigured() ? '' :
            '<p class="notice">Todavía no has conectado tus datos. <a href="#/ajustes">Conectar mi repositorio privado</a></p>') +

          '<div class="home-grid">' +
            '<div class="stack">' +
              '<a class="card paper hero glint" href="#/diario/nueva">' +
                icon('bow', 'bow') +
                '<p class="pixel soft">hoja en blanco</p>' +
                '<p class="prompt">Querido diario, hoy…</p>' +
                '<div class="actions">' +
                  '<span class="btn">' + icon('book') + 'Escribir una entrada</span>' +
                  '<span class="soft hint">Dos líneas valen lo mismo que dos páginas.</span>' +
                '</div>' +
              '</a>' +

              '<a class="card stitched mood-card glint" href="#/animo">' +
                '<span class="tag">Pronto</span>' +
                '<h3>¿Cómo te sientes hoy?</h3>' +
                '<p class="soft">Sin escribir nada, si prefieres.</p>' +
                '<div class="row" aria-hidden="true">' + faces + '</div>' +
              '</a>' +
              '<article class="card" id="home-recent"><h3>Entradas recientes</h3><div id="home-recent-body"><p class="soft">Conecta tus datos para ver aquí tus últimas entradas.</p></div></article>' +
            '</div>' +

            '<aside class="card dark" aria-label="Tu personaje">' +
              '<div class="portrait-mini">' +
                '<div class="sigil">' + sigil + '</div>' +
                '<div><p class="level">Nivel 1</p><p class="soft">Tu historia acaba de empezar</p></div>' +
              '</div>' +
              '<div class="thread" role="progressbar" aria-label="Experiencia" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i style="width: 0%"></i></div>' +
              '<p class="soft" style="margin: 8px 0 16px; font-size: .9rem">0 de 100 XP para el nivel 2</p>' +
              '<p class="soft" style="font-size: .85rem; margin-bottom: 8px">Atributos iniciales, a tu gusto</p>' +
              '<div class="chips">' +
                '<span class="chip">Vínculos</span><span class="chip">Creatividad</span><span class="chip">Sabiduría</span><span class="chip">Vitalidad</span><span class="chip">Aventura</span>' +
              '</div>' +
              '<div style="margin-top: 18px"><a class="btn secondary" href="#/personaje">Ver personaje</a></div>' +
            '</aside>' +
          '</div>' +

          '<div class="three">' +
            '<article class="card"><h3>Misiones activas</h3><p>Ninguna activa. Tú decides cuándo empezar una.</p></article>' +
            '<article class="card" id="home-memories"><h3>Hace un año</h3><div id="home-memories-body"><p>Aparecerán recuerdos cuando tengas entradas de años anteriores.</p></div></article>' +
            '<article class="card"><h3>Personas recientes</h3><p>Aquí verás con quién has compartido tus últimos recuerdos.</p></article>' +
          '</div>' +

          '<div class="badges88" aria-label="Detalles decorativos">' +
            '<span class="b88">solo para mí</span><span class="b88">sin anuncios</span><span class="b88">hecho a mano</span><span class="b88">★ 2026 ★</span>' +
          '</div>' +
        '</div>';

      fillDiary(root);
    }
  };

  // Rellena "Entradas recientes" y "Hace un año" si hay datos conectados (no bloquea la pantalla).
  function fillDiary(root) {
    var repo = App.diary && App.diary.repo ? App.diary.repo() : null;
    if (!repo) return;
    var recent = root.querySelector('#home-recent-body'), memo = root.querySelector('#home-memories-body');
    recent.innerHTML = '<div class="skeleton" style="margin: 8px 0"></div><div class="skeleton" style="width: 70%"></div>';
    repo.list().then(function (entries) {
      var D = App.diary, esc = App.escapeHtml;
      if (!recent.isConnected && recent.isConnected !== undefined) return;
      if (!entries.length) {
        recent.innerHTML = '<p class="soft">Todavía no has escrito ninguna.</p><p style="margin-top: 10px"><a class="btn secondary" href="#/diario/nueva">Escribir la primera</a></p>';
      } else {
        recent.innerHTML = '<ul class="mini-list">' + entries.slice(0, 3).map(function (e) {
          return '<li><a href="#/diario/' + esc(e.id) + '"><b>' + esc(D.displayTitle(e)) + '</b><small class="soft">' + esc(D.formatLong(e.date)) + '</small></a></li>';
        }).join('') + '</ul><p style="margin-top: 10px"><a href="#/diario" class="link">Ver todo el diario</a></p>';
      }
      var md = D.nowLocal().slice(5, 10), year = D.nowLocal().slice(0, 4);
      var memories = entries.filter(function (e) { return e.date.slice(5, 10) === md && e.date.slice(0, 4) !== year; }).slice(0, 2);
      if (memories.length) {
        memo.innerHTML = memories.map(function (e) {
          return '<a class="memory" href="#/diario/' + esc(e.id) + '"><span class="margin-note">' + esc(D.formatLong(e.date)) + '</span>' +
            '<span>' + esc(D.excerpt(e, 130)) + '</span></a>';
        }).join('');
      }
    }).catch(function () {
      recent.innerHTML = '<p class="soft">No se pudieron cargar tus entradas ahora mismo.</p>';
    });
  }
})(window.App = window.App || {});
