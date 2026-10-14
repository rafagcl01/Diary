// Pruebas de las pantallas de Personas y del selector de personas del editor, sin navegador.
// Ejecutar con: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const FILES = ['icons', 'prefs', 'ui', 'router', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection',
  'diary/entries', 'diary/repository', 'diary/drafts', 'diary/emotions', 'diary/people', 'diary/stats', 'views/diary/percent', 'views/diary/html', 'views/diary/list', 'views/diary/read',
  'views/people/html', 'views/diary/people-picker', 'views/diary/editor', 'views/diary', 'views/people/list', 'views/people/card', 'views/people/form', 'views/people', 'views/mood', 'views/home'];

function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, setTimeout, clearTimeout, ...extra });
  ctx.window = ctx;
  ctx.document = { documentElement: { dataset: {}, removeAttribute() {} } };
  ctx.location = { hash: '' };
  for (const f of FILES) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  return ctx.App;
}
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
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
const fire = (el, type, ev) => (el.handlers[type] || []).forEach((h) => h(ev));
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const target = (map) => ({ closest: (sel) => map[sel] ?? null });
async function connected(extra = {}) {
  const fake = createFakeGithub(); const App = load({ localStorage: memoryStorage(), fetch: fake.fetch, ...extra });
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  return { App, fake, repo: App.diary.repo(), ppl: App.diary.people() };
}
const render = (App, params) => { const root = fakeRoot(); App.views.people.render(root, { params }); return root; };

test('el enrutador de Personas reparte cada dirección y rechaza las raras', () => {
  const App = load({ localStorage: memoryStorage() });
  const calls = [];
  App.peopleViews.list = { render: () => calls.push(['lista']) };
  App.peopleViews.form = { render: (r, id) => calls.push(['form', id]) };
  App.peopleViews.card = { render: (r, id) => calls.push(['ficha', id]) };
  const go = (params) => { const root = fakeRoot(); App.views.people.render(root, { params }); return root; };
  go([]); go(['nueva']); go(['pe_0a1b2c3d']); go(['pe_0a1b2c3d', 'editar']);
  assert.deepEqual(plain(calls), [['lista'], ['form', null], ['ficha', 'pe_0a1b2c3d'], ['form', 'pe_0a1b2c3d']]);
  for (const bad of [['otra'], ['pe_zzzz'], ['pe_0a1b2c3d', 'borrar'], ['pe_0a1b2c3d', 'editar', 'x'], ['nueva', 'x'], ['__proto__']]) {
    assert.match(go(bad).innerHTML, /No encuentro esa página/, JSON.stringify(bad));
  }
  assert.equal(calls.length, 4);
});

test('lo que escribe el usuario se escapa en la lista, la ficha y los chips', () => {
  const App = load();
  const evil = App.diary.sanitizePerson({ name: '<img src=x onerror=alert(1)>', nicknames: ['<b>x</b>'], relation: '<i>rel</i>', notes: '<script>alert(2)</script>', tags: ['<u>t</u>'], met: '2019' });
  const H = App.peopleHtml;
  const html = H.item(evil, { count: 2, last: '2026-10-10' }) + H.personChips([evil.id], { [evil.id]: evil }) + H.avatar(evil) + H.meta(evil) + H.aliases(evil);
  assert.ok(!/<img src|<script>|<b>x<\/b>|<i>rel|<u>t/.test(html), 'no debe quedar HTML del usuario sin escapar');
  assert.ok(html.includes('&lt;img'));
  const frag = H.fragment({ day: '2026-10-10', pageTitle: '<s>título</s>', index: 0, total: 1, block: { id: 'b_00000001', text: '<script>alert(3)</script>\n\nOtro párrafo', people: [evil.id] } }, { [evil.id]: evil }, 'pe_11111111', false);
  assert.ok(!/<script>|<s>/.test(frag) && frag.includes('&lt;script&gt;'));
});

