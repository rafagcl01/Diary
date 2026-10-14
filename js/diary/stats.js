// Estadísticas de ánimo a partir de los bloques del diario. Solo describen lo registrado:
// ni dicen qué ánimo es "mejor", ni afirman causas, ni valoran a quien escribe.
(function (App) {
  var D = App.diary;

  D.STATS_MIN = { blocksPerTag: 5, blocksForPatterns: 15 };

  // Todos los bloques que tienen ánimo, en orden de día y de bloque.
  D.moodBlocks = function (entries) {
    var out = [];
    entries.slice().sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; }).forEach(function (e) {
      e.blocks.forEach(function (b) { if (b.mood) out.push({ day: e.day, mood: b.mood, tags: b.tags || [] }); });
    });
    return out;
  };

  function count(list, key) {
    var c = {};
    list.forEach(function (b) { c[b[key]] = (c[b[key]] || 0) + 1; });
    return c;
  }
  function order(mood) {
    for (var i = 0; i < D.MOODS.length; i++) if (D.MOODS[i].id === mood) return i;
    return D.MOODS.length;
  }

  // Cuenta ordenada de mayor a menor (a igualdad, en el orden fijo del selector, sin juicio de valor).
  D.moodShares = function (counts, total) {
    return Object.keys(counts).map(function (m) { return { mood: m, count: counts[m], pct: total ? Math.round(counts[m] * 100 / total) : 0 }; })
      .sort(function (a, b) { return (b.count - a.count) || (order(a.mood) - order(b.mood)); });
  };

  // Resumen de un mes ("2026-10"): total de bloques con ánimo, reparto y ánimo predominante de cada día.
  D.monthStats = function (entries, key) {
    var blocks = D.moodBlocks(entries).filter(function (b) { return D.monthKey(b.day) === key; });
    var days = {};
    blocks.forEach(function (b) {
      var d = days[b.day] || (days[b.day] = { counts: {}, last: null, total: 0 });
      d.counts[b.mood] = (d.counts[b.mood] || 0) + 1; d.last = b.mood; d.total++;
    });
    Object.keys(days).forEach(function (day) {
      var d = days[day], best = null;
      Object.keys(d.counts).forEach(function (m) {
        // Predomina el más frecuente; si hay empate, el del último bloque del día.
        if (best === null || d.counts[m] > d.counts[best] || (d.counts[m] === d.counts[best] && m === d.last)) best = m;
      });
      d.dominant = best;
    });
    return {
      key: key, total: blocks.length, counts: count(blocks, 'mood'), days: days,
      daysWithMood: Object.keys(days).length,
      entryDays: entries.filter(function (e) { return D.monthKey(e.day) === key; }).length
    };
  };

  D.addMonths = function (key, delta) {
    var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1 + delta;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + ('0' + (m + 1)).slice(-2);
  };

  // Los últimos `n` meses terminando en `endKey`, con ceros donde no hay datos.
  D.monthlyTrend = function (entries, endKey, n) {
    var blocks = D.moodBlocks(entries), out = [];
    for (var i = n - 1; i >= 0; i--) {
      var key = D.addMonths(endKey, -i);
      var inMonth = blocks.filter(function (b) { return D.monthKey(b.day) === key; });
      out.push({ key: key, total: inMonth.length, counts: count(inMonth, 'mood') });
    }
    return out;
  };

  // Para cada etiqueta con suficientes bloques con ánimo, cómo se reparten los ánimos en esos bloques.
  // Son asociaciones descriptivas, no causas. Con pocos datos no devuelve nada.
  D.tagAssociations = function (entries, endKey, months, opts) {
    opts = opts || {};
    var minBlocks = opts.minBlocks || D.STATS_MIN.blocksPerTag;
    var from = D.addMonths(endKey, -(months - 1));
    var blocks = D.moodBlocks(entries).filter(function (b) { var k = D.monthKey(b.day); return k >= from && k <= endKey; });
    var overall = count(blocks, 'mood'), byTag = {}, names = {};
    blocks.forEach(function (b) {
      D.uniqueTags(b.tags).forEach(function (t) {
        var k = D.fold(t); names[k] = names[k] || t;
        (byTag[k] = byTag[k] || []).push(b);
      });
    });
    var items = Object.keys(byTag).filter(function (k) { return byTag[k].length >= minBlocks; }).map(function (k) {
      var list = byTag[k], counts = count(list, 'mood');
      var top = D.moodShares(counts, list.length)[0];
      return {
        tag: names[k], total: list.length, counts: counts, top: top.mood, topCount: top.count, topPct: top.pct,
        overallPct: blocks.length ? Math.round(overall[top.mood] * 100 / blocks.length) : 0
      };
    }).sort(function (a, b) { return (b.total - a.total) || (a.tag < b.tag ? -1 : 1); }).slice(0, 8);
    return { total: blocks.length, items: blocks.length >= D.STATS_MIN.blocksForPatterns ? items : [] };
  };
})(window.App = window.App || {});
