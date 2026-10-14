// Decoración de la hoja según el porcentaje de ánimo de la página. Es solo ambiente: dibujos grises casi negros, con poca
// opacidad y en los márgenes y esquinas, para que nunca estorben la lectura. No cambia ningún dato ni da puntos.
//   más de 75 %  → "bright": dibujos bonitos (corazón con alas, rosa, corazones)
//   de 50 a 75 % → "normal": la hoja de siempre
//   de 25 a 49 % → "torn": bordes rotos (mordidas en pico hacia dentro) y esquinas dobladas
//   menos de 25 %→ "rough": bordes rotos, esquinas dobladas y rayones
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

  // Rayones: ovillos gruesos y oscuros, trazados a mano alzada (referencia: garabatos de rabia)
  function heavy(cls, view, body) { return svg(cls, view, body); }   // mismo trazo que el resto: el grosor lo fija el CSS
  var COIL = heavy('d-coil', '0 0 150 80', '<path d="M42.0 66.0 C40.5 67.4 38.7 73.2 33.0 74.6 C27.2 76.0 14.4 76.1 7.4 74.3 C0.4 72.5 -8.0 67.8 -9.0 63.7 C-9.9 59.7 -5.5 53.5 1.9 50.0 C9.3 46.6 24.3 43.5 35.3 43.0 C46.2 42.5 60.8 44.6 67.6 46.8 C74.4 49.1 77.7 54.0 76.1 56.7 C74.6 59.3 65.3 62.4 58.1 62.6 C51.0 62.8 38.3 60.9 33.0 58.0 C27.7 55.0 23.7 49.2 26.1 45.0 C28.5 40.8 37.9 35.4 47.6 32.9 C57.2 30.4 73.6 29.3 83.8 30.0 C94.0 30.8 105.1 34.4 108.8 37.2 C112.5 40.0 110.5 44.8 106.1 46.7 C101.6 48.7 89.6 50.0 82.2 48.9 C74.7 47.9 64.2 44.1 61.5 40.3 C58.7 36.6 60.0 30.3 65.7 26.4 C71.3 22.6 84.7 18.5 95.6 17.2 C106.4 15.9 122.2 16.9 130.5 18.7 C138.8 20.5 145.3 25.1 145.6 27.9 C146.0 30.8 139.1 34.7 132.6 35.6 C126.1 36.5 113.2 35.8 106.7 33.5 C100.3 31.2 93.5 26.0 93.9 21.8 C94.4 17.7 100.9 11.7 109.3 8.6 C117.7 5.5 138.5 4.1 144.4 3.2"/>');
  var TANGLE = heavy('d-tangle', '0 0 100 80', '<path d="M95.0 43.5 C80.7 48.8 17.2 77.3 9.1 75.0 C1.0 72.7 32.3 32.9 46.7 29.4 C61.0 26.0 101.9 51.3 95.0 54.1 C88.1 57.0 9.5 54.1 5.0 46.7 C0.5 39.3 57.8 7.0 68.2 9.9 C78.6 12.9 74.5 61.5 67.2 64.5 C59.9 67.6 20.1 35.6 24.2 28.2 C28.4 20.9 91.2 12.7 92.0 20.3 C92.8 27.8 41.5 76.0 29.2 73.5 C17.0 70.9 7.6 9.1 18.5 5.0 C29.5 0.9 93.3 40.6 95.0 48.9 C96.7 57.3 35.1 62.5 29.0 55.2 C22.9 47.9 50.8 5.3 58.4 5.0 C66.0 4.7 81.0 47.1 74.6 53.3 C68.3 59.5 21.2 46.7 20.0 42.2 C18.9 37.7 61.0 22.6 67.7 26.1 C74.4 29.5 68.7 62.2 60.3 62.9 C51.9 63.5 13.5 35.5 17.1 29.9 C20.7 24.4 79.9 23.6 81.9 29.6 C83.9 35.6 38.7 69.6 29.4 65.9 C20.0 62.2 19.2 11.7 25.7 7.6 C32.2 3.5 71.8 32.0 68.4 41.2 C64.9 50.4 4.8 68.8 5.0 62.8 C5.2 56.7 58.2 4.9 69.7 5.0 C81.1 5.1 81.3 57.3 73.6 63.4 C66.0 69.5 20.8 48.8 23.7 41.6 C26.5 34.3 86.6 17.0 90.6 19.9 C94.7 22.8 62.4 59.1 48.2 59.0 C33.9 58.8 -2.8 22.9 5.0 18.8 C12.8 14.7 91.5 28.8 95.0 34.4 C98.5 39.9 34.8 57.0 26.2 52.1 C17.6 47.2 34.8 5.6 43.6 5.0 C52.5 4.4 85.6 40.9 79.4 48.3 C73.3 55.8 8.0 57.0 6.9 49.8 C5.7 42.6 62.5 5.1 72.5 5.0 C82.5 4.9 77.4 45.6 66.9 49.4 C56.4 53.2 4.9 32.2 9.6 27.8 C14.3 23.4 90.7 15.2 95.0 23.0 C99.3 30.9 45.5 66.2 35.6 74.9"/>');
  var SPIRAL = heavy('d-spiral', '0 0 100 100', '<path d="M92.4 49.9 C91.5 53.7 91.2 65.9 86.9 72.4 C82.6 78.9 73.3 85.4 66.5 88.9 C59.7 92.4 52.4 94.0 46.1 93.3 C39.8 92.7 34.0 89.6 28.7 85.1 C23.3 80.6 16.5 73.6 13.9 66.3 C11.3 59.1 11.4 48.2 13.1 41.4 C14.7 34.7 19.0 30.2 23.6 25.8 C28.2 21.4 35.0 17.1 40.7 14.9 C46.4 12.8 52.5 11.4 57.8 13.1 C63.2 14.8 68.8 20.5 72.6 24.9 C76.4 29.3 79.5 33.9 80.7 39.6 C81.9 45.3 81.6 53.5 79.8 59.1 C78.0 64.7 74.5 69.8 69.9 73.4 C65.3 77.0 57.9 79.7 52.3 80.6 C46.7 81.4 41.1 80.4 36.4 78.6 C31.6 76.8 26.2 74.6 23.9 69.9 C21.5 65.2 22.2 56.1 22.3 50.5 C22.4 44.8 22.1 40.4 24.3 36.0 C26.6 31.6 31.0 26.0 35.5 24.2 C40.1 22.5 47.3 24.9 51.9 25.5 C56.4 26.1 60.0 25.9 62.9 27.8 C65.8 29.6 67.7 32.9 69.2 36.7 C70.8 40.6 72.0 46.6 72.1 50.8 C72.1 55.1 72.2 58.4 69.4 62.0 C66.7 65.7 59.4 71.7 55.6 72.9 C51.8 74.1 49.9 70.9 46.9 69.3 C43.9 67.6 40.0 64.9 37.6 63.0 C35.2 61.2 33.0 61.0 32.6 58.3 C32.1 55.5 34.0 50.1 34.8 46.6 C35.6 43.0 35.5 38.8 37.1 36.9 C38.8 35.0 41.8 35.3 44.8 35.2 C47.7 35.2 52.3 35.9 54.8 36.6 C57.3 37.3 58.2 36.9 59.8 39.2 C61.4 41.5 63.9 47.5 64.4 50.4 C64.9 53.3 64.0 54.8 62.9 56.5 C61.9 58.2 60.4 60.1 58.1 60.8 C55.8 61.5 51.6 61.6 49.4 60.9 C47.2 60.2 46.4 57.7 44.9 56.4 C43.4 55.2 41.0 54.4 40.4 53.5 C39.7 52.6 40.2 52.1 41.2 50.9 C42.2 49.6 45.2 46.7 46.6 46.0 C48.0 45.3 48.6 47.3 49.6 47.0 C50.6 46.7 45.6 48.4 52.7 44.2 C59.8 40.0 85.5 25.7 92.0 22.0"/>');

  var PARTS = {
    bright: WINGED + ROSE + SMALL + SPARK,
    rough: COIL + TANGLE + SPIRAL
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
