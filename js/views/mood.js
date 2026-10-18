// Estado de ánimo: SOLO estadísticas. El estado se apunta en las entradas del diario; aquí se ve cómo ha ido por
// semana, mes o año (línea), cómo se reparten los estados y qué emociones has marcado (anillo). Describe lo registrado:
// no dice por qué ni valora. Las emociones van aparte: nunca cambian el porcentaje de ánimo.
(function (App) {
  var D = App.diary, H = App.diaryHtml, esc = App.escapeHtml;

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function monthWord(key) { return D.formatMonth(key); }
  function summaryOf(counts) {
    return D.moodShares(counts, Object.keys(counts).reduce(function (s, k) { return s + counts[k]; }, 0))
      .map(function (s) { return D.moodLabel(s.mood) + ' ' + s.count; }).join(', ');
  }

  var M = App.moodHtml = {
    // Reparto del mes: barras horizontales en el orden de la escala, con el número siempre escrito
    distribution: function (stats) {
      if (!stats.total) return '<p class="soft">No hay estados de ánimo apuntados en este mes.</p>';
      return '<ul class="mood-bars">' + D.moodShares(stats.counts, stats.total).map(function (s) {
        return '<li><span class="mood-label">' + H.face(s.mood, 'small') + '<span>' + esc(D.moodLabel(s.mood)) + '</span></span>' +
          '<span class="hbar" aria-hidden="true"><i class="m-' + (D.isKnownMood(s.mood) ? esc(s.mood) : 'neutro') + '" style="width: ' + s.pct + '%"></i></span>' +
          '<span class="mood-num">' + s.count + ' <small>(' + s.pct + '%)</small></span></li>';
      }).join('') + '</ul>';
    },

    // Calendario del mes: cada día con estado se colorea con el que más aparece ese día
    calendar: function (key, stats) {
      var year = +key.slice(0, 4), month = +key.slice(5, 7) - 1;
      var grid = D.monthGrid(year, month, []);
      var label = monthWord(key);
      var dow = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="dow" aria-hidden="true">' + d + '</span>'; }).join('');
      var cells = grid.weeks.map(function (w) {
        return w.map(function (c) {
          if (!c) return '<span class="day blank" aria-hidden="true"></span>';
          var d = stats.days[c.key], when = c.day + ' de ' + label.split(' ')[0];
          if (!d) return '<span class="day" role="img" aria-label="' + esc(when + ': sin estado apuntado') + '">' + c.day + '</span>';
          return '<span class="day moodday m-' + (D.isKnownMood(d.dominant) ? esc(d.dominant) : 'neutro') + '" role="img" aria-label="' +
            esc(when + ': ' + summaryOf(d.counts) + (d.percent !== undefined ? ', ánimo ' + d.percent + ' por ciento' : '')) + '">' + c.day + '</span>';
        }).join('');
      }).join('');
      return '<div class="cal" role="group" aria-label="Calendario de estados de ánimo de ' + esc(label) + '">' + dow + cells + '</div>';
    },

    // Línea del ánimo en el periodo. Un punto por día (o por mes en la vista de año); donde no hay estados no hay
    // punto y el hueco se cruza con un trazo discontinuo (se lee como una línea sin inventar valores).
    // Devuelve el SVG; el resaltado al pasar el ratón lo pone la vista (ver hover).
    LINE: { W: 900, H: 280, L: 74, R: 14, T: 12, B: 30 },
    line: function (series) {
      var G = M.LINE, n = series.length, W = G.W, H = G.H;
      var x = function (i) { return G.L + (n === 1 ? 0 : i * (W - G.L - G.R) / (n - 1)); }, y = function (v) { return G.T + (100 - v) * (H - G.T - G.B) / 100; };
      var s = '<svg class="mood-line-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(M.lineSummary(series)) + '"><g class="ml-grid" aria-hidden="true">';
      D.MOODS.forEach(function (m) { s += '<line x1="' + G.L + '" x2="' + (W - G.R) + '" y1="' + y(m.value) + '" y2="' + y(m.value) + '"/><text class="ml-y" x="' + (G.L - 10) + '" y="' + (y(m.value) + 4) + '" text-anchor="end">' + esc(m.label) + '</text>'; });
      s += '</g><g aria-hidden="true">';
      var every = n > 20 ? 5 : 1;
      series.forEach(function (p, i) { if (i % every === 0 || i === n - 1) s += '<text class="ml-x" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(p.label) + '</text>'; });
      var runs = [], cur = [];
      series.forEach(function (p, i) { if (p.value === null) { if (cur.length) runs.push(cur); cur = []; } else cur.push(i); });
      if (cur.length) runs.push(cur);
      for (var g = 1; g < runs.length; g++) {
        var a = runs[g - 1][runs[g - 1].length - 1], b = runs[g][0];
        s += '<path class="ml-gap" d="M' + x(a) + ' ' + y(series[a].value) + ' L' + x(b) + ' ' + y(series[b].value) + '"/>';
      }
      runs.forEach(function (r) {
        if (r.length < 2) return;
        s += '<path class="ml-path" d="' + r.map(function (i, k) { return (k ? 'L' : 'M') + x(i) + ' ' + y(series[i].value); }).join(' ') + '"/>';
      });
      series.forEach(function (p, i) { if (p.value !== null) s += '<circle class="ml-dot" cx="' + x(i) + '" cy="' + y(p.value) + '" r="' + (n > 20 ? 4 : 5) + '"/>'; });
      return s + '<line class="ml-cross" x1="0" x2="0" y1="' + G.T + '" y2="' + (H - G.B) + '" visibility="hidden"/></g></svg>';
    },
    lineSummary: function (series) {
      var with_ = series.filter(function (p) { return p.value !== null; });
      if (!with_.length) return 'Sin estados apuntados en este periodo';
      return 'Ánimo por ' + (series.length === 12 ? 'mes' : 'día') + ': ' + with_.map(function (p) { return p.full + ' ' + p.value + '%'; }).join(', ');
    },

    // Emociones del periodo en una gráfica circular (anillo), con la leyenda: nombre, porcentaje y número de veces.
    // Colores en orden fijo (--ch-1…6) y «otras» siempre gris; nunca se reciclan.
    donut: function (sh) {
      if (!sh.total) return '<p class="soft">En este periodo no marcaste emociones en tus entradas.</p>';
      var items = sh.items.map(function (it, i) { return { name: it.name, count: it.count, pct: it.pct, color: 'var(--ch-' + (i + 1) + ')', symbol: it.symbol }; });
      if (sh.other) items.push({ name: 'Otras (' + sh.other.kinds + ')', count: sh.other.count, pct: sh.other.pct, color: 'var(--ch-other)' });
      var R = 92, r0 = 58, c = 105, a0 = -Math.PI / 2, svg = '<svg class="mood-donut-svg" viewBox="0 0 210 210" role="img" aria-label="' +
        esc('Emociones: ' + items.map(function (it) { return it.name + ' ' + it.pct + '%'; }).join(', ')) + '">';
      var pt = function (rad, a) { return (c + rad * Math.cos(a)).toFixed(2) + ' ' + (c + rad * Math.sin(a)).toFixed(2); };
      items.forEach(function (it, k) {
        var a1 = a0 + 2 * Math.PI * it.count / sh.total;
        if (items.length === 1) a1 = a0 + 2 * Math.PI - 0.0001;   // un solo trozo: el anillo entero
        var big = a1 - a0 > Math.PI ? 1 : 0;
        svg += '<path class="md-arc" data-k="' + k + '" fill="' + it.color + '" d="M' + pt(R, a0) + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + pt(R, a1) + ' L' + pt(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + pt(r0, a0) + 'Z">' +
          '<title>' + esc(it.name + ': ' + it.pct + '% (' + plural(it.count, 'vez', 'veces') + ')') + '</title></path>';
        a0 = a1;
      });
      svg += '<text class="md-c1" x="105" y="110" text-anchor="middle">' + sh.total + '</text><text class="md-c2" x="105" y="128" text-anchor="middle">' + (sh.total === 1 ? 'vez' : 'veces') + '</text></svg>';
      return '<div class="mood-donut">' + svg + '<ul class="md-legend">' + items.map(function (it, k) {
        return '<li data-k="' + k + '"><i style="background:' + it.color + '"></i><span>' + (it.symbol && D.isSymbol(it.symbol) ? App.icon(it.symbol) : '') + esc(it.name) + '</span><b>' + it.pct + '% <small>· ' + it.count + '</small></b></li>';
      }).join('') + '</ul></div>';
    },

    // Etiquetas y ánimo: pistas descriptivas, solo con datos suficientes
    associations: function (assoc) {
      var min = D.STATS_MIN;
      if (assoc.total < min.blocksForPatterns) {
        return '<p class="soft">Todavía hay pocos registros para buscar pistas: hacen falta al menos ' + min.blocksForPatterns +
          ' entradas con estado en los últimos 12 meses y llevas ' + assoc.total + '.</p>';
      }
      if (!assoc.items.length) {
        return '<p class="soft">Ninguna etiqueta tiene todavía al menos ' + min.blocksPerTag + ' entradas con estado.</p>';
      }
      return '<ul class="assoc">' + assoc.items.map(function (a) {
        return '<li><b>#' + esc(a.tag) + '</b>: en sus ' + a.total + ' entradas con estado, el ánimo medio es <b>' + a.average + '%</b>. En todas tus entradas con estado, ' + a.overall + '%.</li>';
      }).join('') + '</ul>';
    }
  };

  function emptyCard(title, text, linkHref, linkText) {
    return '<section class="card stitched empty"><div class="empty-icon">' + App.icon('mood') + '</div><h2>' + title + '</h2><p>' + text + '</p>' +
      (linkHref ? '<a class="btn secondary" href="' + linkHref + '">' + linkText + '</a>' : '') + '</section>';
  }

  App.views = App.views || {};
  App.views.mood = {
    render: function (root) {
      root.innerHTML = '<div class="view mood-view">' +
        App.pageHeader('Estado de ánimo', 'Cómo te has sentido a lo largo del tiempo, según los estados que apuntas en las entradas de tu diario.', 'estadísticas') +
        App.lace() + '<div id="m-body"></div></div>';
      var view = root.querySelector('.mood-view');
      var body = root.querySelector('#m-body');
      var repo = D.repo();

      if (!repo) {
        body.innerHTML = emptyCard('Conecta tus datos para ver tus estadísticas', 'El estado de ánimo se apunta dentro de cada entrada del diario y las estadísticas se calculan con tus páginas.', '#/ajustes', 'Conectar mis datos');
        return;
      }
      body.innerHTML = '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>';

      // Las emociones son un extra: si no se pueden cargar, el resto se ve igual.
      var emoRepo = D.emotions ? D.emotions() : null;
      var library = emoRepo ? emoRepo.list().catch(function () { return []; }) : Promise.resolve([]);
      Promise.all([repo.list(), library]).then(function (r) {
        var entries = r[0], lib = r[1];
        var moods = D.moodBlocks(entries);
        if (!moods.length) {
          body.innerHTML = emptyCard('Todavía no hay estados de ánimo',
            'El estado se apunta en cada entrada de tu diario, con un toque. Cuando haya algunos, aquí verás cómo te has sentido por semanas, meses y años.', '#/diario/hoy', 'Escribir una entrada');
          return;
        }
        var today = D.today(), currentKey = today.slice(0, 7);
        var latestKey = D.monthKey(moods[moods.length - 1].day);
        // Por defecto, el mes actual; si este mes aún no hay estados, el último mes que los tenga.
        var state = { kind: 'mes', offset: moods.some(function (b) { return D.monthKey(b.day) === currentKey; }) ? 0 : monthsBetween(latestKey, currentKey) };
        var series = [];
        function monthsBetween(a, b) { return (+a.slice(0, 4) - +b.slice(0, 4)) * 12 + (+a.slice(5, 7) - +b.slice(5, 7)); }
        var WORD = { semana: 'de la semana', mes: 'del mes', ano: 'del año' };
        var UNIT = { semana: 'Semana', mes: 'Mes', ano: 'Año' };

        function paint() {
          var per = D.period(state.kind, state.offset, today), stats = D.periodStats(entries, per.from, per.to);
          series = D.periodSeries(entries, per);
          var emo = D.emotionShares(entries, per.from, per.to, lib, 6);
          var assoc = D.tagAssociations(entries, currentKey, 12);
          var withValue = series.filter(function (p) { return p.value !== null; }).length;
          body.innerHTML =
            '<section class="card mood-period" aria-labelledby="m-period">' +
              '<div class="mood-bar"><div class="mood-seg" role="group" aria-label="Ver por">' + D.PERIODS.map(function (k) {
                return '<button type="button" data-kind="' + k + '" aria-pressed="' + (state.kind === k) + '">' + UNIT[k] + '</button>';
              }).join('') + '</div>' +
              '<div class="cal-head mood-nav"><button type="button" class="cal-nav" data-step="-1" aria-label="' + UNIT[state.kind] + ' anterior">' + App.icon('chev-l') + '</button>' +
                '<h2 id="m-period" class="cal-title">' + esc(per.label) + '</h2>' +
                '<button type="button" class="cal-nav" data-step="1" aria-label="' + UNIT[state.kind] + ' siguiente"' + (state.offset >= 0 ? ' disabled' : '') + '>' + App.icon('chev-r') + '</button></div></div>' +
              '<p class="soft" role="status">' + (stats.total
                ? plural(stats.total, 'entrada con estado', 'entradas con estado') + ' en ' + plural(stats.daysWithMood, 'día', 'días') + '. Ánimo medio ' + WORD[state.kind] + ': <b>' + stats.average + '%</b>.'
                : 'En este periodo no hay estados apuntados.') + '</p>' +
              '<h3 class="mood-h">Ánimo a lo largo del tiempo</h3>' +
              (withValue ? '<div class="mood-line">' + M.line(series) + '<div class="ml-tip" hidden></div></div>' +
                '<p class="soft ml-note">Cada punto es la media de los estados de ese ' + (state.kind === 'ano' ? 'mes' : 'día') + '. Donde no apuntaste nada no hay punto y el tramo es discontinuo: no se inventa ningún valor.</p>'
                : '<p class="soft">Sin estados apuntados en este periodo.</p>') +
            '</section>' +
            '<div class="mood-two">' +
              '<section class="card" aria-labelledby="m-emo"><h2 id="m-emo">Tus emociones</h2>' +
                '<p class="soft">Qué porcentaje de las veces que marcaste emociones fue cada una, en este periodo. Son aparte del estado de ánimo: no cambian ningún porcentaje.</p>' + M.donut(emo) + '</section>' +
              '<section class="card" aria-labelledby="m-dist"><h2 id="m-dist">Reparto de estados</h2>' + M.distribution(stats) + '</section>' +
            '</div>' +
            (state.kind === 'mes' ? '<section class="card" aria-labelledby="m-cal"><h2 id="m-cal">Calendario</h2><p class="soft">Cada día, con el estado que más apuntaste.</p><div class="mood-cal">' + M.calendar(per.from.slice(0, 7), D.monthStats(entries, per.from.slice(0, 7))) + '</div></section>' : '') +
            '<section class="card" aria-labelledby="m-assoc"><h2 id="m-assoc">Etiquetas y ánimo</h2>' +
              '<p class="soft">Una pista, no una conclusión: dos cosas que aparecen juntas no significan que una cause la otra.</p>' + M.associations(assoc) + '</section>' +
            '<p class="soft footnote">El porcentaje es la media de los estados de ánimo de cada página (Muy bien 100 %, Bien 75 %, Neutro 50 %, Mal 25 %, Muy mal 0 %); las entradas sin estado no cuentan y las emociones tampoco. Las cifras solo describen lo que has apuntado, no dicen por qué te sentiste así y con pocos registros pueden cambiar mucho.</p>';
        }
        paint();

        view.addEventListener('click', function (e) {
          var t = e.target;
          if (!t || !t.closest) return;
          var step = t.closest('[data-step]'), kind = t.closest('[data-kind]');
          if (kind) { state.kind = kind.dataset.kind; state.offset = 0; paint(); return; }
          if (step) { var next = state.offset + Number(step.dataset.step); if (next <= 0) { state.offset = next; paint(); } }
        });
        // Al pasar el ratón por la línea: una guía vertical y el valor del punto más cercano.
        view.addEventListener('mousemove', function (e) {
          var svg = e.target && e.target.closest ? e.target.closest('.mood-line-svg') : null;
          var box = svg && svg.parentNode, tip = box && box.querySelector('.ml-tip'), cross = svg && svg.querySelector('.ml-cross');
          if (!svg || !tip || !series.length) return;
          var G = M.LINE, r = svg.getBoundingClientRect(), n = series.length, px = (e.clientX - r.left) * G.W / r.width;
          var i = Math.max(0, Math.min(n - 1, Math.round((px - G.L) / ((G.W - G.L - G.R) / Math.max(1, n - 1))))), p = series[i];
          var x = G.L + (n === 1 ? 0 : i * (G.W - G.L - G.R) / (n - 1)), yv = p.value === null ? 50 : p.value, y = G.T + (100 - yv) * (G.H - G.T - G.B) / 100;
          cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
          tip.hidden = false; tip.style.left = (x * r.width / G.W) + 'px'; tip.style.top = (y * r.height / G.H) + 'px';
          tip.innerHTML = esc(p.full) + ': ' + (p.value === null ? 'sin estado apuntado' : '<b>' + p.value + '%</b>');
        });
        view.addEventListener('mouseout', function (e) {
          var svg = e.target && e.target.closest ? e.target.closest('.mood-line-svg') : null;
          if (!svg || (e.relatedTarget && svg.contains(e.relatedTarget))) return;
          var tip = svg.parentNode.querySelector('.ml-tip'); if (tip) tip.hidden = true;
          var cross = svg.querySelector('.ml-cross'); if (cross) cross.setAttribute('visibility', 'hidden');
        });
        // En el anillo: al pasar por un trozo se resalta su fila de la leyenda (y al revés).
        view.addEventListener('mouseover', function (e) {
          var hit = e.target && e.target.closest ? e.target.closest('.md-arc, .md-legend li') : null;
          view.querySelectorAll('.md-hot').forEach(function (el) { el.classList.remove('md-hot'); });
          if (!hit) return;
          view.querySelectorAll('[data-k="' + hit.getAttribute('data-k') + '"]').forEach(function (el) { el.classList.add('md-hot'); });
        });
      }).catch(function (err) {
        body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar tus estadísticas. ' + esc(err.message || '') + '</div>';
      });
    }
  };
})(window.App = window.App || {});
