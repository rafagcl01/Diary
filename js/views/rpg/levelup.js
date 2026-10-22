// Pantalla breve al subir de nivel: el avatar con su marco (cosiéndose alrededor si el marco es nuevo), «¡Nivel N!» y los
// premios conseguidos (marco, título, fondo). Si subes varios niveles de golpe, enseña el último con todos los premios
// juntos. Se cierra con «Seguir», tocando fuera o con Esc. Se puede quitar en Configuración → Tu personaje
// (profile.levelUpScreen) y, con «Efectos» apagado, sale sin animación (la regla global quita las animaciones).
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, V = App.rpgViews = App.rpgViews || {};
  var dlg = null;

  function rewards(before, after, form) {
    var out = [];
    function inRange(x) { return x.level > before && x.level <= after; }
    R.AVATAR_FRAMES.filter(inRange).forEach(function (f) { out.push({ kind: 'Marco nuevo', name: f.name, frame: true }); });
    R.TITLES.filter(inRange).forEach(function (t) { out.push({ kind: 'Título nuevo', name: R.named(t, form) }); });
    R.BACKGROUNDS.filter(inRange).forEach(function (b) { out.push({ kind: 'Fondo nuevo', name: b.name }); });
    return out;
  }
  function ensure() {
    if (dlg && document.body.contains(dlg)) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'lvlup-dialog'; dlg.setAttribute('aria-labelledby', 'lvlup-title');
    document.body.appendChild(dlg);
    // Tocar fuera de la tarjeta (en el fondo oscuro) también la cierra.
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg || (ev.target.closest && ev.target.closest('[data-lvlup-close]'))) dlg.close(); });
    return dlg;
  }

  V.levelUp = {
    rewards: rewards,
    // s: estado del personaje (repo.state()) ya con el nivel nuevo.
    show: function (s, before, after) {
      if (typeof document === 'undefined' || !s) return;
      var p = s.profile, g = s.computed.general, got = rewards(before, after, p.form), newFrame = got.some(function (x) { return x.frame; });
      var d = ensure();
      d.innerHTML = '<div class="lvlup-card">' +
        '<div class="lvlup-av' + (newFrame ? ' lu-sew' : '') + '">' + V.avatar(p, after, { size: 'large', stars: g.stars, label: 'Tu avatar en el nivel ' + after }) + '</div>' +
        '<h2 id="lvlup-title">¡Nivel ' + after + '!</h2>' +
        (after >= (R.GENERAL_LEVEL.max || 999) ? '<p class="lvlup-sub">Has llegado al nivel máximo. Desde ahora, cada 3.000 XP suma una estrella a tu constelación.</p>' : '') +
        (got.length ? '<ul class="lvlup-got">' + got.map(function (x) { return '<li>' + esc(x.kind) + ': <b>' + esc(x.name) + '</b></li>'; }).join('') + '</ul>' : '') +
        '<button type="button" class="btn" data-lvlup-close>Seguir</button></div>';
      if (!d.open) d.showModal();
      var b = d.querySelector('[data-lvlup-close]'); if (b && b.focus) b.focus();
    }
  };
})(window.App = window.App || {});
