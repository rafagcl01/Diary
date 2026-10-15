// Selector de subcategorías con reparto (en porcentajes para misiones, en puntos para actividades).
// Solo pinta y calcula; quien lo usa guarda `values` ({ idSubcategoría: número }) y repinta.
(function (App) {
  var R = App.rpg, esc = App.escapeHtml, icon = App.icon;
  var P = App.rpgViews = App.rpgViews || {};
  P.pickers = {
    // [{ main, subs: [{id, name, icon}] }] a partir de la estructura (sin archivadas salvo que se pida).
    groups: function (structure, includeArchived) {
      return structure.map(function (a) { return { main: a.name, subs: a.subs.filter(function (s) { return includeArchived || !s.archived; }) }; })
        .filter(function (g) { return g.subs.length; });
    },
    total: function (values) { return Object.keys(values).reduce(function (t, k) { return t + (values[k] || 0); }, 0); },
    // Marca o desmarca una subcategoría. En porcentajes reparte a partes iguales; en puntos empieza en 1.
    toggle: function (values, id, mode) {
      if (values[id] !== undefined) delete values[id]; else values[id] = 1;
      if (mode === 'pct') {
        var ids = Object.keys(values), n = ids.length, each = n ? Math.floor(100 / n) : 0;
        ids.forEach(function (k, i) { values[k] = each + (i === 0 ? 100 - each * n : 0); });
      }
    },
    summaryText: function (values, mode) {
      var t = P.pickers.total(values);
      if (mode === 'pct') return 'Suman ' + t + '%' + (t === 100 || t === 0 ? '' : ' (deben sumar 100)');
      return 'Suman ' + t + ' de ' + R.ACTIVITY_MAX + ' XP' + (t > R.ACTIVITY_MAX ? ' (el máximo es ' + R.ACTIVITY_MAX + ')' : '');
    },
    toList: function (values, mode) {
      return Object.keys(values).map(function (k) { return mode === 'pct' ? { sub: k, pct: values[k] } : { sub: k, xp: values[k] }; });
    },
    html: function (groups, names, values, mode) {
      var picked = Object.keys(values);
      return '<div class="pk-groups">' + groups.map(function (g) {
        return '<div class="pk-group"><p class="pk-main">' + esc(g.main) + '</p><ul class="emo-caps pk-caps">' + g.subs.map(function (s) {
          return '<li><button type="button" class="emo-cap" data-pk="' + esc(s.id) + '" aria-pressed="' + (values[s.id] !== undefined) + '">' + icon(s.icon) + '<span>' + esc(s.name) + '</span></button></li>';
        }).join('') + '</ul></div>';
      }).join('') + '</div>' +
      (picked.length ? '<div class="share-rows">' + picked.map(function (id) {
        return '<label class="share-row"><span>' + esc(names[id] || id) + '</span><input type="number" inputmode="numeric" min="1" max="' + (mode === 'pct' ? 100 : R.ACTIVITY_MAX) + '" step="1" data-pkval="' + esc(id) + '" value="' + values[id] + '"><span>' + (mode === 'pct' ? '%' : 'XP') + '</span></label>';
      }).join('') + '</div>' : '') +
      '<p class="soft" data-pk-total role="status">' + (picked.length ? P.pickers.summaryText(values, mode) : (mode === 'pct' ? 'Sin subcategorías: solo sube el nivel general.' : 'Elige al menos una subcategoría.')) + '</p>';
    }
  };
})(window.App = window.App || {});
(function (App) {
  var esc = App.escapeHtml, U = App.rpgViews.util = {};
  U.fmtDay = function (day) {
    var d = new Date(day + 'T12:00:00');
    return isNaN(d.getTime()) ? day : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  U.bar = function (fraction, label) {
    return '<div class="xpbar" role="img" aria-label="' + esc(label) + '"><span style="width:' + Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%"></span></div>';
  };
  U.subNames = function (structure) {
    var out = {}; structure.forEach(function (a) { a.subs.forEach(function (s) { out[s.id] = s.name; }); }); return out;
  };
  U.levelNote = function (before, after) { return after > before ? ' · ¡Subes al nivel ' + after + '!' : ''; };
  U.symbolGrid = function (name, list, current) {
    var icon = App.icon;
    return '<fieldset class="symbols"><legend>Icono</legend><div class="symbol-grid">' + list.map(function (id) {
      return '<label class="symbol"><input type="radio" name="' + name + '" value="' + id + '"' + (id === current ? ' checked' : '') + '><span class="symbol-box">' + icon(id) + '</span><span class="sr">' + esc(id) + '</span></label>';
    }).join('') + '</div></fieldset>';
  };
})(window.App = window.App || {});
