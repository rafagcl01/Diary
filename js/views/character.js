// Ficha del personaje: todo cabe en una pantalla. A la izquierda, nivel y últimas recompensas; a la derecha, el radar.
// Al pulsar un atributo, el radar se convierte en el de sus subcategorías (flecha arriba a la izquierda para volver).
// La experiencia solo entra por acciones explícitas (actividades, misiones, apuntes). El diario no da XP.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util;
  App.views = App.views || {};

  function bar(f, label) { return U.bar(f, label); }

  // ---- Piezas de HTML ----
  function heroHtml(st) {
    var g = st.computed.general, p = st.profile;
    return '<section class="card paper sheet char-hero" aria-labelledby="char-name">' +
      '<span class="avatar char-avatar">' + icon(p.avatar) + '</span>' +
      '<div class="char-id"><h2 id="char-name">' + esc(p.name || 'Tu personaje') + '</h2>' +
        '<p class="char-title soft">Título: ninguno todavía</p>' +
        '<p class="char-level"><strong>Nivel ' + g.level + '</strong> <span class="soft">· ' + g.into + ' / ' + g.need + ' XP · ' + g.total + ' en total</span></p>' +
        bar(g.fraction, 'Nivel ' + g.level + ': ' + g.into + ' de ' + g.need + ' XP') +
        '</div>' +
      '<div class="btn-row char-actions">' +
        '<a class="btn" href="#/misiones/actividades">Registrar actividad</a>' +
        '<button type="button" class="btn secondary" data-act="xp">Apunte manual</button>' +
        '<button type="button" class="btn secondary" data-act="profile">Editar personaje</button>' +
        '<button type="button" class="btn secondary" data-act="adjust">Corregir XP</button></div>' +
    '</section>';
  }

  function recentHtml(entries) {
    var last = entries.slice(-3).reverse(), voided = R.voidedKeys(entries);
    if (!last.length) return '<section class="card recent"><h2>Últimas recompensas</h2><p class="soft">Aún no hay experiencia. Cuando completes una misión o registres una actividad, aparecerá aquí.</p></section>';
    return '<section class="card recent"><h2>Últimas recompensas</h2><ul class="hist">' + last.map(function (e) {
      var canVoid = (e.kind === 'manual' || e.kind === 'activity') && !voided[e.key];
      return '<li><span>' + esc(e.label) + (e.kind === 'adjustment' ? ' <em>(ajuste: ' + esc(e.reason || '') + ')</em>' : '') + (voided[e.key] ? ' <em>(anulado)</em>' : '') +
        (canVoid ? ' <button type="button" class="mini" data-act="void" data-key="' + esc(e.key) + '" aria-label="Anular: ' + esc(e.label) + '">Anular</button>' : '') +
        '</span><span class="soft">' + esc(U.fmtDay(e.day)) + '</span><strong>' + (e.xp > 0 ? '+' : '') + e.xp + ' XP</strong></li>';
    }).join('') + '</ul></section>';
  }

  function mainInfo(m) {
    var n = m.subs.filter(function (s) { return !s.archived; }).length;
    return '<span class="sub-ic">' + icon(m.icon) + '</span><div class="info-body"><h3>' + esc(m.name) + ' <span class="sub-lv">Nv ' + m.level + '</span></h3>' +
      '<p class="soft">' + esc(m.description) + '</p><p class="soft">Media de ' + n + ' subcategorías · ' + Math.round(m.fraction * 100) + '% hacia el nivel ' + (m.level + 1) + '</p></div>';
  }
  function subInfo(s) {
    return '<span class="sub-ic">' + icon(s.icon) + '</span><div class="info-body"><h3>' + esc(s.name) + ' <span class="sub-lv">Nv ' + s.level + '</span></h3>' +
      (s.description ? '<p class="soft">' + esc(s.description) + '</p>' : '') +
      bar(s.fraction, s.name + ' nivel ' + s.level + ': ' + s.into + ' de ' + s.need + ' XP') +
      '<p class="soft">' + s.into + ' / ' + s.need + ' XP · ' + s.xp + ' en total</p>' +
      '<div class="sub-tools"><button type="button" class="mini" data-act="sub-hist" data-id="' + esc(s.id) + '">Historial</button><button type="button" class="mini" data-act="sub-edit" data-id="' + esc(s.id) + '" data-back="">Editar</button></div></div>';
  }

  function radarCard(c, nav) {
    if (nav.level === 'main') {
      return '<section class="card radar-card" aria-labelledby="radar-title"><div class="rc-head"><h2 id="radar-title">Tus cinco atributos</h2></div>' +
        V.radar(c.mains, { selected: '', kind: 'main', animate: nav.anim }) +
        '<div class="info" id="rd-info" aria-live="polite"><p class="soft">Pulsa un atributo para ver sus subcategorías.</p></div></section>';
    }
    var m = c.mains.filter(function (x) { return x.id === nav.main; })[0];
    var active = m.subs.filter(function (s) { return !s.archived; });
    var items = active.map(function (s) { return { id: s.id, name: s.name, level: s.level, fraction: s.fraction, value: s.progress, magic: s.id === 'brujeria' }; });
    var sel = active.filter(function (s) { return s.id === nav.sel; })[0];
    var magic = sel && sel.id === 'brujeria';
    var chart = items.length >= 3 ? V.radar(items, { selected: sel ? sel.id : '', kind: 'sub', animate: nav.anim }) :
      '<div class="rd-fallback"><p class="soft">Con menos de 3 subcategorías activas no hay gráfico. Elige una o recupera alguna en «Gestionar».</p>' +
      active.map(function (s) { return '<button type="button" class="emo-cap" data-sub="' + esc(s.id) + '" aria-pressed="' + (!!sel && sel.id === s.id) + '">' + icon(s.icon) + '<span>' + esc(s.name) + '</span></button>'; }).join(' ') + '</div>';
    return '<section class="card radar-card" data-level="sub" data-theme-main="' + esc(m.id) + '"' + (magic ? ' data-magic-sel="1"' : '') + ' aria-labelledby="radar-title">' +
      '<div class="rc-head"><button type="button" class="rd-back" data-act="back" aria-label="Volver a los atributos">' + icon('chev-l') + '</button>' +
      '<h2 id="radar-title">' + esc(m.name) + ' <span class="sub-lv">Nv ' + m.level + '</span></h2>' +
      '<button type="button" class="mini rc-manage" data-act="sub-manage">Gestionar</button></div>' + chart +
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
      var body = $('#rpg-body'), view = $('.rpg-view');
      if (!repo) {
        body.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + icon('star') + '</div><h2>Conecta tus datos para ver tu personaje</h2>' +
          '<p>Tu experiencia se guarda en tu repositorio de datos, junto al diario. Nunca solo en el navegador.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>';
        return;
      }
      body.innerHTML = '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>';
      var st = null, nav = { level: 'main', main: null, sel: null }, note = '', form = null;

      function paint() {
        var c = st.computed;
        if (nav.level === 'sub' && !c.mains.some(function (m) { return m.id === nav.main; })) nav = { level: 'main', main: null, sel: null };
        body.innerHTML = '<div class="char-grid">' + heroHtml(st) + '<div class="char-radar">' + radarCard(c, nav) + '</div>' +
          '<div class="char-side"><p class="msg" id="rpg-msg" role="status" data-kind="ok">' + esc(note) + '</p>' + recentHtml(st.entries) +
          '<nav class="btn-row" aria-label="Más sobre tu personaje"><a class="btn secondary" href="#/misiones">Misiones activas</a><a class="btn secondary" href="#/coleccion">Colección</a></nav></div></div>';
        nav.anim = false;
      }
      function focusSel(sel) { var el = root.querySelector(sel); if (el && el.focus) el.focus(); }
      function reload() { return repo.state(true).then(function (s) { st = s; paint(); }); }
      function say(msg) { note = msg; var el = $('#rpg-msg'); if (el) el.textContent = msg; }
      function mainById(id) { return st.computed.mains.filter(function (m) { return m.id === id; })[0]; }

      // ---- Diálogos ----
      var dlg = function () { return $('#rpg-dialog'); };
      function openDialog(html) { dlg().innerHTML = html; if (!dlg().open) dlg().showModal(); }
      function closeDialog() { if (dlg().open) dlg().close(); }
      function dmsg(text, kind) { var el = $('#rpg-dmsg'); if (el) { el.textContent = text || ''; el.setAttribute('data-kind', kind || 'error'); } }
      var DMSG = '<p class="msg" id="rpg-dmsg" role="status" data-kind="error"></p>';

      function sharesBlock() {
        var K = V.pickers;
        return K.html(K.groups(st.structure, form.mode === 'adjust'), U.subNames(st.structure), form.shares, 'pct');
      }
      function repaintShares() { var el = $('#rpg-shares'); if (el) el.innerHTML = sharesBlock(); }
      function sharesList() { return V.pickers.toList(form.shares, 'pct'); }

      function openXp() {
        form = { mode: 'xp', req: R.newRequestId(), size: 'normal', shares: {} };
        openDialog('<h3 id="rpg-dtitle">Apunte manual</h3>' +
          '<p class="soft">Para algo que no está entre tus actividades ni misiones. Cada apunte cuenta una sola vez.</p>' +
          '<label class="field"><span>¿Qué has hecho?</span><input id="xp-label" type="text" maxlength="' + R.LIMITS.label + '" autocomplete="off" placeholder="Por ejemplo, Sesión de dibujo"></label>' +
          '<fieldset class="symbols"><legend>Tamaño</legend><ul class="emo-caps" aria-label="Tamaño">' + R.QUEST_SIZES.map(function (z) {
            return '<li><button type="button" class="emo-cap" data-size="' + z.id + '" aria-pressed="' + (z.id === form.size) + '"><span>' + z.label + ' · ' + z.xp + ' XP</span></button></li>';
          }).join('') + '</ul></fieldset>' +
          '<fieldset class="shares"><legend>¿A qué subcategorías va?</legend><div id="rpg-shares">' + sharesBlock() + '</div></fieldset>' + DMSG +
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
          '<fieldset class="shares"><legend>¿A qué subcategorías afecta?</legend><div id="rpg-shares">' + sharesBlock() + '</div></fieldset>' + DMSG +
          '<div class="btn-row"><button type="button" class="btn" data-act="adjust-save">Guardar ajuste</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>');
      }
      function openProfile() {
        var p = st.profile;
        form = { mode: 'profile' };
        openDialog('<h3 id="rpg-dtitle">Tu personaje</h3>' +
          '<label class="field"><span>Nombre</span><input id="pf-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(p.name) + '"></label>' +
          U.symbolGrid('pf-avatar', R.AVATARS, p.avatar) + DMSG +
          '<div class="btn-row"><button type="button" class="btn" data-act="profile-save">Guardar</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>');
      }
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
          U.symbolGrid('sb-icon', R.ICONS, sub ? sub.icon : 'star') + DMSG +
          '<div class="btn-row"><button type="button" class="btn" data-act="sub-save">Guardar</button><button type="button" class="btn secondary" data-act="' + (back ? 'sub-manage' : 'close') + '">Cancelar</button></div>');
      }
      function openMain() {
        var m = mainById(nav.main);
        form = { mode: 'main', id: m.id, back: true };
        openDialog('<h3 id="rpg-dtitle">Editar atributo</h3>' +
          '<label class="field"><span>Nombre</span><input id="sb-name" type="text" maxlength="' + R.LIMITS.name + '" autocomplete="off" value="' + esc(m.name) + '"></label>' +
          '<label class="field"><span>Descripción</span><input id="sb-desc" type="text" maxlength="' + R.LIMITS.description + '" autocomplete="off" value="' + esc(m.description) + '"></label>' +
          U.symbolGrid('sb-icon', R.ICONS, m.icon) + DMSG +
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
            say(r.duplicate ? 'Ese apunte ya estaba guardado: no se ha contado dos veces.' :
              (xp > 0 ? '+' + xp + ' XP' : xp + ' XP') + ' · ' + r.entry.label + U.levelNote(before, s.computed.general.level));
          });
        }).catch(function (err) {
          if (btn) btn.disabled = false;
          dmsg((err && err.message) || 'No se pudo guardar. No se ha sumado nada; puedes volver a intentarlo.', 'error');
        });
      }
      // Tras guardar un cambio de estructura: recarga y vuelve a la gestión (si se venía de ahí) o cierra.
      function guard(promise, back) {
        return promise.then(function () { return reload(); }).then(function () { if (back) openManage(); else closeDialog(); }).catch(function (err) { dmsg((err && err.message) || 'No se pudo guardar.', 'error'); });
      }
      function manageOp(promise) { return promise.then(reload).then(openManage).catch(function (e) { dmsg(e.message); }); }

      view.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-main],[data-sub],[data-pk],[data-size]') : null;
        if (!t) return;
        var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
        if (!act) {
          var main = t.getAttribute('data-main'), sub = t.getAttribute('data-sub'), pk = t.getAttribute('data-pk'), size = t.getAttribute('data-size');
          if (main) { nav = { level: 'sub', main: main, sel: null, anim: true }; paint(); return focusSel('.rd-back'); }
          if (sub) { nav.sel = nav.sel === sub ? null : sub; paint(); return focusSel('.rd-label.on') || focusSel('.rd-fallback button[aria-pressed="true"]'); }
          if (pk && form) { V.pickers.toggle(form.shares, pk, 'pct'); return repaintShares(); }
          if (size && form) {
            form.size = size;
            Array.prototype.forEach.call(dlg().querySelectorAll('[data-size]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-size') === size)); });
          }
          return;
        }
        if (act === 'back') { var was = nav.main; nav = { level: 'main', main: null, sel: null, anim: true }; paint(); return focusSel('.rd-label[data-main="' + was + '"]'); }
        if (act === 'void') return repo.voidEntry(t.getAttribute('data-key')).then(function (r) { return reload().then(function () { say(r.duplicate ? 'Ese apunte ya estaba anulado.' : 'Apunte anulado: queda en el historial como un ajuste.'); }); }).catch(function (e) { say(e.message); });
        if (act === 'close') return closeDialog();
        if (act === 'xp') return openXp();
        if (act === 'adjust') return openAdjust();
        if (act === 'profile') return openProfile();
        if (act === 'sub-manage') return openManage();
        if (act === 'sub-new') return openSub(null, true);
        if (act === 'main-edit') return openMain();
        if (act === 'sub-hist') return openHistory(id);
        if (act === 'sub-edit') { var f = R.findSub(st.structure, id); return f && openSub(f.sub, t.getAttribute('data-back') === '1'); }
        if (act === 'sub-up' || act === 'sub-down') return manageOp(repo.moveSub(id, act === 'sub-up' ? -1 : 1));
        if (act === 'sub-archive') return manageOp(repo.setArchived(id, t.getAttribute('data-to') === '1'));
        if (act === 'profile-save') return guard(repo.saveProfile({ name: $('#pf-name').value, avatar: checkedValue('pf-avatar') }), false);
        if (act === 'sub-save') {
          var data = { name: $('#sb-name').value, description: $('#sb-desc').value, icon: checkedValue('sb-icon') };
          return guard(form.id ? repo.updateSub(form.id, data) : repo.createSub(nav.main, data), form.back);
        }
        if (act === 'main-save') return guard(repo.updateMain(form.id, { name: $('#sb-name').value, description: $('#sb-desc').value, icon: checkedValue('sb-icon') }), true);
        if (act === 'xp-save') {
          var z = R.QUEST_SIZES.filter(function (q) { return q.id === form.size; })[0];
          return saveEntry({ kind: 'manual', key: 'manual:' + form.req, label: $('#xp-label').value, xp: z.xp, shares: sharesList(), day: R.today() });
        }
        if (act === 'adjust-save') {
          var amount = Number($('#xp-amount').value), dir = Number($('#xp-dir').value) < 0 ? -1 : 1;
          return saveEntry({ kind: 'adjustment', key: 'adjust:' + form.req, label: $('#xp-label').value, reason: $('#xp-reason').value, xp: dir * amount, shares: sharesList(), day: R.today() });
        }
      });
      view.addEventListener('input', function (ev) {
        var t = ev.target, id = t && t.getAttribute ? t.getAttribute('data-pkval') : null;
        if (!id || !form) return;
        form.shares[id] = Math.floor(Number(t.value)) || 0;
        var el = $('[data-pk-total]'); if (el) el.textContent = V.pickers.summaryText(form.shares, 'pct');
      });
      // En el radar de atributos, pasar el ratón o enfocar una punta enseña su resumen sin cambiar de pantalla.
      function peek(ev) {
        if (nav.level !== 'main') return;
        var t = ev.target && ev.target.closest ? ev.target.closest('.rd-label') : null;
        var m = t ? mainById(t.getAttribute('data-main')) : null, el = $('#rd-info');
        if (m && el) el.innerHTML = mainInfo(m);
      }
      view.addEventListener('mouseover', peek);
      view.addEventListener('focusin', peek);
      view.addEventListener('keydown', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('.rd-label') : null;
        if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      });

      repo.state().then(function (s) { st = s; paint(); }).catch(function (err) {
        body.innerHTML = '<div class="msg" data-kind="error">No se pudo cargar tu personaje. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>';
      });
    }
  };
})(window.App = window.App || {});
