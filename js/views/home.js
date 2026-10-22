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
            // La hoja de hoy: una sola pregunta, «¿qué tal hoy?». Escribir arriba; o, sin escribir, apuntar solo el ánimo.
            '<section class="card paper hero today-sheet mood-card" aria-labelledby="home-today-title">' +
              icon('bow', 'bow') +
              '<h2 class="prompt" id="home-today-title">Querido diario, hoy…</h2>' +
              '<div class="actions"><a class="btn" href="#/diario/hoy">' + icon('book') + 'Escribir una entrada</a></div>' +
              '<p class="today-q" id="home-mood-title">o, sin escribir nada, ¿cómo te sientes?</p>' +
              '<div class="moods" role="radiogroup" aria-labelledby="home-mood-title">' + moodButtons() + '</div>' +
              // Solo si hoy cumple años alguien de tus fichas (ver fillBirthdays).
              '<p class="today-bday" id="home-bday" hidden></p>' +
              '<div class="btn-row today-save"><button type="button" class="btn secondary" id="home-mood-save">Apuntar en el diario de hoy</button></div>' +
              '<p class="msg" id="home-mood-msg" role="status" data-kind="info"></p>' +
            '</section>' +

            // Tu personaje: se rellena con los datos reales (ver fillCharacter) y se repinta solo cuando cambian.
            '<aside class="card dark home-char" aria-label="Tu personaje">' +
              '<div id="home-char-body">' +
                '<div class="portrait-mini"><div class="sigil">' + sigil + '</div>' +
                  '<div><p class="level">Tu personaje</p><p class="soft">' + (App.connection.isConfigured() ? 'Cargando…' : 'Conecta tus datos para ver tu nivel y tus atributos.') + '</p></div></div>' +
              '</div>' +
              '<div class="home-next"><p>Misiones, actividades y jefes viven en tu ficha.</p><a class="btn secondary" href="#/personaje">Ver personaje</a></div>' +
            '</aside>' +
          '</div>' +

          // Debajo, tres tarjetas a la misma altura. «Hace un año» sin recuerdos no se queda en blanco: la criatura espera.
          '<div class="three">' +
            '<article class="card" id="home-recent"><h3>Entradas recientes</h3><div id="home-recent-body"><p class="soft">Conecta tus datos para ver aquí tus últimas entradas.</p></div></article>' +
            '<article class="card" id="home-todos" aria-labelledby="home-todos-title"><header class="ht-head"><h3 id="home-todos-title">Tareas de hoy</h3><span class="soft ht-count" id="home-todos-count"></span></header>' +
              '<div id="home-todos-body"><p class="soft">' + (App.connection.isConfigured() ? 'Cargando…' : 'Conecta tus datos para ver tus tareas de hoy.') + '</p></div></article>' +
            '<article class="card" id="home-memories"><h3>Hace un año</h3><div id="home-memories-body">' + App.creature('Dentro de un año, este día te estará esperando aquí.') + '</div></article>' +
          '</div>' +

          '<div class="badges88" aria-label="Detalles decorativos">' +
            '<span class="b88">solo para mí</span><span class="b88">sin anuncios</span><span class="b88">hecho a mano</span><span class="b88">★ 2026 ★</span>' +
          '</div>' +
        '</div>';

      wireMood(root);
      fillDiary(root);
      fillCharacter(root);
      fillTodos(root);
      fillBirthdays(root);
    }
  };

  // Cumpleaños de hoy, de tus fichas de Personas (el cumpleaños se guarda como «MM-DD» o «AAAA-MM-DD»). Con el año, dice
  // cuántos cumple. El 29 de febrero se celebra el 28 en los años que no son bisiestos. Sin nadie, la línea no aparece.
  function fillBirthdays(root) {
    var D = App.diary, ppl = D && D.people ? D.people() : null, line = root.querySelector('#home-bday');
    if (!ppl || !line) return;
    var esc = App.escapeHtml, today = D.today(), md = today.slice(5), year = Number(today.slice(0, 4));
    var leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    ppl.list().then(function (people) {
      var who = people.filter(function (p) {
        var b = String(p.birthday || '').slice(-5);
        return b && (b === md || (b === '02-29' && md === '02-28' && !leap));
      });
      if (!who.length || line.isConnected === false) return;
      var names = who.map(function (p) {
        var age = /^\d{4}-/.test(p.birthday) ? year - Number(p.birthday.slice(0, 4)) : 0;
        return '<a href="#/personas/' + esc(p.id) + '">' + esc(p.name) + '</a>' + (age > 0 ? ' (' + age + ')' : '');
      });
      var list = names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1] : names[0];
      line.innerHTML = icon('candle') + '<span>' + (who.length > 1 ? 'Hoy cumplen años ' : 'Hoy es el cumpleaños de ') + list + '.</span>';
      line.hidden = false;
    }).catch(function () {});
  }

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
        '<p class="soft home-char-xp">' + (g.max ? 'Nivel máximo · ✦ ' + g.stars + (g.stars === 1 ? ' estrella' : ' estrellas') + ' · ' + g.total.toLocaleString('es-ES') + ' XP'
          : g.total.toLocaleString('es-ES') + ' / ' + g.next.toLocaleString('es-ES') + ' XP para el nivel ' + (g.level + 1)) + '</p>' +
        '<ul class="chips home-char-attrs" aria-label="Tus atributos">' + st.computed.mains.map(function (m) {
          return '<li class="chip">' + esc(m.name) + '<b>Nv ' + m.level + '</b></li>';
        }).join('') + '</ul>';
    }
    function load(force) { return repo.state(force).then(paint).catch(function () { var s = !gone() && body.querySelector('.soft'); if (s) s.textContent = 'No se pudo cargar tu personaje ahora mismo.'; }); }
    body.addEventListener('error', V.avatarFallback, true);   // GIF del avatar que no carga: se ve el símbolo
    off = repo.onChange(function () { if (gone()) { off(); return; } load(false); });
    load(true);
  }

  // Tareas de hoy: la misma lista que la ficha del personaje (R.todos), en corto. Se marcan y se desmarcan (desmarcar pregunta
  // antes, porque quita su XP) y se añaden escribiendo (Intro, tamaño Normal). Ordenar, editar, quitar y el reparto, en la ficha.
  var TODO_MAX = 5;
  function fillTodos(root) {
    var R = App.rpg, V = App.rpgViews, todos = R && R.todos ? R.todos() : null, rpg = R && R.repo ? R.repo() : null;
    var card = root.querySelector('#home-todos'), body = root.querySelector('#home-todos-body');
    if (!todos || !rpg || !card || !body) return;
    var esc = App.escapeHtml, state = null, level = null, busy = false, queue = Promise.resolve();
    function gone() { return body.isConnected === false; }
    function say(text, kind) { var m = body.querySelector('#home-todos-msg'); if (m) { m.textContent = text || ''; m.setAttribute('data-kind', kind || 'ok'); } }
    function paint() {
      var l = state.list, tasks = l ? l.tasks : [], count = root.querySelector('#home-todos-count');
      if (count) count.textContent = tasks.length ? l.doneCount + ' de ' + tasks.length : '';
      body.innerHTML = (tasks.length
        ? '<ul class="bs-steps td-tasks ht-tasks" aria-label="Tareas de hoy">' + tasks.slice(0, TODO_MAX).map(function (t) {
            return '<li data-done="' + t.done + '"' + (t.capped && !t.done ? ' data-capped="true"' : '') + '><label class="bs-check"><input type="checkbox" data-tk="' + esc(t.id) + '" data-list="' + esc(l.id) + '"' +
              (t.done ? ' checked' : '') + (t.done && l.completed ? ' disabled' : '') + '><span class="bs-text">' + esc(t.text) + '</span></label><span class="td-xp">+' + t.xp + '</span></li>';
          }).join('') + '</ul>' + (tasks.length > TODO_MAX ? '<p class="soft ht-more">y ' + (tasks.length - TODO_MAX) + ' más en tu ficha</p>' : '')
        : '<p class="soft">Todavía sin tareas para hoy.</p>') +
        (l && l.completed ? '<p class="soft ht-done">Lista completada · +' + l.rewardXp + ' XP</p>' : '') +
        '<input type="text" class="td-new ht-new" maxlength="' + R.TODO_LIMITS.task + '" autocomplete="off" placeholder="Añadir tarea… (Intro)" aria-label="Nueva tarea de hoy">' +
        '<p class="msg" id="home-todos-msg" role="status" data-kind="ok"></p>' +
        '<p><a class="link" href="#/personaje">Ver en tu personaje</a></p>';
    }
    function reload() {
      return todos.cleanup().catch(function () {}).then(function () { return Promise.all([todos.state(), rpg.state()]); }).then(function (r) {
        if (gone()) return;
        state = r[0]; level = r[1].computed.general.level; paint();
      });
    }
    // Lo mismo que hace la ficha tras un cambio: recompensas pendientes, avisos (lista completada) y, si sube, el nivel.
    function afterChange(events) {
      var before = level;
      return R.syncRewards().catch(function () { return []; }).then(function (ev) {
        return rpg.state().then(function (s) {
          var after = s.computed.general.level;
          if (V && after > before) {
            if (s.profile.levelUpScreen && V.levelUp) V.levelUp.show(s, before, after);
            else if (V.toast) V.toast.show({ kind: 'level', title: '¡Subes de nivel!', text: 'Ya eres nivel ' + after });
          }
          if (V && V.toast) V.toast.events((events || []).concat(ev));
          return reload();
        });
      });
    }
    function enqueue(job) {
      queue = queue.then(job).then(afterChange).catch(function (e) { say(e.message, 'error'); return reload(); });
      return queue;
    }
    card.addEventListener('change', function (ev) {
      var t = ev.target, taskId = t && t.getAttribute ? t.getAttribute('data-tk') : null;
      if (!taskId || !state) return;
      var id = t.getAttribute('data-list'), li = t.closest('li');
      if (t.checked) { if (li) li.setAttribute('data-done', 'true'); enqueue(function () { return todos.completeTask(id, taskId); }); return; }
      var tk = state.list && state.list.tasks.filter(function (x) { return x.id === taskId; })[0];
      App.ui.askUncheck(t, 'li', '¿Desmarcar <b>' + esc(tk ? tk.text : 'la tarea') + '</b>?' + (tk && tk.xp ? ' Se quitan sus ' + App.ui.xpText(tk.xp) + '.' : ''), function () {
        if (li) li.setAttribute('data-done', 'false');
        enqueue(function () { return todos.uncompleteTask(id, taskId); });
      });
    });
    card.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (ev.key !== 'Enter' || !t || !t.classList || !t.classList.contains('ht-new')) return;
      ev.preventDefault();
      var text = t.value.trim(); if (!text || busy) return;
      busy = true; t.disabled = true;
      todos.addTask({ text: text, size: 'normal' }).then(reload).then(function () {
        var again = body.querySelector('.ht-new'); if (again && again.focus) again.focus();   // para seguir añadiendo
      }).catch(function (e) { t.disabled = false; say(e.message, 'error'); }).then(function () { busy = false; });
    });
    var off = rpg.onChange(function () { if (gone()) { off(); return; } if (!busy) reload().catch(function () {}); });
    reload().catch(function () { if (!gone()) body.innerHTML = '<p class="soft">No se pudieron cargar tus tareas ahora mismo.</p>'; });
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
