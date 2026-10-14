// Personas: crear o editar una ficha. Solo el nombre es obligatorio; todo lo demás es opcional y editable.
(function (App) {
  var D = App.diary, esc = App.escapeHtml, icon = App.icon;
  App.peopleViews = App.peopleViews || {};

  var RELATIONS = ['amistad', 'amigo', 'amiga', 'familia', 'pareja', 'expareja', 'compañero de trabajo', 'compañera de trabajo', 'compañero de clase', 'compañera de clase', 'vecino', 'vecina', 'conocido', 'conocida'];

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
        var base = person || { name: '', nicknames: [], symbol: null, met: '', relation: '', notes: '', tags: [] };
        var nicks = base.nicknames.slice(), tags = base.tags.slice(), symbol = base.symbol, busy = false;

        view.innerHTML =
          '<div class="editbar"><a class="btn secondary" href="' + back + '">Volver</a></div>' +
          '<article class="card paper sheet editor person-form">' +
            '<h1 id="page-title" class="date-h1" tabindex="-1">' + (id ? 'Editar ficha' : 'Nueva persona') + '</h1>' +
            '<p class="soft">Solo el nombre es obligatorio. Lo demás puedes dejarlo en blanco y cambiarlo cuando quieras.</p>' +
            '<label class="field"><span>Nombre</span><input id="p-name" type="text" maxlength="' + D.PEOPLE_LIMITS.name + '" autocomplete="off" value="' + esc(base.name) + '"></label>' +
            '<div class="field"><span id="nick-l">Apodos</span><ul class="chips" id="p-nicks" aria-live="polite">' + chipList(nicks, 'nick') + '</ul>' +
              '<input id="p-nick" type="text" maxlength="' + D.PEOPLE_LIMITS.nickname + '" autocomplete="off" aria-labelledby="nick-l" placeholder="Un apodo y pulsa Intro"></div>' +
            '<label class="field"><span>Relación <small>(opcional)</small></span><input id="p-relation" type="text" list="p-rels" maxlength="' + D.PEOPLE_LIMITS.relation + '" autocomplete="off" value="' + esc(base.relation) + '">' +
              '<datalist id="p-rels">' + RELATIONS.map(function (r) { return '<option value="' + esc(r) + '"></option>'; }).join('') + '</datalist>' +
              '<small>Si tienes a dos personas con el mismo nombre, la relación es lo que las distingue.</small></label>' +
            '<label class="field"><span>Fecha aproximada en que la conocí <small>(opcional)</small></span><input id="p-met" type="text" inputmode="numeric" autocomplete="off" placeholder="2019, 2019-05 o 2019-05-14" value="' + esc(base.met) + '"></label>' +
            '<fieldset class="symbols"><legend>Avatar</legend><div class="symbol-grid" id="p-symbols"></div></fieldset>' +
            '<label class="field"><span>Notas <small>(solo para ti)</small></span><textarea id="p-notes" rows="5" maxlength="' + D.PEOPLE_LIMITS.notes + '">' + esc(base.notes) + '</textarea></label>' +
            '<div class="field"><span id="tag-l">Etiquetas</span><ul class="chips" id="p-tags" aria-live="polite">' + chipList(tags, 'tag') + '</ul>' +
              '<input id="p-tag" type="text" maxlength="' + D.LIMITS.tag + '" autocomplete="off" aria-labelledby="tag-l" placeholder="Una etiqueta y pulsa Intro"></div>' +
            '<div class="btn-row"><button type="button" class="btn" id="p-save">Guardar</button><a class="btn secondary" href="' + back + '">Cancelar</a>' +
              (id ? '<button type="button" class="btn secondary" id="p-delete">Borrar ficha</button>' : '') + '</div>' +
            '<p class="msg" id="p-msg" role="status" data-kind="info"></p>' +
          '</article>';

        function $(sel) { return root.querySelector(sel); }
        function say(text, kind) { var m = $('#p-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
        function paintSymbols() {
          $('#p-symbols').innerHTML = [{ id: '', label: 'La inicial del nombre' }].concat(D.EMOTION_SYMBOLS).map(function (s) {
            return '<label class="symbol"><input type="radio" name="p-symbol" value="' + s.id + '"' + ((symbol || '') === s.id ? ' checked' : '') + '>' +
              '<span class="symbol-box">' + (s.id ? icon(s.id) : '<span class="av-letter">Aa</span>') + '</span><span class="sr">' + esc(s.label) + '</span></label>';
          }).join('');
        }
        paintSymbols();
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
          if ((t.id === 'p-nick' || t.id === 'p-tag') && (e.key === 'Enter' || e.key === ',')) {
            e.preventDefault(); commitInputs();
          }
        });
        view.addEventListener('focusout', function (e) { if (e.target && (e.target.id === 'p-nick' || e.target.id === 'p-tag')) commitInputs(); });
        view.addEventListener('change', function (e) { if (e.target && e.target.name === 'p-symbol') symbol = e.target.value || null; });
        view.addEventListener('click', function (e) {
          var t = e.target; if (!t || !t.closest) return;
          var rn = t.closest('[data-remove-nick]'), rt = t.closest('[data-remove-tag]');
          if (rn) { nicks.splice(Number(rn.dataset.removeNick), 1); paintNicks(); return; }
          if (rt) { tags.splice(Number(rt.dataset.removeTag), 1); paintTags(); }
        });

        $('#p-save').addEventListener('click', function () {
          if (busy) return;
          commitInputs();
          var input = { name: $('#p-name').value, nicknames: nicks, relation: $('#p-relation').value, met: $('#p-met').value, symbol: symbol, notes: $('#p-notes').value, tags: tags };
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
