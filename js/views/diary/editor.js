// Diario: editar la página de un día. Es la misma hoja que se lee, con controles: cada entrada tiene su texto,
// su estado de ánimo (uno de cinco), sus emociones (de tu biblioteca) y sus etiquetas, y se pueden reordenar.
// Se guarda como borrador mientras escribes. Las emociones nunca intervienen en el porcentaje de ánimo.
(function (App) {
  var D = App.diary, H = App.diaryHtml, P = App.percentUi, deco = App.sheetDeco, esc = App.escapeHtml, icon = App.icon;
  App.diaryViews = App.diaryViews || {};

  function hhmm(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function newBlock() { return { id: D.newBlockId(), text: '', tags: [], mood: null, emotions: [], people: [], activities: [], tasks: [], shadows: [] }; }
  function copyBlock(b) {
    return { id: b.id, text: b.text, tags: b.tags.slice(), mood: b.mood, emotions: (b.emotions || []).slice(), people: (b.people || []).slice(), activities: (b.activities || []).slice(),
      tasks: (b.tasks || []).map(function (r) { return { list: r.list, task: r.task, text: r.text }; }),
      shadows: (b.shadows || []).map(function (r) { return { id: r.id, name: r.name }; }) };
  }
  function shell(day, body) {
    return '<div class="view day-page"><article class="card paper sheet">' + H.sheetHead(day, '', '') + body + '</article></div>';
  }

  function tagChips(block, n) {
    return block.tags.map(function (t, i) {
      return '<li class="chip">#' + esc(t) + ' <button type="button" class="chip-x" data-remove-tag="' + i + '" data-block="' + esc(block.id) + '" aria-label="Quitar la etiqueta ' + esc(t) + ' de la entrada ' + n + '">×</button></li>';
    }).join('');
  }
  function emotionChips(block, n, byId) {
    return (block.emotions || []).map(function (id) {
      var e = byId[id];
      if (!e) return '';
      return H.emotionChip(e, ' <button type="button" class="chip-x" data-remove-emo="' + esc(id) + '" data-block="' + esc(block.id) + '" aria-label="Quitar la emoción ' + esc(e.name) + ' de la entrada ' + n + '">×</button>');
    }).join('');
  }
  // Actividades de una entrada (se registran en el personaje al guardar la página). `acts` es el mapa id → actividad.
  // Primero las sombras, luego las tareas de tus listas (cápsula clara con visto) y luego las actividades (cápsula oscura).
  function activityChips(block, n, acts) {
    return (block.shadows || []).map(function (r) {
      return H.shadowChip(r, ' <button type="button" class="chip-x" data-remove-shadow="' + esc(r.id) + '" data-block="' + esc(block.id) + '" aria-label="Quitar la sombra ' + esc(r.name) + ' de la entrada ' + n + '">×</button>');
    }).join('') + (block.tasks || []).map(function (r) {
      var k = r.list + ':' + r.task;
      return H.taskChip(r, ' <button type="button" class="chip-x" data-remove-task="' + esc(k) + '" data-block="' + esc(block.id) + '" aria-label="Quitar la tarea ' + esc(r.text) + ' de la entrada ' + n + '">×</button>');
    }).join('') + (block.activities || []).map(function (id) {
      return H.activityChip(acts[id], id, ' <button type="button" class="chip-x" data-remove-act="' + esc(id) + '" data-block="' + esc(block.id) + '" aria-label="Quitar la actividad ' + esc(acts[id] ? acts[id].name : id) + ' de la entrada ' + n + '">×</button>');
    }).join('');
  }

  App.diaryViews.editor = {
    // day = "AAAA-MM-DD";  opts.addBlock = abrir con una entrada nueva al final, lista para escribir
    render: function (root, day, opts) {
      opts = opts || {};
      var repo = D.repo(), emoRepo = D.emotions(), pplRepo = D.people();
      // Actividades: solo si el personaje está disponible (rpg cargado y datos conectados).
      var R = App.rpg, V = App.rpgViews;
      var actRepo = R && R.activities && V && V.activityPicker ? R.activities() : null;

      if (!D.isDay(day) || day > D.today()) {
        root.innerHTML = '<div class="view day-page"><article class="card paper sheet"><h1 id="page-title" class="date-h1" tabindex="-1">No se puede escribir ahí</h1>' +
          '<p class="soft">' + (D.isDay(day) ? 'Ese día todavía no ha llegado.' : 'Esa fecha no es válida.') + '</p><p class="btn-row"><a class="btn secondary" href="#/diario">Volver al diario</a></p></article></div>';
        return;
      }

      // library = emociones de la biblioteca; null si no se pudieron cargar. peopleList = fichas de personas (igual)
      function start(prev, library, peopleList, actList) {
        var actsById = {};
        function setActs(l) { actsById = {}; (l || []).forEach(function (a) { actsById[a.id] = a; }); }
        setActs(actList);
        var saved = prev ? { title: prev.title, favorite: prev.favorite, blocks: prev.blocks } : { title: '', favorite: false, blocks: [] };
        var draft = App.drafts.get(day);
        var useDraft = !!(draft && !App.drafts.isEmpty(draft));
        var begin = useDraft ? draft : saved;
        var blocks = begin.blocks.map(copyBlock);
        if (!blocks.length || (opts.addBlock && D.blockHasContent(blocks[blocks.length - 1]))) blocks.push(newBlock());
        var backHref = prev ? '#/diario/' + esc(day) : '#/diario';
        var emoLoaded = !!emoRepo && library !== null;
        library = library || [];
        var byId = D.emotionMap(library);

        root.innerHTML = '<div class="view day-page editor-view">' +
          '<div class="editbar"><a class="btn secondary" href="' + backHref + '">Volver</a>' +
            '<span id="e-draft" class="soft draft-status" role="status" aria-live="polite"></span></div>' +
          (repo ? '' : '<p class="msg" data-kind="info">Todavía no hay datos conectados. Puedes escribir: el texto se guarda como borrador en este navegador y podrás guardarlo en cuanto conectes. <a href="#/ajustes">Conectar mis datos</a></p>') +
          (useDraft ? '<p class="msg" id="e-restored" data-kind="info">Has recuperado un borrador de las ' + esc(hhmm(draft.updatedAt)) + '. <button type="button" class="btn secondary" id="e-discard">Descartar borrador</button></p>' : '') +
          '<article class="card paper sheet editor"' + deco.attr(D.dayMood({ blocks: begin.blocks || [] }).percent) + '>' + deco.markup(D.dayMood({ blocks: begin.blocks || [] }).percent) +
            '<header class="sheet-head"><div class="sheet-titles">' +
              '<h1 id="page-title" class="date-h1" tabindex="-1">' + esc(D.formatLong(day)) + '</h1>' +
              '<label class="field title-field"><span class="sr">Título de la página (opcional)</span>' +
                '<input id="e-title" class="title-input" type="text" maxlength="' + D.LIMITS.title + '" autocomplete="off" placeholder="Título de la página (opcional)" value="' + esc(begin.title) + '"></label>' +
            '</div><div class="pct-slot" id="pct-slot"></div></header>' +
            '<div id="e-blocks"></div>' +
            '<p class="btn-row"><button type="button" class="btn secondary" id="e-add">Añadir entrada</button></p>' +
            '<label class="checkline"><input id="e-fav" type="checkbox"' + (begin.favorite ? ' checked' : '') + '><span>Marcar la página como favorita</span></label>' +
          '</article>' +
          '<div class="btn-row"><button type="button" class="btn" id="e-save">Guardar</button><a class="btn secondary" href="' + backHref + '">Cancelar</a></div>' +
          '<p class="msg" id="e-msg" role="status" data-kind="info"></p><div id="e-confirm" aria-live="polite"></div>' +

          '<dialog class="confirm emo-dialog" id="emo-dialog" aria-labelledby="emo-title">' +
            '<h3 id="emo-title">Emociones de la entrada <span id="emo-n"></span></h3>' +
            '<p class="soft">Pulsa las que quieras para marcarlas (pulsa otra vez para quitarlas) y luego Aceptar. Son aparte del estado de ánimo: no cambian el porcentaje.</p>' +
            '<ul class="emo-caps" id="emo-list" aria-label="Emociones guardadas"></ul>' +
            '<div id="emo-form" hidden>' +
              '<h4 id="emo-form-title">Nueva emoción</h4>' +
              '<label class="field"><span>Nombre</span><input id="emo-name" type="text" maxlength="' + D.EMOTION_LIMITS.name + '" autocomplete="off" placeholder="Por ejemplo, Nostalgia"></label>' +
              '<fieldset class="symbols"><legend>Símbolo</legend><div class="symbol-grid" id="emo-symbols"></div></fieldset>' +
              '<div class="btn-row"><button type="button" class="btn" id="emo-save">Guardar emoción</button><button type="button" class="btn secondary" id="emo-cancel">Cancelar</button></div>' +
            '</div>' +
            '<p class="msg" id="emo-msg" role="status" data-kind="info"></p>' +
            '<div class="btn-row"><button type="button" class="btn secondary" id="emo-edit" disabled>Editar</button><button type="button" class="btn" id="emo-done">Aceptar</button></div>' +
          '</dialog>' +
          '<dialog class="confirm ppl-dialog" id="ppl-dialog" aria-labelledby="ppl-title">' +
            '<h3 id="ppl-title">Personas de la entrada <span id="ppl-n"></span></h3>' +
            '<p class="soft">Elige a quién se refiere esta entrada. Quitar a alguien no borra el texto.</p>' +
            '<label class="searchbox"><span class="sr">Buscar entre tus fichas</span><input id="ppl-q" type="search" placeholder="Buscar por nombre, apodo o relación" autocomplete="off" spellcheck="false"></label>' +
            '<ul class="ppl-list" id="ppl-list"></ul>' +
            '<div id="ppl-form" hidden>' +
              '<h4>Nueva ficha</h4>' +
              '<label class="field"><span>Nombre</span><input id="ppl-name" type="text" maxlength="' + D.PEOPLE_LIMITS.name + '" autocomplete="off"></label>' +
              '<label class="field"><span>Relación <small>(opcional)</small></span><input id="ppl-rel" type="text" maxlength="' + D.PEOPLE_LIMITS.relation + '" autocomplete="off" placeholder="Por ejemplo, amiga"></label>' +
              '<p class="soft" id="ppl-hint" role="status"></p>' +
              '<div class="btn-row"><button type="button" class="btn" id="ppl-save">Crear y vincular</button><button type="button" class="btn secondary" id="ppl-cancel">Cancelar</button></div>' +
              '<p class="soft">Los demás datos (apodos, fecha, notas…) los puedes añadir luego en su ficha.</p>' +
            '</div>' +
            '<p class="msg" id="ppl-msg" role="status" data-kind="info"></p>' +
            '<div class="btn-row"><button type="button" class="btn secondary" id="ppl-new">Crear una ficha nueva</button><button type="button" class="btn" id="ppl-done">Hecho</button></div>' +
          '</dialog>' +
          (actRepo ? '<dialog class="confirm rpg-dialog act-dialog" id="act-dialog"></dialog>' : '') +
          '</div>';

        var view = root.querySelector('.editor-view');
        function $(sel) { return root.querySelector(sel); }
        function q(sel) { return view && view.querySelector ? view.querySelector(sel) : null; }
        function focusSel(sel) { var el = q(sel); if (el && el.focus) el.focus(); }
        function blockIndex(id) { for (var i = 0; i < blocks.length; i++) if (blocks[i].id === id) return i; return -1; }
        function say(text, kind) { var m = $('#e-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
        var busy = false, timer = null, picker = null;

        // El porcentaje sale SOLO de los estados de ánimo de las entradas.
        function refreshPercent() { var m = D.dayMood({ blocks: blocks }); P.paint($('#pct-slot'), m, day, { fromZero: false }); deco.update(q('.sheet'), m.percent); }

        // Las cajas de texto crecen solas con lo que escribes: sin barra de desplazamiento interna
        function grow(el) { if (el && el.style) { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 3) + 'px'; } }
        function growAll() { if (view.querySelectorAll) view.querySelectorAll('[data-text]').forEach(grow); }
        function paintBlocks() {
          $('#e-blocks').innerHTML = blocks.map(function (b, i) {
            var n = i + 1, id = esc(b.id);
            return '<section class="block" data-block-id="' + id + '" aria-label="Entrada ' + n + '">' +
              '<div class="block-head"><h2 class="block-title">Entrada ' + n + '</h2><div class="block-tools">' +
                '<button type="button" class="mini" data-up="' + id + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir la entrada ' + n + '">Subir</button>' +
                '<button type="button" class="mini" data-down="' + id + '"' + (i === blocks.length - 1 ? ' disabled' : '') + ' aria-label="Bajar la entrada ' + n + '">Bajar</button>' +
                '<button type="button" class="mini" data-del="' + id + '" aria-label="Quitar la entrada ' + n + '">Quitar</button>' +
              '</div></div>' +
              '<label class="field"><span class="sr">Texto de la entrada ' + n + '</span>' +
                '<textarea data-text="' + id + '" rows="5" placeholder="Qué ha pasado, cómo ha ido…">' + esc(b.text) + '</textarea></label>' +
              '<div class="mood-pick" role="radiogroup" aria-label="Estado de ánimo de la entrada ' + n + '">' +
                D.MOODS.map(function (m) {
                  return '<button type="button" role="radio" class="mood-btn small" data-block-mood="' + id + '" data-mood="' + m.id + '" aria-checked="' + (b.mood === m.id) + '">' +
                    H.face(m.id) + '<span>' + esc(m.label) + '</span></button>';
                }).join('') + '</div>' +
              '<div class="emo-row"><ul class="chips emo-selected" data-emolist="' + id + '" aria-label="Emociones de la entrada ' + n + '" aria-live="polite">' + emotionChips(b, n, byId) + '</ul>' +
                '<button type="button" class="mini" data-emo-open="' + id + '" aria-haspopup="dialog">Emociones</button></div>' +
              '<div class="ppl-row"><ul class="chips ppl-selected" data-pplist="' + id + '" aria-label="Personas de la entrada ' + n + '" aria-live="polite"></ul>' +
                '<button type="button" class="mini" data-ppl-open="' + id + '" aria-haspopup="dialog">Personas</button></div>' +
              (actRepo ? '<div class="act-row"><ul class="chips act-selected" data-actlist="' + id + '" aria-label="Actividades de la entrada ' + n + '" aria-live="polite">' + activityChips(b, n, actsById) + '</ul>' +
                '<button type="button" class="mini act-open" data-act-open="' + id + '" aria-haspopup="dialog">Actividades</button></div>' : '') +
              '<div class="suggest" data-suggest="' + id + '" aria-live="polite"></div>' +
              '<div class="tags-input"><ul class="chips" data-taglist="' + id + '" aria-live="polite">' + tagChips(b, n) + '</ul>' +
                '<input type="text" data-tag-input="' + id + '" autocomplete="off" aria-label="Añadir etiqueta a la entrada ' + n + '" placeholder="Etiqueta y pulsa Intro"></div>' +
              '</section>';
          }).join('');
          if (picker) picker.refreshAll();
          growAll();
        }
        function paintTagList(id) {
          var i = blockIndex(id), list = q('[data-taglist="' + id + '"]');
          if (list && i >= 0) list.innerHTML = tagChips(blocks[i], i + 1);
        }
        function paintEmotionChips(id) {
          var i = blockIndex(id), list = q('[data-emolist="' + id + '"]');
          if (list && i >= 0) list.innerHTML = emotionChips(blocks[i], i + 1, byId);
        }
        function paintAllEmotionChips() { blocks.forEach(function (b) { paintEmotionChips(b.id); }); }
        function paintActivityChips(id) {
          var i = blockIndex(id), list = q('[data-actlist="' + id + '"]');
          if (list && i >= 0) list.innerHTML = activityChips(blocks[i], i + 1, actsById);
        }

        // ---- Actividades: la misma ventana que en Personaje. Se registran al guardar la página, no antes. ----
        var actBlock = null;
        var actPicker = actRepo ? V.activityPicker($('#act-dialog'), {
          acts: actRepo, rpg: R.repo(), todos: R.todos ? R.todos() : null, shadows: R.shadows ? R.shadows() : null,
          acceptLabel: function () { return 'Aceptar'; },
          onAccept: function (ids, tasks, shadows) {
            var i = blockIndex(actBlock); if (i < 0) return;
            blocks[i].activities = D.uniqueActivityIds(ids);
            blocks[i].tasks = D.cleanTaskRefs(tasks);   // se marcan en su lista al guardar la página
            blocks[i].shadows = D.cleanShadowRefs(shadows);   // se apuntan para este día al guardar la página
            // La lista puede tener actividades nuevas creadas en la ventana.
            return actRepo.list().then(setActs, function () {}).then(function () { paintActivityChips(actBlock); scheduleDraft(); });
          }
        }) : null;
        function openActs(id) {
          var i = blockIndex(id); if (i < 0 || !actPicker) return;
          actBlock = id;
          actPicker.open({ title: 'Actividades de la entrada ' + (i + 1), selected: blocks[i].activities, tasks: blocks[i].tasks, shadows: blocks[i].shadows });
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

        // ---- Emociones: elegir varias, crear y editar desde aquí ----
        var activeId = null, editingEmotion = null, formSymbol = null, staged = [];
        function emoSay(text, kind) { var m = $('#emo-msg'); m.textContent = text; m.setAttribute('data-kind', kind || 'info'); }
        function activeBlock() { var i = blockIndex(activeId); return i >= 0 ? blocks[i] : null; }

        function paintEmoList() {
          var chosen = staged;
          if (!emoRepo) { $('#emo-list').innerHTML = '<li class="soft">Conecta tus datos para usar emociones. <a href="#/ajustes">Conectar mis datos</a></li>'; return; }
          if (!emoLoaded) { $('#emo-list').innerHTML = '<li class="soft">No se pudieron cargar tus emociones ahora mismo.</li>'; return; }
          $('#emo-list').innerHTML = (library.length ? '' : '<li class="soft">Todavía no tienes emociones. Pulsa + para crear la primera.</li>') + library.map(function (e) {
            return '<li><button type="button" class="emo-cap" data-emo-check="' + esc(e.id) + '" aria-pressed="' + (chosen.indexOf(e.id) >= 0) + '">' +
              icon(D.isSymbol(e.symbol) ? e.symbol : 'heart') + '<span>' + esc(e.name) + '</span></button></li>';
          }).join('') + '<li><button type="button" class="plus-btn" id="emo-new" aria-label="Añadir emoción nueva" title="Añadir emoción nueva"><span aria-hidden="true">+</span></button></li>';
          $('#emo-edit').disabled = !(emoLoaded && n0(chosen) && byId[chosen[chosen.length - 1]]);   // edita la última marcada
        }
        function n0(a) { return a.length > 0; }
        function paintSymbols() {
          $('#emo-symbols').innerHTML = D.EMOTION_SYMBOLS.map(function (s) {
            return '<label class="symbol"><input type="radio" name="emo-symbol" value="' + s.id + '"' + (formSymbol === s.id ? ' checked' : '') + '>' +
              '<span class="symbol-box">' + icon(s.id) + '</span><span class="sr">' + esc(s.label) + '</span></label>';
          }).join('');
        }
        function openForm(emotion) {
          editingEmotion = emotion ? emotion.id : null; formSymbol = emotion ? emotion.symbol : null;
          $('#emo-form-title').textContent = emotion ? 'Editar emoción' : 'Nueva emoción';
          $('#emo-name').value = emotion ? emotion.name : '';
          paintSymbols(); emoSay('', 'info');
          $('#emo-form').hidden = false;
          if ($('#emo-name').focus) $('#emo-name').focus();
        }
        function closeForm() { $('#emo-form').hidden = true; editingEmotion = null; formSymbol = null; }
        function openEmo(id) {
          activeId = id; closeForm(); emoSay('', 'info');
          var cur = activeBlock(); staged = cur ? cur.emotions.slice() : [];
          $('#emo-n').textContent = String(blockIndex(id) + 1);
          paintEmoList();
          $('#emo-dialog').showModal();
        }
        function stageEmotion(emoId, on) {
          var i = staged.indexOf(emoId);
          if (on && i < 0) staged.push(emoId); else if (!on && i >= 0) staged.splice(i, 1);
          paintEmoList();
        }
        function acceptEmotions() {                                  // aplica la selección a la entrada
          var b = activeBlock();
          if (b) { b.emotions = D.uniqueEmotionIds(staged.filter(function (x) { return byId[x]; })); paintEmotionChips(b.id); scheduleDraft(); }
          $('#emo-dialog').close();                                  // las emociones no tocan el porcentaje
        }
        function saveEmotion() {
          if (!emoRepo) return;
          var wasEditing = editingEmotion, input = { name: $('#emo-name').value, symbol: formSymbol };
          emoSay('Guardando…', 'info');
          var job = wasEditing ? emoRepo.update(wasEditing, input) : emoRepo.create(input);
          job.then(function (emotion) {
            return emoRepo.list().then(function (list) {
              library = list; byId = D.emotionMap(list);
              if (!wasEditing && staged.indexOf(emotion.id) < 0) staged.push(emotion.id);   // queda marcada; se aplica al Aceptar
              paintAllEmotionChips(); paintEmoList(); closeForm();
              emoSay(wasEditing ? 'Emoción actualizada.' : 'Emoción creada y marcada. Pulsa Aceptar para añadirla.', 'ok');
            });
          }).catch(function (err) { emoSay(err && err.message ? err.message : 'No se pudo guardar la emoción.', 'error'); });
        }

        // ---- Borrador ----
        function snapshot() { return { title: $('#e-title').value, favorite: $('#e-fav').checked, blocks: blocks.map(copyBlock) }; }
        function flushDraft() {
          clearTimeout(timer); timer = null;
          var ok = App.drafts.save(day, snapshot());
          $('#e-draft').textContent = ok ? 'Borrador guardado en este navegador a las ' + hhmm(new Date().toISOString()) : 'No se pudo guardar el borrador en este navegador.';
        }
        function scheduleDraft() { clearTimeout(timer); timer = setTimeout(flushDraft, 500); }

        picker = App.peoplePicker.attach({ view: view, $: $, repo: pplRepo, library: peopleList, getBlocks: function () { return blocks; }, onChange: scheduleDraft });
        paintBlocks();
        refreshPercent();
        if (typeof window.addEventListener === 'function') {      // al cambiar el ancho, el texto se recoloca: reajustar alturas
          var onResize = function () { if (view.isConnected === false) window.removeEventListener('resize', onResize); else growAll(); };
          window.addEventListener('resize', onResize);
          if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(growAll);
        }
        if (opts.addBlock) focusSel('[data-text="' + blocks[blocks.length - 1].id + '"]');

        view.addEventListener('input', function (e) {
          var t = e.target;
          if (t.dataset && t.dataset.text) { var i = blockIndex(t.dataset.text); if (i >= 0) blocks[i].text = t.value; grow(t); scheduleDraft(); }
          else if (t.id === 'e-title') scheduleDraft();
        });
        view.addEventListener('change', function (e) {
          var t = e.target;
          if (t.id === 'e-fav') scheduleDraft();
          else if (t.name === 'emo-symbol') formSymbol = t.value;
        });
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
          } else if (t.id === 'emo-name' && e.key === 'Enter') { e.preventDefault(); saveEmotion(); }
          else if (t.dataset && t.dataset.text && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); }
        });
        view.addEventListener('click', function (e) {
          var t = e.target;
          if (!t || !t.closest) return;
          var mood = t.closest('[data-block-mood]'), rm = t.closest('[data-remove-tag]'), rmEmo = t.closest('[data-remove-emo]');
          var up = t.closest('[data-up]'), down = t.closest('[data-down]'), del = t.closest('[data-del]');
          var open = t.closest('[data-emo-open]');
          if (mood) {
            var i = blockIndex(mood.dataset.blockMood); if (i < 0) return;
            blocks[i].mood = blocks[i].mood === mood.dataset.mood ? null : mood.dataset.mood;   // volver a pulsar lo quita
            view.querySelectorAll('[data-block-mood="' + mood.dataset.blockMood + '"]').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.mood === blocks[i].mood)); });
            refreshPercent(); scheduleDraft(); return;
          }
          if (rm) {
            var j = blockIndex(rm.dataset.block);
            if (j >= 0) { blocks[j].tags.splice(Number(rm.dataset.removeTag), 1); paintTagList(rm.dataset.block); scheduleDraft(); }
            return;
          }
          if (rmEmo) {
            var k2 = blockIndex(rmEmo.dataset.block);
            if (k2 >= 0) { blocks[k2].emotions = blocks[k2].emotions.filter(function (x) { return x !== rmEmo.dataset.removeEmo; }); paintEmotionChips(rmEmo.dataset.block); scheduleDraft(); }
            return;
          }
          if (open) { openEmo(open.dataset.emoOpen); return; }
          var actOpen = t.closest('[data-act-open]'), rmAct = t.closest('[data-remove-act]'), rmTask = t.closest('[data-remove-task]'), rmShadow = t.closest('[data-remove-shadow]');
          if (actOpen) { openActs(actOpen.dataset.actOpen); return; }
          if (rmShadow) {   // al guardar, la aparición de ese día se borra (no hay XP en juego)
            var k5 = blockIndex(rmShadow.dataset.block);
            if (k5 >= 0) { blocks[k5].shadows = blocks[k5].shadows.filter(function (r) { return r.id !== rmShadow.dataset.removeShadow; }); paintActivityChips(rmShadow.dataset.block); scheduleDraft(); }
            return;
          }
          if (rmTask) {   // quitarla de la entrada no la desmarca en su lista
            var k4 = blockIndex(rmTask.dataset.block);
            if (k4 >= 0) { blocks[k4].tasks = blocks[k4].tasks.filter(function (r) { return r.list + ':' + r.task !== rmTask.dataset.removeTask; }); paintActivityChips(rmTask.dataset.block); scheduleDraft(); }
            return;
          }
          if (rmAct) {
            var k3 = blockIndex(rmAct.dataset.block);
            if (k3 >= 0) { blocks[k3].activities = blocks[k3].activities.filter(function (x) { return x !== rmAct.dataset.removeAct; }); paintActivityChips(rmAct.dataset.block); scheduleDraft(); }
            return;
          }
          var cap = t.closest('[data-emo-check]');
          if (cap) { stageEmotion(cap.dataset.emoCheck, staged.indexOf(cap.dataset.emoCheck) < 0); return; }
          if (t.closest('#emo-edit')) { var em = staged.length ? byId[staged[staged.length - 1]] : null; if (em) openForm(em); return; }
          if (t.closest('#emo-new')) { openForm(null); return; }
          if (t.closest('#emo-cancel')) { closeForm(); emoSay('', 'info'); return; }
          if (t.closest('#emo-save')) { saveEmotion(); return; }
          if (t.closest('#emo-done')) { acceptEmotions(); return; }
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
            if (D.blockHasContent(blocks[d]) && !window.confirm('¿Quitar esta entrada? Su texto, su estado, sus emociones, sus personas, sus actividades y sus etiquetas se perderán. Si sus actividades o tareas ya te dieron XP, al guardar te diré cuánta se quita antes de hacerlo.')) return;
            blocks.splice(d, 1);
            if (!blocks.length) blocks.push(newBlock());
            paintBlocks(); refreshPercent(); scheduleDraft(); return;
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

        // Si al guardar falta algo que ya dio XP (una actividad o una tarea quitada de su entrada), antes se avisa
        // de qué se quitará del personaje; «Guardar y quitar» sigue, «Volver a editar» no guarda nada.
        function confirmRemovals(items, go) {
          var xp = items.reduce(function (t, it) { return t + it.xp; }, 0);
          $('#e-confirm').innerHTML = '<div class="msg e-remove" data-kind="info"><b>Al guardar se quitará de tu personaje:</b><ul>' + items.map(function (it) {
            return '<li>' + esc(it.label) + ' (entrada ' + it.n + ') · ' + it.xp + ' XP' + (it.kind === 'task' ? ', y vuelve a estar pendiente en su lista' : '') + '</li>';
          }).join('') + '</ul><div class="btn-row"><button type="button" class="btn" id="e-rm-yes">Guardar y quitar ' + xp + ' XP</button>' +
            '<button type="button" class="btn secondary" id="e-rm-no">Volver a editar</button></div></div>';
          $('#e-rm-yes').addEventListener('click', function () { $('#e-confirm').innerHTML = ''; go(); });
          $('#e-rm-no').addEventListener('click', function () { $('#e-confirm').innerHTML = ''; say('', 'info'); });
          var y = $('#e-rm-yes'); if (y && y.focus) y.focus();
        }
        function save() {
          if (busy) return;
          commitPendingTags();
          var s = snapshot();
          var hasContent = s.title.trim() || s.blocks.some(D.blockHasContent);
          if (!hasContent) { say('Escribe algo, elige un estado, una emoción, una persona o una actividad, o añade una etiqueta en alguna entrada, o ponle un título a la página.', 'error'); focusSel('[data-text]'); return; }
          flushDraft();
          var r = D.repo();
          if (!r) { say('Conecta tus datos para guardar. Mientras tanto, tu texto sigue guardado como borrador en este navegador.', 'error'); return; }
          $('#e-confirm').innerHTML = '';
          var check = actRepo && R.diaryRemovals && prev ? R.diaryRemovals(prev.blocks, s.blocks).catch(function () { return []; }) : Promise.resolve([]);
          busy = true; $('#e-save').disabled = true;
          check.then(function (items) {
            busy = false; $('#e-save').disabled = false;
            if (items.length) confirmRemovals(items, function () { doSave(r, s, items); });
            else doSave(r, s, []);
          });
        }
        function doSave(r, s, removals) {
          if (busy) return;
          busy = true; $('#e-save').disabled = true; say('Guardando…', 'info');
          r.save({ day: day, title: s.title.trim(), favorite: s.favorite, blocks: s.blocks }, { base: prev ? prev.updatedAt : null }).then(function (saved) {
            App.drafts.remove(day);
            location.hash = '#/diario/' + day;
            // Sombras: las de las entradas quedan apuntadas para este día; las quitadas, borradas. No tocan la XP.
            var shRepo = R && R.shadows ? R.shadows() : null;
            if (shRepo) shRepo.syncDiary(day, prev ? prev.blocks : [], (saved && saved.blocks) || s.blocks).then(function (sh) {
              if (V && V.toast && sh.added.length) V.toast.show({ kind: 'shadow', title: 'Sombras de hoy', text: 'Apuntada: ' + sh.added.join(', ') + '. Nunca quita XP.' });
            }).catch(function (e) {
              if (V && V.toast) V.toast.show({ kind: 'shadow', title: 'No se pudieron apuntar las sombras', text: ((e && e.message) || '') + ' Vuelve a guardar la página para intentarlo otra vez.' });
            });
            // Con la página ya guardada: primero se quita lo que ya no está (confirmado), luego lo nuevo pasa al personaje.
            if (actRepo && R.recordDiaryActivities) {
              (removals.length ? R.applyDiaryRemovals(removals) : Promise.resolve({ removed: [], failed: [] })).then(function (rm) {
                if (V.toast && rm.removed.length) V.toast.show({ kind: 'char', title: 'Tu personaje se ha actualizado', text: '−' + rm.removed.reduce(function (t, it) { return t + it.xp; }, 0) + ' XP · ' + rm.removed.map(function (it) { return it.label; }).join(', ') });
                if (V.toast && rm.failed.length) V.toast.show({ kind: 'char', title: 'No se pudo quitar todo', text: rm.failed[0] });
                return R.recordDiaryActivities(day, (saved && saved.blocks) || s.blocks);
              }).then(function (res) {
                if (!res || !V.toast) return;
                V.toast.diary(res);
                if (res.failed.length) V.toast.show({ kind: 'char', title: 'No se pudieron registrar algunas actividades', text: res.failed[0] + ' Vuelve a guardar la página para intentarlo otra vez.' });
              }).catch(function (e) {
                if (V.toast) V.toast.show({ kind: 'char', title: 'Tu personaje no se ha actualizado', text: ((e && e.message) || '') + ' La página sí está guardada: vuelve a guardarla para intentarlo otra vez.' });
              });
            }
          }).catch(function (err) {
            var msg = err && err.message ? err.message : 'No se pudo guardar.';
            say(err && err.code === 'stale' ? msg : msg + ' Tu texto sigue como borrador.', 'error');
            busy = false; $('#e-save').disabled = false;
          });
        }
        $('#e-save').addEventListener('click', save);
      }

      if (!repo) { start(null, [], []); return; }
      root.innerHTML = shell(day, '<div class="skeleton" style="margin: 14px 0"></div>');
      // Las emociones son un extra: si no se pueden cargar, se puede escribir igual (sin elegirlas).
      var emotions = emoRepo ? emoRepo.list().catch(function () { return null; }) : Promise.resolve(null);
      var peopleP = pplRepo ? pplRepo.list().catch(function () { return null; }) : Promise.resolve(null);
      var actsP = actRepo ? actRepo.list().catch(function () { return []; }) : Promise.resolve([]);
      Promise.all([repo.get(day), emotions, peopleP, actsP]).then(function (r) { start(r[0], r[1], r[2], r[3]); }).catch(function (err) {
        root.innerHTML = shell(day, '<div class="msg" data-kind="error">No se pudo cargar. ' + esc(err.message || 'Inténtalo de nuevo.') + '</div>');
      });
    }
  };
})(window.App = window.App || {});