test('sin conexión, la lista y la ficha explican qué hacer y no fallan', () => {
  const App = load({ localStorage: memoryStorage() });
  assert.match(render(App, []).els['#p-list'].innerHTML, /Conecta tus datos para ver tus fichas/);
  assert.match(render(App, ['pe_0a1b2c3d']).innerHTML, /Conecta tus datos para ver esta ficha/);
  assert.match(render(App, ['nueva']).innerHTML, /Conecta tus datos para crear o editar fichas/);
});

test('la lista: estado vacío, orden por nombre, búsqueda por apodo y recuentos sin ranking', async () => {
  const { App, repo, ppl } = await connected();
  const empty = render(App, []); await tick();
  assert.match(empty.els['#p-list'].innerHTML, /Todavía no hay fichas/); assert.match(empty.els['#p-list'].innerHTML, /href="#\/personas\/nueva"/);
  const marcos = await ppl.create({ name: 'Marcos Pérez', nicknames: ['Marqui'], relation: 'amigo' });
  await ppl.create({ name: 'Ana' });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'a', people: [marcos.id] }, { text: 'b', people: [marcos.id] }] }, { base: null });
  const root = render(App, []); await tick();
  const html = root.els['#p-list'].innerHTML;
  assert.ok(html.indexOf('>Ana<') < html.indexOf('>Marcos Pérez<'), 'alfabético');
  assert.match(html, /people-grid/); assert.match(html, /2 recuerdos vinculados/); assert.match(html, /Sin recuerdos todavía/); assert.match(html, /“Marqui”/); assert.match(html, />amigo</);
  assert.match(root.els['#p-summary'].textContent, /2 personas/);
  root.els['#p-q'].value = 'MARQUI'; fire(root.els['#p-q'], 'input', {});
  assert.match(root.els['#p-list'].innerHTML, /Marcos Pérez/); assert.ok(!/>Ana</.test(root.els['#p-list'].innerHTML));
  root.els['#p-q'].value = 'zzz'; fire(root.els['#p-q'], 'input', {});
  assert.match(root.els['#p-list'].innerHTML, /Ninguna ficha coincide/);
  assert.ok(!/ranking|puntos|nivel/i.test(html));
});

