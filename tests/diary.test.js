// Pruebas de la lógica del diario: entradas por día con bloques, búsqueda, calendario, estadísticas,
// repositorio (con migración del formato antiguo) y borradores.
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
  for (const f of ['storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'diary/entries', 'diary/repository', 'diary/drafts', 'diary/stats']) {
    vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  }
  return ctx.App;
}
function makeRepo(fake, App = load({ fetch: fake.fetch })) {
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  return { App, store: App.createStore(adapter), repo: App.createDiaryRepo(App.createStore(adapter)) };
}
const rejectsWith = (p, code) => assert.rejects(p, (e) => { assert.equal(e.code, code, e.message); return true; });
const block = (text = 'Texto.', over = {}) => ({ text, tags: [], mood: null, ...over });
const entry = (over = {}) => ({ day: '2026-10-13', title: 'Un día', blocks: [block('Primer bloque del día.')], ...over });
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const monthDoc = (fake, key) => JSON.parse(fake.state.files.get(`entries/${key}.json`));
const legacy = (o) => ({ id: 'e_' + o.n.toString(16).padStart(12, '0'), date: o.date, title: o.title ?? '', blocks: [{ id: 'b_' + o.n.toString(16).padStart(8, '0'), text: o.text }],
  tags: o.tags ?? [], favorite: o.fav ?? false, moodId: null, createdAt: o.created ?? '2026-10-01T10:00:00.000Z', updatedAt: o.updated ?? '2026-10-01T10:00:00.000Z' });

// ---------- Días, etiquetas y bloques ----------
test('los identificadores de bloque tienen formato fijo y no se repiten', () => {
  const D = load().diary; const seen = new Set();
  for (let i = 0; i < 1000; i++) { const b = D.newBlockId(); assert.match(b, /^b_[0-9a-f]{8}$/); seen.add(b); }
  assert.ok(seen.size > 990);
});

