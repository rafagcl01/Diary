(function (App) {
  var icon = App.icon;

  App.escapeHtml = function (value) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value).replace(/[&<>"']/g, function (c) { return map[c]; });
  };

  // `title`, `note` y `lead` son HTML de confianza: escapa antes cualquier dato del usuario.
  // `note` es la nota al margen en cursiva que va sobre el título.
  App.pageHeader = function (title, lead, note) {
    return '<header class="page-head">' +
      (note ? '<p class="margin-note">' + note + '</p>' : '') +
      '<h1 id="page-title" tabindex="-1">' + title + '</h1>' +
      (lead ? '<p class="page-lead">' + lead + '</p>' : '') +
      '</header>';
  };

  // Separador de encaje (decorativo).
  App.lace = function () { return '<div class="lace" aria-hidden="true"></div>'; };

  // Descarga un texto como archivo (funciona también abriendo la página en local).
  App.downloadText = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };

  // Reduce una foto a un cuadrado JPEG de `px` lados (recortada al centro), en el navegador, sin enviarla a ningún sitio.
  // Baja la calidad hasta que quepa en `maxLen` caracteres. Devuelve una promesa con el data URI.
  App.shrinkPhoto = function (file, px, maxLen) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Ese archivo no es una imagen.')); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No se pudo leer esa imagen.')); };
      img.onload = function () {
        URL.revokeObjectURL(url);
        var side = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas');
        c.width = c.height = px;
        var g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, px, px);
        g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, px, px);
        for (var q = 0.85; q >= 0.4; q -= 0.1) {
          var data = c.toDataURL('image/jpeg', q);
          if (data.length <= maxLen) { resolve(data); return; }
        }
        reject(new Error('Esa imagen no se puede reducir lo bastante. Prueba con otra.'));
      };
      img.src = url;
    });
  };

  // La criatura de los huecos: un remiendo cosido con un ojo que asoma por la costura (de vez en cuando parpadea, salvo con
  // los efectos apagados). Va donde algo está vacío, con el mismo trazo que los garabatos de la hoja. `text` es HTML de confianza.
  App.creature = function (text) {
    return '<div class="creature">' +
      '<svg viewBox="0 0 92 80" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path class="cr-patch" d="M14 18c10-8 50-10 64-2 8 6 8 40 0 48-12 9-52 9-64 1-8-7-9-40 0-47z" stroke-dasharray="5 5"/>' +
        '<path class="cr-white" d="M24 40c10-9 34-9 44 0-10 9-34 9-44 0z"/>' +
        '<circle class="cr-iris" cx="49" cy="40" r="6" stroke="none"/><circle cx="51" cy="38" r="1.6" fill="#fff" stroke="none"/>' +
        '<path class="cr-lid" d="M24 40c10-9 34-9 44 0-10 9-34 9-44 0z"/>' +
        '<path d="M20 31l4 3M20 49l4-3M72 31l-4 3M72 49l-4-3M34 27l1 4M58 27l-1 4M34 53l1-4M58 53l-1-4"/>' +
        '<path d="M8 10l5 5M13 10l-5 5" stroke-width="1.6"/>' +
      '</svg><p>' + text + '</p></div>';
  };

  App.emptyState = function (o) {
    var tag = o.tag === undefined ? 'Próximamente' : o.tag;
    return '<section class="card stitched empty" aria-labelledby="empty-title">' +
      '<div class="empty-icon">' + icon(o.icon) + '</div>' +
      '<h2 id="empty-title">' + o.title + '</h2>' +
      '<p>' + o.text + '</p>' +
      (tag ? '<span class="tag">' + tag + '</span>' : '') +
      '</section>';
  };
})(window.App = window.App || {});
