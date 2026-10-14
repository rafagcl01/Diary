// Estado de ánimo: SOLO estadísticas. El ánimo se apunta en los bloques del diario; aquí se ve cómo
// se reparte a lo largo de los meses. Describe lo registrado: no dice qué ánimo es mejor, ni por qué.
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
    // Reparto del mes: barras horizontales, con el número siempre escrito
    distribution: function (stats) {
      if (!stats.total) return '<p class="soft">No hay ánimos apuntados en este mes.</p>';
      return '<ul class="mood-bars">' + D.moodShares(stats.counts, stats.total).map(function (s) {
        var known = D.isKnownMood(s.mood);
        return '<li><span class="mood-label">' + H.face(s.mood, 'small') + '<span>' + esc(D.moodLabel(s.mood)) + '</span></span>' +
          '<span class="hbar" aria-hidden="true"><i class="m-' + (known ? esc(s.mood) : 'normal') + '" style="width: ' + s.pct + '%"></i></span>' +
          '<span class="mood-num">' + s.count + ' <small>(' + s.pct + '%)</small></span></li>';
      }).join('') + '</ul>';
    },

    // Calendario del mes: cada día con ánimo se colorea con el que más aparece ese día
    calendar: function (key, stats) {
      var year = +key.slice(0, 4), month = +key.slice(5, 7) - 1;
      var grid = D.monthGrid(year, month, []);
      var label = monthWord(key);
      var dow = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="dow" aria-hidden="true">' + d + '</span>'; }).join('');
      var cells = grid.weeks.map(function (w) {
        return w.map(function (c) {
          if (!c) return '<span class="day blank" aria-hidden="true"></span>';
          var d = stats.days[c.key];
          if (!d) return '<span class="day" role="img" aria-label="' + esc(c.day + ' de ' + label.split(' ')[0] + ': sin ánimo apuntado') + '">' + c.day + '</span>';
          var known = D.isKnownMood(d.dominant);
          return '<span class="day moodday m-' + (known ? esc(d.dominant) : 'normal') + '" role="img" aria-label="' +
            esc(c.day + ' de ' + label.split(' ')[0] + ': ' + summaryOf(d.counts)) + '">' + c.day + '</span>';
        }).join('');
      }).join('');
      return '<div class="cal" role="group" aria-label="Calendario de ánimos de ' + esc(label) + '">' + dow + cells + '</div>';
    },

    // Mes a mes: columnas apiladas; pulsar una columna lleva a ese mes
    trend: function (trend, selectedKey) {
      var max = Math.max.apply(null, trend.map(function (t) { return t.total; }).concat([1]));
      return '<ul class="trend" aria-label="Ánimos apuntados mes a mes">' + trend.map(function (t) {
        var h = t.total ? Math.max(4, Math.round(t.total * 100 / max)) : 0;
        var segs = D.moodShares(t.counts, t.total).map(function (s) {
          return '<i class="seg m-' + (D.isKnownMood(s.mood) ? esc(s.mood) : 'normal') + '" style="flex: ' + s.count + '"></i>';
        }).join('');
        var aria = monthWord(t.key) + ': ' + (t.total ? plural(t.total, 'bloque con ánimo', 'bloques con ánimo') + ' (' + summaryOf(t.counts) + ')' : 'sin ánimos apuntados');
        return '<li><button type="button" class="trend-col' + (t.key === selectedKey ? ' sel' : '') + '" data-month="' + t.key + '" aria-label="' + esc(aria) + '" aria-pressed="' + (t.key === selectedKey) + '">' +
          '<span class="trend-bar" aria-hidden="true" style="height: ' + h + '%">' + segs + '</span>' +
          '<span class="trend-num" aria-hidden="true">' + (t.total || '') + '</span>' +
          '<span class="trend-label" aria-hidden="true">' + esc(shortMonth(t.key)) + '</span></button></li>';
      }).join('') + '</ul>';
    },

    // Etiquetas y ánimo: pistas descriptivas, solo con datos suficientes
    associations: function (assoc) {
      var min = D.STATS_MIN;
      if (assoc.total < min.blocksForPatterns) {
        return '<p class="soft">Todavía hay pocos registros para buscar pistas: hacen falta al menos ' + min.blocksForPatterns +
          ' bloques con ánimo en los últimos 12 meses y llevas ' + assoc.total + '.</p>';
      }
      if (!assoc.items.length) {
        return '<p class="soft">Ninguna etiqueta tiene todavía al menos ' + min.blocksPerTag + ' bloques con ánimo.</p>';
      }
      return '<ul class="assoc">' + assoc.items.map(function (a) {
        return '<li><b>#' + esc(a.tag) + '</b>: en sus ' + a.total + ' bloques con ánimo, <b>' + esc(D.moodLabel(a.top).toLowerCase()) + '</b> aparece ' +
          a.topCount + ' veces (' + a.topPct + '%). En el conjunto de todos tus bloques con ánimo, ' + a.overallPct + '%.</li>';
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
        App.pageHeader('Estado de ánimo', 'Cómo te has sentido a lo largo del tiempo, según lo que apuntas en los bloques de tu diario.', 'estadísticas') +
        App.lace() + '<div id="m-body"></div></div>';
      var view = root.querySelector('.mood-view');
      var body = root.querySelector('#m-body');
      var repo = D.repo();

      if (!repo) {
        body.innerHTML = emptyCard('Conecta tus datos para ver tus estadísticas', 'El ánimo se apunta dentro de cada bloque del diario y las estadísticas se calculan con tus entradas.', '#/ajustes', 'Conectar mis datos');
        return;
      }
      body.innerHTML = '<div class="skeleton" style="margin: 14px 0"></div><div class="skeleton" style="width: 70%"></div>';

      repo.list().then(function (entries) {
        var moods = D.moodBlocks(entries);
        if (!moods.length) {
          body.innerHTML = emptyCard('Todavía no hay estados de ánimo',
            'El ánimo se apunta en cada bloque de tu diario, con un toque. Cuando haya algunos, aquí verás cómo se reparten mes a mes.', '#/diario/hoy', 'Escribir hoy');
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
                ? plural(stats.total, 'bloque con ánimo', 'bloques con ánimo') + ' en ' + plural(stats.daysWithMood, 'día', 'días') + '.'
                : 'Este mes no hay ánimos apuntados.') + '</p>' +
              '<div class="mood-month">' + M.distribution(stats) + M.calendar(state.key, stats) + '</div>' +
            '</section>' +
            '<section class="card" aria-labelledby="m-trend"><h2 id="m-trend">Mes a mes</h2>' +
              '<p class="soft">Los últimos 12 meses. Pulsa una columna para ver ese mes.</p>' + M.trend(trend, state.key) + '</section>' +
            '<section class="card" aria-labelledby="m-assoc"><h2 id="m-assoc">Etiquetas y ánimo</h2>' +
              '<p class="soft">Una pista, no una conclusión: dos cosas que aparecen juntas no significan que una cause la otra.</p>' + M.associations(assoc) + '</section>' +
            '<p class="soft footnote">Estas cifras solo cuentan lo que has apuntado. No dicen qué ánimo es mejor o peor, ni por qué te sentiste así, y con pocos registros pueden cambiar mucho.</p>';
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