test('días: solo fechas reales y formatos en español', () => {
  const D = load().diary;
  assert.ok(D.parseDay('2026-10-13'));
  for (const bad of ['2026-02-30', '2026-13-01', '2026-10-13T10:00', '13/10/2026', '', null, undefined, '2026-1-3']) assert.equal(D.parseDay(bad), null, String(bad));
  assert.equal(D.isDay('2028-02-29'), true); assert.equal(D.isDay('2026-02-29'), false);
  assert.match(D.today(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(D.monthKey('2026-10-13'), '2026-10');
  assert.match(D.formatLong('2026-10-13'), /martes.*13.*octubre.*2026/);
  assert.match(D.formatMonth('2026-10'), /octubre.*2026/);
});

test('etiquetas: se limpian, sin repetidos (ni con tildes o mayúsculas) y con límite', () => {
  const D = load().diary;
  assert.deepEqual(plain(D.uniqueTags(['Viaje', '#viaje', ' música ', 'MÚSICA', '', null, '  '])), ['Viaje', 'música']);
  assert.equal(D.uniqueTags(Array.from({ length: 30 }, (_, i) => 't' + i)).length, 20);
  assert.equal(D.normalizeTag('x'.repeat(100)).length, 40);
});

test('un bloque conserva su texto, etiquetas y ánimo, y valida el ánimo', () => {
  const D = load().diary;
  const b = D.sanitizeBlock({ text: '  Hola  ', tags: ['a', 'A'], mood: 'triste', extra: 1 });
  assert.equal(b.text, 'Hola'); assert.deepEqual(plain(b.tags), ['a']); assert.equal(b.mood, 'triste'); assert.equal(b.extra, 1);
  assert.match(b.id, /^b_[0-9a-f]{8}$/);
  assert.equal(D.sanitizeBlock({ text: 'x', mood: 'Mal Ánimo!' }).mood, null);
  assert.equal(D.sanitizeBlock({ text: 'x', mood: 'ilusionada' }).mood, 'ilusionada', 'un ánimo desconocido pero bien formado se conserva');
  assert.equal(D.sanitizeBlock({ text: 'x', id: 'malo' }).id.startsWith('b_'), true);
  const seen = {}; const a = D.sanitizeBlock({ id: 'b_aaaaaaaa', text: 'x' }, seen), c = D.sanitizeBlock({ id: 'b_aaaaaaaa', text: 'y' }, seen);
  assert.notEqual(a.id, c.id, 'los identificadores repetidos se corrigen');
  assert.throws(() => D.sanitizeBlock({ text: 5 }), /formato/); assert.throws(() => D.sanitizeBlock(null));
  assert.throws(() => D.sanitizeBlock({ text: 'y'.repeat(20001) }), /demasiado largo/);
});

test('un bloque cuenta si tiene texto, etiquetas o ánimo', () => {
  const D = load().diary;
  assert.equal(D.blockHasContent({ text: '', tags: [], mood: null }), false);
  assert.equal(D.blockHasContent({ text: '  ', tags: [], mood: null }), false);
  assert.equal(D.blockHasContent({ text: '', tags: [], mood: 'radiante' }), true);
  assert.equal(D.blockHasContent({ text: '', tags: ['a'], mood: null }), true);
});

// ---------- Entradas ----------
test('una entrada es un día con varios bloques; los vacíos se descartan', () => {
  const D = load().diary;
  const e = D.sanitizeEntry(entry({ blocks: [block('Uno'), block(''), block('', { mood: 'cansada' }), block('Tres', { tags: ['t'] })], favorite: 'sí', futuro: { a: 1 } }));
  assert.equal(e.blocks.length, 3);
  assert.equal(e.blocks[1].mood, 'cansada'); assert.equal(e.blocks[1].text, '');
  assert.equal(e.favorite, false); assert.deepEqual(plain(e.futuro), { a: 1 });
  assert.ok(!isNaN(Date.parse(e.createdAt)) && !isNaN(Date.parse(e.updatedAt)));
  assert.equal(e.id, undefined, 'el día es la identidad: no hay otro id');
});

test('una entrada puede ser solo un título o solo un ánimo', () => {
  const D = load().diary;
  assert.doesNotThrow(() => D.sanitizeEntry({ day: '2026-10-13', title: 'Solo título' }));
  assert.doesNotThrow(() => D.sanitizeEntry({ day: '2026-10-13', blocks: [{ mood: 'radiante' }] }));
  assert.doesNotThrow(() => D.sanitizeEntry({ day: '2026-10-13', blocks: [{ tags: ['x'] }] }));
});

test('entradas inválidas: mensajes claros', () => {
  const D = load().diary;
  const bad = (over, re) => assert.throws(() => D.sanitizeEntry({ ...entry(), ...over }), (e) => { assert.equal(e.code, 'invalid'); assert.match(e.message, re); return true; });
  bad({ day: '2026-02-30' }, /fecha/i); bad({ day: undefined }, /fecha/i);
  bad({ title: 'x'.repeat(201) }, /título/i);
  bad({ title: '', blocks: [block(''), block('  ')] }, /Escribe algo/i);
  bad({ blocks: Array.from({ length: 201 }, () => block('x')) }, /demasiados bloques/i);
  bad({ blocks: [{ text: 5 }] }, /formato/i);
  assert.throws(() => D.sanitizeEntry(null)); assert.throws(() => D.sanitizeEntry([]));
});

test('claves peligrosas no contaminan prototipos', () => {
  const D = load().diary;
  const e = D.sanitizeEntry(JSON.parse('{"day":"2026-10-13","title":"x","__proto__":{"admin":true},"constructor":"mal","blocks":[{"text":"a","__proto__":{"x":1}}]}'));
  assert.equal(({}).admin, undefined); assert.equal(e.admin, undefined); assert.equal(e.blocks[0].x, undefined);
});

test('la longitud del texto no cambia nada de la entrada (no hay puntuación por escribir más)', () => {
  const D = load().diary;
  const short = D.sanitizeEntry({ day: '2026-10-13', title: 'a' });
  const long = D.sanitizeEntry({ day: '2026-10-13', title: 'a', blocks: [{ text: 'palabra '.repeat(2000) }] });
  assert.deepEqual(Object.keys(short).sort(), Object.keys(long).sort());
});

test('mergeDayEntries une días conservando orden de bloques, título y favorito', () => {
  const D = load().diary;
  const a = D.sanitizeEntry({ day: '2026-10-13', title: '', favorite: false, blocks: [{ id: 'b_00000001', text: 'A' }], createdAt: '2026-10-13T08:00:00.000Z', updatedAt: '2026-10-13T08:00:00.000Z' });
  const b = D.sanitizeEntry({ day: '2026-10-13', title: 'Título', favorite: true, blocks: [{ id: 'b_00000001', text: 'repetido' }, { id: 'b_00000002', text: 'B' }], createdAt: '2026-10-13T07:00:00.000Z', updatedAt: '2026-10-13T20:00:00.000Z' });
  const m = D.mergeDayEntries([a, b]);
  assert.deepEqual(plain(m.blocks.map((x) => x.text)), ['A', 'B']);
  assert.equal(m.title, 'Título'); assert.equal(m.favorite, true);
  assert.equal(m.createdAt, '2026-10-13T07:00:00.000Z'); assert.equal(m.updatedAt, '2026-10-13T20:00:00.000Z');
});

// ---------- Formato antiguo ----------
test('el formato antiguo se reconoce y se convierte: una entrada por día, etiquetas a los bloques', () => {
  const D = load().diary;
  const raws = [
    legacy({ n: 1, date: '2026-10-13T21:30', text: 'Por la noche.', tags: ['casa'] }),
    legacy({ n: 2, date: '2026-10-13T09:00', text: 'Por la mañana.', title: 'Un día', tags: ['café', 'Casa'], fav: true }),
    legacy({ n: 3, date: '2026-10-14T10:00', title: 'Solo título', text: '' }),
    { id: 'raro', cosa: 1 }, null,
  ];
  assert.equal(D.isLegacy(raws[0]), true); assert.equal(D.isLegacy({ day: '2026-10-13' }), false); assert.equal(D.isLegacy(raws[3]), false);
  const out = D.upgradeLegacy(raws);
  assert.deepEqual(plain(out.map((e) => e.day)), ['2026-10-13', '2026-10-14']);
  const d13 = out[0];
  assert.deepEqual(plain(d13.blocks.map((b) => b.text)), ['Por la mañana.', 'Por la noche.'], 'ordenados por la hora');
  assert.deepEqual(plain(d13.blocks[0].tags), ['café', 'Casa']); assert.deepEqual(plain(d13.blocks[1].tags), ['casa']);
  assert.equal(d13.title, 'Un día'); assert.equal(d13.favorite, true);
  assert.equal(d13.blocks[0].id, 'b_00000002', 'los bloques conservan su identificador');
  assert.equal(out[1].title, 'Solo título'); assert.equal(out[1].blocks.length, 0);
  assert.doesNotThrow(() => D.sanitizeEntry(d13));
});

// ---------- Presentación y búsqueda ----------
const sample = (App) => [
  { day: '2026-10-13', title: 'Tarde de sábado', favorite: true, blocks: [block('Quedé con Marcos para tomar algo.', { tags: ['amigos', 'viaje'], mood: 'radiante' }), block('Cena tranquila.', { tags: ['casa'], mood: 'tranquila' })] },
  { day: '2026-10-07', title: 'Un día de lluvia', blocks: [block('Escuché mucha música en casa.', { tags: ['música'], mood: 'triste' })] },
  { day: '2025-10-13', title: 'La capa terminada', favorite: true, blocks: [block('Terminé la primera pasada de la capa.', { tags: ['trabajo'] })] },
  { day: '2026-03-02', title: '', blocks: [block('Sin título, solo texto.')] },
].map((e) => App.diary.sanitizeEntry(e));

test('títulos, extractos, etiquetas y ánimos de un día', () => {
  const D = load().diary; const e = sample({ diary: D });
  assert.equal(D.displayTitle(e[0]), 'Tarde de sábado');
  assert.match(D.displayTitle(e[3]), /Sin título, solo texto\./);
  assert.match(D.displayTitle({ title: '', blocks: [], day: '2026-10-13' }), /13 de octubre/);
  assert.deepEqual(plain(D.entryTags(e[0])), ['amigos', 'viaje', 'casa']);
  assert.deepEqual(plain(D.entryMoods(e[0])), ['radiante', 'tranquila']);
  assert.match(D.excerpt({ blocks: [{ text: '' }, { text: 'a\n\nb   c' }] }), /^a b c$/);
});

test('la búsqueda ignora tildes y mayúsculas, busca en bloques y etiquetas, y exige todos los términos', () => {
  const D = load().diary; const all = sample({ diary: D });
  assert.equal(D.search(all, { text: 'MUSICA' }).length, 1);
  assert.equal(D.search(all, { text: 'marcos tranquila' }).length, 1, 'términos en bloques distintos del mismo día');
  assert.equal(D.search(all, { text: 'marcos lluvia' }).length, 0);
  assert.equal(D.search(all, { text: 'amigos' }).length, 1, 'también busca en las etiquetas');
  assert.equal(D.search(all, {}).length, 4);
});

test('filtros: etiqueta, ánimo, favoritos, día y rango', () => {
  const D = load().diary; const all = sample({ diary: D });
  assert.equal(D.search(all, { tags: ['VIAJE'] }).length, 1);
  assert.equal(D.search(all, { tags: ['viaje', 'casa'] }).length, 1, 'las etiquetas pueden estar en bloques distintos');
  assert.equal(D.search(all, { tags: ['viaje', 'trabajo'] }).length, 0);
  assert.equal(D.search(all, { mood: 'triste' })[0].day, '2026-10-07');
  assert.equal(D.search(all, { mood: 'enfadada' }).length, 0);
  assert.equal(D.search(all, { favoritesOnly: true }).length, 2);
  assert.equal(D.search(all, { day: '2026-10-07' })[0].title, 'Un día de lluvia');
  assert.equal(D.search(all, { from: '2026-10-01', to: '2026-10-31' }).length, 2);
  assert.deepEqual(plain(D.search(all, {}).map((e) => e.day)), ['2026-10-13', '2026-10-07', '2026-03-02', '2025-10-13']);
});

test('etiquetas más usadas (cuentan bloques), meses y calendario', () => {
  const D = load().diary; const all = sample({ diary: D });
  assert.equal(D.allTags(all).length, 5);
  assert.deepEqual(plain(D.groupByMonth(D.search(all, {})).map((g) => [g.key, g.entries.length])), [['2026-10', 2], ['2026-03', 1], ['2025-10', 1]]);
  const grid = D.monthGrid(2026, 9, all);
  assert.equal(grid.weeks.length, 5);
  assert.deepEqual(plain(grid.weeks[0].map((c) => (c ? c.day : null))), [null, null, null, 1, 2, 3, 4]);
  const days = grid.weeks.flat().filter(Boolean);
  assert.equal(days.length, 31);
  assert.deepEqual(plain(days.find((c) => c.day === 13)), { day: 13, key: '2026-10-13', has: true, blocks: 2 });
  assert.equal(days.find((c) => c.day === 12).has, false);
  assert.equal(D.monthGrid(2028, 1, []).weeks.flat().filter(Boolean).length, 29, 'año bisiesto');
});

// ---------- Estadísticas ----------
function moodEntries(D, spec) {   // spec: [día, [ánimo, etiquetas...], ...]
  return spec.map(([day, ...blocks]) => D.sanitizeEntry({ day, blocks: blocks.map(([mood, ...tags]) => ({ text: 'x', mood, tags })) }));
}

test('el resumen de un mes cuenta ánimos, días y el ánimo predominante (empate: el último del día)', () => {
  const D = load().diary;
  const e = moodEntries(D, [['2026-10-01', ['radiante'], ['radiante'], ['triste']], ['2026-10-02', ['triste'], ['radiante']], ['2026-10-03', [null]], ['2026-09-30', ['normal']]]);
  const s = D.monthStats(e, '2026-10');
  assert.equal(s.total, 5); assert.equal(s.daysWithMood, 2); assert.equal(s.entryDays, 3);
  assert.deepEqual(plain(s.counts), { radiante: 3, triste: 2 });
  assert.equal(s.days['2026-10-01'].dominant, 'radiante');
  assert.equal(s.days['2026-10-02'].dominant, 'radiante', 'empate 1-1: gana el del último bloque');
  assert.equal(s.days['2026-10-03'], undefined);
});

test('el reparto se ordena por frecuencia y, en empate, por el orden fijo del selector', () => {
  const D = load().diary;
  assert.deepEqual(plain(D.moodShares({ triste: 2, radiante: 2, normal: 5 }, 9).map((s) => s.mood)), ['normal', 'radiante', 'triste']);
  assert.deepEqual(plain(D.moodShares({ a: 1 }, 0)), [{ mood: 'a', count: 1, pct: 0 }]);
  assert.equal(D.moodShares({ triste: 1, radiante: 3 }, 4)[0].pct, 75);
});

test('mes a mes: 12 meses terminando en el indicado, con ceros donde no hay datos', () => {
  const D = load().diary;
  assert.equal(D.addMonths('2026-01', -1), '2025-12'); assert.equal(D.addMonths('2026-12', 1), '2027-01'); assert.equal(D.addMonths('2026-10', -12), '2025-10');
  const e = moodEntries(D, [['2026-10-01', ['radiante']], ['2025-11-05', ['triste'], ['triste']], ['2025-10-31', ['normal']]]);
  const t = D.monthlyTrend(e, '2026-10', 12);
  assert.equal(t.length, 12); assert.equal(t[0].key, '2025-11'); assert.equal(t[11].key, '2026-10');
  assert.equal(t[0].total, 2); assert.equal(t[11].total, 1); assert.equal(t[5].total, 0);
  assert.ok(!t.some((m) => m.key === '2025-10'), 'fuera de los 12 meses');
});

test('asociaciones etiqueta-ánimo: solo con datos suficientes y descriptivas', () => {
  const D = load().diary;
  const few = moodEntries(D, [['2026-10-01', ['tranquila', 'paseo'], ['tranquila', 'paseo']]]);
  const r1 = D.tagAssociations(few, '2026-10', 12);
  assert.equal(r1.total, 2); assert.equal(r1.items.length, 0, 'con pocos bloques no se saca ninguna pista');

  const spec = [];
  for (let d = 1; d <= 9; d++) spec.push([`2026-10-${String(d).padStart(2, '0')}`, ['tranquila', 'paseo'], ['cansada', 'trabajo']]);
  spec.push(['2026-10-20', ['triste', 'paseo']], ['2026-10-21', ['radiante', 'rara']]);
  const r = D.tagAssociations(moodEntries(D, spec), '2026-10', 12);
  assert.equal(r.total, 20);
  const paseo = r.items.find((i) => i.tag === 'paseo'), trabajo = r.items.find((i) => i.tag === 'trabajo');
  assert.equal(paseo.total, 10); assert.equal(paseo.top, 'tranquila'); assert.equal(paseo.topCount, 9); assert.equal(paseo.topPct, 90);
  assert.equal(paseo.overallPct, 45);
  assert.equal(trabajo.top, 'cansada');
  assert.ok(!r.items.some((i) => i.tag === 'rara'), 'una etiqueta con 1 bloque no se muestra');
});

// ---------- Repositorio ----------
test('crear, leer, editar y borrar el día; sobrevive a "cerrar y reabrir"', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  const saved = await repo.save(entry({ blocks: [block('Uno.', { mood: 'radiante', tags: ['a'] }), block('Dos.')] }), { base: null });
  assert.equal(monthDoc(fake, '2026-10').version, 2);
  assert.equal(monthDoc(fake, '2026-10').entries.length, 1);

  const reopened = makeRepo(fake).repo;
  const again = await reopened.get('2026-10-13');
  assert.deepEqual(plain(again.blocks), plain(saved.blocks));
  assert.equal(again.blocks[0].mood, 'radiante');

  const edited = await reopened.save({ ...again, title: 'Otro título', futuro: 'conservar', blocks: [...again.blocks, block('Tres.')] }, { base: again.updatedAt });
  assert.equal(edited.createdAt, saved.createdAt); assert.equal(edited.blocks[0].id, saved.blocks[0].id); assert.equal(edited.blocks.length, 3);
  assert.equal((await reopened.list()).length, 1, 'editar no duplica');
  assert.equal(monthDoc(fake, '2026-10').entries[0].futuro, 'conservar');

  assert.equal(await reopened.remove('2026-10-13'), true);
  assert.equal(await reopened.remove('2026-10-13'), false);
  assert.equal(monthDoc(fake, '2026-10').entries.length, 0);
  assert.equal((await makeRepo(fake).repo.list()).length, 0);
});

test('solo hay una entrada por día: guardar el mismo día la sustituye', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  const a = await repo.save(entry(), { base: null });
  await repo.save({ ...a, title: 'Segunda versión' }, { base: a.updatedAt });
  await repo.save(entry({ day: '2026-10-14' }), { base: null });
  assert.equal(monthDoc(fake, '2026-10').entries.length, 2);
  assert.equal((await repo.list()).length, 2);
});

