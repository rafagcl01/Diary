// Avatar del personaje: la imagen (foto, GIF o símbolo) dentro de un marco que mejora con el nivel (R.AVATAR_FRAMES).
// Los marcos son solo decoración: se dibujan aquí en SVG, uno por id. Para cambiar un marco, cambia su dibujo en FRAMES.
// Si el GIF no carga, se ve el símbolo (ver V.avatarFallback). Con una sombra sin purificar, encima va un glitch.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon;
  var V = App.rpgViews = App.rpgViews || {};
  var C = 100;   // centro del dibujo (viewBox 0 0 200 200); la imagen ocupa el círculo central

  function n(v) { return Math.round(v * 10) / 10; }
  function circle(r, attrs) { return '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" ' + attrs + '/>'; }
  function around(count, fn) { var out = ''; for (var i = 0; i < count; i++) out += fn(i / count * Math.PI * 2, i); return out; }

  function ring(count, r, fn) { return around(count, function (a, i) { return fn(C + r * Math.cos(a - Math.PI / 2), C + r * Math.sin(a - Math.PI / 2), a, i); }); }
  // Punto a `r` del centro y `deg` grados (0 = arriba, en el sentido del reloj).
  function pol(r, deg) { var a = deg * Math.PI / 180; return [n(C + r * Math.sin(a)), n(C - r * Math.cos(a))]; }
  function pts(list) { return list.map(function (p) { return pol(p[0], p[1]).join(' '); }).join('L'); }
  var INK = '#19131B';
  var uid = 0;   // ids únicos para las máscaras (el mismo marco se pinta varias veces: ficha, glitch, pantalla de nivel…)

  // Un botón de muñeca: aro, borde interior, cuatro agujeros y el hilo cosido en cruz.
  function button(x, y, r, fill, thread, holes) {
    var o = r * 0.3, h = Math.max(0.9, r * 0.12);
    return '<g><circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="' + n(r * 0.72) + '" fill="none" stroke="rgba(25,19,27,.28)" stroke-width="1"/>' +
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(function (d) { return '<circle cx="' + n(x + d[0] * o) + '" cy="' + n(y + d[1] * o) + '" r="' + n(h) + '" fill="' + (holes || INK) + '"/>'; }).join('') +
      '<path d="M' + n(x - o) + ' ' + n(y - o) + 'L' + n(x + o) + ' ' + n(y + o) + 'M' + n(x + o) + ' ' + n(y - o) + 'L' + n(x - o) + ' ' + n(y + o) + '" stroke="' + thread + '" stroke-width="' + n(Math.max(1.1, r * 0.14)) + '" stroke-linecap="round"/></g>';
  }
  // Un lazo de satén: dos lazadas con su pliegue y su brillo, nudo y dos caídas cortadas en V. Centrado en (0,0).
  function bow(fill, shade, line) {
    return '<g stroke="' + line + '" stroke-width="1.5" stroke-linejoin="round">' +
      '<path d="M-3 3L-15 27-9 24-5 31 3 4Z" fill="' + shade + '"/><path d="M3 3L15 27 9 24 5 31-3 4Z" fill="' + shade + '"/>' +
      '<path d="M0 0C-12-14-34-16-38-4-41 7-22 14 0 0Z" fill="' + fill + '"/><path d="M0 0C12-14 34-16 38-4 41 7 22 14 0 0Z" fill="' + fill + '"/>' +
      '<path d="M-4-1C-14-8-26-9-31-4M4-1C14-8 26-9 31-4" fill="none" stroke="' + shade + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M-6-2C-14 0-22 3-28 2M6-2C14 0 22 3 28 2" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2" stroke-linecap="round"/>' +
      '<rect x="-6" y="-7" width="12" height="14" rx="4" fill="' + shade + '"/><path d="M-3-3.5v7" stroke="rgba(25,19,27,.35)" stroke-width="1"/></g>';
  }

  // ---- Cabeza de muñeca rota (marco del nivel 30) ----
  // La silueta de la cabeza de porcelana con un hueco roto por delante (evenodd): por el hueco se ve el avatar. El hueco es
  // casi el círculo del retrato por arriba y los lados, y sube por abajo: la barbilla de porcelana tapa un poco.
  var HEAD = 'M100 14C150 14 182 52 180 100C178 140 160 176 132 188C120 194 80 194 68 188C40 176 22 140 20 100C18 52 50 14 100 14Z';
  var JAG = [0, 3, -2, 4, -3, 1, -4, 3, -1, 2, -3, 4, -2, 0, 3, -4, 2, -1, 4, -3, 1, -2, 3, -4, 0, 2, -3, 4, -1, 3, -2, 1, -4, 2, -3, 3];
  function holePath() {
    return 'M' + JAG.map(function (j, i) {
      var a = i * 10, low = Math.max(0, Math.cos((a - 180) * Math.PI / 120));
      return pol(61 - 15 * low + j * 0.9, a).join(' ');
    }).join('L') + 'Z';
  }
  function crack(list) { var d = 'M' + pts(list); return '<path d="' + d + '" fill="none" stroke="#2A1A24" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".8" stroke-linejoin="round"/>'; }
  function ringlets(x, dir) {
    return [96, 120, 144].map(function (y, i) {
      var cx = x + dir * (i % 2) * 3;
      return '<circle cx="' + cx + '" cy="' + y + '" r="10" fill="#4A2140" stroke="' + INK + '" stroke-width="1.3"/><path d="M' + (cx - 4) + ' ' + y + 'a4 4 0 1 1 4 4a2.4 2.4 0 1 1-2-3" fill="none" stroke="#C2407E" stroke-width="1.2" stroke-linecap="round"/>';
    }).join('');
  }
  function brokenHead() {
    var id = 'frh' + (++uid);
    // El cacho que falta arriba a la izquierda: entre dos bordes dentados, desde fuera de la cabeza hasta el hueco.
    var top = [[104, -16], [92, -9], [84, -19], [76, -7], [67, -15], [58, -5]], left = [[56, -80], [64, -92], [72, -81], [81, -95], [90, -84], [104, -93]];
    var outer = [], inner = [], a;
    for (a = -93; a <= -16; a += 4) outer.push([108, a]);
    for (a = -5; a >= -80; a -= 5) inner.push([48, a]);
    var chunk = 'M' + pts(left.concat(outer, top, inner)) + 'Z', hole = holePath();
    var portrait = 'M36 100a64 64 0 1 0 128 0a64 64 0 1 0-128 0Z';   // el círculo del retrato
    var box = 'maskUnits="userSpaceOnUse" x="-30" y="-30" width="260" height="260"';
    var hair = '<path d="M100 6C56 6 18 40 22 92C30 64 52 44 74 38Q88 42 100 33Q112 42 126 38C148 44 170 64 178 92C182 40 144 6 100 6Z" fill="#4A2140" stroke="' + INK + '" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M100 10v22M140 22c-10 4-20 10-26 16" stroke="#6E3A66" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    var shards = [[96, -54, 30, 0, 1.3], [112, -40, -20, 1, 1.1], [118, -70, 55, 0, 0.85], [104, -26, -40, 0, 0.85], [124, -55, 10, 0, 0.85]].map(function (s) {
      var p = pol(s[0], s[1]);
      return '<path d="M0-6L7-2 4 6-5 4-7-3Z" transform="translate(' + p[0] + ' ' + p[1] + ') rotate(' + s[2] + ') scale(' + s[4] + ')" fill="' + (s[3] ? '#4A2140' : '#FFF9F1') + '" stroke="' + (s[3] ? INK : '#B9A4B4') + '" stroke-width="1.1" stroke-linejoin="round"/>';
    }).join('');
    function rim(list, dx) {
      var d = 'M' + pts(list);
      return '<path d="' + d + '" fill="none" stroke="#FFF9F1" stroke-width="5" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#5A4651" stroke-width="1.2" stroke-linejoin="round" transform="translate(' + dx + ' 1.8)"/>';
    }
    return '<defs><mask id="' + id + 'm" ' + box + '><rect x="-30" y="-30" width="260" height="260" fill="#fff"/><path d="' + chunk + '" fill="#000"/></mask>' +
        '<mask id="' + id + 'i" ' + box + '><path d="' + chunk + '" fill="#fff"/><path d="' + portrait + '" fill="#000"/></mask>' +
        '<clipPath id="' + id + 'h"><path d="' + HEAD + '"/></clipPath></defs>' +
      ringlets(174, 1) +
      // Por el cacho se ve el hueco oscuro de dentro y la pared interior de la nuca (solo fuera del retrato).
      '<g clip-path="url(#' + id + 'h)" mask="url(#' + id + 'i)"><path d="' + chunk + '" fill="#120C14"/>' +
        '<path d="' + HEAD + '" fill="none" stroke="#FFF9F1" stroke-opacity=".28" stroke-width="7" transform="translate(16 18) scale(.84)"/>' +
        '<path d="' + HEAD + '" fill="none" stroke="#FFF9F1" stroke-opacity=".12" stroke-width="3" transform="translate(26 28) scale(.74)"/></g>' +
      '<g mask="url(#' + id + 'm)">' + ringlets(26, -1) +
        '<path d="' + HEAD + hole + '" fill="#FFF9F1" fill-rule="evenodd" stroke="#B9A4B4" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="' + hole + '" fill="none" stroke="#fff" stroke-width="1" opacity=".7" transform="translate(1.2 1.2)"/>' +
        '<circle cx="46" cy="140" r="10" fill="#F08BB5" opacity=".38"/><circle cx="154" cy="140" r="10" fill="#F08BB5" opacity=".38"/>' + hair +
        crack([[64, 32], [72, 26], [80, 34], [87, 28]]) + crack([[72, 26], [78, 16]]) + crack([[62, 96], [70, 102], [77, 94], [85, 99]]) +
        crack([[50, 212], [60, 220], [69, 211], [79, 219], [87, 214]]) + crack([[60, 220], [66, 232], [74, 236]]) + crack([[60, 298], [70, 293], [78, 301], [86, 296]]) +
        crack([[66, -4], [74, 6], [70, 14], [80, 20]]) + crack([[70, -96], [78, -110], [86, -104]]) +
        '<g transform="translate(146 26) rotate(18) scale(.5)">' + bow('#F3C6DA', '#DFA1BD', INK) + '</g></g>' +
      // La boquita pintada en la barbilla.
      '<path d="M92 170c3-3 6-3 8 0 2-3 5-3 8 0-2 5-6 7-8 7s-6-2-8-7z" fill="#C2407E" stroke="#8A2457" stroke-width="1" stroke-linejoin="round"/><path d="M93 171.5c4 1.5 10 1.5 14 0" stroke="#8A2457" stroke-width=".9" fill="none"/>' +
      // El grosor de la porcelana en los bordes del cacho, y las esquirlas que saltan.
      '<g clip-path="url(#' + id + 'h)" mask="url(#' + id + 'i)">' + rim(top, -1.8) + rim(left, 1.8) + '</g>' + shards;
  }

  // Dibujos de los marcos, por id (la lista y sus niveles, en `frames` de rpg/config.js). La imagen ocupa el círculo
  // central (radio 64 en este dibujo de 200 × 200); el marco va alrededor y puede salirse un poco.
  var FRAMES = {
    puntada: function () { return circle(72, 'class="fr-line"') + circle(79, 'class="fr-stitch"'); },
    hilo_suelto: function () { return '<path class="fr-stitch" d="M100 23a77 77 0 1 1-54 22"/><path class="fr-thread" d="M46 45c-12-14-6-30 8-30 12 0 10 14-2 16"/><path class="fr-needle" d="M51 31l18-14"/>'; },
    // Nivel 15: doce botones de muñeca de dos tamaños ensartados en un hilo; el de arriba, ciruela y más grande, como un cierre.
    collar_botones: function () {
      return circle(78, 'fill="none" stroke="#F3C6DA" stroke-width="1.8" stroke-dasharray="3 4" stroke-linecap="round"') +
        around(12, function (x, i) {
          var p = pol(79, i * 30);
          if (i === 0) return button(p[0], p[1], 15, '#6E3A66', '#F3C6DA', '#FFF5F8');
          return i % 2 ? button(p[0], p[1], 9, '#C9B9E8', '#A52E69') : button(p[0], p[1], 12, '#F3C6DA', '#A52E69');
        });
    },
    // Nivel 23: borde de encaje en ondas con calados (un anillo: el centro, hueco) y tres lacitos ciruela.
    lacitos_encaje: function () {
      var d = '', i, p, q, r;
      for (i = 0; i < 36; i++) { p = pol(78, i * 10); q = pol(88, i * 10 + 5); r = pol(78, i * 10 + 10); d += (i ? 'L' : 'M') + p[0] + ' ' + p[1] + 'Q' + q[0] + ' ' + q[1] + ' ' + r[0] + ' ' + r[1]; }
      var holes = around(36, function (x, k) { var h = pol(81.5, k * 10 + 5); return '<circle cx="' + h[0] + '" cy="' + h[1] + '" r="1.3" fill="#F3C6DA"/>'; });
      var bows = [0, 120, 240].map(function (deg) { var b = pol(84, deg); return '<g transform="translate(' + b[0] + ' ' + b[1] + ') rotate(' + deg + ') scale(.42)">' + bow('#6E3A66', '#4A2140', '#F3C6DA') + '</g>'; }).join('');
      return '<path d="' + d + 'ZM27 100a73 73 0 1 0 146 0a73 73 0 1 0-146 0Z" fill="#FFF5F8" fill-rule="evenodd" stroke="#F3C6DA" stroke-width="1.4" stroke-linejoin="round"/>' +
        circle(73, 'fill="none" stroke="#C9B9E8" stroke-width="2"') + holes + bows;
    },
    // Nivel 30: la cabeza de muñeca rota con el avatar dentro.
    cabeza_rota: brokenHead
  };

  V.frameSvg = function (id) {
    return '<svg class="fr-deco" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' + (FRAMES[id] || FRAMES.puntada)() + '</svg>';
  };
  // Constelaciones (pasado el nivel 30): una estrella por cada 3.000 XP alrededor del marco. Se ven 12 como mucho y,
  // desde ahí, el número («✦ 15»).
  V.starsSvg = function (count) {
    if (!(count > 0)) return '';
    var shown = Math.min(12, count);
    return '<svg class="fr-deco fr-stars" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' + ring(shown, 97, function (x, y) {
      return '<path class="fr-star" d="M' + n(x) + ' ' + n(y - 6) + 'l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z"/>';
    }) + (count > 12 ? '<text class="fr-star-n" x="100" y="198" text-anchor="middle">✦ ' + count + '</text>' : '') + '</svg>';
  };

  // Glitch de sombra (ver rpg/shadows.js, R.shadowAura) encima del avatar: tres franjas del propio avatar desplazadas
  // (con el hueco en negro), los bordes desdoblados en magenta y lavanda, líneas de barrido y píxeles muertos.
  // 'calm' (purificada hoy): las franjas y las líneas se quedan quietas y muy suaves; colores y píxeles se van.
  // El movimiento son tirones cortos; con «Efectos» apagado (o movimiento reducido) se queda quieto.
  function glitch(inner, aura) {
    return '<span class="av-gl" data-aura="' + aura + '" aria-hidden="true">' +
      // La franja (.gl-slice) recorta una banda fija; dentro, la copia del avatar (.gl-move) es la que se desplaza.
      ['s1', 's2', 's3'].map(function (c) { return '<span class="gl-slice ' + c + '"><span class="gl-move">' + inner + '</span></span>'; }).join('') +
      '<span class="gl-ch gl-m"></span><span class="gl-ch gl-l"></span><span class="gl-scan"></span>' +
      '<i class="gl-px p1"></i><i class="gl-px p2 lit"></i><i class="gl-px p3"></i><i class="gl-px p4 lit"></i><i class="gl-px p5"></i></span>';
  }

  // profile: { name, avatar, image }. level: nivel general. o.size: 'large' (ficha) | 'medium' (configuración).
  // o.aura: 'glitch' | 'calm' | null (sombras).
  V.avatar = function (profile, level, o) {
    o = o || {};
    var f = R.frameFor(level || 1).frame, img = profile && profile.image, sym = (profile && profile.avatar) || 'mended';
    var pic;
    if (img && img.kind === 'photo') pic = '<img src="' + esc(img.data) + '" alt="">';
    else if (img && img.kind === 'url') pic = '<img src="' + esc(img.url) + '" alt="" referrerpolicy="no-referrer" decoding="async" data-symbol="' + esc(sym) + '">';
    else pic = icon(sym);
    var inner = '<span class="av-pic' + (img ? ' has-img' : '') + '">' + pic + '</span>' + V.frameSvg(f.id) + V.starsSvg(o.stars);
    var aura = o.aura === 'glitch' || o.aura === 'calm' ? o.aura : null;
    var label = o.label || ('Avatar con el marco ' + f.name);
    if (aura === 'glitch') label += '. Tiene una sombra sin purificar';
    if (o.stars > 0) label += '. ' + o.stars + (o.stars === 1 ? ' estrella' : ' estrellas') + ' en su constelación';
    return '<div class="av-frame ' + (o.size || 'large') + (aura ? ' av-aura' : '') + '" data-frame="' + esc(f.id) + '" role="img" aria-label="' + esc(label) + '">' +
      inner + (aura ? glitch(inner, aura) : '') + '</div>';
  };
  // Si el GIF no carga (enlace roto, sin internet), se pone el símbolo. Se usa como escucha de 'error' en fase de captura.
  V.avatarFallback = function (ev) {
    var img = ev.target;
    if (!img || img.tagName !== 'IMG' || !img.getAttribute || !img.getAttribute('data-symbol')) return;
    var holder = img.parentNode;
    holder.classList.remove('has-img');
    holder.innerHTML = icon(img.getAttribute('data-symbol'));
  };
})(window.App = window.App || {});
