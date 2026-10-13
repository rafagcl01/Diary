(function (App) {
  var icon = App.icon;
  var sections = App.sections;

  App.prefs.apply();

  var mount = document.getElementById('contenido');
  var sidebar = document.getElementById('sidebar');
  var bottomNav = document.getElementById('bottom-nav');
  var sheet = document.getElementById('more-sheet');

  var bottomSections = sections.filter(function (s) { return s.bottom; });
  var moreSections = sections.filter(function (s) { return !s.bottom; });

  function link(s, label) {
    return '<a href="#/' + s.id + '" data-route="' + s.id + '">' + icon(s.icon) + '<span>' + (label || s.label) + '</span></a>';
  }

  // Corazón remendado del logo: al pasar el cursor, la grieta se abre y aparece un ojo.
  var brandHeart =
    '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
      '<path d="M20 35C8 26.5 5 19.5 8.5 14.5c3-4.2 8.5-3.4 11.5 1.2 3-4.6 8.5-5.4 11.5-1.2 3.5 5 .5 12-11.5 20.5z" fill="#F3C6DA" stroke="#FFF5F8" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<g class="crack" fill="none" stroke="#19131B" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20.5 15.8l-2.8 5.2 3.8 2.8-2.4 5.6"/><path d="M17 18.6l-2.4.7M21.9 21l2.4-.5M19.6 25.5l-2.2.8" stroke-width="1.2"/>' +
      '</g>' +
      '<g class="eye" fill="none" stroke="#19131B" stroke-width="1.5" stroke-linecap="round">' +
        '<path d="M12.5 21.5s3-4.4 7.5-4.4 7.5 4.4 7.5 4.4-3 4.4-7.5 4.4-7.5-4.4-7.5-4.4z" fill="#FFF5F8"/><circle cx="20" cy="21.5" r="2.4" fill="#A52E69"/>' +
      '</g>' +
    '</svg>';

  // Barra lateral (escritorio)
  sidebar.innerHTML =
    '<a class="brand" href="#/inicio" aria-label="Mi diario, ir al inicio">' + brandHeart +
      '<span><span class="brand-name">Mi diario</span><span class="brand-sub">diario secreto</span></span></a>' +
    '<nav class="nav" aria-label="Secciones"><ul>' +
      sections.map(function (s) { return '<li>' + link(s) + '</li>'; }).join('') +
    '</ul></nav>' +
    '<a class="data-status" id="data-status" href="#/ajustes" data-state="disconnected"><i></i><span></span></a>' +
    '<div class="side-foot">' +
      '<button type="button" class="toggle" id="fx-toggle">Efectos <b id="fx-state"></b></button>' +
      '<button type="button" class="toggle" id="theme-toggle">Tema <b id="theme-state"></b></button>' +
    '</div>';

  var labels = { auto: 'AUTO', on: 'ON', off: 'OFF', light: 'CLARO', dark: 'OSCURO' };
  function paintToggles() {
    var p = App.prefs.get();
    document.getElementById('fx-state').textContent = labels[p.motion];
    document.getElementById('theme-state').textContent = labels[p.theme];
  }
  function cycle(list, current) { return list[(list.indexOf(current) + 1) % list.length]; }
  document.getElementById('fx-toggle').addEventListener('click', function () {
    App.prefs.set({ motion: cycle(['auto', 'off', 'on'], App.prefs.get().motion) });
    App.prefs.apply(); paintToggles();
  });
  document.getElementById('theme-toggle').addEventListener('click', function () {
    App.prefs.set({ theme: cycle(App.prefs.THEME, App.prefs.get().theme) });
    App.prefs.apply(); paintToggles();
  });
  paintToggles();

  // Estado de la conexión con los datos (se comprueba al abrir si ya estaba configurada)
  App.connection.init();
  var dataStatus = document.getElementById('data-status');
  function paintStatus() {
    var d = App.connection.describe(), label;
    if (d.state === 'connected') label = 'Datos: ' + d.repo;
    else if (d.state === 'configured') label = 'Datos: comprobando…';
    else if (d.state === 'error') label = 'Datos: sin conexión';
    else label = 'Datos: sin conectar';
    dataStatus.dataset.state = d.state;
    dataStatus.querySelector('span').textContent = label;
    dataStatus.title = d.state === 'error' ? d.message : '';
  }
  App.connection.onChange(paintStatus);
  paintStatus();
  if (App.connection.isConfigured()) App.connection.check();

  // Barra inferior (móvil)
  bottomNav.innerHTML =
    bottomSections.map(function (s) { return link(s, s.short); }).join('') +
    '<button type="button" id="more-button" aria-haspopup="dialog">' + icon('more') + '<span>Más</span></button>';

  // Hoja "Más"
  sheet.innerHTML =
    '<h2>Más secciones</h2>' +
    '<ul>' + moreSections.map(function (s) { return '<li>' + link(s) + '</li>'; }).join('') + '</ul>' +
    '<button type="button" class="sheet-close">Cerrar</button>';

  var moreButton = document.getElementById('more-button');
  moreButton.addEventListener('click', function () { sheet.showModal(); });
  sheet.addEventListener('click', function (e) {
    // Cierra al pulsar el fondo, un enlace o "Cerrar".
    if (e.target === sheet || e.target.closest('a') || e.target.closest('.sheet-close')) sheet.close();
  });

  function show(section, opts) {
    mount.replaceChildren();
    mount.dataset.view = section.id;
    section.view.render(mount);
    document.title = section.label + ' - Mi diario';

    document.querySelectorAll('[data-route]').forEach(function (a) {
      if (a.dataset.route === section.id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    moreButton.dataset.active = String(!section.bottom);

    if (!opts.initial) {
      window.scrollTo(0, 0);
      var title = mount.querySelector('#page-title');
      if (title) title.focus({ preventScroll: true });
    }
  }

  App.startRouter(sections, show);
})(window.App = window.App || {});
