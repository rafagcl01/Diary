// Dibujos de jefes (la «batería» incluida): criaturas creepy cute en SVG, sin descargar nada.
// También pinta la imagen de un jefe: un GIF/imagen por enlace (si falla al cargar, se cambia por un dibujo) o uno de estos dibujos.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml;
  var V = App.rpgViews = App.rpgViews || {};

  var EYE = '<ellipse class="ba-eye" cx="X" cy="Y" rx="5" ry="7"/><circle class="ba-shine" cx="X1" cy="Y1" r="1.8"/>';
  function eye(x, y) { return EYE.replace(/X1/g, x + 1.5).replace(/Y1/g, y - 2.5).replace(/X/g, x).replace(/Y/g, y); }

  var ART = {
    fantasma: '<path class="ba-body" d="M26 104V58a34 34 0 0 1 68 0v46l-11-9-11 9-12-9-12 9-11-9z"/><path class="ba-line" d="M26 104V58a34 34 0 0 1 68 0v46l-11-9-11 9-12-9-12 9-11-9z"/>' +
      '<path class="ba-gold" d="M38 30l6-14 8 9 8-12 8 12 8-9 6 14z"/>' + eye(48, 60) + eye(72, 60) + '<path class="ba-line" d="M52 78c4 5 12 5 16 0"/><circle class="ba-blush" cx="38" cy="72" r="5"/><circle class="ba-blush" cx="82" cy="72" r="5"/>',
    polilla: '<path class="ba-wing" d="M60 56C40 26 12 32 14 60c2 22 28 30 46 8z"/><path class="ba-wing" d="M60 56c20-30 48-24 46 4-2 22-28 30-46 8z"/>' +
      '<path class="ba-line" d="M60 56C40 26 12 32 14 60c2 22 28 30 46 8zM60 56c20-30 48-24 46 4-2 22-28 30-46 8z"/>' +
      '<path class="ba-bone" d="M60 38c-10 0-16 7-16 16 0 6 3 10 7 12v10h18V66c4-2 7-6 7-12 0-9-6-16-16-16z"/><path class="ba-line" d="M60 38c-10 0-16 7-16 16 0 6 3 10 7 12v10h18V66c4-2 7-6 7-12 0-9-6-16-16-16z"/>' +
      '<ellipse class="ba-eye" cx="53" cy="55" rx="4.5" ry="5.5"/><ellipse class="ba-eye" cx="67" cy="55" rx="4.5" ry="5.5"/><path class="ba-line" d="M56 70v6M60 70v6M64 70v6M60 36c-4-8-10-12-16-12M60 36c4-8 10-12 16-12"/>',
    gato: '<path class="ba-body" d="M26 54V22l22 16h24l22-16v32c6 8 8 16 8 26 0 16-18 26-42 26S18 96 18 80c0-10 2-18 8-26z"/><path class="ba-line" d="M26 54V22l22 16h24l22-16v32c6 8 8 16 8 26 0 16-18 26-42 26S18 96 18 80c0-10 2-18 8-26z"/>' +
      eye(44, 66) + eye(76, 66) + '<path class="ba-line" d="M60 76v4M60 80c-4 6-12 6-16 0M60 80c4 6 12 6 16 0M52 90l1-5M60 90v-5M68 90l-1-5"/><path class="ba-line" d="M14 70l16 3M14 82l16-3M106 70l-16 3M106 82l-16-3"/>',
    corazon: '<path class="ba-body" d="M60 104C20 76 10 52 24 34c10-12 28-8 36 8 8-16 26-20 36-8 14 18 4 42-36 70z"/><path class="ba-line" d="M60 104C20 76 10 52 24 34c10-12 28-8 36 8 8-16 26-20 36-8 14 18 4 42-36 70z"/>' +
      '<path class="ba-line" d="M60 42l-8 16 12 8-8 16"/><path class="ba-line" d="M54 52l-6 1M58 60l-6 2M62 72l6 1M60 80l7 0"/>' + eye(42, 60) + eye(78, 60) + '<path class="ba-line" d="M50 90c6 4 14 4 20 0"/>',
    ojo: '<path class="ba-line" d="M20 96c10-6 14-14 14-24M100 96c-10-6-14-14-14-24M44 100c6-4 8-10 8-16M76 100c-6-4-8-10-8-16"/>' +
      '<path class="ba-body" d="M8 62S32 22 60 22s52 40 52 40-24 40-52 40S8 62 8 62z"/><path class="ba-line" d="M8 62S32 22 60 22s52 40 52 40-24 40-52 40S8 62 8 62z"/>' +
      '<circle class="ba-iris" cx="60" cy="62" r="22"/><ellipse class="ba-eye" cx="60" cy="62" rx="9" ry="16"/><circle class="ba-shine" cx="54" cy="52" r="4"/><path class="ba-line" d="M30 36l-4-10M44 28l-2-10M76 28l2-10M90 36l4-10"/>',
    luna: '<path class="ba-body" d="M84 18A46 46 0 1 0 100 88 38 38 0 0 1 84 18z"/><path class="ba-line" d="M84 18A46 46 0 1 0 100 88 38 38 0 0 1 84 18z"/>' +
      eye(46, 52) + '<path class="ba-line" d="M34 76c10 8 22 8 32 2"/><path class="ba-bone" d="M40 76l3 8 3-6 3 7 3-7 3 6 3-8"/><circle class="ba-blush" cx="34" cy="64" r="5"/><path class="ba-gold" d="M96 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>'
  };

  V.bossArt = function (id) {
    return '<svg class="boss-svg" viewBox="0 0 120 120" role="img" aria-label="' + esc((R.BOSS_ART.filter(function (a) { return a.id === id; })[0] || { label: 'Jefe' }).label) + '">' + (ART[id] || ART.fantasma) + '</svg>';
  };
  function pick(b) {
    if (b.image && b.image.kind === 'art') return b.image.id;
    var h = 0, s = String(b.id); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return R.BOSS_ART[Math.abs(h) % R.BOSS_ART.length].id;
  }
  // Imagen del jefe. Con enlace: <img> sin referrer; si no carga, se sustituye por el dibujo (ver V.bossFallback).
  V.bossImage = function (b) {
    if (b.image && b.image.kind === 'url') {
      return '<div class="boss-art" data-art="' + pick(b) + '"><img src="' + esc(b.image.url) + '" alt="' + esc(b.name) + '" referrerpolicy="no-referrer" loading="lazy" decoding="async"></div>';
    }
    return '<div class="boss-art">' + V.bossArt(pick(b)) + '</div>';
  };
  V.bossFallback = function (ev) {
    var img = ev.target;
    if (!img || img.tagName !== 'IMG' || !img.parentNode || !img.parentNode.getAttribute || !img.parentNode.getAttribute('data-art')) return;
    var holder = img.parentNode;
    holder.innerHTML = V.bossArt(holder.getAttribute('data-art'));
    holder.removeAttribute('data-art');
  };
})(window.App = window.App || {});
