// Personas: fichas guardadas en people.json. Cada entrada del diario se vincula a una persona por su identificador
// (blocks[].people = ["pe_…"]), nunca por su nombre: renombrar a alguien no rompe ningún vínculo.
// Este módulo no puntúa ni ordena a las personas por "importancia": solo guarda y busca.
(function (App) {
  var D = App.diary;
  var PATH = 'people.json';
  var LIMITS = { name: 60, nickname: 40, nicknames: 10, relation: 40, notes: 5000, tags: 20, highlights: 50, count: 500 };
  var BLOCK_ID_RE = /^b_[0-9a-f]{8}$/;
  var MET_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
  D.PEOPLE_LIMITS = LIMITS;

  function invalid(msg) { return App.storageError('invalid', msg); }
  function skipKey(k) { return k === '__proto__' || k === 'constructor' || k === 'prototype'; }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  D.personKey = function (name) { return D.fold(clean(name)); };

  D.newPersonId = function () {
    var a = new Uint8Array(4);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return 'pe_' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  };

  // Fecha aproximada en que conociste a la persona: "2019", "2019-05" o "2019-05-14" (o vacía).
  D.cleanMet = function (raw) {
    var met = clean(raw);
    if (!met) return '';
    if (!MET_RE.test(met)) throw invalid('La fecha aproximada debe ser un año (2019), un mes (2019-05) o un día (2019-05-14).');
    var year = +met.slice(0, 4), month = met.length >= 7 ? +met.slice(5, 7) : 1;
    if (year < 1900 || month < 1 || month > 12) throw invalid('Esa fecha no existe.');
    if (met.length === 10 && !D.isDay(met)) throw invalid('Esa fecha no existe.');
    var today = D.today();
    if (met.slice(0, Math.min(met.length, 10)) > today.slice(0, met.length)) throw invalid('Esa fecha todavía no ha llegado.');
    return met;
  };
  D.formatMet = function (met) {
    if (!met) return '';
    if (met.length === 4) return met;
    if (met.length === 7) return D.formatMonth(met);
    return D.formatLong(met);
  };

  function cleanNicknames(list, name) {
    var seen = {}, out = [], self = D.personKey(name);
    (Array.isArray(list) ? list : []).forEach(function (n) {
      var c = clean(n);
      if (!c) return;
      if (c.length > LIMITS.nickname) throw invalid('Un apodo es demasiado largo (máximo ' + LIMITS.nickname + ' caracteres).');
      var k = D.personKey(c);
      if (k !== self && !seen[k]) { seen[k] = true; out.push(c); }
    });
    if (out.length > LIMITS.nicknames) throw invalid('Demasiados apodos (máximo ' + LIMITS.nicknames + ').');
    return out;
  }
  function cleanHighlights(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (h) {
      if (!h || typeof h !== 'object' || !D.isDay(h.day) || typeof h.block !== 'string' || !BLOCK_ID_RE.test(h.block)) return;
      var k = h.day + '#' + h.block;
      if (!seen[k]) { seen[k] = true; out.push({ day: h.day, block: h.block }); }
    });
    return out.slice(0, LIMITS.highlights);
  }

  // Valida una persona (lanza un error claro). Conserva campos desconocidos.
  D.sanitizePerson = function (input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('La ficha no es válida.');
    var out = {};
    Object.keys(input).forEach(function (k) { if (!skipKey(k)) out[k] = input[k]; });
    if (out.id === undefined || out.id === null) out.id = D.newPersonId();
    if (typeof out.id !== 'string' || !D.PERSON_ID_RE.test(out.id)) throw invalid('El identificador de la persona no es válido.');
    out.name = clean(out.name);
    if (!out.name) throw invalid('Ponle un nombre a la ficha.');
    if (out.name.length > LIMITS.name) throw invalid('El nombre es demasiado largo (máximo ' + LIMITS.name + ' caracteres).');
    out.nicknames = cleanNicknames(out.nicknames, out.name);
    out.symbol = D.isSymbol(out.symbol) ? out.symbol : null;
    out.met = D.cleanMet(out.met);
    out.relation = clean(out.relation);
    if (out.relation.length > LIMITS.relation) throw invalid('La relación es demasiado larga (máximo ' + LIMITS.relation + ' caracteres).');
    out.notes = typeof out.notes === 'string' ? out.notes.replace(/\r\n/g, '\n').trim() : '';
    if (out.notes.length > LIMITS.notes) throw invalid('Las notas son demasiado largas (máximo ' + LIMITS.notes + ' caracteres).');
    out.tags = D.uniqueTags(out.tags);
    out.highlights = cleanHighlights(out.highlights);
    var now = new Date().toISOString();
    out.createdAt = typeof out.createdAt === 'string' && !isNaN(Date.parse(out.createdAt)) ? out.createdAt : now;
    out.updatedAt = typeof out.updatedAt === 'string' && !isNaN(Date.parse(out.updatedAt)) ? out.updatedAt : now;
    return out;
  };
  D.normalizePersonLoaded = function (raw) { try { return D.sanitizePerson(raw); } catch (e) { return null; } };

  D.personMap = function (list) {
    var map = {};
    (list || []).forEach(function (p) { map[p.id] = p; });
    return map;
  };
  // Cómo se distingue una persona de otra con el mismo nombre: su relación.
  D.personLabel = function (p) { return p.name + (p.relation ? ' (' + p.relation + ')' : ''); };
  D.personInitial = function (p) {
    var m = /[A-Za-zÀ-ÿ0-9]/.exec(p.name || '');
    return m ? m[0].toUpperCase() : '·';
  };

  // ---- Búsqueda (nombre, apodos, relación y etiquetas; sin importar tildes ni mayúsculas) ----
  D.searchPeople = function (list, text) {
    var terms = D.fold(text || '').split(/\s+/).filter(Boolean);
    var found = list.filter(function (p) {
      if (!terms.length) return true;
      var hay = D.fold([p.name].concat(p.nicknames, [p.relation], p.tags).join(' '));
      return terms.every(function (t) { return hay.indexOf(t) >= 0; });
    });
    var first = terms[0] || '';
    return found.slice().sort(function (a, b) {
      var sa = D.personKey(a.name).indexOf(first) === 0 ? 0 : 1, sb = D.personKey(b.name).indexOf(first) === 0 ? 0 : 1;
      if (sa !== sb) return sa - sb;
      var x = D.personKey(a.name), y = D.personKey(b.name);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  };
  // Si la búsqueda coincide por un apodo y no por el nombre, devuelve ese apodo (para mostrarlo en la sugerencia).
  D.matchedNickname = function (p, text) {
    var terms = D.fold(text || '').split(/\s+/).filter(Boolean);
    if (!terms.length) return '';
    if (terms.every(function (t) { return D.personKey(p.name).indexOf(t) >= 0; })) return '';
    for (var i = 0; i < p.nicknames.length; i++) {
      if (terms.every(function (t) { return D.personKey(p.nicknames[i]).indexOf(t) >= 0; })) return p.nicknames[i];
    }
    return '';
  };

  // ---- Fragmentos vinculados (para la ficha) ----
  // Todas las entradas de todas las páginas vinculadas a la persona, con su fecha. No se recorta el texto: se conserva el contexto.
  D.fragmentsOf = function (entries, personId) {
    var out = [];
    entries.forEach(function (e) {
      e.blocks.forEach(function (b, i) {
        if ((b.people || []).indexOf(personId) >= 0) out.push({ day: e.day, pageTitle: e.title, index: i, total: e.blocks.length, block: b });
      });
    });
    return out.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : a.index - b.index; });
  };
  // Cuántos fragmentos tiene cada persona y cuándo fue el último. Solo se muestra como información; no ordena nada por defecto.
  D.peopleActivity = function (entries) {
    var act = {};
    entries.forEach(function (e) {
      e.blocks.forEach(function (b) {
        (b.people || []).forEach(function (id) {
          var a = act[id] || (act[id] = { count: 0, last: '' });
          a.count++; if (e.day > a.last) a.last = e.day;
        });
      });
    });
    return act;
  };

  // ---- Sugerencias al escribir ----
  // Detecta nombres o apodos de tus fichas en el texto. NUNCA vincula: solo propone, y tú confirmas.
  // Si un mismo nombre puede ser de varias personas, devuelve todas para que elijas.
  function words(s) { return ' ' + D.fold(String(s || '')).replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }
  D.suggestPeople = function (text, people, opts) {
    opts = opts || {};
    var linked = opts.linked || [], dismissed = opts.dismissed || {}, hay = words(text);
    if (hay.trim() === '') return [];
    var terms = {};   // término normalizado -> { shown, ids: {} }
    function add(shown, p) {
      var k = words(shown);
      if (k.trim().length < 2) return;
      (terms[k] || (terms[k] = { shown: shown, people: [] }));
      if (terms[k].people.indexOf(p) < 0) terms[k].people.push(p);
    }
    people.forEach(function (p) {
      add(p.name, p);
      p.nicknames.forEach(function (n) { add(n, p); });
      var first = p.name.split(' ')[0];
      if (p.name.indexOf(' ') > 0 && first.length >= 3) add(first, p);
    });
    var keys = Object.keys(terms).sort(function (a, b) { return b.length - a.length; });
    var out = [], covered = {};
    keys.forEach(function (k) {
      if (hay.indexOf(k) < 0) return;
      var t = terms[k];
      if (t.people.some(function (p) { return linked.indexOf(p.id) >= 0; })) return;     // ya está vinculada: no molestar
      if (t.people.every(function (p) { return covered[p.id]; })) return;              // ya sugerida con un nombre más largo
      var id = k.trim() + '|' + t.people.map(function (p) { return p.id; }).sort().join(',');
      if (dismissed[id]) return;
      t.people.forEach(function (p) { covered[p.id] = true; });
      out.push({ key: id, term: t.shown, people: t.people.slice() });
    });
    return out;
  };

  // ---- Repositorio (people.json) ----
  App.createPeopleRepo = function (store) {
    var cache = null;

    function ensureDoc(doc) {
      if (!doc || typeof doc !== 'object' || !Array.isArray(doc.people)) {
        throw invalid('El archivo de personas está dañado. No lo toco para no perder nada; revísalo en GitHub.');
      }
      return doc;
    }
    function sorted(list) {
      return list.slice().sort(function (a, b) { var x = D.personKey(a.name), y = D.personKey(b.name); return x < y ? -1 : x > y ? 1 : 0; });
    }
    // Dos fichas con el mismo nombre solo se admiten si ambas tienen una relación y es distinta: así nunca hay un
    // "Marcos" sin más junto a otro "Marcos", que dejaría los vínculos ambiguos.
    // Devuelve null (sin conflicto), 'same' (es la misma persona: mismo nombre y misma relación) o 'ambiguous'
    // (mismo nombre y falta una relación que las distinga).
    function clashes(doc, person) {
      var name = D.personKey(person.name), rel = D.fold(person.relation), kind = null;
      doc.people.forEach(function (raw) {
        if (!raw || raw.id === person.id || typeof raw.name !== 'string' || D.personKey(raw.name) !== name) return;
        var other = D.fold(clean(raw.relation));
        if (rel === other) kind = kind || (rel ? 'same' : 'ambiguous');
        else if (!rel || !other) kind = 'ambiguous';
      });
      return kind;
    }
    function clashMessage(kind) {
      return kind === 'same'
        ? 'Ya tienes una ficha con ese nombre y esa relación. Búscala en la lista en vez de crearla otra vez.'
        : 'Ya tienes a alguien con ese nombre. Para distinguirlas, indica una relación distinta en cada ficha (por ejemplo, "amigo" y "compañero de trabajo").';
    }
    function load(force) {
      if (cache && !force) return Promise.resolve(cache);
      return store.readJson(PATH, null).then(function (doc) {
        var list = [];
        if (doc) { ensureDoc(doc); list = doc.people.map(D.normalizePersonLoaded).filter(Boolean); }
        cache = sorted(list);
        return cache;
      });
    }
    function mutate(message, fn) {
      var result = null;
      return store.updateJson(PATH, function (doc) {
        ensureDoc(doc);
        var out = fn(doc, function (r) { result = r; });
        return Object.assign({}, doc, { version: 1, people: out });
      }, { fallback: { version: 1, people: [] }, message: message }).then(function () { return load(true); }).then(function () { return result; });
    }
    function indexOf(doc, id) {
      for (var i = 0; i < doc.people.length; i++) if (doc.people[i] && doc.people[i].id === id) return i;
      return -1;
    }

    return {
      list: function (force) { return load(force).then(function (l) { return l.slice(); }); },
      get: function (id) { return load().then(function (l) { for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }); },

      create: function (input) {
        var candidate;
        try { candidate = D.sanitizePerson(Object.assign({}, input || {}, { id: undefined, highlights: [], createdAt: undefined, updatedAt: undefined })); }
        catch (err) { return Promise.reject(err); }
        return mutate('Crea una ficha', function (doc, done) {
          if (doc.people.length >= LIMITS.count) throw invalid('Ya tienes el máximo de fichas (' + LIMITS.count + ').');
          var kind = clashes(doc, candidate);
          if (kind) throw invalid(clashMessage(kind));
          done(candidate);
          return doc.people.concat([candidate]);
        });
      },

      // Edita una ficha. Las entradas que la usan no cambian (la referencian por identificador).
      update: function (id, input) {
        return mutate('Edita una ficha', function (doc, done) {
          var i = indexOf(doc, id);
          if (i < 0) throw invalid('Esa ficha ya no existe.');
          var merged = Object.assign({}, doc.people[i], input || {}, { id: id, createdAt: doc.people[i].createdAt, updatedAt: new Date().toISOString() });
          var updated = D.sanitizePerson(merged);
          var kind = clashes(doc, updated);
          if (kind) throw invalid(clashMessage(kind));
          var next = doc.people.slice(); next[i] = updated;
          done(updated);
          return next;
        });
      },

      // Destacar o dejar de destacar un fragmento en la ficha ("recuerdos destacados").
      setHighlight: function (id, ref, on) {
        return mutate('Destaca un recuerdo', function (doc, done) {
          var i = indexOf(doc, id);
          if (i < 0) throw invalid('Esa ficha ya no existe.');
          var cur = cleanHighlights(doc.people[i].highlights).filter(function (h) { return !(h.day === ref.day && h.block === ref.block); });
          if (on) {
            if (cur.length >= LIMITS.highlights) throw invalid('Ya hay ' + LIMITS.highlights + ' recuerdos destacados (el máximo). Quita alguno para añadir otro.');
            cur.push({ day: ref.day, block: ref.block });
          }
          var next = doc.people.slice();
          next[i] = Object.assign({}, doc.people[i], { highlights: cur, updatedAt: new Date().toISOString() });
          done(next[i]);
          return next;
        });
      },

      // Borra la ficha. Antes quita su vínculo de las entradas (el texto de las entradas NO se toca).
      remove: function (id, diaryRepo) {
        if (!diaryRepo) return Promise.reject(invalid('Conecta tus datos para borrar fichas.'));
        return diaryRepo.unlinkPerson(id).then(function (unlinked) {
          return mutate('Borra una ficha', function (doc, done) {
            var i = indexOf(doc, id);
            if (i < 0) { done({ unlinked: unlinked }); return doc.people; }
            done({ unlinked: unlinked });
            return doc.people.filter(function (p, k) { return k !== i; });
          });
        });
      }
    };
  };

  // Fichas de la conexión actual (o null si no hay datos conectados).
  var current = { store: null, repo: null };
  D.people = function () {
    var store = App.connection.getStore();
    if (!store) return null;
    if (current.store !== store) current = { store: store, repo: App.createPeopleRepo(store) };
    return current.repo;
  };
})(window.App = window.App || {});
