// Panel «Misiones diarias» de la ficha: tres tarjetas en fila con las misiones al azar de hoy (ver rpg/daily.js).
// Cada una se marca con su casilla; el dado la cambia por otra (tres cambios al día). Se renuevan a las 3:00.
// La del atributo dormido lleva el sello «Despierta».
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon, V = App.rpgViews;

  function card(m, s) {
    var fixed = s.complete;   // con las tres hechas, quedan fijas
    // La del atributo dormido lleva el sello «Despierta» (misma XP que las demás).
    return '<li class="dl-card' + (m.wake ? ' dl-wake' : '') + '" data-done="' + m.done + '">' +
      (m.wake ? '<span class="dl-seal" title="Despierta a tu atributo dormido">Despierta</span>' : '') +
      (m.done || !s.rerollsLeft ? '' : '<button type="button" class="dl-reroll" data-act="reroll" data-id="' + esc(m.id) + '" aria-label="Cambiar «' + esc(m.name) + '» por otra misión" title="Cambiar por otra">' + icon('dice') + '</button>') +
      '<span class="dl-ic" aria-hidden="true">' + icon(m.icon) + '</span>' +
      '<span class="dl-sub">' + esc(m.main) + (m.subName ? ' · ' + esc(m.subName) : '') + '</span>' +
      '<h3 class="dl-name">' + esc(m.name) + '</h3>' +
      '<div class="dl-foot"><span class="dl-xp">+' + m.xp + ' XP</span>' +
        '<label class="dl-do"><input type="checkbox" data-daily="' + esc(m.id) + '"' + (m.done ? ' checked' : '') + (fixed ? ' disabled' : '') + '><span>Hecha</span></label></div></li>';
  }

  V.dailyPanel = function (host, ctx) {
    var daily = ctx.daily;
    host.innerHTML = '<div class="col-head"><h2>Misiones diarias</h2><span class="dl-rerolls" id="dl-rerolls"></span></div>' +
      '<p class="expire-tag">' + icon('clock') + 'Nuevas mañana a las 3:00</p>' +
      '<p class="msg" id="dl-msg" role="status" data-kind="ok"></p><div id="dl-body"><div class="skeleton" style="margin: 8px 0"></div></div>';
    var $ = function (s) { return host.querySelector(s); }, body = $('#dl-body');
    var state = null, busy = false;

    function say(t, kind) { var m = $('#dl-msg'); m.textContent = t || ''; m.setAttribute('data-kind', kind || 'ok'); }
    function paint() {
      var left = state.rerollsLeft, used = R.DAILY_REROLLS - left, dots = '';
      for (var i = 0; i < R.DAILY_REROLLS; i++) dots += '<i' + (i < used ? ' class="on"' : '') + '></i>';
      $('#dl-rerolls').innerHTML = 'Cambios <span class="dl-dots" aria-hidden="true">' + dots + '</span> <b>' + left + '</b> de ' + R.DAILY_REROLLS;
      $('#dl-rerolls').setAttribute('aria-label', 'Te quedan ' + left + ' de ' + R.DAILY_REROLLS + ' cambios hoy');
      body.innerHTML = state.missions.length
        ? (state.complete ? '<p class="dl-complete">¡Día completo! +' + R.DAILY_BONUS_XP + ' XP</p>' : '') + '<ul class="dl-row">' + state.missions.map(function (m) { return card(m, state); }).join('') + '</ul>'
        : '<p class="soft">No hay misiones en tu batería. Añade alguna en <a href="#/ajustes/diarias">Configuración</a>.</p>';
    }
    function reload() { return daily.state().then(function (s) { state = s; paint(); }); }

    // Marcar o desmarcar: la tarjeta cambia al momento; el guardado va detrás y la ficha se refresca al terminar.
    host.addEventListener('change', function (ev) {
      var t = ev.target, id = t && t.getAttribute ? t.getAttribute('data-daily') : null;
      if (!id) return;
      if (busy) { t.checked = !t.checked; return; }
      var on = t.checked;
      function go() {
        busy = true;
        var li = t.closest('.dl-card'); if (li) li.setAttribute('data-done', String(on));
        var rr = li && li.querySelector('.dl-reroll'); if (rr) rr.hidden = on;
        (on ? daily.complete(id) : daily.uncomplete(id)).then(function (events) { return ctx.afterChange(state.day, events); })
          .catch(function (e) { say(e.message, 'error'); return reload(); }).then(function () { busy = false; });
      }
      var m = state.missions.filter(function (x) { return x.id === id; })[0];
      if (on) { if (V.fx) V.fx.sparks(t, m ? m.xp : 0); return go(); }   // chispas de la casilla a la barra de XP
      // Desmarcar quita su XP: primero se pregunta en la propia tarjeta.
      App.ui.askUncheck(t, '.dl-card', '¿Desmarcar? Se quitan sus ' + App.ui.xpText(m ? m.xp : 0) + '.', go);
    });
    host.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-act="reroll"]') : null;
      if (!t || busy) return;
      busy = true; t.disabled = true;
      var li = t.closest('.dl-card'); if (li) li.classList.add('dl-rolling');
      daily.reroll(t.getAttribute('data-id')).then(function (m) { say('Nueva misión: ' + m.name); return reload(); })
        .catch(function (e) { say(e.message, 'error'); return reload(); }).then(function () { busy = false; });
    });

    return { reload: function () { return reload().catch(function (err) { body.innerHTML = '<div class="msg" data-kind="error">No se pudieron cargar las misiones diarias. ' + esc(err.message || '') + '</div>'; }); } };
  };
})(window.App = window.App || {});