test('no se pisan cambios hechos desde otro dispositivo: "stale"', async () => {
  const fake = createFakeGithub(); const A = makeRepo(fake).repo;
  const first = await A.save(entry(), { base: null });
  // el móvil abre la entrada y la edita
  const mobile = makeRepo(fake).repo; const seen = await mobile.get('2026-10-13');
  await mobile.save({ ...seen, title: 'Cambio desde el móvil' }, { base: seen.updatedAt });
  // el ordenador, que cargó la versión anterior, intenta guardar
  await rejectsWith(A.save({ ...first, title: 'Cambio desde el ordenador' }, { base: first.updatedAt }), 'stale');
  assert.equal(monthDoc(fake, '2026-10').entries[0].title, 'Cambio desde el móvil', 'lo del móvil sigue intacto');
  // crear un día que otro dispositivo ya creó
  await rejectsWith(makeRepo(fake).repo.save(entry(), { base: null }), 'stale');
  // editar algo que otro dispositivo borró
  await mobile.remove('2026-10-13');
  await rejectsWith(A.save({ ...first, title: 'x' }, { base: first.updatedAt }), 'stale');
});

test('appendBlock crea el día o añade al final, y acepta un bloque solo con ánimo', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  const created = await repo.appendBlock('2026-10-13', { mood: 'cansada' });
  assert.equal(created.blocks.length, 1); assert.equal(created.blocks[0].text, ''); assert.equal(created.blocks[0].mood, 'cansada');
  const more = await repo.appendBlock('2026-10-13', { text: 'Más tarde.', mood: 'tranquila', tags: ['paseo'] });
  assert.deepEqual(plain(more.blocks.map((b) => b.mood)), ['cansada', 'tranquila']);
  assert.equal(monthDoc(fake, '2026-10').entries.length, 1);
  await rejectsWith(repo.appendBlock('2026-10-13', { text: '  ' }), 'invalid');
  await rejectsWith(repo.appendBlock('2026-13-40', { mood: 'radiante' }), 'invalid');
});

