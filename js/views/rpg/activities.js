// Panel «Actividades» de la ficha: registrar con un toque lo que has hecho (todas dan 5 XP) y crear las tuyas.
// Una actividad nueva puede registrarse solo esa vez o guardarse para repetirla.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, U = V.util, K = V.pickers;

  function chips(a, names) { return a.points.map(function (p) { return '<span class="chip">' + esc(names[p.sub] || p.sub) + ' <small>+' + p.xp + '</small></span>'; }).join(''); }
  function row(a, names) {
    return '<li class="act-row' + (a.archived ? ' archived' : '') + '" data-name="' + esc(R.fold(a.name)) + '"><span class="sub-ic">' + icon(a.icon) + '</span>' +
      '<div class="act-info"><strong>' + esc(a.name) + '</strong><div class="act-chips">' + chips(a, names) + '</div></div>' +
      '<div class="act-btns">' + (a.archived ? '' : '<button type="button" class="btn act-log" data-act="log" data-id="' + esc(a.id) + '" aria-label="Registrar: ' + esc(a.name) + '">Registrar</button>') +
      '<button type="button" class="mini" data-act="edit" data-id="' + esc(a.id) + '" aria-label="Editar: ' + esc(a.name) + '">Editar</button></div></li>';
  }

  V.activitiesPanel = function (host, ctx) {
    var acts = ctx.acts, rpg = ctx.rpg;
    host.innerHTML = '<div class="col-head"><h2>Actividades</h2><button type="button" class="btn secondary" data-act="new">Nueva</button></div>' +
      '<p class="soft col-lead">Todas dan ' + R.ACTIVITY_XP + ' XP. Pulsa «Registrar» al hacerlas.</p>' +
      '<div class="act-tools"><label class="field inline"><span class="sr">Día</span><input id="act-day" type="date" value="' + R.today() + '" max="' + R.today() + '" aria-label="Día del registro"></label>' +
      '<label class="searchbox"><span class="sr">Buscar actividad</span><input id="act-q" type="search" placeholder="Buscar" autocomplete="off"></label></div>' +
      '<p class="msg" id="act-msg" role="status" data-kind="ok"></p><div id="act-body" class="col-scroll"></div>' +
      '<dialog class="confirm rpg-dialog" id="act-dialog" aria-labelledby="act-dtitle"></dialog>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#act-body');
    var list = [], st = null, form = null, busy = false;

    function names() { return U.subNames(st.structure); }
    function paint() {
      var active = list.filter(function (a) { return !a.archived; }), arch = list.filter(function (a) { return a.archived; });
      body.innerHTML = '<ul class="act-list">' + active.map(function (a) { return row(a, names()); }).join('') + '</ul>' +
        (arch.length ? '<details class="archived"><summary>Archivadas (' + arch.length + ')</summary><ul class="act-list">' + arch.map(function (a) { return row(a, names()); }).join('') + '</ul></details>' : '');
      filter();
    }
    function filter() {
      var q = R.fold($('#act-q').value);
      Array.prototype.forEach.call(body.querySelectorAll('.act-row'), function (li) { li.hidden = !!q && li.getAttribute('data-name').indexOf(q) < 0; });
    }
    function note(text, key) {
      var el = $('#act-msg'); el.textContent = text || '';
      if (text && key) { var b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.setAttribute('data-act', 'undo'); b.setAttribute('data-key', key); b.textContent = 'Anular'; el.appendChild(document.createTextNode(' ')); el.appendChild(b); }
    }
    function reload() { return Promise.all([acts.list(true), rpg.state()]).then(function (r) { list = r[0]; st = r[1]; paint(); }); }
    function dlg() { return $('#act-dialog'); }
    function dmsg(t) { var el = $('#act-dmsg'); if (el) el.textContent = t || ''; }
    function pickHtml() { return K.html(K.groups(st.structure, false), names(), form.values, 'pts'); }
    function day() { return $('#act-day').value || R.today(); }

    function openForm(a) {
      form = { id: a ? a.id : null, values: {} };
      if (a) a.points.forEach(function (p) { form.values[p.sub] = p.xp; });
      dlg().innerHTML = '<h3 id="act-dtitle">' + (a ? 'Editar actividad' : 'Nueva actividad') + '</h3>' +
        (a ? '<p class="soft">Lo ya registrado no cambia: cada apunte guarda sus propios puntos.</p>' : '<p class="soft">Se registra ahora. Si quieres repetirla otras veces, guárdala.</p>') +
        '<label class="field"><span>Nombre</span><input id="af-name" type="text" maxlength="' + R.ACTIVITY_LIMITS.name + '" autocomplete="off" value="' + esc(a ? a.name : '') + '"></label>' +
        (a ? U.symbolGrid('af-icon', R.ICONS, a.icon) : '<label class="checkline"><input type="checkbox" id="af-save"><span>Guardar para repetirla otras veces</span></label>') +
        '<fieldset class="shares"><legend>Reparte exactamente ' + R.ACTIVITY_XP + ' puntos</legend><div id="af-pick">' + pickHtml() + '</div></fieldset>' +
        '<p class="msg" id="act-dmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row"><button type="button" class="btn" data-act="save">' + (a ? 'Guardar' : 'Registrar') + '</button>' +
        (a ? '<button type="button" class="btn secondary" data-act="archive" data-to="' + (a.archived ? '0' : '1') + '">' + (a.archived ? 'Recuperar' : 'Archivar') + '</button>' : '') +
        '<button type="button" class="btn secondary" data-act="close">Cancelar</button></div>';
      dlg().showModal();
    }
    function checked(name) { var el = host.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : undefined; }

    // Tras guardar un registro: avisos de misiones/jefes y refresco de la ficha.
    function logged(r, d) {
      note(r.duplicate ? 'Ese apunte ya estaba guardado.' : '+' + r.entry.xp + ' XP · ' + r.entry.label, r.duplicate ? '' : r.entry.key);
      return ctx.afterChange(d);
    }

    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-pk]') : null;
      if (!t) return;
      var pk = t.getAttribute('data-pk');
      if (pk && form) { K.toggle(form.values, pk, 'pts'); $('#af-pick').innerHTML = pickHtml(); return; }
      var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
      if (act === 'close') return dlg().close();
      if (act === 'new') return openForm(null);
      if (act === 'edit') return openForm(list.filter(function (a) { return a.id === id; })[0]);
      if (act === 'archive') return acts.setArchived(form.id, t.getAttribute('data-to') === '1').then(reload).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
      if (act === 'undo') {
        if (busy) return; busy = true;
        return rpg.voidEntry(t.getAttribute('data-key')).then(function (r) { note(r.duplicate ? 'Ese apunte ya estaba anulado.' : 'Apunte anulado (queda en el historial como ajuste).'); return ctx.afterChange(); })
          .catch(function (e) { note(e.message); }).then(function () { busy = false; });
      }
      if (act === 'save') {
        var points = K.toList(form.values, 'pts');
        if (form.id) {
          var a0 = list.filter(function (a) { return a.id === form.id; })[0];
          return acts.update(form.id, { name: $('#af-name').value, icon: checked('af-icon') || a0.icon, points: points }).then(reload).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
        }
        if (busy) return; busy = true;
        var d = day(), name = $('#af-name').value, keep = $('#af-save').checked, req = R.newRequestId();
        var go = keep
          ? acts.create({ name: name, icon: 'star', points: points }).then(function (a) { return acts.log(a.id, { req: req, day: d }); })
          : acts.logOnce({ name: name, points: points, req: req, day: d });
        return go.then(function (r) { dlg().close(); return reload().then(function () { return logged(r, d); }); })
          .catch(function (e) { dmsg(e.message); }).then(function () { busy = false; });
      }
      if (act === 'log') {
        if (busy) return; busy = true;
        Array.prototype.forEach.call(host.querySelectorAll('.act-log'), function (b) { b.disabled = true; });
        var d2 = day();
        return acts.log(id, { req: R.newRequestId(), day: d2 }).then(function (r) { return logged(r, d2); })
          .catch(function (e) { note((e && e.message) || 'No se pudo guardar. No se ha sumado nada.'); })
          .then(function () { busy = false; Array.prototype.forEach.call(host.querySelectorAll('.act-log'), function (b) { b.disabled = false; }); });
      }
    });
    host.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t && t.id === 'act-q') return filter();
      var id = t && t.getAttribute ? t.getAttribute('data-pkval') : null;
      if (!id || !form) return;
      form.values[id] = Math.floor(Number(t.value)) || 0;
      var el = host.querySelector('[data-pk-total]'); if (el) el.textContent = K.summaryText(form.values, 'pts');
    });

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las actividades. ' + esc(err.message || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
