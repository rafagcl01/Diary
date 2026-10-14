// Estado de ánimo: SOLO estadísticas. El estado se apunta en las entradas del diario; aquí se ve cómo se reparte
// a lo largo de los meses. Describe lo registrado: no dice por qué ni valora. Las emociones no intervienen.
(function (App) {
  var D = App.diary, H = App.diaryHtml, esc = App.escapeHtml;

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function monthWord(key) { return D.formatMonth(key); }
  function shortMonth(key) {
    var d = D.parseDay(key + '-01');
    return d ? d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : key;
  }
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

    // Mes a mes: columnas apiladas con el ánimo medio debajo; pulsar una columna lleva a ese mes
    trend: function (trend, selectedKey) {
      var max = Math.max.apply(null, trend.map(function (t) { return t.total; }).concat([1]));
      return '<ul class="trend" aria-label="Estados de ánimo apuntados mes a mes">' + trend.map(function (t) {
        var h = t.total ? Math.max(4, Math.round(t.total * 100 / max)) : 0;
        var segs = D.moodShares(t.counts, t.total).map(function (s) {
          return '<i class="seg m-' + (D.isKnownMood(s.mood) ? esc(s.mood) : 'neutro') + '" style="flex: ' + s.count + '"></i>';
        }).join('');
        var aria = monthWord(t.key) + ': ' + (t.total ? plural(t.total, 'entrada con estado', 'entradas con estado') + ' (' + summaryOf(t.counts) + '), ánimo medio ' + t.average + ' por ciento' : 'sin estados apuntados');
        return '<li><button type="button" class="trend-col' + (t.key === selectedKey ? ' sel' : '') + '" data-month="' + t.key + '" aria-label="' + esc(aria) + '" aria-pressed="' + (t.key === selectedKey) + '">' +
          '<span class="trend-bar" aria-hidden="true" style="height: ' + h + '%">' + segs + '</span>' +
          '<span class="trend-num" aria-hidden="true">' + (t.average !== null ? t.average + '%' : '') + '</span>' +
          '<span class="trend-label" aria-hidden="true">' + esc(shortMonth(t.key)) + '</span></button></li>';
      }).join('') + '</ul>';
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

      repo.list().then(function (entries) {
        var moods = D.moodBlocks(entries);
        if (!moods.length) {
          body.innerHTML = emptyCard('Todavía no hay estados de ánimo',
            'El estado se apunta en cada entrada de tu diario, con un toque. Cuando haya algunos, aquí verás cómo se reparten mes a mes.', '#/diario/hoy', 'Escribir una entrada');
          return;
        }
        var currentKey = D.today().slice(0, 7);
        var latestKey = D.monthKey(moods[moods.length - 1].day);
        var state = { key: moods.some(function (b) { return D.monthKey(b.day) === currentKey; }) ? currentKey : latestKey };

        function paint() {
          var stats = D.monthStats(entries, state.key);
          var trend = D.monthlyTrend(entries, currentKey, 12);
          var assoc = D.tagAssociations(entries, currentKey, 12);
          body.innerHTML =
            '<section class="card" aria-labelledby="m-month">' +
              '<div class="cal-head"><button type="button" class="cal-nav" data-step="-1" aria-label="Mes anterior">' + App.icon('chev-l') + '</button>' +
                '<h2 id="m-month" class="cal-title">' + esc(monthWord(state.key)) + '</h2>' +
                '<button type="button" class="cal-nav" data-step="1" aria-label="Mes siguiente"' + (state.key >= currentKey ? ' disabled' : '') + '>' + App.icon('chev-r') + '</button></div>' +
              '<p class="soft" role="status">' + (stats.total
                ? plural(stats.total, 'entrada con estado', 'entradas con estado') + ' en ' + plural(stats.daysWithMood, 'día', 'días') + '. Ánimo medio del mes: <b>' + stats.average + '%</b>.'
                : 'Este mes no hay estados apuntados.') + '</p>' +
              '<div class="mood-month">' + M.distribution(stats) + M.calendar(state.key, stats) + '</div>' +
            '</section>' +
            '<section class="card" aria-labelledby="m-trend"><h2 id="m-trend">Mes a mes</h2>' +
              '<p class="soft">Los últimos 12 meses, con el ánimo medio debajo de cada columna. Pulsa una columna para ver ese mes.</p>' + M.trend(trend, state.key) + '</section>' +
            '<section class="card" aria-labelledby="m-assoc"><h2 id="m-assoc">Etiquetas y ánimo</h2>' +
              '<p class="soft">Una pista, no una conclusión: dos cosas que aparecen juntas no significan que una cause la otra.</p>' + M.associations(assoc) + '</section>' +
            '<p class="soft footnote">El porcentaje es la media de los estados de ánimo de cada página (Muy bien 100 %, Bien 75 %, Neutro 50 %, Mal 25 %, Muy mal 0 %); las entradas sin estado no cuentan y las emociones tampoco. Las cifras solo describen lo que has apuntado, no dicen por qué te sentiste así y con pocos registros pueden cambiar mucho.</p>';
        }
        paint();

        view.addEventListener('click', function (e) {
          var t = e.target;
          if (!t || !t.closest) return;
          var step = t.closest('[data-step]'), col = t.closest('[data-month]');
          if (step) {
            var next = D.addMonths(state.key, Number(step.dataset.step));
            if (next <= currentKey) { state.key = next; paint(); }
          } else if (col) { state.key = col.dataset.month; paint(); }
        });
      }).catch(function (err) {
        body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar tus estadísticas. ' + esc(err.message || '') + '</div>';
      });
    }
  };
})(window.App = window.App || {});
