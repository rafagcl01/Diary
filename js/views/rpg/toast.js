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

  // { kind: 'weekly' | 'boss' | 'step' | 'level' | 'char', title, text, link: { href, label } }
  V.toast = {
    show: function (o) {
      var host = container(); if (!host) return;
      var el = document.createElement('div');
      el.className = 'toast'; el.setAttribute('data-kind', o.kind || 'weekly');
      el.innerHTML = '<span class="toast-spark" aria-hidden="true">✦</span><div class="toast-body"><strong>' + esc(o.title) + '</strong><span>' + esc(o.text || '') + '</span>' +
        (o.link ? '<a class="toast-link" href="' + esc(o.link.href) + '">' + esc(o.link.label) + '</a>' : '') + '</div>' +
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
    },
    // Tras guardar una página del diario con actividades (ver R.recordDiaryActivities): qué ha ganado el personaje.
    diary: function (res) {
      if (!res || !res.logged.length) return;
      var xp = res.logged.reduce(function (t, e) { return t + e.xp; }, 0);
      V.toast.show({ kind: 'char', title: 'Tu personaje se ha actualizado', text: '+' + xp + ' XP · ' + res.logged.map(function (e) { return e.label; }).join(', '), link: { href: '#/personaje', label: 'Ver personaje' } });
      if (res.after > res.before) V.toast.show({ kind: 'level', title: '¡Subes de nivel!', text: 'Ya eres nivel ' + res.after });
      V.toast.events(res.events);
    }
  };
})(window.App = window.App || {});
