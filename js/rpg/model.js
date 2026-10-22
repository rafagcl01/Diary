// Modelo del personaje (RPG). Todo son funciones puras, sin red ni DOM.
//
// Reglas que se cumplen aquí y en el repositorio:
//  - El nivel y el progreso NUNCA se guardan: se calculan sumando el registro de experiencia (ledger).
//  - La experiencia solo entra por acciones explícitas (actividades, tareas, misiones, jefes, apuntes manuales) y por
//    escribir en el diario (10 XP el primer bloque con texto del día, solo al nivel general). Ni los estados de ánimo
//    ni las emociones dan o quitan XP.
//  - Cada apunte tiene una clave única (idempotencia): el mismo apunte no puede contarse dos veces. Y guarda la XP que dio
//    en su momento: cambiar los valores (config.js) no cambia el pasado.
//  - Las correcciones son apuntes de ajuste visibles, con motivo; nada se borra en silencio.
// Todos los números (XP, topes, curvas) están en config.js.
(function (App) {
  var R = App.rpg = App.rpg || {};
  var C = R.CONFIG;

  // ---- Niveles ----
  R.GENERAL_LEVEL = C.levels.general;   // XP para pasar del nivel n al n+1: round(55 · n^1,2), hasta el nivel 30
  R.MAIN_LEVEL = C.levels.main;         // atributos: la misma forma × 0,3, con la SUMA de la XP de sus subcategorías
  R.SUB_LEVEL = C.levels.sub;           // subcategorías: la misma forma × 0,2
  R.QUEST_SIZES = C.questSizes;
  R.LIMITS = { name: 40, description: 200, reason: 200, label: 80, subs: 40, maxXp: 5000 };

  // XP para pasar del nivel n al n+1 con una curva { base, exp, factor }. Nunca menos de 1.
  R.levelNeed = function (n, curve) {
    curve = curve || R.GENERAL_LEVEL;
    return Math.max(1, Math.round(curve.base * (curve.factor || 1) * Math.pow(n, curve.exp)));
  };
  // De la experiencia total al nivel. Devuelve el nivel, la XP dentro del nivel, la que falta para el siguiente y la fracción (0–1).
  // Con `curve.max` (el personaje, nivel 30) no se pasa de ahí: lo de después suma constelaciones (una estrella cada
  // CONFIG.constellation.xp), y `into`/`need`/`fraction` pasan a ser el camino hacia la siguiente estrella.
  R.levelInfo = function (total, curve) {
    curve = curve || R.GENERAL_LEVEL;
    var cap = curve.max || 999;
    var xp = Math.max(0, Math.floor(Number(total) || 0)), level = 1, need = R.levelNeed(1, curve);
    while (xp >= need && level < cap) { xp -= need; level++; need = R.levelNeed(level, curve); }
    var all = Math.max(0, Math.floor(Number(total) || 0));
    if (curve.max && level >= cap) {
      var step = C.constellation.xp, stars = Math.floor(xp / step), rest = xp - stars * step;
      return { level: level, max: true, stars: stars, into: rest, need: step, fraction: rest / step, total: all, start: all - rest, next: all - rest + step };
    }
    // start: XP total con la que empezó este nivel; next: la que hace falta para el siguiente (la ficha enseña «70 / 181 XP»).
    return { level: level, max: false, stars: 0, into: xp, need: need, fraction: need ? xp / need : 0, total: all, start: all - xp, next: all - xp + need };
  };
  // XP total que hace falta para llegar al nivel `level` (desde 0).
  R.xpForLevel = function (level, curve) {
    var t = 0; for (var n = 1; n < level; n++) t += R.levelNeed(n, curve); return t;
  };
  // Marcos del avatar según el nivel general (solo decoración). Para cambiarlos basta con tocar esta lista
  // (y su dibujo en views/rpg/avatar.js, por id). Ordenados por nivel; el primero debe empezar en el nivel 1.
  // Los reservados (`soon`) no cuentan como marcos ni fondos que se tienen: solo se anuncian (ver R.SOON_REWARDS).
  function ready(x) { return !x.soon; }
  R.AVATAR_FRAMES = C.frames.filter(ready);
  // Premios reservados («próximamente»), para «Tu camino» y la pantalla de nivel: [{ kind: 'Marco' | 'Fondo', level }].
  R.SOON_REWARDS = C.frames.filter(function (x) { return x.soon; }).map(function (x) { return { kind: 'Marco', level: x.level }; })
    .concat(C.backgrounds.filter(function (x) { return x.soon; }).map(function (x) { return { kind: 'Fondo', level: x.level }; }));
  // El marco de un nivel y el siguiente (null si ya tienes el último).
  R.frameFor = function (level) {
    var list = R.AVATAR_FRAMES, cur = list[0], next = null;
    for (var i = 0; i < list.length; i++) { if (level >= list[i].level) cur = list[i]; else { next = list[i]; break; } }
    return { frame: cur, next: next };
  };
  // Títulos del personaje, por nivel general (solo decoración: no dan XP). Para cambiarlos basta con tocar esta lista.
  // Lo conseguido se calcula del nivel; solo se guarda cuál eliges (profile.title). Antes del primero no hay título.
  R.TITLES = C.titles;
  // Textos con tres formas (títulos y rasgos): f = femenina, m = masculina, n = neutra (Configuración → Tu personaje).
  R.TEXT_FORMS = ['f', 'm', 'n'];
  R.named = function (item, form) {
    if (!item) return '';
    var n = item.names || {};
    return n[R.TEXT_FORMS.indexOf(form) >= 0 ? form : 'f'] || n.f || item.name || '';
  };
  C.titles.concat(C.traits).forEach(function (x) { if (x.names && !x.name) x.name = x.names.f; });   // por defecto, la femenina
  // Fondos de la ficha, por nivel general (se eligen en Configuración → Tu personaje).
  R.BACKGROUNDS = C.backgrounds.filter(ready);
  R.isBackground = function (id) { return R.BACKGROUNDS.some(function (b) { return b.id === id; }); };
  R.backgroundsFor = function (level) { return R.BACKGROUNDS.filter(function (b) { return level >= b.level; }); };
  R.isTitle = function (id) { return R.TITLES.some(function (t) { return t.id === id; }); };
  R.titlesFor = function (level) { return R.TITLES.filter(function (t) { return level >= t.level; }); };
  // El que se ve: el elegido si ya está conseguido; si no, el más alto conseguido; null si aún no hay ninguno.
  R.currentTitle = function (chosenId, level) {
    var mine = R.titlesFor(level);
    return mine.filter(function (t) { return t.id === chosenId; })[0] || mine[mine.length - 1] || null;
  };
  R.nextTitle = function (level) { return R.TITLES.filter(function (t) { return t.level > level; })[0] || null; };

  // Foto del avatar: JPEG cuadrado de 320 px guardado en rpg/profile.json.
  R.AVATAR_PHOTO = { px: 320, max: 80000 };
  R.isAvatarPhoto = function (s) { return typeof s === 'string' && s.length <= R.AVATAR_PHOTO.max && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(s); };

  // Progreso continuo de un nivel (nivel−1 + fracción): sirve para el radar.
  R.progressOf = function (total, curve) { var i = R.levelInfo(total, curve); return (i.level - 1) + i.fraction; };

  // ---- Catálogo por defecto (el usuario puede renombrar, describir, cambiar iconos, reordenar y archivar las subcategorías) ----
  R.MAIN_IDS = ['vitalidad', 'espiritu', 'vinculos', 'aventura', 'creatividad', 'inteligencia', 'yo_futuro'];
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
    ] },
    // Añadidos después: a quien ya tenía datos le aparecen solos (ver buildStructure) a nivel 1, sin tocar lo demás.
    { id: 'inteligencia', name: 'Inteligencia', icon: 'spark', description: 'Pensar, aprender idiomas y comunicarte.', subs: [
      { id: 'logica', name: 'Lógica', icon: 'key', description: 'Razonamiento, resolución de problemas y desafíos mentales.' },
      { id: 'idioma', name: 'Idioma', icon: 'globe', description: 'Aprendizaje y práctica de idiomas.' },
      { id: 'comunicacion', name: 'Comunicación', icon: 'speech', description: 'Expresión oral, argumentación, debates y capacidad para expresar ideas e intercambiar opiniones.' }
    ] },
    { id: 'yo_futuro', name: 'Yo futuro', icon: 'flag', description: 'Construir la vida que quieres tener.', subs: [
      { id: 'finanzas', name: 'Finanzas', icon: 'coin', description: 'Ahorro, gestión del dinero, control de gastos y planificación económica.' },
      { id: 'carrera', name: 'Carrera profesional', icon: 'briefcase', description: 'Búsqueda de empleo, mejora del portfolio, preparación de entrevistas y progreso profesional.' },
      { id: 'objetivos', name: 'Objetivos personales', icon: 'flag', description: 'Avanzar en metas importantes, completar proyectos personales y construir la vida que quieres tener.' }
    ] }
  ];

  // Galería de iconos para atributos y subcategorías (los dibujos viven en icons.js).
  R.ICONS = App.SYMBOL_IDS;   // la galería única de icons.js (la misma para todo)
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
      // El atributo sube con la SUMA de la XP de todas sus subcategorías (también las archivadas: no se pierde nada),
      // con su propia curva. Crear o archivar una subcategoría no le cambia el nivel: solo puede subir.
      var xp = subs.reduce(function (sum, s) { return sum + s.xp; }, 0), info = R.levelInfo(xp, R.MAIN_LEVEL);
      return {
        id: a.id, name: a.name, icon: a.icon, description: a.description, counted: counted.length,
        subs: subs, value: (info.level - 1) + info.fraction, level: info.level, fraction: info.fraction, into: info.into, need: info.need, xp: xp
      };
    });
    return { general: R.levelInfo(t.general, R.GENERAL_LEVEL), mains: mains, subTotals: t.subs };
  };

  // Cómo estaba el personaje al terminar el día `day` (AAAA-MM-DD): el mismo cálculo con el registro hasta ese día.
  // No se guarda nada: sale siempre del registro.
  R.stateAt = function (structure, entries, day) {
    return R.computeState(structure, (entries || []).filter(function (e) { return e && e.day <= day; }));
  };
  function shiftDay(day, n) {
    var p = day.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  R.shiftDay = shiftDay;
  // Para el radar con evolución: hace 30 días (`month`) o un estado por cada final de mes desde el primer registro
  // hasta el mes pasado, como mucho los 12 últimos (`months`, del más antiguo al más reciente).
  R.radarHistory = function (structure, entries, today) {
    today = today || R.today();
    var days = (entries || []).map(function (e) { return e && e.day; }).filter(Boolean).sort();
    var out = { month: R.stateAt(structure, entries, shiftDay(today, -30)), months: [] };
    if (!days.length) return out;
    var first = days[0].slice(0, 7), cur = today.slice(0, 7), keys = [];
    for (var k = first; k < cur; ) {
      keys.push(k);
      var y = +k.slice(0, 4), m = +k.slice(5, 7) + 1; if (m > 12) { y++; m = 1; }
      k = y + '-' + ('0' + m).slice(-2);
    }
    out.months = keys.slice(-12).map(function (key) {
      var last = new Date(+key.slice(0, 4), +key.slice(5, 7), 0).getDate();
      return { key: key, computed: R.stateAt(structure, entries, key + '-' + ('0' + last).slice(-2)) };
    });
    return out;
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
  // «Día de uso»: cambia a las 3:00 y no a medianoche (lo que haces de madrugada cuenta como el día anterior).
  // Lo usan las listas de tareas (se limpian a las 3:00) y las misiones de una sola semana (el lunes a las 3:00).
  R.DAY_CUTOFF_HOURS = 3;
  R.logicalDay = function (now) {
    var d = new Date((now ? new Date(now).getTime() : Date.now()) - R.DAY_CUTOFF_HOURS * 3600000);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };

  // Toda actividad da exactamente 5 XP, en puntos enteros repartidos entre subcategorías (p. ej. 2 + 3).
  // Solo las 10 primeras de cada día dan XP; las demás se registran con 0 XP (`capped`) y cuentan igual para las misiones.
  R.ACTIVITY_MAX = C.activity.xp;
  R.ACTIVITY_XP = C.activity.xp;
  R.ACTIVITY_PER_DAY = C.activity.perDay;
  // Escribir en el diario: un apunte por día (`diary:<día>`), solo al nivel general.
  R.DIARY_XP = C.diary.xp;
  R.diaryXpKey = function (day) { return 'diary:' + day; };
  R.isDiaryXpKey = function (key) { return /^diary:\d{4}-\d{2}-\d{2}$/.test(String(key)); };
  R.ACT_ID_RE = /^[a-z0-9][a-z0-9_-]{1,30}$/;

  // Claves de los apuntes que ya se han anulado (un ajuste con `reverses`), y recuento de actividades no anuladas.
  R.voidedKeys = function (entries) {
    var out = {};
    (entries || []).forEach(function (e) { if (e && typeof e.reverses === 'string') out[e.reverses] = true; });
    return out;
  };
  // Para «haz esta actividad N veces» (misiones semanales y pasos de jefe): cuenta como mucho UNA por actividad y día,
  // así que registrarla tres veces el mismo día cuenta una. `activityIds` puede ser un id o una lista (vale cualquiera:
  // gimnasio y correr el mismo día cuentan dos). Las de 0 XP por el tope también cuentan.
  R.activityCount = function (entries, activityIds, from, to) {
    var ids = Array.isArray(activityIds) ? activityIds : [activityIds];
    var voided = R.voidedKeys(entries), seen = {}, n = 0;
    (entries || []).forEach(function (e) {
      if (!e || e.kind !== 'activity' || ids.indexOf(e.activity) < 0 || voided[e.key]) return;
      if (from && e.day < from) return;
      if (to && e.day > to) return;
      var k = e.activity + '|' + e.day;
      if (!seen[k]) { seen[k] = true; n++; }
    });
    return n;
  };
  // Actividades de un día que dieron XP (no anuladas): para el tope diario.
  R.activitiesWithXp = function (entries, day) {
    var voided = R.voidedKeys(entries);
    return (entries || []).filter(function (e) { return e && e.kind === 'activity' && e.day === day && e.xp > 0 && !voided[e.key]; }).length;
  };

  // Validación de un apunte de experiencia (lanza un error claro). `structure` sirve para comprobar las subcategorías.
  // La experiencia se reparte con `shares` (porcentajes que suman 100) o con `points` (XP exacta por subcategoría).
  R.sanitizeEntry = function (input, structure, opts) {
    opts = opts || {};
    function bad(msg) { return App.storageError('invalid', msg); }
    if (!input || typeof input !== 'object') throw bad('El apunte no es válido.');
    var kind = input.kind;
    if (['manual', 'quest', 'achievement', 'adjustment', 'activity', 'diary', 'rested'].indexOf(kind) < 0) throw bad('El tipo de apunte no es válido.');
    var key = String(input.key || '');
    if (!/^[A-Za-z0-9:_-]{3,80}$/.test(key)) throw bad('El apunte no tiene una clave válida.');
    var label = cleanText(input.label, R.LIMITS.label);
    if (!label) throw bad(kind === 'adjustment' ? 'Escribe qué estás corrigiendo.' : 'Escribe qué has hecho.');
    var reason = cleanText(input.reason, R.LIMITS.reason);
    if (kind === 'adjustment' && !reason) throw bad('Un ajuste necesita un motivo.');
    var xp = Number(input.xp);
    // Con 0 XP solo valen las actividades y tareas que llegan después del tope del día (`capped`): se registran sin XP.
    var capped = input.capped === true && (kind === 'activity' || kind === 'quest');
    if (!isFinite(xp) || Math.floor(xp) !== xp || (xp === 0 && !capped) || (capped && xp < 0)) throw bad('La experiencia debe ser un número entero distinto de 0.');
    if (kind === 'diary' && (xp !== R.DIARY_XP || !R.isDiaryXpKey(key))) throw bad('El apunte del diario no es válido.');
    if (kind === 'rested' && (xp !== C.rested.xp || !/^rested:act:/.test(key))) throw bad('La XP descansada no es válida.');
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
    if (xp === 0 || kind === 'diary') splits = [];   // sin XP no hay nada que repartir; el diario va solo al nivel general
    else if (Array.isArray(input.points)) {
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
    if (capped && xp === 0) out.capped = true;
    if (typeof input.quest === 'string' && /^[A-Za-z0-9_]{3,40}$/.test(input.quest)) out.quest = input.quest;
    if (kind === 'adjustment' && typeof input.reverses === 'string' && /^[A-Za-z0-9:_-]{3,80}$/.test(input.reverses)) out.reverses = input.reverses;
    return out;
  };
})(window.App = window.App || {});
