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
    return '<button type="button" class="edit-fab" ' + attrs + ' aria-label="' + esc(label) + '" title="Editar">' + icon('pencil') + '</button>';
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
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target : null;
      if (!t) return;
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
