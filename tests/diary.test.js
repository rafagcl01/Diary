// Pruebas de la lógica del diario: entradas, párrafos, búsqueda, calendario, repositorio y borradores.
// Ejecutar con: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));

function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, ...extra });
  ctx.window = ctx;
  for (const f of ['storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'diary/entries', 'diary/repository', 'diary/drafts']) {
    vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  }
  return ctx.App;
}
function makeRepo(fake, App = load({ fetch: fake.fetch })) {
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  return { App, store: App.createStore(adapter), repo: App.createDiaryRepo(App.createStore(adapter)) };
}
const rejectsWith = (p, code) => assert.rejects(p, (e) => { assert.equal(e.code, code, e.message); return true; });
const entry = (over = {}) => ({ date: '2026-10-13T21:30', title: 'Un día', blocks: [{ text: 'Primer párrafo del día.' }], ...over });
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

// ---------- Identificadores y fechas ----------
test('los identificadores tienen formato fijo y no se repiten', () => {
  const D = load().diary; const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const e = D.newId('e_'), b = D.newId('b_');
    assert.match(e, /^e_[0-9a-f]{12}$/); assert.match(b, /^b_[0-9a-f]{8}$/);
    seen.add(e);
  }
  assert.equal(seen.size, 1000);
});

test('fechas: se aceptan solo fechas reales y se formatean en español', () => {
  const D = load().diary;
  assert.ok(D.parseLocal('2026-10-13T21:30'));
  for (const bad of ['2026-02-30T10:00', '2026-13-01T10:00', '2026-10-13', '2026-10-13T25:00', '13/10/2026', '', null, undefined]) {
    assert.equal(D.parseLocal(bad), null, String(bad));
  }
  assert.equal(D.toLocalString(D.parseLocal('2026-10-13T09:05')), '2026-10-13T09:05');
  assert.equal(D.monthKey('2026-10-13T21:30'), '2026-10');
  assert.equal(D.dayKey('2026-10-13T21:30'), '2026-10-13');
  assert.equal(D.formatTime('2026-10-13T21:30'), '21:30');
  assert.match(D.formatLong('2026-10-13T21:30'), /martes.*13.*octubre.*2026/);
  assert.match(D.formatMonth('2026-10'), /octubre.*2026/);
  assert.match(D.nowLocal(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

// ---------- Párrafos ----------
test('splitParagraphs separa por líneas en blanco y respeta los saltos simples', () => {
  const D = load().diary;
  assert.deepEqual(plain(D.splitParagraphs('Uno\r\n\r\nDos\nsigue dos\n  \n\n\nTres  ')), ['Uno', 'Dos\nsigue dos', 'Tres']);
  assert.deepEqual(plain(D.splitParagraphs('   \n\n  ')), []);
  assert.deepEqual(plain(D.splitParagraphs(null)), []);
});

test('reconcileBlocks conserva los identificadores de los párrafos que siguen siendo los mismos', () => {
  const D = load().diary;
  const A = { id: 'b_aaaaaaaa', text: 'El sábado quedé con Marcos para tomar algo.' };
  const B = { id: 'b_bbbbbbbb', text: 'Después nos encontramos con Lucía y hablamos del viaje.' };
  const C = { id: 'b_cccccccc', text: 'Por la noche me quedé en casa viendo una película.' };
  const old = [A, B, C];
  const ids = (blocks) => blocks.map((b) => b.id);

  // sin cambios
  assert.deepEqual(plain(ids(D.reconcileBlocks(old, D.blocksToText(old)))), ['b_aaaaaaaa', 'b_bbbbbbbb', 'b_cccccccc']);
  // corregir una errata en el segundo párrafo
  let out = D.reconcileBlocks(old, [A.text, 'Después nos encontramos con Lucía y hablamos del viaje!!', C.text].join('\n\n'));
  assert.deepEqual(plain(ids(out)), ['b_aaaaaaaa', 'b_bbbbbbbb', 'b_cccccccc']);
  // insertar un párrafo al principio: los demás no cambian de identificador
  out = D.reconcileBlocks(old, ['Un párrafo nuevo al principio.', A.text, B.text, C.text].join('\n\n'));
  assert.deepEqual(plain(ids(out)).slice(1), ['b_aaaaaaaa', 'b_bbbbbbbb', 'b_cccccccc']);
  assert.match(out[0].id, /^b_[0-9a-f]{8}$/); assert.ok(!['b_aaaaaaaa', 'b_bbbbbbbb', 'b_cccccccc'].includes(out[0].id));
  // borrar el del medio
  out = D.reconcileBlocks(old, [A.text, C.text].join('\n\n'));
  assert.deepEqual(plain(ids(out)), ['b_aaaaaaaa', 'b_cccccccc']);
  // reordenar
  out = D.reconcileBlocks(old, [C.text, A.text, B.text].join('\n\n'));
  assert.deepEqual(plain(ids(out)), ['b_cccccccc', 'b_aaaaaaaa', 'b_bbbbbbbb']);
  // reescribir por completo un único párrafo suelto: se considera el mismo párrafo editado
  out = D.reconcileBlocks(old, [A.text, 'Algo totalmente distinto que escribí después.', C.text].join('\n\n'));
  assert.deepEqual(plain(ids(out)), ['b_aaaaaaaa', 'b_bbbbbbbb', 'b_cccccccc']);
  // texto vacío: sin bloques
  assert.equal(D.reconcileBlocks(old, '  \n\n ').length, 0);
});

test('reconcileBlocks conserva campos extra del bloque y no mezcla dos cambios a la vez', () => {
  const D = load().diary;
  const old = [{ id: 'b_11111111', text: 'Primer párrafo con bastante texto aquí.', extra: 7 }, { id: 'b_22222222', text: 'Segundo párrafo con otro texto distinto.' }];
  const out = D.reconcileBlocks(old, 'Primer párrafo con bastante texto aquí.\n\nUn tercero nuevo.\n\nOtro cuarto nuevo.');
  assert.equal(out[0].id, 'b_11111111'); assert.equal(out[0].extra, 7);
  assert.ok(!out.some((b) => b.id === 'b_22222222'), 'dos nuevos y uno viejo suelto: no se emparejan a ciegas');
});

// ---------- Validación ----------
test('sanitizeEntry completa valores y conserva campos desconocidos', () => {
  const D = load().diary;
  const e = D.sanitizeEntry({ ...entry(), futuro: { a: 1 }, tags: ['Viaje', '#viaje', ' música ', 'MÚSICA'], favorite: 'sí' });
  assert.match(e.id, /^e_[0-9a-f]{12}$/);
  assert.equal(e.favorite, false);
  assert.deepEqual(plain(e.tags), ['Viaje', 'música']);
  assert.deepEqual(plain(e.futuro), { a: 1 });
  assert.match(e.blocks[0].id, /^b_[0-9a-f]{8}$/);
  assert.equal(e.moodId, null);
  assert.ok(!isNaN(Date.parse(e.createdAt)) && !isNaN(Date.parse(e.updatedAt)));
});

test('sanitizeEntry rechaza entradas inválidas con mensajes claros', () => {
  const D = load().diary;
  const bad = (over, re) => assert.throws(() => D.sanitizeEntry({ ...entry(), ...over }), (e) => { assert.equal(e.code, 'invalid'); assert.match(e.message, re); return true; });
  bad({ date: '2026-02-30T10:00' }, /fecha/i);
  bad({ title: 'x'.repeat(201) }, /título/i);
  bad({ title: '', blocks: [] }, /al menos una línea/i);
  bad({ blocks: [{ text: 'y'.repeat(20001) }] }, /demasiado largo/i);
  bad({ blocks: [{ nada: 1 }] }, /formato/i);
  bad({ id: 'otro' }, /identificador/i);
  assert.throws(() => D.sanitizeEntry(null)); assert.throws(() => D.sanitizeEntry([]));
  assert.doesNotThrow(() => D.sanitizeEntry({ date: '2026-10-13T10:00', title: 'Solo título' }));
  assert.doesNotThrow(() => D.sanitizeEntry({ date: '2026-10-13T10:00', blocks: [{ text: 'Solo texto' }] }));
});

test('sanitizeEntry ignora claves peligrosas y no contamina prototipos', () => {
  const D = load().diary;
  const e = D.sanitizeEntry(JSON.parse('{"date":"2026-10-13T10:00","title":"x","__proto__":{"admin":true},"constructor":"mal"}'));
  assert.equal(({}).admin, undefined); assert.equal(e.admin, undefined); assert.equal(typeof e.constructor, 'function');
});

test('no se limita el número de caracteres que valen más: la longitud no influye en nada', () => {
  const D = load().diary;
  const short = D.sanitizeEntry({ date: '2026-10-13T10:00', title: 'a' });
  const long = D.sanitizeEntry({ date: '2026-10-13T10:00', title: 'a', blocks: [{ text: 'palabra '.repeat(2000) }] });
  assert.deepEqual(Object.keys(short).sort(), Object.keys(long).sort());
});

// ---------- Búsqueda y calendario ----------
const sample = (App) => ['2026-10-13T21:30|Tarde de sábado|Quedé con Marcos para tomar algo.|viaje,amigos|1', '2026-10-07T10:00|Un día de lluvia|Escuché mucha música en casa.|música|0',
  '2025-10-13T09:00|La capa terminada|Terminé la primera pasada de la capa.|trabajo|1', '2026-03-02T08:00||Sin título, solo texto.||0']
  .map((s) => { const [date, title, text, tags, fav] = s.split('|'); return App.diary.sanitizeEntry({ date, title, blocks: [{ text }], tags: tags ? tags.split(',') : [], favorite: fav === '1' }); });

test('la búsqueda ignora tildes y mayúsculas y exige todos los términos', () => {
  const App = load(); const all = sample(App); const D = App.diary;
  assert.equal(D.search(all, { text: 'MUSICA' }).length, 1);
  assert.equal(D.search(all, { text: 'sabado marcos' }).length, 1);
  assert.equal(D.search(all, { text: 'sabado lluvia' }).length, 0);
  assert.equal(D.search(all, { text: 'amigos' }).length, 1, 'también busca en etiquetas');
  assert.equal(D.search(all, {}).length, 4);
});

test('filtros por etiqueta, favoritas, día y rango de fechas', () => {
  const App = load(); const all = sample(App); const D = App.diary;
  assert.equal(D.search(all, { tags: ['VIAJE'] }).length, 1);
  assert.equal(D.search(all, { tags: ['viaje', 'trabajo'] }).length, 0);
  assert.equal(D.search(all, { favoritesOnly: true }).length, 2);
  assert.equal(D.search(all, { day: '2026-10-07' })[0].title, 'Un día de lluvia');
  assert.equal(D.search(all, { from: '2026-10-01', to: '2026-10-31' }).length, 2);
  assert.equal(D.search(all, { from: '2026-10-08' }).length, 1);
  assert.deepEqual(plain(D.search(all, {}).map((e) => e.date.slice(0, 10))), ['2026-10-13', '2026-10-07', '2026-03-02', '2025-10-13']);
});

test('etiquetas más usadas, agrupación por mes y calendario', () => {
  const App = load(); const all = sample(App); const D = App.diary;
  assert.equal(D.allTags(all).length, 4);
  const groups = D.groupByMonth(D.search(all, {}));
  assert.deepEqual(plain(groups.map((g) => [g.key, g.entries.length])), [['2026-10', 2], ['2026-03', 1], ['2025-10', 1]]);

  const grid = D.monthGrid(2026, 9, all);                 // octubre de 2026 empieza en jueves
  assert.equal(grid.weeks.length, 5);
  assert.deepEqual(plain(grid.weeks[0].map((c) => (c ? c.day : null))), [null, null, null, 1, 2, 3, 4]);
  const days = grid.weeks.flat().filter(Boolean);
  assert.equal(days.length, 31);
  assert.equal(days.find((c) => c.day === 13).count, 1);
  assert.equal(days.find((c) => c.day === 12).count, 0);
  assert.equal(D.monthGrid(2028, 1, []).weeks.flat().filter(Boolean).length, 29, 'año bisiesto');
  assert.ok(D.monthGrid(2026, 1, []).weeks.every((w) => w.length === 7));
});

test('título y extracto para listas', () => {
  const D = load().diary;
  assert.equal(D.displayTitle({ title: 'Hola', blocks: [] }), 'Hola');
  assert.equal(D.displayTitle({ title: '', blocks: [{ text: 'Texto largo '.repeat(20) }] }).length <= 60, true);
  assert.equal(D.displayTitle({ title: '', blocks: [] }), 'Sin título');
  assert.match(D.excerpt({ blocks: [{ text: 'a\n\nb   c' }] }), /^a b c$/);
});

// ---------- Repositorio ----------
test('crear, leer, editar y borrar entradas; sobreviven a "cerrar y reabrir"', async () => {
  const fake = createFakeGithub(); const { repo, App } = makeRepo(fake);
  const saved = await repo.save(entry({ tags: ['viaje'], blocks: [{ text: 'Uno.' }, { text: 'Dos.' }] }));
  assert.equal(JSON.parse(fake.state.files.get('entries/2026-10.json')).entries.length, 1);
  assert.equal((await repo.list()).length, 1);

  const reopened = makeRepo(fake).repo;                       // una "sesión" nueva: sin caché
  const again = await reopened.get(saved.id);
  assert.deepEqual(plain(again.blocks), plain(saved.blocks));
  assert.equal(again.title, 'Un día');

  const edited = await reopened.save({ ...again, title: 'Otro título', favorite: true, futuro: 'conservar' });
  assert.equal(edited.createdAt, saved.createdAt);
  assert.ok(edited.updatedAt >= saved.updatedAt);
  assert.equal(edited.blocks[0].id, saved.blocks[0].id);
  assert.equal((await reopened.list()).length, 1, 'editar no duplica');
  assert.equal(JSON.parse(fake.state.files.get('entries/2026-10.json')).entries[0].futuro, 'conservar');

  assert.equal(await reopened.remove(saved.id), true);
  assert.equal(await reopened.remove(saved.id), false);
  assert.equal(JSON.parse(fake.state.files.get('entries/2026-10.json')).entries.length, 0);
  assert.equal((await makeRepo(fake).repo.list()).length, 0);
  assert.ok(App);
});

test('cambiar la fecha a otro mes mueve la entrada sin duplicarla ni perderla', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  const saved = await repo.save(entry());
  await repo.save({ ...saved, date: '2026-09-30T23:50' });
  assert.equal(JSON.parse(fake.state.files.get('entries/2026-10.json')).entries.length, 0);
  assert.equal(JSON.parse(fake.state.files.get('entries/2026-09.json')).entries.length, 1);
  const fresh = await makeRepo(fake).repo.list();
  assert.equal(fresh.length, 1); assert.equal(fresh[0].date, '2026-09-30T23:50');
});

test('si un movimiento de mes se queda a medias, al cargar gana la copia más reciente', async () => {
  const fake = createFakeGithub(); const { repo, App } = makeRepo(fake);
  const old = App.diary.sanitizeEntry({ ...entry(), id: 'e_0123456789ab', updatedAt: '2026-10-01T00:00:00.000Z' });
  const newer = { ...old, date: '2026-09-30T10:00', title: 'Más reciente', updatedAt: '2026-10-02T00:00:00.000Z' };
  fake.state.files.set('entries/2026-10.json', JSON.stringify({ month: '2026-10', entries: [old] }));
  fake.state.files.set('entries/2026-09.json', JSON.stringify({ month: '2026-09', entries: [newer] }));
  const list = await repo.list();
  assert.equal(list.length, 1); assert.equal(list[0].title, 'Más reciente');
});

test('un mes dañado se avisa y no se toca; las demás entradas siguen funcionando', async () => {
  const fake = createFakeGithub({ files: { 'entries/2026-08.json': '{esto no es json', 'entries/2026-07.json': '{"entries":"mal"}' } });
  const { repo } = makeRepo(fake);
  const saved = await repo.save(entry());
  assert.equal((await repo.list()).length, 1);
  assert.deepEqual(plain(repo.problems()).sort(), ['2026-07', '2026-08']);
  await rejectsWith(repo.save(entry({ date: '2026-08-05T10:00' })), 'invalid');
  assert.equal(fake.state.files.get('entries/2026-08.json'), '{esto no es json', 'el archivo dañado queda intacto');
  assert.ok(saved.id);
});

test('al guardar una entrada no se pierden las que no se entienden en ese mismo mes', async () => {
  const weird = { id: 'raro', cosa: 'de otra versión' };
  const fake = createFakeGithub({ files: { 'entries/2026-10.json': JSON.stringify({ month: '2026-10', entries: [weird] }) } });
  const { repo } = makeRepo(fake);
  await repo.save(entry());
  const doc = JSON.parse(fake.state.files.get('entries/2026-10.json'));
  assert.equal(doc.entries.length, 2); assert.deepEqual(doc.entries.find((e) => e.id === 'raro'), weird);
});

test('dos guardados a la vez en el mismo mes se conservan los dos', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  await Promise.all([repo.save(entry({ title: 'A' })), repo.save(entry({ title: 'B', date: '2026-10-14T08:00' })), repo.save(entry({ title: 'C', date: '2026-10-15T08:00' }))]);
  assert.deepEqual(JSON.parse(fake.state.files.get('entries/2026-10.json')).entries.map((e) => e.title).sort(), ['A', 'B', 'C']);
});

test('si otro dispositivo escribe a la vez, se fusionan ambas entradas', async () => {
  const fake = createFakeGithub(); const { repo, App } = makeRepo(fake);
  await repo.save(entry({ title: 'Inicial' }));
  const other = App.diary.sanitizeEntry(entry({ title: 'Desde el móvil', date: '2026-10-20T09:00' }));
  let done = false;
  fake.state.beforePut = (path, body, st) => {
    if (!done && path === 'entries/2026-10.json') { done = true; const d = JSON.parse(st.files.get(path)); d.entries.push(other); st.files.set(path, JSON.stringify(d)); }
  };
  await repo.save(entry({ title: 'Desde el ordenador', date: '2026-10-21T09:00' }));
  assert.deepEqual(JSON.parse(fake.state.files.get('entries/2026-10.json')).entries.map((e) => e.title).sort(), ['Desde el móvil', 'Desde el ordenador', 'Inicial']);
});

test('un mes demasiado grande se rechaza antes de escribir', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  const blocks = Array.from({ length: 60 }, (_, i) => ({ text: `${i} ` + 'x'.repeat(19990) }));
  await rejectsWith(repo.save(entry({ blocks })), 'invalid');
  assert.equal(fake.state.files.size, 0);
});

test('los datos que se escriben no contienen nada inesperado (solo la entrada)', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  await repo.save(entry());
  const text = fake.state.files.get('entries/2026-10.json');
  assert.ok(!/token|Bearer|good/.test(text));
});

