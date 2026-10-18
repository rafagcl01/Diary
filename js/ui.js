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