test('la ficha: historial cronológico con la fecha, el texto completo y el enlace a la página original', async () => {
  const { App, repo, ppl } = await connected();
  const marcos = await ppl.create({ name: 'Marcos', nicknames: ['Marqui'], relation: 'amigo', met: '2019-05', notes: 'Nos conocimos en un concierto.', tags: ['música'], symbol: 'moon' });
  const lucia = await ppl.create({ name: 'Lucía' });
  await repo.save({ day: '2026-10-12', title: 'Lunes', blocks: [{ text: 'Cena con Marcos.\n\nQué risa.', people: [marcos.id] }] }, { base: null });
  await repo.save({ day: '2026-10-10', blocks: [
    { text: 'Quedé con Marcos para tomar algo.', people: [marcos.id] }, { text: 'Nos encontramos con Lucía y hablamos del viaje.', people: [marcos.id, lucia.id] }, { text: 'Película en casa.' }] }, { base: null });
  const root = render(App, [marcos.id]); await tick(80);
  const view = root.els['.people-view']; const html = view.innerHTML;
  assert.match(html, /<h1[^>]*>Marcos<\/h1>/); assert.match(html, /También: Marqui/); assert.match(html, /class="cap">amigo</); assert.match(html, /la conocí en mayo de 2019/);
  assert.match(html, /Nos conocimos en un concierto\./); assert.match(html, /#música/);
  assert.match(html, /3 fragmentos, en orden cronológico/);
  const order = [...html.matchAll(/class="frag-date" href="#\/diario\/(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['2026-10-10', '2026-10-10', '2026-10-12'], 'de más antiguo a más reciente, y por orden dentro del día');
  assert.match(html, /Nos encontramos con Lucía y hablamos del viaje\./, 'el texto completo, con su contexto');
  assert.match(html, /<p>Cena con Marcos\.<\/p><p>Qué risa\.<\/p>/);
  assert.match(html, /entrada 2 de 3/); assert.match(html, /Abrir la página original/);
  assert.match(html, /href="#\/personas\/pe_[0-9a-f]{8}"[^>]*>[^]*Lucía/, 'las otras personas de la entrada enlazan a su ficha');
  assert.ok(!/Película en casa/.test(html), 'una entrada sin vínculo no aparece');
  assert.ok(!/b_[0-9a-f]{8}"|createdAt|updatedAt/.test(html.replace(/data-(ref|star)="[^"]*"/g, '')), 'sin datos técnicos a la vista');
  assert.match(html, /Todavía no has destacado ninguno/);
  // invertir el orden
  fire(view, 'click', { target: target({ '#p-order': {} }) });
  const reversed = [...view.innerHTML.matchAll(/class="frag-date" href="#\/diario\/(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
  assert.deepEqual(reversed, ['2026-10-12', '2026-10-10', '2026-10-10']);
  assert.match(view.innerHTML, /del más reciente al más antiguo/);
  assert.match(render(App, ['pe_00000000']).innerHTML, /Cargando|skeleton/);
  await tick(); 
});

test('una ficha que no existe lo explica; una sin fragmentos explica cómo vincular', async () => {
  const { App, ppl } = await connected();
  const missing = render(App, ['pe_00000000']); await tick(60);
  assert.match(missing.innerHTML, /No encuentro esa ficha/);
  const ana = await ppl.create({ name: 'Ana' });
  const root = render(App, [ana.id]); await tick(60);
  assert.match(root.els['.people-view'].innerHTML, /Todavía no hay entradas vinculadas a esta persona/);
});

test('destacar un recuerdo lo guarda en la ficha y se puede quitar', async () => {
  const { App, repo, ppl } = await connected();
  const marcos = await ppl.create({ name: 'Marcos' });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'Un día bonito con Marcos.', people: [marcos.id] }] }, { base: null });
  const bid = (await repo.get('2026-10-10')).blocks[0].id;
  const root = render(App, [marcos.id]); await tick(80);
  const view = root.els['.people-view'];
  const star = { dataset: { star: `2026-10-10|${bid}` }, getAttribute: () => 'false', disabled: false };
  fire(view, 'click', { target: target({ '[data-star]': star }) }); await tick(80);
  assert.deepEqual(plain((await ppl.get(marcos.id)).highlights), [{ day: '2026-10-10', block: bid }]);
  assert.match(view.innerHTML, /Destacado/); assert.ok(!/Todavía no has destacado ninguno/.test(view.innerHTML));
  fire(view, 'click', { target: target({ '[data-star]': { ...star, getAttribute: () => 'true' } }) }); await tick(80);
  assert.equal((await ppl.get(marcos.id)).highlights.length, 0);
});

test('el formulario crea una ficha con solo el nombre, y avisa de un nombre repetido', async () => {
  const { App, fake } = await connected();
  const root = render(App, ['nueva']); await tick(60);
  assert.match(root.els['.people-view'].innerHTML, /id="p-name"/);
  assert.ok(!/required/.test(root.els['.people-view'].innerHTML), 'ningún campo es obligatorio a nivel de HTML');
  assert.equal((root.els['#p-symbols'].innerHTML.match(/type="radio"/g) || []).length, 1 + App.diary.EMOTION_SYMBOLS.length, 'la inicial + la galería');
  root.els['#p-save'].handlers.click[0](); await tick(60);
  assert.match(root.els['#p-msg'].textContent, /Ponle un nombre/);
  root.querySelector('#p-name').value = 'Marcos'; root.querySelector('#p-rel-new').value = 'amigo'; root.querySelector('#p-met').value = '2019-05';
  root.querySelector('#p-nick').value = 'Marqui, Marcus'; root.querySelector('#p-tag').value = 'música';
  root.els['#p-save'].handlers.click[0](); await tick(80);
  const saved = JSON.parse(fake.state.files.get('people.json')).people;
  assert.equal(saved.length, 1); assert.deepEqual(plain(saved[0].nicknames), ['Marqui', 'Marcus']); assert.deepEqual(plain(saved[0].tags), ['música']); assert.equal(saved[0].met, '2019-05');
  const dup = render(App, ['nueva']); await tick(60);
  dup.querySelector('#p-name').value = 'marcos';
  dup.els['#p-save'].handlers.click[0](); await tick(80);
  assert.match(dup.els['#p-msg'].textContent, /relación distinta/);
  assert.equal(JSON.parse(fake.state.files.get('people.json')).people.length, 1);
  const badDate = render(App, ['nueva']); await tick(60);
  badDate.querySelector('#p-name').value = 'Ana'; badDate.querySelector('#p-met').value = '2999';
  badDate.els['#p-save'].handlers.click[0](); await tick(80);
  assert.match(badDate.els['#p-msg'].textContent, /todavía no ha llegado/);
});