test('appendBlock se suma a lo que otro dispositivo escribió a la vez', async () => {
  const fake = createFakeGithub(); const { repo, App } = makeRepo(fake);
  await repo.save(entry(), { base: null });
  let done = false;
  fake.state.beforePut = (path, body, st) => {
    if (!done && path === 'entries/2026-10.json') {
      done = true; const d = JSON.parse(st.files.get(path)); d.entries[0].blocks.push(App.diary.sanitizeBlock({ text: 'Desde el móvil' })); st.files.set(path, JSON.stringify(d));
    }
  };
  const r = await repo.appendBlock('2026-10-13', { mood: 'radiante' });
  assert.deepEqual(plain(r.blocks.map((b) => b.text)), ['Primer bloque del día.', 'Desde el móvil', '']);
});

test('días distintos guardados a la vez se conservan todos', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  await Promise.all(['01', '02', '03'].map((d) => repo.save(entry({ day: `2026-10-${d}`, title: d }), { base: null })));
  assert.deepEqual(monthDoc(fake, '2026-10').entries.map((e) => e.title), ['01', '02', '03']);
});

test('un mes dañado se avisa y no se toca; lo demás sigue funcionando', async () => {
  const fake = createFakeGithub({ files: { 'entries/2026-08.json': '{esto no es json', 'entries/2026-07.json': '{"entries":"mal"}' } });
  const { repo } = makeRepo(fake);
  await repo.save(entry(), { base: null });
  assert.equal((await repo.list()).length, 1);
  assert.deepEqual(plain(repo.problems()).sort(), ['2026-07', '2026-08']);
  await rejectsWith(repo.save(entry({ day: '2026-08-05' }), { base: null }), 'invalid');
  assert.equal(fake.state.files.get('entries/2026-08.json'), '{esto no es json');
});

