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

      // ---- Tu personaje: nombre y avatar (símbolo, foto o GIF), con vista previa en el marco de tu nivel ----
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
          if (form.mode === 'url' && R.gifUrl(form.url)) return { kind: 'url', url: R.gifUrl(form.url) };
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
          var grid = U.symbolGrid('cs-symbol', R.AVATARS, form.avatar);
          if (form.mode === 'url') {
            return '<label class="field"><span>Enlace directo al GIF</span><input id="cs-url" type="url" inputmode="url" autocomplete="off" placeholder="Pega aquí el enlace directo" value="' + esc(form.url) + '">' +
              '<small>De Giphy, Tenor o Imgur, el «enlace directo» (acaba en .gif). No se descarga ni se guarda: solo el enlace. Si un día no carga, se ve el símbolo de abajo.</small></label>' + grid;
          }
          return grid;
        }
        function paintPreview() { $('#cs-preview').innerHTML = preview(); }
        function paintMode() { $('#cs-mode').innerHTML = modeHtml(); }
        function say(t, kind) { var m = $('#cs-msg'); m.textContent = t || ''; m.setAttribute('data-kind', kind || 'info'); }
        function paint() {
          var modes = [['symbol', 'Símbolo'], ['photo', 'Foto'], ['url', 'GIF de internet']].map(function (x) {
            return '<li><button type="button" class="emo-cap" data-cs-mode="' + x[0] + '" aria-pressed="' + (form.mode === x[0]) + '"><span>' + x[1] + '</span></button></li>';
          }).join('');
          body.innerHTML = '<div class="char-set"><div class="cs-preview" id="cs-preview" aria-live="polite">' + preview() + '</div><div class="cs-form">' +
            '<label class="field"><span>Nombre del personaje</span><input id="cs-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(form.name) + '"></label>' +
            '<div class="field"><span>Avatar</span><ul class="emo-caps cs-modes" aria-label="Tipo de avatar">' + modes + '</ul></div>' +
            '<div id="cs-mode">' + modeHtml() + '</div>' +
            '<p class="msg" id="cs-msg" role="status" data-kind="info"></p>' +
            '<div class="btn-row"><button type="button" class="btn" id="cs-save">Guardar</button></div></div></div>';
        }

        repo.state().then(function (st) {
          var p = st.profile, img = p.image;
          level = st.computed.general.level;
          form = { name: p.name, avatar: p.avatar, mode: img ? (img.kind === 'photo' ? 'photo' : 'url') : 'symbol', photo: img && img.kind === 'photo' ? img.data : '', url: img && img.kind === 'url' ? img.url : '' };
          paint();
        }).catch(function (err) {
          body.innerHTML = '<p class="msg" data-kind="error">No se pudo cargar tu personaje. ' + esc((err && err.message) || '') + '</p>';
        });

        body.addEventListener('error', V.avatarFallback, true);   // GIF que no carga: la vista previa enseña el símbolo
        body.addEventListener('click', function (e) {
          var t = e.target && e.target.closest ? e.target.closest('[data-cs-mode],#cs-save') : null;
          if (!t || !form) return;
          if (t.id !== 'cs-save') {
            form.mode = t.getAttribute('data-cs-mode');
            Array.prototype.forEach.call(body.querySelectorAll('[data-cs-mode]'), function (b) { b.setAttribute('aria-pressed', String(b === t)); });
            paintMode(); paintPreview(); say(''); return;
          }
          if (busy) return;
          var img = null;
          if (form.mode === 'photo') { if (!form.photo) { say('Elige una foto primero.', 'error'); return; } img = { kind: 'photo', data: form.photo }; }
          if (form.mode === 'url') { if (!form.url.trim()) { say('Pega el enlace directo del GIF.', 'error'); return; } img = { kind: 'url', url: form.url.trim() }; }
          busy = true; t.disabled = true; say('Guardando…');
          repo.saveProfile({ name: $('#cs-name').value, avatar: form.avatar, image: img })
            .then(function () { say('Guardado. Ya se ve en tu ficha de Personaje.', 'ok'); })
            .catch(function (err) { say((err && err.message) || 'No se pudo guardar.', 'error'); })
            .then(function () { busy = false; t.disabled = false; });
        });
        body.addEventListener('change', function (e) {
          var t = e.target; if (!t || !form) return;
          if (t.name === 'cs-symbol') { form.avatar = t.value; paintPreview(); return; }
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

        // Desde «Editar personaje» (#/ajustes/personaje): ir directamente a esta sección.
        if (opts && opts.params && opts.params[0] === 'personaje') setTimeout(function () {
          var h = $('#h-personaje'); if (!h) return;
          if (h.scrollIntoView) h.scrollIntoView({ block: 'start' });
          if (h.focus) h.focus({ preventScroll: true });
        }, 0);
      })();
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
