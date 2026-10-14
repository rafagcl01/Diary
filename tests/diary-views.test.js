// Pruebas de las pantallas del diario sin navegador: HTML generado, rutas, editor, estadísticas e inicio.
// Ejecutar con: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const FILES = ['icons', 'prefs', 'ui', 'router', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection',
  'diary/entries', 'diary/repository', 'diary/drafts', 'diary/emotions', 'diary/people', 'diary/stats', 'views/diary/percent', 'views/diary/html', 'views/diary/list', 'views/diary/read', 'views/people/html', 'views/diary/people-picker', 'views/diary/editor',
  'views/diary', 'views/people/list', 'views/people/card', 'views/people/form', 'views/people', 'views/mood', 'views/home'];

function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, setTimeout, clearTimeout, ...extra });
  ctx.window = ctx;
  ctx.document = { documentElement: { dataset: {}, removeAttribute() {} } };
  ctx.location = { hash: '' };
  for (const f of FILES) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  return ctx.App;
}
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
// Un "documento" mínimo: cada selector devuelve su propio elemento, que recuerda lo que se le escribe y sus manejadores.
const fakeRoot = () => {
  const els = {};
  const make = () => {
    const el = { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, hidden: false, handlers: {}, attrs: {},
      addEventListener(type, fn) { (el.handlers[type] ??= []).push(fn); }, setAttribute(k, v) { el.attrs[k] = v; }, focus() {}, querySelectorAll() { return []; },
      showModal() { el.open = true; }, close() { el.open = false; }, classList: { add() {}, remove() {} }, style: { setProperty() {} }, offsetWidth: 0 };
    el.querySelector = (sel) => (els[sel] ??= make());
    return el;
  };
  return { innerHTML: '', els, querySelector(sel) { return (els[sel] ??= make()); } };
};
// Como en un navegador: el evento llega a TODOS los manejadores registrados en el elemento.
const fire = (el, type, ev) => (el.handlers[type] || []).forEach((h) => h(ev));
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const target = (map) => ({ closest: (sel) => map[sel] ?? null });
const day = (d) => '2026-10-' + String(d).padStart(2, '0');
const entryOf = (App, over = {}) => App.diary.sanitizeEntry({ day: '2026-10-13', title: 'Un día', blocks: [{ text: 'Texto del día.', mood: 'bien', tags: ['viaje'] }], ...over });
async function connected(extra = {}) {
  const fake = createFakeGithub(); const App = load({ localStorage: memoryStorage(), fetch: fake.fetch, ...extra });
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  return { App, fake, repo: App.diary.repo() };
}

test('todo lo que escribe el usuario se escapa en la cronología, la lectura, los borradores y los avisos', () => {
  const App = load({ localStorage: memoryStorage() });
  const evil = entryOf(App, { title: '<img src=x onerror=alert(1)>', blocks: [{ text: '<script>alert(2)</script>\nsegunda línea & más', tags: ['<b>x</b>'], mood: '<i>mal</i>' }] });
  const html = App.diaryHtml.item(evil) + App.diaryHtml.sheet(evil) + App.diaryHtml.list([evil], 10);
  assert.ok(!/<img src|<script>alert|<b>x<\/b>|<i>mal/.test(html), 'no debe quedar HTML del usuario sin escapar');
  assert.ok(html.includes('&lt;img') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('segunda línea &amp; más'));
  assert.ok(App.diaryHtml.sheet(evil).includes('<br>'), 'los saltos de línea dentro de un párrafo se conservan');
  const drafts = App.diaryHtml.drafts([{ key: '2026-10-13', day: '2026-10-13', title: '<u>borrador</u>', blocks: [], favorite: false }]);
  assert.ok(!drafts.includes('<u>') && drafts.includes('&lt;u&gt;'));
});