test('al guardar un día no se pierden las entradas que no se entienden en ese mes', async () => {
  const weird = { cosa: 'de otra versión', day: '2026-10-01' };
  const fake = createFakeGithub({ files: { 'entries/2026-10.json': JSON.stringify({ month: '2026-10', entries: [weird] }) } });
  const { repo } = makeRepo(fake);
  await repo.save(entry(), { base: null });
  const doc = monthDoc(fake, '2026-10');
  assert.equal(doc.entries.length, 2); assert.deepEqual(doc.entries.find((e) => e.cosa), weird);
});

test('un mes demasiado grande se rechaza antes de escribir', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  const blocks = Array.from({ length: 60 }, (_, i) => block(`${i} ` + 'x'.repeat(19990)));
  await rejectsWith(repo.save(entry({ blocks }), { base: null }), 'invalid');
  assert.equal(fake.state.files.size, 0);
});

test('migración: el formato antiguo se ve convertido, bloquea guardar y se actualiza sin perder nada', async () => {
  const files = {
    'entries/2026-10.json': JSON.stringify({ month: '2026-10', entries: [
      legacy({ n: 1, date: '2026-10-13T21:30', text: 'Por la noche.', tags: ['casa'] }),
      legacy({ n: 2, date: '2026-10-13T09:00', text: 'Por la mañana.', title: 'Un día' }),
      legacy({ n: 3, date: '2026-10-05T10:00', text: 'Otro día.' }),
    ] }),
    'entries/2026-09.json': JSON.stringify({ month: '2026-09', entries: [legacy({ n: 4, date: '2026-09-30T12:00', text: 'Septiembre.' })] }),
  };
  const fake = createFakeGithub({ files }); const { repo, App } = makeRepo(fake);
  const list = await repo.list();
  assert.equal(list.length, 3, 'vista previa ya convertida: un día cada uno');
  assert.deepEqual(plain(list[0].blocks.map((b) => b.text)), ['Por la mañana.', 'Por la noche.']);
  assert.deepEqual(plain(repo.legacy()), { months: ['2026-09', '2026-10'], count: 4 });
  await rejectsWith(repo.save(entry(), { base: null }), 'invalid');
  await rejectsWith(repo.appendBlock('2026-10-13', { mood: 'radiante' }), 'invalid');
  await rejectsWith(repo.remove('2026-10-13'), 'invalid');
  assert.equal(JSON.stringify(monthDoc(fake, '2026-10')).includes('"day"'), false, 'no se escribe nada hasta actualizar');

  const result = await repo.migrateLegacy();
  assert.deepEqual(plain(result), { months: 2, entries: 3 });
  const oct = monthDoc(fake, '2026-10');
  assert.equal(oct.version, 2); assert.deepEqual(oct.entries.map((e) => e.day), ['2026-10-05', '2026-10-13']);
  assert.deepEqual(oct.entries[1].blocks.map((b) => b.text), ['Por la mañana.', 'Por la noche.']);
  assert.deepEqual(oct.entries[1].blocks[1].tags, ['casa']);
  assert.equal(oct.entries[1].title, 'Un día');
  assert.ok(oct.entries.every((e) => !('date' in e) && !('tags' in e) && !('id' in e)));
  assert.equal(repo.legacy().months.length, 0);
  assert.equal((await makeRepo(fake).repo.list()).length, 3, 'recargado desde cero sigue igual');
  assert.deepEqual(plain(await repo.migrateLegacy()), { months: 0, entries: 0 }, 'es idempotente');
  const saved = await repo.save(entry({ day: '2026-10-20' }), { base: null });
  assert.equal(saved.day, '2026-10-20');
  assert.ok(App);
});

