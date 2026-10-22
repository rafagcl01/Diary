// Efectos de recompensa (solo se miran: no tocan ningún dato).
//  - Chispas: al marcar una misión diaria, una tarea o un paso de jefe, cinco chispas (estrellas y corazones) saltan de la
//    casilla y vuelan, una tras otra, a la barra de XP que esté a la vista (la de la ficha o el hilo del inicio; si no hay
//    ninguna, suben al borde de arriba). Al llegar, la barra brilla y sale «+N XP».
//  - Sello cosido: «¡Día completo!» o «¡Lista completa!» cae sobre su tarjeta y se va.
//  - Sello de lacre: al completar una misión semanal, cae sobre su tarjeta, que tiembla, y salen chispas.
//  - Golpe: cada paso de un jefe lo hace temblar y le abre un descosido.
//  - Caída del jefe (al completar todos sus pasos): se desdobla en magenta y lavanda y se deshace en polillas.
// Con «Efectos» apagado o «reducir movimiento» en el sistema no se mueve nada: la escena del jefe sale quieta y el resto
// se queda en los avisos de siempre.
(function (App) {
  var V = App.rpgViews = App.rpgViews || {}, esc = App.escapeHtml;
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z" fill="currentColor"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15 2 11.5 4 8c1.7-2.8 5.5-2.6 8 .6 2.5-3.2 6.3-3.4 8-.6 2 3.5-1 7-8 13z" fill="currentColor"/></svg>';
  var MOTH = '<svg viewBox="0 0 22 14" aria-hidden="true"><ellipse cx="6" cy="6" rx="6" ry="5" fill="currentColor" opacity=".9"/><ellipse cx="16" cy="6" rx="6" ry="5" fill="currentColor" opacity=".9"/>' +
    '<ellipse cx="7" cy="11" rx="3.5" ry="2.5" fill="currentColor" opacity=".7"/><ellipse cx="15" cy="11" rx="3.5" ry="2.5" fill="currentColor" opacity=".7"/><rect x="10.2" y="2" width="1.6" height="11" rx=".8" fill="#2A1A24"/></svg>';
  var SEAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20C6 15 3.5 12 5 9c1.4-2.4 4.7-2.2 7 .6 2.3-2.8 5.6-3 7-.6 1.5 3-1 6-7 11z" fill="#FFF5F8"/></svg>';
  // Barras de XP a las que vuelan las chispas, por orden de preferencia (la primera que esté a la vista).
  var TARGETS = ['.char-hero .xpbar', '.home-char .thread'];

  function motion() {
    if (typeof document === 'undefined' || !document.body || !document.body.animate) return false;
    var m = document.documentElement.getAttribute('data-motion');
    if (m === 'off') return false;
    if (m === 'on') return true;
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  var layerEl = null;
  function layer() {
    if (layerEl && document.body.contains(layerEl)) return layerEl;
    layerEl = document.createElement('div'); layerEl.className = 'fx-layer'; layerEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layerEl);
    return layerEl;
  }
  function point(from) {
    if (from && from.getBoundingClientRect) { var r = from.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    return from;
  }
  // Adónde van: el final del relleno de la barra que esté a la vista.
  function target() {
    for (var i = 0; i < TARGETS.length; i++) {
      var el = document.querySelector(TARGETS[i]); if (!el) continue;
      var r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > window.innerHeight) continue;
      var fill = el.firstElementChild, end = fill ? fill.getBoundingClientRect().right : r.left;
      return { x: Math.max(r.left + 8, Math.min(r.right - 4, end)), y: r.top + r.height / 2, el: el };
    }
    return { x: window.innerWidth / 2, y: -12, el: null };
  }
  function sprite(html, cls, size, host) {
    var s = document.createElement('span'); s.className = 'fx-sp ' + (cls || ''); s.style.width = s.style.height = size + 'px'; s.innerHTML = html;
    (host || layer()).appendChild(s); return s;
  }
  function quad(a, b, lift) {
    var c = { x: (a.x + b.x) / 2 + (b.x > a.x ? -1 : 1) * Math.min(140, Math.abs(b.y - a.y) * 0.3), y: Math.min(a.y, b.y) - lift };
    return function (t) { return { x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y }; };
  }
  function along(el, f, o) {
    var fr = [];
    for (var i = 0; i <= 32; i++) {
      var t = i / 32, p = f(t);
      fr.push({ transform: 'translate(' + p.x + 'px,' + p.y + 'px) translate(-50%,-50%) rotate(' + (o.spin * t) + 'deg) scale(' + (1 - 0.3 * t) + ')', opacity: t < 0.06 ? t / 0.06 : (t > 0.93 ? (1 - t) / 0.07 : 1) });
    }
    return el.animate(fr, { duration: o.dur, delay: o.delay || 0, easing: 'linear', fill: 'both' }).finished.then(function () { el.remove(); }, function () { el.remove(); });
  }
  function shake(px) {
    return [{ transform: 'translateX(0)' }, { transform: 'translateX(' + -px + 'px) rotate(-1deg)' }, { transform: 'translateX(' + px + 'px) rotate(1deg)' },
      { transform: 'translateX(' + -px * 0.6 + 'px)' }, { transform: 'translateX(' + px * 0.4 + 'px)' }, { transform: 'translateX(0)' }];
  }
  // Al llegar: la barra brilla y, si hay XP, sale «+N XP» bajo la barra.
  function arrive(to, xp) {
    if (to.el) to.el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.9)' }, { filter: 'brightness(1)' }], { duration: 380 });
    if (!xp || to.y < 0) return;
    var el = document.createElement('span'); el.className = 'fx-plus'; el.textContent = '+' + xp + ' XP'; layer().appendChild(el);
    el.animate([{ transform: 'translate(' + to.x + 'px,' + (to.y + 8) + 'px) translate(-50%,0) scale(.7)', opacity: 0 },
      { transform: 'translate(' + to.x + 'px,' + (to.y + 16) + 'px) translate(-50%,0)', opacity: 1, offset: 0.25 },
      { transform: 'translate(' + to.x + 'px,' + (to.y + 32) + 'px) translate(-50%,0)', opacity: 0 }], { duration: 1100, easing: 'ease-out', fill: 'both' })
      .finished.then(function () { el.remove(); }, function () { el.remove(); });
  }
  // Estallido de estrellas y corazones alrededor de un punto (`host`: dentro de una ventana, para que se vea encima).
  function burst(p, n, r, host) {
    for (var i = 0; i < n; i++) {
      (function (i) {
        var ang = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = r * (0.55 + Math.random() * 0.6), size = 8 + Math.random() * 14;
        var el = sprite(i % 3 === 0 ? HEART : STAR, (i % 2 ? 'glow ' : '') + (i % 3 === 0 ? 'pink' : i % 4 === 1 ? 'lav' : ''), size, host);
        var tx = p.x + Math.cos(ang) * d, ty = p.y + Math.sin(ang) * d;
        el.animate([{ transform: 'translate(' + p.x + 'px,' + p.y + 'px) translate(-50%,-50%) scale(.2)', opacity: 0 },
          { transform: 'translate(' + (p.x + (tx - p.x) * 0.7) + 'px,' + (p.y + (ty - p.y) * 0.7) + 'px) translate(-50%,-50%) rotate(' + (Math.random() * 180 - 90) + 'deg) scale(1)', opacity: 1, offset: 0.45 },
          { transform: 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%) rotate(' + (Math.random() * 360 - 180) + 'deg) scale(.5)', opacity: 0 }],
          { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }).finished.then(function () { el.remove(); }, function () { el.remove(); });
      })(i);
    }
  }
  // Cinco chispas desde `from` (elemento o punto) hasta la barra. Devuelve una promesa que se cumple cuando llegan.
  function sparks(from, xp, count) {
    var a = point(from); if (!motion() || !a) return Promise.resolve();
    var to = target(), runs = [], n = count || 5;
    for (var i = 0; i < n; i++) {
      (function (i) {
        var ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.75 + (Math.random() - 0.5) * 0.3, r = 34 + Math.random() * 20;
        var b = { x: a.x + Math.cos(ang) * r, y: a.y + Math.sin(ang) * r }, f2 = quad(b, to, 50 + i * 12);
        var f = function (t) { return t < 0.25 ? { x: a.x + (b.x - a.x) * ease(t / 0.25), y: a.y + (b.y - a.y) * ease(t / 0.25) } : f2(ease((t - 0.25) / 0.75)); };
        runs.push(along(sprite(i % 2 ? HEART : STAR, 'glow' + (i % 2 ? ' pink' : ''), i === 2 ? 18 : 12), f, { dur: 1050, delay: i * 70, spin: 240 }));
      })(i);
    }
    return Promise.all(runs).then(function () { arrive(to, xp); });
  }
  function relative(el) { if (el && window.getComputedStyle(el).position === 'static') el.style.position = 'relative'; }

  V.fx = {
    motion: motion,
    sparks: sparks,
    // Sello cosido sobre `host` («¡DÍA COMPLETO! +15»): cae, la tarjeta tiembla, salen chispas y el sello se va.
    stamp: function (host, text, xp) {
      if (!motion() || !host) return Promise.resolve();
      relative(host);
      var s = document.createElement('div'); s.className = 'fx-stamp'; s.textContent = text; host.appendChild(s);
      s.animate([{ transform: 'translate(-50%,-50%) rotate(-24deg) scale(2.4)', opacity: 0 },
        { transform: 'translate(-50%,-50%) rotate(-6deg) scale(.92)', opacity: 1, offset: 0.7 },
        { transform: 'translate(-50%,-50%) rotate(-8deg) scale(1)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'both' });
      host.animate(shake(4), { duration: 320, delay: 340 });
      return wait(620).then(function () {
        s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 2200, fill: 'both' }).finished.then(function () { s.remove(); }, function () { s.remove(); });
        return sparks(s, xp, 3);
      });
    },
    // Sello de lacre sobre la tarjeta de una misión semanal: cae, la aplasta un poco, suelta polvo y salen chispas.
    seal: function (card, xp) {
      if (!motion() || !card) return Promise.resolve();
      relative(card);
      var s = document.createElement('div'); s.className = 'fx-seal'; s.innerHTML = SEAL; card.appendChild(s);
      s.animate([{ transform: 'scale(2.3) rotate(-30deg)', opacity: 0 }, { transform: 'scale(.82,1.12) rotate(4deg)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1.1,.9) rotate(-3deg)', opacity: 1, offset: 0.75 }, { transform: 'scale(1) rotate(-6deg)', opacity: 1 }], { duration: 640, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
      card.animate(shake(6), { duration: 360, delay: 330 });
      return wait(340).then(function () {
        var c = point(s);
        for (var i = 0; i < 10; i++) {
          (function (i) {
            var a = (i / 10) * Math.PI * 2, d = document.createElement('span');
            d.className = 'fx-sp fx-dust'; d.style.background = i % 2 ? '#F3C6DA' : '#C9B9E8'; layer().appendChild(d);
            d.animate([{ transform: 'translate(' + c.x + 'px,' + c.y + 'px) translate(-50%,-50%)', opacity: 0.9 },
              { transform: 'translate(' + (c.x + Math.cos(a) * 46) + 'px,' + (c.y + Math.sin(a) * 46) + 'px) translate(-50%,-50%) scale(.3)', opacity: 0 }], { duration: 520, easing: 'ease-out', fill: 'both' })
              .finished.then(function () { d.remove(); }, function () { d.remove(); });
          })(i);
        }
        return wait(420);
      }).then(function () { return sparks(card, xp, 5); });
    },
    // Un paso de jefe: el jefe tiembla, se le abre un descosido y su barra de vida destella.
    hit: function (card) {
      if (!motion() || !card) return;
      var art = card.querySelector('.boss-art'), hp = card.querySelector('.hpbar');
      if (art) {
        relative(art);
        art.animate(shake(7), { duration: 380 });
        art.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) saturate(1.4)' }, { filter: 'brightness(1)' }], { duration: 320 });
        var n = art.querySelectorAll('.fx-tear').length, pos = [[12, 28, -18], [48, 62, 14], [24, 78, -6]][n % 3];
        var tear = document.createElement('span');
        tear.className = 'fx-tear'; tear.setAttribute('aria-hidden', 'true');
        tear.style.left = pos[0] + '%'; tear.style.top = pos[1] + '%'; tear.style.transform = 'rotate(' + pos[2] + 'deg)';
        tear.innerHTML = '<svg viewBox="0 0 60 20"><path d="M2 10l8-7 8 14 8-14 8 14 8-14 8 7" fill="none" stroke="#F08BB5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        art.appendChild(tear);
        tear.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 260, delay: 120, fill: 'both' });
      }
      if (hp) hp.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2)' }, { filter: 'brightness(1)' }], { duration: 420, delay: 120 });
    },
    // El jefe cae (todos sus pasos hechos). `b`: el jefe (para su imagen y su nombre); `line`: qué pasa con el botín.
    // Devuelve una promesa que se cumple al cerrar («Seguir», tocar fuera o Esc).
    bossDown: function (b, line) {
      if (typeof document === 'undefined') return Promise.resolve();
      var img = V.bossImage ? V.bossImage(b) : '';
      var ov = document.createElement('div');
      ov.className = 'fx-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'fx-ov-title');
      ov.innerHTML = '<div class="fx-ov-stage"><div class="fx-boss"><div class="g0">' + img + '</div><div class="gm" aria-hidden="true">' + img + '</div><div class="gl" aria-hidden="true">' + img + '</div></div>' +
        '<div class="fx-ov-text"><h2 id="fx-ov-title">¡Jefe derrotado!</h2><span class="fx-line" aria-hidden="true"></span><p><b>' + esc(b.name) + '</b></p><p>' + line + '</p>' +
        '<button type="button" class="btn fx-go">Seguir</button></div></div>';
      document.body.appendChild(ov);
      var before = document.activeElement, text = ov.querySelector('.fx-ov-text'), go = ov.querySelector('.fx-go');
      var closed = new Promise(function (res) {
        var done = false;
        function close() {
          if (done) return; done = true; document.removeEventListener('keydown', key);
          var end = function () { ov.remove(); if (before && before.focus) before.focus({ preventScroll: true }); res(); };
          if (motion()) ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'both' }).finished.then(end, end); else end();
        }
        function key(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
        document.addEventListener('keydown', key);
        go.addEventListener('click', close);
        ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      });
      if (!motion()) { ov.querySelector('.fx-boss').style.opacity = '.3'; go.focus({ preventScroll: true }); return closed; }
      var boss = ov.querySelector('.fx-boss'), layers = ov.querySelectorAll('.fx-boss > div'), g0 = layers[0], gm = layers[1], gl = layers[2];
      text.style.visibility = 'hidden';
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'both' });
      function jit(dx) {
        var f = [];
        for (var i = 0; i <= 14; i++) { var a = Math.random(); f.push({ transform: 'translate(' + ((Math.random() - 0.5) * dx) + 'px,' + ((Math.random() - 0.5) * 4) + 'px)', clipPath: 'inset(' + (a * 70) + '% 0 ' + ((1 - a) * 20) + '% 0)' }); }
        f.push({ transform: 'none', clipPath: 'inset(0 0 0 0)' });
        return f;
      }
      wait(320).then(function () {
        gm.animate(jit(18), { duration: 900, easing: 'steps(15)', fill: 'both' });
        gl.animate(jit(-18), { duration: 900, easing: 'steps(15)', fill: 'both' });
        g0.animate([{ transform: 'skewX(0)' }, { transform: 'skewX(6deg) translateX(-4px)' }, { transform: 'skewX(-5deg) translateX(3px)' }, { transform: 'skewX(0)' }], { duration: 300, iterations: 3 });
        return wait(900);
      }).then(function () {
        Array.prototype.forEach.call(layers, function (l) { l.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' }); });
        var r = boss.getBoundingClientRect();
        for (var i = 0; i < 36; i++) {
          (function (i) {
            var m = sprite(MOTH, i % 2 ? 'lav' : 'pink', 20 + Math.random() * 14, ov);
            var x0 = r.left + Math.random() * r.width, y0 = r.top + 20 + Math.random() * (r.height - 30), up = 180 + Math.random() * 220, side = (Math.random() - 0.5) * 260, fr = [];
            for (var k = 0; k <= 12; k++) {
              var t = k / 12;
              fr.push({ transform: 'translate(' + (x0 + side * t + Math.sin(t * 9 + i) * 18) + 'px,' + (y0 - up * t) + 'px) translate(-50%,-50%) rotate(' + (Math.sin(t * 12 + i) * 25) + 'deg) scaleX(' + (0.55 + Math.abs(Math.sin(t * 20 + i)) * 0.45) + ')', opacity: t < 0.1 ? t * 10 : 1 - t });
            }
            m.animate(fr, { duration: 1400 + Math.random() * 700, delay: Math.random() * 450, fill: 'both' }).finished.then(function () { m.remove(); }, function () { m.remove(); });
          })(i);
        }
        return wait(900);
      }).then(function () {
        text.style.visibility = 'visible';
        text.animate([{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'both' });
        var line = ov.querySelector('.fx-line'); if (line) line.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 600, delay: 250, fill: 'both' });
        go.focus({ preventScroll: true });
      });
      return closed;
    },
    // Tras guardar y repintar la pantalla: los premios grandes sobre su tarjeta (si está a la vista).
    events: function (events) {
      (events || []).forEach(function (e) {
        if (e.type === 'daily') V.fx.stamp(document.querySelector('#col-daily .dl-row'), '¡DÍA COMPLETO! +' + e.xp, e.xp);
        else if (e.type === 'todo') V.fx.stamp(document.querySelector('#col-todo .td-card') || document.querySelector('#home-todos'), '¡LISTA COMPLETA! +' + e.xp, e.xp);
        else if (e.type === 'weekly' && e.id) V.fx.seal(document.querySelector('.wk-card[data-wk="' + e.id + '"]'), e.xp);
      });
    },
    burst: burst
  };
})(window.App = window.App || {});
