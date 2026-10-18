// Personas: crear o editar una ficha. Solo el nombre es obligatorio; todo lo demás es opcional y editable.
(function (App) {
  var D = App.diary, H = App.peopleHtml, esc = App.escapeHtml, icon = App.icon;
  App.peopleViews = App.peopleViews || {};

  var RELATIONS = ['amistad', 'familia', 'pareja', 'expareja', 'trabajo', 'estudios', 'vecindad', 'conocidos'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var PHOTO_PX = 160;

  // Reduce la foto elegida a una miniatura cuadrada JPEG (recortada al centro) para guardarla dentro de people.json.
  function shrinkPhoto(file) { return App.shrinkPhoto(file, PHOTO_PX, D.PEOPLE_LIMITS.photo); }
  // Cápsulas del menú de relaciones: igual que el de emociones, sin símbolo, y el círculo "+" al final
  function relCaps(lib, staged) {
    return lib.map(function (r) {
      return '<li><button type="button" class="emo-cap" data-rel-toggle="' + esc(r) + '" aria-pressed="' + (staged.map(D.fold).indexOf(D.fold(r)) >= 0) + '"><span>' + esc(r) + '</span></button></li>';
    }).join('') + '<li><button type="button" class="plus-btn" id="rel-new" aria-label="Añadir relación nueva" title="Añadir relación nueva"><span aria-hidden="true">+</span></button></li>';
  }

  function chipList(items, kind) {
    return items.map(function (t, i) {
      return '<li class="chip">' + (kind === 'tag' ? '#' : '') + esc(t) + ' <button type="button" class="chip-x" data-remove-' + kind + '="' + i + '" aria-label="Quitar ' + esc(t) + '">×</button></li>';
    }).join('');
  }

  App.peopleViews.form = {
    // id = null para una ficha nueva
    render: function (root, id) {
      var repo = D.people(), diary = D.repo();
      var back = id ? '#/personas/' + id : '#/personas';
      if (!repo) {
        root.innerHTML = '<div class="view people-view">' + App.pageHeader(id ? 'Editar ficha' : 'Nueva persona', '', 'álbum de personas') +
          '<div class="msg" data-kind="info">Conecta tus datos para crear o editar fichas. <a href="#/ajustes">Conectar mis datos</a></div></div>';
        return;
      }
      root.innerHTML = '<div class="view people-view"><div class="skeleton" style="margin: 14px 0"></div></div>';
      var view = root.querySelector('.people-view');

      repo.list().then(function (people) {
        var person = null;
        if (id) {
          person = D.personMap(people)[id];
          if (!person) { view.innerHTML = App.pageHeader('No encuentro esa ficha', '', 'álbum de personas') + '<p><a class="btn secondary" href="#/personas">Volver a Personas</a></p>'; return; }
        }
        var base = person || { name: '', nicknames: [], symbol: null, met: '', relations: [], birthday: '', photo: '', notes: '', tags: [] };
        var rels = (base.relations || []).slice(), photo = base.photo || '', lib = RELATIONS.slice();
        people.forEach(function (o) { (o.relations || []).forEach(function (r) { if (lib.map(D.fold).indexOf(D.fold(r)) < 0) lib.push(r); }); });
        rels.forEach(function (r) { if (lib.map(D.fold).indexOf(D.fold(r)) < 0) lib.push(r); });
        var bd = (base.birthday || '').split('-'), bYear = bd.length === 3 ? bd[0] : '', bMonth = bd.length >= 2 ? +bd[bd.length - 2] : 0, bDay = bd.length >= 2 ? +bd[bd.length - 1] : '';
        var nicks = base.nicknames.slice(), tags = base.tags.slice(), symbol = base.symbol, busy = false;

        view.innerHTML =
          '<div class="editbar"><a class="btn secondary" href="' + back + '">Volver</a></div>' +
          '<article class="card paper sheet editor person-form">' +
            '<h1 id="page-title" class="date-h1" tabindex="-1">' + (id ? 'Editar ficha' : 'Nueva persona') + '</h1>' +
            '<p class="soft">Solo el nombre es obligatorio. Lo demás puedes dejarlo en blanco y cambiarlo cuando quieras.</p>' +
            '<label class="field"><span>Nombre</span><input id="p-name" type="text" maxlength="' + D.PEOPLE_LIMITS.name + '" autocomplete="off" value="' + esc(base.name) + '"></label>' +
            '<div class="field"><span id="nick-l">Apodos</span><ul class="chips" id="p-nicks" aria-live="polite">' + chipList(nicks, 'nick') + '</ul>' +
              '<input id="p-nick" type="text" maxlength="' + D.PEOPLE_LIMITS.nickname + '" autocomplete="off" aria-labelledby="nick-l" placeholder="Un apodo y pulsa Intro"></div>' +
            '<div class="field"><span id="rel-l">Relaciones <small>(opcional)</small></span>' +
              '<div class="emo-row"><ul class="chips emo-selected" id="p-rels-sel" aria-labelledby="rel-l" aria-live="polite">' + chipList(rels, 'rel') + '</ul>' +
                '<button type="button" class="mini" id="p-rel-open" aria-haspopup="dialog">Relaciones</button></div>' +
              '<small>Si tienes a dos personas con el mismo nombre, las relaciones son lo que las distingue.</small></div>' +
            '<div class="field"><span id="bd-l">Cumpleaños <small>(opcional; el año también)</small></span>' +
              '<div class="bday-row" role="group" aria-labelledby="bd-l">' +
                '<input id="p-bd-d" type="text" inputmode="numeric" maxlength="2" autocomplete="off" placeholder="Día" aria-label="Día" value="' + esc(bDay) + '">' +
                // El desplegable compartido (components.js) se monta solo sobre este <select>.
                '<select id="p-bd-m" aria-label="Mes">' +
                  ['Mes'].concat(MONTHS).map(function (m, i) { return '<option value="' + (i || '') + '"' + ((bMonth || 0) === i ? ' selected' : '') + '>' + m + '</option>'; }).join('') +
                '</select>' +
                '<input id="p-bd-y" type="text" inputmode="numeric" maxlength="4" placeholder="Año" aria-label="Año (opcional)" value="' + esc(bYear) + '"></div></div>' +
            '<div class="field"><span id="ph-l">Foto <small>(opcional)</small></span>' +
              '<div class="photo-row"><input id="p-photo" class="sr" type="file" accept="image/*" aria-labelledby="ph-l">' +
                '<label class="photo-pick" for="p-photo"><span class="photo-circle" id="p-photo-prev"></span><span class="photo-text" id="p-photo-text">Añadir foto</span></label>' +
                '<button type="button" class="mini" id="p-photo-rm"' + (photo ? '' : ' hidden') + '>Quitar foto</button></div>' +
              '<small>Se guarda reducida (cuadrada, 160 px) dentro de tus datos. Cuantas más fotos, más pesa el archivo de fichas.</small></div>' +
            '<label class="field"><span>Fecha aproximada en que la conocí <small>(opcional)</small></span><input id="p-met" type="text" inputmode="numeric" autocomplete="off" placeholder="2019, 2019-05 o 2019-05-14" value="' + esc(base.met) + '"></label>' +
            '<fieldset class="symbols"><legend>Avatar</legend><div class="symbol-grid" id="p-symbols"></div></fieldset>' +
            '<label class="field"><span>Notas <small>(solo para ti)</small></span><textarea id="p-notes" rows="5" maxlength="' + D.PEOPLE_LIMITS.notes + '">' + esc(base.notes) + '</textarea></label>' +
            '<div class="field"><span id="tag-l">Etiquetas</span><ul class="chips" id="p-tags" aria-live="polite">' + chipList(tags, 'tag') + '</ul>' +
              '<input id="p-tag" type="text" maxlength="' + D.LIMITS.tag + '" autocomplete="off" aria-labelledby="tag-l" placeholder="Una etiqueta y pulsa Intro"></div>' +
            '<div class="btn-row"><button type="button" class="btn" id="p-save">Guardar</button><a class="btn secondary" href="' + back + '">Cancelar</a>' +
              (id ? '<button type="button" class="btn secondary" id="p-delete">Borrar ficha</button>' : '') + '</div>' +
            '<p class="msg" id="p-msg" role="status" data-kind="info"></p>' +
          '</article>' +
          '<dialog class="confirm emo-dialog" id="rel-dialog" aria-labelledby="rel-title">' +
            '<h3 id="rel-title">Relaciones</h3>' +
            '<p class="soft">Pulsa las que quieras para marcarlas (pulsa otra vez para quitarlas) y luego Aceptar.</p>' +
            '<ul class="emo-caps" id="rel-list" aria-label="Relaciones guardadas"></ul>' +
            '<div id="rel-form" hidden>' +
              '<h4 id="rel-form-title">Nueva relación</h4>' +
              '<label class="field"><span>Nombre</span><input id="rel-name" type="text" maxlength="' + D.PEOPLE_LIMITS.relation + '" autocomplete="off" placeholder="Por ejemplo, vecindad"></label>' +
              '<div class="btn-row"><button type="button" class="btn" id="rel-save">Guardar relación</button><button type="button" class="btn secondary" id="rel-cancel">Cancelar</button></div>' +
            '</div>' +
            '<p class="msg" id="rel-msg" role="status" data-kind="info"></p>' +
            '<div class="btn-row"><button type="button" class="btn secondary" id="rel-edit" disabled>Editar</button><button type="button" class="btn" id="rel-done">Aceptar</button></div>' +
          '</dialog>';

        function $(sel) { return root.querySelector(sel); }
        function say(text, kind) { var m = $('#p-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
        function paintSymbols() {
          $('#p-symbols').innerHTML = [{ id: '', label: 'La inicial del nombre' }].concat(D.EMOTION_SYMBOLS).map(function (s) {
            return '<label class="symbol"><input type="radio" name="p-symbol" value="' + s.id + '"' + ((symbol || '') === s.id ? ' checked' : '') + '>' +
              '<span class="symbol-box">' + (s.id ? icon(s.id) : '<span class="av-letter">Aa</span>') + '</span><span class="sr">' + esc(s.label) + '</span></label>';
          }).join('');
        }
        paintSymbols();
        function paintPhoto() {
          $('#p-photo-prev').innerHTML = photo ? H.avatar({ id: id || 'pe_00000000', photo: photo, name: '' }, 'large') : '<span class="photo-plus" aria-hidden="true">+</span>';
          $('#p-photo-text').textContent = photo ? 'Cambiar foto' : 'Añadir foto';
          $('#p-photo-rm').hidden = !photo;
        }
        paintPhoto();
        // ---- Relaciones: mismo menú que las emociones (cápsulas, "+", Editar, Aceptar), sin símbolos ----
        var relStaged = [], relEditing = null;
        function relSay(text, kind) { var m = $('#rel-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
        function paintSelectedRels() { $('#p-rels-sel').innerHTML = chipList(rels, 'rel'); }
        function paintRelList() { $('#rel-list').innerHTML = relCaps(lib, relStaged); $('#rel-edit').disabled = !relStaged.length; }
        function openRelForm(name) {
          relEditing = name; $('#rel-form-title').textContent = name ? 'Editar relación' : 'Nueva relación';
          $('#rel-name').value = name || ''; relSay('', 'info'); $('#rel-form').hidden = false;
          if ($('#rel-name').focus) $('#rel-name').focus();
        }
        function closeRelForm() { $('#rel-form').hidden = true; relEditing = null; }
        function openRel() { relStaged = rels.slice(); closeRelForm(); relSay('', 'info'); paintRelList(); $('#rel-dialog').showModal(); }
        function stageRel(r, on) {
          var i = relStaged.map(D.fold).indexOf(D.fold(r));
          if (on && i < 0) relStaged.push(r); else if (!on && i >= 0) relStaged.splice(i, 1);
          paintRelList();
        }
        function acceptRels() { rels = relStaged.slice(); paintSelectedRels(); $('#rel-dialog').close(); }
        function replaceIn(list, from, to) { var k = D.fold(from); for (var i = 0; i < list.length; i++) if (D.fold(list[i]) === k) list[i] = to; }
        function saveRel() {
          var name;
          try { name = D.cleanRelations([$('#rel-name').value])[0]; } catch (err) { relSay(err.message, 'error'); return; }
          if (!name) { relSay('Escribe el nombre de la relación.', 'error'); return; }
          var old = relEditing, key = D.fold(name);
          if (lib.some(function (x) { return D.fold(x) === key && D.fold(x) !== D.fold(old || ''); })) { relSay('Esa relación ya existe.', 'error'); return; }
          if (!old) {
            if (relStaged.length >= D.PEOPLE_LIMITS.relations) { relSay('Máximo ' + D.PEOPLE_LIMITS.relations + ' relaciones.', 'error'); return; }
            lib.push(name); relStaged.push(name); paintRelList(); closeRelForm();
            relSay('Relación creada y marcada. Pulsa Aceptar para añadirla.', 'ok'); return;
          }
          function applyLocal() {
            replaceIn(lib, old, name); replaceIn(relStaged, old, name); replaceIn(rels, old, name);
            paintRelList(); paintSelectedRels(); closeRelForm(); relSay('Relación actualizada.', 'ok');
          }
          var used = people.some(function (o) { return (o.relations || []).some(function (r) { return D.fold(r) === D.fold(old); }); });
          if (!used) { applyLocal(); return; }                       // solo existe en este formulario
          relSay('Guardando…', 'info');
          repo.renameRelation(old, name).then(function () { return repo.list(true); }).then(function (l) { people = l; applyLocal(); })
            .catch(function (err) { relSay(err && err.message ? err.message : 'No se pudo guardar la relación.', 'error'); });
        }
        function addTo(list, raw, max) {
          String(raw).split(',').forEach(function (x) { x = x.replace(/\s+/g, ' ').trim(); if (x && list.length < max && list.map(D.fold).indexOf(D.fold(x)) < 0) list.push(x); });
        }
        function paintNicks() { $('#p-nicks').innerHTML = chipList(nicks, 'nick'); }
        function paintTags() { $('#p-tags').innerHTML = chipList(tags, 'tag'); }
        function commitInputs() {
          if ($('#p-nick').value.trim()) { addTo(nicks, $('#p-nick').value, D.PEOPLE_LIMITS.nicknames); $('#p-nick').value = ''; paintNicks(); }
          if ($('#p-tag').value.trim()) { addTo(tags, $('#p-tag').value, D.LIMITS.tags); $('#p-tag').value = ''; paintTags(); }
        }

        view.addEventListener('keydown', function (e) {
          var t = e.target;
          if (t.id === 'rel-name' && e.key === 'Enter') { e.preventDefault(); saveRel(); return; }
          if ((t.id === 'p-nick' || t.id === 'p-tag') && (e.key === 'Enter' || e.key === ',')) {
            e.preventDefault(); commitInputs();
          }
        });
        view.addEventListener('input', function (e) {
          var t = e.target; if (t && (t.id === 'p-bd-d' || t.id === 'p-bd-y') && /\D/.test(t.value)) t.value = t.value.replace(/\D/g, '');   // solo números, a mano
        });
        view.addEventListener('focusout', function (e) { if (e.target && (e.target.id === 'p-nick' || e.target.id === 'p-tag')) commitInputs(); });
        view.addEventListener('change', function (e) { if (e.target && e.target.name === 'p-symbol') symbol = e.target.value || null; });
        view.addEventListener('change', function (e) {
          var t = e.target; if (!t || t.id !== 'p-photo' || !t.files || !t.files[0]) return;
          say('Preparando la foto…', 'info');
          shrinkPhoto(t.files[0]).then(function (data) { photo = data; paintPhoto(); say('', 'info'); }).catch(function (err) { say(err.message, 'error'); });
        });
        view.addEventListener('click', function (e) {
          var t = e.target; if (!t || !t.closest) return;
          if (t.closest('#p-rel-open')) { openRel(); return; }
          var rc = t.closest('[data-rel-toggle]');
          if (rc) { stageRel(rc.dataset.relToggle, relStaged.map(D.fold).indexOf(D.fold(rc.dataset.relToggle)) < 0); return; }
          if (t.closest('#rel-new')) { openRelForm(null); return; }
          if (t.closest('#rel-edit')) { var last = relStaged[relStaged.length - 1]; if (last) openRelForm(last); return; }   // edita la última marcada
          if (t.closest('#rel-cancel')) { closeRelForm(); relSay('', 'info'); return; }
          if (t.closest('#rel-save')) { saveRel(); return; }
          if (t.closest('#rel-done')) { acceptRels(); return; }
          var rr = t.closest('[data-remove-rel]');
          if (rr) { rels.splice(Number(rr.dataset.removeRel), 1); paintSelectedRels(); return; }
          if (t.closest('#p-photo-rm')) { photo = ''; paintPhoto(); return; }
          var rn = t.closest('[data-remove-nick]'), rt = t.closest('[data-remove-tag]');
          if (rn) { nicks.splice(Number(rn.dataset.removeNick), 1); paintNicks(); return; }
          if (rt) { tags.splice(Number(rt.dataset.removeTag), 1); paintTags(); }
        });

        $('#p-save').addEventListener('click', function () {
          if (busy) return;
          commitInputs();
          var dd = $('#p-bd-d').value.trim(), mm = $('#p-bd-m').value, yy = $('#p-bd-y').value.trim(), birthday = '';
          if (dd || mm || yy) {
            if (!dd || !mm) { say('Para el cumpleaños indica al menos el día y el mes.', 'error'); return; }
            birthday = (yy ? yy + '-' : '') + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2);
          }
          var input = { name: $('#p-name').value, nicknames: nicks, relations: rels, birthday: birthday, photo: photo, met: $('#p-met').value, symbol: symbol, notes: $('#p-notes').value, tags: tags };
          busy = true; $('#p-save').disabled = true; say('Guardando…', 'info');
          (id ? repo.update(id, input) : repo.create(input)).then(function (saved) {
            location.hash = '#/personas/' + saved.id;
          }).catch(function (err) {
            say(err && err.message ? err.message : 'No se pudo guardar.', 'error');
            busy = false; $('#p-save').disabled = false;
          });
        });

        var del = $('#p-delete');
        if (del) del.addEventListener('click', function () {
          if (busy || !diary) return;
          diary.list().then(function (entries) {
            var n = D.fragmentsOf(entries, id).length;
            var ok = window.confirm('¿Borrar la ficha de ' + person.name + '?\n\n' +
              (n ? 'Se quitará su vínculo de ' + (n === 1 ? '1 entrada' : n + ' entradas') + '. ' : '') +
              'Tus textos NO se borran: solo desaparece la ficha y los vínculos. No se puede deshacer desde aquí (GitHub conserva el historial).');
            if (!ok) return;
            busy = true; del.disabled = true; say('Borrando…', 'info');
            return repo.remove(id, diary).then(function () { location.hash = '#/personas'; });
          }).catch(function (err) { say(err && err.message ? err.message : 'No se pudo borrar.', 'error'); busy = false; del.disabled = false; });
        });
      }).catch(function (err) {
        view.innerHTML = '<div class="msg" data-kind="error">No se pudo cargar. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>';
      });
    }
  };
})(window.App = window.App || {});
