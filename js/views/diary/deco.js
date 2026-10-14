// Decoración de la hoja según el porcentaje de ánimo de la página. Es solo ambiente: dibujos grises casi negros, con poca
// opacidad y en los márgenes y esquinas, para que nunca estorben la lectura. No cambia ningún dato ni da puntos.
//   más de 75 %  → "bright": dibujos bonitos (corazón con alas, rosa, corazones)
//   de 50 a 75 % → "normal": la hoja de siempre
//   de 25 a 49 % → "torn": bordes rotos
//   menos de 25 %→ "rough": bordes rotos y rayones
(function (App) {
  var ST = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  function svg(cls, view, body) { return '<svg class="deco ' + cls + '" viewBox="' + view + '" ' + ST + ' aria-hidden="true" focusable="false">' + body + '</svg>'; }

  var HEART = 'M50 80 C18 58 20 30 38 30 C45 30 50 36 50 41 C50 36 55 30 62 30 C80 30 82 58 50 80 Z';
  var WINGED = svg('d-winged', '0 0 140 100',
    '<g transform="translate(20 0)">' +
      '<path d="' + HEART + '"/><path d="M40 42 C36 46 38 52 42 54" />' +
      '<path d="M32 46 C22 34 8 34 -8 26 C-4 38 0 46 6 50 C-2 52 -6 58 -8 66 C2 62 10 62 20 64 C14 66 14 72 12 78 C22 72 30 66 38 62"/>' +
      '<path d="M0 40 C6 42 12 46 18 52 M-2 56 C6 56 14 58 22 62"/>' +
      '<path d="M68 46 C78 34 92 34 108 26 C104 38 100 46 94 50 C102 52 106 58 108 66 C98 62 90 62 80 64 C86 66 86 72 88 78 C78 72 70 66 62 62"/>' +
      '<path d="M100 40 C94 42 88 46 82 52 M102 56 C94 56 86 58 78 62"/>' +
    '</g>');
  var ROSE = svg('d-rose', '0 0 100 120',
    '<path d="M36 40 C28 28 40 16 52 18 C64 14 76 26 68 42 C74 56 60 66 50 62 C40 66 28 54 36 40 Z"/>' +
    '<path d="M52 24 C62 24 66 34 60 42 C54 50 42 46 42 38 C42 30 50 28 54 32 C57 36 52 40 49 38"/>' +
    '<path d="M50 62 C50 78 46 92 49 112"/>' +
    '<path d="M49 80 C38 72 30 76 28 84 C38 90 46 88 49 80 Z"/><path d="M49 94 C60 86 70 88 72 96 C62 102 54 101 49 94 Z"/>');
  var SMALL = svg('d-heart', '0 0 100 100', '<path d="' + HEART + '"/><path d="M30 20 L30 12 M26 16 L34 16 M76 24 L76 18 M73 21 L79 21"/>');
  var SPARK = svg('d-heart', '0 0 100 100', '<path d="' + HEART + '"/><path d="M42 44 C42 40 46 38 48 41"/>');

  var SCRIBBLE = svg('d-scribble', '0 0 140 90',
    '<path d="M8 16 L128 8 L14 28 L132 22 L10 42 L126 36 L16 56 L130 50 L12 70 L124 64 L18 82 L120 78" stroke-width="2.8"/>');
  var TANGLE = svg('d-tangle', '0 0 100 100',
    '<path d="M18 62 C30 14 82 18 78 52 C74 84 24 86 26 48 C28 22 66 26 62 50 C60 64 40 62 42 50 C43 42 54 44 52 50"/>' +
    '<path d="M10 90 L90 12 M22 94 L94 26" stroke-width="2.6"/>');
  var SLASH = svg('d-slash', '0 0 60 80', '<path d="M10 10 L50 70 M20 6 L56 60 M6 30 L36 74 M46 8 L14 66" stroke-width="3"/>');

  var PARTS = {
    bright: WINGED + ROSE + SMALL + SPARK,
    rough: SCRIBBLE + TANGLE + SLASH
  };

  App.sheetDeco = {
    // Etapa de la hoja para un porcentaje (null = sin estados todavía: hoja normal)
    tier: function (percent) { return App.diary.pageTier(percent); },
    // Contenedor decorativo (siempre presente, para poder cambiarlo al vuelo en el editor)
    markup: function (percent) { return '<div class="sheet-deco" aria-hidden="true">' + (PARTS[this.tier(percent)] || '') + '</div>'; },
    attr: function (percent) { return ' data-tier="' + this.tier(percent) + '"'; },
    // Actualiza una hoja que ya está en pantalla (editor): solo toca el DOM si la etapa cambia
    update: function (sheet, percent) {
      if (!sheet || typeof sheet.setAttribute !== 'function') return;
      var tier = this.tier(percent);
      if (sheet.getAttribute && sheet.getAttribute('data-tier') === tier) return;
      sheet.setAttribute('data-tier', tier);
      var box = sheet.querySelector && sheet.querySelector('.sheet-deco');
      if (box) box.innerHTML = PARTS[tier] || '';
    }
  };
})(window.App = window.App || {});