test('editar una ficha conserva sus vínculos; borrarla pide confirmación y no borra textos', async () => {
  const asked = [], answer = { v: false };
  const { App, repo, ppl, fake } = await connected({ confirm: (m) => { asked.push(m); return answer.v; } });
  const marcos = await ppl.create({ name: 'Marcos', relation: 'amigo' });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'Quedé con Marcos.', people: [marcos.id], mood: 'bien' }] }, { base: null });
  const root = render(App, [marcos.id, 'editar']); await tick(80);
  root.querySelector('#p-name').value = 'Marcos Ruiz';
  root.els['#p-save'].handlers.click[0](); await tick(80);
  assert.equal((await ppl.get(marcos.id)).name, 'Marcos Ruiz');
  assert.deepEqual(plain((await repo.get('2026-10-10')).blocks[0].people), [marcos.id], 'renombrar no toca el vínculo');
  // borrar: primero se cancela, luego se acepta
  const del = render(App, [marcos.id, 'editar']); await tick(80);
  answer.v = false;
  del.els['#p-delete'].handlers.click[0](); await tick(80);
  assert.equal(asked.length, 1); assert.match(asked[0], /Se quitará su vínculo de 1 entrada/); assert.match(asked[0], /Tus textos NO se borran/);
  assert.equal((await ppl.list()).length, 1, 'cancelar no borra nada');
  answer.v = true;
  del.els['#p-delete'].handlers.click[0](); await tick(120);
  assert.equal((await ppl.list(true)).length, 0);
  const page = await repo.get('2026-10-10');
  assert.equal(page.blocks[0].text, 'Quedé con Marcos.'); assert.equal(page.blocks[0].mood, 'bien'); assert.deepEqual(plain(page.blocks[0].people), []);
  assert.ok(fake.state.files.get('people.json'));
});

const editorOf = async (App, day = '2026-10-12', params = [day, 'editar']) => {
  const root = fakeRoot(); App.views.diary.render(root, { params }); await tick(100);
  const view = root.els['.editor-view'];
  const ids = [...root.els['#e-blocks'].innerHTML.matchAll(/data-block-id="(b_[0-9a-f]{8})"/g)].map((m) => m[1]);
  const click = (map) => fire(view, 'click', { target: target(map) });
  const type = (id, value) => fire(view, 'input', { target: { dataset: { text: id }, value } });
  return { root, view, ids, click, type, chips: (id) => root.els[`[data-pplist="${id}"]`].innerHTML, suggest: (id) => root.els[`[data-suggest="${id}"]`].innerHTML };
};

