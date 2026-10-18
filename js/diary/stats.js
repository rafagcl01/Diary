// Estadísticas de ánimo a partir de los estados de las entradas. Solo describen lo registrado:
// ni afirman causas, ni valoran a quien escribe. Las emociones NO intervienen en nada de esto.
(function (App) {
  var D = App.diary;

  D.STATS_MIN = { blocksPerTag: 5, blocksForPatterns: 15 };

  // Todas las entradas que tienen estado de ánimo, en orden de día y de entrada.
  D.moodBlocks = function (entries) {
    var out = [];
    entries.slice().sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; }).forEach(function (e) {
      e.blocks.forEach(function (b) { if (D.isKnownMood(b.mood)) out.push({ day: e.day, mood: b.mood, tags: b.tags || [] }); });
    });
    return out;
  };

  function count(list, key) {
    var c = {};
    list.forEach(function (b) { c[b[key]] = (c[b[key]] || 0) + 1; });
    return c;
  }

  // Reparto en el orden de la escala (de "Muy bien" a "Muy mal"), con el número y el porcentaje.
  D.moodShares = function (counts, total) {
    return Object.keys(counts).map(function (m) { return { mood: m, count: counts[m], pct: total ? Math.round(counts[m] * 100 / total) : 0 }; })
      .sort(function (a, b) { return D.moodIndex(a.mood) - D.moodIndex(b.mood); });
  };

  // Resumen de un mes ("2026-10"): cuántas entradas con estado, el reparto, el estado que más aparece cada día
  // y la media de los porcentajes de las páginas del mes (cada página cuenta una vez).
  D.monthStats = function (entries, key) {
    var inMonth = entries.filter(function (e) { return D.monthKey(e.day) === key; });
    var blocks = D.moodBlocks(inMonth), days = {}, percents = [];
    blocks.forEach(function (b) {
      var d = days[b.day] || (days[b.day] = { counts: {}, last: null, total: 0 });
      d.counts[b.mood] = (d.counts[b.mood] || 0) + 1; d.last = b.mood; d.total++;
    });
    Object.keys(days).forEach(function (day) {
      var d = days[day], best = null;
      Object.keys(d.counts).forEach(function (m) {
        // Predomina el que más aparece; si hay empate, el de la última entrada del día.
        if (best === null || d.counts[m] > d.counts[best] || (d.counts[m] === d.counts[best] && m === d.last)) best = m;
      });
      d.dominant = best;
    });
    inMonth.forEach(function (e) {
      var p = D.dayMood(e).percent;
      if (p !== null) { percents.push(p); days[e.day].percent = p; }
    });
    return {
      key: key, total: blocks.length, counts: count(blocks, 'mood'), days: days,
      daysWithMood: Object.keys(days).length, entryDays: inMonth.length, average: D.averageOf(percents)
    };
  };

  D.addMonths = function (key, delta) {
    var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + delta;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + ('0' + (m + 1)).slice(-2);
  };

  // Los últimos `n` meses terminando en `endKey`, con ceros donde no hay datos.
  D.monthlyTrend = function (entries, endKey, n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var key = D.addMonths(endKey, -i), s = D.monthStats(entries, key);
      out.push({ key: key, total: s.total, counts: s.counts, average: s.average });
    }
    return out;
  };

  // ---- Periodos (semana, mes, año) ----
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  D.PERIODS = ['semana', 'mes', 'ano'];
  // El periodo `kind` que está `offset` pasos atrás (0 = el actual, -1 = el anterior) desde `todayKey`.
  // Devuelve { kind, from, to, label, points: [{ key, label, full }] }: un punto por día (semana, mes) o por mes (año).
  D.period = function (kind, offset, todayKey) {
    var t = D.parseDay(todayKey), points = [], from, to, label;
    offset = offset || 0;
    if (kind === 'semana') {
      var mon = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7) + 7 * offset);
      for (var i = 0; i < 7; i++) {
        var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
        points.push({ key: dayKey(d), label: WEEKDAYS[i] + ' ' + d.getDate(), full: d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) });
      }
      from = points[0].key; to = points[6].key;
      var a = D.parseDay(from), b = D.parseDay(to);
      label = 'Del ' + a.getDate() + ' ' + MONTHS_SHORT[a.getMonth()] + ' al ' + b.getDate() + ' ' + MONTHS_SHORT[b.getMonth()] + (b.getFullYear() !== t.getFullYear() ? ' ' + b.getFullYear() : '');
    } else if (kind === 'ano') {
      var y = t.getFullYear() + offset;
      for (var m = 0; m < 12; m++) points.push({ key: y + '-' + pad(m + 1), label: MONTHS_SHORT[m], full: D.formatMonth(y + '-' + pad(m + 1)) });
      from = y + '-01-01'; to = y + '-12-31'; label = String(y);
    } else {
      var mk = D.addMonths(todayKey.slice(0, 7), offset), n = new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
      for (var j = 1; j <= n; j++) points.push({ key: mk + '-' + pad(j), label: String(j), full: j + ' de ' + D.formatMonth(mk).split(' ')[0] });
      from = mk + '-01'; to = mk + '-' + pad(n); label = D.formatMonth(mk); kind = 'mes';
    }
    return { kind: kind, from: from, to: to, label: label, points: points };
  };
  function inRange(e, from, to) { return e.day >= from && e.day <= to; }

  // La línea: el valor de cada punto es el porcentaje de la página de ese día (vista semana/mes) o la media de los
  // porcentajes de las páginas del mes (vista año). null donde no hay estados: no se inventa nada.
  D.periodSeries = function (entries, period) {
    var byDay = {};
    entries.forEach(function (e) { if (inRange(e, period.from, period.to)) { var p = D.dayMood(e).percent; if (p !== null) byDay[e.day] = p; } });
    return period.points.map(function (pt) {
      if (period.kind !== 'ano') return Object.assign({}, pt, { value: byDay[pt.key] === undefined ? null : byDay[pt.key] });
      var vals = Object.keys(byDay).filter(function (k) { return k.slice(0, 7) === pt.key; }).map(function (k) { return byDay[k]; });
      return Object.assign({}, pt, { value: D.averageOf(vals) });
    });
  };

  // Resumen de un periodo: entradas con estado, reparto, días con estado y ánimo medio (media de las páginas).
  D.periodStats = function (entries, from, to) {
    var inside = entries.filter(function (e) { return inRange(e, from, to); }), blocks = D.moodBlocks(inside), percents = [], days = {};
    blocks.forEach(function (b) { days[b.day] = true; });
    inside.forEach(function (e) { var p = D.dayMood(e).percent; if (p !== null) percents.push(p); });
    return { total: blocks.length, counts: count(blocks, 'mood'), daysWithMood: Object.keys(days).length, average: D.averageOf(percents) };
  };

  // Emociones del periodo: cuántas veces se marcó cada una en las entradas (una entrada cuenta una vez por emoción).
  // Las `top` más frecuentes por separado y el resto juntas en «otras». Las emociones borradas de la biblioteca no cuentan.
  D.emotionShares = function (entries, from, to, library, top) {
    top = top || 6;
    var known = {}; (library || []).forEach(function (em) { known[em.id] = em; });
    var c = {}, total = 0;
    entries.forEach(function (e) {
      if (!inRange(e, from, to)) return;
      e.blocks.forEach(function (b) { (b.emotions || []).forEach(function (id) { if (known[id]) { c[id] = (c[id] || 0) + 1; total++; } }); });
    });
    var all = Object.keys(c).map(function (id) { return { id: id, name: known[id].name, symbol: known[id].symbol, count: c[id] }; })
      .sort(function (a, b) { return (b.count - a.count) || (a.name < b.name ? -1 : 1); });
    var shown = all.slice(0, top), rest = all.slice(top);
    var pct = function (n) { return total ? Math.round(n * 100 / total) : 0; };
    shown.forEach(function (s) { s.pct = pct(s.count); });
    var otherCount = rest.reduce(function (t, s) { return t + s.count; }, 0);
    return { total: total, items: shown, other: rest.length ? { kinds: rest.length, count: otherCount, pct: pct(otherCount) } : null };
  };

  // Para cada etiqueta con suficientes entradas con estado: la media de ánimo en esas entradas, junto a la media
  // de todas. Son asociaciones descriptivas, no causas. Con pocos datos no devuelve nada.
  D.tagAssociations = function (entries, endKey, months, opts) {
    opts = opts || {};
    var minBlocks = opts.minBlocks || D.STATS_MIN.blocksPerTag;
    var from = D.addMonths(endKey, -(months - 1));
    var blocks = D.moodBlocks(entries).filter(function (b) { var k = D.monthKey(b.day); return k >= from && k <= endKey; });
    var values = blocks.map(function (b) { return D.moodValue(b.mood); });
    var byTag = {}, names = {};
    blocks.forEach(function (b) {
      D.uniqueTags(b.tags).forEach(function (t) {
        var k = D.fold(t); names[k] = names[k] || t;
        (byTag[k] = byTag[k] || []).push(D.moodValue(b.mood));
      });
    });
    var overall = D.averageOf(values);
    var items = Object.keys(byTag).filter(function (k) { return byTag[k].length >= minBlocks; }).map(function (k) {
      return { tag: names[k], total: byTag[k].length, average: D.averageOf(byTag[k]), overall: overall };
    }).sort(function (a, b) { return (b.total - a.total) || (a.tag < b.tag ? -1 : 1); }).slice(0, 8);
    return { total: blocks.length, overall: overall, items: blocks.length >= D.STATS_MIN.blocksForPatterns ? items : [] };
  };
})(window.App = window.App || {});
