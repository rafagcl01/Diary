// Misiones diarias al azar: cada día (cambia a las 3:00, ver R.logicalDay) salen tres de la batería, de atributos
// distintos si se puede. Cada una es Pequeña (15) o Normal (30) y su XP va a su subcategoría; hacer las tres da
// +15 extra («¡Día completo!»). Hay tres cambios (dado) al día. Desmarcar quita su XP, salvo con el día completo.
// La batería son las de fábrica (R.DAILY_DEFAULTS) más las tuyas, menos las que elimines (Configuración).
// Se guarda en rpg/daily.json: { custom, removed, day, picks (copia de las tres del día), rerolls }.
// En el registro: misión = `daily:<día>:<misión>`, día completo = `daily:<día>`. Nada se cuenta dos veces.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/daily.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  R.DAILY_PER_DAY = 3;
  R.DAILY_REROLLS = 3;
  R.DAILY_BONUS_XP = 15;
  R.DAILY_LIMITS = { name: 90, custom: 150 };
  R.DAILY_SIZES = R.QUEST_SIZES.filter(function (z) { return z.id === 'pequena' || z.id === 'normal'; });
  R.DAILY_ID_RE = /^d[mc]_[a-z0-9_]{2,30}$/;

  function d(id, name, sub, size) { return { id: 'dm_' + id, name: name, sub: sub, size: size || 'pequena' }; }
  R.DAILY_DEFAULTS = [
    // Vitalidad
    d('flexiones', 'Haz 20 flexiones o sentadillas', 'fuerza'), d('estiramientos', 'Estira diez minutos al despertar', 'fuerza'),
    d('agua', 'Bebe dos litros de agua', 'salud'), d('fruta', 'Come dos piezas de fruta', 'salud'), d('sin_ultraprocesados', 'Pasa el día sin ultraprocesados', 'salud', 'normal'),
    d('pasos', 'Camina 8.000 pasos', 'resistencia', 'normal'), d('escaleras', 'Sube por las escaleras en lugar del ascensor', 'resistencia'),
    d('sin_pantallas', 'Deja las pantallas una hora antes de dormir', 'descanso', 'normal'), d('siesta', 'Descansa veinte minutos sin móvil', 'descanso'),
    d('mascarilla', 'Ponte una mascarilla o haz tu rutina de skincare completa', 'autocuidado'), d('bano', 'Date un baño o una ducha larga sin prisa', 'autocuidado'),
    // Espíritu
    d('documental', 'Ve un documental o un vídeo divulgativo', 'conocimiento'), d('articulo', 'Lee un artículo sobre algo que no conozcas', 'conocimiento'),
    d('cama', 'Haz la cama nada más levantarte', 'disciplina'), d('pendiente', 'Haz esa tarea que llevas días posponiendo', 'disciplina', 'normal'), d('pomodoro', 'Trabaja dos bloques de 25 minutos sin distracciones', 'disciplina'),
    d('tarot', 'Saca una carta del tarot y apunta qué te sugiere', 'brujeria'), d('luna', 'Mira en qué fase está la luna y escribe una intención', 'brujeria'), d('altar', 'Limpia u ordena tu altar o tu rincón especial', 'brujeria'),
    // Vínculos
    d('escribir_amistad', 'Escribe a una amistad con la que hace tiempo que no hablas', 'amistad', 'normal'), d('meme', 'Manda algo que te recuerde a una amistad', 'amistad'),
    d('detalle', 'Ten un detalle con tu pareja o con alguien a quien quieras', 'amor'), d('carta', 'Escribe una nota de cariño a alguien', 'amor'),
    d('llamar_familia', 'Llama a alguien de tu familia', 'familia'), d('foto_familia', 'Comparte una foto o un recuerdo con tu familia', 'familia'),
    d('escuchar', 'Ten una conversación sin mirar el móvil', 'conexion'), d('agradecer', 'Da las gracias a alguien por algo concreto', 'conexion'),
    // Aventura
    d('comida_nueva', 'Prueba una comida o una bebida nueva', 'experiencias'), d('ruta_nueva', 'Vuelve a casa por un camino distinto', 'experiencias'),
    d('preguntar', 'Haz una pregunta que te dé vergüenza hacer', 'valentia'), d('decir_no', 'Di que no a algo que no te apetece', 'valentia', 'normal'),
    d('sitio_nuevo', 'Entra en una tienda o un sitio en el que nunca hayas estado', 'exploracion'), d('mapa', 'Busca un lugar cercano que no conozcas y planea ir', 'exploracion'),
    // Creatividad
    d('boceto', 'Dibuja un boceto de lo que tengas delante', 'arte'), d('modelar', 'Dedica media hora a un proyecto creativo', 'arte', 'normal'),
    d('leer_20', 'Lee veinte páginas', 'lectura'), d('poema', 'Lee un poema o un relato corto', 'lectura'),
    d('pelicula_clasica', 'Ve una película que lleves tiempo queriendo ver', 'peliculas', 'normal'), d('corto', 'Ve un cortometraje', 'peliculas'),
    // Inteligencia
    d('acertijo', 'Resuelve un acertijo, un sudoku o un problema de lógica', 'logica'), d('ajedrez', 'Juega una partida de ajedrez o de un juego de estrategia', 'logica'),
    d('palabras', 'Aprende diez palabras nuevas en otro idioma', 'idioma'), d('serie_vo', 'Ve un capítulo en versión original con subtítulos', 'idioma'),
    d('explicar', 'Explícale a alguien algo que hayas aprendido', 'comunicacion'), d('opinion', 'Da tu opinión en una conversación aunque cueste', 'comunicacion'),
    // Yo futuro
    d('gastos', 'Apunta todos tus gastos de hoy', 'finanzas'), d('ahorro', 'Aparta algo de dinero para tus ahorros', 'finanzas'),
    d('portfolio', 'Mejora una pieza de tu portfolio o tu CV', 'carrera', 'normal'), d('oferta', 'Mira ofertas de empleo o haz un contacto profesional', 'carrera'),
    d('paso_meta', 'Da un paso pequeño hacia una meta importante', 'objetivos'), d('plan_semana', 'Escribe tus tres prioridades de mañana', 'objetivos')
  ];

  function randomInt(n) {
    if (n <= 1) return 0;
    var a = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) { crypto.getRandomValues(a); return a[0] % n; }
    return Math.floor(Math.random() * n);
  }
  function cleanCustom(m) {
    var name = R.cleanText(m && m.name, R.DAILY_LIMITS.name);
    if (!name || !m || !R.DAILY_ID_RE.test(m.id) || typeof m.sub !== 'string') return null;
    return { id: m.id, name: name, sub: m.sub, size: m.size === 'normal' ? 'normal' : 'pequena', custom: true };
  }
  // La batería que se usa: de fábrica (sin las eliminadas) + las tuyas, solo con subcategorías que existan y no estén archivadas.
  R.dailyCatalog = function (doc, structure) {
    doc = doc || {};
    var removed = Array.isArray(doc.removed) ? doc.removed : [];
    var all = R.DAILY_DEFAULTS.filter(function (m) { return removed.indexOf(m.id) < 0; }).map(function (m) { return Object.assign({ custom: false }, m); })
      .concat((Array.isArray(doc.custom) ? doc.custom : []).map(cleanCustom).filter(Boolean));
    return all.filter(function (m) { var f = R.findSub(structure, m.sub); return f && !f.sub.archived; });
  };
  function mainOf(structure, sub) { var f = R.findSub(structure, sub); return f ? f.main.id : ''; }
  // Elige al azar una misión del catálogo que no esté en `taken`, prefiriendo atributos que aún no salgan hoy.
  R.pickDaily = function (catalog, structure, taken) {
    var ids = taken.map(function (m) { return m.id; }), mains = taken.map(function (m) { return mainOf(structure, m.sub); });
    var free = catalog.filter(function (m) { return ids.indexOf(m.id) < 0; });
    var varied = free.filter(function (m) { return mains.indexOf(mainOf(structure, m.sub)) < 0; });
    var pool = varied.length ? varied : free;
    return pool.length ? pool[randomInt(pool.length)] : null;
  };
  function snapshot(m) { return { id: m.id, name: m.name, sub: m.sub, size: m.size }; }

  App.createDailyRepo = function (store, rpg) {
    var cache = null, pending = null;
    function ensure(doc) {
      if (doc && (typeof doc !== 'object' || Array.isArray(doc))) throw invalid('El archivo de misiones diarias está dañado. No lo toco; revísalo en GitHub.');
      doc = doc || {};
      return { custom: Array.isArray(doc.custom) ? doc.custom : [], removed: Array.isArray(doc.removed) ? doc.removed : [],
        day: typeof doc.day === 'string' ? doc.day : '', picks: Array.isArray(doc.picks) ? doc.picks : [], rerolls: Number(doc.rerolls) || 0 };
    }
    function load(force) {
      if (cache && !force) return Promise.resolve(cache);
      if (pending && !force) return pending;
      var p = store.readJson(PATH, null).then(function (doc) { cache = ensure(doc); pending = null; return cache; }, function (e) { pending = null; throw e; });
      pending = p;
      return p;
    }
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          var d0 = ensure(doc);
          result = change(d0, st);
          return Object.assign({ version: 1 }, d0);
        }, { fallback: null, message: message });
      }).then(function (written) { cache = ensure(written); return result; });
    }
    // Si las tres de hoy aún no están elegidas (o son de otro día), las elige y las guarda. Solo escribe si toca.
    function ensureToday() {
      return load().then(function (c) {
        if (c.day === R.logicalDay() && c.picks.length) return c;
        return mutate('Elige las misiones diarias', function (d0, st) {
          var today = R.logicalDay();
          if (d0.day === today && d0.picks.length) return;   // otro dispositivo se adelantó
          var cat = R.dailyCatalog(d0, st.structure), picks = [];
          for (var i = 0; i < R.DAILY_PER_DAY; i++) { var m = R.pickDaily(cat, st.structure, picks); if (m) picks.push(snapshot(m)); }
          d0.day = today; d0.picks = picks; d0.rerolls = 0;
        }).then(function () { return cache; });
      });
    }
    function keyOf(day, id) { return 'daily:' + day + ':' + id; }

    var api = {
      // Las tres de hoy con su estado: { day, rerollsLeft, complete (día completo), missions: [{ …, xp, done, main, subName }] }
      state: function () {
        return Promise.all([ensureToday(), rpg.state()]).then(function (r) {
          var c = r[0], st = r[1], byKey = {}; st.entries.forEach(function (e) { byKey[e.key] = e; });
          return {
            day: c.day, rerollsLeft: Math.max(0, R.DAILY_REROLLS - c.rerolls), complete: !!byKey['daily:' + c.day],
            missions: c.picks.map(function (m) {
              var f = R.findSub(st.structure, m.sub);
              return Object.assign({}, m, { xp: R.sizeXp(m.size), done: !!byKey[keyOf(c.day, m.id)], main: f ? f.main.name : '', subName: f ? f.sub.name : '', icon: f ? f.sub.icon : 'star' });
            })
          };
        });
      },
      // Marca una de hoy: su XP (una vez) y, si eran las tres, el premio del día. Devuelve los eventos.
      complete: function (id) {
        return Promise.all([ensureToday(), rpg.state()]).then(function (r) {
          var c = r[0], st = r[1], m = c.picks.filter(function (x) { return x.id === id; })[0];
          if (!m) throw invalid('Esa misión ya no es de hoy.');
          var f = R.findSub(st.structure, m.sub), shares = f && !f.sub.archived ? [{ sub: m.sub, pct: 100 }] : [];
          return rpg.addEntry({ kind: 'quest', key: keyOf(c.day, m.id), quest: m.id, label: m.name, xp: R.sizeXp(m.size), shares: shares, day: c.day }).then(function () {
            return rpg.state();
          }).then(function (st2) {
            var have = {}; st2.entries.forEach(function (e) { have[e.key] = true; });
            var all = c.picks.length === R.DAILY_PER_DAY && c.picks.every(function (x) { return have[keyOf(c.day, x.id)]; });
            if (!all || have['daily:' + c.day]) return [];
            return rpg.addEntry({ kind: 'quest', key: 'daily:' + c.day, quest: 'dia_completo', label: '¡Día completo!', xp: R.DAILY_BONUS_XP, shares: [], day: c.day })
              .then(function (res) { return res.duplicate ? [] : [{ type: 'daily', label: '¡Día completo!', xp: R.DAILY_BONUS_XP }]; });
          });
        });
      },
      // Desmarca una de hoy (su XP deja de contar). Con el día completo, quedan fijas.
      uncomplete: function (id) {
        return Promise.all([ensureToday(), rpg.state()]).then(function (r) {
          var c = r[0], st = r[1], key = keyOf(c.day, id);
          if (st.entries.some(function (e) { return e.key === 'daily:' + c.day; })) throw invalid('Ya has completado las tres de hoy: quedan fijas.');
          if (!st.entries.some(function (e) { return e.key === key; })) return [];
          return rpg.removeEntry(key).then(function () { return []; });
        });
      },
      // Cambia una de hoy (sin hacer) por otra al azar. Tres cambios al día.
      reroll: function (id) {
        return Promise.resolve().then(function () {
          return rpg.state().then(function (st0) {
            return mutate('Cambia una misión diaria', function (d0, st) {
              if (d0.day !== R.logicalDay()) throw invalid('Las misiones de hoy han cambiado: recarga la página.');
              if (d0.rerolls >= R.DAILY_REROLLS) throw invalid('Ya has usado los ' + R.DAILY_REROLLS + ' cambios de hoy.');
              var i = -1; d0.picks.forEach(function (x, n) { if (x.id === id) i = n; });
              if (i < 0) throw invalid('Esa misión ya no es de hoy.');
              if (st0.entries.some(function (e) { return e.key === keyOf(d0.day, id); })) throw invalid('Esa misión ya está hecha: desmárcala para poder cambiarla.');
              var others = d0.picks.filter(function (x, n) { return n !== i; });
              var m = R.pickDaily(R.dailyCatalog(d0, st.structure).filter(function (x) { return x.id !== id; }), st.structure, others);
              if (!m) throw invalid('No quedan más misiones para cambiar. Añade alguna en Configuración.');
              d0.picks[i] = snapshot(m); d0.rerolls += 1;
              return d0.picks[i];
            });
          });
        });
      },

      // ---- La batería (Configuración) ----
      catalog: function () {
        return Promise.all([load(), rpg.state()]).then(function (r) {
          return { missions: R.dailyCatalog(r[0], r[1].structure), removedDefaults: r[0].removed.filter(function (id) { return R.DAILY_DEFAULTS.some(function (m) { return m.id === id; }); }).length };
        });
      },
      addCustom: function (input) {
        return Promise.resolve().then(function () {
          return mutate('Añade una misión diaria', function (d0, st) {
            var name = R.cleanText(input && input.name, R.DAILY_LIMITS.name);
            if (!name) throw invalid('Escribe la misión.');
            var f = R.findSub(st.structure, input.sub);
            if (!f) throw invalid('Elige una subcategoría.');
            if (d0.custom.length >= R.DAILY_LIMITS.custom) throw invalid('Ya tienes el máximo de misiones propias.');
            var key = R.fold(name);
            if (R.dailyCatalog(d0, st.structure).some(function (m) { return R.fold(m.name) === key; })) throw invalid('Ya hay una misión con ese nombre.');
            var m = { id: 'dc_' + R.newSubId().slice(3), name: name, sub: input.sub, size: input.size === 'normal' ? 'normal' : 'pequena' };
            d0.custom.push(m); return m;
          });
        });
      },
      // Elimina de la batería: las tuyas se borran; las de fábrica quedan apartadas (se pueden recuperar).
      // Si hoy ya ha salido, sigue hasta mañana.
      removeMission: function (id) {
        return Promise.resolve().then(function () {
          return mutate('Elimina una misión diaria', function (d0) {
            var n = d0.custom.length;
            d0.custom = d0.custom.filter(function (m) { return m.id !== id; });
            if (d0.custom.length !== n) return true;
            if (!R.DAILY_DEFAULTS.some(function (m) { return m.id === id; })) throw invalid('Esa misión ya no existe.');
            if (d0.removed.indexOf(id) < 0) d0.removed.push(id);
            return true;
          });
        });
      },
      restoreDefaults: function () {
        return Promise.resolve().then(function () { return mutate('Recupera las misiones diarias de fábrica', function (d0) { d0.removed = []; }); });
      }
    };
    return api;
  };

  R.isDailyKey = function (key) { return /^daily:\d{4}-\d{2}-\d{2}:d[mc]_[a-z0-9_]{2,30}$/.test(String(key)); };

  var current = { store: null, repo: null };
  R.daily = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createDailyRepo(store, rpg) };
    return current.repo;
  };
})(window.App = window.App || {});
