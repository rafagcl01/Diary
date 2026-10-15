// Actividades: registrar con un toque lo que has hecho (da poca XP) y crear las tuyas.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, P = App.rpgViews, U = P.util, K = P.pickers;

  function chips(a, names) {
    return a.points.map(function (p) { return '<span class="chip">' + esc(names[p.sub] || p.sub) + ' <small>+' + p.xp + '</small></span>'; }).join('');
  }
  function card(a, names) {
    return '<li class="act-card' + (a.archived ? ' archived' : '') + '" data-id="' + esc(a.id) + '">' +
      '<div class="act-top"><span class="sub-ic">' + icon(a.icon) + '</span><div class="act-name"><h3>' + esc(a.name) + '</h3><p class="soft">+' + R.activityXp(a) + ' XP</p></div></div>' +
      '<div class="act-chips">' + chips(a, names) + '</div>' +
      '<div class="sub-tools">' +
        (a.archived ? '' : '<button type="button" class="btn act-log" data-act="log" data-id="' + esc(a.id) + '">Registrar</button>') +
        '<button type="button" class="mini" data-act="edit" data-id="' + esc(a.id) + '">Editar</button>' +
        '<button type="button" class="mini" data-act="archive" data-id="' + esc(a.id) + '" data-to="' + (a.archived ? '0' : '1') + '">' + (a.archived ? 'Recuperar' : 'Archivar') + '</button>' +
      '</div></li>';
  }

  P.activities = {
    render: function (host) {
      var acts = R.activities(), rpg = R.repo();
      host.innerHTML = '<div class="act-view"><p class="soft">Lo más sencillo para ir avanzando: cada una da como máximo ' + R.ACTIVITY_MAX + ' XP. Las misiones dan mucho más.</p>' +
        '<div id="act-body"></div><dialog class="confirm rpg-dialog" id="act-dialog" aria-labelledby="act-dtitle"></dialog></div>';
      var view = host.querySelector('.act-view'), $ = function (s) { return host.querySelector(s); }, body = $('#act-body');
      if (!acts) {
        body.innerHTML = '<section class="card stitched empty"><div class="empty-icon">' + icon('star') + '</div><h2>Conecta tus datos para registrar actividades</h2><p>Tu experiencia se guarda en tu repositorio de datos.</p><a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section>';
        return;
      }
      body.innerHTML = '<div class="skeleton" style="margin: 14px 0"></div>';
      var st = null, list = [], form = null, busy = false, note = '', noteKey = '';

      function paint() {
        var names = U.subNames(st.structure);
        var active = list.filter(function (a) { return !a.archived; }), arch = list.filter(function (a) { return a.archived; });
        body.innerHTML = '<div class="toolbar"><label class="field inline"><span>Día</span><input id="act-day" type="date" value="' + R.today() + '" max="' + R.today() + '"></label>' +
          '<button type="button" class="btn secondary" data-act="new">Nueva actividad</button></div>' +
          '<p class="msg" id="act-msg" role="status" data-kind="ok"></p>' +
          '<ul class="act-grid">' + active.map(function (a) { return card(a, names); }).join('') + '</ul>' +
          (arch.length ? '<details class="archived"><summary>Archivadas (' + arch.length + ')</summary><ul class="act-grid">' + arch.map(function (a) { return card(a, names); }).join('') + '</ul></details>' : '');
        showNote();
      }
      function showNote() {
        var el = $('#act-msg'); if (!el) return;
        el.textContent = note;
        if (note && noteKey) { var b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.setAttribute('data-act', 'undo'); b.setAttribute('data-key', noteKey); b.textContent = 'Anular'; el.appendChild(document.createTextNode(' ')); el.appendChild(b); }
      }
      function reload() { return Promise.all([acts.list(true), rpg.state(true)]).then(function (r) { list = r[0]; st = r[1]; paint(); }); }
      function dmsg(text, kind) { var el = $('#act-dmsg'); if (el) { el.textContent = text || ''; el.setAttribute('data-kind', kind || 'error'); } }
      function dlg() { return $('#act-dialog'); }

      function pickHtml() { return K.html(K.groups(st.structure, false), U.subNames(st.structure), form.values, 'pts'); }
      function openForm(a) {
        form = { id: a ? a.id : null, values: {} };
        if (a) a.points.forEach(function (p) { form.values[p.sub] = p.xp; });
        dlg().innerHTML = '<h3 id="act-dtitle">' + (a ? 'Editar actividad' : 'Nueva actividad') + '</h3>' +
          (a ? '<p class="soft">Lo ya registrado no cambia: cada apunte guarda sus propios puntos.</p>' : '') +
          '<label class="field"><span>Nombre</span><input id="af-name" type="text" maxlength="' + R.ACTIVITY_LIMITS.name + '" autocomplete="off" value="' + esc(a ? a.name : '') + '"></label>' +
          U.symbolGrid('af-icon', R.ICONS, a ? a.icon : 'star') +
          '<fieldset class="shares"><legend>Puntos por subcategoría (máximo ' + R.ACTIVITY_MAX + ' en total)</legend><div id="af-pick">' + pickHtml() + '</div></fieldset>' +
          '<p class="msg" id="act-dmsg" role="status" data-kind="error"></p>' +
          '<div class="btn-row"><button type="button" class="btn" data-act="save">Guardar</button><button type="button" class="btn secondary" data-act="close">Cancelar</button></div>';
        dlg().showModal();
      }
      function checked(name) { var el = host.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : undefined; }

      view.addEventListener('click', function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest('[data-act],[data-pk]') : null;
        if (!t) return;
        var pk = t.getAttribute('data-pk');
        if (pk && form) { K.toggle(form.values, pk, 'pts'); $('#af-pick').innerHTML = pickHtml(); return; }
        var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
        if (act === 'close') return dlg().close();
        if (act === 'new') return openForm(null);
        if (act === 'edit') return openForm(list.filter(function (a) { return a.id === id; })[0]);
        if (act === 'archive') return acts.setArchived(id, t.getAttribute('data-to') === '1').then(reload).catch(function (e) { note = e.message; noteKey = ''; showNote(); });
        if (act === 'save') {
          var data = { name: $('#af-name').value, icon: checked('af-icon'), points: K.toList(form.values, 'pts') };
          return (form.id ? acts.update(form.id, data) : acts.create(data)).then(reload).then(function () { dlg().close(); }).catch(function (e) { dmsg(e.message); });
        }
        if (act === 'undo') {
          if (busy) return; busy = true;
          return rpg.voidEntry(t.getAttribute('data-key')).then(function (r) { note = r.duplicate ? 'Ese apunte ya estaba anulado.' : 'Apunte anulado (queda en el historial como ajuste).'; noteKey = ''; return reload(); })
            .catch(function (e) { note = e.message; noteKey = ''; showNote(); }).then(function () { busy = false; });
        }
        if (act === 'log') {
          if (busy) return; busy = true;
          Array.prototype.forEach.call(view.querySelectorAll('.act-log'), function (b) { b.disabled = true; });
          var before = st.computed.general.level;
          return acts.log(id, { req: R.newRequestId(), day: $('#act-day').value || R.today() }).then(function (r) {
            return rpg.state(true).then(function (s) {
              st = s;
              note = r.duplicate ? 'Ese apunte ya estaba guardado.' : '+' + r.entry.xp + ' XP · ' + r.entry.label + U.levelNote(before, s.computed.general.level);
              noteKey = r.duplicate ? '' : r.entry.key; paint();
            });
          }).catch(function (e) { note = (e && e.message) || 'No se pudo guardar. No se ha sumado nada.'; noteKey = ''; paint(); })
            .then(function () { busy = false; });
        }
      });
      view.addEventListener('input', function (ev) {
        var t = ev.target, id = t && t.getAttribute ? t.getAttribute('data-pkval') : null;
        if (!id || !form) return;
        form.values[id] = Math.floor(Number(t.value)) || 0;
        var el = $('[data-pk-total]'); if (el) el.textContent = K.summaryText(form.values, 'pts');
      });
      reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las actividades. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>'; });
    }
  };
})(window.App = window.App || {});
