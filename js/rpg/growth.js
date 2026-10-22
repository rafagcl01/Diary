// Extras suaves del personaje (Fase 4). Ninguno castiga: no hay rachas que se rompan ni XP que se pierda.
//  - XP descansada: al volver tras 3 días o más sin apuntar nada, las 3 primeras actividades de ese día y el siguiente dan
//    +5 extra cada una. Es un apunte aparte (`rested:<clave de la actividad>`, misma subcategoría): no gasta el cupo de 10
//    actividades al día, nunca se da dos veces y, si borras la actividad, se va con ella (ver removeEntry).
//  - Atributo dormido: el que menos XP ha recibido en los últimos 7 días (si esos días has apuntado algo). Brilla en el radar
//    y una de las misiones diarias es suya, con el sello «Despierta» (misma XP que las demás).
//  - Rasgos: salen solos del historial (horas a las que apuntas, días, variedad, sombras purificadas). Conseguido una vez,
//    es para siempre. Solo decoración. Tienen tres formas (femenina, masculina y neutra: ver R.named) y algunos son
//    secretos: salen como «???» hasta conseguirlos.
// Todo se calcula del registro de XP (y de las apariciones de sombras): no se guarda nada aparte. Valores en config.js.
(function (App) {
  var R = App.rpg;
  var C = R.CONFIG;
  function dayNum(day) { var p = String(day).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
  function diff(a, b) { return dayNum(a) - dayNum(b); }   // días de b a a

  // ---- XP descansada ----
  R.RESTED = C.rested;
  R.isRestedKey = function (key) { return /^rested:/.test(String(key)); };
  // Estado del descanso hoy:
  //  { state: 'pending', days, left }  sin apuntar nada desde hace 3 días o más: lo próximo que apuntes la activa;
  //  { state: 'active', start, until, days, left } has vuelto (hoy o ayer) y aún quedan actividades con extra;
  //  null en cualquier otro caso. `days` = días de descanso.
  R.restState = function (entries, today) {
    today = today || R.today();
    var cfg = R.RESTED, seen = {}, days = [];
    (entries || []).forEach(function (e) { if (e && e.kind !== 'rested' && typeof e.day === 'string' && e.day <= today && !seen[e.day]) { seen[e.day] = true; days.push(e.day); } });
    if (!days.length) return null;
    days.sort();
    var last = days[days.length - 1];
    if (last < R.shiftDay(today, -1)) {
      return diff(today, last) > cfg.gapDays ? { state: 'pending', days: diff(today, last) - 1, left: cfg.count } : null;
    }
    var i = days.length - 1;
    while (i > 0 && diff(days[i], days[i - 1]) <= cfg.gapDays) i--;
    if (i === 0) return null;   // tu primera racha de uso: no venías de descansar
    var start = days[i], until = R.shiftDay(start, cfg.windowDays - 1);
    if (today > until) return null;
    var used = (entries || []).filter(function (e) { return e && e.kind === 'rested' && e.day >= start; }).length;
    var left = Math.max(0, cfg.count - used);
    return left ? { state: 'active', start: start, until: until, days: diff(start, days[i - 1]) - 1, left: left } : null;
  };
  // Tras registrar una actividad con XP: si toca, su extra. Devuelve el apunte del extra o null.
  R.grantRested = function (rpg, entry) {
    if (!rpg || !entry || entry.kind !== 'activity' || !(entry.xp > 0)) return Promise.resolve(null);
    return rpg.entries().then(function (all) {
      var s = R.restState(all, R.today());
      if (!s || s.state !== 'active' || entry.day < s.start) return null;
      return rpg.addEntry({ kind: 'rested', key: 'rested:' + entry.key, label: 'XP descansada · ' + entry.label, xp: R.RESTED.xp,
        points: (entry.splits || []).map(function (p) { return { sub: p.sub, xp: p.xp }; }), day: entry.day })
        .then(function (r) { return r.duplicate ? null : r.entry; });
    }).catch(function () { return null; });   // el extra es un regalo: si falla, la actividad ya está guardada
  };

  // ---- Atributo dormido ----
  // El atributo con menos XP en los últimos 7 días (con empate, el primero en el orden de la ficha). null si esos días
  // no hubo XP en ninguna subcategoría. Devuelve { id, name, icon, weekXp }.
  R.dormantMain = function (structure, entries, today) {
    today = today || R.today();
    var since = R.shiftDay(today, -(C.dormant.days - 1)), bySub = {}, total = 0;
    (entries || []).forEach(function (e) {
      if (!e || e.day < since || e.day > today || !(e.xp > 0)) return;
      (e.splits || []).forEach(function (s) { if (s && s.xp > 0) { bySub[s.sub] = (bySub[s.sub] || 0) + s.xp; total += s.xp; } });
    });
    if (!total) return null;
    var best = null;
    structure.forEach(function (a) {
      if (!a.subs.some(function (s) { return !s.archived; })) return;
      var xp = a.subs.reduce(function (t, s) { return t + (bySub[s.id] || 0); }, 0);
      if (!best || xp < best.weekXp) best = { id: a.id, name: a.name, icon: a.icon, weekXp: xp };
    });
    return best;
  };

  // ---- Rasgos ----
  R.TRAITS = C.traits;
  function hourOf(e) { var d = new Date(e && e.at); return isNaN(d.getTime()) ? -1 : d.getHours(); }
  function inHours(h, from, to) { return h >= 0 && (from <= to ? h >= from && h < to : h >= from || h < to); }
  // Lo que cuenta para cada tipo de rasgo: [{ day, id? }] ordenado por día.
  function events(t, entries, shadows) {
    var voided = R.voidedKeys(entries || []), acts = (entries || []).filter(function (e) { return e && e.kind === 'activity' && !voided[e.key]; }), out = [];
    if (t.kind === 'hours') out = acts.filter(function (e) { return inHours(hourOf(e), t.from, t.to); }).map(function (e) { return { day: e.day }; });
    else if (t.kind === 'hoursSub') out = acts.filter(function (e) { return inHours(hourOf(e), t.from, t.to) && (e.splits || []).some(function (s) { return s.sub === t.sub; }); }).map(function (e) { return { day: e.day }; });
    else if (t.kind === 'variety') out = acts.filter(function (e) { return e.activity && e.activity !== 'puntual'; }).map(function (e) { return { day: e.day, id: e.activity }; });
    else if (t.kind === 'days') {
      var seen = {};
      (entries || []).forEach(function (e) { if (e && e.kind !== 'adjustment' && typeof e.day === 'string' && !seen[e.day]) { seen[e.day] = true; out.push({ day: e.day, id: e.day }); } });
    } else if (t.kind === 'fullday') {
      // Secreto: el mismo día, la XP del diario, el premio de las tres diarias y el de la lista de tareas.
      var has = { diary: {}, daily: {}, list: {} };
      (entries || []).forEach(function (e) {
        if (!e || voided[e.key]) return;
        if (R.isDiaryXpKey && R.isDiaryXpKey(e.key)) has.diary[e.day] = true;
        else if (/^daily:\d{4}-\d{2}-\d{2}$/.test(e.key)) has.daily[e.day] = true;
        else if (/^todo:tl_[0-9a-f]{8}$/.test(e.key)) has.list[e.day] = true;
      });
      Object.keys(has.diary).forEach(function (d) { if (has.daily[d] && has.list[d]) out.push({ day: d }); });
    } else if (t.kind === 'comeback') {
      // Secreto: un día con algo apuntado después de `gap` días seguidos sin nada.
      var ds = {}; (entries || []).forEach(function (e) { if (e && e.kind !== 'rested' && typeof e.day === 'string') ds[e.day] = true; });
      var sorted = Object.keys(ds).sort();
      for (var k = 1; k < sorted.length; k++) if (diff(sorted[k], sorted[k - 1]) > t.gap) out.push({ day: sorted[k] });
    } else if (t.kind === 'midnight') {
      // Secreto: apuntar algo entre las 0:00 y las 0:0X (por la hora a la que lo apuntas).
      (entries || []).forEach(function (e) {
        var d = new Date(e && e.at);
        if (e && e.kind !== 'rested' && !isNaN(d.getTime()) && d.getHours() === 0 && d.getMinutes() < t.minutes) out.push({ day: e.day });
      });
    } else if (t.kind === 'purified' && shadows) {
      var byId = {}; (shadows.all || []).forEach(function (s) { byId[s.id] = s; });
      (shadows.appearances || []).forEach(function (a) { var s = byId[a.shadow]; if (s && R.shadowPurified(s, a.day, entries)) out.push({ day: a.day }); });
    }
    return out.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
  }
  // Cuenta dentro de una ventana: distintos (`id`) o en total.
  function countIn(list, distinct) {
    if (!distinct) return list.length;
    var o = {}; list.forEach(function (x) { o[x.id] = true; }); return Object.keys(o).length;
  }
  // Primer día en que se cumplió (o null) y progreso en los últimos `window` días (en total si window = 0).
  R.traitProgress = function (t, entries, shadows, today) {
    today = today || R.today();
    var ev = events(t, entries, shadows), distinct = t.kind === 'variety' || t.kind === 'days', earnedOn = null;
    if (!t.window) {
      if (countIn(ev, distinct) >= t.n) {
        var acc = [];
        for (var k = 0; k < ev.length; k++) { acc.push(ev[k]); if (countIn(acc, distinct) >= t.n) { earnedOn = ev[k].day; break; } }
      }
      return { earned: !!earnedOn, earnedOn: earnedOn, progress: Math.min(t.n, countIn(ev, distinct)), target: t.n };
    }
    var i = 0;
    for (var j = 0; j < ev.length && !earnedOn; j++) {
      while (diff(ev[j].day, ev[i].day) >= t.window) i++;
      if (countIn(ev.slice(i, j + 1), distinct) >= t.n) earnedOn = ev[j].day;
    }
    var since = R.shiftDay(today, -(t.window - 1));
    var now = countIn(ev.filter(function (x) { return x.day >= since && x.day <= today; }), distinct);
    return { earned: !!earnedOn, earnedOn: earnedOn, progress: Math.min(t.n, now), target: t.n };
  };
  // Todos los rasgos con su estado. `shadows` = estado de las sombras ({ all, appearances }) o null.
  R.traitsState = function (entries, shadows, today) {
    return R.TRAITS.map(function (t) { return Object.assign({}, t, R.traitProgress(t, entries, shadows, today)); });
  };
})(window.App = window.App || {});
