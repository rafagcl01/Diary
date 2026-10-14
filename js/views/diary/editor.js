// Diario: escribir o editar una entrada. El texto se guarda como borrador mientras escribes.
(function (App) {
  var D = App.diary, esc = App.escapeHtml;
  App.diaryViews = App.diaryViews || {};

  function hhmm(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  App.diaryViews.editor = {
    // id = null para una entrada nueva
    render: function (root, id) {
      var repo = D.repo();
      var key = id || 'new';

      function start(prev) {
        var saved = prev ? { date: prev.date, title: prev.title, text: D.blocksToText(prev.blocks), tags: prev.tags.slice(), favorite: prev.favorite } :
          { date: D.nowLocal(), title: '', text: '', tags: [], favorite: false };
        var draft = App.drafts.get(key);
        var useDraft = !!(draft && !App.drafts.isEmpty(draft));
        var begin = useDraft ? { date: draft.date || saved.date, title: draft.title, text: draft.text, tags: draft.tags, favorite: draft.favorite } : saved;
        var tags = D.uniqueTags(begin.tags);
        var backHref = prev ? '#/diario/' + esc(prev.id) : '#/diario';

        root.innerHTML = '<div class="view editor-view">' +
          App.pageHeader(prev ? 'Editar entrada' : 'Nueva entrada', '', 'cuaderno privado') +
          '<div class="editbar"><a class="btn secondary" href="' + backHref + '">Volver</a>' +
            '<span id="e-draft" class="soft draft-status" role="status" aria-live="polite"></span></div>' +
          (repo ? '' : '<p class="msg" data-kind="info">Todavía no hay datos conectados. Puedes escribir: el texto se guarda como borrador en este navegador, y podrás guardarlo en cuanto conectes. <a href="#/ajustes">Conectar mis datos</a></p>') +
          (useDraft ? '<p class="msg" id="e-restored" data-kind="info">Has recuperado un borrador de las ' + esc(hhmm(draft.updatedAt)) + '. <button type="button" class="btn secondary" id="e-discard">Descartar borrador</button></p>' : '') +
          '<article class="card paper sheet editor">' +
            '<div class="editor-meta">' +
              '<label class="field"><span>Fecha y hora</span><input id="e-date" type="datetime-local" value="' + esc(begin.date) + '"></label>' +
              '<label class="field grow"><span>Título (opcional)</span><input id="e-title" type="text" maxlength="' + D.LIMITS.title + '" autocomplete="off" value="' + esc(begin.title) + '"></label>' +
            '</div>' +
            '<label class="field"><span class="sr">Texto de la entrada</span>' +
              '<textarea id="e-text" rows="14" placeholder="Querido diario, hoy…" aria-describedby="e-hint">' + esc(begin.text) + '</textarea></label>' +
            '<p class="soft" id="e-hint">Separa los párrafos con una línea en blanco. Si sales sin guardar, tu texto queda como borrador.</p>' +
            '<div class="field"><span id="e-tags-label">Etiquetas</span>' +
              '<div class="tags-input"><ul class="chips" id="e-taglist" aria-live="polite"></ul>' +
              '<input id="e-tag-input" type="text" autocomplete="off" aria-labelledby="e-tags-label" placeholder="Añade una y pulsa Intro"></div></div>' +
            '<label class="checkline"><input id="e-fav" type="checkbox"' + (begin.favorite ? ' checked' : '') + '><span>Marcar como favorita</span></label>' +
          '</article>' +
          '<div class="btn-row"><button type="button" class="btn" id="e-save">Guardar</button><a class="btn secondary" href="' + backHref + '">Cancelar</a></div>' +
          '<p class="msg" id="e-msg" role="status" data-kind="info"></p>' +
          '</div>';

        var view = root.querySelector('.editor-view');
        function $(sel) { return root.querySelector(sel); }
        var busy = false, timer = null;

        function say(text, kind) { var m = $('#e-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }

        function paintTags() {
          $('#e-taglist').innerHTML = tags.map(function (t, i) {
            return '<li class="chip">#' + esc(t) + ' <button type="button" class="chip-x" data-remove-tag="' + i + '" aria-label="Quitar etiqueta ' + esc(t) + '">×</button></li>';
          }).join('');
        }
        function addTag(raw) {
          var next = D.uniqueTags(tags.concat(String(raw).split(',')));
          if (next.length !== tags.length) { tags = next; paintTags(); scheduleDraft(); }
          $('#e-tag-input').value = '';
        }
        function commitTagInput() { var v = $('#e-tag-input').value; if (v.trim()) addTag(v); }

        function snapshot() {
          return { date: $('#e-date').value, title: $('#e-title').value, text: $('#e-text').value, tags: tags.slice(), favorite: $('#e-fav').checked };
        }
        function flushDraft() {
          clearTimeout(timer); timer = null;
          var ok = App.drafts.save(key, snapshot());
          $('#e-draft').textContent = ok ? 'Borrador guardado en este navegador a las ' + hhmm(new Date().toISOString()) : 'No se pudo guardar el borrador en este navegador.';
        }
        function scheduleDraft() { clearTimeout(timer); timer = setTimeout(flushDraft, 500); }

        paintTags();
        view.addEventListener('input', function (e) {
          if (e.target.id === 'e-tag-input') return;
          scheduleDraft();
        });
        view.addEventListener('change', scheduleDraft);
        view.addEventListener('focusout', function (e) {
          if (timer && e.target.id !== 'e-tag-input') flushDraft();
          if (e.target.id === 'e-tag-input') commitTagInput();
        });
        view.addEventListener('click', function (e) {
          var rm = e.target.closest ? e.target.closest('[data-remove-tag]') : null;
          if (rm) { tags.splice(Number(rm.dataset.removeTag), 1); paintTags(); scheduleDraft(); }
        });
        $('#e-tag-input').addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(e.target.value); }
          else if (e.key === 'Backspace' && !e.target.value && tags.length) { tags.pop(); paintTags(); scheduleDraft(); }
        });

        var discard = $('#e-discard');
        if (discard) discard.addEventListener('click', function () {
          if (!window.confirm('¿Descartar el borrador y volver a ' + (prev ? 'la versión guardada' : 'una hoja en blanco') + '?')) return;
          clearTimeout(timer); App.drafts.remove(key);
          start_again(prev);
        });
        function start_again(p) { App.diaryViews.editor.render(root, p ? p.id : null); }

        function save() {
          if (busy) return;
          commitTagInput();
          var s = snapshot();
          if (!s.title.trim() && !D.splitParagraphs(s.text).length) { say('Escribe al menos una línea o un título.', 'error'); $('#e-text').focus(); return; }
          if (!D.parseLocal(s.date)) { say('La fecha y la hora no son válidas.', 'error'); $('#e-date').focus(); return; }
          flushDraft();
          var r = D.repo();
          if (!r) { say('Conecta tus datos para guardar. Mientras tanto, tu texto sigue guardado como borrador en este navegador.', 'error'); return; }
          busy = true; $('#e-save').disabled = true; say('Guardando…', 'info');
          var input = { date: s.date, title: s.title.trim(), blocks: D.reconcileBlocks(prev ? prev.blocks : [], s.text), tags: s.tags, favorite: s.favorite };
          if (prev) input.id = prev.id;
          r.save(input).then(function (entry) {
            App.drafts.remove(key);
            location.hash = '#/diario/' + entry.id;
          }).catch(function (err) {
            say((err && err.message ? err.message : 'No se pudo guardar.') + ' Tu texto sigue como borrador.', 'error');
            busy = false; $('#e-save').disabled = false;
          });
        }
        $('#e-save').addEventListener('click', save);
        $('#e-text').addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } });
      }

      if (!id) { start(null); return; }

      if (!repo) {
        root.innerHTML = '<div class="view">' + App.pageHeader('Editar entrada', '', 'cuaderno privado') + App.lace() +
          '<section class="card stitched empty"><div class="empty-icon">' + App.icon('book') + '</div><h2>Conecta tus datos para editar esta entrada</h2>' +
          '<a class="btn secondary" href="#/ajustes">Conectar mis datos</a></section></div>';
        return;
      }
      root.innerHTML = '<div class="view">' + App.pageHeader('Editar entrada', '', 'cuaderno privado') + '<div class="skeleton" style="margin: 14px 0"></div></div>';
      repo.get(id).then(function (prev) {
        if (!prev) {
          root.innerHTML = '<div class="view">' + App.pageHeader('No encuentro esta entrada', '', 'cuaderno privado') +
            '<p><a class="btn secondary" href="#/diario">Volver al diario</a></p></div>';
          return;
        }
        start(prev);
      }).catch(function (err) {
        root.innerHTML = '<div class="view">' + App.pageHeader('No se pudo cargar', '', 'cuaderno privado') +
          '<div class="msg" data-kind="error">' + esc(err.message || 'Inténtalo de nuevo.') + '</div></div>';
      });
    }
  };
})(window.App = window.App || {});
