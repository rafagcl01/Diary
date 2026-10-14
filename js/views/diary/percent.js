// Porcentaje de ánimo de una página: un anillo con la media de los estados de sus entradas.
// Se anima (el número y el anillo) cuando cambia; con los efectos desactivados, o con "reducir
// movimiento", se actualiza al instante.
(function (App) {
  var D = App.diary;
  var last = {};            // último porcentaje mostrado de cada día en esta sesión (para animar el cambio)
  var DURATION = 650;

  function motionAllowed() {
    var root = document.documentElement, mode = root && root.dataset ? root.dataset.motion : 'auto';
    if (mode === 'off') return false;
    if (typeof requestAnimationFrame !== 'function') return false;
    if (mode !== 'on' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  }

  function describe(dm) {
    if (dm.percent === null) return 'Ánimo de la página: sin estados de ánimo apuntados';
    return 'Ánimo de la página: ' + dm.percent + ' por ciento' + (dm.rated < dm.total ? ', según ' + dm.rated + ' de ' + dm.total + ' entradas con estado' : '');
  }

  // `shown` es el número que se dibuja (puede ser el de partida de una animación).
  function html(dm, o) {
    o = o || {};
    var small = o.small ? ' pct-small' : '';
    if (dm.percent === null) {
      if (o.small) return '';
      return '<div class="pct pct-empty" role="img" aria-label="' + describe(dm) + '"><span class="pct-ring" style="--p: 0"><span class="pct-num">–</span></span>' +
        '<span class="pct-text"><span class="pct-label">ánimo de la página</span><small>Elige un estado en alguna entrada</small></span></div>';
    }
    var shown = o.shown === undefined || o.shown === null ? dm.percent : o.shown;
    var note = dm.rated < dm.total ? '<small>Media de ' + dm.rated + ' de ' + dm.total + ' entradas con estado</small>' : '';
    return '<div class="pct' + small + '" data-pct="' + dm.percent + '" role="img" aria-label="' + describe(dm) + '">' +
      '<span class="pct-ring" style="--p: ' + shown + '"><span class="pct-num">' + shown + '%</span></span>' +
      (o.small ? '' : '<span class="pct-text"><span class="pct-label">ánimo de la página</span>' + note + '</span>') + '</div>';
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  function animate(container, from, to) {
    var ring = container.querySelector('.pct-ring'), num = container.querySelector('.pct-num'), box = container.querySelector('.pct');
    if (!ring || !num) return;
    if (box) { box.classList.remove('pct-pop'); void box.offsetWidth; box.classList.add('pct-pop'); }
    var t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      var k = Math.min(1, (now - t0) / DURATION), v = Math.round(from + (to - from) * ease(k));
      ring.style.setProperty('--p', v); num.textContent = v + '%';
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  App.percentUi = {
    html: html,
    describe: describe,
    last: last,

    // Dibuja el porcentaje de la página `key` (su día) en `container`. Si cambia respecto a lo último mostrado
    // (o es la primera vez y `fromZero`), lo anima.
    paint: function (container, dm, key, o) {
      o = o || {};
      var to = dm.percent, prev = last[key];
      var from = to === null ? null : (prev === undefined || prev === null ? (o.fromZero ? 0 : to) : prev);
      var animating = to !== null && from !== to && motionAllowed();
      container.innerHTML = html(dm, { small: o.small, shown: animating ? from : to });
      last[key] = to;
      if (animating) animate(container, from, to);
    }
  };
})(window.App = window.App || {});
