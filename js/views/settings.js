(function (App) {
  var MAX_IMPORT_BYTES = 25 * 1024 * 1024;

  App.views = App.views || {};
  App.views.settings = {
    render: function (root, opts) {
      var prefs = App.prefs.get();
      var conn = App.connection.describe();
      var esc = App.escapeHtml;
      function option(current, value, label) {
        return '<option value="' + value + '"' + (current === value ? ' selected' : '') + '>' + label + '</option>';
      }

      root.innerHTML = '<div class="view">' +
        App.pageHeader('Configuración', 'Ajustes de la aplicación y conexión con tus datos.', 'ajustes de este dispositivo') +
        App.lace() +

        '<section class="settings-block" aria-labelledby="h-perfil">' +
          '<h2 id="h-perfil">Perfil</h2>' +
          '<label class="field">' +
            '<span>Tu nombre</span>' +
            '<input id="pref-name" type="text" maxlength="40" autocomplete="given-name" value="' + esc(prefs.name) + '">' +
            '<small>Solo se usa en el saludo del inicio.</small>' +
          '</label>' +
        '</section>' +

        '<section class="settings-block wide" id="sec-personaje" aria-labelledby="h-personaje">' +
          '<h2 id="h-personaje" tabindex="-1">Tu personaje</h2>' +
          '<div id="cs-body"><div class="skeleton" style="margin: 8px 0"></div></div>' +
        '</section>' +

        '<section class="settings-block wide" id="sec-diarias" aria-labelledby="h-diarias">' +
          '<h2 id="h-diarias" tabindex="-1">Misiones diarias</h2>' +
          '<div id="dq-body"><div class="skeleton" style="margin: 8px 0"></div></div>' +
        '</section>' +

        '<section class="settings-block" aria-labelledby="h-aspecto">' +
          '<h2 id="h-aspecto">Aspecto</h2>' +
          '<label class="field"><span>Tema</span>' +
            '<select id="pref-theme">' +
              option(prefs.theme, 'auto', 'Automático (según tu sistema)') +
              option(prefs.theme, 'light', 'Claro') +
              option(prefs.theme, 'dark', 'Oscuro') +
            '</select></label>' +
          '<label class="field"><span>Efectos decorativos y animaciones</span>' +
            '<select id="pref-motion">' +
              option(prefs.motion, 'auto', 'Automático (respeta «reducir movimiento»)') +
              option(prefs.motion, 'on', 'Activados') +
              option(prefs.motion, 'off', 'Desactivados') +
            '</select>' +
            '<small>Desactivarlos quita brillos y animaciones, pero no cambia nada más.</small></label>' +
        '</section>' +

        '<section class="settings-block wide" aria-labelledby="h-datos">' +
          '<h2 id="h-datos">Tus datos</h2>' +
          '<p>Tus entradas se guardan en un repositorio privado de GitHub que es solo tuyo, distinto del de esta aplicación. <strong>No están cifradas</strong>: quien tenga acceso a tu cuenta o a tu token podría leerlas.</p>' +
          '<div class="conn-summary stitched" id="conn-summary"><span class="tag" id="conn-tag"></span><p id="conn-text"></p></div>' +
          '<form id="conn-form" novalidate>' +
            '<label class="field"><span>Repositorio de datos</span>' +
              '<input id="conn-repo" type="text" autocomplete="off" spellcheck="false" placeholder="tu-usuario/diario-datos" value="' + esc(conn.repo) + '">' +
              '<small>Debe ser privado y estar vacío (o solo con README).</small></label>' +
            '<label class="field"><span>Rama</span>' +
              '<input id="conn-branch" type="text" autocomplete="off" spellcheck="false" value="' + esc(conn.branch) + '"></label>' +
            '<label class="field"><span>Token de acceso</span>' +
              '<input id="conn-token" type="password" autocomplete="off" spellcheck="false" placeholder="' + (conn.hasToken ? 'Guardado en este navegador (déjalo vacío para conservarlo)' : 'github_pat_…') + '">' +
              '<small>Usa un token «fine-grained» solo para ese repositorio, con permiso <em>Contents: Read and write</em> y fecha de caducidad.</small></label>' +
            '<label class="checkline"><input id="conn-remember" type="checkbox"' + (conn.remember ? ' checked' : '') + '>' +
              '<span>Recordar el token en este dispositivo<br><small class="soft">Si lo desmarcas, tendrás que escribirlo cada vez que abras la aplicación. Desmárcalo en ordenadores compartidos.</small></span></label>' +
            '<div class="btn-row">' +
              '<button class="btn" type="submit" id="conn-connect">Conectar</button>' +
              '<button class="btn secondary" type="button" id="conn-check">Comprobar conexión</button>' +
              '<button class="btn secondary" type="button" id="conn-disconnect">Desconectar</button>' +
            '</div>' +
            '<p class="msg" id="conn-msg" role="status" data-kind="info"></p>' +
          '</form>' +
        '</section>' +

        '<section class="settings-block wide" aria-labelledby="h-copias">' +
          '<h2 id="h-copias">Copia de seguridad</h2>' +
          '<p>Descarga todos tus datos en un archivo. Guárdalo en un sitio seguro: es la forma de recuperar el diario si pierdes el acceso al repositorio.</p>' +
          '<div class="btn-row" style="margin-top: 14px">' +
            '<button class="btn secondary" type="button" id="backup-export">Descargar copia</button>' +
            '<button class="btn secondary" type="button" id="backup-import">Importar copia…</button>' +
            '<input id="backup-file" type="file" accept="application/json,.json" hidden>' +
          '</div>' +
          '<p class="msg" id="backup-msg" role="status" data-kind="info"></p>' +
        '</section>' +

        '<dialog class="confirm" id="import-dialog" aria-labelledby="import-title">' +
          '<h3 id="import-title">Importar copia</h3>' +
          '<p id="import-summary"></p>' +
          '<label class="checkline" id="import-overwrite-line"><input id="import-overwrite" type="checkbox"><span id="import-overwrite-text"></span></label>' +
          '<div class="btn-row"><button class="btn" type="button" id="import-go">Importar</button><button class="btn secondary" type="button" id="import-cancel">Cancelar</button></div>' +
        '</dialog>' +

        '<p id="save-status" class="save-status" role="status"></p>' +
        '</div>';

      function $(sel) { return root.querySelector(sel); }
      var status = $('#save-status');
      function saved(ok) { status.textContent = ok ? 'Guardado' : 'No se pudo guardar en este navegador'; }

      $('#pref-name').addEventListener('input', function (e) { saved(App.prefs.set({ name: e.target.value.trim() })); });

      // ---- Tu personaje: nombre y avatar (símbolo, foto o imagen/GIF por enlace), con vista previa en el marco de tu nivel ----
      (function character() {
        var R = App.rpg, V = App.rpgViews, U = V && V.util, body = $('#cs-body');
        var repo = R && R.repo ? R.repo() : null;
        if (!repo || !V || !V.avatar) {
          body.innerHTML = '<p>Conecta tus datos (más abajo, en «Tus datos») para cambiar tu personaje: se guarda en tu repositorio, junto al diario.</p>';
          return;
        }
        var form = null, level = 1, busy = false;
        function image() {
          if (form.mode === 'photo' && form.photo) return { kind: 'photo', data: form.photo };
          if (form.mode === 'url' && R.imageUrl(form.url)) return { kind: 'url', url: R.imageUrl(form.url) };
          return null;
        }
        function preview() {
          var fr = R.frameFor(level);
          return V.avatar({ avatar: form.avatar, image: image() }, level, { size: 'medium', label: 'Vista previa del avatar' }) +
            '<p class="soft cs-frame">Marco: ' + esc(fr.frame.name) + ' (nivel ' + level + ')</p>';
        }
        function modeHtml() {
          if (form.mode === 'photo') {
            return '<div class="cs-photo"><input id="cs-photo" class="sr" type="file" accept="image/*">' +
              '<label class="btn secondary" for="cs-photo">' + (form.photo ? 'Cambiar foto' : 'Elegir foto') + '</label></div>' +
              '<small class="soft">Se recorta cuadrada y se reduce a ' + R.AVATAR_PHOTO.px + ' px en tu navegador. Se guarda en tu repositorio de datos (rpg/profile.json), sin cifrar como todo lo demás.</small>';
          }
          var grid = U.symbolGrid('cs-symbol', form.avatar, false, 'Símbolo');
          if (form.mode === 'url') {
            return '<label class="field"><span>Enlace a la imagen o GIF</span><input id="cs-url" type="url" inputmode="url" autocomplete="off" placeholder="Pega aquí el enlace de la imagen" value="' + esc(form.url) + '">' +
              '<small>' + U.imageLinkHelp() + ' Si un día no carga, se ve el símbolo de abajo.</small></label>' + grid;
          }
          return grid;
        }
        function paintPreview() { $('#cs-preview').innerHTML = preview(); }
        // Títulos: «El más alto» (sin elegir) y los conseguidos; los que faltan se ven, apagados, con su nivel.
        function titlesHtml() {
          var top = R.currentTitle(null, level);
          return '<li><button type="button" class="emo-cap" data-cs-title="" aria-pressed="' + !form.title + '"><span>El más alto (' + (top ? esc(R.named(top, form.textForm)) : 'todavía ninguno') + ')</span></button></li>' +
            R.TITLES.map(function (t) {
              var got = level >= t.level;
              return '<li><button type="button" class="emo-cap"' + (got ? ' data-cs-title="' + esc(t.id) + '" aria-pressed="' + (form.title === t.id) + '"' : ' disabled aria-disabled="true"') + '>' +
                '<span>' + esc(R.named(t, form.textForm)) + (got ? '' : ' · nivel ' + t.level) + '</span></button></li>';
            }).join('');
        }
        // Forma de los textos (títulos y rasgos), fondo de la ficha (los que faltan, apagados con su nivel) y pantalla al subir de nivel.
        var FORMS = [['f', 'Femenina'], ['m', 'Masculina'], ['n', 'Neutra']];
        function formsHtml() {
          return FORMS.map(function (x) { return '<li><button type="button" class="emo-cap" data-cs-form="' + x[0] + '" aria-pressed="' + (form.textForm === x[0]) + '"><span>' + x[1] + '</span></button></li>'; }).join('');
        }
        function bgsHtml() {
          return R.BACKGROUNDS.map(function (b) {
            var got = level >= b.level;
            return '<button type="button" class="cs-bg" data-cs-bg="' + esc(b.id) + '" aria-pressed="' + (form.background === b.id) + '"' + (got ? '' : ' disabled aria-disabled="true"') + '>' +
              '<span class="cs-bg-sw" data-bg="' + esc(b.id) + '" aria-hidden="true"></span>' + esc(b.name) + '<small>' + (b.level > 1 ? 'Nivel ' + b.level : 'Desde el principio') + '</small></button>';
          }).join('');
        }
        function paintMode() { $('#cs-mode').innerHTML = modeHtml(); }
        function say(t, kind) { var m = $('#cs-msg'); m.textContent = t || ''; m.setAttribute('data-kind', kind || 'info'); }
        function paint() {
          var modes = [['symbol', 'Símbolo'], ['photo', 'Foto'], ['url', 'Imagen o GIF de internet']].map(function (x) {
            return '<li><button type="button" class="emo-cap" data-cs-mode="' + x[0] + '" aria-pressed="' + (form.mode === x[0]) + '"><span>' + x[1] + '</span></button></li>';
          }).join('');
          body.innerHTML = '<div class="char-set"><div class="cs-preview" id="cs-preview" aria-live="polite">' + preview() + '</div><div class="cs-form">' +
            '<label class="field"><span>Nombre del personaje</span><input id="cs-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(form.name) + '"></label>' +
            '<div class="field"><span>Título</span><ul class="emo-caps cs-modes" aria-label="Título" id="cs-titles">' + titlesHtml() + '</ul>' +
              '<small>Los títulos se consiguen subiendo de nivel. «El más alto» cambia solo al conseguir uno nuevo.</small></div>' +
            '<div class="field"><span>Forma de los textos</span><ul class="emo-caps cs-modes" aria-label="Forma de los textos" id="cs-forms">' + formsHtml() + '</ul>' +
              '<small>Para títulos y rasgos: «' + esc(R.named(R.currentTitle(form.title, level) || R.TITLES[0], form.textForm)) + '».</small></div>' +
            '<div class="field"><span>Fondo de la ficha</span><div class="cs-bgs" id="cs-bgs">' + bgsHtml() + '</div></div>' +
            '<label class="checkline"><input type="checkbox" id="cs-lvlup"' + (form.levelUpScreen ? ' checked' : '') + '><span>Pantalla al subir de nivel</span></label>' +
            '<div class="field"><span>Avatar</span><ul class="emo-caps cs-modes" aria-label="Tipo de avatar">' + modes + '</ul></div>' +
            '<div id="cs-mode">' + modeHtml() + '</div>' +
            '<p class="msg" id="cs-msg" role="status" data-kind="info"></p>' +
            '<div class="btn-row"><button type="button" class="btn" id="cs-save">Guardar</button></div></div></div>';
        }

        repo.state().then(function (st) {
          var p = st.profile, img = p.image;
          level = st.computed.general.level;
          form = { name: p.name, avatar: p.avatar, mode: img ? (img.kind === 'photo' ? 'photo' : 'url') : 'symbol', photo: img && img.kind === 'photo' ? img.data : '', url: img && img.kind === 'url' ? img.url : '',
            title: p.title && R.titlesFor(level).some(function (t) { return t.id === p.title; }) ? p.title : null, textForm: p.form,
            background: R.backgroundsFor(level).some(function (b) { return b.id === p.background; }) ? p.background : 'papel', levelUpScreen: p.levelUpScreen };
          paint();
        }).catch(function (err) {
          body.innerHTML = '<p class="msg" data-kind="error">No se pudo cargar tu personaje. ' + esc((err && err.message) || '') + '</p>';
        });

        body.addEventListener('error', V.avatarFallback, true);   // GIF que no carga: la vista previa enseña el símbolo
        body.addEventListener('click', function (e) {
          var t = e.target && e.target.closest ? e.target.closest('[data-cs-mode],[data-cs-title],[data-cs-form],[data-cs-bg],#cs-save') : null;
          if (!t || !form) return;
          if (t.hasAttribute('data-cs-title')) { form.title = t.getAttribute('data-cs-title') || null; $('#cs-titles').innerHTML = titlesHtml(); return; }
          if (t.hasAttribute('data-cs-form')) { form.textForm = t.getAttribute('data-cs-form'); paint(); return; }
          if (t.hasAttribute('data-cs-bg')) { form.background = t.getAttribute('data-cs-bg'); $('#cs-bgs').innerHTML = bgsHtml(); return; }
          if (t.id !== 'cs-save') {
            form.mode = t.getAttribute('data-cs-mode');
            Array.prototype.forEach.call(body.querySelectorAll('[data-cs-mode]'), function (b) { b.setAttribute('aria-pressed', String(b === t)); });
            paintMode(); paintPreview(); say(''); return;
          }
          if (busy) return;
          var img = null;
          if (form.mode === 'photo') { if (!form.photo) { say('Elige una foto primero.', 'error'); return; } img = { kind: 'photo', data: form.photo }; }
          if (form.mode === 'url') { if (!form.url.trim()) { say('Pega el enlace de la imagen o del GIF.', 'error'); return; } img = { kind: 'url', url: form.url.trim() }; }
          busy = true; t.disabled = true; say('Guardando…');
          repo.saveProfile({ name: $('#cs-name').value, avatar: form.avatar, image: img, title: form.title, form: form.textForm, background: form.background, levelUpScreen: form.levelUpScreen })
            .then(function () { say('Guardado. Ya se ve en tu ficha de Personaje.', 'ok'); })
            .catch(function (err) { say((err && err.message) || 'No se pudo guardar.', 'error'); })
            .then(function () { busy = false; t.disabled = false; });
        });
        body.addEventListener('change', function (e) {
          var t = e.target; if (!t || !form) return;
          if (t.name === 'cs-symbol') { form.avatar = t.value; paintPreview(); return; }
          if (t.id === 'cs-lvlup') { form.levelUpScreen = t.checked; return; }
          if (t.id === 'cs-photo' && t.files && t.files[0]) {
            say('Preparando la foto…');
            App.shrinkPhoto(t.files[0], R.AVATAR_PHOTO.px, R.AVATAR_PHOTO.max).then(function (data) {
              form.photo = data; paintMode(); paintPreview(); say('Foto lista. Pulsa Guardar para quedártela.');
            }).catch(function (err) { say(err.message, 'error'); });
          }
        });
        body.addEventListener('input', function (e) {
          var t = e.target; if (!t || !form) return;
          if (t.id === 'cs-name') form.name = t.value;
          if (t.id === 'cs-url') { form.url = t.value.trim(); paintPreview(); }
        });

      })();

      // ---- Misiones diarias: la batería de la que salen las tres de cada día. Filtrar, eliminar y añadir. ----
      (function dailies() {
        var R = App.rpg, body = $('#dq-body');
        var daily = R && R.daily ? R.daily() : null, repo = R && R.repo ? R.repo() : null;
        if (!daily || !repo) { body.innerHTML = '<p>Conecta tus datos (más abajo, en «Tus datos») para ver y cambiar tus misiones diarias.</p>'; return; }
        var cat = null, st = null, filter = '', busy = false;
        function say(t, kind) { var m = $('#dq-msg'); if (m) { m.textContent = t || ''; m.setAttribute('data-kind', kind || 'info'); } }
        function mainOf(sub) { var f = R.findSub(st.structure, sub); return f ? f.main : null; }
        function subLabel(sub) { var f = R.findSub(st.structure, sub); return f ? f.main.name + ' · ' + f.sub.name : sub; }
        function paintList() {
          var shown = cat.missions.filter(function (m) { var mn = mainOf(m.sub); return !filter || (mn && mn.id === filter); });
          $('#dq-list').innerHTML = shown.length ? shown.map(function (m) {
            var f = R.findSub(st.structure, m.sub);
            return '<li><span class="dq-ic" aria-hidden="true">' + App.icon(f ? f.sub.icon : 'star') + '</span>' +
              '<span class="dq-name">' + esc(m.name) + (m.custom ? ' <span class="dq-mine">Tuya</span>' : '') + '<small>' + esc(subLabel(m.sub)) + '</small></span>' +
              '<span class="dq-xp">+' + R.sizeXp(m.size) + '</span>' +
              '<button type="button" class="dq-x" data-dq-del="' + esc(m.id) + '" aria-label="Eliminar «' + esc(m.name) + '»" title="Eliminar">×</button></li>';
          }).join('') : '<li class="soft">Ninguna misión en este atributo.</li>';
          $('#dq-count').textContent = cat.missions.length + (cat.missions.length === 1 ? ' misión' : ' misiones') + ' · ' + cat.missions.filter(function (m) { return m.custom; }).length + ' tuyas';
          $('#dq-restore').hidden = !cat.removedDefaults;
          $('#dq-restore-n').textContent = String(cat.removedDefaults);
        }
        function paint() {
          var subs = [];
          st.structure.forEach(function (a) { a.subs.forEach(function (s) { if (!s.archived) subs.push('<option value="' + esc(s.id) + '">' + esc(a.name + ' · ' + s.name) + '</option>'); }); });
          body.innerHTML = '<p>Cada día salen tres al azar de esta lista (de atributos distintos si se puede). <span id="dq-count"></span>.</p>' +
            '<ul class="emo-caps dq-filter" aria-label="Filtrar por atributo"><li><button type="button" class="emo-cap" data-dq-filter="" aria-pressed="true"><span>Todas</span></button></li>' +
              st.structure.map(function (a) { return '<li><button type="button" class="emo-cap" data-dq-filter="' + esc(a.id) + '" aria-pressed="false"><span>' + esc(a.name) + '</span></button></li>'; }).join('') + '</ul>' +
            '<ul class="dq-items col-scroll" id="dq-list"></ul>' +
            '<div class="dq-add"><label class="field"><span>Nueva misión diaria</span><input id="dq-name" type="text" maxlength="' + R.DAILY_LIMITS.name + '" autocomplete="off" placeholder="Por ejemplo, Ve un capítulo en versión original"></label>' +
              '<label class="field"><span>Subcategoría</span><select id="dq-sub">' + subs.join('') + '</select></label>' +
              '<label class="field"><span>Tamaño</span><select id="dq-size">' + R.DAILY_SIZES.map(function (z) { return '<option value="' + z.id + '">' + z.label + ' · ' + z.xp + ' XP</option>'; }).join('') + '</select></label>' +
              '<button type="button" class="btn" id="dq-addbtn">Añadir</button></div>' +
            '<p class="msg" id="dq-msg" role="status" data-kind="info"></p>' +
            '<p class="soft" id="dq-restore" hidden>Eliminadas de fábrica: <span id="dq-restore-n"></span> · <button type="button" class="link-btn" id="dq-restore-btn">Recuperarlas</button></p>';
          paintList();
        }
        function reload() { return Promise.all([daily.catalog(), repo.state()]).then(function (r) { cat = r[0]; st = r[1]; }); }
        reload().then(paint).catch(function (err) { body.innerHTML = '<p class="msg" data-kind="error">No se pudieron cargar las misiones diarias. ' + esc((err && err.message) || '') + '</p>'; });

        function run(job, okText) {
          if (busy) return Promise.resolve(); busy = true; say('Guardando…');
          return job().then(reload).then(function () { paintList(); say(okText, 'ok'); })
            .catch(function (e) { say((e && e.message) || 'No se pudo guardar.', 'error'); }).then(function () { busy = false; });
        }
        body.addEventListener('click', function (e) {
          var t = e.target && e.target.closest ? e.target : null; if (!t || !cat) return;
          var f = t.closest('[data-dq-filter]');
          if (f) {
            filter = f.getAttribute('data-dq-filter');
            Array.prototype.forEach.call(body.querySelectorAll('[data-dq-filter]'), function (b) { b.setAttribute('aria-pressed', String(b === f)); });
            return paintList();
          }
          var del = t.closest('[data-dq-del]');
          if (del) { var m = cat.missions.filter(function (x) { return x.id === del.getAttribute('data-dq-del'); })[0]; return run(function () { return daily.removeMission(del.getAttribute('data-dq-del')); }, 'Eliminada: ' + (m ? m.name : '') + '. Si hoy ya ha salido, se queda hasta mañana.'); }
          if (t.closest('#dq-restore-btn')) return run(function () { return daily.restoreDefaults(); }, 'Misiones de fábrica recuperadas.');
          if (t.closest('#dq-addbtn')) {
            var name = $('#dq-name').value;
            return run(function () { return daily.addCustom({ name: name, sub: $('#dq-sub').value, size: $('#dq-size').value }); }, 'Añadida: ' + name.trim() + '.')
              .then(function () { if ($('#dq-msg').getAttribute('data-kind') === 'ok') $('#dq-name').value = ''; });
          }
        });
        body.addEventListener('keydown', function (e) { if (e.target && e.target.id === 'dq-name' && e.key === 'Enter') { e.preventDefault(); $('#dq-addbtn').click(); } });
      })();

      // Desde «Editar personaje» (#/ajustes/personaje) o el aviso de las diarias (#/ajustes/diarias): ir a esa sección.
      var jump = opts && opts.params ? { personaje: '#h-personaje', diarias: '#h-diarias' }[opts.params[0]] : null;
      if (jump) setTimeout(function () {
        var h = $(jump); if (!h) return;
        if (h.scrollIntoView) h.scrollIntoView({ block: 'start' });
        if (h.focus) h.focus({ preventScroll: true });
      }, 0);
      $('#pref-theme').addEventListener('change', function (e) { var ok = App.prefs.set({ theme: e.target.value }); App.prefs.apply(); saved(ok); });
      $('#pref-motion').addEventListener('change', function (e) { var ok = App.prefs.set({ motion: e.target.value }); App.prefs.apply(); saved(ok); });

      // ---- Conexión ----
      function message(el, text, kind) { el.textContent = text; el.setAttribute && el.setAttribute('data-kind', kind || 'info'); }

      function paint() {
        var d = App.connection.describe();
        var configured = !!(d.repo && d.hasToken);
        var tag = $('#conn-tag'), text = $('#conn-text');
        if (d.state === 'connected') { tag.textContent = 'Conectado'; text.textContent = 'Tus datos se guardan en «' + d.repo + '» (privado, rama ' + d.branch + ').'; }
        else if (d.state === 'error') { tag.textContent = 'Sin conexión'; text.textContent = d.message; }
        else if (d.state === 'configured') { tag.textContent = 'Sin comprobar'; text.textContent = 'Hay un repositorio guardado en este navegador: «' + d.repo + '». Pulsa «Comprobar conexión».'; }
        else { tag.textContent = 'Sin conectar'; text.textContent = 'Todavía no se guarda nada fuera de este navegador. Conecta un repositorio privado para empezar.'; }
        $('#conn-check').disabled = !configured;
        $('#conn-disconnect').disabled = !configured;
        $('#backup-export').disabled = d.state !== 'connected';
        $('#backup-import').disabled = d.state !== 'connected';
      }
      paint();
      var unsubscribe = App.connection.onChange(function () {
        if ($('#conn-summary').isConnected === false) { unsubscribe(); return; }   // la vista ya no está en pantalla
        paint();
      });

      var busy = false;
      function setBusy(on) {
        busy = on;
        $('#conn-connect').disabled = on;
        if (!on) paint();
      }

      $('#conn-form').addEventListener('submit', function (e) {
        e.preventDefault();
        if (busy) return;
        var tokenInput = $('#conn-token'), msg = $('#conn-msg'), typed = tokenInput.value.trim();
        setBusy(true);
        message(msg, 'Conectando…', 'info');
        App.connection.connect({
          repo: $('#conn-repo').value, branch: $('#conn-branch').value,
          token: tokenInput.value, remember: $('#conn-remember').checked
        }).then(function (r) {
          tokenInput.value = '';
          var extra = /^ghp_/.test(typed) ? ' Ojo: ese token es de los clásicos y da acceso a todos tus repositorios; es más seguro uno «fine-grained» solo para este.' : '';
          message(msg, 'Conectado a «' + r.repo + '». Tus datos se guardarán ahí.' + extra, 'ok');
        }).catch(function (err) {
          message(msg, err && err.message ? err.message : 'No se pudo conectar.', 'error');
        }).then(function () { setBusy(false); });
      });

      $('#conn-check').addEventListener('click', function () {
        var msg = $('#conn-msg');
        message(msg, 'Comprobando…', 'info');
        App.connection.check().then(function (d) {
          message(msg, d.state === 'connected' ? 'La conexión funciona.' : d.message, d.state === 'connected' ? 'ok' : 'error');
        });
      });

      $('#conn-disconnect').addEventListener('click', function () {
        if (!window.confirm('¿Olvidar el repositorio y el token en este navegador? No se borra nada en GitHub.')) return;
        App.connection.disconnect();
        $('#conn-token').value = '';
        message($('#conn-msg'), 'Desconectado. Tus datos siguen en GitHub, intactos.', 'ok');
      });

      // ---- Copia de seguridad ----
      var backupMsg = $('#backup-msg');
      $('#backup-export').addEventListener('click', function () {
        var store = App.connection.getStore();
        if (!store) { message(backupMsg, 'Conecta tus datos primero.', 'error'); return; }
        message(backupMsg, 'Preparando la copia…', 'info');
        store.exportBundle().then(function (bundle) {
          var n = Object.keys(bundle.files).length;
          App.downloadText('diario-rpg-copia-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(bundle, null, 2));
          message(backupMsg, 'Copia descargada (' + n + (n === 1 ? ' archivo' : ' archivos') + '). Guárdala en un sitio seguro.', 'ok');
        }).catch(function (err) { message(backupMsg, err.message, 'error'); });
      });

      var fileInput = $('#backup-file'), dialog = $('#import-dialog'), pending = null;
      $('#backup-import').addEventListener('click', function () { fileInput.click(); });

      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        var store = App.connection.getStore();
        if (!file) return;
        if (!store) { message(backupMsg, 'Conecta tus datos primero.', 'error'); return; }
        if (file.size > MAX_IMPORT_BYTES) { message(backupMsg, 'El archivo es demasiado grande.', 'error'); return; }
        file.text().then(function (text) {
          var bundle;
          try { bundle = JSON.parse(text); } catch (e) { throw App.storageError('invalid', 'El archivo no es un JSON válido.'); }
          return store.planImport(bundle).then(function (plan) {
            if (!plan.ok) throw App.storageError('invalid', plan.errors[0]);
            pending = { bundle: bundle, plan: plan };
            var count = function (s) { return plan.files.filter(function (f) { return f.status === s; }).length; };
            var fresh = count('new'), over = count('overwrite');
            $('#import-summary').textContent = 'La copia trae ' + plan.files.length + ' archivos: ' + fresh + ' nuevos y ' + over + ' que ya existen en tu repositorio. El archivo meta.json del repositorio nunca se sustituye.';
            $('#import-overwrite').checked = false;
            $('#import-overwrite-line').hidden = over === 0;
            $('#import-overwrite-text').textContent = 'Sobrescribir los ' + over + ' archivos que ya existen (los datos actuales se perderán, aunque GitHub conserva el historial).';
            dialog.showModal();
          });
        }).catch(function (err) { message(backupMsg, err.message, 'error'); });
      });

      $('#import-cancel').addEventListener('click', function () { pending = null; dialog.close(); });
      $('#import-go').addEventListener('click', function () {
        var store = App.connection.getStore();
        if (!pending || !store) { dialog.close(); return; }
        var job = pending; pending = null;
        dialog.close();
        message(backupMsg, 'Importando…', 'info');
        store.applyImport(job.bundle, { overwrite: $('#import-overwrite').checked }).then(function (r) {
          if (r.failed) message(backupMsg, 'Se detuvo en «' + r.failed.path + '»: ' + r.failed.message + ' (escritos: ' + r.written + '). Puedes volver a importar la copia: no se duplica nada.', 'error');
          else message(backupMsg, 'Importación terminada: ' + r.written + ' escritos, ' + r.skipped + ' sin tocar.', 'ok');
        }).catch(function (err) { message(backupMsg, err.message, 'error'); });
      });
    }
  };
})(window.App = window.App || {});
