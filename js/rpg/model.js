// Modelo del personaje (RPG). Todo son funciones puras, sin red ni DOM.
//
// Reglas que se cumplen aquí y en el repositorio:
//  - El nivel y el progreso NUNCA se guardan: se calculan sumando el registro de experiencia (ledger).
//  - La experiencia solo entra por acciones explícitas (misiones, logros o apuntes manuales). Ni el diario,
//    ni los estados de ánimo, ni las emociones dan o quitan XP.
//  - Cada apunte tiene una clave única (idempotencia): el mismo apunte no puede contarse dos veces.
//  - Las correcciones son apuntes de ajuste visibles, con motivo; nada se borra en silencio.
(function (App) {
  var R = App.rpg = App.rpg || {};

  // ---- Niveles ----
  R.GENERAL_LEVEL = { base: 100, step: 25 };   // XP para pasar del nivel n al n+1: 100 + 25·(n−1)
  R.SUB_LEVEL = { base: 80, step: 20 };        // 80 + 20·(n−1)
  R.QUEST_SIZES = [
    { id: 'pequena', label: 'Pequeña', xp: 15 },
    { id: 'normal', label: 'Normal', xp: 30 },
    { id: 'dificil', label: 'Difícil', xp: 60 },
    { id: 'epica', label: 'Épica', xp: 100 }
  ];
  R.LIMITS = { name: 40, description: 200, reason: 200, label: 80, subs: 40, maxXp: 5000 };

  // De la experiencia total al nivel. Devuelve el nivel, la XP dentro del nivel, la que falta para el siguiente y la fracción (0–1).
  R.levelInfo = function (total, curve) {
    curve = curve || R.GENERAL_LEVEL;
    var xp = Math.max(0, Math.floor(Number(total) || 0)), level = 1, need = curve.base;
    while (xp >= need && level < 999) { xp -= need; level++; need = curve.base + curve.step * (level - 1); }
    return { level: level, into: xp, need: need, fraction: need ? xp / need : 0, total: Math.max(0, Math.floor(Number(total) || 0)) };
  };
  // Progreso continuo de un nivel (nivel−1 + fracción): sirve para el radar.
  R.progressOf = function (total, curve) { var i = R.levelInfo(total, curve); return (i.level - 1) + i.fraction; };

  // ---- Catálogo por defecto (el usuario puede renombrar, describir, cambiar iconos, reordenar y archivar las subcategorías) ----
  R.MAIN_IDS = ['vitalidad', 'espiritu', 'vinculos', 'aventura', 'creatividad'];
  R.DEFAULT_ATTRIBUTES = [
    { id: 'vitalidad', name: 'Vitalidad', icon: 'heart', description: 'Cuerpo, salud física y autocuidado.', subs: [
      { id: 'fuerza', name: 'Fuerza', icon: 'dumbbell', description: 'Gimnasio y entrenamiento.' },
      { id: 'salud', name: 'Salud', icon: 'leaf', description: 'Alimentación, hidratación y hábitos.' },
      { id: 'resistencia', name: 'Resistencia', icon: 'bolt', description: 'Cardio, caminar, correr y actividad física.' },
      { id: 'descanso', name: 'Descanso', icon: 'moon', description: 'Dormir y recuperarse.' },
      { id: 'autocuidado', name: 'Autocuidado', icon: 'mirror', description: 'Skincare, mascarillas, uñas, pelo, arreglarse e imagen personal.' }
    ] },
    { id: 'espiritu', name: 'Espíritu', icon: 'star', description: 'Crecimiento personal, aprendizaje, constancia y lado mágico.', subs: [
      { id: 'conocimiento', name: 'Conocimiento', icon: 'book', description: 'Aprender y estudiar.' },
      { id: 'disciplina', name: 'Disciplina', icon: 'key', description: 'Constancia y hábitos.' },
      { id: 'brujeria', name: 'Brujería', icon: 'tarot', description: 'Tarot, rituales, simbolismo y astrología.' }
    ] },
    { id: 'vinculos', name: 'Vínculos', icon: 'people', description: 'Las personas de tu vida.', subs: [
      { id: 'amistad', name: 'Amistad', icon: 'butterfly', description: 'Tus amistades.' },
      { id: 'amor', name: 'Amor', icon: 'rose', description: 'Pareja y cariño romántico.' },
      { id: 'familia', name: 'Familia', icon: 'locket', description: 'Tu familia.' },
      { id: 'conexion', name: 'Conexión', icon: 'bow', description: 'Conversar, estar presente, cuidar los lazos.' }
    ] },
    { id: 'aventura', name: 'Aventura', icon: 'compass', description: 'Salir, probar cosas nuevas y atreverse.', subs: [
      { id: 'experiencias', name: 'Experiencias', icon: 'sun', description: 'Planes y vivencias nuevas.' },
      { id: 'valentia', name: 'Valentía', icon: 'candle', description: 'Hacer cosas que dan miedo.' },
      { id: 'exploracion', name: 'Exploración', icon: 'umbrella', description: 'Lugares nuevos y descubrimientos.' }
    ] },
    { id: 'creatividad', name: 'Creatividad', icon: 'pencil', description: 'Crear y disfrutar de lo creado.', subs: [
      { id: 'arte', name: 'Arte', icon: 'pencil', description: 'Dibujo, escultura digital, modelado 3D y texturizado.' },
      { id: 'lectura', name: 'Lectura', icon: 'book', description: 'Libros, cómics y manga.' },
      { id: 'peliculas', name: 'Películas', icon: 'film', description: 'Cine y series.' }
    ] }
  ];

  // Galería de iconos para atributos y subcategorías (los dibujos viven en icons.js).
  R.ICONS = ['heart', 'dumbbell', 'leaf', 'bolt', 'moon', 'mirror', 'star', 'book', 'key', 'tarot', 'spark', 'eye', 'people', 'butterfly', 'rose', 'locket', 'bow',
    'compass', 'sun', 'candle', 'umbrella', 'pencil', 'film', 'ghost', 'skull', 'cat', 'cross', 'cherry', 'cloud', 'drop', 'crown', 'flower', 'mended'];
  R.isIcon = function (id) { return R.ICONS.indexOf(id) >= 0; };

  function cleanText(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
  R.cleanText = cleanText;
  R.SUB_ID_RE = /^[a-z0-9][a-z0-9_]{1,30}$/;
  R.fold = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };

  R.newSubId = function () {
    var a = new Uint8Array(4);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return 'sa_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  };
  R.newRequestId = function () { return 'rq_' + R.newSubId().slice(3) + Date.now().toString(36); };

  // Estructura de atributos con los valores por defecto. `doc` es lo guardado (puede ser null o estar incompleto):
  // se respeta lo que el usuario cambió y se añade lo que falte. Nunca se pierde una subcategoría guardada.
  R.buildStructure = function (doc) {
    var saved = doc && Array.isArray(doc.attributes) ? doc.attributes : [];
    var byId = {};
    saved.forEach(function (a) { if (a && typeof a.id === 'string') byId[a.id] = a; });
    return R.DEFAULT_ATTRIBUTES.map(function (def) {
      var s = byId[def.id] || {};
      var savedSubs = Array.isArray(s.subs) ? s.subs.filter(function (x) { return x && typeof x.id === 'string' && R.SUB_ID_RE.test(x.id); }) : null;
      var subs;
      if (savedSubs) {
        subs = savedSubs.map(function (x, i) { return normalizeSub(x, defaultSub(x.id), i); });
        def.subs.forEach(function (d) {   // si falta una de fábrica (nunca se borran, solo se archivan), vuelve
          if (!subs.some(function (x) { return x.id === d.id; })) subs.push(normalizeSub(d, d, subs.length));
        });
      } else subs = def.subs.map(function (d, i) { return normalizeSub(d, d, i); });
      subs.sort(function (a, b) { return a.order - b.order; });
      return {
        id: def.id,
        name: cleanText(s.name, R.LIMITS.name) || def.name,
        icon: R.isIcon(s.icon) ? s.icon : def.icon,
        description: s.description === undefined ? def.description : cleanText(s.description, R.LIMITS.description),
        subs: subs
      };
    });
  };
  function defaultSub(id) {
    for (var i = 0; i < R.DEFAULT_ATTRIBUTES.length; i++) {
      var subs = R.DEFAULT_ATTRIBUTES[i].subs;
      for (var j = 0; j < subs.length; j++) if (subs[j].id === id) return subs[j];
    }
    return { name: '', icon: 'star', description: '' };
  }
  function normalizeSub(x, def, i) {
    return {
      id: x.id,
      name: cleanText(x.name, R.LIMITS.name) || def.name || 'Sin nombre',
      icon: R.isIcon(x.icon) ? x.icon : (R.isIcon(def.icon) ? def.icon : 'star'),
      description: x.description === undefined ? (def.description || '') : cleanText(x.description, R.LIMITS.description),
      archived: x.archived === true,
      order: typeof x.order === 'number' && isFinite(x.order) ? x.order : i
    };
  }
  // Lo que se guarda en attributes.json (la estructura completa, para que sea legible y editable en GitHub).
  R.structureToDoc = function (structure) {
    return { version: 1, attributes: structure.map(function (a) {
      return { id: a.id, name: a.name, icon: a.icon, description: a.description, subs: a.subs.map(function (s, i) {
        return { id: s.id, name: s.name, icon: s.icon, description: s.description, archived: !!s.archived, order: i };
      }) };
    }) };
  };

  R.findSub = function (structure, id) {
    for (var i = 0; i < structure.length; i++) for (var j = 0; j < structure[i].subs.length; j++) if (structure[i].subs[j].id === id) return { main: structure[i], sub: structure[i].subs[j] };
    return null;
  };

  // ---- Registro de experiencia ----
  // Reparte `xp` según porcentajes [{sub, pct}] que suman 100. El resto del redondeo va a la parte mayor,
  // de modo que la suma de las partes es siempre exactamente `xp`. Sin porcentajes → solo XP general.
  R.splitXp = function (xp, shares) {
    if (!shares || !shares.length) return [];
    var sum = shares.reduce(function (t, s) { return t + s.pct; }, 0);
    if (sum !== 100) throw App.storageError('invalid', 'Los porcentajes deben sumar 100 (ahora suman ' + sum + ').');
    var sign = xp < 0 ? -1 : 1, abs = Math.abs(xp);
    var parts = shares.map(function (s) { return { sub: s.sub, xp: Math.floor(abs * s.pct / 100), pct: s.pct }; });
    var left = abs - parts.reduce(function (t, p) { return t + p.xp; }, 0);
    var big = 0; parts.forEach(function (p, i) { if (p.pct > parts[big].pct) big = i; });
    parts[big].xp += left;
    return parts.filter(function (p) { return p.xp > 0; }).map(function (p) { return { sub: p.sub, xp: sign * p.xp }; });
  };

  // Totales a partir del registro: { general, subs: {id: xp} }. Los totales nunca bajan de 0.
  R.totals = function (entries) {
    var general = 0, subs = {};
    (entries || []).forEach(function (e) {
      if (!e || typeof e.xp !== 'number') return;
      general += e.xp;
      (e.splits || []).forEach(function (s) { if (s && typeof s.sub === 'string' && typeof s.xp === 'number') subs[s.sub] = (subs[s.sub] || 0) + s.xp; });
    });
    Object.keys(subs).forEach(function (k) { if (subs[k] < 0) subs[k] = 0; });
    return { general: Math.max(0, general), subs: subs };
  };

  // Estado completo del personaje: nivel general, subcategorías y atributos principales.
  R.computeState = function (structure, entries) {
    var t = R.totals(entries);
    var mains = structure.map(function (a) {
      var counted = a.subs.filter(function (s) { return !s.archived || (t.subs[s.id] || 0) > 0; });
      var subs = a.subs.map(function (s) {
        var info = R.levelInfo(t.subs[s.id] || 0, R.SUB_LEVEL);
        return Object.assign({}, s, { xp: info.total, level: info.level, into: info.into, need: info.need, fraction: info.fraction, progress: (info.level - 1) + info.fraction });
      });
      var byId = {}; subs.forEach(function (s) { byId[s.id] = s; });
      var value = counted.length ? counted.reduce(function (sum, s) { return sum + byId[s.id].progress; }, 0) / counted.length : 0;
      return {
        id: a.id, name: a.name, icon: a.icon, description: a.description,
        subs: subs, value: value, level: Math.floor(value) + 1, fraction: value - Math.floor(value),
        xp: counted.reduce(function (sum, s) { return sum + byId[s.id].xp; }, 0)
      };
    });
    return { general: R.levelInfo(t.general, R.GENERAL_LEVEL), mains: mains, subTotals: t.subs };
  };

  // Escala del radar: el primer valor de la lista 2, 3, 5, 10, 15, 20… que supera al mayor atributo.
  // Así, al empezar, el polígono se ve; y la escala solo crece (nunca encoge) porque la XP no baja.
  R.radarCap = function (mains) {
    var max = 0;
    mains.forEach(function (m) { if (m.value > max) max = m.value; });
    if (max < 2) return 2;
    if (max < 3) return 3;
    if (max < 5) return 5;
    return (Math.floor(max / 5) + 1) * 5;
  };

  // Fecha de hoy en hora local (AAAA-MM-DD).
  R.today = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };

  // Toda actividad da exactamente 5 XP, en puntos enteros repartidos entre subcategorías (p. ej. 2 + 3).
  R.ACTIVITY_MAX = 5;
  R.ACTIVITY_XP = 5;
  R.ACT_ID_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;

  // Claves de los apuntes que ya se han anulado (un ajuste con `reverses`), y recuento de actividades no anuladas.
  R.voidedKeys = function (entries) {
    var out = {};
    (entries || []).forEach(function (e) { if (e && typeof e.reverses === 'string') out[e.reverses] = true; });
    return out;
  };
  R.activityCount = function (entries, activityId, from, to) {
    var voided = R.voidedKeys(entries), n = 0;
    (entries || []).forEach(function (e) {
      if (!e || e.kind !== 'activity' || e.activity !== activityId || voided[e.key]) return;
      if (from && e.day < from) return;
      if (to && e.day > to) return;
      n++;
    });
    return n;
  };

  // Validación de un apunte de experiencia (lanza un error claro). `structure` sirve para comprobar las subcategorías.
  // La experiencia se reparte con `shares` (porcentajes que suman 100) o con `points` (XP exacta por subcategoría).
  R.sanitizeEntry = function (input, structure, opts) {
    opts = opts || {};
    function bad(msg) { return App.storageError('invalid', msg); }
    if (!input || typeof input !== 'object') throw bad('El apunte no es válido.');
    var kind = input.kind;
    if (['manual', 'quest', 'achievement', 'adjustment', 'activity'].indexOf(kind) < 0) throw bad('El tipo de apunte no es válido.');
    var key = String(input.key || '');
    if (!/^[A-Za-z0-9:_-]{3,80}$/.test(key)) throw bad('El apunte no tiene una clave válida.');
    var label = cleanText(input.label, R.LIMITS.label);
    if (!label) throw bad(kind === 'adjustment' ? 'Escribe qué estás corrigiendo.' : 'Escribe qué has hecho.');
    var reason = cleanText(input.reason, R.LIMITS.reason);
    if (kind === 'adjustment' && !reason) throw bad('Un ajuste necesita un motivo.');
    var xp = Number(input.xp);
    if (!isFinite(xp) || Math.floor(xp) !== xp || xp === 0) throw bad('La experiencia debe ser un número entero distinto de 0.');
    if (Math.abs(xp) > R.LIMITS.maxXp) throw bad('Demasiada experiencia de una vez (máximo ' + R.LIMITS.maxXp + ').');
    if (xp < 0 && kind !== 'adjustment') throw bad('Solo un ajuste puede quitar experiencia.');
    var activity = '';
    if (kind === 'activity') {
      activity = String(input.activity || '');
      if (!R.ACT_ID_RE.test(activity)) throw bad('La actividad no es válida.');
      if (xp > R.ACTIVITY_MAX) throw bad('Una actividad da como máximo ' + R.ACTIVITY_MAX + ' XP.');
    }
    function checkSub(id, seen) {
      var f = R.findSub(structure, id);
      if (!f) throw bad('Esa subcategoría no existe.');
      if (f.sub.archived && kind !== 'adjustment') throw bad('«' + f.sub.name + '» está archivada; desarchívala para darle experiencia.');
      if (seen[id]) throw bad('Una subcategoría aparece dos veces.');
      seen[id] = true;
    }
    var seen = {}, splits;
    if (Array.isArray(input.points)) {
      var sum = 0;
      splits = input.points.map(function (p) {
        var v = Number(p && p.xp);
        if (!isFinite(v) || Math.floor(v) !== v || v === 0 || (v < 0) !== (xp < 0)) throw bad('Los puntos de cada subcategoría deben ser enteros del mismo signo que la experiencia.');
        checkSub(p.sub, seen); sum += v;
        return { sub: p.sub, xp: v };
      });
      if (splits.length && sum !== xp) throw bad('Los puntos repartidos (' + sum + ') no coinciden con la experiencia (' + xp + ').');
    } else {
      var shares = (input.shares || []).map(function (s) { return { sub: s && s.sub, pct: Number(s && s.pct) }; });
      shares.forEach(function (s) {
        if (!isFinite(s.pct) || Math.floor(s.pct) !== s.pct || s.pct <= 0 || s.pct > 100) throw bad('Los porcentajes deben ser enteros entre 1 y 100.');
        checkSub(s.sub, seen);
      });
      splits = R.splitXp(xp, shares);
    }
    var day = typeof input.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : (opts.today || R.today());
    var out = { key: key, kind: kind, label: label, reason: reason, xp: xp, day: day, splits: splits, at: typeof input.at === 'string' ? input.at : new Date().toISOString() };
    if (activity) out.activity = activity;
    if (typeof input.quest === 'string' && /^[A-Za-z0-9_]{3,40}$/.test(input.quest)) out.quest = input.quest;
    if (kind === 'adjustment' && typeof input.reverses === 'string' && /^[A-Za-z0-9:_-]{3,80}$/.test(input.reverses)) out.reverses = input.reverses;
    return out;
  };
})(window.App = window.App || {});
