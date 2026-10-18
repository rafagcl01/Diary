// Sombras: cosas que vuelven y no quieres que manden (insomnio, rumiar, el móvil a deshoras).
//  - Apuntar que una sombra apareció NUNCA quita XP, ni da: las sombras no tocan el registro de XP.
//  - Cada sombra tiene sus contrahechizos (actividades). Una aparición queda «purificada» si ese día o el siguiente
//    registras uno de ellos. No se guarda: se calcula con el registro de XP (borrar el contrahechizo la deja sin purificar).
//    Purificar no da XP extra: el contrahechizo da sus 5 XP de siempre.
//  - Una aparición por sombra y día lógico (el día acaba a las 3:00, ver R.logicalDay). Su clave es `sh:<sombra>:<día>`.
//  - Con 4 apariciones en 14 días se ofrece convertirla en jefe; «Ahora no» la esconde hasta que vuelva a pasar.
//  - Desde el diario: en la ventana de Actividades de una entrada, «Sombras de hoy». Al guardar la página se apuntan
//    para el día de la página; quitarlas de la entrada borra la aparición (no hay XP en juego, así que no se pregunta).
// Se guarda en rpg/shadows.json: { version, shadows: [{ id, name, icon, counters, archived, createdAt, offerFrom }],
// appearances: [{ shadow, day, at, from: 'ficha' | 'diario' }] }.
(function (App) {
  var R = App.rpg;
  var PATH = 'rpg/shadows.json';
  function invalid(msg) { return App.storageError('invalid', msg); }
  R.SHADOW_LIMITS = { name: 40, count: 30, counters: 8, appearances: 3000 };
  R.SHADOW_ID_RE = /^sh_[0-9a-f]{8}$/;
  R.SHADOW_OFFER = { count: 4, days: 14 };   // apariciones en días para ofrecer convertirla en jefe
  R.SHADOW_STRIP = 14;                       // días de la tira de cada tarjeta
  R.newShadowId = function () { return 'sh_' + R.newSubId().slice(3); };
  R.shadowKey = function (id, day) { return 'sh:' + id + ':' + day; };
  function isDay(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d); }

  // Valida una sombra (lanza un error claro). `acts` = lista de actividades, para comprobar los contrahechizos.
  R.sanitizeShadow = function (input, acts, base) {
    if (!input || typeof input !== 'object') throw invalid('La sombra no es válida.');
    var name = R.cleanText(input.name, R.SHADOW_LIMITS.name);
    if (!name) throw invalid('Ponle un nombre a la sombra.');
    var icon = R.isIcon(input.icon) ? input.icon : null;
    if (!icon) throw invalid('Elige un icono de la galería.');
    var known = {}; (acts || []).forEach(function (a) { known[a.id] = a; });
    var seen = {}, counters = [];
    (Array.isArray(input.counters) ? input.counters : []).forEach(function (id) {
      if (typeof id !== 'string' || !R.ACT_ID_RE.test(id) || id === 'puntual' || seen[id]) return;
      if (!known[id]) throw invalid('Uno de los contrahechizos ya no existe.');
      seen[id] = true; counters.push(id);
    });
    if (!counters.length) throw invalid('Elige al menos un contrahechizo: la actividad que la purifica.');
    if (counters.length > R.SHADOW_LIMITS.counters) throw invalid('Como mucho ' + R.SHADOW_LIMITS.counters + ' contrahechizos.');
    return { id: base && base.id ? base.id : R.newShadowId(), name: name, icon: icon, counters: counters,
      archived: !!(input.archived === undefined ? base && base.archived : input.archived),
      createdAt: base && base.createdAt ? base.createdAt : new Date().toISOString(), offerFrom: base && isDay(base.offerFrom) ? base.offerFrom : null };
  };

  // Lee el archivo con tolerancia: lo que no se entiende se descarta (el archivo dañado del todo se rechaza en el repositorio).
  R.buildShadows = function (doc) {
    var ids = {}, seen = {};
    var shadows = (doc && Array.isArray(doc.shadows) ? doc.shadows : []).filter(function (s) {
      if (!s || !R.SHADOW_ID_RE.test(s.id) || ids[s.id] || !R.cleanText(s.name, R.SHADOW_LIMITS.name)) return false;
      ids[s.id] = true; return true;
    }).map(function (s) {
      return { id: s.id, name: R.cleanText(s.name, R.SHADOW_LIMITS.name), icon: R.isIcon(s.icon) ? s.icon : 'moon',
        counters: (Array.isArray(s.counters) ? s.counters : []).filter(function (c) { return typeof c === 'string' && R.ACT_ID_RE.test(c); }),
        archived: s.archived === true, createdAt: typeof s.createdAt === 'string' ? s.createdAt : '', offerFrom: isDay(s.offerFrom) ? s.offerFrom : null };
    });
    var appearances = (doc && Array.isArray(doc.appearances) ? doc.appearances : []).filter(function (a) {
      if (!a || !ids[a.shadow] || !isDay(a.day)) return false;
      var k = R.shadowKey(a.shadow, a.day);
      if (seen[k]) return false;
      seen[k] = true; return true;
    }).map(function (a) { return { shadow: a.shadow, day: a.day, at: typeof a.at === 'string' ? a.at : '', from: a.from === 'diario' ? 'diario' : 'ficha' }; });
    return { shadows: shadows, appearances: appearances };
  };
  R.shadowsToDoc = function (data) { return { version: 1, shadows: data.shadows, appearances: data.appearances }; };

  // Días (de calendario) en que se registró cada contrahechizo: { actividad: { día: true } }. Lo anulado no cuenta.
  function counterDays(entries) {
    var voided = R.voidedKeys(entries || []), out = {};
    (entries || []).forEach(function (e) {
      if (!e || e.kind !== 'activity' || voided[e.key] || !e.activity) return;
      (out[e.activity] = out[e.activity] || {})[e.day] = true;
    });
    return out;
  }
  // ¿Está purificada la aparición del día `day`? Sí, si ese día o el siguiente hay uno de sus contrahechizos.
  R.shadowPurified = function (shadow, day, entries, days) {
    days = days || counterDays(entries);
    var next = R.shiftDay(day, 1);
    return shadow.counters.some(function (id) { var d = days[id]; return !!(d && (d[day] || d[next])); });
  };

  // Estado de una sombra para pintarla. today = día lógico de hoy.
  R.shadowView = function (shadow, appearances, entries, today, days) {
    days = days || counterDays(entries);
    var mine = appearances.filter(function (a) { return a.shadow === shadow.id; });
    var byDay = {}; mine.forEach(function (a) { byDay[a.day] = a; });
    var strip = [];
    for (var i = R.SHADOW_STRIP - 1; i >= 0; i--) {
      var d = R.shiftDay(today, -i), ap = byDay[d];
      strip.push({ day: d, state: !ap ? 'none' : R.shadowPurified(shadow, d, null, days) ? 'ok' : 'ap' });
    }
    var month = today.slice(0, 7), inMonth = mine.filter(function (a) { return a.day.slice(0, 7) === month; });
    var since = R.shiftDay(today, -(R.SHADOW_OFFER.days - 1));
    var recent = mine.filter(function (a) { return a.day >= since && a.day <= today && (!shadow.offerFrom || a.day > shadow.offerFrom); }).length;
    var t = byDay[today];
    return Object.assign({}, shadow, {
      strip: strip,
      monthCount: inMonth.length,
      monthPurified: inMonth.filter(function (a) { return R.shadowPurified(shadow, a.day, null, days); }).length,
      today: t ? { from: t.from, purified: R.shadowPurified(shadow, today, null, days) } : null,
      recentCount: mine.filter(function (a) { return a.day >= since && a.day <= today; }).length,
      offer: !shadow.archived && recent >= R.SHADOW_OFFER.count
    });
  };

  // El glitch del avatar: 'glitch' si hay una aparición de hoy o de ayer sin purificar; 'calm' si alguna de hoy o de
  // ayer se ha purificado con un contrahechizo de hoy (queda calmado el resto del día); si no, null.
  // `now` = día de calendario (los contrahechizos se fechan así); por defecto, hoy.
  R.shadowAura = function (shadows, appearances, entries, today, now) {
    var days = counterDays(entries), yesterday = R.shiftDay(today, -1), calm = false, glitch = false;
    now = now || R.today();
    var byId = {}; shadows.forEach(function (s) { byId[s.id] = s; });
    appearances.forEach(function (a) {
      var s = byId[a.shadow];
      if (!s || s.archived || (a.day !== today && a.day !== yesterday)) return;
      if (!R.shadowPurified(s, a.day, null, days)) { glitch = true; return; }
      // Los días que la purifican (el suyo y el siguiente) que son hoy: un contrahechizo en uno de ellos la calma hoy.
      var mine = [a.day, R.shiftDay(a.day, 1)].filter(function (x) { return x >= now; });
      if (s.counters.some(function (id) { var d = days[id]; return d && mine.some(function (x) { return d[x]; }); })) calm = true;
    });
    return glitch ? 'glitch' : calm ? 'calm' : null;
  };

  // Frecuencia por mes (los `count` últimos, del más antiguo al actual). id = una sombra o null para todas.
  // Devuelve [{ key: 'AAAA-MM', purified, open }].
  R.shadowStats = function (shadows, appearances, entries, today, id, count) {
    count = count || 6;
    var days = counterDays(entries), byId = {}, keys = [];
    shadows.forEach(function (s) { byId[s.id] = s; });
    var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
    for (var i = count - 1; i >= 0; i--) {
      var mm = m - i, yy = y;
      while (mm < 1) { mm += 12; yy--; }
      keys.push(yy + '-' + ('0' + mm).slice(-2));
    }
    var out = keys.map(function (k) { return { key: k, purified: 0, open: 0 }; }), idx = {};
    keys.forEach(function (k, i2) { idx[k] = out[i2]; });
    appearances.forEach(function (a) {
      var s = byId[a.shadow], row = idx[a.day.slice(0, 7)];
      if (!s || !row || (id && a.shadow !== id)) return;
      if (R.shadowPurified(s, a.day, null, days)) row.purified++; else row.open++;
    });
    return out;
  };

  App.createShadowRepo = function (store, rpg, acts) {
    var cache = null, pending = null;
    function ensure(doc) {
      if (doc && (typeof doc !== 'object' || (doc.shadows !== undefined && !Array.isArray(doc.shadows)) || (doc.appearances !== undefined && !Array.isArray(doc.appearances)))) {
        throw invalid('El archivo de sombras está dañado. No lo toco; revísalo en GitHub.');
      }
      return R.buildShadows(doc);
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
      return store.updateJson(PATH, function (doc) {
        var data = ensure(doc);
        result = change(data);
        return R.shadowsToDoc(data);
      }, { fallback: null, message: message }).then(function (written) { cache = R.buildShadows(written); return result; });
    }
    function find(data, id) { var s = data.shadows.filter(function (x) { return x.id === id; })[0]; if (!s) throw invalid('Esa sombra ya no existe.'); return s; }
    function duplicate(data, name, exceptId) {
      var k = R.fold(name);
      return data.shadows.some(function (s) { return s.id !== exceptId && !s.archived && R.fold(s.name) === k; });
    }
    function actList() { return acts ? acts.list() : Promise.resolve([]); }

    var api = {
      // { shadows (activas, con su vista), archived, appearances, aura, today }
      state: function (force) {
        return Promise.all([load(force), rpg.state()]).then(function (r) {
          var data = r[0], entries = r[1].entries, today = R.logicalDay(), days = counterDays(entries);
          var views = data.shadows.map(function (s) { return R.shadowView(s, data.appearances, entries, today, days); });
          return { shadows: views.filter(function (s) { return !s.archived; }), archived: views.filter(function (s) { return s.archived; }),
            all: data.shadows, appearances: data.appearances, entries: entries, today: today,
            aura: R.shadowAura(data.shadows, data.appearances, entries, today) };
        });
      },
      create: function (input) {
        return actList().then(function (list) {
          return mutate('Crea una sombra', function (data) {
            if (data.shadows.length >= R.SHADOW_LIMITS.count) throw invalid('Ya tienes el máximo de sombras.');
            var s = R.sanitizeShadow(Object.assign({}, input, { archived: false }), list, null);
            if (duplicate(data, s.name, null)) throw invalid('Ya tienes una sombra con ese nombre.');
            data.shadows.push(s); return s;
          });
        });
      },
      update: function (id, input) {
        return actList().then(function (list) {
          return mutate('Edita una sombra', function (data) {
            var old = find(data, id), s = R.sanitizeShadow(input, list, old);
            if (duplicate(data, s.name, id)) throw invalid('Ya tienes una sombra con ese nombre.');
            data.shadows = data.shadows.map(function (x) { return x.id === id ? s : x; }); return s;
          });
        });
      },
      // Archivar la esconde; sus apariciones (el historial) se quedan.
      setArchived: function (id, archived) {
        return mutate(archived ? 'Archiva una sombra' : 'Recupera una sombra', function (data) { var s = find(data, id); s.archived = !!archived; return s; });
      },
      // Apunta que apareció (una vez por día). Devuelve { duplicate }.
      appear: function (id, day, from) {
        day = isDay(day) ? day : R.logicalDay();
        return mutate('Apunta una sombra', function (data) {
          var s = find(data, id);
          if (s.archived) throw invalid('Esa sombra está archivada.');
          if (data.appearances.some(function (a) { return a.shadow === id && a.day === day; })) return { duplicate: true };
          if (data.appearances.length >= R.SHADOW_LIMITS.appearances) throw invalid('Hay demasiadas apariciones guardadas.');
          data.appearances.push({ shadow: id, day: day, at: new Date().toISOString(), from: from === 'diario' ? 'diario' : 'ficha' });
          return { duplicate: false };
        });
      },
      // Borra la aparición de un día (si la había).
      unappear: function (id, day) {
        return mutate('Quita una sombra', function (data) {
          var n = data.appearances.length;
          data.appearances = data.appearances.filter(function (a) { return !(a.shadow === id && a.day === day); });
          return { removed: data.appearances.length !== n };
        });
      },
      // «Ahora no» (o «Convertir en jefe»): la oferta se esconde hasta que haya otras 4 apariciones desde hoy.
      dismissOffer: function (id) {
        return mutate('Esconde la oferta de jefe', function (data) { var s = find(data, id); s.offerFrom = R.logicalDay(); return s; });
      },
      // Tras guardar (o borrar) una página del diario: las sombras de sus entradas quedan apuntadas para ese día y las
      // que ya no están en ninguna entrada se borran. Una sola escritura. Devuelve { added: [nombres], removed: [nombres] }.
      syncDiary: function (day, before, after) {
        function ids(blocks) { var o = {}; (blocks || []).forEach(function (b) { (b.shadows || []).forEach(function (r) { if (r && R.SHADOW_ID_RE.test(r.id)) o[r.id] = true; }); }); return o; }
        var was = ids(before), now = ids(after), out = { added: [], removed: [] };
        if (!Object.keys(was).length && !Object.keys(now).length) return Promise.resolve(out);
        return load().then(function (data) {
          var have = {}; data.appearances.forEach(function (a) { if (a.day === day) have[a.shadow] = true; });
          var add = Object.keys(now).filter(function (id) { return !have[id] && data.shadows.some(function (s) { return s.id === id && !s.archived; }); });
          var rm = Object.keys(was).filter(function (id) { return !now[id] && have[id]; });
          if (!add.length && !rm.length) return out;
          return mutate('Apunta las sombras del diario', function (d2) {
            var names = {}; d2.shadows.forEach(function (s) { names[s.id] = s.name; });
            add.forEach(function (id) {
              if (d2.appearances.some(function (a) { return a.shadow === id && a.day === day; })) return;
              d2.appearances.push({ shadow: id, day: day, at: new Date().toISOString(), from: 'diario' }); out.added.push(names[id]);
            });
            d2.appearances = d2.appearances.filter(function (a) {
              var drop = a.day === day && rm.indexOf(a.shadow) >= 0;
              if (drop) out.removed.push(names[a.shadow]);
              return !drop;
            });
            return out;
          });
        });
      }
    };
    return api;
  };

  // Quita la aparición de un día desde la ficha («Deshacer»). Si venía de una entrada del diario, también se quita de esa
  // entrada (y de su borrador): si no, al volver a guardar la página volvería a aparecer.
  R.removeShadowAppearance = function (id, day) {
    var sh = R.shadows();
    if (!sh) return Promise.reject(invalid('Conecta tus datos.'));
    return R.unlinkDiaryShadow(day, id).catch(function () {}).then(function () { return sh.unappear(id, day); });
  };
  R.unlinkDiaryShadow = function (day, id) {
    var D = App.diary, repo = D && D.repo ? D.repo() : null;
    function strip(blocks) {
      var changed = false;
      var out = (blocks || []).map(function (b) {
        if (!(b.shadows || []).some(function (r) { return r.id === id; })) return b;
        changed = true;
        return Object.assign({}, b, { shadows: b.shadows.filter(function (r) { return r.id !== id; }) });
      });
      return changed ? out : null;
    }
    if (App.drafts) {
      var draft = App.drafts.get(day), db = draft && strip(draft.blocks);
      if (db) App.drafts.save(day, { title: draft.title, favorite: draft.favorite, blocks: db });
    }
    if (!repo) return Promise.resolve();
    return repo.get(day).then(function (entry) {
      var blocks = entry && strip(entry.blocks);
      if (!blocks) return;
      if (!entry.title && !blocks.some(D.blockHasContent)) return repo.remove(day);
      return repo.save(Object.assign({}, entry, { blocks: blocks }), { base: entry.updatedAt });
    });
  };

  var current = { store: null, repo: null };
  R.shadows = function () {
    var store = App.connection.getStore(), rpg = R.repo();
    if (!store || !rpg) return null;
    if (current.store !== store) current = { store: store, repo: App.createShadowRepo(store, rpg, R.activities ? R.activities() : null) };
    return current.repo;
  };
})(window.App = window.App || {});
