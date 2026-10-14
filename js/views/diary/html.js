// Piezas de HTML del diario. Todo lo que viene del usuario (títulos, textos, etiquetas) se escapa aquí.
(function (App) {
  var D = App.diary, esc = App.escapeHtml, icon = App.icon;

  // Cara de un ánimo (el color nunca es lo único que lo identifica: siempre va con su nombre).
  function face(mood, size) {
    var known = D.isKnownMood(mood);
    return '<span class="face' + (size ? ' ' + size : '') + ' m-' + (known ? esc(mood) : 'normal') + '" aria-hidden="true">' + icon('f-' + (known ? mood : 'normal')) + '</span>';
  }
  function moodTag(mood) {
    return '<span class="mood-tag">' + face(mood, 'small') + '<span>' + esc(D.moodLabel(mood)) + '</span></span>';
  }
  function paragraphs(text) {
    return String(text).split(/\n[ \t]*\n/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('');
  }
  function tagList(tags, label) {
    if (!tags || !tags.length) return '';
    return '<ul class="chips entry-tags" aria-label="' + (label || 'Etiquetas') + '">' + tags.map(function (t) {
      return '<li class="chip">#' + esc(t) + '</li>';
    }).join('') + '</ul>';
  }
  function dayParts(day) {
    var d = D.parseDay(day);
    return { n: d ? d.getDate() : '', wd: d ? d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '') : '' };
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  App.diaryHtml = {
    face: face, moodTag: moodTag, paragraphs: paragraphs, tagList: tagList,

    // Un día en la cronología
    item: function (entry) {
      var p = dayParts(entry.day), ex = D.excerpt(entry, 150), moods = D.entryMoods(entry), tags = D.entryTags(entry).slice(0, 4);
      return '<li><a class="entry-item" href="#/diario/' + esc(entry.day) + '">' +
        '<span class="entry-day"><b>' + p.n + '</b><span>' + esc(p.wd) + '</span></span>' +
        '<span class="entry-body">' +
          '<span class="entry-title">' + esc(D.displayTitle(entry)) +
            (entry.favorite ? '<span class="fav">' + icon('star', 'filled') + '<span class="sr">Favorito</span></span>' : '') + '</span>' +
          (entry.title && ex ? '<span class="entry-excerpt">' + esc(ex) + '</span>' : '') +
          '<span class="entry-meta">' + plural(entry.blocks.length, 'bloque', 'bloques') +
            moods.map(function (m) { return face(m, 'tiny') + '<span class="sr">' + esc(D.moodLabel(m)) + '</span>'; }).join('') +
            (tags.length ? '<span class="entry-taglist">' + tags.map(function (t) { return '#' + esc(t); }).join(' ') + '</span>' : '') +
          '</span>' +
        '</span></a></li>';
    },

    // Cronología agrupada por mes; muestra como mucho `shown` días
    list: function (entries, shown) {
      var html = '';
      D.groupByMonth(entries.slice(0, shown)).forEach(function (g) {
        html += '<h2 class="month-title">' + esc(D.formatMonth(g.key)) + '</h2><ul class="entries">' + g.entries.map(App.diaryHtml.item).join('') + '</ul>';
      });
      if (entries.length > shown) html += '<button type="button" class="btn secondary" id="show-more">Mostrar más (' + (entries.length - shown) + ')</button>';
      return html;
    },

    // Calendario del mes: los días con entrada son pulsables para filtrar
    calendar: function (grid, selectedDay, todayKey) {
      var label = D.formatMonth(grid.year + '-' + ('0' + (grid.month + 1)).slice(-2));
      var dow = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="dow" aria-hidden="true">' + d + '</span>'; }).join('');
      var cells = grid.weeks.map(function (w) {
        return w.map(function (c) {
          if (!c) return '<span class="day blank" aria-hidden="true"></span>';
          var cls = 'day' + (c.has ? ' has' : '') + (c.key === todayKey ? ' today' : '') + (c.key === selectedDay ? ' sel' : '');
          var aria = c.day + ' de ' + label.split(' ')[0] + (c.has ? ', ' + plural(c.blocks, 'bloque', 'bloques') : ', sin entrada');
          return '<button type="button" class="' + cls + '" data-day="' + c.key + '" aria-pressed="' + (c.key === selectedDay) + '" aria-label="' + esc(aria) + '"' + (c.has ? '' : ' disabled') + '>' + c.day + '</button>';
        }).join('');
      }).join('');
      return '<div class="card cal-card">' +
        '<div class="cal-head">' +
          '<button type="button" class="cal-nav" data-nav="-1" aria-label="Mes anterior">' + icon('chev-l') + '</button>' +
          '<h2 class="cal-title">' + esc(label) + '</h2>' +
          '<button type="button" class="cal-nav" data-nav="1" aria-label="Mes siguiente">' + icon('chev-r') + '</button>' +
        '</div><div class="cal">' + dow + cells + '</div></div>';
    },

    // Aviso de borradores pendientes
    drafts: function (drafts) {
      if (!drafts.length) return '';
      return '<section class="draft-banner" aria-label="Borradores pendientes"><h2>Trabajo pendiente</h2><ul>' + drafts.map(function (d) {
        var firstText = '';
        d.blocks.forEach(function (b) { if (!firstText && b.text.trim()) firstText = b.text.replace(/\s+/g, ' ').trim().slice(0, 60); });
        var label = d.title.trim() || firstText || 'Sin título';
        return '<li><span><b>' + esc(label) + '</b><br><small class="soft">Sin guardar, ' + esc(D.formatLong(d.day)) + '</small></span>' +
          '<span class="btn-row"><a class="btn secondary" href="#/diario/' + esc(d.day) + '/editar">Continuar</a>' +
          '<button type="button" class="btn secondary" data-draft-discard="' + esc(d.key) + '">Descartar</button></span></li>';
      }).join('') + '</ul></section>';
    },

    // Aviso para actualizar el formato antiguo
    legacy: function (info) {
      if (!info || !info.months.length) return '';
      return '<section class="draft-banner" aria-label="Actualizar el formato"><h2>Actualizar el formato del diario</h2>' +
        '<p>Hay ' + plural(info.count, 'entrada escrita', 'entradas escritas') + ' con el formato antiguo (varias por día). La actualización las une en <b>una entrada por día</b>, ' +
        'con cada texto como un bloque, y no pierde nada; GitHub conserva el historial. Hasta entonces no se puede guardar. ' +
        'Te recomiendo descargar antes una copia en <a href="#/ajustes">Configuración</a>.</p>' +
        '<p style="margin-top: 12px"><button type="button" class="btn" id="migrate">Actualizar formato</button></p>' +
        '<p class="msg" id="migrate-msg" role="status" data-kind="info"></p></section>';
    },

    // Una entrada leída: cada bloque con su texto, su ánimo y sus etiquetas
    sheet: function (entry) {
      var blocks = entry.blocks.map(function (b) {
        var meta = (b.mood ? moodTag(b.mood) : '') + tagList(b.tags, 'Etiquetas del bloque');
        return '<section class="block-read">' + (b.text ? paragraphs(b.text) : '') + (meta ? '<div class="block-meta-read">' + meta + '</div>' : '') + '</section>';
      }).join('<hr class="stitch-line">');
      return '<article class="card paper sheet" aria-label="Entrada del día">' + (blocks || '<p class="soft">Esta entrada solo tiene título.</p>') + '</article>';
    }
  };
})(window.App = window.App || {});
