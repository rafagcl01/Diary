// Avatar del personaje: la imagen (foto, GIF o símbolo) dentro de un marco que mejora con el nivel (R.AVATAR_FRAMES).
// Los marcos son solo decoración: se dibujan aquí en SVG, uno por id. Para cambiar un marco, cambia su dibujo en FRAMES.
// Si el GIF no carga, se ve el símbolo (ver V.avatarFallback).
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

  var FRAMES = {
    puntada: function () { return circle(72, 'class="fr-line"') + circle(79, 'class="fr-stitch"'); },
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

  // profile: { name, avatar, image }. level: nivel general. o.size: 'large' (ficha) | 'medium' (configuración).
  V.avatar = function (profile, level, o) {
    o = o || {};
    var f = R.frameFor(level || 1).frame, img = profile && profile.image, sym = (profile && profile.avatar) || 'mended';
    var pic;
    if (img && img.kind === 'photo') pic = '<img src="' + esc(img.data) + '" alt="">';
    else if (img && img.kind === 'url') pic = '<img src="' + esc(img.url) + '" alt="" referrerpolicy="no-referrer" decoding="async" data-symbol="' + esc(sym) + '">';
    else pic = icon(sym);
    return '<div class="av-frame ' + (o.size || 'large') + '" data-frame="' + esc(f.id) + '" role="img" aria-label="' + esc(o.label || ('Avatar con el marco ' + f.name)) + '">' +
      '<span class="av-pic' + (img ? ' has-img' : '') + '">' + pic + '</span>' + V.frameSvg(f.id) + '</div>';
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
