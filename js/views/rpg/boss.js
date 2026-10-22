// Panel «Jefes finales» de la ficha: misiones enormes con varios pasos y una barra de vida que baja con cada paso.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util, K = V.pickers;

  // Un jefe derrotado ya no se edita, pero se puede eliminar desde su tarjeta (con confirmación en la misma tarjeta).
  function defeatedTools(b, asking) {
    return asking
      ? '<div class="sub-tools del-row"><span class="del-ask">¿Eliminar este jefe? La XP que ya te dio se queda.</span><button type="button" class="mini danger" data-act="del-yes" data-id="' + esc(b.id) + '">Sí, eliminar</button><button type="button" class="mini" data-act="del-no">No</button></div>'
      : '<div class="sub-tools"><button type="button" class="mini" data-act="del-card" data-id="' + esc(b.id) + '">Eliminar</button></div>';
  }
  // Cofre del botín: lacrado (el jefe ya está derrotado, pero aún no se puede cobrar) o abierto. `opening`: se abre ahora,
  // con una animación corta (la primera vez que se ve; con «Efectos» apagado, ya abierto).
  V.chestSvg = function (open, opening) {
    return '<svg class="bs-chest' + (open ? ' open' : '') + (opening ? ' opening' : '') + '" viewBox="0 0 110 90" aria-hidden="true" focusable="false">' +
      '<g class="ch-glow"><circle cx="55" cy="38" r="26" fill="rgba(244,213,141,.25)"/><path d="M55 8v10M35 16l6 8M75 16l-6 8" stroke="#F4D58D" stroke-width="2.5" stroke-linecap="round"/></g>' +
      '<rect x="18" y="44" width="74" height="38" rx="6" fill="#5A2848" stroke="#F3C6DA" stroke-width="2"/><path d="M18 56h74" stroke="#F3C6DA" stroke-width="1.5" stroke-dasharray="4 4"/>' +
      '<g class="ch-lid"><path d="M18 46v-8a16 16 0 0 1 16-16h42a16 16 0 0 1 16 16v8z" fill="#6E3A66" stroke="#F3C6DA" stroke-width="2"/><path d="M26 30h58" stroke="#F3C6DA" stroke-width="1.5" stroke-dasharray="4 4"/></g>' +
      '<g class="ch-seal"><circle cx="55" cy="48" r="9" fill="#A52E69" stroke="#19131B" stroke-width="1.5"/><path d="M55 53c-5-3.5-6-6.5-4.5-8.5 1.2-1.6 3.3-1.4 4.5.4 1.2-1.8 3.3-2 4.5-.4 1.5 2 .5 5-4.5 8.5z" fill="#F3C6DA"/></g></svg>';
  };
  function card(b, actNames, asking, opening) {
    var left = b.steps.length - b.doneCount, hp = b.steps.length ? left / b.steps.length : 0;
    var tier = R.BOSS_TIERS.filter(function (t) { return t.id === b.tier; })[0];
    if (b.sealed || b.defeated) return trophy(b, tier, actNames, asking, opening);
    // Cada paso con la casilla compartida. Los de check se marcan y desmarcan (sus 5 XP van y vienen, nunca dos veces);
    // los de actividad se marcan solos y su casilla no se pulsa. Con el jefe derrotado, todo queda fijo.
    var steps = '<ul class="bs-steps" aria-label="Pasos de ' + esc(b.name) + '">' + b.steps.map(function (s) {
      var fixed = b.defeated || !!s.activity;
      return '<li data-done="' + s.done + '"><label class="bs-check"><input type="checkbox"' + (s.done ? ' checked' : '') + (fixed ? ' disabled' : '') +
          (s.activity ? '' : ' data-bstep="' + esc(s.id) + '" data-id="' + esc(b.id) + '"') + '><span class="bs-text">' + esc(s.text) + '</span></label>' +
        (s.activity ? '<span class="soft bs-act">' + esc(actNames[s.activity] || 'Actividad') + ' · ' + s.count + ' de ' + s.target + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
    return '<li class="bs-card' + (b.defeated ? '' : ' has-edit') + '" data-tier="' + b.tier + '" data-defeated="' + b.defeated + '">' + V.bossImage(b) +
      '<div class="bs-head"><h3>' + esc(b.name) + '</h3><span class="tag card-tag">' + esc(tier.label) + '</span></div>' +
      (b.description ? '<p class="soft">' + esc(b.description) + '</p>' : '') +
      '<div class="hpbar" role="img" aria-label="Vida: quedan ' + left + ' de ' + b.steps.length + ' pasos"><span style="width:' + Math.round(hp * 100) + '%"></span></div>' +
      (b.unlocked ? '' : '<p class="soft bs-unlock">Su botín se puede abrir desde el ' + esc(U.fmtDay(b.unlockDay)) + '.</p>') +
      steps + App.ui.editButton('data-act="edit" data-id="' + esc(b.id) + '"', 'Editar ' + b.name) + '</li>';
  }
  // Derrotado: con el botín lacrado (cuenta atrás) o ya abierto. Sus pasos quedan fijos; se puede eliminar.
  function trophy(b, tier, actNames, asking, opening) {
    var open = b.defeated;
    var text = open ? '¡Botín abierto! <b class="bs-loot">+' + b.rewardXp + ' XP</b>'
      : 'Todos los pasos hechos. <b class="bs-loot">El botín se abre ' + (b.daysLeft === 1 ? 'mañana' : 'en ' + b.daysLeft + ' días') + '</b> (+' + b.xp + ' XP).';
    return '<li class="bs-card bs-trophy" data-tier="' + b.tier + '" data-defeated="true">' +
      '<div class="bs-head"><h3>' + esc(b.name) + '</h3><span class="tag card-tag bs-done-tag">Derrotado</span></div>' +
      '<div class="bs-chest-row">' + V.chestSvg(open, opening) + '<p class="bs-chest-text">' + text + '</p></div>' +
      '<details class="bs-steps-done"><summary>Pasos (' + b.steps.length + ')</summary><ul class="bs-steps">' + b.steps.map(function (s) {
        return '<li data-done="true"><span class="bs-text">' + esc(s.text) + '</span>' + (s.activity ? '<span class="soft bs-act">' + esc(actNames[s.activity] || 'Actividad') + '</span>' : '') + '</li>';
      }).join('') + '</ul></details>' + defeatedTools(b, asking === b.id) + '</li>';
  }
  // El cofre se abre con animación una sola vez por jefe y navegador.
  function chestSeen(id) { try { return localStorage.getItem('diario-rpg.chest.' + id) === '1'; } catch (e) { return true; } }
  function markChest(id) { try { localStorage.setItem('diario-rpg.chest.' + id, '1'); } catch (e) { /* sin almacenamiento: no pasa nada */ } }

  V.bossPanel = function (host, ctx) {
    var bosses = ctx.bosses, acts = ctx.acts, rpg = ctx.rpg;
    host.innerHTML = '<div class="col-head"><h2>Jefes finales</h2><button type="button" class="btn secondary" data-act="new">Nuevo</button></div>' +
      '<p class="msg" id="bs-msg" role="status" data-kind="ok"></p><div id="bs-body"></div>' +
      '<dialog class="confirm rpg-dialog" id="bs-dialog" aria-labelledby="bs-dtitle"></dialog>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#bs-body');
    var state = null, st = null, actList = [], form = null, busy = false, asking = null;

    function names() { return U.subNames(st.structure); }
    function actNames() { var o = {}; actList.forEach(function (a) { o[a.id] = a.name; }); return o; }
    // Arriba, los vivos, los lacrados (esperando el botín) y los que se acaban de abrir (con su animación, una vez);
    // los derrotados de antes, plegados abajo.
    function paint() {
      var recent = R.shiftDay(R.today(), -7);
      var fresh = state.bosses.filter(function (b) { return b.defeated && !chestSeen(b.id) && b.defeatedAt >= recent; });
      var live = state.bosses.filter(function (b) { return !b.defeated || fresh.indexOf(b) >= 0; }), done = state.bosses.filter(function (b) { return b.defeated && fresh.indexOf(b) < 0; });
      var openDone = !!(asking && done.some(function (b) { return b.id === asking; }));
      body.innerHTML = (live.length ? '<ul class="bs-list">' + live.map(function (b) { return card(b, actNames(), asking, fresh.indexOf(b) >= 0); }).join('') + '</ul>' : App.creature('No hay ningún jefe activo. Crea uno y ponle sus pasos.')) +
        (done.length ? '<details class="archived"' + (openDone ? ' open' : '') + '><summary>Derrotados (' + done.length + ')</summary><ul class="bs-list">' + done.map(function (b) { return card(b, actNames(), asking); }).join('') + '</ul></details>' : '');
      fresh.forEach(function (b) { markChest(b.id); });
    }
    // Antes de pintar, se borran los archivados del sistema anterior (si los hay).
    function reload() {
      return bosses.purgeArchived().catch(function () {}).then(function () {
        return Promise.all([bosses.state(), acts.list(), rpg.state()]);
      }).then(function (r) { state = r[0]; actList = r[1]; st = r[2]; paint(); });
    }
    function actionsHtml() {
      return '<button type="button" class="btn" data-act="save">Guardar</button>' +
        (form.id ? '<button type="button" class="btn secondary" data-act="del">Eliminar</button>' : '') +
        '<button type="button" class="btn secondary" data-act="close">Cancelar</button>';
    }
    function askHtml() {
      return '<p class="del-ask">¿Eliminar este jefe? No se puede deshacer. La XP que ya te dio se queda.</p>' +
        '<button type="button" class="btn danger" data-act="del-yes" data-id="' + esc(form.id) + '">Sí, eliminar</button><button type="button" class="btn secondary" data-act="del-no">No</button>';
    }
    function removeBoss(id, inDialog) {
      if (busy) return; busy = true;
      var b = state.bosses.filter(function (x) { return x.id === id; })[0];
      return bosses.remove(id).then(function () { asking = null; return reload(); }).then(function () {
        if (inDialog) dlg().close();
        say('Jefe eliminado' + (b ? ': ' + b.name : '') + '.');
      }).catch(function (e) {
        if (inDialog) { dmsg(e.message); $('#bs-actions').innerHTML = actionsHtml(); } else { asking = null; paint(); say(e.message); }
      }).then(function () { busy = false; });
    }
    function say(t) { $('#bs-msg').textContent = t || ''; }
    function dlg() { return $('#bs-dialog'); }
    function dmsg(t) { var el = $('#bs-dmsg'); if (el) el.textContent = t || ''; }
    function pickHtml() { return K.html(K.groups(st.structure, false), names(), form.shares, 'pct'); }

    function imageBlock() {
      var m = form.imgMode;
      var modes = [['art', 'Dibujo'], ['url', 'Imagen o GIF de internet'], ['none', 'Sin imagen']].map(function (x) {
        return '<li><button type="button" class="emo-cap" data-imode="' + x[0] + '" aria-pressed="' + (m === x[0]) + '"><span>' + x[1] + '</span></button></li>';
      }).join('');
      var extra = '';
      if (m === 'art') extra = '<ul class="emo-caps pk-caps art-pick" aria-label="Dibujos">' + R.BOSS_ART.map(function (a) {
        return '<li><button type="button" class="emo-cap art-cap" data-art="' + a.id + '" aria-pressed="' + (form.art === a.id) + '" aria-label="' + esc(a.label) + '"><span class="art-mini">' + V.bossArt(a.id) + '</span><span>' + esc(a.label) + '</span></button></li>';
      }).join('') + '</ul>';
      if (m === 'url') extra = '<label class="field"><span>Enlace a la imagen o GIF</span><input id="bf-url" type="url" inputmode="url" autocomplete="off" placeholder="Pega aquí el enlace de la imagen" value="' + esc(form.url) + '"><small class="soft">' + U.imageLinkHelp() + '</small></label><div id="bf-preview" class="bf-preview"></div>';
      return '<ul class="emo-caps" aria-label="Tipo de imagen">' + modes + '</ul>' + extra;
    }
    function preview() {
      var el = $('#bf-preview'); if (!el) return;
      var u = R.imageUrl(form.url);
      el.innerHTML = !form.url ? '' : u ? V.bossImage({ id: 'bo_00000000', name: 'Vista previa', image: { kind: 'url', url: u } }) : '<p class="soft">' + U.imageLinkInvalid() + '</p>';
    }
    function stepRows() {
      return form.steps.map(function (s, i) {
        return '<li class="bs-row"><input type="text" data-s="text" data-i="' + i + '" maxlength="' + R.BOSS_LIMITS.step + '" placeholder="Paso ' + (i + 1) + '" value="' + esc(s.text) + '" aria-label="Paso ' + (i + 1) + '">' +
          '<select data-s="activity" data-i="' + i + '" aria-label="Cómo se completa el paso ' + (i + 1) + '"' + (s.done ? ' disabled' : '') + '><option value="">Check (lo marco yo)</option>' +
          actList.filter(function (a) { return !a.archived || a.id === s.activity; }).map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === s.activity ? ' selected' : '') + '>Actividad: ' + esc(a.name) + '</option>'; }).join('') + '</select>' +
          (s.activity ? App.ui.stepper({ value: s.count, min: 1, max: R.BOSS_LIMITS.target, label: 'Veces del paso ' + (i + 1), attrs: 'data-s="count" data-i="' + i + '"', disabled: s.done }) : '') +
          (s.done ? '<span class="tag ok">Hecho</span>' : '<button type="button" class="mini" data-act="step-del" data-i="' + i + '" aria-label="Quitar el paso ' + (i + 1) + '">×</button>') + '</li>';
      }).join('');
    }
    // b = jefe a editar, o null para uno nuevo. pre (solo nuevo) = { name, description, steps } para rellenarlo de antemano
    // (por ejemplo, al convertir una sombra en jefe).
    function openForm(b, pre) {
      if (!b && pre) b = { id: null, tier: 'jefe', startDay: R.today(), image: { kind: 'art', id: 'fantasma' }, shares: [], name: pre.name, description: pre.description || '',
        steps: pre.steps.map(function (s) { return { text: s.text, activity: s.activity || null, target: s.count || 1, done: false }; }) };
      form = { id: b ? b.id : null, tier: b ? b.tier : 'jefe', shares: {}, startDay: b ? b.startDay : R.today(),
        imgMode: b && b.image ? (b.image.kind === 'url' ? 'url' : 'art') : 'art', art: b && b.image && b.image.kind === 'art' ? b.image.id : 'fantasma', url: b && b.image && b.image.kind === 'url' ? b.image.url : '',
        steps: b ? b.steps.map(function (s) { return { id: s.id, text: s.text, activity: s.activity, count: s.activity ? s.target : 1, done: s.done }; }) : [{ text: '', activity: null, count: 1 }] };
      if (b) b.shares.forEach(function (s) { form.shares[s.sub] = s.pct; });
      dlg().innerHTML = '<h3 id="bs-dtitle">' + (form.id ? 'Editar jefe' : 'Nuevo jefe') + '</h3>' +
        (pre ? '<p class="soft">Viene de tu sombra «' + esc(pre.name) + '». Cambia lo que quieras antes de guardarlo.</p>' : '') +
        '<label class="field"><span>Nombre</span><input id="bf-name" type="text" maxlength="' + R.BOSS_LIMITS.name + '" autocomplete="off" value="' + esc(b ? b.name : '') + '"></label>' +
        '<label class="field"><span>Descripción (opcional)</span><input id="bf-desc" type="text" maxlength="' + R.BOSS_LIMITS.description + '" autocomplete="off" value="' + esc(b ? b.description : '') + '"></label>' +
        '<fieldset class="symbols"><legend>Nivel (XP al derrotarlo)</legend><ul class="emo-caps" aria-label="Nivel">' + R.BOSS_TIERS.map(function (t) {
          return '<li><button type="button" class="emo-cap" data-tier="' + t.id + '" aria-pressed="' + (t.id === form.tier) + '"><span>' + t.label + ' · ' + t.xp + ' XP · ' + t.days + ' días</span></button></li>';
        }).join('') + '</ul><p class="soft">Los jefes son para metas grandes: su premio se puede cobrar cuando han pasado esos días desde que lo creas. Cada paso da sus ' + R.BOSS_STEP_XP + ' XP al momento.</p></fieldset>' +
        '<fieldset class="symbols"><legend>Imagen</legend><div id="bf-image">' + imageBlock() + '</div></fieldset>' +
        '<fieldset class="shares"><legend>Pasos (cada uno da ' + R.BOSS_STEP_XP + ' XP)</legend><ul class="bs-rows" id="bf-steps">' + stepRows() + '</ul><button type="button" class="mini" data-act="step-add">Añadir paso</button></fieldset>' +
        '<fieldset class="shares"><legend>¿A qué subcategorías va la XP?</legend><p class="soft">Opcional. Sin ninguna, solo sube el nivel general.</p><div id="bf-pick">' + pickHtml() + '</div></fieldset>' +
        '<p class="msg" id="bs-dmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row" id="bs-actions">' + actionsHtml() + '</div>';
      dlg().showModal(); preview();
    }
    function setPressed(sel, attr, val) { Array.prototype.forEach.call(dlg().querySelectorAll(sel), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute(attr) === val)); }); }

    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-pk],[data-tier],[data-imode],[data-art]') : null;
      if (!t) return;
      if (t.getAttribute('data-pk') && form) { K.toggle(form.shares, t.getAttribute('data-pk'), 'pct'); $('#bf-pick').innerHTML = pickHtml(); return; }
      if (t.getAttribute('data-tier') && form) { form.tier = t.getAttribute('data-tier'); return setPressed('[data-tier]', 'data-tier', form.tier); }
      if (t.getAttribute('data-imode') && form) { form.imgMode = t.getAttribute('data-imode'); $('#bf-image').innerHTML = imageBlock(); preview(); return; }
      if (t.getAttribute('data-art') && form) { form.art = t.getAttribute('data-art'); return setPressed('[data-art]', 'data-art', form.art); }
      var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
      if (act === 'close') return dlg().close();
      if (act === 'new') return openForm(null);
      if (act === 'edit') return openForm(state.bosses.filter(function (b) { return b.id === id; })[0]);
      if (act === 'step-add') { if (form.steps.length < R.BOSS_LIMITS.steps) { form.steps.push({ text: '', activity: null, count: 1 }); $('#bf-steps').innerHTML = stepRows(); } return; }
      if (act === 'step-del') { form.steps.splice(Number(t.getAttribute('data-i')), 1); $('#bf-steps').innerHTML = stepRows(); return; }
      var inDialog = !!t.closest('#bs-dialog');
      if (act === 'del') { $('#bs-actions').innerHTML = askHtml(); var y = $('#bs-actions [data-act="del-yes"]'); if (y && y.focus) y.focus(); return; }
      if (act === 'del-card') { asking = id; paint(); var y2 = body.querySelector('[data-act="del-yes"]'); if (y2 && y2.focus) y2.focus(); return; }
      if (act === 'del-no') { if (inDialog) $('#bs-actions').innerHTML = actionsHtml(); else { asking = null; paint(); } return; }
      if (act === 'del-yes') return removeBoss(id, inDialog);
      if (act === 'save') {
        var image = form.imgMode === 'url' ? { kind: 'url', url: form.url } : form.imgMode === 'art' ? { kind: 'art', id: form.art } : null;
        var data = { name: $('#bf-name').value, description: $('#bf-desc').value, tier: form.tier, image: image, shares: K.toList(form.shares, 'pct'), startDay: form.startDay,
          steps: form.steps.map(function (s) { return { id: s.id, text: s.text, activity: s.activity || null, count: s.count }; }) };
        var p = form.id ? bosses.update(form.id, data) : bosses.create(data);
        return p.then(function () { return ctx.afterChange(); }).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
      }
    });
    host.addEventListener('input', function (ev) {
      var t = ev.target; if (!t || !form) return;
      var pid = t.getAttribute && t.getAttribute('data-pkval');
      if (pid) { form.shares[pid] = Math.floor(Number(t.value)) || 0; var el = host.querySelector('[data-pk-total]'); if (el) el.textContent = K.summaryText(form.shares, 'pct'); return; }
      if (t.id === 'bf-url') { form.url = t.value.trim(); return preview(); }
      var i = t.getAttribute && t.getAttribute('data-i'), k = t.getAttribute && t.getAttribute('data-s');
      if (k === 'text') form.steps[Number(i)].text = t.value;
      if (k === 'count') form.steps[Number(i)].count = Math.floor(Number(t.value)) || 1;
    });
    // Marcar o desmarcar un paso de check. La tarjeta cambia al momento (tachado y barra de vida) y el guardado va detrás,
    // en cola: varios toques seguidos se guardan en orden, uno a uno, y la ficha se refresca una sola vez al final.
    // La XP la decide el registro (completeStep / uncompleteStep), así que nunca se cuenta dos veces. Si algo falla, se repinta lo guardado.
    var stepQueue = Promise.resolve(), stepPending = 0, stepEvents = [], stepError = null;
    function paintCardNow(cardEl) {
      var boxes = cardEl.querySelectorAll('.bs-steps input[type="checkbox"]'), left = 0;
      Array.prototype.forEach.call(boxes, function (c) { if (!c.checked) left++; c.closest('li').setAttribute('data-done', String(c.checked)); });
      var bar = cardEl.querySelector('.hpbar');
      if (bar && boxes.length) {
        bar.querySelector('span').style.width = Math.round(left / boxes.length * 100) + '%';
        bar.setAttribute('aria-label', 'Vida: quedan ' + left + ' de ' + boxes.length + ' pasos');
      }
    }
    host.addEventListener('change', function (ev) {
      var t = ev.target, stepId = t && t.getAttribute ? t.getAttribute('data-bstep') : null;
      if (!stepId) return;
      var cardEl = t.closest('.bs-card'), id = t.getAttribute('data-id'), on = t.checked;
      function go() {
        if (cardEl) paintCardNow(cardEl);
        stepPending++;
        stepQueue = stepQueue.then(function () { return on ? bosses.completeStep(id, stepId) : bosses.uncompleteStep(id, stepId); })
          .then(function (events) { stepEvents = stepEvents.concat(events || []); }, function (e) { stepError = e; })
          .then(function () {
            if (--stepPending) return null;
            var events = stepEvents, err = stepError; stepEvents = []; stepError = null;
            return ctx.afterChange(null, events).then(function () { if (err) say(err.message); }, function (e) { say((err || e).message); return reload(); });
          });
      }
      if (on) return go();
      // Desmarcar quita sus 5 XP: primero se pregunta en la misma fila.
      var text = t.parentNode && t.parentNode.querySelector('.bs-text');
      App.ui.askUncheck(t, 'li', '¿Desmarcar <b>' + esc(text ? text.textContent : 'el paso') + '</b>? Se quitan sus ' + App.ui.xpText(R.BOSS_STEP_XP) + '.', go);
    });
    host.addEventListener('change', function (ev) {
      var t = ev.target; if (!t || !t.getAttribute || t.getAttribute('data-s') !== 'activity') return;
      form.steps[Number(t.getAttribute('data-i'))].activity = t.value || null;
      $('#bf-steps').innerHTML = stepRows();
    });
    host.addEventListener('error', V.bossFallback, true);

    return {
      reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar los jefes. ' + esc(err.message || '') + '</div>'; }); },
      // Abre «Nuevo jefe» ya relleno: { name, description, steps: [{ text, activity, count }] }.
      openNew: function (pre) { return (st ? Promise.resolve() : reload()).then(function () { openForm(null, pre); }); }
    };
  };
})(window.App = window.App || {});