test('D.repo() devuelve null sin conexión y reutiliza el repositorio de la misma conexión', async () => {
  const fake = createFakeGithub(); const ls = memoryStorage();
  const App = load({ fetch: fake.fetch, localStorage: ls });
  assert.equal(App.diary.repo(), null);
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const r1 = App.diary.repo(); assert.ok(r1); assert.equal(App.diary.repo(), r1);
  App.connection.disconnect(); assert.equal(App.diary.repo(), null);
});

// ---------- Borradores ----------
test('borradores: guardar, recuperar, listar y descartar', () => {
  const ls = memoryStorage(); const { drafts } = load({ localStorage: ls });
  assert.equal(drafts.get('new'), null);
  assert.equal(drafts.save('new', { title: 'Hola', text: 'Texto a medias', tags: ['a'], date: '2026-10-13T10:00' }), true);
  const d = drafts.get('new');
  assert.equal(d.title, 'Hola'); assert.equal(d.entryId, null); assert.deepEqual(plain(d.tags), ['a']);
  drafts.save('e_0123456789ab', { title: '', text: 'Edición pendiente' });
  assert.equal(drafts.get('e_0123456789ab').entryId, 'e_0123456789ab');
  assert.equal(drafts.list().length, 2);
  drafts.remove('new');
  assert.equal(drafts.get('new'), null); assert.equal(drafts.list().length, 1);
});

