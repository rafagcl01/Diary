// Piezas de HTML de Personas. Todo lo que escribe el usuario (nombres, apodos, notas, etiquetas, textos) se escapa aquí.
// No hay puntuaciones, rankings ni "niveles de relación": una ficha es un álbum, no un marcador.
(function (App) {
  var D = App.diary, esc = App.escapeHtml, icon = App.icon;

  function hash(id) { var h = 0, s = String(id); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 5; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // Avatar: el símbolo elegido o, si no hay, la inicial. Solo decorativo (el nombre siempre va escrito al lado).
  function avatar(p, size) {
    var inner = p.symbol && D.isSymbol(p.symbol) ? icon(p.symbol) : '<span class="av-letter">' + esc(D.personInitial(p)) + '</span>';
    return '<span class="avatar av-' + hash(p.id) + (size ? ' ' + size : '') + '" aria-hidden="true">' + inner + '</span>';
  }
  // "amiga · la conocí en mayo de 2019"
  function meta(p) {
    var bits = [];
    if (p.relation) bits.push(esc(p.relation));
    if (p.met) bits.push('la conocí ' + (p.met.length === 4 ? 'en ' : p.met.length === 7 ? 'en ' : 'el ') + esc(D.formatMet(p.met)));
    return bits.join(' · ');
  }
  function aliases(p) { return p.nicknames.length ? 'También: ' + p.nicknames.map(esc).join(', ') : ''; }

  // Las personas de una entrada, como enlaces a su ficha. Los identificadores que ya no existen se ignoran sin ruido.
  function personChips(ids, byId, label) {
    var items = (ids || []).map(function (id) {
      var p = byId && byId[id];
      return p ? '<li class="chip person-chip"><a href="#/personas/' + esc(p.id) + '">' + avatar(p, 'tiny') + '<span>' + esc(p.name) + '</span></a></li>' : '';
    }).join('');
    return items ? '<ul class="chips entry-people" aria-label="' + (label || 'Personas') + '">' + items + '</ul>' : '';
  }

  // Una persona en la lista
  function item(p, act) {
    var m = meta(p), a = aliases(p);
    var count = act && act.count ? plural(act.count, 'fragmento', 'fragmentos') : 'Sin fragmentos todavía';
    return '<li><a class="person-item" href="#/personas/' + esc(p.id) + '">' + avatar(p) +
      '<span class="person-body"><span class="person-name">' + esc(p.name) + '</span>' +
        (a ? '<span class="person-sub">' + a + '</span>' : '') +
        (m ? '<span class="person-sub">' + m + '</span>' : '') +
        (p.tags.length ? '<span class="person-sub tags">' + p.tags.map(function (t) { return '#' + esc(t); }).join(' ') + '</span>' : '') +
      '</span><span class="person-count soft">' + count + '</span></a></li>';
  }

  // Un fragmento vinculado a la persona, con su fecha, TODO su texto (el contexto original) y el enlace a la página.
  function fragment(f, byId, selfId, starred) {
    var others = (f.block.people || []).filter(function (id) { return id !== selfId; });
    var ref = esc(f.day) + '|' + esc(f.block.id);
    return '<li class="fragment" data-ref="' + ref + '">' +
      '<div class="frag-head"><a class="frag-date" href="#/diario/' + esc(f.day) + '">' + esc(D.formatLong(f.day)) + '</a>' +
        '<span class="soft frag-pos">entrada ' + (f.index + 1) + ' de ' + f.total + (f.pageTitle ? ' · ' + esc(f.pageTitle) : '') + '</span>' +
        '<button type="button" class="mini star-btn" data-star="' + ref + '" aria-pressed="' + (starred ? 'true' : 'false') + '">' +
          icon('star', starred ? 'filled' : '') + (starred ? 'Destacado' : 'Destacar') + '</button></div>' +
      (f.block.text ? App.diaryHtml.paragraphs(f.block.text) : '<p class="soft">Esta entrada no tiene texto.</p>') +
      '<div class="frag-foot">' + (others.length ? '<span class="soft">Con</span>' + personChips(others, byId, 'Otras personas de esta entrada') : '') +
        '<a class="link" href="#/diario/' + esc(f.day) + '">Abrir la página original</a></div></li>';
  }

  App.peopleHtml = { avatar: avatar, meta: meta, aliases: aliases, personChips: personChips, item: item, fragment: fragment, plural: plural };
})(window.App = window.App || {});