test('editor: crear una ficha sin salir, vincularla a la entrada y guardar; el texto no cambia', async () => {
  const { App, repo, ppl, fake } = await connected();
  const ed = await editorOf(App); const id = ed.ids[0];
  assert.match(ed.root.els['#e-blocks'].innerHTML, /data-ppl-open=/); assert.match(ed.root.els['#e-blocks'].innerHTML, /data-suggest=/);
  assert.match(ed.root.innerHTML, /id="ppl-dialog"/);
  ed.click({ '[data-ppl-open]': { dataset: { pplOpen: id } } });
  assert.equal(ed.root.els['#ppl-dialog'].open, true);
  assert.match(ed.root.els['#ppl-list'].innerHTML, /Todavía no tienes fichas/);
  ed.click({ '#ppl-new': {} });
  ed.root.els['#ppl-name'].value = 'Marcos'; ed.root.els['#ppl-rel'].value = 'amigo';
  ed.click({ '#ppl-save': {} }); await tick(120);
  assert.match(ed.root.els['#ppl-msg'].textContent, /Ficha creada y vinculada/);
  assert.match(ed.chips(id), /Marcos/); assert.match(ed.chips(id), /data-ppl-remove=/, 'cada persona se puede quitar');
  assert.deepEqual(plain((await ppl.list()).map((p) => p.name)), ['Marcos'], 'la ficha se guardó en people.json');
  ed.click({ '#ppl-done': {} }); assert.equal(ed.root.els['#ppl-dialog'].open, false);
  ed.type(id, 'Quedé con Marcos para tomar algo.');
  ed.root.els['#e-save'].handlers.click[0](); await tick(120);
  const saved = await repo.get('2026-10-12');
  const marcos = (await ppl.list())[0];
  assert.deepEqual(plain(saved.blocks[0].people), [marcos.id]); assert.equal(saved.blocks[0].text, 'Quedé con Marcos para tomar algo.');
  assert.ok(!/Marcos/.test(JSON.stringify(plain(saved.blocks[0].people))), 'el vínculo es un identificador, no el nombre');
  assert.ok(fake.state.files.has('people.json'));
});

test('editor: el nombre repetido avisa antes de crear, y la ficha duplicada se rechaza con un mensaje claro', async () => {
  const { App, ppl } = await connected();
  await ppl.create({ name: 'Marcos Pérez', nicknames: ['Marqui'], relation: 'amigo' });
  const ed = await editorOf(App); const id = ed.ids[0];
  ed.click({ '[data-ppl-open]': { dataset: { pplOpen: id } } });
  ed.click({ '#ppl-new': {} });
  ed.root.els['#ppl-name'].value = 'Marcos';
  fire(ed.view, 'input', { target: { id: 'ppl-name', value: 'Marcos' } });
  assert.match(ed.root.els['#ppl-hint'].textContent, /Ya tienes: Marcos Pérez \(amigo\)/); assert.match(ed.root.els['#ppl-hint'].textContent, /relación distinta/);
  ed.root.els['#ppl-name'].value = 'Marcos Pérez'; ed.root.els['#ppl-rel'].value = 'amigo';
  ed.click({ '#ppl-save': {} }); await tick(120);
  assert.match(ed.root.els['#ppl-msg'].textContent, /Ya tienes una ficha con ese nombre y una relación en común/);
  assert.equal(ed.chips(id), '', 'no se vinculó nada');
});

test('editor: buscar y elegir entre varias fichas; el apodo ayuda a distinguirlas', async () => {
  const { App, ppl } = await connected();
  const a = await ppl.create({ name: 'Lucía', relation: 'hermana', nicknames: ['Lulú'] }); const b = await ppl.create({ name: 'Lucía', relation: 'compañera de trabajo' });
  const ed = await editorOf(App); const id = ed.ids[0];
  ed.click({ '[data-ppl-open]': { dataset: { pplOpen: id } } });
  assert.equal((ed.root.els['#ppl-list'].innerHTML.match(/data-ppl-toggle=/g) || []).length, 2);
  assert.match(ed.root.els['#ppl-list'].innerHTML, /hermana/); assert.match(ed.root.els['#ppl-list'].innerHTML, /compañera de trabajo/, 'se distinguen por la relación');
  ed.root.els['#ppl-q'].value = 'lulu'; fire(ed.view, 'input', { target: { id: 'ppl-q', value: 'lulu' } });
  assert.match(ed.root.els['#ppl-list'].innerHTML, /apodo: Lulú/); assert.equal((ed.root.els['#ppl-list'].innerHTML.match(/data-ppl-toggle=/g) || []).length, 1);
  ed.root.els['#ppl-q'].value = ''; fire(ed.view, 'input', { target: { id: 'ppl-q', value: '' } });
  ed.click({ '[data-ppl-toggle]': { dataset: { pplToggle: b.id } } });
  assert.match(ed.chips(id), /Lucía/); assert.match(ed.root.els['#ppl-list'].innerHTML, /aria-pressed="true"/);
  ed.click({ '[data-ppl-toggle]': { dataset: { pplToggle: a.id } } });
  assert.equal((ed.chips(id).match(/data-ppl-remove=/g) || []).length, 2, 'varias personas en la misma entrada');
  ed.click({ '[data-ppl-toggle]': { dataset: { pplToggle: b.id } } });
  assert.equal((ed.chips(id).match(/data-ppl-remove=/g) || []).length, 1, 'volver a pulsar la quita');
});

