// Ventana «Añadir actividad»: todas las actividades guardadas como cápsulas (con buscador), se marcan una o varias
// y se acepta. Al final, «+ Nueva actividad» abre el formulario; «Editar» permite cambiar o archivar las que hay.
// La usan la ficha del personaje (registrar ahora) y el editor del diario (elegir las de una entrada).
//
//   var picker = V.activityPicker(dialogEl, { acts, rpg, allowOnce, requireOne, acceptLabel(n, xp), onAccept(ids), onOnce(o) });
//   picker.open({ title: 'Añadir actividad', selected: [] });
// onAccept puede devolver una promesa: si falla, su mensaje se muestra y la ventana sigue abierta.
// allowOnce: en la ficha, una actividad nueva puede registrarse solo esa vez (onOnce) en lugar de guardarse.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews, K = V.pickers, U = V.util;

  V.activityPicker = function (dialog, opts) {
    var acts = opts.acts, rpg = opts.rpg;
    var list = [], st = null, staged = [], edit = false, query = '', form = null, busy = false, title = '';
    function $(s) { return dialog.querySelector(s); }
    function byId(id) { return list.filter(function (a) { return a.id === id; })[0]; }
    function msg(sel, text, kind) { var el = $(sel); if (el) { el.textContent = text || ''; el.setAttribute('data-kind', kind || 'error'); } }
    function names() { return U.subNames(st.structure); }
    function stagedXp() { return staged.reduce(function (t, id) { var a = byId(id); return t + (a ? R.activityXp(a) : 0); }, 0); }

    function shell() {
      dialog.innerHTML = '<h3 id="ap-title">' + esc(title) + '</h3>' +
        '<div id="ap-list">' +
          '<label class="searchbox"><span class="sr">Buscar actividad</span><input id="ap-q" type="search" placeholder="Buscar actividad…" autocomplete="off" spellcheck="false"></label>' +
          '<ul class="emo-caps act-caps ap-caps" id="ap-caps" aria-label="Tus actividades"><li class="soft">Cargando…</li></ul>' +
          '<p class="msg" id="ap-msg" role="status" data-kind="error"></p>' +
          '<div class="btn-row ap-foot"><button type="button" class="btn secondary ap-edit" data-ap="edit" aria-pressed="false">Editar</button>' +
            '<button type="button" class="btn secondary" data-ap="close">Cancelar</button>' +
            '<button type="button" class="btn" data-ap="accept" id="ap-accept">' + esc(opts.acceptLabel(0, 0)) + '</button></div>' +
        '</div><div id="ap-form" hidden></div>';
      dialog.setAttribute('aria-labelledby', 'ap-title');
    }

    function capHtml(a) {
      var detail = a.points.map(function (p) { return (names()[p.sub] || p.sub) + ' +' + p.xp; }).join(', ');
      var on = staged.indexOf(a.id) >= 0;
      return '<li><button type="button" class="emo-cap act-cap' + (a.archived ? ' archived' : '') + '" data-ap-cap="' + esc(a.id) + '" title="' + esc(detail) + '"' +
        (edit ? ' aria-label="Editar: ' + esc(a.name) + '"' : ' aria-pressed="' + on + '"') + '>' + icon(a.icon) + '<span>' + esc(a.name) + '</span></button></li>';
    }
    function paintCaps() {
      var q = R.fold(query);
      var shown = list.filter(function (a) { return (edit || !a.archived || staged.indexOf(a.id) >= 0) && (!q || R.fold(a.name).indexOf(q) >= 0); });
      $('#ap-caps').innerHTML = (shown.length ? shown.map(capHtml).join('') : '<li class="soft">' + (q ? 'Ninguna actividad con ese nombre.' : 'Todavía no hay actividades.') + '</li>') +
        '<li><button type="button" class="act-new" data-ap="new"><b aria-hidden="true">+</b>Nueva actividad</button></li>';
      var acc = $('#ap-accept');
      acc.textContent = edit ? 'Listo' : opts.acceptLabel(staged.length, stagedXp());
      acc.disabled = !edit && !!opts.requireOne && !staged.length;
    }
    function load() {
      return Promise.all([acts.list(true), rpg.state()]).then(function (r) { list = r[0]; st = r[1]; });
    }

    // ---- Formulario (nueva o editar) ----
    function pickHtml() { return K.html(K.groups(st.structure, false), names(), form.values, 'pts'); }
    function saveLabel() {
      if (form.id) return 'Guardar';
      var keep = $('#ap-keep');
      return keep && !keep.checked ? 'Registrar solo esta vez' : 'Crear y marcar';
    }
    function openForm(a) {
      form = { id: a ? a.id : null, values: {} };
      if (a) a.points.forEach(function (p) { form.values[p.sub] = p.xp; });
      var once = !a && opts.allowOnce;
      $('#ap-form').innerHTML = '<h4>' + (a ? 'Editar actividad' : 'Nueva actividad') + '</h4>' +
        (a ? '<p class="soft">Lo ya registrado no cambia: cada apunte guarda sus propios puntos.</p>' : '') +
        '<label class="field"><span>Nombre</span><input id="ap-name" type="text" maxlength="' + R.ACTIVITY_LIMITS.name + '" autocomplete="off" value="' + esc(a ? a.name : '') + '" placeholder="Por ejemplo, Patinar"></label>' +
        U.symbolGrid('ap-icon', R.ICONS, a ? a.icon : 'star') +
        (once ? '<label class="checkline"><input type="checkbox" id="ap-keep" checked><span>Guardar para repetirla otras veces</span></label>' : '') +
        '<fieldset class="shares"><legend>Reparte exactamente ' + R.ACTIVITY_XP + ' puntos</legend><div id="ap-pick">' + pickHtml() + '</div></fieldset>' +
        '<p class="msg" id="ap-fmsg" role="status" data-kind="error"></p>' +
        '<div class="btn-row"><button type="button" class="btn" data-ap="save" id="ap-save">' + saveLabel() + '</button>' +
          (a ? '<button type="button" class="btn secondary" data-ap="archive" data-to="' + (a.archived ? '0' : '1') + '">' + (a.archived ? 'Recuperar' : 'Archivar') + '</button>' : '') +
          '<button type="button" class="btn secondary" data-ap="back">Volver</button></div>';
      $('#ap-list').hidden = true; $('#ap-form').hidden = false;
      var n = $('#ap-name'); if (n && n.focus) n.focus();
    }
    function closeForm(text, kind) {
      form = null; $('#ap-form').hidden = true; $('#ap-form').innerHTML = ''; $('#ap-list').hidden = false;
      paintCaps(); msg('#ap-msg', text, kind);
    }
    function checkedIcon() { var el = dialog.querySelector('input[name="ap-icon"]:checked'); return el ? el.value : 'star'; }
    function run(job, sel) {
      if (busy) return; busy = true;
      return Promise.resolve().then(job).catch(function (e) { msg(sel, (e && e.message) || 'No se pudo guardar.'); }).then(function () { busy = false; });
    }

    dialog.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-ap],[data-ap-cap],[data-pk]') : null;
      if (!t) return;
      var pk = t.getAttribute('data-pk');
      if (pk && form) { K.toggle(form.values, pk, 'pts'); $('#ap-pick').innerHTML = pickHtml(); return; }
      var cap = t.getAttribute('data-ap-cap');
      if (cap) {
        if (edit) return openForm(byId(cap));
        var i = staged.indexOf(cap);
        if (i >= 0) staged.splice(i, 1); else staged.push(cap);
        msg('#ap-msg', ''); return paintCaps();
      }
      var act = t.getAttribute('data-ap');
      if (act === 'close') return dialog.close();
      if (act === 'new') return st && openForm(null);
      if (act === 'back') return closeForm();
      if (act === 'edit') { edit = !edit; t.setAttribute('aria-pressed', String(edit)); t.textContent = edit ? 'Elegir' : 'Editar'; msg('#ap-msg', edit ? 'Pulsa una actividad para cambiarla o archivarla.' : '', 'info'); return paintCaps(); }
      if (act === 'accept') {
        if (edit) { edit = false; var eb = $('.ap-edit'); eb.setAttribute('aria-pressed', 'false'); eb.textContent = 'Editar'; msg('#ap-msg', ''); return paintCaps(); }
        return run(function () {
          msg('#ap-msg', 'Guardando…', 'info');
          return Promise.resolve(opts.onAccept(staged.slice())).then(function () { dialog.close(); });
        }, '#ap-msg');
      }
      if (act === 'archive') {
        var id0 = form.id, to = t.getAttribute('data-to') === '1';
        return run(function () {
          return acts.setArchived(id0, to).then(load).then(function () { closeForm(to ? 'Actividad archivada. Sus registros se conservan.' : 'Actividad recuperada.', 'ok'); });
        }, '#ap-fmsg');
      }
      if (act === 'save') {
        var input = { name: $('#ap-name').value, icon: checkedIcon(), points: K.toList(form.values, 'pts') };
        if (form.id) {
          var id1 = form.id;
          return run(function () { return acts.update(id1, input).then(load).then(function () { closeForm('Actividad actualizada.', 'ok'); }); }, '#ap-fmsg');
        }
        var keep = $('#ap-keep');
        if (keep && !keep.checked) {
          return run(function () { return Promise.resolve(opts.onOnce(input)).then(function () { dialog.close(); }); }, '#ap-fmsg');
        }
        return run(function () {
          return acts.create(input).then(function (a) {
            return load().then(function () { if (staged.indexOf(a.id) < 0) staged.push(a.id); query = ''; $('#ap-q').value = ''; closeForm('«' + a.name + '» creada y marcada.', 'ok'); });
          });
        }, '#ap-fmsg');
      }
    });
    dialog.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t && t.id === 'ap-q') { query = t.value; return paintCaps(); }
      var id = t && t.getAttribute ? t.getAttribute('data-pkval') : null;
      if (!id || !form) return;
      form.values[id] = Math.floor(Number(t.value)) || 0;
      var el = dialog.querySelector('[data-pk-total]'); if (el) el.textContent = K.summaryText(form.values, 'pts');
    });
    dialog.addEventListener('change', function (ev) {
      if (ev.target && ev.target.id === 'ap-keep') { var b = $('#ap-save'); if (b) b.textContent = saveLabel(); }
    });

    return {
      open: function (cfg) {
        cfg = cfg || {};
        title = cfg.title || 'Añadir actividad';
        staged = (cfg.selected || []).slice(); edit = false; query = ''; form = null; busy = false;
        shell();
        if (!dialog.open) dialog.showModal();
        if (!acts || !rpg) { $('#ap-caps').innerHTML = '<li class="soft">Conecta tus datos para usar actividades. <a href="#/ajustes">Conectar mis datos</a></li>'; return; }
        load().then(paintCaps).catch(function (e) {
          $('#ap-caps').innerHTML = '<li class="soft">No se pudieron cargar tus actividades. ' + esc((e && e.message) || '') + '</li>';
        });
      }
    };
  };
})(window.App = window.App || {});
