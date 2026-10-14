// Piezas de HTML del diario. Todo lo que viene del usuario (títulos, textos, etiquetas) se escapa aquí.
(function (App) {
  var D = App.diary, esc = App.escapeHtml, icon = App.icon;

  function paragraphs(entry) {
    return entry.blocks.map(function (b) {
      return '<p>' + esc(b.text).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function tagList(tags) {
    if (!tags || !tags.length) return '';
    return '<ul class="chips entry-tags" aria-label="Etiquetas">' + tags.map(function (t) {
      return '<li class="chip">#' + esc(t) + '</li>';
    }).join('') + '</ul>';
  }
  function favMark(entry) {
    return entry.favorite ? '<span class="fav">' + icon('star', 'filled') + '<span class="sr">Favorita</span></span>' : '';
  }
  function dayParts(dateStr) {
    var d = D.parseLocal(dateStr);
    return {
      n: d ? d.getDate() : '',
      wd: d ? d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '') : ''
    };
  }

  App.diaryHtml = {
    paragraphs: paragraphs,
    tagList: tagList,

    // Una entrada en la cronología
    item: function (entry) {
      var p = dayParts(entry.date), ex = D.excerpt(entry, 150);
      return '<li><a class="entry-item" href="#/diario/' + esc(entry.id) + '">' +
        '<span class="entry-day"><b>' + p.n + '</b><span>' + esc(p.wd) + '</span></span>' +
        '<span class="entry-body">' +
          '<span class="entry-title">' + esc(D.displayTitle(entry)) + favMark(entry) + '</span>' +
          (entry.title && ex ? '<span class="entry-excerpt">' + esc(ex) + '</span>' : '') +
          (entry.tags && entry.tags.length ? '<span class="entry-taglist">' + entry.tags.map(function (t) { return '#' + esc(t); }).join(' ') + '</span>' : '') +
        '</span></a></li>';
    },

    // Cronología agrupada por mes; muestra como mucho `shown` entradas
    list: function (entries, shown) {
      var visible = entries.slice(0, shown), html = '';
      D.groupByMonth(visible).forEach(function (g) {
        html += '<h2 class="month-title">' + esc(D.formatMonth(g.key)) + '</h2><ul class="entries">' + g.entries.map(App.diaryHtml.item).join('') + '</ul>';
      });
      if (entries.length > shown) html += '<button type="button" class="btn secondary" id="show-more">Mostrar más (' + (entries.length - shown) + ')</button>';
      return html;
    },

    // Calendario del mes: los días con entradas son pulsables para filtrar
    calendar: function (grid, selectedDay, todayKey) {
      var label = D.formatMonth(grid.year + '-' + ('0' + (grid.month + 1)).slice(-2));
      var dow = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="dow" aria-hidden="true">' + d + '</span>'; }).join('');
      var cells = grid.weeks.map(function (w) {
        return w.map(function (c) {
          if (!c) return '<span class="day blank" aria-hidden="true"></span>';
          var cls = 'day' + (c.count ? ' has' : '') + (c.key === todayKey ? ' today' : '') + (c.key === selectedDay ? ' sel' : '');
          var aria = c.day + ' de ' + label.split(' ')[0] + (c.count ? ', ' + c.count + (c.count === 1 ? ' entrada' : ' entradas') : ', sin entradas');
          return '<button type="button" class="' + cls + '" data-day="' + c.key + '" aria-pressed="' + (c.key === selectedDay) + '" aria-label="' + esc(aria) + '"' + (c.count ? '' : ' disabled') + '>' + c.day + '</button>';
        }).join('');
      }).join('');
      return '<div class="card cal-card">' +
        '<div class="cal-head">' +
          '<button type="button" class="cal-nav" data-nav="-1" aria-label="Mes anterior">' + icon('chev-l') + '</button>' +
          '<h2 class="cal-title">' + esc(label) + '</h2>' +
          '<button type="button" class="cal-nav" data-nav="1" aria-label="Mes siguiente">' + icon('chev-r') + '</button>' +
        '</div>' +
        '<div class="cal">' + dow + cells + '</div></div>';
    },

    // Aviso de borradores pendientes
    drafts: function (drafts) {
      if (!drafts.length) return '';
      return '<section class="draft-banner" aria-label="Borradores pendientes"><h2>Trabajo pendiente</h2><ul>' + drafts.map(function (d) {
        var label = d.title.trim() || d.text.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Sin título';
        var href = d.entryId ? '#/diario/' + esc(d.entryId) + '/editar' : '#/diario/nueva';
        return '<li><span><b>' + esc(label) + '</b><br><small class="soft">' + (d.entryId ? 'Edición sin guardar' : 'Entrada nueva sin guardar') + '</small></span>' +
          '<span class="btn-row"><a class="btn secondary" href="' + href + '">Continuar</a>' +
          '<button type="button" class="btn secondary" data-draft-discard="' + esc(d.key) + '">Descartar</button></span></li>';
      }).join('') + '</ul></section>';
    },

    // Vista de lectura: solo el texto, sin comandos ni metadatos técnicos
    sheet: function (entry) {
      return '<article class="card paper sheet" aria-label="Entrada">' +
        paragraphs(entry) + tagList(entry.tags) + '</article>';
    }
  };
})(window.App = window.App || {});