test('editor: las sugerencias proponen pero no vinculan; si el nombre es ambiguo hay que elegir', async () => {
  const { App, repo, ppl } = await connected();
  const marcos = await ppl.create({ name: 'Marcos', relation: 'amigo' });
  await ppl.create({ name: 'Lucía', relation: 'hermana' }); await ppl.create({ name: 'Lucía', relation: 'compañera de trabajo' });
  const ed = await editorOf(App); const id = ed.ids[0];
  ed.type(id, 'El sábado quedé con Marcos y luego vimos a Lucía.'); await tick(450);
  const s = ed.suggest(id);
  assert.match(s, /No se vincula nada hasta que lo confirmes/);
  assert.match(s, /Vincular a Marcos \(amigo\)/);
  assert.match(s, /«<b>Lucía<\/b>» puede ser:/); assert.match(s, /Lucía \(hermana\)/); assert.match(s, /Lucía \(compañera de trabajo\)/); assert.match(s, /Ninguna/);
  assert.equal(ed.chips(id), '', 'nada vinculado por sí solo');
  ed.root.els['#e-save'].handlers.click[0](); await tick(120);
  assert.deepEqual(plain((await repo.get('2026-10-12')).blocks[0].people), [], 'guardar sin confirmar no vincula');
  // confirmar a Marcos y descartar a Lucía
  const ed2 = await editorOf(App); const id2 = ed2.ids[0];
  ed2.type(id2, 'El sábado quedé con Marcos y luego vimos a Lucía.'); await tick(450);
  ed2.click({ '[data-sg-link]': { dataset: { sgLink: marcos.id, block: id2 } } });
  assert.match(ed2.chips(id2), /Marcos/); assert.ok(!/Vincular a Marcos/.test(ed2.suggest(id2)), 'ya vinculado: no insiste');
  const key = /data-sg-dismiss="([^"]+)"/.exec(ed2.suggest(id2).replace(/&amp;/g, '&'))[1];
  ed2.click({ '[data-sg-dismiss]': { dataset: { sgDismiss: key, block: id2 } } });
  assert.equal(ed2.suggest(id2), '', 'descartada: no vuelve a aparecer');
  ed2.root.els['#e-save'].handlers.click[0](); await tick(120);
  assert.deepEqual(plain((await repo.get('2026-10-12')).blocks[0].people), [marcos.id]);
});

test('editor: quitar una persona de una entrada no toca el texto ni el resto; el borrador conserva los vínculos', async () => {
  const { App, repo, ppl } = await connected();
  const marcos = await ppl.create({ name: 'Marcos' }); const lucia = await ppl.create({ name: 'Lucía' });
  await repo.save({ day: '2026-10-12', blocks: [{ text: 'Con los dos.', mood: 'bien', tags: ['casa'], people: [marcos.id, lucia.id] }] }, { base: null });
  const ed = await editorOf(App); const id = ed.ids[0];
  assert.match(ed.chips(id), /Marcos/); assert.match(ed.chips(id), /Lucía/);
  ed.click({ '[data-ppl-remove]': { dataset: { pplRemove: marcos.id, block: id } } });
  assert.ok(!/Marcos/.test(ed.chips(id))); assert.match(ed.chips(id), /Lucía/);
  await tick(600);   // el borrador se guarda solo
  assert.deepEqual(plain(App.drafts.get('2026-10-12').blocks[0].people), [lucia.id]);
  ed.root.els['#e-save'].handlers.click[0](); await tick(120);
  const b = (await repo.get('2026-10-12')).blocks[0];
  assert.deepEqual(plain(b.people), [lucia.id]); assert.equal(b.text, 'Con los dos.'); assert.equal(b.mood, 'bien'); assert.deepEqual(plain(b.tags), ['casa']);
  assert.equal(App.drafts.get('2026-10-12'), null);
});

