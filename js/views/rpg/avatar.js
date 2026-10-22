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

  // Ala de murciélago a un lado (-1 izquierda, 1 derecha).
  function wing(s) {
    var x = C + s * 62;
    return '<path class="fr-wing" d="M' + x + ' 82 C' + (x + s * 30) + ' 58 ' + (x + s * 58) + ' 66 ' + (x + s * 64) + ' 88 C' + (x + s * 50) + ' 86 ' + (x + s * 46) + ' 96 ' + (x + s * 48) + ' 104 C' +
      (x + s * 36) + ' 98 ' + (x + s * 30) + ' 106 ' + (x + s * 30) + ' 114 C' + (x + s * 20) + ' 106 ' + (x + s * 10) + ' 110 ' + x + ' 116"/>';
  }
  function thorns() {
    return around(22, function (a) {
      var d = 0.06, r1 = 78, r2 = 86;
      return '<path class="fr-thorn" d="M' + n(C + r1 * Math.cos(a - d)) + ' ' + n(C + r1 * Math.sin(a - d)) + 'L' + n(C + r2 * Math.cos(a)) + ' ' + n(C + r2 * Math.sin(a)) + 'L' + n(C + r1 * Math.cos(a + d)) + ' ' + n(C + r1 * Math.sin(a + d)) + 'Z"/>';
    });
  }
  function roses() {
    return [-50, 210, 100].map(function (deg) {
      var a = deg * Math.PI / 180, x = n(C + 76 * Math.cos(a)), y = n(C + 76 * Math.sin(a));
      return '<circle class="fr-rose" cx="' + x + '" cy="' + y + '" r="9"/><path class="fr-swirl" d="M' + (x - 4) + ' ' + y + 'a4 4 0 1 1 4 4a2.5 2.5 0 1 1-2-3"/>';
    }).join('');
  }
  function crown() {
    return '<path class="fr-crown" d="M70 30L76 6l12 16 12-22 12 22 12-16 6 24z"/>' +
      [[76, 12], [100, 7], [124, 12]].map(function (p) { return '<circle class="fr-gem" cx="' + p[0] + '" cy="' + p[1] + '" r="3.2"/>'; }).join('');
  }

  function cross(x, y, s) { return '<path class="fr-x" d="M' + n(x - s) + ' ' + n(y - s) + 'l' + 2 * s + ' ' + 2 * s + 'M' + n(x + s) + ' ' + n(y - s) + 'l' + (-2 * s) + ' ' + 2 * s + '"/>'; }
  function ring(count, r, fn) { return around(count, function (a, i) { return fn(C + r * Math.cos(a - Math.PI / 2), C + r * Math.sin(a - Math.PI / 2), a, i); }); }

  // Marcos del 1 al 30 (dibujos provisionales). Los de antes (rosas, alas, corona) se conservan por si se recuperan.
  var FRAMES = {
    puntada: function () { return circle(72, 'class="fr-line"') + circle(79, 'class="fr-stitch"'); },
    hilo_suelto: function () { return '<path class="fr-stitch" d="M100 23a77 77 0 1 1-54 22"/><path class="fr-thread" d="M46 45c-12-14-6-30 8-30 12 0 10 14-2 16"/><path class="fr-needle" d="M51 31l18-14"/>'; },
    puntada_doble: function () { return circle(72, 'class="fr-stitch"') + circle(84, 'class="fr-stitch lav"') + ring(12, 78, function (x, y) { return cross(x, y, 3.2); }); },
    encaje_lunar: function () {
      return ring(24, 82, function (x, y) { return '<circle class="fr-lace" cx="' + n(x) + '" cy="' + n(y) + '" r="6"/>'; }) + circle(73, 'class="fr-line lav"') +
        ring(4, 94, function (x, y) { return '<circle class="fr-moon" cx="' + n(x) + '" cy="' + n(y) + '" r="7"/><circle class="fr-moon-cut" cx="' + n(x + 3) + '" cy="' + n(y - 2) + '" r="6"/>'; });
    },
    lazo_ciruela: function () {
      return circle(73, 'class="fr-line"') + circle(80, 'class="fr-stitch"') +
        '<path class="fr-bow" d="M100 178c-14-12-34-14-36-4-2 9 18 12 36 4z"/><path class="fr-bow" d="M100 178c14-12 34-14 36-4 2 9-18 12-36 4z"/>' +
        '<path class="fr-bow" d="M96 180l-10 18 8-2 4 6 4-20zM104 180l10 18-8-2-4 6-4-20z"/><circle class="fr-bow" cx="100" cy="178" r="5"/>';
    },
    espinas_terciopelo: function () {
      return circle(77, 'class="fr-velvet"') + around(20, function (a) {
        var d = 0.07, r1 = 81, r2 = 91;
        return '<path class="fr-thorn" d="M' + n(C + r1 * Math.cos(a - d)) + ' ' + n(C + r1 * Math.sin(a - d)) + 'L' + n(C + r2 * Math.cos(a)) + ' ' + n(C + r2 * Math.sin(a)) + 'L' + n(C + r1 * Math.cos(a + d)) + ' ' + n(C + r1 * Math.sin(a + d)) + 'Z"/>';
      }) + circle(71, 'class="fr-stitch"');
    },
    corona_remendada: function () {
      return circle(72, 'class="fr-stitch"') + circle(82, 'class="fr-stitch lav"') +
        '<path class="fr-crown" d="M70 32L74 6l14 16 12-22 12 22 14-16 4 26z"/><rect class="fr-patch" x="91" y="12" width="14" height="12" rx="2" transform="rotate(-8 98 18)"/>' + cross(98, 18, 3) +
        '<circle class="fr-gem" cx="76" cy="12" r="3.2"/><circle class="fr-gem" cx="124" cy="12" r="3.2"/>';
    },
    encaje: function () {
      return around(28, function (a) { return '<circle class="fr-lace" cx="' + n(C + 80 * Math.cos(a)) + '" cy="' + n(C + 80 * Math.sin(a)) + '" r="6.2"/>'; }) + circle(73, 'class="fr-line lav"');
    },
    rosas: function () { return circle(76, 'class="fr-vine"') + thorns() + roses(); },
    alas: function () { return wing(-1) + wing(1) + circle(76, 'class="fr-vine lit"') + thorns() + roses(); },
    corona: function () { return circle(86, 'class="fr-glow"') + wing(-1) + wing(1) + circle(76, 'class="fr-vine lit"') + thorns() + roses() + crown(); }
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
