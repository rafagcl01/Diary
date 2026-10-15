// Ficha del personaje: nivel general, radar de cinco atributos, subcategorías con su historial y apuntes de experiencia.
// La experiencia solo entra por acciones explícitas (aquí: apuntar una actividad o un ajuste con motivo). El diario no da XP.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews;
  App.views = App.views || {};

  function fmtDay(day) {
    var d = new Date(day + 'T12:00:00');
    return isNaN(d.getTime()) ? day : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function bar(fraction, label) {
    return '<div class="xpbar" role="img" aria-label="' + esc(label) + '"><span style="width:' + Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%"></span></div>';
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  // ---- Piezas de HTML ----
  function heroHtml(st) {
    var g = st.computed.general, p = st.profile;
    var name = p.name || 'Tu personaje';
    return '<section class="card paper sheet char-hero" aria-labelledby="char-name">' +
      '<span class="avatar char-avatar">' + icon(p.avatar) + '</span>' +
      '<div class="char-id"><h2 id="char-name">' + esc(name) + '</h2>' +
        '<p class="char-title soft">Título: ninguno todavía</p>' +
        '<p class="char-level"><strong>Nivel ' + g.level + '</strong> <span class="soft">· ' + g.into + ' / ' + g.need + ' XP para el siguiente</span></p>' +
        bar(g.fraction, 'Nivel ' + g.level + ': ' + g.into + ' de ' + g.need + ' XP') +
        '<p class="soft char-total">' + g.total + ' XP en total</p></div>' +
      '<div class="btn-row char-actions">' +
        '<button type="button" class="btn" data-act="xp">Apuntar actividad</button>' +
        '<button type="button" class="btn secondary" data-act="profile">Editar personaje</button>' +
        '<button type="button" class="btn secondary" data-act="adjust">Corregir experiencia</button></div>' +
    '</section>';
  }

  function subCard(s, entries) {
    var mine = entries.filter(function (e) { return (e.splits || []).some(function (x) { return x.sub === s.id; }); }).slice(-8).reverse();
    var hist = mine.length ? '<ul class="hist">' + mine.map(function (e) {
      var part = e.splits.filter(function (x) { return x.sub === s.id; })[0];
      return '<li><span>' + esc(e.label) + (e.kind === 'adjustment' ? ' <em>(ajuste)</em>' : '') + '</span><span class="soft">' + esc(fmtDay(e.day)) + '</span><strong>' + (part.xp > 0 ? '+' : '') + part.xp + ' XP</strong></li>';
    }).join('') + '</ul>' : '<p class="soft">Todavía sin historial.</p>';
    return '<li class="sub-card" data-sub="' + esc(s.id) + '"' + (s.id === 'brujeria' ? ' data-magic="1"' : '') + (s.archived ? ' data-archived="1"' : '') + '>' +
      '<div class="sub-head"><span class="sub-ic">' + icon(s.icon) + '</span>' +
        '<div class="sub-name"><h3>' + esc(s.name) + '</h3>' + (s.description ? '<p class="soft">' + esc(s.description) + '</p>' : '') + '</div>' +
        '<span class="sub-lv">Nv ' + s.level + '</span></div>' +
      bar(s.fraction, esc(s.name) + ' nivel ' + s.level + ': ' + s.into + ' de ' + s.need + ' XP') +
      '<p class="soft sub-xp">' + s.into + ' / ' + s.need + ' XP · ' + s.xp + ' en total</p>' +
      '<details class="sub-hist"><summary>Historial</summary>' + hist + '</details>' +
      '<div class="sub-tools">' +
        '<button type="button" class="mini" data-act="sub-edit" data-id="' + esc(s.id) + '">Editar</button>' +
        (s.archived ? '' : '<button type="button" class="mini" data-act="sub-up" data-id="' + esc(s.id) + '" aria-label="Subir ' + esc(s.name) + '">↑</button><button type="button" class="mini" data-act="sub-down" data-id="' + esc(s.id) + '" aria-label="Bajar ' + esc(s.name) + '">↓</button>') +
        '<button type="button" class="mini" data-act="sub-archive" data-id="' + esc(s.id) + '" data-to="' + (s.archived ? '0' : '1') + '">' + (s.archived ? 'Recuperar' : 'Archivar') + '</button>' +
      '</div></li>';
  }

  function panelHtml(m, entries) {
    var active = m.subs.filter(function (s) { return !s.archived; }), archived = m.subs.filter(function (s) { return s.archived; });
    return '<section class="card attr-panel" data-main="' + esc(m.id) + '" aria-labelledby="attr-title">' +
      '<div class="attr-head"><span class="sub-ic big">' + icon(m.icon) + '</span><div><h2 id="attr-title">' + esc(m.name) + '</h2>' +
      '<p class="soft">' + esc(m.description) + '</p></div><span class="sub-lv">Nv ' + m.level + '</span></div>' +
      bar(m.fraction, esc(m.name) + ' nivel ' + m.level + ', ' + Math.round(m.fraction * 100) + ' por ciento') +
      '<p class="soft sub-xp">Se calcula con la media de sus subcategorías. No tiene experiencia propia.</p>' +
      '<div class="btn-row"><button type="button" class="mini" data-act="sub-new">Nueva subcategoría</button><button type="button" class="mini" data-act="main-edit">Editar atributo</button></div>' +
      '<ul class="sub-list">' + active.map(function (s) { return subCard(s, entries); }).join('') + '</ul>' +
      (archived.length ? '<details class="archived"><summary>Archivadas (' + archived.length + ')</summary><ul class="sub-list">' + archived.map(function (s) { return subCard(s, entries); }).join('') + '</ul></details>' : '') +
    '</section>';
  }

  function recentHtml(entries) {
    var last = entries.slice(-6).reverse();
    if (!last.length) return '<section class="card recent"><h2>Últimas recompensas</h2><p class="soft">Aún no hay experiencia. Cuando completes una misión o apuntes una actividad, aparecerá aquí.</p></section>';
    return '<section class="card recent"><h2>Últimas recompensas</h2><ul class="hist">' + last.map(function (e) {
      return '<li><span>' + esc(e.label) + (e.kind === 'adjustment' ? ' <em>(ajuste: ' + esc(e.reason || '') + ')</em>' : '') + '</span><span class="soft">' + esc(fmtDay(e.day)) + '</span><strong>' + (e.xp > 0 ? '+' : '') + e.xp + ' XP</strong></li>';
    }).join('') + '</ul></section>';
  }

  // ---- Diálogos ----
  function symbolGrid(name, list, current) {
    return '<fieldset class="symbols"><legend>Icono</legend><div class="symbol-grid">' + list.map(function (id) {
      return '<label class="symbol"><input type="radio" name="' + name + '" value="' + id + '"' + (id === current ? ' checked' : '') + '><span class="symbol-box">' + icon(id) + '</span><span class="sr">' + esc(id) + '</span></label>';
    }).join('') + '</div></fieldset>';
  }

  App.views.character = {
    render: function (root) {
      var repo = R.repo();
      var host = '<div class="view rpg-view">' +
        App.pageHeader('Tu personaje', 'Tu nivel, tus atributos y tu progreso. La experiencia solo llega de lo que decides apuntar o completar.', 'ficha de personaje') + App.lace() + '<div id="rpg-body"></div>' +
        '<dialog class="confirm rpg-dialog" id="rpg-dialog" aria-labelledby="rpg-dtitle"></dialog></div>';
      root.innerHTML = host;
      var $ = function (s) { return root.querySelector(s); };
      var body = $('#rpg-body'), view = $('.rpg-view');
      if (!repo) {
        body.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + icon('star') + '</div><h2>Conecta tus datos para ver tu personaje</h2>' +
          '<p>Tu experiencia se guarda en tu repositorio de datos, junto al diario. Nunca solo en el navegador.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>';
        return;
      }
      body.innerHTML = '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>';
      var st = null, selected = 'vitalidad', note = '', form = null;

      function paint() {
        var c = st.computed;
        if (!c.mains.some(function (m) { return m.id === selected; })) selected = c.mains[0].id;
        var main = c.mains.filter(function (m) { return m.id === selected; })[0];
        body.innerHTML = heroHtml(st) +
          '<p class="msg" id="rpg-msg" role="status" data-kind="ok">' + esc(note) + '</p>' +
          '<section class="card radar-card" aria-labelledby="radar-title"><h2 id="radar-title">Tus cinco atributos</h2>' +
            '<p class="soft">Elige una punta para ver sus subcategorías.</p>' + V.radar(c.mains, { selected: selected }) + '</section>' +
          panelHtml(main, st.entries) + recentHtml(st.entries) +
          '<nav class="btn-row" aria-label="Más sobre tu personaje"><a class="btn secondary" href="#/misiones">Misiones activas</a><a class="btn secondary" href="#/coleccion">Colección</a></nav>';
      }
      function reload() { return repo.state(true).then(function (s) { st = s; paint(); }); }
      function say(msg) { note = msg; var el = $('#rpg-msg'); if (el) { el.textContent = msg; } }

      // ---- Formularios en el diálogo ----
      var dlg = function () { return $('#rpg-dialog'); };
      function openDialog(html) { dlg().innerHTML = html; dlg().showModal(); }
      function closeDialog() { dlg().close(); }
      function dmsg(text, kind) { var el = $('#rpg-dmsg'); if (el) { el.textContent = text || ''; el.setAttribute('data-kind', kind || 'error'); } }

      function equalShares(ids) {
        var out = {}, n = ids.length; if (!n) return out;
        var each = Math.floor(100 / n);
        ids.forEach(function (id, i) { out[id] = each + (i === 0 ? 100 - each * n : 0); });
        return out;
      }
      function allSubs(includeArchived) {
        var list = [];
        st.computed.mains.forEach(function (m) { m.subs.forEach(function (s) { if (includeArchived || !s.archived) list.push({ id: s.id, name: s.name, icon: s.icon, main: m.name, archived: s.archived }); }); });
        return list;
      }
      function sharesBlock() {
        var subs = allSubs(form.mode === 'adjust');
        var picked = Object.keys(form.shares);
        var total = picked.reduce(function (t, id) { return t + (form.shares[id] || 0); }, 0);
        return '<fieldset class="shares"><legend>¿A qué subcategorías va?</legend>' +
          '<p class="soft">Opcional. Si no eliges ninguna, solo sube el nivel general.</p>' +
          '<ul class="emo-caps" aria-label="Subcategorías">' + subs.map(function (s) {
            return '<li><button type="button" class="emo-cap" data-share="' + esc(s.id) + '" aria-pressed="' + (form.shares[s.id] !== undefined) + '">' + icon(s.icon) + '<span>' + esc(s.name) + '</span></button></li>';
          }).join('') + '</ul>' +
          (picked.length ? '<div class="share-rows">' + picked.map(function (id) {
            var f = R.findSub(st.structure, id);
            return '<label class="share-row"><span>' + esc(f ? f.sub.name : id) + '</span><input type="number" inputmode="numeric" min="1" max="100" step="1" data-pct="' + esc(id) + '" value="' + form.shares[id] + '"><span>%</span></label>';
          }).join('') + '<p class="soft" id="share-total" role="status">Suman ' + total + '%' + (total === 100 ? '' : ' (deben sumar 100)') + '</p></div>' : '') +
        '</fieldset>';
      }
      function repaintShares() { var el = $('#rpg-shares'); if (el) el.innerHTML = sharesBlock(); }
      function sharesList() { return Object.keys(form.shares).map(function (id) { return { sub: id, pct: form.shares[id] }; }); }

      function openXp() {
        form = { mode: 'xp', req: R.newRequestId(), size: 'normal', shares: {} };
        openDialog('<h3 id="rpg-dtitle">Apuntar una actividad</h3>' +
          '<p class="soft">Suma experiencia por algo que has hecho. Cada apunte cuenta una sola vez.</p>' +
          '<label class="field"><span>¿Qué has hecho?</span><input id="xp-label" type="text" maxlength="' + R.LIMITS.label + '" autocomplete="off" placeholder="Por ejemplo, Sesión de dibujo"></label>' +
          '<fieldset class="symbols"><legend>Tamaño</legend><ul class="emo-caps" aria-label="Tamaño">' + R.QUEST_SIZES.map(function (z) {
            return '<li><button type="button" class="emo-cap" data-size="' + z.id + '" aria-pressed="' + (z.id === form.size) + '"><span>' + z.label + ' · ' + z.xp + ' XP</span></button></li>';
          }).join('') + '</ul></fieldset>' +
          '<div id="rpg-shares">' + sharesBlock() + '</div>' +
          '<p class="msg" id="rpg-dmsg" role="status" data-kind="error"></p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="xp-save">Sumar experiencia</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>');
      }
      function openAdjust() {
        form = { mode: 'adjust', req: R.newRequestId(), shares: {} };
        openDialog('<h3 id="rpg-dtitle">Corregir experiencia</h3>' +
          '<p class="soft">Nada se borra: la corrección queda en el historial como un ajuste visible, con su motivo.</p>' +
          '<label class="field"><span>¿Qué corriges?</span><input id="xp-label" type="text" maxlength="' + R.LIMITS.label + '" autocomplete="off" placeholder="Por ejemplo, Apunté dos veces el gimnasio"></label>' +
          '<label class="field"><span>Motivo</span><input id="xp-reason" type="text" maxlength="' + R.LIMITS.reason + '" autocomplete="off"></label>' +
          '<div class="adj-row"><label class="field"><span>Acción</span><select id="xp-dir"><option value="-1">Quitar</option><option value="1">Añadir</option></select></label>' +
          '<label class="field"><span>XP</span><input id="xp-amount" type="number" inputmode="numeric" min="1" max="' + R.LIMITS.maxXp + '" step="1"></label></div>' +
          '<div id="rpg-shares">' + sharesBlock() + '</div>' +
          '<p class="msg" id="rpg-dmsg" role="status" data-kind="error"></p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="adjust-save">Guardar ajuste</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>');
      }
      function openProfile() {
        var p = st.profile;
        openDialog('<h3 id="rpg-dtitle">Tu personaje</h3>' +
          '<label class="field"><span>Nombre</span><input id="pf-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(p.name) + '"></label>' +
          symbolGrid('pf-avatar', R.AVATARS, p.avatar) +
          '<p class="msg" id="rpg-dmsg" role="status" data-kind="error"></p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="profile-save">Guardar</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>');
      }
      function openSub(sub) {
        form = { mode: 'sub', id: sub ? sub.id : null };
        openDialog('<h3 id="rpg-dtitle">' + (sub ? 'Editar subcategoría' : 'Nueva subcategoría') + '</h3>' +
          (sub ? '<p class="soft">Cambiar el nombre no toca su experiencia ni su historial.</p>' : '') +
          '<label class="field"><span>Nombre</span><input id="sb-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(sub ? sub.name : '') + '"></label>' +
          '<label class="field"><span>Descripción</span><input id="sb-desc" type="text" maxlength="' + R.LIMITS.description + '" autocomplete="off" value="' + esc(sub ? sub.description : '') + '"></label>' +
          symbolGrid('sb-icon', R.ICONS, sub ? sub.icon : 'star') +
          '<p class="msg" id="rpg-dmsg" role="status" data-kind="error"></p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="sub-save">Guardar</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>');
      }
      function openMain() {
        var m = st.computed.mains.filter(function (x) { return x.id === selected; })[0];
        form = { mode: 'main', id: m.id };
        openDialog('<h3 id="rpg-dtitle">Editar atributo</h3>' +
          '<label class="field"><span>Nombre</span><input id="sb-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(m.name) + '"></label>' +
          '<label class="field"><span>Descripción</span><input id="sb-desc" type="text" maxlength="' + R.LIMITS.description + '" autocomplete="off" value="' + esc(m.description) + '"></label>' +
          symbolGrid('sb-icon', R.ICONS, m.icon) +
          '<p class="msg" id="rpg-dmsg" role="status" data-kind="error"></p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="main-save">Guardar</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>');
      }
      function checkedValue(name) { var el = root.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : undefined; }

      // Guarda un apunte y solo entonces anuncia la recompensa (cuando GitHub ha confirmado).
      function saveEntry(input) {
        var before = st.computed.general.level, btn = $('[data-act="xp-save"]') || $('[data-act="adjust-save"]');
        if (btn) btn.disabled = true;
        dmsg('Guardando…', 'info');
        return repo.addEntry(input).then(function (r) {
          return repo.state(true).then(function (s) {
            st = s; closeDialog(); paint();
            var xp = r.entry ? r.entry.xp : input.xp;
            var msg = r.duplicate ? 'Ese apunte ya estaba guardado: no se ha contado dos veces.' :
              (xp > 0 ? '+' + xp + ' XP' : xp + ' XP') + ' · ' + r.entry.label + (s.computed.general.level > before ? ' · ¡Subes al nivel ' + s.computed.general.level + '!' : '');
            say(msg);
          });
        }).catch(function (err) {
          if (btn) btn.disabled = false;
          dmsg((err && err.message) || 'No se pudo guardar. No se ha sumado nada; puedes volver a intentarlo.', 'error');
        });
      }
      function guard(promise) {
        return promise.then(function () { return reload(); }).then(function () { closeDialog(); }).catch(function (err) { dmsg((err && err.message) || 'No se pudo guardar.', 'error'); });
      }

      view.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-main],[data-share],[data-size]') : null;
        if (!t) return;
        var main = t.getAttribute('data-main');
        if (main && !t.getAttribute('data-act')) { selected = main; paint(); var again = root.querySelector('.rd-label.on'); if (again && again.focus) again.focus(); return; }
        var share = t.getAttribute('data-share');
        if (share && form) {
          if (form.shares[share] !== undefined) delete form.shares[share]; else form.shares[share] = 1;
          form.shares = equalShares(Object.keys(form.shares)); repaintShares(); return;
        }
        var size = t.getAttribute('data-size');
        if (size && form) {
          form.size = size;
          Array.prototype.forEach.call(dlg().querySelectorAll('[data-size]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === size)); });
          return;
        }
        var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
        if (act === 'close') return closeDialog();
        if (act === 'xp') return openXp();
        if (act === 'adjust') return openAdjust();
        if (act === 'profile') return openProfile();
        if (act === 'sub-new') return openSub(null);
        if (act === 'main-edit') return openMain();
        if (act === 'sub-edit') { var f = R.findSub(st.structure, id); return f && openSub(f.sub); }
        if (act === 'sub-up' || act === 'sub-down') return repo.moveSub(id, act === 'sub-up' ? -1 : 1).then(reload).catch(function (e) { say(e.message); });
        if (act === 'sub-archive') return repo.setArchived(id, t.getAttribute('data-to') === '1').then(reload).catch(function (e) { say(e.message); });
        if (act === 'profile-save') return guard(repo.saveProfile({ name: $('#pf-name').value, avatar: checkedValue('pf-avatar') }));
        if (act === 'sub-save') {
          var data = { name: $('#sb-name').value, description: $('#sb-desc').value, icon: checkedValue('sb-icon') };
          return guard(form.id ? repo.updateSub(form.id, data) : repo.createSub(selected, data));
        }
        if (act === 'main-save') return guard(repo.updateMain(form.id, { name: $('#sb-name').value, description: $('#sb-desc').value, icon: checkedValue('sb-icon') }));
        if (act === 'xp-save') {
          var z = R.QUEST_SIZES.filter(function (q) { return q.id === form.size; })[0];
          return saveEntry({ kind: 'manual', key: 'manual:' + form.req, label: $('#xp-label').value, xp: z.xp, shares: sharesList(), day: today() });
        }
        if (act === 'adjust-save') {
          var amount = Number($('#xp-amount').value), dir = Number($('#xp-dir').value) < 0 ? -1 : 1;
          return saveEntry({ kind: 'adjustment', key: 'adjust:' + form.req, label: $('#xp-label').value, reason: $('#xp-reason').value, xp: dir * amount, shares: sharesList(), day: today() });
        }
      });
      view.addEventListener('input', function (ev) {
        var t = ev.target, id = t && t.getAttribute ? t.getAttribute('data-pct') : null;
        if (!id || !form) return;
        form.shares[id] = Math.floor(Number(t.value)) || 0;
        var total = Object.keys(form.shares).reduce(function (s, k) { return s + (form.shares[k] || 0); }, 0);
        var el = $('#share-total'); if (el) el.textContent = 'Suman ' + total + '%' + (total === 100 ? '' : ' (deben sumar 100)');
      });
      view.addEventListener('keydown', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('.rd-label') : null;
        if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); selected = t.getAttribute('data-main'); paint(); var again = root.querySelector('.rd-label.on'); if (again && again.focus) again.focus(); }
      });

      repo.state().then(function (s) { st = s; paint(); }).catch(function (err) {
        body.innerHTML = '<div class="msg" data-kind="error">No se pudo cargar tu personaje. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>';
      });
    }
  };
})(window.App = window.App || {});