test('migración: copias en dos meses (movimiento a medias) y días que ya estaban en el formato nuevo', async () => {
  const dup = legacy({ n: 7, date: '2026-10-13T10:00', text: 'Mismo bloque.', updated: '2026-10-02T00:00:00.000Z' });
  const dupNew = { ...dup, date: '2026-09-30T10:00', updatedAt: '2026-10-03T00:00:00.000Z', blocks: [{ id: dup.blocks[0].id, text: 'Versión más reciente.' }] };
  const App0 = load();
  const fresh = App0.diary.sanitizeEntry({ day: '2026-09-30', blocks: [{ text: 'Ya en el formato nuevo.' }], createdAt: '2026-09-30T08:00:00.000Z', updatedAt: '2026-09-30T08:00:00.000Z' });
  const fake = createFakeGithub({ files: {
    'entries/2026-10.json': JSON.stringify({ month: '2026-10', entries: [dup] }),
    'entries/2026-09.json': JSON.stringify({ month: '2026-09', entries: [dupNew, fresh] }),
  } });
  const { repo } = makeRepo(fake);
  await repo.migrateLegacy();
  assert.equal(monthDoc(fake, '2026-10').entries.length, 0, 'la copia antigua perdedora desaparece');
  const sep = monthDoc(fake, '2026-09').entries.find((e) => e.day === '2026-09-30');
  assert.deepEqual(sep.blocks.map((b) => b.text), ['Versión más reciente.', 'Ya en el formato nuevo.']);
});

