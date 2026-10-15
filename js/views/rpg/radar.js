// Gráfico radar del personaje: una estrella de cinco puntas de fondo (con sus puntas unidas por un pentágono),
// y el progreso como un polígono relleno y translúcido. Las puntas son botones (teclado y táctil): al elegir una
// se enseñan sus subcategorías. Solo dibuja; los números salen de App.rpg.computeState.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml;
  App.rpgViews = App.rpgViews || {};

  var W = 440, H = 420, CX = 220, CY = 212, RAD = 118, LABEL = 146;

  function angle(i) { return (-90 + 72 * i) * Math.PI / 180; }
  function pt(i, r) { return [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))]; }
  function fmt(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }
  function poly(rs) { return rs.map(function (r, i) { return fmt(pt(i, r)); }).join(' '); }

  // Qué tan lejos del centro está un valor (0–1 del radio).
  App.rpgViews.radarRadius = function (value, cap) { return Math.min(1, Math.max(0, value / cap)); };

  App.rpgViews.radar = function (mains, o) {
    o = o || {};
    var cap = R.radarCap(mains), sel = o.selected || '';
    var n = mains.length;
    var rings = [0.25, 0.5, 0.75].map(function (f) { return '<polygon class="rd-ring" points="' + poly(mains.map(function () { return RAD * f; })) + '"/>'; }).join('');
    var outer = poly(mains.map(function () { return RAD; }));
    var star = [];
    for (var i = 0; i < n; i++) { var a = pt(i, RAD), b = pt((i + 2) % n, RAD); star.push('<line class="rd-star" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '"/>'); }
    var spokes = mains.map(function (m, i) { var p = pt(i, RAD); return '<line class="rd-spoke" x1="' + CX + '" y1="' + CY + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; }).join('');
    var radii = mains.map(function (m) { return RAD * Math.max(0.035, App.rpgViews.radarRadius(m.value, cap)); });
    var dots = mains.map(function (m, i) { var p = pt(i, radii[i]); return '<circle class="rd-dot' + (m.id === sel ? ' on' : '') + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5"/>'; }).join('');
    var labels = mains.map(function (m, i) {
      var p = pt(i, LABEL), x = p[0], y = p[1];
      var anchor = Math.abs(Math.cos(angle(i))) < 0.2 ? 'middle' : Math.cos(angle(i)) > 0 ? 'start' : 'end';
      var dy = Math.sin(angle(i)) < -0.5 ? -8 : Math.sin(angle(i)) > 0.5 ? 14 : 0;
      var pct = Math.round(m.fraction * 100);
      var text = m.name + ', nivel ' + m.level + ', ' + pct + ' por ciento hacia el siguiente';
      return '<g class="rd-label' + (m.id === sel ? ' on' : '') + '" data-main="' + esc(m.id) + '" role="button" tabindex="0" aria-pressed="' + (m.id === sel) + '" aria-label="' + esc(text) + '">' +
        '<title>' + esc(text) + '</title>' +
        '<rect class="rd-hit" x="' + (anchor === 'end' ? x - 96 : anchor === 'middle' ? x - 48 : x - 4) + '" y="' + (y + dy - 22) + '" width="100" height="42" rx="12"/>' +
        '<text class="rd-name" x="' + x.toFixed(1) + '" y="' + (y + dy - 3).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(m.name) + '</text>' +
        '<text class="rd-lv" x="' + x.toFixed(1) + '" y="' + (y + dy + 15).toFixed(1) + '" text-anchor="' + anchor + '">Nv ' + m.level + ' · ' + pct + '%</text></g>';
    }).join('');
    var summary = mains.map(function (m) { return m.name + ' nivel ' + m.level; }).join(', ');
    return '<figure class="radar" data-cap="' + cap + '">' +
      '<svg class="radar-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Radar de atributos: ' + esc(summary) + '">' +
        '<defs><linearGradient id="rd-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--rd-a, #F08BB5)"/><stop offset="1" stop-color="var(--rd-b, #B9A7E0)"/></linearGradient></defs>' +
        '<g aria-hidden="true"><circle class="rd-halo" cx="' + CX + '" cy="' + CY + '" r="' + (RAD + 12) + '"/>' + rings + '<polygon class="rd-outer" points="' + outer + '"/>' + star.join('') + spokes +
        '<polygon class="rd-area" points="' + poly(radii) + '"/>' + dots + '</g>' + labels +
      '</svg>' +
      '<figcaption class="soft">El borde exterior es el nivel ' + (cap + 1) + '. La escala crece sola a medida que subes.</figcaption>' +
    '</figure>';
  };
})(window.App = window.App || {});
