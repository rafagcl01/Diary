// Actividades: la forma más sencilla (y la que menos XP da) de avanzar. Cada una da como máximo 5 XP,
// en puntos enteros repartidos entre subcategorías (por ejemplo, Leer: 2 Lectura + 3 Conocimiento).
// Vienen unas predefinidas; el usuario puede crear las suyas, editarlas y archivarlas. Se guardan en rpg/activities.json.
// Al registrar una, el apunte guarda una copia de sus puntos: cambiar la actividad después no cambia el pasado.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/activities.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  function pts() { var a = []; for (var i = 0; i < arguments.length; i += 2) a.push({ sub: arguments[i], xp: arguments[i + 1] }); return a; }

  R.DEFAULT_ACTIVITIES = [
    { id: 'gimnasio', name: 'Ir al gimnasio', icon: 'dumbbell', points: pts('fuerza', 3, 'disciplina', 2) },
    { id: 'cardio', name: 'Caminar o correr', icon: 'bolt', points: pts('resistencia', 4, 'salud', 1) },
    { id: 'comer-bien', name: 'Comer y beber bien', icon: 'leaf', points: pts('salud', 4, 'disciplina', 1) },
    { id: 'dormir-bien', name: 'Dormir bien', icon: 'moon', points: pts('descanso', 5) },
    { id: 'skincare', name: 'Rutina de skincare', icon: 'mirror', points: pts('autocuidado', 4, 'disciplina', 1) },
    { id: 'arreglarme', name: 'Arreglarme (pelo, uñas, ropa)', icon: 'mirror', points: pts('autocuidado', 5) },
    { id: 'estudiar', name: 'Estudiar un rato', icon: 'book', points: pts('conocimiento', 3, 'disciplina', 2) },
    { id: 'leer-libro', name: 'Leer un libro', icon: 'book', points: pts('lectura', 2, 'conocimiento', 3) },
    { id: 'leer-comic', name: 'Leer un cómic o manga', icon: 'book', points: pts('lectura', 5) },
    { id: 'tarot', name: 'Tirada de tarot o ritual', icon: 'tarot', points: pts('brujeria', 5) },
    { id: 'meditar', name: 'Meditar', icon: 'cloud', points: pts('disciplina', 3, 'descanso', 2) },
    { id: 'amigos', name: 'Quedar con amigos', icon: 'butterfly', points: pts('amistad', 3, 'conexion', 2) },
    { id: 'familia', name: 'Pasar tiempo con la familia', icon: 'locket', points: pts('familia', 3, 'conexion', 2) },
    { id: 'pareja', name: 'Tiempo con mi pareja', icon: 'rose', points: pts('amor', 4, 'conexion', 1) },
    { id: 'plan-nuevo', name: 'Hacer un plan nuevo', icon: 'sun', points: pts('experiencias', 3, 'exploracion', 2) },
    { id: 'lugar-nuevo', name: 'Visitar un lugar nuevo', icon: 'compass', points: pts('exploracion', 4, 'experiencias', 1) },
    { id: 'miedo', name: 'Hacer algo que da miedo', icon: 'candle', points: pts('valentia', 5) },
    { id: 'dibujar', name: 'Dibujar, esculpir o modelar', icon: 'pencil', points: pts('arte', 4, 'disciplina', 1) },
    { id: 'pelicula', name: 'Ver una película', icon: 'film', points: pts('peliculas', 4, 'experiencias', 1) }
  ];
  R.ACTIVITY_LIMITS = { name: 40, count: 120 };
  R.newActivityId = function () { return 'ac_' + R.newSubId().slice(3); };

  // Valida una actividad (lanza un error claro). Los puntos van en enteros ≥1 y suman de 1 a 5.
  R.sanitizeActivity = function (input, structure, base) {
    if (!input || typeof input !== 'object') throw invalid('La actividad no es válida.');
    var name = R.cleanText(input.name, R.ACTIVITY_LIMITS.name);
    if (!name) throw invalid('Ponle un nombre a la actividad.');
    var icon = R.isIcon(input.icon) ? input.icon : null;
    if (!icon) throw invalid('Elige un icono de la galería.');
    var total = 0, seen = {};
    var points = (input.points || []).map(function (p) {
      var v = Number(p && p.xp);
      if (!isFinite(v) || Math.floor(v) !== v || v < 1) throw invalid('Los puntos deben ser números enteros de 1 en adelante.');
      if (!R.findSub(structure, p.sub)) throw invalid('Esa subcategoría no existe.');
      if (seen[p.sub]) throw invalid('Una subcategoría aparece dos veces.');
      seen[p.sub] = true; total += v;
      return { sub: p.sub, xp: v };
    });
    if (!points.length) throw invalid('Elige al menos una subcategoría.');
    if (total > R.ACTIVITY_MAX) throw invalid('Una actividad da como máximo ' + R.ACTIVITY_MAX + ' XP en total (ahora suma ' + total + ').');
    return { id: base && base.id ? base.id : R.newActivityId(), name: name, icon: icon, points: points, archived: !!(input.archived === undefined ? (base && base.archived) : input.archived) };
  };

  // Lista de actividades con las predefinidas: lo guardado manda; las de fábrica que falten vuelven (solo se archivan, no se pierden).
  R.buildActivities = function (doc) {
    var saved = doc && Array.isArray(doc.activities) ? doc.activities : [];
    var out = [], ids = {};
    saved.forEach(function (a) {
      if (!a || typeof a.id !== 'string' || !R.ACT_ID_RE.test(a.id) || ids[a.id]) return;
      var name = R.cleanText(a.name, R.ACTIVITY_LIMITS.name);
      var points = Array.isArray(a.points) ? a.points.filter(function (p) { return p && typeof p.sub === 'string' && Number.isInteger(p.xp) && p.xp >= 1; }).map(function (p) { return { sub: p.sub, xp: p.xp }; }) : [];
      if (!name) return;
      ids[a.id] = true;
      out.push({ id: a.id, name: name, icon: R.isIcon(a.icon) ? a.icon : 'star', points: points, archived: a.archived === true });
    });
    R.DEFAULT_ACTIVITIES.forEach(function (d) {
      if (!ids[d.id]) out.push({ id: d.id, name: d.name, icon: d.icon, points: d.points.map(function (p) { return { sub: p.sub, xp: p.xp }; }), archived: false });
    });
    return out;
  };
  R.activitiesToDoc = function (list) { return { version: 1, activities: list.map(function (a) { return { id: a.id, name: a.name, icon: a.icon, points: a.points, archived: !!a.archived }; }) }; };
  R.activityXp = function (a) { return a.points.reduce(function (t, p) { return t + p.xp; }, 0); };

  App.createActivityRepo = function (store, rpg) {
    var cache = null;
    function load(force) {
      if (cache && !force) return Promise.resolve(cache);
      return store.readJson(PATH, null).then(function (doc) {
        if (doc && !Array.isArray(doc.activities)) throw invalid('El archivo de actividades está dañado. No lo toco; revísalo en GitHub.');
        cache = R.buildActivities(doc);
        return cache;
      });
    }
    function mutate(message, change) {
      var result;
      return rpg.state().then(function (st) {
        return store.updateJson(PATH, function (doc) {
          if (doc && !Array.isArray(doc.activities)) throw invalid('El archivo de actividades está dañado. No lo toco; revísalo en GitHub.');
          var list = R.buildActivities(doc);
          result = change(list, st.structure);
          return R.activitiesToDoc(list);
        }, { fallback: null, message: message });
      }).then(function () { return load(true); }).then(function () { return result; });
    }
    function duplicate(list, name, exceptId) {
      var k = R.fold(name);
      return list.some(function (a) { return a.id !== exceptId && !a.archived && R.fold(a.name) === k; });
    }

    return {
      list: function (force) { return load(force).then(function (l) { return l.slice(); }); },
      create: function (input) {
        return Promise.resolve().then(function () {
          return mutate('Crea una actividad', function (list, structure) {
            if (list.length >= R.ACTIVITY_LIMITS.count) throw invalid('Ya tienes el máximo de actividades.');
            var a = R.sanitizeActivity(Object.assign({}, input, { archived: false }), structure, null);
            if (duplicate(list, a.name, null)) throw invalid('Ya tienes una actividad con ese nombre.');
            list.push(a); return a;
          });
        });
      },
      update: function (id, input) {
        return Promise.resolve().then(function () {
          return mutate('Edita una actividad', function (list, structure) {
            var i = -1; list.forEach(function (x, n) { if (x.id === id) i = n; });
            if (i < 0) throw invalid('Esa actividad ya no existe.');
            var a = R.sanitizeActivity(input, structure, list[i]);
            if (duplicate(list, a.name, id)) throw invalid('Ya tienes una actividad con ese nombre.');
            list[i] = a; return a;
          });
        });
      },
      setArchived: function (id, archived) {
        return Promise.resolve().then(function () {
          return mutate(archived ? 'Archiva una actividad' : 'Recupera una actividad', function (list) {
            var a = list.filter(function (x) { return x.id === id; })[0];
            if (!a) throw invalid('Esa actividad ya no existe.');
            a.archived = !!archived; return a;
          });
        });
      },

      // Registra una actividad hecha el día `o.day` (hoy por defecto). `o.req` es la clave de este toque: repetirlo no suma otra vez.
      log: function (id, o) {
        o = o || {};
        return Promise.all([load(), rpg.state()]).then(function (r) {
          var a = r[0].filter(function (x) { return x.id === id; })[0];
          if (!a) throw invalid('Esa actividad ya no existe.');
          if (a.archived) throw invalid('Esa actividad está archivada.');
          return rpg.addEntry({ kind: 'activity', key: 'act:' + (o.req || R.newRequestId()), activity: a.id, label: a.name, xp: R.activityXp(a), points: a.points, day: o.day });
        });
      }
    };
  };

  var current = { store: null, repo: null };
  R.activities = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createActivityRepo(store, rpg) };
    return current.repo;
  };
})(window.App = window.App || {});
