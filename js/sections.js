// Mapa de secciones. Para añadir una sección: crea su vista en views/, añade su <script> en index.html y regístrala aquí.
(function (App) {
  var v = App.views;
  // `bottom: true` => aparece en la barra inferior del móvil; el resto va en "Más".
  App.sections = [
    { id: 'inicio',    label: 'Inicio',                icon: 'home',    bottom: true, view: v.home },
    { id: 'diario',    label: 'Diario',                icon: 'book',    bottom: true, view: v.diary },
    { id: 'personas',  label: 'Personas',              icon: 'people',  bottom: true, view: v.people },
    { id: 'animo',     label: 'Estado de ánimo',       icon: 'mood',    bottom: true, short: 'Ánimo', view: v.mood },
    { id: 'personaje', label: 'Personaje',             icon: 'star',    view: v.character },
    { id: 'coleccion', label: 'Colección', icon: 'locket',  view: v.collection },
    { id: 'ajustes',   label: 'Configuración',         icon: 'sliders', view: v.settings }
  ];
})(window.App = window.App || {});
