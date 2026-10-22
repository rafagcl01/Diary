// Pantalla breve al subir de nivel: un hilo cose el número del nivel nuevo, enorme; se rellena, saltan chispas y aparecen
// «¡Nivel N!», el avatar con su marco (cosiéndose alrededor si el marco es nuevo) y los premios conseguidos (marco, título,
// fondo). Si subes varios niveles de golpe, enseña el último con todos los premios juntos. Se cierra con «Seguir»,
// tocando fuera o con Esc. Se puede quitar en Configuración → Tu personaje (profile.levelUpScreen) y, con «Efectos»
// apagado o «reducir movimiento», sale ya cosida, sin animación.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, V = App.rpgViews = App.rpgViews || {};
  var dlg = null;

  function rewards(before, after, form) {
    var out = [];
    function inRange(x) { return x.level > before && x.level <= after; }
    R.AVATAR_FRAMES.filter(inRange).forEach(function (f) { out.push({ kind: 'Marco nuevo', name: f.name, frame: true }); });
    R.TITLES.filter(inRange).forEach(function (t) { out.push({ kind: 'Título nuevo', name: R.named(t, form) }); });
    R.BACKGROUNDS.filter(inRange).forEach(function (b) { out.push({ kind: 'Fondo nuevo', name: b.name }); });
    // Reservados aún sin diseñar: se anuncian, pero no se dan (ni se cose ningún marco).
    (R.SOON_REWARDS || []).filter(inRange).forEach(function (x) { out.push({ kind: x.kind + ' nuevo', name: 'próximamente' }); });
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

  // La costura del número (solo con efectos): el hilo lo dibuja en 1,5 s mientras la aguja da dos vueltas; después se
  // rellena, late una vez y saltan chispas; entonces aparece lo demás. Todo con `fill: backwards`: sin efectos, ya está cosido.
  function sew(d) {
    var svg = d.querySelector('.lvlup-num'), t1 = d.querySelector('.lu-t1'), t2 = d.querySelector('.lu-t2'), needle = d.querySelector('.lu-needle'), rest = d.querySelector('.lu-rest');
    var len = 1800;
    t1.animate([{ strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 }], { duration: 1500, easing: 'ease-in-out', fill: 'backwards' });
    needle.animate([{ transform: 'rotate(0deg)', opacity: 1 }, { transform: 'rotate(600deg)', opacity: 1, offset: 0.9 }, { transform: 'rotate(720deg)', opacity: 0 }], { duration: 1500, easing: 'ease-in-out', fill: 'both' });
    t2.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: 1450, fill: 'backwards' });
    svg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 420, delay: 1700, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    rest.animate([{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: 1800, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
    setTimeout(function () {
      if (!d.open) return;
      var r = svg.getBoundingClientRect();
      V.fx.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 22, 200, d);
    }, 1750);
  }

  V.levelUp = {
    rewards: rewards,
    // s: estado del personaje (repo.state()) ya con el nivel nuevo.
    show: function (s, before, after) {
      if (typeof document === 'undefined' || !s) return;
      var p = s.profile, g = s.computed.general, got = rewards(before, after, p.form), newFrame = got.some(function (x) { return x.frame; });
      // Las cifras de IM Fell son de estilo antiguo (unas suben y otras bajan de la línea): la línea base va a media altura.
      var d = ensure(), big = String(after).length > 1 ? 150 : 200;
      d.innerHTML = '<div class="lvlup-card">' +
        // El número cosido: el hilo (lu-t1) lo dibuja y luego se rellena con puntadas (lu-t2); una aguja-estrella da vueltas.
        '<svg class="lvlup-num" viewBox="0 0 300 250" aria-hidden="true" focusable="false">' +
          '<text class="lu-t1" x="150" y="170" font-size="' + big + '">' + after + '</text>' +
          '<text class="lu-t2" x="150" y="170" font-size="' + big + '">' + after + '</text>' +
          '<g class="lu-needle"><path d="M150 4c.8 6 3 8.2 9 9-6 .8-8.2 3-9 9-.8-6-3-8.2-9-9 6-.8 8.2-3 9-9z"/></g></svg>' +
        '<div class="lu-rest"><h2 id="lvlup-title">¡Nivel ' + after + '!</h2>' +
        (newFrame ? '<div class="lvlup-av lu-sew">' + V.avatar(p, after, { size: 'large', stars: g.stars, label: 'Tu avatar en el nivel ' + after + ', con su marco nuevo' }) + '</div>' : '') +
        (after >= (R.GENERAL_LEVEL.max || 999) ? '<p class="lvlup-sub">Has llegado al nivel máximo. Desde ahora, cada 3.000 XP suma una estrella a tu constelación.</p>' : '') +
        (got.length ? '<ul class="lvlup-got">' + got.map(function (x) { return '<li>' + esc(x.kind) + ': <b>' + esc(x.name) + '</b></li>'; }).join('') + '</ul>' : '') +
        '<button type="button" class="btn" data-lvlup-close>Seguir</button></div></div>';
      if (!d.open) d.showModal();
      var b = d.querySelector('[data-lvlup-close]'); if (b && b.focus) b.focus();
      if (V.fx && V.fx.motion()) sew(d);
    }
  };
})(window.App = window.App || {});
