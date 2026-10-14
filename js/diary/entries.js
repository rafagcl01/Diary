// Lógica pura del diario (sin pantalla ni red): validar entradas y bloques, búsqueda y calendario.
//
// Modelo: UNA página por día (en el código, `entry`). Cada página tiene varias entradas (en el código,
// `blocks`) y cada entrada lleva sus propias etiquetas y su estado de ánimo (opcional). Se guarda en entries/AAAA-MM.json:
//   { day: "2026-10-13", title, favorite, createdAt, updatedAt,
//     blocks: [{ id: "b_…", text, tags: [], mood: "bien" | null, emotions: ["em_…"] }] }
// `mood` es uno de cinco niveles (muy-bien … muy-mal) y es lo único que cuenta para el porcentaje de ánimo.
// `emotions` son identificadores de la biblioteca de emociones (emotions.json): son independientes del ánimo.
// El día es la identidad de la página. Los campos desconocidos se conservan al editar.
(function (App) {
  var D = (App.diary = App.diary || {});

  var LIMITS = { title: 200, text: 20000, blocks: 200, tags: 20, tag: 40, emotions: 10 };
  var DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var BLOCK_ID_RE = /^b_[0-9a-f]{8}$/;
  var MOOD_RE = /^[a-z][a-z0-9-]{0,29}$/;
  var EMOTION_ID_RE = /^em_[0-9a-f]{8}$/;
  D.EMOTION_ID_RE = EMOTION_ID_RE;
  function skipKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function invalid(msg) { return App.storageError('invalid', msg); }

  D.LIMITS = LIMITS;

  // Los cinco estados de ánimo, de más a menos, con su valor en una escala de 0 a 100.
  // Es una escala lineal con el punto medio en "Neutro" (50 %): Muy bien 100, Bien 75, Neutro 50, Mal 25, Muy mal 0.
  D.MOODS = [
    { id: 'muy-bien', label: 'Muy bien', value: 100 }, { id: 'bien', label: 'Bien', value: 75 },
    { id: 'neutro', label: 'Neutro', value: 50 }, { id: 'mal', label: 'Mal', value: 25 },
    { id: 'muy-mal', label: 'Muy mal', value: 0 }
  ];
  // Los siete estados de la versión anterior se pasan al nivel más cercano; el original se conserva en `legacyMood`.
  var LEGACY_MOODS = { radiante: 'muy-bien', tranquila: 'bien', normal: 'neutro', cansada: 'neutro', ansiosa: 'mal', triste: 'mal', enfadada: 'mal' };
  D.LEGACY_MOODS = LEGACY_MOODS;
  D.moodLabel = function (id) {
    for (var i = 0; i < D.MOODS.length; i++) if (D.MOODS[i].id === id) return D.MOODS[i].label;
    return String(id);
  };
  D.isKnownMood = function (id) { return D.MOODS.some(function (m) { return m.id === id; }); };
  D.moodValue = function (id) {
    for (var i = 0; i < D.MOODS.length; i++) if (D.MOODS[i].id === id) return D.MOODS[i].value;
    return null;
  };
  D.moodIndex = function (id) {
    for (var i = 0; i < D.MOODS.length; i++) if (D.MOODS[i].id === id) return i;
    return D.MOODS.length;
  };

  // Media de una lista de valores (0-100), redondeada; null si no hay ninguno.
  D.averageOf = function (values) {
    if (!values.length) return null;
    return Math.round(values.reduce(function (a, b) { return a + b; }, 0) / values.length);
  };

  // Porcentaje de ánimo de una página: la media de los estados de sus entradas.
  // Las entradas SIN estado no cuentan (no se tratan como "neutro": eso falsearía la media);
  // si ninguna tiene estado, no hay porcentaje (null). Las emociones y las etiquetas no intervienen.
  D.dayMood = function (entry) {
    var blocks = (entry && entry.blocks) || [], values = [];
    blocks.forEach(function (b) { var v = D.moodValue(b && b.mood); if (v !== null) values.push(v); });
    return { percent: D.averageOf(values), rated: values.length, total: blocks.length };
  };

  // ---- Identificadores ----
  D.newBlockId = function () {
    var a = new Uint8Array(4);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return 'b_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  };

  // ---- Días ("2026-10-13", hora local) ----
  D.parseDay = function (str) {
    var m = DAY_RE.exec(String(str));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var date = new Date(y, mo - 1, d);
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
  };
  D.isDay = function (s) { return typeof s === 'string' && D.parseDay(s) !== null; };
  D.today = function () {
    var n = new Date();
    return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
  };
  D.monthKey = function (day) { return String(day).slice(0, 7); };
  D.formatLong = function (day) {
    var d = D.parseDay(day);
    return d ? d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  };
  D.formatMonth = function (key) {
    var d = D.parseDay(key + '-01');
    return d ? d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : key;
  };

  // ---- Etiquetas ----
  function fold(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  D.fold = fold;
  D.normalizeTag = function (tag) {
    return String(tag == null ? '' : tag).replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.tag);
  };
  D.uniqueTags = function (list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (t) {
      var n = D.normalizeTag(t), k = fold(n);
      if (n && !seen[k]) { seen[k] = true; out.push(n); }
    });
    return out.slice(0, LIMITS.tags);
  };

  D.uniqueEmotionIds = function (list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (id) {
      if (typeof id === 'string' && EMOTION_ID_RE.test(id) && !seen[id]) { seen[id] = true; out.push(id); }
    });
    return out.slice(0, LIMITS.emotions);
  };

  // ---- Bloques ----
  D.blockHasContent = function (b) {
    return !!(b && ((b.text && b.text.trim()) || (b.tags && b.tags.length) || b.mood || (b.emotions && b.emotions.length)));
  };

  // Devuelve el bloque limpio (puede estar vacío). Conserva campos desconocidos.
  D.sanitizeBlock = function (input, seenIds) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Hay una entrada con un formato inesperado.');
    var out = {};
    Object.keys(input).forEach(function (k) { if (!skipKey(k)) out[k] = input[k]; });
    var text = out.text === undefined || out.text === null ? '' : out.text;
    if (typeof text !== 'string') throw invalid('Hay una entrada con un formato inesperado.');
    out.text = text.trim();
    if (out.text.length > LIMITS.text) throw invalid('Una entrada es demasiado larga (máximo ' + LIMITS.text + ' caracteres).');
    seenIds = seenIds || {};
    out.id = typeof out.id === 'string' && BLOCK_ID_RE.test(out.id) && !seenIds[out.id] ? out.id : D.newBlockId();
    seenIds[out.id] = true;
    out.tags = D.uniqueTags(out.tags);
    out.emotions = D.uniqueEmotionIds(out.emotions);
    var mood = typeof out.mood === 'string' && MOOD_RE.test(out.mood) ? out.mood : null;
    if (mood !== null && !D.isKnownMood(mood)) {
      // Un estado que no es de los cinco (por ejemplo, de la versión anterior): se pasa a su nivel y se conserva el original.
      if (typeof out.legacyMood !== 'string') out.legacyMood = mood;
      mood = LEGACY_MOODS[mood] || null;
    }
    out.mood = mood;
    if (out.legacyMood !== undefined && (typeof out.legacyMood !== 'string' || !MOOD_RE.test(out.legacyMood))) delete out.legacyMood;
    return out;
  };

  // ---- Entradas ----
  // Devuelve la entrada limpia o lanza un error con un mensaje claro. Los bloques vacíos se descartan.
  D.sanitizeEntry = function (input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('La página no es válida.');
    var out = {};
    Object.keys(input).forEach(function (k) { if (!skipKey(k)) out[k] = input[k]; });

    if (!D.isDay(out.day)) throw invalid('La fecha no es válida.');
    out.title = typeof out.title === 'string' ? out.title.trim() : '';
    if (out.title.length > LIMITS.title) throw invalid('El título es demasiado largo (máximo ' + LIMITS.title + ' caracteres).');

    var blocks = Array.isArray(out.blocks) ? out.blocks : [];
    if (blocks.length > LIMITS.blocks) throw invalid('La página tiene demasiadas entradas (máximo ' + LIMITS.blocks + ').');
    var seen = {};
    out.blocks = blocks.map(function (b) { return D.sanitizeBlock(b, seen); }).filter(D.blockHasContent);

    out.favorite = out.favorite === true;
    var now = new Date().toISOString();
    out.createdAt = typeof out.createdAt === 'string' && !isNaN(Date.parse(out.createdAt)) ? out.createdAt : now;
    out.updatedAt = typeof out.updatedAt === 'string' && !isNaN(Date.parse(out.updatedAt)) ? out.updatedAt : now;

    if (!out.title && out.blocks.length === 0) throw invalid('Escribe algo, elige un ánimo o añade una etiqueta en alguna entrada, o ponle un título a la página.');
    return out;
  };

  // Para entradas que vienen del repositorio: null si no se pueden leer (no se borran del archivo).
  D.normalizeLoaded = function (raw) {
    try { return D.sanitizeEntry(raw); } catch (e) { return null; }
  };

  // Une varias entradas del mismo día en una (los bloques se conservan en el orden dado).
  D.mergeDayEntries = function (list) {
    var first = list[0], seen = {}, blocks = [], favorite = false, title = '', created = first.createdAt, updated = first.updatedAt;
    list.forEach(function (e) {
      e.blocks.forEach(function (b) { if (!seen[b.id]) { seen[b.id] = true; blocks.push(b); } });
      favorite = favorite || e.favorite;
      title = title || e.title;
      if (e.createdAt < created) created = e.createdAt;
      if (e.updatedAt > updated) updated = e.updatedAt;
    });
    return Object.assign({}, first, { blocks: blocks, favorite: favorite, title: title, createdAt: created, updatedAt: updated });
  };

  // ---- Formato antiguo (varias entradas por día, con fecha y hora y etiquetas de entrada) ----
  D.isLegacy = function (raw) {
    return !!raw && typeof raw === 'object' && typeof raw.day !== 'string' && typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw.date) && D.isDay(raw.date.slice(0, 10));
  };

  // Convierte entradas antiguas en entradas nuevas: una por día. Las etiquetas de cada entrada pasan a
  // todos sus bloques y los bloques de un mismo día se ordenan por la hora a la que se escribieron.
  D.upgradeLegacy = function (rawList) {
    var byDay = {}, days = [];
    rawList.forEach(function (raw) {
      if (!D.isLegacy(raw)) return;
      var day = raw.date.slice(0, 10);
      var entryTags = D.uniqueTags(raw.tags);
      var seen = {};
      var blocks = (Array.isArray(raw.blocks) ? raw.blocks : []).filter(function (b) { return b && typeof b.text === 'string'; }).map(function (b) {
        return D.sanitizeBlock({ id: b.id, text: b.text, tags: entryTags, mood: null }, seen);
      }).filter(D.blockHasContent);
      var created = typeof raw.createdAt === 'string' && !isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date().toISOString();
      var updated = typeof raw.updatedAt === 'string' && !isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : created;
      var entry = { day: day, title: typeof raw.title === 'string' ? raw.title.trim().slice(0, LIMITS.title) : '', favorite: raw.favorite === true, blocks: blocks, createdAt: created, updatedAt: updated };
      if (!entry.title && !entry.blocks.length) return;
      if (!byDay[day]) { byDay[day] = []; days.push(day); }
      byDay[day].push({ order: raw.date + '|' + created, entry: entry });
    });
    return days.sort().map(function (day) {
      var list = byDay[day].sort(function (a, b) { return a.order < b.order ? -1 : 1; }).map(function (x) { return x.entry; });
      return D.mergeDayEntries(list);
    });
  };

  // ---- Presentación de texto ----
  D.entryTags = function (entry) {
    var all = [];
    entry.blocks.forEach(function (b) { all = all.concat(b.tags || []); });
    return D.uniqueTags(all);
  };
  D.firstText = function (entry) {
    for (var i = 0; i < entry.blocks.length; i++) if (entry.blocks[i].text) return entry.blocks[i].text;
    return '';
  };
  D.excerpt = function (entry, max) {
    var flat = D.firstText(entry).replace(/\s+/g, ' ').trim();
    max = max || 140;
    return flat.length > max ? flat.slice(0, max - 1).trimEnd() + '…' : flat;
  };
  D.displayTitle = function (entry) { return entry.title || D.excerpt(entry, 60) || D.formatLong(entry.day); };
  D.entryMoods = function (entry) {
    var seen = {}, out = [];
    entry.blocks.forEach(function (b) { if (b.mood && !seen[b.mood]) { seen[b.mood] = true; out.push(b.mood); } });
    return out;
  };

  // Páginas vecinas: el día anterior y el siguiente que tienen página (para "pasar la página").
  D.neighbors = function (entries, day) {
    var prev = null, next = null;
    entries.forEach(function (e) {
      if (e.day < day && (prev === null || e.day > prev)) prev = e.day;
      if (e.day > day && (next === null || e.day < next)) next = e.day;
    });
    return { prev: prev, next: next };
  };

  // ---- Búsqueda ----
  // q: { text, tags: [], mood, favoritesOnly, day: 'AAAA-MM-DD', from, to }   (todo opcional)
  D.search = function (entries, q) {
    q = q || {};
    var terms = fold(q.text || '').split(/\s+/).filter(Boolean);
    var wantTags = (q.tags || []).map(fold);
    return entries.filter(function (e) {
      if (q.day && e.day !== q.day) return false;
      if (q.from && e.day < q.from) return false;
      if (q.to && e.day > q.to) return false;
      if (q.favoritesOnly && !e.favorite) return false;
      if (q.mood && !e.blocks.some(function (b) { return b.mood === q.mood; })) return false;
      if (wantTags.length) {
        var mine = D.entryTags(e).map(fold);
        if (!wantTags.every(function (t) { return mine.indexOf(t) >= 0; })) return false;
      }
      if (terms.length) {
        var hay = fold(e.title + ' ' + e.blocks.map(function (b) { return b.text + ' ' + (b.tags || []).join(' '); }).join(' '));
        if (!terms.every(function (t) { return hay.indexOf(t) >= 0; })) return false;
      }
      return true;
    }).sort(D.byDayDesc);
  };
  D.byDayDesc = function (a, b) { return a.day < b.day ? 1 : a.day > b.day ? -1 : 0; };

  // Etiquetas más usadas (cuenta entradas)
  D.allTags = function (entries) {
    var counts = {}, names = {};
    entries.forEach(function (e) {
      e.blocks.forEach(function (b) {
        (b.tags || []).forEach(function (t) { var k = fold(t); counts[k] = (counts[k] || 0) + 1; names[k] = names[k] || t; });
      });
    });
    return Object.keys(counts).map(function (k) { return { tag: names[k], count: counts[k] }; })
      .sort(function (a, b) { return (b.count - a.count) || (a.tag < b.tag ? -1 : 1); });
  };
  D.groupByMonth = function (entries) {
    var groups = [], last = null;
    entries.forEach(function (e) {
      var key = D.monthKey(e.day);
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
    var byDay = {};
    entries.forEach(function (e) { byDay[e.day] = e; });
    var cells = [], i;
    for (i = 0; i < offset; i++) cells.push(null);
    for (i = 1; i <= days; i++) {
      var key = year + '-' + pad(monthIndex + 1) + '-' + pad(i), e = byDay[key];
      cells.push({ day: i, key: key, has: !!e, blocks: e ? e.blocks.length : 0 });
    }
    while (cells.length % 7) cells.push(null);
    var weeks = [];
    for (i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { year: year, month: monthIndex, weeks: weeks };
  };
})(window.App = window.App || {});
