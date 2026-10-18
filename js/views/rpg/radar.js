// Gráfico radar del personaje. Con cinco ejes (los atributos) el fondo es una estrella de cinco puntas con sus puntas
// unidas por un pentágono; con otro número de ejes (las subcategorías de un atributo) se adapta: polígono regular y,
// si hay cuatro o más, las diagonales "saltando una". El progreso es un polígono relleno y translúcido.
// Las puntas son botones (ratón, táctil y teclado). Solo dibuja: los números salen de App.rpg.computeState.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml;
  App.rpgViews = App.rpgViews || {};

  var W = 440, H = 400, CX = 220, CY = 200, RAD = 112, LABEL = 138;

  function angle(i, n) { return (-90 + 360 / n * i) * Math.PI / 180; }
  function pt(i, n, r) { return [CX + r * Math.cos(angle(i, n)), CY + r * Math.sin(angle(i, n))]; }
  function fmt(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }
  function poly(rs) { return rs.map(function (r, i) { return fmt(pt(i, rs.length, r)); }).join(' '); }

  // Qué tan lejos del centro está un valor (0–1 del radio).
  App.rpgViews.radarRadius = function (value, cap) { return Math.min(1, Math.max(0, value / cap)); };

  // items: [{ id, name, level, fraction, value, magic? }]. o: { selected, kind: 'main' | 'sub' }
  App.rpgViews.radar = function (items, o) {
    o = o || {};
    var sel = o.selected || '', n = items.length, kind = o.kind === 'sub' ? 'sub' : 'main';
    var cap = R.radarCap(items);
    var rings = [0.25, 0.5, 0.75].map(function (f) { return '<polygon class="rd-ring" points="' + poly(items.map(function () { return RAD * f; })) + '"/>'; }).join('');
    var star = [];
    if (n >= 4) for (var i = 0; i < n; i++) {
      if (n === 4 && i > 1) break;
      var a = pt(i, n, RAD), b = pt((i + 2) % n, n, RAD);
      star.push('<line class="rd-star" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>');
    }
    var spokes = items.map(function (m, i) { var p = pt(i, n, RAD); return '<line class="rd-spoke" x1="' + CX + '" y1="' + CY + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; }).join('');
    var radii = items.map(function (m) { return RAD * Math.max(0.035, App.rpgViews.radarRadius(m.value, cap)); });
    var dots = items.map(function (m, i) { var p = pt(i, n, radii[i]); return '<circle class="rd-dot' + (m.id === sel ? ' on' : '') + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5"/>'; }).join('');
    var labels = items.map(function (m, i) {
      var p = pt(i, n, LABEL), x = p[0], y = p[1], c = Math.cos(angle(i, n)), s = Math.sin(angle(i, n));
      var anchor = Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end';
      var dy = s < -0.5 ? -8 : s > 0.5 ? 14 : 0;
      var pct = Math.round(m.fraction * 100);
      var text = m.name + ', nivel ' + m.level + ', ' + pct + ' por ciento hacia el siguiente';
      return '<g style="--i:' + i + '" class="rd-label' + (m.id === sel ? ' on' : '') + (m.magic ? ' magic' : '') + '" data-' + kind + '="' + esc(m.id) + '" role="button" tabindex="0" aria-pressed="' + (m.id === sel) + '" aria-label="' + esc(text) + '">' +
        '<title>' + esc(text) + '</title>' +
        '<rect class="rd-hit" x="' + (anchor === 'end' ? x - 98 : anchor === 'middle' ? x - 50 : x - 4) + '" y="' + (y + dy - 22) + '" width="102" height="42" rx="12"/>' +
        '<text class="rd-name" x="' + x.toFixed(1) + '" y="' + (y + dy - 3).toFixed(1) + '" text-anchor="' + anchor + '">' + (m.magic ? '✦ ' : '') + esc(m.name) + '</text>' +
        '<text class="rd-lv" x="' + x.toFixed(1) + '" y="' + (y + dy + 15).toFixed(1) + '" text-anchor="' + anchor + '">Nv ' + m.level + ' · ' + pct + '%</text></g>';
    }).join('');
    var summary = items.map(function (m) { return m.name + ' nivel ' + m.level; }).join(', ');
    return '<figure class="radar' + (o.animate ? ' rd-anim' : '') + '" data-cap="' + cap + '" data-kind="' + kind + '">' +
      '<svg class="radar-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Radar de ' + (kind === 'sub' ? 'subcategorías' : 'atributos') + ': ' + esc(summary) + '">' +
        '<defs><linearGradient id="rd-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--rd-a, #F08BB5)"/><stop offset="1" stop-color="var(--rd-b, #B9A7E0)"/></linearGradient></defs>' +
        '<g aria-hidden="true"><circle class="rd-halo" cx="' + CX + '" cy="' + CY + '" r="' + (RAD + 12) + '"/>' + rings + '<polygon class="rd-outer" points="' + poly(items.map(function () { return RAD; })) + '"/>' + star.join('') + spokes +
        '<polygon class="rd-area" points="' + poly(radii) + '"/>' + dots + '</g>' + labels +
      '</svg>' +
      '<figcaption class="soft">Borde exterior: nivel ' + (cap + 1) + '. La escala crece sola.</figcaption>' +
    '</figure>';
  };
})(window.App = window.App || {});
