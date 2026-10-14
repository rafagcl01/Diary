// Piezas de HTML del diario. Todo lo que viene del usuario (títulos, textos, etiquetas, emociones) se escapa aquí.
// Vocabulario: "página" = un día; "entrada" = cada pieza de esa página (en el código, `blocks`).
(function (App) {
  var D = App.diary, esc = App.escapeHtml, icon = App.icon;

  // Cara de un estado de ánimo (el color nunca es lo único que lo identifica: siempre va con su nombre).
  function face(mood, size) {
    var known = D.isKnownMood(mood);
    return '<span class="face' + (size ? ' ' + size : '') + ' m-' + (known ? esc(mood) : 'neutro') + '" aria-hidden="true">' + icon('f-' + (known ? mood : 'neutro')) + '</span>';
  }
  function moodTag(mood) {
    return '<span class="mood-tag">' + face(mood, 'small') + '<span>' + esc(D.moodLabel(mood)) + '</span></span>';
  }
  // Emociones de una entrada, con su símbolo y su nombre. `byId` es el mapa de la biblioteca de emociones.
  function emotionChip(e, extra) {
    return '<li class="chip emo-chip">' + icon(D.isSymbol(e.symbol) ? e.symbol : 'heart') + '<span>' + esc(e.name) + '</span>' + (extra || '') + '</li>';
  }
  function emotionList(ids, byId, label) {
    var items = (ids || []).map(function (id) { return byId && byId[id] ? emotionChip(byId[id]) : ''; }).join('');
    return items ? '<ul class="chips entry-emotions" aria-label="' + (label || 'Emociones') + '">' + items + '</ul>' : '';
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
  function percentHtml(entry, small) { return App.percentUi ? App.percentUi.html(D.dayMood(entry), { small: small }) : ''; }

  // Cabecera de la página, DENTRO de la hoja: la fecha y el título (o solo la fecha) y el porcentaje de ánimo.
  // El h1 es el título si lo hay; si no, la fecha.
  function sheetHead(day, title, pctHtml) {
    var long = esc(D.formatLong(day));
    var titles = title
      ? '<p class="date-line">' + long + '</p><h1 id="page-title" class="day-title" tabindex="-1">' + esc(title) + '</h1>'
      : '<h1 id="page-title" class="date-h1" tabindex="-1">' + long + '</h1>';
    return '<header class="sheet-head"><div class="sheet-titles">' + titles + '</div><div class="pct-slot" id="pct-slot">' + (pctHtml || '') + '</div></header>';
  }

  App.diaryHtml = {
    face: face, moodTag: moodTag, emotionChip: emotionChip, emotionList: emotionList, paragraphs: paragraphs, tagList: tagList, sheetHead: sheetHead,

    // Una página en la cronología (con su porcentaje de ánimo)
    item: function (entry) {
      var p = dayParts(entry.day), ex = D.excerpt(entry, 150), tags = D.entryTags(entry).slice(0, 4);
      return '<li><a class="entry-item" href="#/diario/' + esc(entry.day) + '">' +
        '<span class="entry-day"><b>' + p.n + '</b><span>' + esc(p.wd) + '</span></span>' +
        '<span class="entry-body">' +
          '<span class="entry-title">' + esc(D.displayTitle(entry)) +
            (entry.favorite ? '<span class="fav">' + icon('star', 'filled') + '<span class="sr">Favorita</span></span>' : '') + '</span>' +
          (entry.title && ex ? '<span class="entry-excerpt">' + esc(ex) + '</span>' : '') +
          '<span class="entry-meta">' + plural(entry.blocks.length, 'entrada', 'entradas') +
            (tags.length ? '<span class="entry-taglist">' + tags.map(function (t) { return '#' + esc(t); }).join(' ') + '</span>' : '') +
          '</span>' +
        '</span>' +
        '<span class="entry-pct">' + percentHtml(entry, true) + '</span></a></li>';
    },

    // Cronología agrupada por mes; muestra como mucho `shown` páginas
    list: function (entries, shown) {
      var html = '';
      D.groupByMonth(entries.slice(0, shown)).forEach(function (g) {
        html += '<h2 class="month-title">' + esc(D.formatMonth(g.key)) + '</h2><ul class="entries">' + g.entries.map(App.diaryHtml.item).join('') + '</ul>';
      });
      if (entries.length > shown) html += '<button type="button" class="btn secondary" id="show-more">Mostrar más (' + (entries.length - shown) + ')</button>';
      return html;
    },

    // Calendario del mes: cada día lleva a su página (o a escribirla, si aún no existe). Los días futuros no.
    calendar: function (grid, todayKey) {
      var label = D.formatMonth(grid.year + '-' + ('0' + (grid.month + 1)).slice(-2));
      var dow = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(function (d) { return '<span class="dow" aria-hidden="true">' + d + '</span>'; }).join('');
      var cells = grid.weeks.map(function (w) {
        return w.map(function (c) {
          if (!c) return '<span class="day blank" aria-hidden="true"></span>';
          var when = c.day + ' de ' + label.split(' ')[0];
          if (c.key > todayKey) return '<span class="day future" aria-hidden="true">' + c.day + '</span>';
          var cls = 'day' + (c.has ? ' has' : '') + (c.key === todayKey ? ' today' : '');
          var aria = c.has ? when + ', ' + plural(c.blocks, 'entrada', 'entradas') : when + ', sin página: escribir ese día';
          return '<a class="' + cls + '" href="#/diario/' + c.key + (c.has ? '' : '/editar') + '" aria-label="' + esc(aria) + '">' + c.day + '</a>';
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
        '<p>Hay ' + plural(info.count, 'entrada escrita', 'entradas escritas') + ' con el formato antiguo (varias por día). La actualización las une en <b>una página por día</b>, ' +
        'con cada texto como una entrada, y no pierde nada; GitHub conserva el historial. Hasta entonces no se puede guardar. ' +
        'Te recomiendo descargar antes una copia en <a href="#/ajustes">Configuración</a>.</p>' +
        '<p style="margin-top: 12px"><button type="button" class="btn" id="migrate">Actualizar formato</button></p>' +
        '<p class="msg" id="migrate-msg" role="status" data-kind="info"></p></section>';
    },

    // Una página leída: la fecha y el título dentro de la hoja, el porcentaje de ánimo arriba y cada entrada con su
    // texto, su estado, sus emociones y sus etiquetas. `byId` es el mapa de emociones (puede faltar).
    sheet: function (entry, byId) {
      var blocks = entry.blocks.map(function (b) {
        var meta = (b.mood ? moodTag(b.mood) : '') + emotionList(b.emotions, byId, 'Emociones de la entrada') + tagList(b.tags, 'Etiquetas de la entrada');
        return '<section class="block-read">' + (b.text ? paragraphs(b.text) : '') + (meta ? '<div class="block-meta-read">' + meta + '</div>' : '') + '</section>';
      }).join('<hr class="stitch-line">');
      return '<article class="card paper sheet" aria-label="Página del día">' +
        sheetHead(entry.day, entry.title, percentHtml(entry, false)) +
        (blocks || '<p class="soft">Esta página solo tiene título.</p>') + '</article>';
    },

    // Pasar la página: día anterior y siguiente con página
    pageNav: function (nb) {
      function link(day, label) {
        if (!day) return '<span class="btn secondary" aria-disabled="true">' + label + '</span>';
        return '<a class="btn secondary" href="#/diario/' + esc(day) + '" title="' + esc(D.formatLong(day)) + '">' + label + '</a>';
      }
      return '<nav class="page-nav" aria-label="Pasar de página">' +
        link(nb.prev, icon('chev-l') + 'Página anterior') +
        '<a class="btn secondary" href="#/diario">Volver al diario</a>' +
        link(nb.next, 'Página siguiente' + icon('chev-r')) + '</nav>';
    }
  };
})(window.App = window.App || {});
