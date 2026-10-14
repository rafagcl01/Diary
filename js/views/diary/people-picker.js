// Personas dentro del editor del diario: cada entrada puede vincularse a varias personas (por identificador).
//  - Botón "Personas": buscador con sugerencias de tus fichas, y crear una ficha nueva sin salir del editor.
//  - Sugerencias al escribir: si el texto menciona a alguien de tus fichas, se PROPONE vincularla. Nunca se vincula
//    nada sin que lo confirmes, y si un nombre puede ser de varias personas se te pide elegir.
//  - Quitar un vínculo no toca el texto. Todo se procesa en este navegador: nada se envía a servicios externos.
(function (App) {
  var D = App.diary, H = App.peopleHtml, esc = App.escapeHtml;
  var DELAY = 350;

  App.peoplePicker = {
    // o = { view, $, getBlocks(), repo (o null), library (array o null si no se pudo cargar), onChange() }
    attach: function (o) {
      var view = o.view, $ = o.$, repo = o.repo;
      var loaded = !!repo && o.library !== null;
      var library = o.library || [], byId = D.personMap(library);
      var activeId = null, timers = {}, dismissed = {};

      function blocks() { return o.getBlocks(); }
      function blockById(id) { var b = blocks(); for (var i = 0; i < b.length; i++) if (b[i].id === id) return b[i]; return null; }
      function q(sel) { return view.querySelector ? view.querySelector(sel) : null; }
      function say(text, kind) { var m = $('#ppl-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
      function setLibrary(list) { library = list; byId = D.personMap(list); }

      // ---- Chips de las personas de cada entrada ----
      function chipsHtml(block, n) {
        var known = (block.people || []).filter(function (id) { return byId[id]; });
        var hidden = (block.people || []).length - known.length;
        var out = known.map(function (id) {
          var p = byId[id];
          return '<li class="chip person-chip"><a href="#/personas/' + esc(p.id) + '" title="Abrir la ficha de ' + esc(p.name) + '">' + H.avatar(p, 'tiny') + '<span>' + esc(p.name) + '</span></a>' +
            ' <button type="button" class="chip-x" data-ppl-remove="' + esc(id) + '" data-block="' + esc(block.id) + '" aria-label="Quitar a ' + esc(p.name) + ' de la entrada ' + n + '">×</button></li>';
        }).join('');
        if (hidden > 0 && !loaded) out += '<li class="soft">' + hidden + (hidden === 1 ? ' persona vinculada' : ' personas vinculadas') + ' (no se pueden mostrar ahora)</li>';
        return out;
      }
      function paintChips(id) {
        var b = blockById(id), list = q('[data-pplist="' + id + '"]');
        if (b && list) list.innerHTML = chipsHtml(b, blocks().indexOf(b) + 1);
      }

      // ---- Sugerencias ----
      function paintSuggest(id) {
        var b = blockById(id), box = q('[data-suggest="' + id + '"]');
        if (!b || !box) return;
        var found = loaded ? D.suggestPeople(b.text, library, { linked: b.people, dismissed: dismissed }) : [];
        if (!found.length) { box.innerHTML = ''; return; }
        box.innerHTML = '<p class="soft">Posibles personas en este texto. No se vincula nada hasta que lo confirmes.</p>' + found.map(function (s) {
          var many = s.people.length > 1;
          return '<div class="suggest-item"><span>' + (many ? '«<b>' + esc(s.term) + '</b>» puede ser:' : '¿Hablas de <b>' + esc(s.term) + '</b>?') + '</span>' +
            s.people.map(function (p) {
              return '<button type="button" class="mini" data-sg-link="' + esc(p.id) + '" data-block="' + esc(id) + '">' + (many ? '' : 'Vincular a ') + esc(D.personLabel(p)) + '</button>';
            }).join('') +
            '<button type="button" class="mini" data-sg-dismiss="' + esc(s.key) + '" data-block="' + esc(id) + '">' + (many ? 'Ninguna' : 'No') + '</button></div>';
        }).join('');
      }
      function scheduleSuggest(id) { clearTimeout(timers[id]); timers[id] = setTimeout(function () { paintSuggest(id); }, DELAY); }

      function refreshBlock(id) { paintChips(id); paintSuggest(id); }
      function refreshAll() { blocks().forEach(function (b) { refreshBlock(b.id); }); }

      // ---- Vincular y desvincular ----
      function link(id, personId) {
        var b = blockById(id); if (!b) return false;
        if (b.people.indexOf(personId) >= 0) return true;
        if (b.people.length >= D.LIMITS.people) { say('Una entrada admite hasta ' + D.LIMITS.people + ' personas.', 'error'); return false; }
        b.people = D.uniquePersonIds(b.people.concat([personId]));
        return true;
      }
      function unlink(id, personId) {
        var b = blockById(id); if (!b) return;
        b.people = b.people.filter(function (x) { return x !== personId; });
      }

      // ---- Diálogo ----
      function active() { return blockById(activeId); }
      function hintFor(name) {
        var key = D.personKey(name);
        if (key.length < 2) return '';
        var similar = D.searchPeople(library, name).slice(0, 3);
        if (!similar.length) return '';
        return 'Ya tienes: ' + similar.map(function (p) { return D.personLabel(p) + (p.nicknames.length ? ' (' + p.nicknames.join(', ') + ')' : ''); }).join('; ') +
          '. Si es otra persona, indica una relación distinta para no confundirlas.';
      }
      function paintList() {
        var b = active(), chosen = b ? b.people : [], text = $('#ppl-q').value;
        if (!repo) { $('#ppl-list').innerHTML = '<li class="soft">Conecta tus datos para usar fichas de personas. <a href="#/ajustes">Conectar mis datos</a></li>'; return; }
        if (!loaded) { $('#ppl-list').innerHTML = '<li class="soft">No se pudieron cargar tus fichas ahora mismo.</li>'; return; }
        if (!library.length) { $('#ppl-list').innerHTML = '<li class="soft">Todavía no tienes fichas. Crea la primera aquí mismo.</li>'; return; }
        var found = D.searchPeople(library, text).slice(0, 40);
        $('#ppl-list').innerHTML = found.length ? found.map(function (p) {
          var nick = D.matchedNickname(p, text);
          var sub = [p.relation, nick ? 'apodo: ' + nick : ''].filter(Boolean).map(esc).join(' · ');
          return '<li class="ppl-item"><button type="button" class="ppl-toggle" data-ppl-toggle="' + esc(p.id) + '" aria-pressed="' + (chosen.indexOf(p.id) >= 0) + '">' +
            H.avatar(p, 'tiny') + '<span class="ppl-text"><span>' + esc(p.name) + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></button></li>';
        }).join('') : '<li class="soft">Nadie coincide con esa búsqueda. Puedes crear la ficha ahora.</li>';
      }
      function openForm() {
        $('#ppl-form').hidden = false; $('#ppl-name').value = $('#ppl-q').value.trim(); $('#ppl-rel').value = '';
        $('#ppl-hint').textContent = hintFor($('#ppl-name').value); say('', 'info');
        if ($('#ppl-name').focus) $('#ppl-name').focus();
      }
      function closeForm() { $('#ppl-form').hidden = true; $('#ppl-hint').textContent = ''; }
      function openDialog(id) {
        activeId = id; closeForm(); say('', 'info');
        $('#ppl-q').value = '';
        $('#ppl-n').textContent = String(blocks().indexOf(blockById(id)) + 1);
        $('#ppl-new').disabled = !loaded;
        paintList();
        $('#ppl-dialog').showModal();
      }
      function createPerson() {
        if (!repo) return;
        say('Guardando…', 'info');
        repo.create({ name: $('#ppl-name').value, relation: $('#ppl-rel').value }).then(function (p) {
          return repo.list().then(function (list) {
            setLibrary(list);
            if (link(activeId, p.id)) o.onChange();
            refreshBlock(activeId); paintList(); closeForm();
            say('Ficha creada y vinculada a la entrada.', 'ok');
          });
        }).catch(function (err) { say(err && err.message ? err.message : 'No se pudo crear la ficha.', 'error'); });
      }

      view.addEventListener('input', function (e) {
        var t = e.target;
        if (t && t.dataset && t.dataset.text) scheduleSuggest(t.dataset.text);
        else if (t && t.id === 'ppl-q') paintList();
        else if (t && t.id === 'ppl-name') $('#ppl-hint').textContent = hintFor(t.value);
      });
      view.addEventListener('keydown', function (e) {
        if (e.target && e.target.id === 'ppl-name' && e.key === 'Enter') { e.preventDefault(); createPerson(); }
      });
      view.addEventListener('click', function (e) {
        var t = e.target; if (!t || !t.closest) return;
        var open = t.closest('[data-ppl-open]'), toggle = t.closest('[data-ppl-toggle]'), rm = t.closest('[data-ppl-remove]');
        var sgLink = t.closest('[data-sg-link]'), sgNo = t.closest('[data-sg-dismiss]');
        if (open) { openDialog(open.dataset.pplOpen); return; }
        if (toggle) {
          var b = active(); if (!b) return;
          if (b.people.indexOf(toggle.dataset.pplToggle) >= 0) unlink(activeId, toggle.dataset.pplToggle);
          else if (!link(activeId, toggle.dataset.pplToggle)) return;
          o.onChange(); refreshBlock(activeId); paintList(); return;
        }
        if (rm) { unlink(rm.dataset.block, rm.dataset.pplRemove); o.onChange(); refreshBlock(rm.dataset.block); return; }
        if (sgLink) { if (link(sgLink.dataset.block, sgLink.dataset.sgLink)) o.onChange(); refreshBlock(sgLink.dataset.block); return; }
        if (sgNo) { dismissed[sgNo.dataset.sgDismiss] = true; paintSuggest(sgNo.dataset.block); return; }
        if (t.closest('#ppl-new')) { openForm(); return; }
        if (t.closest('#ppl-cancel')) { closeForm(); say('', 'info'); return; }
        if (t.closest('#ppl-save')) { createPerson(); return; }
        if (t.closest('#ppl-done')) { $('#ppl-dialog').close(); }
      });

      return { refreshAll: refreshAll, refreshBlock: refreshBlock, library: function () { return library; } };
    }
  };
})(window.App = window.App || {});