test('sin conexión, el editor explica que hacen falta datos para las fichas y funciona igual', async () => {
  const App = load({ localStorage: memoryStorage() });
  const ed = await editorOf(App);
  ed.click({ '[data-ppl-open]': { dataset: { pplOpen: ed.ids[0] } } });
  assert.match(ed.root.els['#ppl-list'].innerHTML, /Conecta tus datos para usar fichas de personas/);
  assert.equal(ed.root.els['#ppl-new'].disabled, true);
  ed.type(ed.ids[0], 'Quedé con Marcos'); await tick(450);
  assert.equal(ed.suggest(ed.ids[0]), '');
});

test('lectura: las personas son enlaces a su ficha, sin controles de vínculo; los identificadores huérfanos se ignoran', async () => {
  const { App, repo, ppl } = await connected();
  const marcos = await ppl.create({ name: 'Marcos <b>' });
  await repo.save({ day: '2026-10-12', blocks: [{ text: 'Con Marcos.', people: [marcos.id, 'pe_ffffffff'] }, { text: 'Sola.' }] }, { base: null });
  const root = fakeRoot(); App.views.diary.render(root, { params: ['2026-10-12'] }); await tick(100);
  assert.match(root.innerHTML, new RegExp(`href="#/personas/${marcos.id}"`)); assert.match(root.innerHTML, /Marcos &lt;b&gt;/);
  assert.ok(!/pe_ffffffff|data-ppl|data-sg|Personas<\/button>|ppl-dialog/.test(root.innerHTML), 'ni ids técnicos ni controles en la lectura');
  assert.equal((root.innerHTML.match(/class="chips entry-people"/g) || []).length, 1, 'la entrada sin personas no pinta nada');
});

test('diario: se puede filtrar las páginas por persona', async () => {
  const { App, repo, ppl } = await connected();
  const marcos = await ppl.create({ name: 'Marcos', relation: 'amigo' });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'con Marcos', people: [marcos.id] }] }, { base: null });
  await repo.save({ day: '2026-10-11', blocks: [{ text: 'sola' }] }, { base: null });
  const root = fakeRoot(); App.views.diary.render(root, { params: [] }); await tick(120);
  assert.match(root.els['#f-person'].innerHTML, /Marcos \(amigo\)/);
  assert.match(root.els['#summary'].textContent, /2 páginas/);
  root.els['#f-person'].handlers.change[0]({ target: { value: marcos.id } });
  assert.match(root.els['#summary'].textContent, /Mostrando 1 de 2 páginas/);
  assert.match(root.els['#list'].innerHTML, /2026-10-10/); assert.ok(!/2026-10-11/.test(root.els['#list'].innerHTML));
});

test('inicio: personas recientes por fecha del último recuerdo, no por cantidad', async () => {
  const { App, repo, ppl } = await connected();
  const marcos = await ppl.create({ name: 'Marcos' }); const lucia = await ppl.create({ name: 'Lucía' });
  await repo.save({ day: '2026-09-01', blocks: [{ text: 'a', people: [marcos.id] }, { text: 'b', people: [marcos.id] }, { text: 'c', people: [marcos.id] }] }, { base: null });
  await repo.save({ day: '2026-10-05', blocks: [{ text: 'd', people: [lucia.id] }] }, { base: null });
  const root = fakeRoot(); App.views.home.render(root); await tick(120);
  const html = root.els['#home-people-body'].innerHTML;
  assert.ok(html.indexOf('Lucía') < html.indexOf('Marcos'), 'la más reciente primero, aunque Marcos tenga más fragmentos');
  assert.match(html, /href="#\/personas\/pe_[0-9a-f]{8}"/); assert.ok(!/fragmento|veces|más/i.test(html), 'sin recuentos: no hay ranking');
});

