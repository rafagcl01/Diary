// Avisos de recompensa («¡Misión completada!», «¡Jefe derrotado!», «¡Subes de nivel!»). Se anuncian a lectores de pantalla,
// se cierran solos y también con el botón. Solo aparecen cuando el guardado ya está confirmado.
(function (App) {
  var esc = App.escapeHtml;
  var V = App.rpgViews = App.rpgViews || {};
  var box = null;

  function container() {
    if (typeof document === 'undefined') return null;
    if (box && document.body.contains(box)) return box;
    box = document.createElement('div');
    box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
    return box;
  }

  // { kind: 'weekly' | 'boss' | 'step' | 'level', title, text }
  V.toast = {
    show: function (o) {
      var host = container(); if (!host) return;
      var el = document.createElement('div');
      el.className = 'toast'; el.setAttribute('data-kind', o.kind || 'weekly');
      el.innerHTML = '<span class="toast-spark" aria-hidden="true">✦</span><div class="toast-body"><strong>' + esc(o.title) + '</strong><span>' + esc(o.text || '') + '</span></div>' +
        '<button type="button" class="toast-x" aria-label="Cerrar aviso">×</button>';
      host.appendChild(el);
      function close() { if (el.parentNode) el.parentNode.removeChild(el); }
      el.querySelector('.toast-x').addEventListener('click', close);
      setTimeout(close, o.kind === 'boss' ? 12000 : 8000);
    },
    // Convierte los eventos de recompensa en avisos.
    events: function (events) {
      (events || []).forEach(function (e) {
        if (e.type === 'weekly') V.toast.show({ kind: 'weekly', title: '¡Misión completada!', text: e.label + ' · +' + e.xp + ' XP' });
        else if (e.type === 'boss') V.toast.show({ kind: 'boss', title: '¡Jefe derrotado!', text: e.label + ' · +' + e.xp + ' XP' });
        else if (e.type === 'step') V.toast.show({ kind: 'step', title: 'Paso completado', text: e.label + ' (' + e.boss + ') · +' + e.xp + ' XP' });
      });
    }
  };
})(window.App = window.App || {});
