// Pruebas de las pantallas del diario sin navegador: HTML generado, rutas, borradores e inicio.
// Ejecutar con: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FILES = ['icons', 'prefs', 'ui', 'router', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection',
  'diary/entries', 'diary/repository', 'diary/drafts', 'views/diary/html', 'views/diary/list', 'views/diary/read', 'views/diary/editor',
  'views/diary', 'views/home'];

function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, setTimeout, clearTimeout, ...extra });
  ctx.window = ctx;
  ctx.document = { documentElement: { dataset: {}, removeAttribute() {} } };
  ctx.location = { hash: '' };
  for (const f of FILES) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  return ctx.App;
}
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
// Un "documento" mínimo: cada selector devuelve su propio elemento y recuerda lo que se le escribe.
const fakeRoot = () => {
  const els = {};
  const make = () => ({ innerHTML: '', textContent: '', value: '', checked: false, disabled: false, hidden: false, addEventListener() {}, setAttribute() {}, focus() {} });
  return { innerHTML: '', els, querySelector(sel) { return (els[sel] ??= make()); } };
};
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const entry = (App, over = {}) => App.diary.sanitizeEntry({ date: '2026-10-13T21:30', title: 'Un día', blocks: [{ text: 'Texto del día.' }], ...over });

test('todo lo que escribe el usuario se escapa en la cronología, la lectura y los borradores', () => {
  const App = load({ localStorage: memoryStorage() });
  const evil = entry(App, { title: '<img src=x onerror=alert(1)>', blocks: [{ text: '<script>alert(2)</script>\nsegunda línea & más' }], tags: ['<b>x</b>'] });
  const html = App.diaryHtml.item(evil) + App.diaryHtml.sheet(evil) + App.diaryHtml.list([evil], 10);
  assert.ok(!/<img src|<script>alert|<b>x<\/b>/.test(html), 'no debe quedar HTML del usuario sin escapar');
  assert.ok(html.includes('&lt;img') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('segunda línea &amp; más'));
  assert.ok(App.diaryHtml.sheet(evil).includes('<br>'), 'los saltos de línea dentro de un párrafo se conservan');

  const drafts = App.diaryHtml.drafts([{ key: 'new', entryId: null, title: '<u>borrador</u>', text: '', tags: [] }]);
  assert.ok(!drafts.includes('<u>') && drafts.includes('&lt;u&gt;'));
});