test('inicio: el botón de la primera entrada lleva a una dirección que existe', async () => {
  const { App } = await connected();
  const root = fakeRoot(); App.views.home.render(root); await tick(100);
  assert.match(root.els['#home-recent-body'].innerHTML, /href="#\/diario\/hoy"/); assert.ok(!/diario\/nueva/.test(root.els['#home-recent-body'].innerHTML));
});

test('la ficha muestra sus relaciones, el cumpleaños y el reparto de emociones sin puntuar a nadie', async () => {
  const { App, repo, ppl } = await connected();
  const emo = App.diary.emotions();
  const calma = await emo.create({ name: 'Calma', symbol: App.diary.EMOTION_SYMBOLS[0].id }), risa = await emo.create({ name: 'Risa', symbol: App.diary.EMOTION_SYMBOLS[1].id });
  const marcos = await ppl.create({ name: 'Marcos', relations: ['amistad', 'trabajo'], birthday: '05-14', photo: 'data:image/jpeg;base64,/9j/4AAQ' });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'a', people: [marcos.id], emotions: [calma.id] }, { text: 'b', people: [marcos.id], emotions: [calma.id, risa.id] }] }, { base: null });
  const html = render(App, [marcos.id]); await tick(80);
  const h = html.els['.people-view'].innerHTML;
  assert.match(h, /class="cap">amistad</); assert.match(h, /class="cap">trabajo</); assert.match(h, /cumple el 14 de mayo/);
  assert.match(h, /<img class="av-photo"/); assert.match(h, /Calma<\/span>|Calma/); assert.match(h, /67 %/); assert.match(h, /33 %/);
  assert.match(h, /No es una nota para la persona/);
  const grid = render(App, []); await tick(80);
  assert.match(grid.els['#p-list'].innerHTML, /Cumple el 14 de mayo/); assert.match(grid.els['#p-list'].innerHTML, /<img class="av-photo"/);
});

test('el formulario: relaciones en cápsulas (varias, nuevas con Intro), cumpleaños y quitar la foto', async () => {
  const { App, fake, ppl } = await connected();
  await ppl.create({ name: 'Otra', relations: ['vecindad', 'prima'], photo: 'data:image/jpeg;base64,/9j/4AAQ' });
  const root = render(App, ['nueva']); await tick(60);
  const caps = root.els['.people-view'].innerHTML;
  assert.match(caps, /data-rel-toggle="prima"/); assert.match(caps, /data-rel-toggle="amistad"/);
  const view = root.els['.people-view'];
  const click = (map) => fire(view, 'click', { target: target(map) });
  click({ '[data-rel-toggle]': { dataset: { relToggle: 'amistad' }, getAttribute: () => 'false' } });
  click({ '[data-rel-toggle]': { dataset: { relToggle: 'trabajo' }, getAttribute: () => 'false' } });
  click({ '[data-rel-toggle]': { dataset: { relToggle: 'trabajo' }, getAttribute: () => 'true' } });   // otra pulsación la quita
  root.querySelector('#p-rel-new').value = 'Compañera de clase'; fire(view, 'keydown', { target: { id: 'p-rel-new', value: 'Compañera de clase' }, key: 'Enter', preventDefault() {} });
  assert.match(root.querySelector('#p-rels').innerHTML, /data-rel-toggle="Compañera de clase" aria-pressed="true"/);
  root.querySelector('#p-name').value = 'Lola'; root.querySelector('#p-bd-d').value = '14'; root.querySelector('#p-bd-m').value = '5'; root.querySelector('#p-bd-y').value = '';
  root.els['#p-save'].handlers.click[0](); await tick(80);
  const saved = JSON.parse(fake.state.files.get('people.json')).people.find((p) => p.name === 'Lola');
  assert.deepEqual(plain(saved.relations), ['amistad', 'Compañera de clase']); assert.equal(saved.birthday, '05-14');
  const bad = render(App, ['nueva']); await tick(60);
  bad.querySelector('#p-name').value = 'Pepe'; bad.querySelector('#p-bd-d').value = '14'; bad.querySelector('#p-bd-m').value = '';
  bad.els['#p-save'].handlers.click[0](); await tick(60);
  assert.match(bad.querySelector('#p-msg').textContent, /día y el mes/);
});
