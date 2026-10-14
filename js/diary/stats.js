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
