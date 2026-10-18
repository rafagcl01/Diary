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
              '<a class="card paper hero glint" href="#/diario/hoy">' +
                icon('bow', 'bow') +
                '<p class="pixel soft">hoja en blanco</p>' +
                '<p class="prompt">Querido diario, hoy…</p>' +
                '<div class="actions">' +
                  '<span class="btn">' + icon('book') + 'Escribir una entrada</span>' +
                  '<span class="soft hint">Dos líneas valen lo mismo que dos folios.</span>' +
                '</div>' +
              '</a>' +

              '<section class="card stitched mood-card" aria-labelledby="home-mood-title">' +
                '<h3 id="home-mood-title">¿Cómo te sientes hoy?</h3>' +
                '<p class="soft">Se añade como una entrada nueva en la página de hoy, sin escribir nada si prefieres.</p>' +
                '<div class="moods" role="radiogroup" aria-label="Estado de ánimo">' + moodButtons() + '</div>' +
                '<div class="btn-row"><button type="button" class="btn" id="home-mood-save">Apuntar en el diario de hoy</button></div>' +
                '<p class="msg" id="home-mood-msg" role="status" data-kind="info"></p>' +
                '<p class="soft" style="margin-top: 10px; font-size: .92rem"><a class="link" href="#/animo">Ver cómo se reparten tus ánimos</a></p>' +
              '</section>' +

              '<article class="card" id="home-recent"><h3>Entradas recientes</h3><div id="home-recent-body"><p class="soft">Conecta tus datos para ver aquí tus últimas entradas.</p></div></article>' +
            '</div>' +

            // Tu personaje: se rellena con los datos reales (ver fillCharacter) y se repinta solo cuando cambian.
            '<aside class="card dark home-char" aria-label="Tu personaje">' +
              '<div id="home-char-body">' +
                '<div class="portrait-mini"><div class="sigil">' + sigil + '</div>' +
                  '<div><p class="level">Tu personaje</p><p class="soft">' + (App.connection.isConfigured() ? 'Cargando…' : 'Conecta tus datos para ver tu nivel y tus atributos.') + '</p></div></div>' +
              '</div>' +
              '<div style="margin-top: 18px"><a class="btn secondary" href="#/personaje">Ver personaje</a></div>' +
            '</aside>' +
          '</div>' +

          '<div class="three">' +
            '<article class="card"><h3>Misiones</h3><p>Tus actividades, misiones semanales y jefes están en tu personaje.</p><p style="margin-top: 10px"><a href="#/personaje" class="link">Ver personaje</a></p></article>' +
            '<article class="card" id="home-memories"><h3>Hace un año</h3><div id="home-memories-body"><p>Aparecerán recuerdos cuando tengas entradas de años anteriores.</p></div></article>' +
            '<article class="card" id="home-people"><h3>Personas recientes</h3><div id="home-people-body"><p>Aquí verás con quién has compartido tus últimos recuerdos.</p><p style="margin-top: 10px"><a href="#/personas" class="link">Ver personas</a></p></div></article>' +
          '</div>' +

          '<div class="badges88" aria-label="Detalles decorativos">' +
            '<span class="b88">solo para mí</span><span class="b88">sin anuncios</span><span class="b88">hecho a mano</span><span class="b88">★ 2026 ★</span>' +
          '</div>' +
        '</div>';

      wireMood(root);
      fillDiary(root);
      fillCharacter(root);
    }
  };

  function moodButtons() {
    return App.diary.MOODS.map(function (m) {
      return '<button type="button" role="radio" class="mood-btn" data-m="' + m.id + '" aria-checked="false">' +
        App.diaryHtml.face(m.id) + '<span>' + App.escapeHtml(m.label) + '</span></button>';
    }).join('');
  }

  // Elegir un ánimo y apuntarlo: añade un bloque (solo con ánimo) a la entrada de hoy.
  function wireMood(root) {
    var card = root.querySelector('.mood-card'), chosen = null;
    var msg = root.querySelector('#home-mood-msg'), save = root.querySelector('#home-mood-save');
    function say(html, kind) { msg.innerHTML = html; msg.setAttribute('data-kind', kind || 'info'); }
    card.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var pick = t.closest('[data-m]');
      if (pick) {
        chosen = chosen === pick.dataset.m ? null : pick.dataset.m;
        card.querySelectorAll('[data-m]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.m === chosen)); });
        return;
      }
      if (!t.closest('#home-mood-save')) return;
      var repo = App.diary.repo(), D = App.diary;
      if (!chosen) { say('Elige primero cómo te sientes.', 'error'); return; }
      if (!repo) { say('Conecta tus datos para guardar tu ánimo. <a href="#/ajustes">Conectar mis datos</a>', 'error'); return; }
      save.disabled = true; say('Guardando…', 'info');
      repo.appendBlock(D.today(), { text: '', tags: [], mood: chosen }).then(function () {
        say('Apuntado en la página de hoy. <a href="#/diario/' + D.today() + '/editar/nuevo">Escribir una entrada</a>', 'ok');
        chosen = null;
        card.querySelectorAll('[data-m]').forEach(function (b) { b.setAttribute('aria-checked', 'false'); });
        save.disabled = false;
      }).catch(function (err) { say(App.escapeHtml(err.message || 'No se pudo guardar.'), 'error'); save.disabled = false; });
    });
  }

  // Tarjeta del personaje: sale del mismo repositorio que la ficha (única fuente de verdad: el registro de XP, el perfil y
  // los atributos guardados). Nada se calcula aparte. Se apunta a sus cambios para repintarse sin recargar la página.
  function fillCharacter(root) {
    var R = App.rpg, V = App.rpgViews, repo = R && R.repo ? R.repo() : null;
    var body = root.querySelector('#home-char-body');
    if (!repo || !body || !V || !V.avatar) return;
    var esc = App.escapeHtml, off = null;
    function gone() { return body.isConnected === false; }
    function paint(st) {
      if (gone()) { if (off) off(); return; }
      var g = st.computed.general, fr = R.frameFor(g.level);
      body.innerHTML = '<div class="home-char-top">' + V.avatar(st.profile, g.level, { size: 'small', label: 'Tu avatar, con el marco ' + fr.frame.name }) +
          '<div><p class="home-char-name">' + esc(st.profile.name || 'Tu personaje') + '</p><p class="level">Nivel ' + g.level + '</p></div></div>' +
        '<div class="thread" role="progressbar" aria-label="Experiencia del nivel ' + g.level + '" aria-valuemin="0" aria-valuemax="' + g.need + '" aria-valuenow="' + g.into + '"><i style="width: ' + Math.round(g.fraction * 100) + '%"></i></div>' +
        '<p class="soft home-char-xp">' + g.into + ' de ' + g.need + ' XP para el nivel ' + (g.level + 1) + ' · ' + g.total + ' en total</p>' +
        '<ul class="chips home-char-attrs" aria-label="Tus atributos">' + st.computed.mains.map(function (m) {
          return '<li class="chip">' + esc(m.name) + '<b>Nv ' + m.level + '</b></li>';
        }).join('') + '</ul>';
    }
    function load(force) { return repo.state(force).then(paint).catch(function () { var s = !gone() && body.querySelector('.soft'); if (s) s.textContent = 'No se pudo cargar tu personaje ahora mismo.'; }); }
    body.addEventListener('error', V.avatarFallback, true);   // GIF del avatar que no carga: se ve el símbolo
    off = repo.onChange(function () { if (gone()) { off(); return; } load(false); });
    load(true);
  }

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
        recent.innerHTML = '<p class="soft">Todavía no has escrito ninguna.</p><p style="margin-top: 10px"><a class="btn secondary" href="#/diario/hoy">Escribir la primera</a></p>';
      } else {
        recent.innerHTML = '<ul class="mini-list">' + entries.slice(0, 3).map(function (e) {
          return '<li><a href="#/diario/' + esc(e.day) + '"><b>' + esc(D.displayTitle(e)) + '</b><small class="soft">' + esc(D.formatLong(e.day)) + '</small></a></li>';
        }).join('') + '</ul><p style="margin-top: 10px"><a href="#/diario" class="link">Ver todo el diario</a></p>';
      }
      // Personas con recuerdos recientes: por fecha del último fragmento (nunca por cantidad: no hay rankings de personas).
      var ppl = D.people && D.people(), pbody = root.querySelector('#home-people-body');
      if (ppl && pbody) ppl.list().then(function (people) {
        var act = D.peopleActivity(entries);
        var recentPeople = people.filter(function (p) { return act[p.id]; }).sort(function (a, b) { return act[a.id].last < act[b.id].last ? 1 : -1; }).slice(0, 3);
        pbody.innerHTML = recentPeople.length
          ? '<ul class="mini-list">' + recentPeople.map(function (p) {
              return '<li><a href="#/personas/' + esc(p.id) + '"><b>' + esc(p.name) + '</b><small class="soft">' + esc(D.formatLong(act[p.id].last)) + '</small></a></li>';
            }).join('') + '</ul><p style="margin-top: 10px"><a href="#/personas" class="link">Ver personas</a></p>'
          : '<p class="soft">' + (people.length ? 'Cuando vincules una entrada a alguien, aparecerá aquí.' : 'Todavía no hay fichas.') + '</p><p style="margin-top: 10px"><a href="#/personas" class="link">Ver personas</a></p>';
      }).catch(function () {});
      var md = D.today().slice(5, 10), year = D.today().slice(0, 4);
      var memories = entries.filter(function (e) { return e.day.slice(5, 10) === md && e.day.slice(0, 4) !== year && D.excerpt(e, 10); }).slice(0, 2);
      if (memories.length) {
        memo.innerHTML = memories.map(function (e) {
          return '<a class="memory" href="#/diario/' + esc(e.day) + '"><span class="margin-note">' + esc(D.formatLong(e.day)) + '</span>' +
            '<span>' + esc(D.excerpt(e, 130)) + '</span></a>';
        }).join('');
      }
    }).catch(function () {
      recent.innerHTML = '<p class="soft">No se pudieron cargar tus entradas ahora mismo.</p>';
    });
  }
})(window.App = window.App || {});
