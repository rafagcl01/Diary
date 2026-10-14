// Pruebas de la lógica de personas: fichas (people.json), vínculos por identificador, sugerencias, ambigüedad,
// desvincular al borrar una ficha y exportación. Ejecutar con: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const FILES = ['icons', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'diary/entries', 'diary/repository', 'diary/drafts', 'diary/emotions', 'diary/people', 'diary/stats'];

function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, ...extra });
  ctx.window = ctx;
  for (const f of FILES) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  return ctx.App;
}
function makeAll(fake, App = load({ fetch: fake.fetch })) {
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  const store = App.createStore(adapter);
  return { App, store, repo: App.createDiaryRepo(store), ppl: App.createPeopleRepo(store), emo: App.createEmotionRepo(store) };
}
const rejectsWith = (p, code) => assert.rejects(p, (e) => { assert.equal(e.code, code, e.message); return true; });
const monthDoc = (fake, key) => JSON.parse(fake.state.files.get(`entries/${key}.json`));

test('crear, listar y editar fichas: se guardan en people.json y sobreviven a reabrir', async () => {
  const fake = createFakeGithub(); const { ppl } = makeAll(fake);
  assert.deepEqual(plain(await ppl.list()), []);
  const marcos = await ppl.create({ name: '  Marcos   Pérez ', nicknames: ['Marqui', 'marqui', ' '], relation: 'amigo', met: '2019-05', notes: 'Nos conocimos en un concierto.', tags: ['música'], symbol: 'moon' });
  assert.match(marcos.id, /^pe_[0-9a-f]{8}$/); assert.equal(marcos.name, 'Marcos Pérez');
  assert.deepEqual(plain(marcos.nicknames), ['Marqui'], 'sin vacíos ni repetidos');
  await ppl.create({ name: 'Lucía' });
  const doc = JSON.parse(fake.state.files.get('people.json'));
  assert.equal(doc.version, 1); assert.equal(doc.people.length, 2);
  const reopened = makeAll(fake).ppl;
  assert.deepEqual(plain((await reopened.list()).map((p) => p.name)), ['Lucía', 'Marcos Pérez'], 'ordenadas por nombre');
  const renamed = await reopened.update(marcos.id, { name: 'Marcos P.', notes: '' });
  assert.equal(renamed.id, marcos.id); assert.equal(renamed.createdAt, marcos.createdAt); assert.equal(renamed.met, '2019-05');
  assert.equal((await reopened.list()).length, 2, 'editar no duplica');
});

test('todos los campos personales son opcionales; solo el nombre es obligatorio', async () => {
  const fake = createFakeGithub(); const { ppl } = makeAll(fake);
  const p = await ppl.create({ name: 'Ana' });
  assert.deepEqual(plain({ n: p.nicknames, s: p.symbol, m: p.met, r: p.relation, no: p.notes, t: p.tags, h: p.highlights }), { n: [], s: null, m: '', r: '', no: '', t: [], h: [] });
  await rejectsWith(ppl.create({ name: '   ' }), 'invalid');
  await rejectsWith(ppl.create({}), 'invalid');
  await rejectsWith(ppl.create(null), 'invalid');
});

test('la fecha aproximada admite año, mes o día, y rechaza lo imposible o futuro', async () => {
  const fake = createFakeGithub(); const { ppl, App } = makeAll(fake);
  for (const met of ['2019', '2019-05', '2019-05-14', '']) await ppl.create({ name: 'P' + met, met });
  for (const met of ['2019-13', '2019-02-30', 'ayer', '19', '2999', '1800']) await rejectsWith(ppl.create({ name: 'X' + met, met }), 'invalid');
  assert.equal(App.diary.formatMet('2019'), '2019'); assert.match(App.diary.formatMet('2019-05'), /mayo de 2019/); assert.match(App.diary.formatMet('2019-05-14'), /14 de mayo de 2019/);
});

test('dos fichas con el mismo nombre solo se admiten si la relación las distingue', async () => {
  const fake = createFakeGithub(); const { ppl } = makeAll(fake);
  const a = await ppl.create({ name: 'Marcos', relation: 'amigo' });
  await assert.rejects(ppl.create({ name: 'MARCOS', relation: 'Amigo' }), (e) => /mismo nombre y esa relación/.test(e.message) || /con ese nombre y esa relación/.test(e.message));
  await assert.rejects(ppl.create({ name: 'marcos' }), (e) => /relación distinta/.test(e.message), 'sin relación, ambigua');
  const b = await ppl.create({ name: 'Marcos', relation: 'compañero de trabajo' });
  assert.notEqual(a.id, b.id);
  await rejectsWith(ppl.update(b.id, { relation: 'amigo' }), 'invalid');
  await rejectsWith(ppl.update('pe_00000000', { name: 'Nadie' }), 'invalid');
});

