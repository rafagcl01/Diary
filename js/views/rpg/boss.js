// Panel «Jefes finales» de la ficha: misiones enormes con varios pasos y una barra de vida que baja con cada paso.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util, K = V.pickers;

  function card(b, actNames) {
    var left = b.steps.length - b.doneCount, hp = b.steps.length ? left / b.steps.length : 0;
    var tier = R.BOSS_TIERS.filter(function (t) { return t.id === b.tier; })[0];
    var steps = '<ul class="bs-steps" aria-label="Pasos de ' + esc(b.name) + '">' + b.steps.map(function (s) {
      var right = s.done ? '<span class="tag ok">Hecho ✓</span>' :
        s.activity ? '<span class="soft">' + esc(actNames[s.activity] || 'Actividad') + ' · ' + s.count + ' de ' + s.target + '</span>' :
        (b.defeated ? '' : '<button type="button" class="mini" data-act="step" data-id="' + esc(b.id) + '" data-step="' + esc(s.id) + '">Hecho</button>');
      return '<li data-done="' + s.done + '"><span class="bs-text">' + esc(s.text) + '</span>' + right + '</li>';
    }).join('') + '</ul>';
    return '<li class="bs-card" data-tier="' + b.tier + '" data-defeated="' + b.defeated + '">' + V.bossImage(b) +
      '<div class="bs-head"><h3>' + esc(b.name) + '</h3><span class="tag">' + esc(tier.label) + '</span></div>' +
      (b.description ? '<p class="soft">' + esc(b.description) + '</p>' : '') +
      (b.defeated ? '<p class="bs-win">¡Derrotado! +' + b.rewardXp + ' XP</p>' :
        '<div class="hpbar" role="img" aria-label="Vida: quedan ' + left + ' de ' + b.steps.length + ' pasos"><span style="width:' + Math.round(hp * 100) + '%"></span></div>' +
        '<p class="soft bs-hp">Vida: ' + left + ' de ' + b.steps.length + ' pasos · +' + R.BOSS_STEP_XP + ' XP por paso · +' + b.xp + ' XP al derrotarlo</p>') +
      steps + (b.defeated ? '' : '<div class="sub-tools"><button type="button" class="mini" data-act="edit" data-id="' + esc(b.id) + '">Editar</button></div>') + '</li>';
  }

  V.bossPanel = function (host, ctx) {
    var bosses = ctx.bosses, acts = ctx.acts, rpg = ctx.rpg;
    host.innerHTML = '<div class="col-head"><h2>Jefes finales</h2><button type="button" class="btn secondary" data-act="new">Nuevo</button></div>' +
      '<p class="soft col-lead">Retos grandes con varios pasos. Cada paso da un poco de XP; derrotarlo da mucha.</p>' +
      '<p class="msg" id="bs-msg" role="status" data-kind="ok"></p><div id="bs-body"></div>' +
      '<dialog class="confirm rpg-dialog" id="bs-dialog" aria-labelledby="bs-dtitle"></dialog>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#bs-body');
    var state = null, st = null, actList = [], form = null, busy = false;

    function names() { return U.subNames(st.structure); }
    function actNames() { var o = {}; actList.forEach(function (a) { o[a.id] = a.name; }); return o; }
    function paint() {
      var live = state.bosses.filter(function (b) { return !b.archived && !b.defeated; });
      var done = state.bosses.filter(function (b) { return b.defeated; }), arch = state.bosses.filter(function (b) { return b.archived && !b.defeated; });
      body.innerHTML = (live.length ? '<ul class="bs-list">' + live.map(function (b) { return card(b, actNames()); }).join('') + '</ul>' : '<p class="soft">No hay ningún jefe activo. Crea uno y ponle sus pasos.</p>') +
        (done.length ? '<details class="archived"><summary>Derrotados (' + done.length + ')</summary><ul class="bs-list">' + done.map(function (b) { return card(b, actNames()); }).join('') + '</ul></details>' : '') +
        (arch.length ? '<details class="archived"><summary>Archivados (' + arch.length + ')</summary><ul class="bs-list">' + arch.map(function (b) { return card(b, actNames()); }).join('') + '</ul></details>' : '');
    }
    function reload() { return Promise.all([bosses.state(), acts.list(), rpg.state()]).then(function (r) { state = r[0]; actList = r[1]; st = r[2]; paint(); }); }
    function say(t) { $('#bs-msg').textContent = t || ''; }
    function dlg() { return $('#bs-dialog'); }
    function dmsg(t) { var el = $('#bs-dmsg'); if (el) el.textContent = t || ''; }
    function pickHtml() { return K.html(K.groups(st.structure, false), names(), form.shares, 'pct'); }

    function imageBlock() {
      var m = form.imgMode;
      var modes = [['art', 'Dibujo'], ['url', 'GIF de internet'], ['none', 'Sin imagen']].map(function (x) {
        return '<li><button type="button" class="emo-cap" data-imode="' + x[0] + '" aria-pressed="' + (m === x[0]) + '"><span>' + x[1] + '</span></button></li>';
      }).join('');
      var extra = '';
      if (m === 'art') extra = '<ul class="emo-caps pk-caps art-pick" aria-label="Dibujos">' + R.BOSS_ART.map(function (a) {
        return '<li><button type="button" class="emo-cap art-cap" data-art="' + a.id + '" aria-pressed="' + (form.art === a.id) + '" aria-label="' + esc(a.label) + '"><span class="art-mini">' + V.bossArt(a.id) + '</span><span>' + esc(a.label) + '</span></button></li>';
      }).join('') + '</ul>';
      if (m === 'url') extra = '<label class="field"><span>Enlace directo al GIF</span><input id="bf-url" type="url" inputmode="url" autocomplete="off" placeholder="Pega aquí el enlace directo" value="' + esc(form.url) + '"><small class="soft">Copia el «enlace directo» (acaba en .gif) de Giphy, Tenor o Imgur. No se descarga ni se guarda: solo se guarda el enlace, y la imagen se carga desde ese sitio al verla.</small></label><div id="bf-preview" class="bf-preview"></div>';
      return '<ul class="emo-caps" aria-label="Tipo de imagen">' + modes + '</ul>' + extra;
    }
    function preview() {
      var el = $('#bf-preview'); if (!el) return;
      var u = R.gifUrl(form.url);
      el.innerHTML = !form.url ? '' : u ? V.bossImage({ id: 'bo_00000000', name: 'Vista previa', image: { kind: 'url', url: u } }) : '<p class="soft">Ese enlace no vale todavía (debe ser https y directo, de Giphy, Tenor o Imgur).</p>';
    }
    function stepRows() {
      return form.steps.map(function (s, i) {
        return '<li class="bs-row"><input type="text" data-s="text" data-i="' + i + '" maxlength="' + R.BOSS_LIMITS.step + '" placeholder="Paso ' + (i + 1) + '" value="' + esc(s.text) + '" aria-label="Paso ' + (i + 1) + '">' +
          '<select data-s="activity" data-i="' + i + '" aria-label="Cómo se completa el paso ' + (i + 1) + '"' + (s.done ? ' disabled' : '') + '><option value="">Check (lo marco yo)</option>' +
          actList.filter(function (a) { return !a.archived || a.id === s.activity; }).map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === s.activity ? ' selected' : '') + '>Actividad: ' + esc(a.name) + '</option>'; }).join('') + '</select>' +
          (s.activity ? '<input type="number" data-s="count" data-i="' + i + '" min="1" max="' + R.BOSS_LIMITS.target + '" value="' + s.count + '" aria-label="Veces del paso ' + (i + 1) + '"' + (s.done ? ' disabled' : '') + '>' : '') +
          (s.done ? '<span class="tag ok">Hecho</span>' : '<button type="button" class="mini" data-act="step-del" data-i="' + i + '" aria-label="Quitar el paso ' + (i + 1) + '">×</button>') + '</li>';
      }).join('');
    }
    function openForm(b) {
      form = { id: b ? b.id : null, tier: b ? b.tier : 'jefe', shares: {}, startDay: b ? b.startDay : R.today(),
        imgMode: b && b.image ? (b.image.kind === 'url' ? 'url' : 'art') : 'art', art: b && b.image && b.image.kind === 'art' ? b.image.id : 'fantasma', url: b && b.image && b.image.kind === 'url' ? b.image.url : '',
        steps: b ? b.steps.map(function (s) { return { id: s.id, text: s.text, activity: s.activity, count: s.activity ? s.target : 1, done: s.done }; }) : [{ text: '', activity: null, count: 1 }] };
      if (b) b.shares.forEach(function (s) { form.shares[s.sub] = s.pct; });
      dlg().innerHTML = '<h3 id="bs-dtitle">' + (b ? 'Editar jefe' : 'Nuevo jefe') + '</h3>' +
        '<label class="field"><span>Nombre</span><input id="bf-name" type="text" maxlength="' + R.BOSS_LIMITS.name + '" autocomplete="off" value="' + esc(b ? b.name : '') + '"></label>' +
        '<label class="field"><span>Descripción (opcional)</span><input id="bf-desc" type="text" maxlength="' + R.BOSS_LIMITS.description + '" autocomplete="off" value="' + esc(b ? b.description : '') + '"></label>' +
        '<fieldset class="symbols"><legend>Nivel (XP al derrotarlo)</legend><ul class="emo-caps" aria-label="Nivel">' + R.BOSS_TIERS.map(function (t) {
          return '<li><button type="button" class="emo-cap" data-tier="' + t.id + '" aria-pressed="' + (t.id === form.tier) + '"><span>' + t.label + ' · ' + t.xp + ' XP</span></button></li>';
        }).join('') + '</ul></fieldset>' +
        '<fieldset class="symbols"><legend>Imagen</legend><div id="bf-image">' + imageBlock() + '</div></fieldset>' +
        '<fieldset class="shares"><legend>Pasos (cada uno da ' + R.BOSS_STEP_XP + ' XP)</legend><ul class="bs-rows" id="bf-steps">' + stepRows() + '</ul><button type="button" class="mini" data-act="step-add">Añadir paso</button></fieldset>' +
        '<fieldset class="shares"><legend>¿A qué subcategorías va la XP?</legend><p class="soft">Opcional. Sin ninguna, solo sube el nivel general.</p><div id="bf-pick">' + pickHtml() + '</div></fieldset>' +
        '<p class="msg" id="bs-dmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="save">Guardar</button>' +
        (b ? '<button type="button" class="btn secondary" data-act="archive" data-to="' + (b.archived ? '0' : '1') + '">' + (b.archived ? 'Recuperar' : 'Archivar') + '</button>' : '') +
        '<button type="button" class="btn secondary" data-act="close">Cancelar</button></div>';
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
      if (act === 'archive') return bosses.setArchived(form.id, t.getAttribute('data-to') === '1').then(reload).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
      if (act === 'step') {
        if (busy) return; busy = true; t.disabled = true;
        return bosses.completeStep(id, t.getAttribute('data-step')).then(function (events) { return ctx.afterChange(null, events); })
          .catch(function (e) { say(e.message); return reload(); }).then(function () { busy = false; });
      }
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
    host.addEventListener('change', function (ev) {
      var t = ev.target; if (!t || !t.getAttribute || t.getAttribute('data-s') !== 'activity') return;
      form.steps[Number(t.getAttribute('data-i'))].activity = t.value || null;
      $('#bf-steps').innerHTML = stepRows();
    });
    host.addEventListener('error', V.bossFallback, true);

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar los jefes. ' + esc(err.message || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
