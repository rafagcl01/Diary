// Ficha del personaje. Arriba, un bloque: a la izquierda la ficha (avatar, nombre, título, nivel y «Estado actual») y,
// debajo, el registro rápido de actividades; a la derecha, el radar, que compara con hace 30 días o con cada mes pasado.
// Al pulsar un atributo, el radar se convierte en el de sus subcategorías (flecha arriba a la izquierda para volver).
// Debajo: misiones diarias, tareas y misiones semanales, sombras y los jefes. La XP solo entra por acciones explícitas.
// Con una sombra sin purificar (de hoy o de anoche), el avatar lleva un glitch; ver rpg/shadows.js.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util;
  App.views = App.views || {};

  function bar(f, label) { return U.bar(f, label); }

  // ---- Piezas de HTML ----
  // «Estado actual · hoy»: como mucho 3 chips, solo de lo que pide algo, por orden: sombra sin purificar, misiones diarias
  // pendientes, XP descansada, tareas pendientes y escribir hoy. Lo demás (lo hecho, actividades de hoy, atributo dormido…)
  // va en «Ver todo». Lo que aún no ha cargado no sale. El siguiente título vive en «Tu camino».
  var STATE_MAX = 3;
  function stateHtml(st, today) {
    var d0 = R.today(), todo = [], rest = [];
    function chip(cls, html) { return '<li' + (cls ? ' class="' + cls + '"' : '') + '>' + html + '</li>'; }
    // Sombras de hoy (y de anoche, si sigue sin purificar)
    var sh = shadowsToday(today), open = sh.filter(function (x) { return !x.purified; });
    if (open.length) todo.push(chip('chip-shadow', '<i class="sh-dot" aria-hidden="true"></i><b>' + open.map(function (x) { return esc(x.name); }).join(', ') + '</b>&nbsp;· sin purificar'));
    else if (sh.length) rest.push(chip('chip-shadow ok', '<i class="sh-dot" aria-hidden="true"></i><b>' + sh.map(function (x) { return esc(x.name); }).join(', ') + '</b>&nbsp;· ' + (sh.length === 1 ? 'purificada' : 'purificadas')));
    if (today && today.daily && today.daily.missions.length) {
      var dd = today.daily.missions.filter(function (m) { return m.done; }).length, html = 'Misiones diarias <b>' + dd + ' de ' + today.daily.missions.length + '</b>';
      (today.daily.complete ? rest : todo).push(chip('', html + (today.daily.complete ? ' ✓' : '')));
    }
    var rs = R.restState ? R.restState(st.entries, d0) : null;
    if (rs) todo.push(chip('chip-rest', '<span class="rest-moon" aria-hidden="true">☾</span>+' + R.RESTED.xp + ' extra en tus <b>' + rs.left + '</b> próximas actividades' +
      (rs.state === 'active' ? ' · hasta ' + (rs.until === d0 ? 'esta noche' : 'mañana') : '')));
    if (today && today.todos && today.todos.list && today.todos.list.tasks.length) {
      var l = today.todos.list, html2 = 'Tareas <b>' + l.doneCount + ' de ' + l.tasks.length + '</b>';
      (l.allDone ? rest : todo).push(chip('', html2 + (l.allDone ? ' ✓' : '')));
    }
    if (R.diaryXpKey && !st.entries.some(function (e) { return e.key === R.diaryXpKey(d0); })) todo.push(chip('', '<a href="#/diario/hoy">Escribe hoy</a> · +' + R.DIARY_XP + ' XP'));
    rest.push(chip('', 'Actividades hoy <b>' + st.entries.filter(function (e) { return e.kind === 'activity' && e.day === d0; }).length + '</b>'));
    var sleepy = R.dormantMain ? R.dormantMain(st.structure, st.entries, d0) : null;
    if (sleepy) rest.push(chip('chip-sleep', '<span aria-hidden="true">zZ</span> Dormido: <b>' + esc(sleepy.name) + '</b>'));
    var shown = todo.slice(0, STATE_MAX), more = todo.slice(STATE_MAX).concat(rest);
    return '<div class="char-state" aria-label="Estado actual"><p class="char-state-h">Estado actual · hoy</p>' +
      (shown.length ? '<ul class="char-chips">' + shown.join('') + '</ul>' : '<p class="char-calm">Nada pendiente por hoy ✦</p>') +
      (more.length ? '<details class="char-more"><summary>Ver todo (' + more.length + ')</summary><ul class="char-chips quiet">' + more.join('') + '</ul></details>' : '') + '</div>';
  }
  // Rasgos conseguidos junto al título: los 3 más recientes; el resto en «Ver rasgos».
  function traitsOf(st, today) { return R.traitsState ? R.traitsState(st.entries, today && today.shadows, R.today()) : []; }
  function traitsHtml(st, today) {
    var got = traitsOf(st, today).filter(function (t) { return t.earned; }).sort(function (a, b) { return a.earnedOn < b.earnedOn ? 1 : -1; });
    return '<div class="char-traits">' + got.slice(0, 3).map(function (t) { return '<span class="trait">' + icon(t.icon) + esc(R.named(t, st.profile.form)) + '</span>'; }).join('') +
      '<button type="button" class="trait-link" data-act="traits" aria-haspopup="dialog">' + (got.length ? 'Ver rasgos' : 'Rasgos') + '</button></div>';
  }
  // Apariciones de hoy, más las de ayer que siguen sin purificar (las que mantienen el glitch).
  function shadowsToday(today) {
    var s = today && today.shadows; if (!s) return [];
    var yesterday = R.shiftDay(s.today, -1), out = [];
    s.shadows.forEach(function (v) {
      if (v.today) out.push({ name: v.name, purified: v.today.purified });
      else if (s.appearances.some(function (a) { return a.shadow === v.id && a.day === yesterday; }) && !R.shadowPurified(v, yesterday, s.entries)) out.push({ name: v.name, purified: false });
    });
    return out;
  }

  function num(n) { return Number(n).toLocaleString('es-ES'); }
  // Nivel con toda tu XP: «Nivel 2 · 70 / 218 XP». La barra se llena dentro del nivel (de 60 a 218) y debajo se ven sus extremos.
  function levelHtml(g) {
    // En el nivel máximo, la barra va hacia la siguiente estrella de las constelaciones (una cada 3.000 XP).
    if (g.max) {
      return '<p class="char-level"><strong>Nivel ' + g.level + '</strong> <span class="soft">· máximo · ' + num(g.total) + ' XP</span></p>' +
        bar(g.fraction, 'Constelaciones: ' + g.stars + ' estrellas; ' + g.into + ' de ' + g.need + ' XP para la siguiente') +
        '<p class="lv-ends" aria-hidden="true"><span>✦ ' + g.stars + (g.stars === 1 ? ' estrella' : ' estrellas') + '</span><span>Siguiente: ' + num(g.next) + ' XP</span></p>';
    }
    return '<p class="char-level"><strong>Nivel ' + g.level + '</strong> <span class="soft">· ' + num(g.total) + ' / ' + num(g.next) + ' XP</span></p>' +
      bar(g.fraction, 'Nivel ' + g.level + ': ' + g.total + ' de ' + g.next + ' XP para el nivel ' + (g.level + 1)) +
      '<p class="lv-ends" aria-hidden="true"><span>Nivel ' + g.level + ' · ' + num(g.start) + '</span><span>Nivel ' + (g.level + 1) + ' · ' + num(g.next) + '</span></p>';
  }
  function heroHtml(st, today) {
    var g = st.computed.general, p = st.profile, title = R.currentTitle(p.title, g.level);
    // Fondo elegido (si ya está conseguido; si no, el papel de siempre).
    var bg = p.background && p.background !== 'papel' && R.backgroundsFor(g.level).some(function (b) { return b.id === p.background; }) ? p.background : null;
    return '<section class="card paper sheet char-hero has-edit" aria-labelledby="char-name">' +
      (bg ? '<span class="hero-bg" data-bg="' + esc(bg) + '" aria-hidden="true"></span>' : '') +
      V.avatar(p, g.level, { size: 'large', aura: today && today.shadows ? today.shadows.aura : null, stars: g.stars }) +
      '<div class="char-id"><h2 id="char-name">' + esc(p.name || 'Tu personaje') + '</h2>' +
        (title ? '<p class="char-title"><span class="sr">Título: </span>' + esc(R.named(title, p.form)) + '</p>' : '') + traitsHtml(st, today) +
        levelHtml(g) +
        '</div>' + stateHtml(st, today) +
      '<button type="button" class="char-road" data-act="road" aria-haspopup="dialog">✦ Tu camino</button>' +
      App.ui.editLink('#/ajustes/personaje', 'Editar personaje') +   // aparece al pasar el ratón; lleva a Configuración
      '<a class="menu-only" href="#/ajustes/personaje" data-menu-label="Cambiar título">Cambiar título</a>' +   // solo en el menú «⋯» (táctil)
    '</section>';
  }

  function mainInfo(m) {
    var n = m.subs.filter(function (s) { return !s.archived; }).length;
    return '<span class="sub-ic">' + icon(m.icon) + '</span><div class="info-body"><h3>' + esc(m.name) + ' <span class="sub-lv">Nv ' + m.level + '</span></h3>' +
      '<p class="soft">' + esc(m.description) + '</p><p class="soft">' + num(m.xp) + ' / ' + num(m.xp - m.into + m.need) + ' XP, la suma de sus ' + m.subs.length + ' subcategorías · ' + Math.round(m.fraction * 100) + '% hacia el nivel ' + (m.level + 1) + '</p></div>';
  }
  function subInfo(s) {
    return '<span class="sub-ic">' + icon(s.icon) + '</span><div class="info-body"><h3>' + esc(s.name) + ' <span class="sub-lv">Nv ' + s.level + '</span></h3>' +
      (s.description ? '<p class="soft">' + esc(s.description) + '</p>' : '') +
      bar(s.fraction, s.name + ' nivel ' + s.level + ': ' + s.xp + ' de ' + (s.xp - s.into + s.need) + ' XP para el nivel ' + (s.level + 1)) +
      '<p class="soft">' + num(s.xp) + ' / ' + num(s.xp - s.into + s.need) + ' XP</p>' +
      '<div class="sub-tools"><button type="button" class="mini" data-act="sub-hist" data-id="' + esc(s.id) + '">Historial</button><button type="button" class="mini" data-act="sub-edit" data-id="' + esc(s.id) + '" data-back="">Editar</button></div></div>';
  }

  // Radar con evolución: «Último mes» (contorno de hace 30 días) o «Desde el principio» (un anillo por mes).
  // Las formas de antes salen del registro hasta esa fecha (R.radarHistory); aquí solo se ordenan por eje.
  function compareFor(hist, nav, ids, pick) {
    if (!hist) return null;
    var states = nav.compare === 'rings' ? hist.months.map(function (m) { return m.computed; }) : [hist.month];
    if (!states.length) return null;
    return { mode: nav.compare === 'rings' ? 'rings' : 'month', shapes: states.map(function (c) { return ids.map(function (id) { return pick(c, id); }); }) };
  }
  function compareBar(nav) {
    return '<div class="rd-compare" role="group" aria-label="Comparar con">' +
      '<button type="button" data-act="cmp" data-mode="month" aria-pressed="' + (nav.compare !== 'rings') + '">Último mes</button>' +
      '<button type="button" data-act="cmp" data-mode="rings" aria-pressed="' + (nav.compare === 'rings') + '">Desde el principio</button></div>';
  }
  function compareLegend(nav, hist) {
    if (nav.compare === 'rings') {
      return '<p class="rd-legend"><span><i class="rl-now"></i>Ahora</span><span><i class="rl-past"></i>' +
        (hist && hist.months.length ? 'Un anillo por mes desde tu primer registro (más claro, más antiguo)' : 'Aún no hay meses anteriores con registro') + '</span></p>';
    }
    return '<p class="rd-legend"><span><i class="rl-now"></i>Ahora</span><span><i class="rl-past"></i>Hace 30 días: el hueco es lo que has crecido</span></p>';
  }
  function mainValue(c, id) { var m = c.mains.filter(function (x) { return x.id === id; })[0]; return m ? m.value : 0; }
  function subValue(c, id) {
    for (var i = 0; i < c.mains.length; i++) { var s = c.mains[i].subs.filter(function (x) { return x.id === id; })[0]; if (s) return s.progress; }
    return 0;
  }

  function radarCard(c, nav, hist, sleepy) {
    if (nav.level === 'main') {
      var cmp = compareFor(hist, nav, c.mains.map(function (m) { return m.id; }), mainValue);
      var items = c.mains.map(function (m) { return sleepy && m.id === sleepy.id ? Object.assign({}, m, { sleep: true }) : m; });
      return '<section class="card radar-card" aria-labelledby="radar-title"><div class="rc-head"><h2 id="radar-title">Tus atributos</h2>' + compareBar(nav) + '</div>' +
        V.radar(items, { selected: '', kind: 'main', animate: nav.anim, compare: cmp }) + compareLegend(nav, hist) +
        '<div class="info' + (sleepy ? ' info-sleep' : '') + '" id="rd-info" aria-live="polite">' + (sleepy
          ? '<p><b>' + esc(sleepy.name) + '</b> está dormido: es el que menos XP ha recibido estos 7 días. Una de tus misiones de hoy es suya, con el sello «Despierta». Pulsa un atributo para ver sus subcategorías.</p>'
          : '<p class="soft">Pulsa un atributo para ver sus subcategorías.</p>') + '</div></section>';
    }
    var m = c.mains.filter(function (x) { return x.id === nav.main; })[0];
    var active = m.subs.filter(function (s) { return !s.archived; });
    var items = active.map(function (s) { return { id: s.id, name: s.name, level: s.level, fraction: s.fraction, value: s.progress, magic: s.id === 'brujeria' }; });
    var sel = active.filter(function (s) { return s.id === nav.sel; })[0];
    var magic = sel && sel.id === 'brujeria';
    var subCmp = compareFor(hist, nav, items.map(function (s) { return s.id; }), subValue);
    var chart = items.length >= 3 ? V.radar(items, { selected: sel ? sel.id : '', kind: 'sub', animate: nav.anim, compare: subCmp }) + compareLegend(nav, hist) :
      '<div class="rd-fallback"><p class="soft">Con menos de 3 subcategorías activas no hay gráfico. Elige una o recupera alguna en «Gestionar».</p>' +
      active.map(function (s) { return '<button type="button" class="emo-cap" data-sub="' + esc(s.id) + '" aria-pressed="' + (!!sel && sel.id === s.id) + '">' + icon(s.icon) + '<span>' + esc(s.name) + '</span></button>'; }).join(' ') + '</div>';
    return '<section class="card radar-card" data-level="sub" data-theme-main="' + esc(m.id) + '"' + (magic ? ' data-magic-sel="1"' : '') + ' aria-labelledby="radar-title">' +
      '<div class="rc-head"><button type="button" class="rd-back" data-act="back" aria-label="Volver a los atributos">' + icon('chev-l') + '</button>' +
      '<h2 id="radar-title">' + esc(m.name) + ' <span class="sub-lv">Nv ' + m.level + '</span></h2>' +
      '<button type="button" class="mini rc-manage" data-act="sub-manage">Gestionar</button></div>' + (items.length >= 3 ? compareBar(nav) : '') + chart +
      '<div class="info' + (magic ? ' sub-info' : '') + '"' + (magic ? ' data-magic="1"' : '') + ' id="rd-info" aria-live="polite">' +
        (sel ? subInfo(sel) : mainInfo(m)) + '</div></section>';
  }

  App.views.character = {
    render: function (root) {
      var repo = R.repo();
      root.innerHTML = '<div class="view rpg-view">' +
        App.pageHeader('Tu personaje', 'Tu nivel, tus atributos y tu progreso.', 'ficha de personaje') + App.lace() + '<div id="rpg-body"></div>' +
        '<dialog class="confirm rpg-dialog" id="rpg-dialog" aria-labelledby="rpg-dtitle"></dialog></div>';
      var $ = function (s) { return root.querySelector(s); };
      var body = $('#rpg-body');
      if (!repo) {
        body.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + icon('star') + '</div><h2>Conecta tus datos para ver tu personaje</h2>' +
          '<p>Tu experiencia se guarda en tu repositorio de datos, junto al diario. Nunca solo en el navegador.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>';
        return;
      }
      // La cuadrícula es fija: el personaje, el radar y el lateral se repintan en su hueco; Actividades (debajo del
      // personaje) es un panel aparte que no se toca al repintar. Abajo, Tareas y Misiones; y los jefes a lo ancho.
      body.innerHTML = '<div class="char-grid">' +
          '<div class="char-hero-slot" id="rpg-hero"><div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div></div>' +
          '<section class="card col col-act" id="col-act" aria-label="Actividades"></section>' +
          '<div class="char-radar" id="rpg-radar"></div>' +
          '<div class="char-side" id="rpg-side"></div>' +
        '</div>' +
        '<section class="card col col-wide col-daily" id="col-daily" aria-label="Misiones diarias"></section>' +
        '<div class="char-cols"><section class="card col" id="col-todo" aria-label="Tareas"></section><section class="card col" id="col-wk" aria-label="Misiones semanales"></section></div>' +
        '<section class="card col col-wide col-shadow" id="col-shadow" aria-label="Sombras"></section>' +
        '<section class="card col col-wide" id="col-boss" aria-label="Jefes finales"></section>';
      var slots = [$('#rpg-hero'), $('#rpg-radar'), $('#rpg-side')], panels = [];
      var st = null, nav = { level: 'main', main: null, sel: null, compare: 'month' }, note = '', form = null;
      var hist = null, histOf = null, today = null;

      // «Estado actual»: lo de hoy, calculado de las mismas fuentes que el resto de la ficha (sin guardar nada aparte).
      function refreshToday() {
        var daily = R.daily ? R.daily() : null, todos = R.todos ? R.todos() : null, shadows = R.shadows ? R.shadows() : null;
        return Promise.all([
          daily ? daily.state().catch(function () { return null; }) : null,
          todos ? todos.state().catch(function () { return null; }) : null,
          shadows ? shadows.state().catch(function () { return null; }) : null
        ]).then(function (r) {
          today = { daily: r[0], todos: r[1], shadows: r[2] };
          if (st) slots[0].innerHTML = heroHtml(st, today);
        });
      }
      function paint() {
        var c = st.computed;
        if (nav.level === 'sub' && !c.mains.some(function (m) { return m.id === nav.main; })) nav = { level: 'main', main: null, sel: null, compare: nav.compare };
        if (histOf !== st) { hist = R.radarHistory(st.structure, st.entries); histOf = st; }   // solo cuando cambia el registro
        slots[0].innerHTML = heroHtml(st, today);
        slots[1].innerHTML = radarCard(c, nav, hist, R.dormantMain ? R.dormantMain(st.structure, st.entries, R.today()) : null);
        slots[2].innerHTML = '<p class="msg" id="rpg-msg" role="status" data-kind="ok">' + esc(note) + '</p>';   // avisos (vacío, no ocupa)
        nav.anim = false;
      }
      function on(type, fn) { slots.forEach(function (s) { s.addEventListener(type, fn); }); $('#rpg-dialog').addEventListener(type, fn); }
      slots[0].addEventListener('error', V.avatarFallback, true);   // GIF del avatar que no carga: se ve el símbolo
      function focusSel(sel) { var el = root.querySelector(sel); if (el && el.focus) el.focus(); }
      function reload() { return repo.state().then(function (s) { st = s; paint(); }); }
      // Tras cualquier cambio de XP: da las recompensas pendientes, refresca la ficha y avisa de lo conseguido.
      function afterChange(day, pre) {
        var before = st.computed.general.level;
        return R.syncRewards(day).catch(function (e) { say((e && e.message) || 'No se pudieron comprobar las recompensas.'); return []; }).then(function (ev) {
          var events = (pre || []).concat(ev);
          return repo.state().then(function (s) {
            st = s; paint();
            var after = s.computed.general.level;
            // Subida de nivel: la pantalla breve (si está activada) o, si no, los avisos de siempre.
            if (after > before && s.profile.levelUpScreen && V.levelUp) V.levelUp.show(s, before, after);
            else {
              if (after > before) V.toast.show({ kind: 'level', title: '¡Subes de nivel!', text: 'Ya eres nivel ' + after });
              R.TITLES.filter(function (t) { return t.level > before && t.level <= after; }).forEach(function (t) {
                V.toast.show({ kind: 'title', title: '¡Título nuevo!', text: s.profile.title ? '«' + R.named(t, s.profile.form) + '» ya es tuyo. Puedes elegir cuál se ve en Configuración.' : 'Ahora eres «' + R.named(t, s.profile.form) + '».' });
              });
            }
            V.toast.events(events);
            // Repintadas las columnas, los premios grandes caen sobre su tarjeta (sellos; ver views/rpg/fx.js).
            return Promise.all(panels.map(function (p) { return p.reload(); }).concat([refreshToday()]))
              .then(function (r) { if (V.fx) V.fx.events(events); return r; });
          });
        });
      }
      function say(msg) { note = msg; var el = $('#rpg-msg'); if (el) el.textContent = msg; }
      function mainById(id) { return st.computed.mains.filter(function (m) { return m.id === id; })[0]; }

      // ---- Diálogos ----
      var dlg = function () { return $('#rpg-dialog'); };
      function openDialog(html) { dlg().innerHTML = html; if (!dlg().open) dlg().showModal(); }
      function closeDialog() { if (dlg().open) dlg().close(); }
      function dmsg(text, kind) { var el = $('#rpg-dmsg'); if (el) { el.textContent = text || ''; el.setAttribute('data-kind', kind || 'error'); } }
      var DMSG = '<p class="msg" id="rpg-dmsg" role="status" data-kind="error"></p>';

      function openManage() {
        var m = mainById(nav.main); if (!m) return closeDialog();
        form = { mode: 'manage' };
        var active = m.subs.filter(function (s) { return !s.archived; }), arch = m.subs.filter(function (s) { return s.archived; });
        function row(s) {
          return '<li class="manage-row"><span class="sub-ic">' + icon(s.icon) + '</span><span class="manage-name">' + esc(s.name) + (s.archived ? ' <em>(archivada)</em>' : '') + ' <small class="soft">Nv ' + s.level + '</small></span>' +
            '<button type="button" class="mini" data-act="sub-edit" data-id="' + esc(s.id) + '" data-back="1">Editar</button>' +
            (s.archived ? '' : '<button type="button" class="mini" data-act="sub-up" data-id="' + esc(s.id) + '" aria-label="Subir ' + esc(s.name) + '">↑</button><button type="button" class="mini" data-act="sub-down" data-id="' + esc(s.id) + '" aria-label="Bajar ' + esc(s.name) + '">↓</button>') +
            '<button type="button" class="mini" data-act="sub-archive" data-id="' + esc(s.id) + '" data-to="' + (s.archived ? '0' : '1') + '">' + (s.archived ? 'Recuperar' : 'Archivar') + '</button></li>';
        }
        openDialog('<h3 id="rpg-dtitle">Subcategorías de ' + esc(m.name) + '</h3>' +
          '<p class="soft">Renombrar o archivar conserva su experiencia y su historial.</p>' +
          '<ul class="manage-list">' + active.concat(arch).map(row).join('') + '</ul>' + DMSG +
          '<div class="btn-row"><button type="button" class="btn" data-act="sub-new">Nueva subcategoría</button><button type="button" class="btn secondary" data-act="main-edit">Editar atributo</button><button type="button" class="btn secondary" data-act="close">Cerrar</button></div>');
      }
      function openSub(sub, back) {
        form = { mode: 'sub', id: sub ? sub.id : null, back: !!back };
        openDialog('<h3 id="rpg-dtitle">' + (sub ? 'Editar subcategoría' : 'Nueva subcategoría') + '</h3>' +
          (sub ? '<p class="soft">Cambiar el nombre no toca su experiencia ni su historial.</p>' : '') +
          '<label class="field"><span>Nombre</span><input id="sb-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(sub ? sub.name : '') + '"></label>' +
          '<label class="field"><span>Descripción</span><input id="sb-desc" type="text" maxlength="' + R.LIMITS.description + '" autocomplete="off" value="' + esc(sub ? sub.description : '') + '"></label>' +
          U.symbolGrid('sb-icon', sub ? sub.icon : 'star', !sub) + DMSG +
          '<div class="btn-row"><button type="button" class="btn" data-act="sub-save">Guardar</button><button type="button" class="btn secondary" data-act="' + (back ? 'sub-manage' : 'close') + '">Cancelar</button></div>');
      }
      function openMain() {
        var m = mainById(nav.main);
        form = { mode: 'main', id: m.id, back: true };
        openDialog('<h3 id="rpg-dtitle">Editar atributo</h3>' +
          '<label class="field"><span>Nombre</span><input id="sb-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(m.name) + '"></label>' +
          '<label class="field"><span>Descripción</span><input id="sb-desc" type="text" maxlength="' + R.LIMITS.description + '" autocomplete="off" value="' + esc(m.description) + '"></label>' +
          U.symbolGrid('sb-icon', m.icon, false) + DMSG +
          '<div class="btn-row"><button type="button" class="btn" data-act="main-save">Guardar</button><button type="button" class="btn secondary" data-act="sub-manage">Cancelar</button></div>');
      }
      function openHistory(id) {
        var f = R.findSub(st.structure, id); if (!f) return;
        form = { mode: 'history' };
        var mine = st.entries.filter(function (e) { return (e.splits || []).some(function (x) { return x.sub === id; }); }).slice(-30).reverse();
        openDialog('<h3 id="rpg-dtitle">Historial de ' + esc(f.sub.name) + '</h3>' +
          (mine.length ? '<ul class="hist">' + mine.map(function (e) {
            var part = e.splits.filter(function (x) { return x.sub === id; })[0];
            return '<li><span>' + esc(e.label) + (e.kind === 'adjustment' ? ' <em>(ajuste)</em>' : '') + '</span><span class="soft">' + esc(U.fmtDay(e.day)) + '</span><strong>' + (part.xp > 0 ? '+' : '') + part.xp + ' XP</strong></li>';
          }).join('') + '</ul>' : '<p class="soft">Todavía sin historial.</p>') +
          '<div class="btn-row"><button type="button" class="btn secondary" data-act="close">Cerrar</button></div>');
      }
      // «Tu camino»: lo próximo que consigues y cuánto falta; cada nivel con premio (marcos y títulos, de config.js) marcando
      // lo conseguido y dónde estás; y cómo se gana XP (también de config.js). Si cambian los valores, esto cambia solo.
      function openRoad() {
        form = { mode: 'road' };
        var g = st.computed.general, C = R.CONFIG, byLevel = {};
        R.AVATAR_FRAMES.forEach(function (f) { (byLevel[f.level] = byLevel[f.level] || []).push({ kind: 'Marco', cls: 'f', name: f.name }); });
        R.TITLES.forEach(function (t) { (byLevel[t.level] = byLevel[t.level] || []).push({ kind: 'Título', cls: 't', name: R.named(t, st.profile.form) }); });
        R.BACKGROUNDS.forEach(function (b) { if (b.level > 1) (byLevel[b.level] = byLevel[b.level] || []).push({ kind: 'Fondo', cls: 'b', name: b.name }); });
        // Los reservados, todavía sin diseñar: se anuncian («próximamente») pero no se dan.
        R.SOON_REWARDS.forEach(function (x) { (byLevel[x.level] = byLevel[x.level] || []).push({ kind: x.kind, cls: x.kind === 'Marco' ? 'f' : 'b', name: 'próximamente', soon: true }); });
        var levels = Object.keys(byLevel).map(Number).sort(function (a, b) { return a - b; });
        var next = levels.filter(function (l) { return l > g.level; })[0];
        function items(l) { return byLevel[l].map(function (x) { return '<span class="rd-item' + (x.soon ? ' soon' : '') + '"><span class="kind ' + x.cls + '">' + x.kind + '</span>' + esc(x.name) + '</span>'; }).join(''); }
        var rows = [], hereDone = false;
        levels.forEach(function (l) {
          if (!hereDone && l > g.level) { rows.push(here()); hereDone = true; }
          var got = l <= g.level;
          rows.push('<li class="' + (got ? 'got' : '') + '"><span class="lvl">' + l + '</span><span class="what">' + items(l) + '</span><span class="xp">' + (got ? 'Conseguido' : num(R.xpForLevel(l)) + ' XP') + '</span></li>');
        });
        if (!hereDone) rows.push(here());
        // Más allá del nivel máximo: las constelaciones.
        var top = R.GENERAL_LEVEL.max, step = R.CONFIG.constellation.xp;
        if (top) rows.push('<li class="' + (g.max ? 'got' : '') + '"><span class="lvl">✦</span><span class="what"><span class="rd-item"><span class="kind c">Constelaciones</span>' +
          (g.max ? (g.stars ? 'Tienes ' + g.stars + (g.stars === 1 ? ' estrella' : ' estrellas') : 'Tu primera estrella, en ' + num(g.need - g.into) + ' XP') : 'Pasado el nivel ' + top + ', una estrella en el marco cada ' + num(step) + ' XP') +
          '</span></span><span class="xp">' + (g.max ? 'Siguiente: ' + num(g.next) + ' XP' : num(R.xpForLevel(top) + step) + ' XP') + '</span></li>');
        function here() { return '<li class="here" aria-current="step"><span class="lvl">' + g.level + '</span><span class="what"><b>Estás aquí</b></span><span class="xp">' + num(g.total) + ' XP</span></li>'; }
        var T = C.tasks, A = C.activity, D = C.daily, B = C.bosses;
        var sizes = function (list) { return list.map(function (z) { return z.xp; }).join(' / '); };
        var table = [
          ['Escribir en el diario', String(C.diary.xp), String(C.diary.xp)],
          ['Actividades', A.xp + ' cada una', String(A.xp * A.perDay)],
          ['Tareas', sizes(T.sizes), String(T.perDay)],
          ['Lista del día completa (' + T.listMin + ' tareas o más)', String(T.listBonus), String(T.listBonus)],
          ['Misiones diarias', sizes(R.DAILY_SIZES) + ', +' + D.bonus + ' las tres', String(Math.max.apply(null, R.DAILY_SIZES.map(function (z) { return z.xp; })) * 3 + D.bonus)],
          ['Misiones semanales', sizes(R.QUEST_SIZES), '—'],
          ['Jefes', B.stepXp + ' por paso; ' + sizes(B.tiers), '—']
        ];
        openDialog('<h3 id="rpg-dtitle">Tu camino</h3>' +
          (next ? '<div class="road-next"><span class="road-star" aria-hidden="true">✦</span><p>Lo próximo: <b>' + byLevel[next].map(function (x) { return x.soon ? 'un ' + x.kind.toLowerCase() + ' nuevo (todavía en diseño)' : x.kind.toLowerCase() + ' ' + esc(x.name); }).join(' y ') + '</b> en el nivel ' + next + '.</p>' +
            '<p>Te faltan <b>' + num(R.xpForLevel(next) - g.total) + ' XP</b> (llevas ' + num(g.total) + ' de ' + num(R.xpForLevel(next)) + ').</p></div>'
            : '<div class="road-next"><span class="road-star" aria-hidden="true">✦</span><p>Ya tienes <b>todos los marcos y títulos</b>.</p></div>') +
          '<ol class="road">' + rows.join('') + '</ol>' +
          '<h4 class="road-h">Cómo se gana XP</h4><div class="road-tbl"><table><thead><tr><th>Fuente</th><th>XP</th><th>Tope al día</th></tr></thead><tbody>' +
            table.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<div class="btn-row"><button type="button" class="btn secondary" data-act="close">Cerrar</button></div>');
        dlg().scrollTop = 0;   // al abrir se enfoca «Cerrar» (abajo): que se vea desde el principio
      }
      // Rasgos: los conseguidos (con su día) y los que faltan, con lo que piden y cómo vas (últimos 30 días).
      function openTraits() {
        form = { mode: 'traits' };
        var list = traitsOf(st, today);
        openDialog('<h3 id="rpg-dtitle">Tus rasgos</h3>' +
          '<p class="soft">Salen solos de lo que haces. Una vez conseguido, un rasgo es tuyo para siempre. Solo son decoración: no dan XP.</p>' +
          '<ul class="trait-grid">' + list.map(function (t) {
            // Los secretos no dicen nada hasta conseguirlos.
            if (t.secret && !t.earned) return '<li class="tg locked tg-secret"><span class="tg-ic" aria-hidden="true">?</span><b>???</b><p>Un rasgo secreto. Se descubre solo.</p></li>';
            return '<li class="tg' + (t.earned ? '' : ' locked') + (t.secret ? ' tg-found' : '') + '"><span class="tg-ic">' + icon(t.icon) + '</span><b>' + esc(R.named(t, st.profile.form)) + '</b><p>' + esc(t.desc) + '</p>' +
              (t.earned ? '<span class="tg-when">Conseguido el ' + esc(U.fmtDay(t.earnedOn)) + '</span>'
                : '<span class="tg-when">' + t.progress + ' de ' + t.target + (t.window ? ' (últimos ' + t.window + ' días)' : '') + U.bar(t.progress / t.target, R.named(t, st.profile.form) + ': ' + t.progress + ' de ' + t.target) + '</span>') + '</li>';
          }).join('') + '</ul>' +
          '<div class="btn-row"><button type="button" class="btn secondary" data-act="close">Cerrar</button></div>');
      }
      function checkedValue(name) { var el = root.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : undefined; }

      // Tras guardar un cambio de estructura: recarga y vuelve a la gestión (si se venía de ahí) o cierra.
      function guard(promise, back) {
        return promise.then(function () { return reload(); }).then(function () { if (back) openManage(); else closeDialog(); }).catch(function (err) { dmsg((err && err.message) || 'No se pudo guardar.', 'error'); });
      }
      function manageOp(promise) { return promise.then(reload).then(openManage).catch(function (e) { dmsg(e.message); }); }

      on('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-main],[data-sub]') : null;
        if (!t) return;
        var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
        if (!act) {
          var main = t.getAttribute('data-main'), sub = t.getAttribute('data-sub');
          if (main) { nav = { level: 'sub', main: main, sel: null, anim: true, compare: nav.compare }; paint(); return focusSel('.rd-back'); }
          if (sub) { nav.sel = nav.sel === sub ? null : sub; paint(); return focusSel('.rd-label.on') || focusSel('.rd-fallback button[aria-pressed="true"]'); }
          return;
        }
        if (act === 'back') { var was = nav.main; nav = { level: 'main', main: null, sel: null, anim: true, compare: nav.compare }; paint(); return focusSel('.rd-label[data-main="' + was + '"]'); }
        if (act === 'cmp') { nav.compare = t.getAttribute('data-mode') === 'rings' ? 'rings' : 'month'; paint(); return focusSel('[data-act="cmp"][data-mode="' + nav.compare + '"]'); }
        if (act === 'close') return closeDialog();
        if (act === 'traits') return openTraits();
        if (act === 'road') return openRoad();
        if (act === 'sub-manage') return openManage();
        if (act === 'sub-new') return openSub(null, true);
        if (act === 'main-edit') return openMain();
        if (act === 'sub-hist') return openHistory(id);
        if (act === 'sub-edit') { var f = R.findSub(st.structure, id); return f && openSub(f.sub, t.getAttribute('data-back') === '1'); }
        if (act === 'sub-up' || act === 'sub-down') return manageOp(repo.moveSub(id, act === 'sub-up' ? -1 : 1));
        if (act === 'sub-archive') return manageOp(repo.setArchived(id, t.getAttribute('data-to') === '1'));
        if (act === 'sub-save') {
          var data = { name: $('#sb-name').value, description: $('#sb-desc').value, icon: checkedValue('sb-icon') };
          return guard(form.id ? repo.updateSub(form.id, data) : repo.createSub(nav.main, data), form.back);
        }
        if (act === 'main-save') return guard(repo.updateMain(form.id, { name: $('#sb-name').value, description: $('#sb-desc').value, icon: checkedValue('sb-icon') }), true);
      });
      // En el radar de atributos, pasar el ratón o enfocar una punta enseña su resumen sin cambiar de pantalla.
      function peek(ev) {
        if (nav.level !== 'main') return;
        var t = ev.target && ev.target.closest ? ev.target.closest('.rd-label') : null;
        var m = t ? mainById(t.getAttribute('data-main')) : null, el = $('#rd-info');
        if (m && el) el.innerHTML = mainInfo(m);
      }
      on('mouseover', peek);
      on('focusin', peek);
      on('keydown', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('.rd-label') : null;
        if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      });

      repo.state().then(function (s) {
        st = s; paint();
        // Aviso único (en este navegador) del cambio de curva de octubre de 2026: tu nivel se recalcula, nunca baja.
        try {
          if (localStorage.getItem('diario-rpg.curve') !== '3') {
            localStorage.setItem('diario-rpg.curve', '3');
            if (s.entries.length) V.toast.show({ kind: 'level', title: 'Nueva curva de niveles', text: 'Con tu misma XP, ahora estás en el nivel ' + s.computed.general.level + ' (el máximo es el 30).' });
          }
        } catch (e) { /* sin almacenamiento: no pasa nada, solo no sale el aviso */ }
        var bossPanel = null;
        var ctx = { rpg: repo, acts: R.activities(), weekly: R.weekly(), bosses: R.bosses(), todos: R.todos(), daily: R.daily(), shadows: R.shadows(), afterChange: afterChange,
          onShadows: refreshToday,   // apuntar o deshacer una sombra cambia el glitch del avatar y «Estado actual»
          openBoss: function (pre) { return bossPanel.openNew(pre); } };
        bossPanel = V.bossPanel($('#col-boss'), ctx);
        panels = [V.activitiesPanel($('#col-act'), ctx), V.dailyPanel($('#col-daily'), ctx), V.todoPanel($('#col-todo'), ctx), V.weeklyPanel($('#col-wk'), ctx), V.shadowPanel($('#col-shadow'), ctx), bossPanel];
        // Primero se dan las recompensas que estuvieran pendientes (por ejemplo, de otra pestaña) y luego se pintan las columnas.
        return R.syncRewards().catch(function () { return []; }).then(function (ev) {
          if (ev.length) { return afterChange(null, ev); }
          return Promise.all(panels.map(function (p) { return p.reload(); }).concat([refreshToday()]));
        });
      }).catch(function (err) {
        slots[0].innerHTML = '<div class="msg" data-kind="error">No se pudo cargar tu personaje. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>';
      });
    }
  };
})(window.App = window.App || {});