test('D.repo() devuelve null sin conexión y reutiliza el repositorio de la misma conexión', async () => {
  const fake = createFakeGithub(); const App = load({ fetch: fake.fetch, localStorage: memoryStorage() });
  assert.equal(App.diary.repo(), null);
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const r1 = App.diary.repo(); assert.ok(r1); assert.equal(App.diary.repo(), r1);
  App.connection.disconnect(); assert.equal(App.diary.repo(), null);
});

// ---------- Borradores ----------
test('borradores por día: guardar, recuperar, listar y descartar', () => {
  const { drafts } = load({ localStorage: memoryStorage() });
  assert.equal(drafts.get('2026-10-13'), null);
  assert.equal(drafts.save('2026-10-13', { title: 'Hola', blocks: [{ text: 'A medias', tags: ['a'], mood: 'triste' }, { text: '' }] }), true);
  const d = drafts.get('2026-10-13');
  assert.equal(d.title, 'Hola'); assert.equal(d.blocks.length, 2); assert.equal(d.blocks[0].mood, 'triste'); assert.match(d.blocks[0].id, /^b_[0-9a-f]{8}$/);
  drafts.save('2026-10-12', { blocks: [{ text: 'Ayer' }] });
  assert.equal(drafts.list().length, 2); assert.equal(drafts.list()[0].day, '2026-10-12', 'el más reciente primero');
  drafts.remove('2026-10-13'); assert.equal(drafts.get('2026-10-13'), null);
});