test('un vínculo es un identificador: renombrar a la persona no rompe nada y el texto no cambia', async () => {
  const fake = createFakeGithub(); const { ppl, repo } = makeAll(fake);
  const marcos = await ppl.create({ name: 'Marcos' }); const lucia = await ppl.create({ name: 'Lucía' });
  await repo.save({ day: '2026-10-10', blocks: [
    { text: 'Quedé con Marcos para tomar algo.', people: [marcos.id] },
    { text: 'Nos encontramos con Lucía.', people: [marcos.id, lucia.id, marcos.id] },
    { text: 'Por la noche, película en casa.' }] }, { base: null });
  const saved = await repo.get('2026-10-10');
  assert.deepEqual(plain(saved.blocks.map((b) => b.people)), [[marcos.id], [marcos.id, lucia.id], []], 'sin repetidos; el tercero, sin vínculo');
  const before = JSON.stringify(monthDoc(fake, '2026-10'));
  await ppl.update(marcos.id, { name: 'Marcos Ruiz', nicknames: ['Marqui'] });
  assert.equal(JSON.stringify(monthDoc(fake, '2026-10')), before, 'renombrar no toca ni un byte de las entradas');
  const frags = makeAll(fake).App.diary.fragmentsOf(await makeAll(fake).repo.list(), marcos.id);
  assert.equal(frags.length, 2); assert.equal(frags[0].block.text, 'Quedé con Marcos para tomar algo.', 'el texto original, completo');
  assert.deepEqual(plain(frags.map((f) => [f.day, f.index])), [['2026-10-10', 0], ['2026-10-10', 1]]);
});

test('los identificadores de persona mal formados se descartan; los campos desconocidos se conservan', async () => {
  const fake = createFakeGithub(); const { repo, App } = makeAll(fake);
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'x', people: ['pe_zzzzzzzz', 'Marcos', 3, null, 'pe_0a1b2c3d'], futuro: { a: 1 } }] }, { base: null });
  const b = (await repo.get('2026-10-10')).blocks[0];
  assert.deepEqual(plain(b.people), ['pe_0a1b2c3d']); assert.deepEqual(plain(b.futuro), { a: 1 });
  assert.equal(App.diary.sanitizeBlock({ text: '', people: ['pe_0a1b2c3d'] }).people.length, 1);
  assert.equal(App.diary.blockHasContent({ text: '', tags: [], mood: null, emotions: [], people: ['pe_0a1b2c3d'] }), true, 'una entrada solo con una persona cuenta como contenido');
  const many = Array.from({ length: 30 }, (_, i) => 'pe_' + i.toString(16).padStart(8, '0'));
  assert.equal(App.diary.uniquePersonIds(many).length, App.diary.LIMITS.people);
});

test('borrar una ficha quita su vínculo de las entradas sin tocar el texto, el ánimo ni las demás personas', async () => {
  const fake = createFakeGithub(); const { ppl, repo, emo } = makeAll(fake);
  const marcos = await ppl.create({ name: 'Marcos' }); const lucia = await ppl.create({ name: 'Lucía' });
  const nostalgia = await emo.create({ name: 'Nostalgia', symbol: 'moon' });
  await repo.save({ day: '2026-09-02', blocks: [{ text: 'Septiembre con Marcos.', people: [marcos.id], mood: 'bien', tags: ['amigos'], emotions: [nostalgia.id] }] }, { base: null });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'Con los dos.', people: [marcos.id, lucia.id], mood: 'mal' }, { text: 'Sin nadie.' }] }, { base: null });
  const before = { sep: monthDoc(fake, '2026-09').entries[0], oct: monthDoc(fake, '2026-10').entries[0] };
  const res = await ppl.remove(marcos.id, repo);
  assert.equal(res.unlinked, 2);
  assert.deepEqual(plain((await makeAll(fake).ppl.list()).map((p) => p.name)), ['Lucía']);
  const after = { sep: monthDoc(fake, '2026-09').entries[0], oct: monthDoc(fake, '2026-10').entries[0] };
  assert.deepEqual(plain(after.sep.blocks[0].people), []); assert.deepEqual(plain(after.oct.blocks[0].people), [lucia.id]);
  for (const k of ['sep', 'oct']) after[k].blocks.forEach((b, i) => {
    for (const f of ['text', 'mood', 'tags', 'emotions', 'id']) assert.deepEqual(plain(b[f]), plain(before[k].blocks[i][f]), `${k} bloque ${i}: ${f} intacto`);
  });
  assert.notEqual(after.sep.updatedAt, before.sep.updatedAt, 'la página cambió: otro dispositivo recibirá el aviso en vez de pisarla');
  await assert.rejects(ppl.remove(marcos.id, null));
});

