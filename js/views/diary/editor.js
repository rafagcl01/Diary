// Diario: escribir o editar el día. Una entrada por día, con varios bloques; cada bloque lleva
// su texto, sus etiquetas y su estado de ánimo. Se guarda como borrador mientras escribes.
(function (App) {
  var D = App.diary, H = App.diaryHtml, esc = App.escapeHtml;
  App.diaryViews = App.diaryViews || {};

  function hhmm(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function newBlock() { return { id: D.newBlockId(), text: '', tags: [], mood: null }; }
  function copyBlock(b) { return { id: b.id, text: b.text, tags: b.tags.slice(), mood: b.mood }; }
  function page(title, note, body) { return '<div class="view">' + App.pageHeader(title, '', note) + body + '</div>'; }

  function tagChips(block, n) {
    return block.tags.map(function (t, i) {
      return '<li class="chip">#' + esc(t) + ' <button type="button" class="chip-x" data-remove-tag="' + i + '" data-block="' + esc(block.id) + '" aria-label="Quitar etiqueta ' + esc(t) + ' del bloque ' + n + '">×</button></li>';
    }).join('');
  }

  App.diaryViews.editor = {
    // day = "AAAA-MM-DD";  opts.addBlock = abrir con un bloque nuevo al final
    render: function (root, day, opts) {
      opts = opts || {};
      var repo = D.repo();
      var longDate = esc(D.formatLong(day));

      if (!D.isDay(day) || day > D.today()) {
        root.innerHTML = page('No se puede escribir ahí', longDate,
          '<p class="soft">' + (D.isDay(day) ? 'Ese día todavía no ha llegado.' : 'Esa fecha no es válida.') + '</p><p><a class="btn secondary" href="#/diario">Volver al diario</a></p>');
        return;
      }

      function start(prev) {
        var saved = prev ? { title: prev.title, favorite: prev.favorite, blocks: prev.blocks } : { title: '', favorite: false, blocks: [] };
        var draft = App.drafts.get(day);
        var useDraft = !!(draft && !App.drafts.isEmpty(draft));
        var begin = useDraft ? draft : saved;
        var blocks = begin.blocks.map(copyBlock);
        if (!blocks.length || (opts.addBlock && D.blockHasContent(blocks[blocks.length - 1]))) blocks.push(newBlock());
        var backHref = prev ? '#/diario/' + esc(day) : '#/diario';

        root.innerHTML = '<div class="view editor-view">' +
          App.pageHeader(prev ? 'Editar entrada' : 'Nueva entrada', '', longDate) +
          '<div class="editbar"><a class="btn secondary" href="' + backHref + '">Volver</a>' +
            '<span id="e-draft" class="soft draft-status" role="status" aria-live="polite"></span></div>' +
          (repo ? '' : '<p class="msg" data-kind="info">Todavía no hay datos conectados. Puedes escribir: el texto se guarda como borrador en este navegador y podrás guardarlo en cuanto conectes. <a href="#/ajustes">Conectar mis datos</a></p>') +
          (useDraft ? '<p class="msg" id="e-restored" data-kind="info">Has recuperado un borrador de las ' + esc(hhmm(draft.updatedAt)) + '. <button type="button" class="btn secondary" id="e-discard">Descartar borrador</button></p>' : '') +
          '<article class="card paper sheet editor">' +
            '<label class="field"><span>Título del día (opcional)</span>' +
              '<input id="e-title" type="text" maxlength="' + D.LIMITS.title + '" autocomplete="off" value="' + esc(begin.title) + '"></label>' +
            '<div id="e-blocks"></div>' +
            '<p class="btn-row"><button type="button" class="btn secondary" id="e-add">Añadir bloque</button></p>' +
            '<p class="soft" id="e-hint">Cada bloque es un momento del día, con su ánimo y sus etiquetas. Si sales sin guardar, tu texto queda como borrador.</p>' +
            '<label class="checkline"><input id="e-fav" type="checkbox"' + (begin.favorite ? ' checked' : '') + '><span>Marcar el día como favorito</span></label>' +
          '</article>' +
          '<div class="btn-row"><button type="button" class="btn" id="e-save">Guardar</button><a class="btn secondary" href="' + backHref + '">Cancelar</a></div>' +
          '<p class="msg" id="e-msg" role="status" data-kind="info"></p>' +
          '</div>';

        var view = root.querySelector('.editor-view');
        function $(sel) { return root.querySelector(sel); }
        function q(sel) { return view && view.querySelector ? view.querySelector(sel) : null; }
        function focusSel(sel) { var el = q(sel); if (el && el.focus) el.focus(); }
        function blockIndex(id) { for (var i = 0; i < blocks.length; i++) if (blocks[i].id === id) return i; return -1; }
        function say(text, kind) { var m = $('#e-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
        var busy = false, timer = null;

        function paintBlocks() {
          $('#e-blocks').innerHTML = blocks.map(function (b, i) {
            var n = i + 1, id = esc(b.id);
            return '<section class="block" data-block-id="' + id + '" aria-label="Bloque ' + n + '">' +
              '<div class="block-head"><h2 class="block-title">Bloque ' + n + '</h2><div class="block-tools">' +
                '<button type="button" class="mini" data-up="' + id + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir el bloque ' + n + '">Subir</button>' +
                '<button type="button" class="mini" data-down="' + id + '"' + (i === blocks.length - 1 ? ' disabled' : '') + ' aria-label="Bajar el bloque ' + n + '">Bajar</button>' +
                '<button type="button" class="mini" data-del="' + id + '" aria-label="Quitar el bloque ' + n + '">Quitar</button>' +
              '</div></div>' +
              '<label class="field"><span class="sr">Texto del bloque ' + n + '</span>' +
                '<textarea data-text="' + id + '" rows="5" placeholder="Qué ha pasado, cómo ha ido…">' + esc(b.text) + '</textarea></label>' +
              '<div class="mood-pick" role="radiogroup" aria-label="Estado de ánimo del bloque ' + n + '">' +
                D.MOODS.map(function (m) {
                  return '<button type="button" role="radio" class="mood-btn small" data-block-mood="' + id + '" data-mood="' + m.id + '" aria-checked="' + (b.mood === m.id) + '">' +
                    H.face(m.id) + '<span>' + esc(m.label) + '</span></button>';
                }).join('') + '</div>' +
              '<div class="tags-input"><ul class="chips" data-taglist="' + id + '" aria-live="polite">' + tagChips(b, n) + '</ul>' +
                '<input type="text" data-tag-input="' + id + '" autocomplete="off" aria-label="Añadir etiqueta al bloque ' + n + '" placeholder="Etiqueta y pulsa Intro"></div>' +
              '</section>';
          }).join('');
        }

        function paintTagList(id) {
          var i = blockIndex(id), list = q('[data-taglist="' + id + '"]');
          if (list && i >= 0) list.innerHTML = tagChips(blocks[i], i + 1);
        }
        function addTags(id, raw) {
          var i = blockIndex(id); if (i < 0) return;
          var next = D.uniqueTags(blocks[i].tags.concat(String(raw).split(',')));
          if (next.length !== blocks[i].tags.length) { blocks[i].tags = next; paintTagList(id); scheduleDraft(); }
          var input = q('[data-tag-input="' + id + '"]'); if (input) input.value = '';
        }
        function commitPendingTags() {
          if (!view.querySelectorAll) return;
          view.querySelectorAll('[data-tag-input]').forEach(function (inp) { if (inp.value.trim()) addTags(inp.dataset.tagInput, inp.value); });
        }

        function snapshot() { return { title: $('#e-title').value, favorite: $('#e-fav').checked, blocks: blocks.map(copyBlock) }; }
        function flushDraft() {
          clearTimeout(timer); timer = null;
          var ok = App.drafts.save(day, snapshot());
          $('#e-draft').textContent = ok ? 'Borrador guardado en este navegador a las ' + hhmm(new Date().toISOString()) : 'No se pudo guardar el borrador en este navegador.';
        }
        function scheduleDraft() { clearTimeout(timer); timer = setTimeout(flushDraft, 500); }

        paintBlocks();

        view.addEventListener('input', function (e) {
          var t = e.target;
          if (t.dataset && t.dataset.text) { var i = blockIndex(t.dataset.text); if (i >= 0) blocks[i].text = t.value; scheduleDraft(); }
          else if (t.id === 'e-title') scheduleDraft();
        });
        view.addEventListener('change', function (e) { if (e.target.id === 'e-fav') scheduleDraft(); });
        view.addEventListener('focusout', function (e) {
          var t = e.target;
          if (t.dataset && t.dataset.tagInput && t.value.trim()) addTags(t.dataset.tagInput, t.value);
          else if (timer) flushDraft();
        });
        view.addEventListener('keydown', function (e) {
          var t = e.target;
          if (t.dataset && t.dataset.tagInput) {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTags(t.dataset.tagInput, t.value); }
            else if (e.key === 'Backspace' && !t.value) {
              var i = blockIndex(t.dataset.tagInput);
              if (i >= 0 && blocks[i].tags.length) { blocks[i].tags.pop(); paintTagList(t.dataset.tagInput); scheduleDraft(); }
            }
          } else if (t.dataset && t.dataset.text && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); }
        });
        view.addEventListener('click', function (e) {
          var t = e.target;
          if (!t || !t.closest) return;
          var mood = t.closest('[data-block-mood]'), rm = t.closest('[data-remove-tag]'), up = t.closest('[data-up]'), down = t.closest('[data-down]'), del = t.closest('[data-del]');
          if (mood) {
            var i = blockIndex(mood.dataset.blockMood); if (i < 0) return;
            blocks[i].mood = blocks[i].mood === mood.dataset.mood ? null : mood.dataset.mood;   // volver a pulsar lo quita
            view.querySelectorAll('[data-block-mood="' + mood.dataset.blockMood + '"]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mood === blocks[i].mood)); });
            scheduleDraft(); return;
          }
          if (rm) {
            var j = blockIndex(rm.dataset.block);
            if (j >= 0) { blocks[j].tags.splice(Number(rm.dataset.removeTag), 1); paintTagList(rm.dataset.block); scheduleDraft(); }
            return;
          }
          if (up || down) {
            var id = (up || down).dataset.up || (up || down).dataset.down, k = blockIndex(id), to = up ? k - 1 : k + 1;
            if (k < 0 || to < 0 || to >= blocks.length) return;
            var tmp = blocks[k]; blocks[k] = blocks[to]; blocks[to] = tmp;
            paintBlocks(); scheduleDraft();
            focusSel((up ? '[data-up="' : '[data-down="') + id + '"]'); return;
          }
          if (del) {
            var d = blockIndex(del.dataset.del);
            if (d < 0) return;
            if (D.blockHasContent(blocks[d]) && !window.confirm('¿Quitar este bloque? Su texto, su ánimo y sus etiquetas se perderán.')) return;
            blocks.splice(d, 1);
            if (!blocks.length) blocks.push(newBlock());
            paintBlocks(); scheduleDraft(); return;
          }
          if (t.closest('#e-add')) {
            var nb = newBlock(); blocks.push(nb); paintBlocks(); scheduleDraft();
            focusSel('[data-text="' + nb.id + '"]');
          }
        });

        var discard = $('#e-discard');
        if (discard) discard.addEventListener('click', function () {
          if (!window.confirm('¿Descartar el borrador y volver a ' + (prev ? 'la versión guardada' : 'una hoja en blanco') + '?')) return;
          clearTimeout(timer); App.drafts.remove(day);
          App.diaryViews.editor.render(root, day, opts);
        });

        function save() {
          if (busy) return;
          commitPendingTags();
          var s = snapshot();
          var hasContent = s.title.trim() || s.blocks.some(D.blockHasContent);
          if (!hasContent) { say('Escribe algo, elige un ánimo o añade una etiqueta en algún bloque, o ponle un título al día.', 'error'); focusSel('[data-text]'); return; }
          flushDraft();
          var r = D.repo();
          if (!r) { say('Conecta tus datos para guardar. Mientras tanto, tu texto sigue guardado como borrador en este navegador.', 'error'); return; }
          busy = true; $('#e-save').disabled = true; say('Guardando…', 'info');
          r.save({ day: day, title: s.title.trim(), favorite: s.favorite, blocks: s.blocks }, { base: prev ? prev.updatedAt : null }).then(function () {
            App.drafts.remove(day);
            location.hash = '#/diario/' + day;
          }).catch(function (err) {
            var msg = err && err.message ? err.message : 'No se pudo guardar.';
            say(err && err.code === 'stale' ? msg : msg + ' Tu texto sigue como borrador.', 'error');
            busy = false; $('#e-save').disabled = false;
          });
        }
        $('#e-save').addEventListener('click', save);
      }

      if (!repo) { start(null); return; }
      root.innerHTML = page('Cargando…', longDate, '<div class="skeleton" style="margin: 14px 0"></div>');
      repo.get(day).then(start).catch(function (err) {
        root.innerHTML = page('No se pudo cargar', longDate, '<div class="msg" data-kind="error">' + esc(err.message || 'Inténtalo de nuevo.') + '</div>');
      });
    }
  };
})(window.App = window.App || {});