test('la vista de lectura no muestra identificadores ni datos técnicos', () => {
  const App = load();
  const html = App.diaryHtml.sheet(entry(App, { tags: ['viaje'], moodId: 'm_1' }));
  assert.ok(!/e_[0-9a-f]{12}|b_[0-9a-f]{8}|blocks|moodId|createdAt|updatedAt/.test(html));
  assert.match(html, /Texto del día\./); assert.match(html, /#viaje/);
});

test('cronología: agrupa por mes, marca favoritas y ofrece "mostrar más"', () => {
  const App = load();
  const list = [entry(App, { date: '2026-10-13T10:00', favorite: true }), entry(App, { date: '2026-09-02T10:00' })];
  const html = App.diaryHtml.list(list, 1);
  assert.match(html, /octubre de 2026/); assert.ok(!/septiembre/.test(html));
  assert.match(html, /Favorita/); assert.match(html, /Mostrar más \(1\)/);
  assert.match(App.diaryHtml.list(list, 10), /septiembre de 2026/);
});

test('calendario: solo se pueden pulsar los días con entradas y el día elegido se marca', () => {
  const App = load();
  const entries = [entry(App, { date: '2026-10-13T10:00' }), entry(App, { date: '2026-10-13T20:00' }), entry(App, { date: '2026-10-02T09:00' })];
  const html = App.diaryHtml.calendar(App.diary.monthGrid(2026, 9, entries), '2026-10-13', '2026-10-13');
  assert.equal((html.match(/data-day="/g) || []).length, 31);
  assert.equal((html.match(/ disabled>/g) || []).length, 29);
  assert.match(html, /aria-label="13 de octubre, 2 entradas"[^>]*>|aria-pressed="true" aria-label="13 de octubre, 2 entradas"/);
  assert.match(html, /aria-label="Mes anterior"/); assert.match(html, /aria-label="Mes siguiente"/);
  assert.match(html, /day has today sel/);
});

test('router: las direcciones del diario se separan en sección y parámetros', () => {
  const App = load();
  assert.deepEqual(JSON.parse(JSON.stringify(App.parseHash('#/diario/e_0123456789ab/editar'))), { section: 'diario', params: ['e_0123456789ab', 'editar'] });
  assert.deepEqual(JSON.parse(JSON.stringify(App.parseHash('#/diario'))), { section: 'diario', params: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(App.parseHash(''))), { section: '', params: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(App.parseHash('#/diario//nueva/'))), { section: 'diario', params: ['nueva'] });
  assert.deepEqual(JSON.parse(JSON.stringify(App.parseHash('#/diario/%E2%9C%93'))).params, ['✓']);
  assert.deepEqual(JSON.parse(JSON.stringify(App.parseHash('#/diario/%E0%A4%A'))).params, ['%E0%A4%A'], 'una codificación rota no rompe nada');
});

test('el diario reparte cada dirección a su pantalla', () => {
  const App = load({ localStorage: memoryStorage() });
  const calls = [];
  for (const k of ['list', 'read', 'editor']) App.diaryViews[k] = { render: (root, arg) => calls.push([k, arg ?? null]) };
  const id = 'e_0123456789ab', go = (params) => App.views.diary.render(fakeRoot(), { params });
  go([]); go(['nueva']); go([id]); go([id, 'editar']);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['list', null], ['editor', null], ['read', id], ['editor', id]]);
  for (const bad of [['otra'], [id, 'borrar'], ['nueva', 'x'], [id, 'editar', 'más'], ['__proto__']]) {
    const root = fakeRoot(); App.views.diary.render(root, { params: bad });
    assert.match(root.innerHTML, /No encuentro esa página/, JSON.stringify(bad));
  }
  assert.equal(calls.length, 4, 'las direcciones raras no llegan a ninguna pantalla');
});

test('sin conexión, la lista y la lectura explican qué hacer y no fallan', () => {
  const App = load({ localStorage: memoryStorage() });
  const list = fakeRoot(); App.views.diary.render(list, { params: [] });
  assert.match(list.els['#list'].innerHTML, /Conecta tus datos para ver tus entradas/);
  const read = fakeRoot(); App.views.diary.render(read, { params: ['e_0123456789ab'] });
  assert.match(read.innerHTML, /Conecta tus datos para leer esta entrada/);
  const edit = fakeRoot(); App.views.diary.render(edit, { params: ['e_0123456789ab', 'editar'] });
  assert.match(edit.innerHTML, /Conecta tus datos para editar/);
});

test('el editor de una entrada nueva funciona sin conexión y avisa de que será un borrador', () => {
  const App = load({ localStorage: memoryStorage() });
  const root = fakeRoot(); App.views.diary.render(root, { params: ['nueva'] });
  for (const id of ['e-date', 'e-title', 'e-text', 'e-tag-input', 'e-fav', 'e-save']) assert.ok(root.innerHTML.includes(`id="${id}"`), id);
  assert.match(root.innerHTML, /type="datetime-local" value="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"/);
  assert.match(root.innerHTML, /Todavía no hay datos conectados/);
  assert.ok(!/required/.test(root.innerHTML), 'ningún campo es obligatorio');
});

test('el editor recupera un borrador pendiente (y lo escapa)', () => {
  const ls = memoryStorage(); const App = load({ localStorage: ls });
  App.drafts.save('new', { title: 'A medias', text: 'Escribía <i>esto</i> cuando cerré', tags: ['viaje'], date: '2026-10-13T09:15' });
  const root = fakeRoot(); App.views.diary.render(root, { params: ['nueva'] });
  assert.match(root.innerHTML, /Has recuperado un borrador/);
  assert.match(root.innerHTML, /value="A medias"/); assert.match(root.innerHTML, /value="2026-10-13T09:15"/);
  assert.ok(root.innerHTML.includes('Escribía &lt;i&gt;esto&lt;/i&gt; cuando cerré') && !root.innerHTML.includes('<i>esto</i>'));
  assert.match(root.innerHTML, /id="e-discard"/);
});

test('el aviso de trabajo pendiente lista los borradores con "Continuar" y "Descartar"', () => {
  const ls = memoryStorage(); const App = load({ localStorage: ls });
  App.drafts.save('new', { title: '', text: 'Una idea para mañana' });
  App.drafts.save('e_0123456789ab', { title: 'Editando', text: 'x' });
  const html = App.diaryHtml.drafts(App.drafts.list());
  assert.match(html, /href="#\/diario\/nueva"/); assert.match(html, /href="#\/diario\/e_0123456789ab\/editar"/);
  assert.equal((html.match(/data-draft-discard=/g) || []).length, 2);
  assert.equal(App.diaryHtml.drafts([]), '');
});

test('el inicio muestra entradas recientes y "hace un año" cuando hay datos conectados', async () => {
  const fake = createFakeGithub(); const ls = memoryStorage(); const App = load({ localStorage: ls, fetch: fake.fetch });
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const repo = App.diary.repo();
  const now = App.diary.nowLocal(), lastYear = String(Number(now.slice(0, 4)) - 1);
  await repo.save({ date: lastYear + now.slice(4, 10) + 'T09:00', title: 'Hace un año <b>', blocks: [{ text: 'Recuerdo de entonces.' }] });
  await repo.save({ date: now, title: 'Hoy', blocks: [{ text: 'Algo de hoy.' }] });

  const root = fakeRoot(); App.views.home.render(root);
  await tick();
  assert.match(root.els['#home-recent-body'].innerHTML, /Hoy/);
  assert.match(root.els['#home-recent-body'].innerHTML, /Hace un año &lt;b&gt;/);
  assert.match(root.els['#home-memories-body'].innerHTML, /Recuerdo de entonces/);
  assert.ok(!root.els['#home-memories-body'].innerHTML.includes('Algo de hoy'), 'las de este año no son recuerdos de otros años');
});

test('el inicio sin entradas invita a escribir la primera', async () => {
  const fake = createFakeGithub(); const App = load({ localStorage: memoryStorage(), fetch: fake.fetch });
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const root = fakeRoot(); App.views.home.render(root); await tick();
  assert.match(root.els['#home-recent-body'].innerHTML, /Escribir la primera/);
  assert.match(root.innerHTML, /href="#\/diario\/nueva"/, 'el acceso principal lleva a escribir');
});