test('desvincular no toca los meses donde la persona no aparece', async () => {
  const fake = createFakeGithub(); const { ppl, repo } = makeAll(fake);
  const marcos = await ppl.create({ name: 'Marcos' });
  await repo.save({ day: '2026-08-01', blocks: [{ text: 'Agosto, sin nadie.' }] }, { base: null });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'Con Marcos.', people: [marcos.id] }] }, { base: null });
  const august = fake.state.files.get('entries/2026-08.json');
  await ppl.remove(marcos.id, repo);
  assert.equal(fake.state.files.get('entries/2026-08.json'), august);
});

test('la búsqueda por persona filtra páginas; la búsqueda de fichas ignora tildes, mayúsculas y encuentra apodos', async () => {
  const fake = createFakeGithub(); const { ppl, repo, App } = makeAll(fake); const D = App.diary;
  const marcos = await ppl.create({ name: 'Marcos Pérez', nicknames: ['Marqui'], relation: 'amigo', tags: ['música'] });
  const lucia = await ppl.create({ name: 'Lucía' });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'a', people: [marcos.id] }] }, { base: null });
  await repo.save({ day: '2026-10-11', blocks: [{ text: 'b', people: [lucia.id] }] }, { base: null });
  assert.deepEqual(plain(D.search(await repo.list(), { person: marcos.id }).map((e) => e.day)), ['2026-10-10']);
  const people = await ppl.list();
  assert.deepEqual(plain(D.searchPeople(people, 'PEREZ').map((p) => p.name)), ['Marcos Pérez']);
  assert.deepEqual(plain(D.searchPeople(people, 'marqui').map((p) => p.name)), ['Marcos Pérez']);
  assert.deepEqual(plain(D.searchPeople(people, 'musica').map((p) => p.name)), ['Marcos Pérez']);
  assert.deepEqual(plain(D.searchPeople(people, 'amigo').map((p) => p.name)), ['Marcos Pérez']);
  assert.equal(D.searchPeople(people, '').length, 2); assert.equal(D.searchPeople(people, 'zzz').length, 0);
  assert.equal(D.matchedNickname(people.find((p) => p.name === 'Marcos Pérez'), 'marqui'), 'Marqui');
  assert.equal(D.matchedNickname(people.find((p) => p.name === 'Marcos Pérez'), 'marcos'), '');
});

test('las sugerencias detectan nombres y apodos, nunca vinculan, y piden elegir si hay ambigüedad', async () => {
  const fake = createFakeGithub(); const { ppl, App } = makeAll(fake); const D = App.diary;
  const marcos = await ppl.create({ name: 'Marcos Pérez', nicknames: ['Marqui'] });
  const lucia = await ppl.create({ name: 'Lucía', relation: 'hermana' });
  const lucia2 = await ppl.create({ name: 'Lucía', relation: 'compañera de trabajo' });
  const people = await ppl.list();
  const names = (s) => plain(s.map((x) => [x.term, x.people.map((p) => p.relation || p.name)]));
  // un nombre que es de dos personas devuelve las dos: hay que elegir
  const s1 = D.suggestPeople('El sábado quedé con MARQUI y con lucía.', people);
  assert.deepEqual(names(s1).map((n) => n[0]).sort(), ['Lucía', 'Marqui']);
  assert.deepEqual(names(s1).find((n) => n[0] === 'Marqui')[1], ['Marcos Pérez']);
  assert.equal(s1.find((x) => x.term === 'Lucía').people.length, 2, 'ambigua: se ofrecen ambas');
  // el nombre de pila basta, sin duplicar con el nombre completo
  assert.equal(D.suggestPeople('Hablé con Marcos Pérez y luego con Marcos.', people).length, 1);
  // palabras enteras: "Marcosa" o "Lucíano" no coinciden
  assert.deepEqual(plain(D.suggestPeople('Hablé con Marcosa y Lucíano.', people)), []);
  // ya vinculada: no insiste (aunque el nombre sea ambiguo entre dos personas, si una ya está, se considera resuelto)
  assert.deepEqual(plain(D.suggestPeople('Quedé con Marqui', people, { linked: [marcos.id] })), []);
  assert.deepEqual(plain(D.suggestPeople('Vi a Lucía', people, { linked: [lucia.id] })), []);
  // descartada: no vuelve
  const dismissed = { [s1[0].key]: true };
  assert.ok(!D.suggestPeople('El sábado quedé con MARQUI', people, { dismissed }).length);
  // sin texto o sin fichas
  assert.deepEqual(plain(D.suggestPeople('', people)), []); assert.deepEqual(plain(D.suggestPeople('Marcos', [])), []);
  assert.ok(lucia2.id !== lucia.id);
});

