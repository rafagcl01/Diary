// Lógica pura del diario (sin pantalla ni red): validar entradas, párrafos con identificador estable,
// búsqueda y calendario. Todo lo que se guarda pasa por aquí.
//
// Forma de una entrada (se guarda dentro de entries/AAAA-MM.json):
//   { id: "e_…", date: "2026-10-13T21:30" (hora local, sin zona), title, blocks: [{ id: "b_…", text }],
//     tags: [], favorite: false, moodId: null, createdAt, updatedAt }
// Los campos desconocidos se conservan al editar, para no perder datos de versiones futuras.
(function (App) {
  var D = (App.diary = App.diary || {});

  var LIMITS = { title: 200, paragraph: 20000, paragraphs: 500, tags: 20, tag: 40 };
  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
  var ENTRY_ID_RE = /^e_[0-9a-f]{12}$/;
  var BLOCK_ID_RE = /^b_[0-9a-f]{8}$/;
  function skipKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }

  D.LIMITS = LIMITS;
  D.isEntryId = function (s) { return typeof s === 'string' && ENTRY_ID_RE.test(s); };

  function hex(bytes) {
    var a = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  D.newId = function (prefix) { return prefix + hex(prefix === 'e_' ? 6 : 4); };

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // ---- Fechas (hora local escrita como texto: "2026-10-13T21:30") ----
  D.parseLocal = function (str) {
    var m = DATE_RE.exec(String(str));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], h = +m[4], mi = +m[5];
    var date = new Date(y, mo - 1, d, h, mi);
    var ok = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date.getHours() === h && date.getMinutes() === mi;
    return ok ? date : null;
  };
  D.toLocalString = function (date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  };
  D.nowLocal = function () { return D.toLocalString(new Date()); };
  D.monthKey = function (dateStr) { return String(dateStr).slice(0, 7); };
  D.dayKey = function (dateStr) { return String(dateStr).slice(0, 10); };
  D.formatLong = function (dateStr) {
    var d = D.parseLocal(dateStr);
    return d ? d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  };
  D.formatTime = function (dateStr) { return String(dateStr).slice(11, 16); };
  D.formatMonth = function (key) {
    var d = D.parseLocal(key + '-01T00:00');
    return d ? d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : key;
  };

  // ---- Texto y párrafos ----
  D.splitParagraphs = function (text) {
    return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)
      .map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });
  };
  D.blocksToText = function (blocks) {
    return (blocks || []).map(function (b) { return b.text; }).join('\n\n');
  };

  function tokens(s) { return String(s).toLowerCase().split(/\s+/).filter(Boolean); }
  function jaccard(a, b) {
    var A = tokens(a), B = tokens(b), setB = {}, inter = 0, union;
    B.forEach(function (w) { setB[w] = true; });
    var seen = {};
    A.forEach(function (w) { if (!seen[w]) { seen[w] = true; if (setB[w]) inter++; } });
    union = Object.keys(seen).length + Object.keys(setB).length - inter;
    return union === 0 ? 0 : inter / union;
  }

  // Convierte el texto escrito en bloques conservando el identificador de cada párrafo que "sigue siendo el mismo":
  // primero por texto idéntico, luego por parecido, y si solo queda uno suelto en cada lado, se emparejan.
  // (La fase 4 sustituye esto por un editor de bloques donde los identificadores son explícitos.)
  D.reconcileBlocks = function (oldBlocks, text) {
    var old = oldBlocks || [], paras = D.splitParagraphs(text);
    var used = old.map(function () { return false; }), result = paras.map(function () { return null; });

    paras.forEach(function (p, i) {
      for (var k = 0; k < old.length; k++) {
        if (!used[k] && old[k].text === p) { used[k] = true; result[i] = Object.assign({}, old[k]); return; }
      }
    });

    var cands = [];
    paras.forEach(function (p, i) {
      if (result[i] || tokens(p).length < 3) return;
      old.forEach(function (b, k) {
        if (used[k] || tokens(b.text).length < 3) return;
        var s = jaccard(p, b.text);
        if (s >= 0.5) cands.push({ i: i, k: k, s: s });
      });
    });
    cands.sort(function (a, b) { return (b.s - a.s) || (Math.abs(a.i - a.k) - Math.abs(b.i - b.k)); });
    cands.forEach(function (c) {
      if (!result[c.i] && !used[c.k]) { used[c.k] = true; result[c.i] = Object.assign({}, old[c.k], { text: paras[c.i] }); }
    });

    var freeNew = [], freeOld = [];
    result.forEach(function (r, i) { if (!r) freeNew.push(i); });
    used.forEach(function (u, k) { if (!u) freeOld.push(k); });
    if (freeNew.length === 1 && freeOld.length === 1) {
      result[freeNew[0]] = Object.assign({}, old[freeOld[0]], { text: paras[freeNew[0]] });
    }

    return paras.map(function (p, i) { return result[i] || { id: D.newId('b_'), text: p }; });
  };

  // ---- Etiquetas ----
  D.normalizeTag = function (tag) {
    return String(tag == null ? '' : tag).replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.tag);
  };
  function fold(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  D.fold = fold;
  function uniqueTags(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (t) {
      var n = D.normalizeTag(t), k = fold(n);
      if (n && !seen[k]) { seen[k] = true; out.push(n); }
    });
    return out.slice(0, LIMITS.tags);
  }
  D.uniqueTags = uniqueTags;

  // ---- Validación ----
  function invalid(msg) { return App.storageError('invalid', msg); }

  // Devuelve la entrada limpia o lanza un error con un mensaje claro. Conserva campos desconocidos.
  D.sanitizeEntry = function (input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('La entrada no es válida.');
    var out = {};
    Object.keys(input).forEach(function (k) { if (!skipKey(k)) out[k] = input[k]; });

    if (out.id === undefined || out.id === null) out.id = D.newId('e_');
    if (!ENTRY_ID_RE.test(out.id)) throw invalid('El identificador de la entrada no es válido.');
    if (!D.parseLocal(out.date)) throw invalid('La fecha y la hora no son válidas.');

    out.title = typeof out.title === 'string' ? out.title.trim() : '';
    if (out.title.length > LIMITS.title) throw invalid('El título es demasiado largo (máximo ' + LIMITS.title + ' caracteres).');

    var blocks = Array.isArray(out.blocks) ? out.blocks : [];
    if (blocks.length > LIMITS.paragraphs) throw invalid('La entrada tiene demasiados párrafos.');
    var seenIds = {};
    out.blocks = blocks.map(function (b) {
      if (!b || typeof b.text !== 'string') throw invalid('Hay un párrafo con un formato inesperado.');
      var text = b.text.trim();
      if (text.length > LIMITS.paragraph) throw invalid('Un párrafo es demasiado largo (máximo ' + LIMITS.paragraph + ' caracteres).');
      var id = typeof b.id === 'string' && BLOCK_ID_RE.test(b.id) && !seenIds[b.id] ? b.id : D.newId('b_');
      seenIds[id] = true;
      return Object.assign({}, b, { id: id, text: text });
    }).filter(function (b) { return b.text.length > 0; });

    out.tags = uniqueTags(out.tags);
    out.favorite = out.favorite === true;
    out.moodId = typeof out.moodId === 'string' ? out.moodId : null;

    var now = new Date().toISOString();
    out.createdAt = typeof out.createdAt === 'string' && !isNaN(Date.parse(out.createdAt)) ? out.createdAt : now;
    out.updatedAt = typeof out.updatedAt === 'string' && !isNaN(Date.parse(out.updatedAt)) ? out.updatedAt : now;

    if (!out.title && out.blocks.length === 0) throw invalid('Escribe al menos una línea o un título.');
    return out;
  };

  // Para entradas que vienen del repositorio: devuelve null si no se pueden leer (no se borran del archivo).
  D.normalizeLoaded = function (raw) {
    try { return D.sanitizeEntry(raw); } catch (e) { return null; }
  };

  // ---- Presentación de texto ----
  D.excerpt = function (entry, max) {
    var first = entry.blocks && entry.blocks[0] ? entry.blocks[0].text : '';
    var flat = first.replace(/\s+/g, ' ').trim();
    max = max || 140;
    return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
  };
  D.displayTitle = function (entry) { return entry.title || D.excerpt(entry, 60) || 'Sin título'; };

  // ---- Búsqueda ----
  // q: { text, tags: [], favoritesOnly, day: 'AAAA-MM-DD', from, to }   (todo opcional)
  D.search = function (entries, q) {
    q = q || {};
    var terms = fold(q.text || '').split(/\s+/).filter(Boolean);
    var wantTags = (q.tags || []).map(fold);
    return entries.filter(function (e) {
      var day = D.dayKey(e.date);
      if (q.day && day !== q.day) return false;
      if (q.from && day < q.from) return false;
      if (q.to && day > q.to) return false;
      if (q.favoritesOnly && !e.favorite) return false;
      if (wantTags.length) {
        var mine = (e.tags || []).map(fold);
        if (!wantTags.every(function (t) { return mine.indexOf(t) >= 0; })) return false;
      }
      if (terms.length) {
        var hay = fold(e.title + ' ' + e.blocks.map(function (b) { return b.text; }).join(' ') + ' ' + (e.tags || []).join(' '));
        if (!terms.every(function (t) { return hay.indexOf(t) >= 0; })) return false;
      }
      return true;
    }).sort(D.byDateDesc);
  };
  D.byDateDesc = function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
  };
  D.allTags = function (entries) {
    var counts = {}, names = {};
    entries.forEach(function (e) {
      (e.tags || []).forEach(function (t) { var k = fold(t); counts[k] = (counts[k] || 0) + 1; names[k] = names[k] || t; });
    });
    return Object.keys(counts).map(function (k) { return { tag: names[k], count: counts[k] }; })
      .sort(function (a, b) { return (b.count - a.count) || (a.tag < b.tag ? -1 : 1); });
  };
  D.groupByMonth = function (entries) {
    var groups = [], last = null;
    entries.forEach(function (e) {
      var key = D.monthKey(e.date);
      if (!last || last.key !== key) { last = { key: key, entries: [] }; groups.push(last); }
      last.entries.push(e);
    });
    return groups;
  };

  // ---- Calendario (semanas desde el lunes) ----
  D.monthGrid = function (year, monthIndex, entries) {
    var first = new Date(Date.UTC(year, monthIndex, 1));
    var offset = (first.getUTCDay() + 6) % 7;                       // lunes = 0
    var days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    var counts = {};
    entries.forEach(function (e) { var k = D.dayKey(e.date); counts[k] = (counts[k] || 0) + 1; });
    var cells = [], i;
    for (i = 0; i < offset; i++) cells.push(null);
    for (i = 1; i <= days; i++) {
      var key = year + '-' + pad(monthIndex + 1) + '-' + pad(i);
      cells.push({ day: i, key: key, count: counts[key] || 0 });
    }
    while (cells.length % 7) cells.push(null);
    var weeks = [];
    for (i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { year: year, month: monthIndex, weeks: weeks };
  };
})(window.App = window.App || {});