test('un borrador solo con un ánimo cuenta; uno vacío se elimina; las claves inválidas se rechazan', () => {
  const { drafts } = load({ localStorage: memoryStorage() });
  drafts.save('2026-10-13', { blocks: [{ text: '', mood: 'radiante' }] });
  assert.equal(drafts.list().length, 1);
  drafts.save('2026-10-13', { title: '  ', blocks: [{ text: '  ' }] });
  assert.equal(drafts.get('2026-10-13'), null);
  for (const bad of ['new', '../x', '__proto__', '2026-02-30', 'e_0123456789ab']) { assert.equal(drafts.save(bad, { title: 'a' }), false, bad); assert.equal(drafts.get(bad), null); }
});

test('los borradores de la fase 3 (una caja de texto) se convierten en un bloque del día', () => {
  const ls = memoryStorage();
  ls.setItem('diario-rpg.drafts.v1', JSON.stringify({ drafts: {
    new: { title: 'Antiguo', text: 'Texto que escribía', tags: ['viejo'], date: '2026-10-11T09:00', updatedAt: '2026-10-11T09:05:00.000Z' },
    e_0123456789ab: { title: '', text: 'Edición pendiente', date: '2026-10-11T18:00', updatedAt: '2026-10-11T18:05:00.000Z' },
  } }));
  const { drafts } = load({ localStorage: ls });
  const d = drafts.get('2026-10-11');
  assert.equal(d.title, 'Antiguo'); assert.deepEqual(plain(d.blocks.map((b) => b.text)), ['Texto que escribía', 'Edición pendiente']);
  assert.deepEqual(plain(d.blocks[0].tags), ['viejo']);
  assert.equal(ls.getItem('diario-rpg.drafts.v1'), null, 'el formato antiguo se retira cuando se ha convertido');
  assert.equal(drafts.list().length, 1);
});

test('borradores: lo corrupto se ignora, la cuota llena se avisa y se limita su número', () => {
  const broken = memoryStorage(); broken.setItem('diario-rpg.drafts.v2', '{no json');
  assert.deepEqual(plain(load({ localStorage: broken }).drafts.list()), []);
  const full = { getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }, removeItem() {} };
  assert.equal(load({ localStorage: full }).drafts.save('2026-10-13', { title: 'x' }), false);
  const { drafts } = load({ localStorage: memoryStorage() });
  for (let d = 1; d <= 28; d++) drafts.save('2026-09-' + String(d).padStart(2, '0'), { title: 'borrador ' + d });
  assert.ok(drafts.list().length <= 20);
});

test('sin localStorage disponible, los borradores fallan sin romper nada', () => {
  const { drafts } = load();
  assert.equal(drafts.save('2026-10-13', { title: 'x' }), false);
  assert.equal(drafts.get('2026-10-13'), null); assert.deepEqual(plain(drafts.list()), []);
});