test('las sugerencias no vinculan nada por sí solas: guardar solo guarda lo confirmado', async () => {
  const fake = createFakeGithub(); const { ppl, repo, App } = makeAll(fake);
  await ppl.create({ name: 'Marcos' });
  const people = await ppl.list();
  assert.equal(App.diary.suggestPeople('Quedé con Marcos', people).length, 1);
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'Quedé con Marcos' }] }, { base: null });
  assert.deepEqual(plain((await repo.get('2026-10-10')).blocks[0].people), []);
});

test('recuerdos destacados: se destacan y se quitan, con un máximo, sin tocar las entradas', async () => {
  const fake = createFakeGithub(); const { ppl, repo } = makeAll(fake);
  const marcos = await ppl.create({ name: 'Marcos' });
  await repo.save({ day: '2026-10-10', blocks: [{ text: 'a', people: [marcos.id] }] }, { base: null });
  const entries = fake.state.files.get('entries/2026-10.json');
  const bid = (await repo.get('2026-10-10')).blocks[0].id;
  const on = await ppl.setHighlight(marcos.id, { day: '2026-10-10', block: bid }, true);
  assert.deepEqual(plain(on.highlights), [{ day: '2026-10-10', block: bid }]);
  await ppl.setHighlight(marcos.id, { day: '2026-10-10', block: bid }, true);
  assert.equal((await ppl.get(marcos.id)).highlights.length, 1, 'no se duplica');
  assert.equal(fake.state.files.get('entries/2026-10.json'), entries);
  assert.equal((await ppl.setHighlight(marcos.id, { day: '2026-10-10', block: bid }, false)).highlights.length, 0);
});

test('un people.json dañado se avisa y no se toca; las fichas raras se conservan', async () => {
  const broken = createFakeGithub({ files: { 'people.json': '{"people":"mal"}' } });
  await rejectsWith(makeAll(broken).ppl.list(), 'invalid');
  await rejectsWith(makeAll(broken).ppl.create({ name: 'Ana' }), 'invalid');
  assert.equal(broken.state.files.get('people.json'), '{"people":"mal"}');
  const weird = { id: 'pe_0a1b2c3d', name: 'Ana', futuro: { x: 1 }, createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z' };
  const fake = createFakeGithub({ files: { 'people.json': JSON.stringify({ version: 1, people: [weird] }) } });
  const { ppl } = makeAll(fake);
  assert.equal((await ppl.list()).length, 1);
  await ppl.update('pe_0a1b2c3d', { notes: 'hola' });
  assert.deepEqual(plain(JSON.parse(fake.state.files.get('people.json')).people[0].futuro), { x: 1 });
});

test('la copia de seguridad incluye las fichas', async () => {
  const fake = createFakeGithub(); const { ppl, store } = makeAll(fake);
  await ppl.create({ name: 'Ana', notes: 'nota privada' });
  const bundle = await store.exportBundle();
  assert.equal(bundle.files['people.json'].people[0].name, 'Ana');
});

test('los borradores conservan las personas vinculadas', () => {
  const App = load({ localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  const mem = new Map();
  const App2 = load({ localStorage: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } });
  App2.drafts.save('2026-10-12', { title: '', blocks: [{ text: 'x', people: ['pe_0a1b2c3d', 'basura'] }] });
  assert.deepEqual(plain(App2.drafts.get('2026-10-12').blocks[0].people), ['pe_0a1b2c3d']);
  assert.ok(App);
});