test('la lectura pone fecha y título dentro de la hoja, con el porcentaje, y por entrada el texto, el ánimo, las emociones y las etiquetas', () => {
  const App = load();
  const byId = { em_aaaaaaaa: { id: 'em_aaaaaaaa', name: 'Nostalgia', symbol: 'moon' } };
  const e = entryOf(App, { title: 'Un buen día', blocks: [{ text: 'Primero.', mood: 'mal', tags: ['trabajo'], emotions: ['em_aaaaaaaa'] }, { text: '', mood: 'muy-bien' }, { text: 'Último.' }] });
  const html = App.diaryHtml.sheet(e, byId);
  assert.equal((html.match(/class="block-read"/g) || []).length, 3);
  assert.match(html, /Mal/); assert.match(html, /Muy bien/); assert.match(html, /#trabajo/); assert.match(html, /Nostalgia/);
  const head = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
  assert.match(head, /martes, 13 de octubre de 2026|13 de octubre de 2026/, 'la fecha está dentro de la hoja');
  assert.match(head, /Un buen día/); assert.match(head, /data-pct="63"/, 'media de 25 y 100, la entrada sin estado no cuenta');
  assert.match(head, /Media de 2 de 3 entradas con estado/);
  assert.ok(html.indexOf('<header') > html.indexOf('class="card paper sheet"'), 'la cabecera va dentro de la hoja, no encima');
  assert.ok(!/b_[0-9a-f]{8}|em_aaaaaaaa|"blocks"|createdAt|updatedAt|aria-hidden="false"/.test(html));
  assert.ok(!/pct-ring/.test(App.diaryHtml.sheet(entryOf(App, { blocks: [{ text: 'sin estado' }] })).replace(/<span class="pct-ring" style="--p: 0"><span class="pct-num">–/, '')), 'sin estados no hay un 0% inventado');
  assert.match(App.diaryHtml.sheet(entryOf(App, { blocks: [{ text: 'sin estado' }] })), /Elige un estado en alguna entrada/);
  assert.match(App.diaryHtml.sheet(App.diary.sanitizeEntry({ day: '2026-10-13', title: 'Solo título' })), /solo tiene título/);
});

test('cronología: una página por día, con su porcentaje de ánimo, agrupada por mes', () => {
  const App = load();
  const a = entryOf(App, { day: '2026-10-13', favorite: true, blocks: [{ text: 'a', mood: 'muy-bien' }, { text: 'b', mood: 'mal' }, { text: 'c', mood: 'muy-bien' }] });
  const b = entryOf(App, { day: '2026-09-02' });
  const html = App.diaryHtml.list([a, b], 1);
  assert.match(html, /octubre de 2026/); assert.ok(!/septiembre/.test(html));
  assert.match(html, /3 entradas/); assert.match(html, /Favorita/);
  assert.match(html, /data-pct="75"/, 'media de 100, 25 y 100');
  assert.ok(!/data-pct/.test(App.diaryHtml.item(b).replace(/data-pct="50"/, '')) || /data-pct="75"/.test(html));
  assert.match(html, /Mostrar más \(1\)/); assert.match(App.diaryHtml.list([a, b], 10), /septiembre de 2026/);
  assert.match(html, /href="#\/diario\/2026-10-13"/);
});

test('calendario: cada día pasado lleva a su página (o a escribirla); los futuros no se pueden pulsar', () => {
  const App = load();
  const entries = [entryOf(App, { day: '2026-10-13' }), entryOf(App, { day: '2026-10-02', blocks: [{ text: 'a' }, { text: 'b' }] })];
  const html = App.diaryHtml.calendar(App.diary.monthGrid(2026, 9, entries), '2026-10-13');
  assert.equal((html.match(/<a class="day/g) || []).length, 13, 'del 1 al 13');
  assert.equal((html.match(/class="day future"/g) || []).length, 18, 'del 14 al 31 no se pueden abrir');
  assert.match(html, /aria-label="2 de octubre, 2 entradas"/); assert.match(html, /aria-label="13 de octubre, 1 entrada"/);
  assert.match(html, /aria-label="1 de octubre, sin página: escribir ese día"/);
  assert.match(html, /href="#\/diario\/2026-10-02"/); assert.match(html, /href="#\/diario\/2026-10-01\/editar"/);
  assert.match(html, /day has today/);
  assert.match(html, /aria-label="Mes anterior"/);
});

test('el aviso de formato antiguo explica qué pasará', () => {
  const App = load();
  assert.equal(App.diaryHtml.legacy({ months: [], count: 0 }), '');
  const html = App.diaryHtml.legacy({ months: ['2026-10'], count: 3 });
  assert.match(html, /3 entradas escritas/); assert.match(html, /una página por día/); assert.match(html, /id="migrate"/); assert.match(html, /copia/);
});

test('router: las direcciones del diario se separan en sección y parámetros', () => {
  const App = load();
  const r = (h) => plain(App.parseHash(h));
  assert.deepEqual(r('#/diario/2026-10-13/editar/nuevo'), { section: 'diario', params: ['2026-10-13', 'editar', 'nuevo'] });
  assert.deepEqual(r('#/diario'), { section: 'diario', params: [] });
  assert.deepEqual(r(''), { section: '', params: [] });
  assert.deepEqual(r('#/diario//hoy/'), { section: 'diario', params: ['hoy'] });
  assert.deepEqual(r('#/diario/%E0%A4%A').params, ['%E0%A4%A'], 'una codificación rota no rompe nada');
});

test('el diario reparte cada dirección a su pantalla', () => {
  const App = load({ localStorage: memoryStorage() });
  const calls = [];
  App.diaryViews.list = { render: () => calls.push(['list']) };
  App.diaryViews.read = { render: (root, d) => calls.push(['read', d]) };
  App.diaryViews.editor = { render: (root, d, o) => calls.push(['editor', d, plain(o)]) };
  const go = (params) => App.views.diary.render(fakeRoot(), { params });
  const today = App.diary.today();
  go([]); go(['hoy']); go(['2026-10-13']); go(['2026-10-13', 'editar']); go(['2026-10-13', 'editar', 'nuevo']);
  assert.deepEqual(plain(calls), [['list'], ['editor', today, { addBlock: true }], ['read', '2026-10-13'], ['editor', '2026-10-13', {}], ['editor', '2026-10-13', { addBlock: true }]]);
  for (const bad of [['otra'], ['2026-10-13', 'borrar'], ['2026-02-30'], ['2026-10-13', 'editar', 'x'], ['2026-10-13', 'editar', 'nuevo', 'más'], ['hoy', 'x'], ['__proto__']]) {
    const root = fakeRoot(); App.views.diary.render(root, { params: bad });
    assert.match(root.innerHTML, /No encuentro esa página/, JSON.stringify(bad));
  }
  assert.equal(calls.length, 5);
});

test('sin conexión, lista, lectura y estadísticas explican qué hacer y no fallan', () => {
  const App = load({ localStorage: memoryStorage() });
  const list = fakeRoot(); App.views.diary.render(list, { params: [] });
  assert.match(list.els['#list'].innerHTML, /Conecta tus datos para ver tus páginas/);
  const rd = fakeRoot(); App.views.diary.render(rd, { params: ['2026-10-13'] });
  assert.match(rd.innerHTML, /Conecta tus datos para leer esta página/);
  const mood = fakeRoot(); App.views.mood.render(mood);
  assert.match(mood.els['#m-body'].innerHTML, /Conecta tus datos para ver tus estadísticas/);
});

test('el editor de un día nuevo arranca con una entrada vacía, con ánimo, emociones y etiquetas, y funciona sin conexión', () => {
  const App = load({ localStorage: memoryStorage() });
  const root = fakeRoot(); App.views.diary.render(root, { params: ['2026-10-12', 'editar'] });
  assert.match(root.innerHTML, /id="e-title"/); assert.match(root.innerHTML, /id="emo-dialog"/); assert.match(root.innerHTML, /id="e-add"/); assert.match(root.innerHTML, /id="e-save"/);
  assert.match(root.innerHTML, /Todavía no hay datos conectados/);
  assert.ok(!/required/.test(root.innerHTML), 'ningún campo es obligatorio');
  const blocks = root.els['#e-blocks'].innerHTML;
  assert.equal((blocks.match(/<section class="block"/g) || []).length, 1);
  assert.equal((blocks.match(/role="radio"/g) || []).length, 5, 'cinco estados');
  assert.match(blocks, /data-emo-open=/);
  assert.match(blocks, /data-tag-input=/); assert.match(blocks, /<textarea/);
  assert.ok(!/ aria-checked="true"/.test(blocks), 'ningún ánimo marcado por defecto');
});

test('el editor rechaza días futuros y fechas inválidas', () => {
  const App = load({ localStorage: memoryStorage() });
  const future = fakeRoot(); App.views.diary.render(future, { params: ['2999-01-01', 'editar'] });
  assert.match(future.innerHTML, /todavía no ha llegado/);
  const hoy = fakeRoot(); App.views.diary.render(hoy, { params: ['hoy'] });
  assert.match(hoy.innerHTML, /id="e-save"/);
});

test('el editor recupera un borrador pendiente con sus bloques, ánimos y etiquetas (y lo escapa)', () => {
  const App = load({ localStorage: memoryStorage() });
  App.drafts.save('2026-10-12', { title: 'A medias', favorite: true, blocks: [{ text: 'Escribía <i>esto</i> cuando cerré', tags: ['viaje'], mood: 'mal' }, { text: 'Otra entrada', mood: 'muy-bien' }] });
  const root = fakeRoot(); App.views.diary.render(root, { params: ['2026-10-12', 'editar'] });
  assert.match(root.innerHTML, /Has recuperado un borrador/); assert.match(root.innerHTML, /value="A medias"/); assert.match(root.innerHTML, /id="e-discard"/);
  assert.match(root.innerHTML, /id="e-fav" type="checkbox" checked/);
  const blocks = root.els['#e-blocks'].innerHTML;
  assert.equal((blocks.match(/<section class="block"/g) || []).length, 2, 'editar no añade un bloque vacío: solo lo que había en el borrador');
  assert.ok(blocks.includes('Escribía &lt;i&gt;esto&lt;/i&gt; cuando cerré') && !blocks.includes('<i>esto</i>'));
  assert.equal((blocks.match(/aria-checked="true"/g) || []).length, 2);
  assert.match(blocks, /#viaje/);
});

test('el editor abre un día ya escrito con sus bloques y, si se pide, uno nuevo al final', async () => {
  const { App, repo } = await connected();
  await repo.save({ day: '2026-10-12', title: 'Ayer', blocks: [{ text: 'Uno', mood: 'mal', tags: ['casa'] }, { text: 'Dos', mood: 'neutro' }] }, { base: null });
  const plainRoot = fakeRoot(); App.views.diary.render(plainRoot, { params: ['2026-10-12', 'editar'] }); await tick();
  const b1 = plainRoot.els['#e-blocks'].innerHTML;
  assert.equal((b1.match(/<section class="block"/g) || []).length, 2);
  assert.match(plainRoot.innerHTML, /id="e-title"/); assert.match(plainRoot.innerHTML, /value="Ayer"/);
  assert.equal((b1.match(/aria-checked="true"/g) || []).length, 2);
  const more = fakeRoot(); App.views.diary.render(more, { params: ['2026-10-12', 'editar', 'nuevo'] }); await tick();
  assert.equal((more.els['#e-blocks'].innerHTML.match(/<section class="block"/g) || []).length, 3);
});

test('guardar desde el editor guarda los bloques con su ánimo y quita el borrador', async () => {
  const { App, repo, fake } = await connected();
  const root = fakeRoot(); App.views.diary.render(root, { params: ['2026-10-12', 'editar'] }); await tick();
  const view = root.els['.editor-view'];
  // escribir en el primer bloque y elegir un ánimo, como lo haría el navegador
  const id = /data-block-id="(b_[0-9a-f]{8})"/.exec(root.els['#e-blocks'].innerHTML)[1];
  const dataset = { text: id };
  fire(view, 'input', { target: { dataset, value: 'Un día tranquilo' } });
  fire(view, 'click', { target: target({ '[data-block-mood]': { dataset: { blockMood: id, mood: 'bien' } } }) });
  root.querySelector('#e-title').value = 'Ayer';
  App.drafts.save('2026-10-12', { title: 'x', blocks: [{ text: 'x' }] });
  root.els['#e-save'].handlers.click[0]();
  await tick(60);
  const saved = await repo.get('2026-10-12');
  assert.equal(saved.title, 'Ayer'); assert.equal(saved.blocks[0].text, 'Un día tranquilo'); assert.equal(saved.blocks[0].mood, 'bien');
  assert.equal(App.drafts.get('2026-10-12'), null, 'tras guardar no queda borrador');
  assert.ok(fake.state.files.has('entries/2026-10.json'));
});

test('guardar un editor sin nada escrito no guarda y lo explica', async () => {
  const { App, fake } = await connected();
  const before = fake.state.files.size;
  const root = fakeRoot(); App.views.diary.render(root, { params: ['2026-10-12', 'editar'] }); await tick();
  root.els['#e-save'].handlers.click[0]();
  assert.match(root.els['#e-msg'].textContent, /Escribe algo/);
  assert.equal(fake.state.files.size, before);
});

test('estadísticas: estado vacío cuando aún no hay ánimos', async () => {
  const { App, repo } = await connected();
  await repo.save({ day: '2026-10-12', blocks: [{ text: 'Solo texto' }] }, { base: null });
  const root = fakeRoot(); App.views.mood.render(root); await tick();
  assert.match(root.els['#m-body'].innerHTML, /Todavía no hay estados de ánimo/);
  assert.match(root.els['#m-body'].innerHTML, /href="#\/diario\/hoy"/);
});

test('estadísticas: reparto, calendario y mes a mes, con números y sin juicios de valor', async () => {
  const { App, repo } = await connected();
  const today = App.diary.today(), key = today.slice(0, 7);
  await repo.save({ day: key + '-01', blocks: [{ text: 'a', mood: 'mal', tags: ['casa'] }, { text: 'b', mood: 'muy-bien' }, { text: 'c', mood: 'mal' }] }, { base: null });
  const root = fakeRoot(); App.views.mood.render(root); await tick();
  const html = root.els['#m-body'].innerHTML;
  assert.match(html, /3 entradas con estado en 1 día\. Ánimo medio del mes: <b>50%<\/b>/);
  assert.match(html, /Mal<\/span><\/span><span class="hbar"/); assert.match(html, /2 <small>\(67%\)<\/small>/);
  assert.match(html, /class="day moodday m-mal"/);
  assert.match(html, /Mes a mes/); assert.equal((html.match(/class="trend-col/g) || []).length, 12);
  assert.match(html, /no significan que una cause la otra|no significa que una cause la otra/);
  assert.match(html, /Muy bien 100 %, Bien 75 %, Neutro 50 %, Mal 25 %, Muy mal 0 %/); assert.match(html, /las emociones tampoco/);
  assert.match(html, /Todavía hay pocos registros para buscar pistas/);
  assert.ok(!/error|fallo|peor|alerta|corregir|problema/i.test(html), 'ningún ánimo se presenta como un error');
});

test('estadísticas: no hay ninguna interfaz para apuntar ánimos (se hace en los bloques)', async () => {
  const { App, repo } = await connected();
  await repo.save({ day: App.diary.today(), blocks: [{ text: 'a', mood: 'neutro' }] }, { base: null });
  const root = fakeRoot(); App.views.mood.render(root); await tick();
  const html = root.innerHTML + root.els['#m-body'].innerHTML;
  assert.ok(!/role="radio"|data-m=|Guardar/.test(html));
});

test('el selector de ánimo del inicio apunta un bloque en la entrada de hoy', async () => {
  const { App, repo } = await connected();
  const root = fakeRoot(); App.views.home.render(root);
  const card = root.els['.mood-card'];
  const click = card.handlers.click[0];
  click({ target: target({ '#home-mood-save': {} }) });
  assert.match(root.els['#home-mood-msg'].innerHTML, /Elige primero/);
  click({ target: target({ '[data-m]': { dataset: { m: 'mal' } } }) });
  click({ target: target({ '#home-mood-save': {} }) });
  await tick(60);
  assert.match(root.els['#home-mood-msg'].innerHTML, /Apuntado en la página de hoy/);
  const today = await repo.get(App.diary.today());
  assert.equal(today.blocks.length, 1); assert.equal(today.blocks[0].mood, 'mal'); assert.equal(today.blocks[0].text, '');
});

test('sin conexión, apuntar un ánimo desde el inicio lo explica en vez de perderlo', () => {
  const App = load({ localStorage: memoryStorage() });
  const root = fakeRoot(); App.views.home.render(root);
  const click = root.els['.mood-card'].handlers.click[0];
  click({ target: target({ '[data-m]': { dataset: { m: 'muy-bien' } } }) });
  click({ target: target({ '#home-mood-save': {} }) });
  assert.match(root.els['#home-mood-msg'].innerHTML, /Conecta tus datos/);
});

test('el inicio muestra entradas recientes y "hace un año" cuando hay datos', async () => {
  const { App, repo } = await connected();
  const today = App.diary.today(), lastYear = String(Number(today.slice(0, 4)) - 1) + today.slice(4);
  await repo.save({ day: lastYear, title: 'Hace un año <b>', blocks: [{ text: 'Recuerdo de entonces.' }] }, { base: null });
  await repo.save({ day: today, title: 'Hoy', blocks: [{ text: 'Algo de hoy.' }] }, { base: null });
  const root = fakeRoot(); App.views.home.render(root); await tick();
  assert.match(root.els['#home-recent-body'].innerHTML, /Hoy/);
  assert.match(root.els['#home-recent-body'].innerHTML, /Hace un año &lt;b&gt;/);
  assert.match(root.els['#home-memories-body'].innerHTML, /Recuerdo de entonces/);
  assert.ok(!root.els['#home-memories-body'].innerHTML.includes('Algo de hoy'));
});

test('el inicio sin entradas invita a escribir la primera', async () => {
  const { App } = await connected();
  const root = fakeRoot(); App.views.home.render(root); await tick();
  assert.match(root.els['#home-recent-body'].innerHTML, /Escribir la primera/);
  assert.match(root.innerHTML, /href="#\/diario\/hoy"/);
});

test('desde el editor: crear una emoción nueva, asignarla y guardar; el estado se guarda y el porcentaje no se mueve', async () => {
  const { App, repo, fake } = await connected();
  const root = fakeRoot(); App.views.diary.render(root, { params: ['2026-10-12', 'editar'] }); await tick();
  const view = root.els['.editor-view'];
  const id = /data-block-id="(b_[0-9a-f]{8})"/.exec(root.els['#e-blocks'].innerHTML)[1];
  const click = (map) => fire(view, 'click', { target: target(map) });
  fire(view, 'input', { target: { dataset: { text: id }, value: 'Hoy ha ido bien' } });
  click({ '[data-block-mood]': { dataset: { blockMood: id, mood: 'bien' } } });
  const pctBefore = root.els['#pct-slot'].innerHTML;
  assert.match(pctBefore, /data-pct="75"/, 'Bien = 75 %');
  // abrir el diálogo, crear "Nostalgia" con un símbolo de la galería y comprobar que se añade a la entrada
  click({ '[data-emo-open]': { dataset: { emoOpen: id } } });
  assert.equal(root.els['#emo-dialog'].open, true);
  click({ '#emo-new': {} });
  root.els['#emo-name'].value = 'Nostalgia';
  const symbol = App.diary.EMOTION_SYMBOLS[0].id;
  fire(view, 'change', { target: { id: 'emo-symbol-x', name: 'emo-symbol', value: symbol } });
  click({ '#emo-save': {} });
  await tick(80);
  assert.match(root.els['#emo-msg'].textContent, /Emoción creada y marcada/);
  assert.doesNotMatch(root.els[`[data-emolist="${id}"]`].innerHTML, /Nostalgia/, 'hasta pulsar Aceptar no se añade a la entrada');
  assert.match(root.els['#emo-list'].innerHTML, /Nostalgia/);
  assert.match(root.els['#emo-list'].innerHTML, /aria-pressed="true"/);
  assert.doesNotMatch(root.els['#emo-list'].innerHTML, /data-emo-edit|Editar</, 'sin botón Editar junto a cada emoción');
  assert.equal(root.els['#emo-edit'].disabled, false, 'con una marcada se puede editar');
  assert.equal(root.els['#pct-slot'].innerHTML, pctBefore, 'crear y asignar una emoción no cambia el porcentaje');
  // una segunda emoción y quitarla otra vez
  click({ '#emo-new': {} }); root.els['#emo-name'].value = 'Ilusión';
  fire(view, 'change', { target: { id: 'x', name: 'emo-symbol', value: App.diary.EMOTION_SYMBOLS[1].id } });
  click({ '#emo-save': {} }); await tick(80);
  assert.equal(root.els['#pct-slot'].innerHTML, pctBefore);
  assert.equal(root.els['#emo-edit'].disabled, false);
  // pulsar la cápsula de una marcada la desmarca
  const ids = [...root.els['#emo-list'].innerHTML.matchAll(/data-emo-check="(em_[0-9a-f]{8})"/g)].map((m) => m[1]);
  click({ '[data-emo-check]': { dataset: { emoCheck: ids[0] } } });
  assert.equal([...root.els['#emo-list'].innerHTML.matchAll(/aria-pressed="true"/g)].length, 1);
  click({ '[data-emo-check]': { dataset: { emoCheck: ids[0] } } });
  assert.equal([...root.els['#emo-list'].innerHTML.matchAll(/aria-pressed="true"/g)].length, 2);
  click({ '#emo-done': {} });
  assert.equal(root.els['#emo-dialog'].open, false);
  assert.match(root.els[`[data-emolist="${id}"]`].innerHTML, /Nostalgia/);
  assert.match(root.els[`[data-emolist="${id}"]`].innerHTML, /Ilusión/);
  const saveBefore = fake.state.files.get('emotions.json');
  assert.ok(saveBefore, 'la biblioteca de emociones se guarda en emotions.json');
  root.els['#e-save'].handlers.click[0](); await tick(80);
  const saved = await repo.get('2026-10-12');
  assert.equal(saved.blocks[0].mood, 'bien'); assert.equal(saved.blocks[0].emotions.length, 2);
  const lib = (await App.diary.emotions().list()).map((e) => e.name).sort();
  assert.deepEqual(plain(lib), ['Ilusión', 'Nostalgia']);
  assert.equal(App.diary.dayMood(saved).percent, 75);
});

test('editar o borrar emociones de una entrada nunca cambia el porcentaje guardado', async () => {
  const { App, repo } = await connected();
  const emo = App.diary.emotions();
  const a = await emo.create({ name: 'Calma', symbol: App.diary.EMOTION_SYMBOLS[0].id });
  await repo.save({ day: '2026-10-12', blocks: [{ text: 'x', mood: 'mal', emotions: [a.id] }, { text: 'y', mood: 'muy-bien' }] }, { base: null });
  const before = App.diary.dayMood(await repo.get('2026-10-12')).percent;
  assert.equal(before, 63);
  await emo.update(a.id, { name: 'Calma profunda', symbol: App.diary.EMOTION_SYMBOLS[2].id });
  const page = await repo.get('2026-10-12');
  await repo.save({ day: '2026-10-12', title: page.title, blocks: page.blocks.map((b) => ({ ...b, emotions: [] })) }, { base: page.updatedAt });
  assert.equal(App.diary.dayMood(await repo.get('2026-10-12')).percent, before);
});
