// Iconos de línea (24x24), con pequeños detalles a propósito: costuras, grietas, ojos.
// Se pintan en línea para poder colorearlos con CSS (currentColor).
(function (App) {
  var paths = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M12 17.8c-1.6-1-2-1.7-1.5-2.3.4-.5 1.1-.4 1.5.2.4-.6 1.1-.7 1.5-.2.5.6.1 1.3-1.5 2.3z"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M14 4v6l1.5-1.2L17 10V4"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.3 5 2.7 5 5.8"/>',
    mood: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/>',
    star: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
    grim: '<path d="M6 3h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V3z"/><path d="M12.5 7l.9 2 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9.5 9.3l2.1-.3z"/>',
    locket: '<circle cx="12" cy="14" r="6"/><path d="M12 8V4M9 4h6"/><path d="M12 16.6c-2.8-1.8-3.4-3-2.6-4 .7-.9 1.9-.7 2.6.3.7-1 1.9-1.2 2.6-.3.8 1 .2 2.2-2.6 4z"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    heart: '<path d="M12 20.5C5 15.5 3.5 11.5 5.5 8.5c1.7-2.4 4.9-2.1 6.5.6 1.6-2.7 4.8-3 6.5-.6 2 3 .5 7-6.5 12z"/>',
    mended: '<path d="M12 20.5C5 15.5 3.5 11.5 5.5 8.5c1.7-2.4 4.9-2.1 6.5.6 1.6-2.7 4.8-3 6.5-.6 2 3 .5 7-6.5 12z"/><path d="M12 9.1l-1.6 3 2.2 1.6-1.4 3.2"/><path d="M10 11l-1.4.4M12.6 12.3l1.4-.3M11.2 14.7l-1.3.5" stroke-width="1.2"/>',
    bow: '<path d="M12 12c-2-3.5-6-5-8-3.5S3.5 15 7 14.5L12 12zm0 0c2-3.5 6-5 8-3.5S20.5 15 17 14.5L12 12z"/><circle cx="12" cy="12" r="1.6"/><path d="M11 13.5l-2 6M13 13.5l2 6"/>',
    moon: '<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z"/>',
    rose: '<path d="M12 4c3 0 5 2 5 4.5S15 13 12 13s-5-2-5-4.5S9 4 12 4z"/><path d="M12 7.5c1.4 0 2.3.8 2.3 1.8M10 9c.4-1 1.2-1.5 2-1.5"/><path d="M12 13v8M12 17c-2.5 0-4-1-4.5-2.5M12 18.5c2 0 3.5-.8 4-2"/>',
    eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    key: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M17 12v3M20 12v2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>',
    // Caras de ánimo (los ojos y la boca; el círculo lo pone el CSS)
    'f-radiante': '<path d="M7.5 11c.5-1.2 1.7-1.2 2.2 0M14.3 11c.5-1.2 1.7-1.2 2.2 0"/><path d="M8 14.5c1 2.5 6 2.5 8 0"/>',
    'f-tranquila': '<path d="M7.5 11.2c.5 1 1.7 1 2.2 0M14.3 11.2c.5 1 1.7 1 2.2 0"/><path d="M9.5 15c1.4 1 3.6 1 5 0"/>',
    'f-normal': '<circle cx="9" cy="11" r=".8"/><circle cx="15" cy="11" r=".8"/><path d="M9.5 15h5"/>',
    'f-cansada': '<path d="M7.5 11h2.4M14.1 11h2.4"/><path d="M10 15.2c1.3-.6 2.7-.6 4 0"/>',
    'f-ansiosa': '<circle cx="9" cy="11" r=".9"/><circle cx="15" cy="11" r=".9"/><path d="M8.5 15.2c.8-.8 1.6.8 2.4 0s1.6.8 2.4 0 1.6.8 2.4 0"/>',
    'f-triste': '<circle cx="9" cy="11" r=".8"/><circle cx="15" cy="11" r=".8"/><path d="M9 16.2c1-1.5 5-1.5 6 0"/><path d="M15.6 12.6v1.9"/>',
    'f-enfadada': '<path d="M7.3 9.2l3 1M16.7 9.2l-3 1"/><circle cx="9.3" cy="12" r=".8"/><circle cx="14.7" cy="12" r=".8"/><path d="M9.5 16c1.5-1 3.5-1 5 0"/>'
  };

  App.icon = function (name, extraClass) {
    return '<svg class="ic ' + (extraClass || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || '') + '</svg>';
  };
})(window.App = window.App || {});
