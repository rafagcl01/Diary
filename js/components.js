// Componentes de interfaz compartidos. Un cambio de diseño aquí (y en su bloque de app.css) se aplica en toda la aplicación.
//   App.ui.stepper(o)        número con − y + propios (sin las flechas del navegador); también se puede escribir.
//   App.ui.editButton(…)     botón redondo con lápiz que aparece al pasar el ratón por una tarjeta (.has-edit).
//   App.ui.enhanceSelects()  convierte cada <select> en el desplegable de la aplicación. El <select> sigue debajo, oculto:
//                            es quien guarda el valor y lanza «change», así el código de cada pantalla no cambia.
// Las casillas (checkbox) y las barras de desplazamiento son solo CSS (ver «Componentes compartidos» en app.css).
(function (App) {
  var esc = App.escapeHtml, icon = App.icon;
  var ui = App.ui = App.ui || {};

  // ---- Número con − y + ----
  // o: { id, attrs (HTML extra para el <input>, p. ej. data-*), value, min, max, step, label, unit, disabled }
  // Los botones dan saltos de `step` (redondeando al múltiplo más cercano); al escribir vale cualquier entero.
  ui.stepper = function (o) {
    var dis = o.disabled ? ' disabled' : '';
    return '<span class="stepper">' +
      '<button type="button" class="st-btn" data-st="-1" tabindex="-1" aria-label="Menos"' + dis + '>−</button>' +
      '<input type="number" inputmode="numeric"' + (o.id ? ' id="' + esc(o.id) + '"' : '') + ' min="' + o.min + '" max="' + o.max + '" step="1" data-st-step="' + (o.step || 1) + '"' +
        ' value="' + esc(o.value === undefined || o.value === null ? '' : o.value) + '"' + (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + (o.attrs ? ' ' + o.attrs : '') + dis + '>' +
      (o.unit ? '<span class="st-unit" aria-hidden="true">' + esc(o.unit) + '</span>' : '') +
      '<button type="button" class="st-btn" data-st="1" tabindex="-1" aria-label="Más"' + dis + '>+</button></span>';
  };
  // Un toque en − o +: cambia el número y avisa con «input» y «change», como si se hubiera escrito.
  ui.stepperClick = function (btn) {
    var box = btn.closest('.stepper'), input = box && box.querySelector('input');
    if (!input || input.disabled) return;
    var dir = Number(btn.getAttribute('data-st')), step = Number(input.getAttribute('data-st-step')) || 1;
    var min = Number(input.getAttribute('min')), max = Number(input.getAttribute('max')), v = Math.floor(Number(input.value)) || 0;
    v = dir > 0 ? Math.floor(v / step) * step + step : Math.ceil(v / step) * step - step;
    if (isFinite(min)) v = Math.max(min, v);
    if (isFinite(max)) v = Math.min(max, v);
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // ---- Lápiz para editar una tarjeta ----
  ui.editButton = function (attrs, label) {
    return '<button type="button" class="edit-fab" ' + attrs + ' data-menu-label="Editar" aria-label="' + esc(label) + '" title="Editar">' + icon('pencil') + '</button>';
  };

  // ---- La caja de símbolos: la misma en toda la aplicación (galería única: App.SYMBOL_GROUPS en icons.js) ----
  // o: { name (de los radio), value, open (al crear algo nuevo: abierta), legend, extra: [{ id, label, html }] (opciones
  //      antes de la galería, p. ej. «La inicial del nombre») }.
  // Cerrada es una línea con el símbolo elegido y «Cambiar»; al pulsarla se abre la caja con todos, por temas. Por dentro
  // son radio con `name`, así que cada pantalla lee la elección como siempre (input[name=…]:checked o su «change»).
  ui.symbolPicker = function (o) {
    var value = o.value == null ? '' : o.value, extra = o.extra || [];
    function cell(id, label, inner) {
      return '<label class="symbol" title="' + esc(label) + '"><input type="radio" name="' + esc(o.name) + '" value="' + esc(id) + '"' + (id === value ? ' checked' : '') + ' data-sym-label="' + esc(label) + '">' +
        '<span class="symbol-box">' + inner + '</span><span class="sr">' + esc(label) + '</span></label>';
    }
    var cur = extra.filter(function (x) { return x.id === value; })[0];
    var curHtml = cur ? cur.html : (App.isSymbol(value) ? icon(value) : ''), curLabel = cur ? cur.label : (App.symbolLabel(value) || 'Elige uno');
    return '<fieldset class="symbols sym-picker"><legend>' + esc(o.legend || 'Icono') + '</legend>' +
      '<button type="button" class="sym-toggle" aria-expanded="' + !!o.open + '"><span class="sym-now" aria-hidden="true">' + curHtml + '</span>' +
        '<span class="sym-name">' + esc(curLabel) + '</span><span class="sym-change">' + (o.open ? 'Cerrar' : 'Cambiar') + '</span></button>' +
      '<div class="sym-box"' + (o.open ? '' : ' hidden') + '>' +
        (extra.length ? '<div class="symbol-grid">' + extra.map(function (x) { return cell(x.id, x.label, x.html); }).join('') + '</div>' : '') +
        App.SYMBOL_GROUPS.map(function (g) {
          return '<p class="sym-group">' + esc(g.label) + '</p><div class="symbol-grid">' + g.items.map(function (x) { return cell(x[0], x[1], icon(x[0])); }).join('') + '</div>';
        }).join('') + '</div></fieldset>';
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    // Abrir y cerrar la caja.
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.sym-toggle') : null;
      if (!b) return;
      var box = b.parentNode.querySelector('.sym-box'), open = box.hidden;
      box.hidden = !open; b.setAttribute('aria-expanded', String(open));
      var ch = b.querySelector('.sym-change'); if (ch) ch.textContent = open ? 'Cerrar' : 'Cambiar';
    });
    // Al elegir uno, la línea de arriba lo enseña.
    document.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.closest || t.type !== 'radio') return;
      var picker = t.closest('.sym-picker'); if (!picker) return;
      var now = picker.querySelector('.sym-now'), name = picker.querySelector('.sym-name'), box = t.closest('.symbol') && t.closest('.symbol').querySelector('.symbol-box');
      if (now && box) now.innerHTML = box.innerHTML;
      if (name) name.textContent = t.getAttribute('data-sym-label') || '';
    });
  }
  // ---- Confirmación en la misma fila (antes de quitar algo que dio XP) ----
  // questionHtml es HTML de confianza (escapa antes lo que venga del usuario). yesAttrs / noAttrs: atributos de cada botón.
  ui.askRow = function (questionHtml, yesAttrs, noAttrs, yesLabel) {
    return '<div class="ask-row" role="group" aria-label="Confirmar"><span class="ask-q">' + questionHtml + '</span>' +
      '<button type="button" class="mini danger" ' + yesAttrs + '>' + esc(yesLabel || 'Sí, quitar') + '</button>' +
      '<button type="button" class="mini" ' + noAttrs + '>No</button></div>';
  };
  ui.xpText = function (xp) { return '<b>' + xp + ' XP</b>'; };
  // Al desmarcar una casilla que dio XP: la casilla vuelve a marcarse y debajo, en su fila (`rowSel`), se pregunta.
  // «Sí» la desmarca de verdad y llama a onYes(); «No» la deja como estaba. Una sola pregunta abierta por fila.
  ui.askUncheck = function (box, rowSel, questionHtml, onYes) {
    var row = box.closest(rowSel); if (!row) { onYes(); return; }
    box.checked = true;
    var old = row.querySelector('.ask-row'); if (old) old.parentNode.removeChild(old);
    row.insertAdjacentHTML('beforeend', ui.askRow(questionHtml, 'data-ask="yes"', 'data-ask="no"', 'Sí, desmarcar'));
    row.setAttribute('data-asking', 'true');
    var ask = row.querySelector('.ask-row');
    function close() { if (ask.parentNode) ask.parentNode.removeChild(ask); row.removeAttribute('data-asking'); }
    ask.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-ask]') : null;
      if (!b) return;
      e.stopPropagation();
      close();
      if (b.getAttribute('data-ask') === 'yes') { box.checked = false; onYes(); } else if (box.focus) box.focus();
    });
    var yes = ask.querySelector('[data-ask="yes"]'); if (yes && yes.focus) yes.focus();
  };

  // El mismo lápiz cuando editar es ir a otra pantalla.
  ui.editLink = function (href, label) {
    return '<a class="edit-fab" href="' + esc(href) + '" data-menu-label="' + esc(label) + '" aria-label="' + esc(label) + '" title="Editar">' + icon('pencil') + '</a>';
  };

  // ---- Menú «⋯» para pantallas táctiles (sin ratón no hay «pasar por encima») ----
  // Una tarjeta o fila con controles que solo aparecen al pasar el ratón es un «anfitrión»: `.has-edit` o
  // `[data-menu-host]`. Sus controles llevan `data-menu-label`. En pantallas táctiles (CSS: hover: none) esos controles
  // se ocultan y se ve un «⋯» que abre un menú con ellos; mantener pulsado el anfitrión (medio segundo) abre el mismo menú.
  // Elegir una opción pulsa el control de verdad, así que cada pantalla no cambia nada de su lógica.
  var HOSTS = '.has-edit, [data-menu-host]';
  function menuItems(host) {
    return Array.prototype.filter.call(host.querySelectorAll('[data-menu-label]'), function (el) {
      return el.closest(HOSTS) === host && !el.disabled;
    });
  }
  ui.enhanceMenus = function (root) {
    (root || document).querySelectorAll(HOSTS).forEach(function (host) {
      var has = host.querySelector(':scope > .more-btn'), items = menuItems(host);
      if (!items.length) { if (has) has.parentNode.removeChild(has); return; }
      if (has) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'more-btn'; b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-label', 'Más opciones');
      b.textContent = '⋯';
      host.appendChild(b);
    });
  };
  var openMenu = null;
  function closeMenu(focusBack) {
    if (!openMenu) return;
    var m = openMenu; openMenu = null;
    if (m.el.parentNode) m.el.parentNode.removeChild(m.el);
    if (focusBack && m.anchor && m.anchor.focus) m.anchor.focus();
  }
  ui.openMenu = function (host) {
    closeMenu();
    var items = menuItems(host); if (!items.length) return;
    var anchor = host.querySelector(':scope > .more-btn') || host;
    var el = document.createElement('div');
    el.className = 'more-menu'; el.setAttribute('role', 'menu');
    el.innerHTML = items.map(function (it, i) { return '<button type="button" role="menuitem" data-i="' + i + '">' + esc(it.getAttribute('data-menu-label')) + '</button>'; }).join('') +
      '<button type="button" role="menuitem" data-i="-1" class="more-cancel">Cancelar</button>';
    document.body.appendChild(el);
    // Debajo del «⋯» (o de la tarjeta), sin salirse de la pantalla.
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)), top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    openMenu = { el: el, anchor: anchor };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-i]'); if (!b) return;
      var i = Number(b.getAttribute('data-i'));
      closeMenu(i < 0);
      if (i >= 0 && items[i]) items[i].click();
    });
    var first = el.querySelector('[role="menuitem"]'); if (first) first.focus();
  };

  // ---- Desplegable ----
  function labelOf(select) {
    var o = select.options[select.selectedIndex];
    return o ? o.textContent : '';
  }
  function sync(select) {
    var box = select.parentNode, btn = box && box.querySelector('.dd-btn');
    if (!btn) return;
    var txt = btn.querySelector('.dd-txt'), label = labelOf(select);
    if (txt.textContent !== label) txt.textContent = label;   // solo si cambia: así no se dispara otra vez el observador de main.js
    if (btn.disabled !== select.disabled) btn.disabled = select.disabled;
  }
  function close(box, focus) {
    var list = box.querySelector('.dd-list'), btn = box.querySelector('.dd-btn');
    if (!list || list.hidden) return;
    list.hidden = true; btn.setAttribute('aria-expanded', 'false'); box.classList.remove('open');
    if (focus) btn.focus();
  }
  function open(box) {
    var select = box.querySelector('select'), list = box.querySelector('.dd-list'), btn = box.querySelector('.dd-btn');
    document.querySelectorAll('.dd.open').forEach(function (b) { if (b !== box) close(b); });
    list.innerHTML = Array.prototype.map.call(select.options, function (o, i) {
      return '<li role="presentation"><button type="button" class="dd-opt" role="option" data-i="' + i + '" aria-selected="' + (i === select.selectedIndex) + '"' + (o.disabled ? ' disabled' : '') + '>' + esc(o.textContent) + '</button></li>';
    }).join('');
    list.hidden = false; btn.setAttribute('aria-expanded', 'true'); box.classList.add('open');
    var cur = list.querySelector('[aria-selected="true"]') || list.querySelector('.dd-opt');
    if (cur) cur.focus();
  }
  function choose(box, i) {
    var select = box.querySelector('select');
    if (select.selectedIndex !== i) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sync(select); close(box, true);
  }
  ui.enhanceSelect = function (select) {
    if (!select || select.getAttribute('data-dd') || select.multiple) return;
    select.setAttribute('data-dd', '1');
    var box = document.createElement('span');
    box.className = 'dd';
    select.parentNode.insertBefore(box, select);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    var named = select.getAttribute('aria-label');
    if (named) btn.setAttribute('aria-label', named);
    btn.innerHTML = '<span class="dd-txt"></span>';
    var list = document.createElement('ul');
    list.className = 'dd-list'; list.setAttribute('role', 'listbox'); list.hidden = true;
    if (named) list.setAttribute('aria-label', named);
    box.appendChild(btn); box.appendChild(select); box.appendChild(list);
    select.classList.add('dd-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    sync(select);
  };
  // Mejora todos los <select> que aún no lo estén y pone al día el texto de los que ya lo están.
  ui.enhanceSelects = function (root) {
    (root || document).querySelectorAll('select').forEach(function (s) { if (s.getAttribute('data-dd')) sync(s); else ui.enhanceSelect(s); });
  };

  // ---- Escuchas globales (una sola vez) ----
  if (typeof document !== 'undefined' && document.addEventListener) {
    // Pulsación larga (medio segundo, sin mover el dedo) sobre un anfitrión: abre su menú y anula el toque que venía detrás.
    var press = null, swallowClick = false;
    document.addEventListener('touchstart', function (e) {
      swallowClick = false;   // un toque nuevo: lo de la pulsación anterior ya no cuenta
      var t = e.target && e.target.closest ? e.target : null;
      var host = t && t.closest(HOSTS);
      if (!host || t.closest('input, textarea, select, .more-menu') || !menuItems(host).length) { press = null; return; }
      var p = e.touches[0];
      press = { host: host, x: p.clientX, y: p.clientY, timer: setTimeout(function () {
        if (!press) return;
        swallowClick = true; setTimeout(function () { swallowClick = false; }, 800);
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* sin vibración */ } }
        ui.openMenu(press.host); press = null;
      }, 500) };
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (!press) return;
      var p = e.touches[0];
      if (Math.abs(p.clientX - press.x) > 10 || Math.abs(p.clientY - press.y) > 10) { clearTimeout(press.timer); press = null; }
    }, { passive: true });
    document.addEventListener('touchend', function () { if (press) { clearTimeout(press.timer); press = null; } });
    document.addEventListener('contextmenu', function (e) { if (swallowClick || (e.target && e.target.closest && e.target.closest(HOSTS) && window.matchMedia && window.matchMedia('(hover: none)').matches)) e.preventDefault(); });
    document.addEventListener('click', function (e) {
      if (swallowClick) { swallowClick = false; if (!(e.target && e.target.closest && e.target.closest('.more-menu'))) { e.preventDefault(); e.stopPropagation(); return; } }
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openMenu) { e.preventDefault(); closeMenu(true); } });
    window.addEventListener('scroll', function () { closeMenu(); }, { passive: true });

    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
      var more = t.closest('.more-btn');
      if (more) { var h = more.closest(HOSTS); if (openMenu && openMenu.anchor === more) closeMenu(); else if (h) ui.openMenu(h); return; }
      if (openMenu && !t.closest('.more-menu')) closeMenu();
      var st = t.closest('.st-btn');
      if (st) { ui.stepperClick(st); return; }
      var box = t.closest('.dd');
      document.querySelectorAll('.dd.open').forEach(function (b) { if (b !== box) close(b); });
      if (!box) return;
      var opt = t.closest('.dd-opt');
      if (opt) { choose(box, Number(opt.getAttribute('data-i'))); return; }
      if (t.closest('.dd-btn')) { if (box.classList.contains('open')) close(box, true); else open(box); }
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target, box = t && t.closest ? t.closest('.dd') : null;
      if (!box) return;
      var opts = Array.prototype.slice.call(box.querySelectorAll('.dd-opt:not([disabled])'));
      if (t.classList.contains('dd-btn') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); open(box); return; }
      if (!t.classList.contains('dd-opt')) return;
      var at = opts.indexOf(t);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var nx = opts[(at + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length]; if (nx) nx.focus(); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); var ed = opts[e.key === 'Home' ? 0 : opts.length - 1]; if (ed) ed.focus(); }
      else if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.preventDefault(); close(box, e.key === 'Escape'); }
    });
    // Si el código cambia un <select> por su cuenta (valor por código, opciones nuevas), el texto del botón se pone al día.
    document.addEventListener('change', function (e) { if (e.target && e.target.getAttribute && e.target.getAttribute('data-dd')) sync(e.target); }, true);
  }
})(window.App = window.App || {});