test('un borrador vacío se elimina y las claves inválidas se rechazan', () => {
  const { drafts } = load({ localStorage: memoryStorage() });
  drafts.save('new', { text: 'algo' });
  drafts.save('new', { title: '  ', text: '   ' });
  assert.equal(drafts.get('new'), null);
  assert.equal(drafts.save('../x', { text: 'a' }), false);
  assert.equal(drafts.save('__proto__', { text: 'a' }), false);
  assert.equal(drafts.get('constructor'), null);
});

test('borradores: lo corrupto se ignora, la cuota llena se avisa y se limita su número', () => {
  const broken = memoryStorage(); broken.setItem('diario-rpg.drafts.v1', '{no json');
  assert.deepEqual(plain(load({ localStorage: broken }).drafts.list()), []);

  const full = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} };
  assert.equal(load({ localStorage: full }).drafts.save('new', { text: 'x' }), false);

  const ls = memoryStorage(); const { drafts } = load({ localStorage: ls });
  for (let i = 0; i < 30; i++) drafts.save('e_' + String(i).padStart(12, '0'), { text: 'borrador ' + i });
  assert.ok(drafts.list().length <= 20);
});

test('sin localStorage disponible, los borradores fallan sin romper nada', () => {
  const { drafts } = load();
  assert.equal(drafts.save('new', { text: 'x' }), false);
  assert.equal(drafts.get('new'), null); assert.deepEqual(plain(drafts.list()), []);
});
