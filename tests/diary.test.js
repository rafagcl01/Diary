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
  for (const f of ['icons', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'diary/entries', 'diary/repository', 'diary/drafts', 'diary/emotions', 'diary/stats']) {
    vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  }
  return ctx.App;
}
function makeRepo(fake, App = load({ fetch: fake.fetch })) {
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  return { App, store: App.createStore(adapter), repo: App.createDiaryRepo(App.createStore(adapter)) };
}
function makeAll(fake, App = load({ fetch: fake.fetch })) {
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  const store = App.createStore(adapter);
  return { App, store, repo: App.createDiaryRepo(store), emo: App.createEmotionRepo(store) };
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

test('un bloque conserva su texto, etiquetas, estado y emociones, y valida el estado', () => {
  const D = load().diary;
  const b = D.sanitizeBlock({ text: '  Hola  ', tags: ['a', 'A'], mood: 'muy-mal', emotions: ['em_0123abcd', 'em_0123abcd', 'malo', 5, 'em_ffffffff'], extra: 1 });
  assert.equal(b.text, 'Hola'); assert.deepEqual(plain(b.tags), ['a']); assert.equal(b.mood, 'muy-mal'); assert.equal(b.extra, 1);
  assert.deepEqual(plain(b.emotions), ['em_0123abcd', 'em_ffffffff'], 'sin repetidos ni identificadores inválidos');
  assert.match(b.id, /^b_[0-9a-f]{8}$/);
  assert.equal(D.sanitizeBlock({ text: 'x', mood: 'Mal Ánimo!' }).mood, null);
  assert.equal(D.sanitizeBlock({ text: 'x', emotions: 'em_0123abcd' }).emotions.length, 0);
  assert.equal(D.sanitizeBlock({ text: 'x', emotions: Array.from({ length: 15 }, (_, i) => 'em_' + i.toString(16).padStart(8, '0')) }).emotions.length, 10, 'como mucho 10 emociones por entrada');
  assert.equal(D.sanitizeBlock({ text: 'x', id: 'malo' }).id.startsWith('b_'), true);
  const seen = {}; const a = D.sanitizeBlock({ id: 'b_aaaaaaaa', text: 'x' }, seen), c = D.sanitizeBlock({ id: 'b_aaaaaaaa', text: 'y' }, seen);
  assert.notEqual(a.id, c.id, 'los identificadores repetidos se corrigen');
  assert.throws(() => D.sanitizeBlock({ text: 5 }), /formato/); assert.throws(() => D.sanitizeBlock(null));
  assert.throws(() => D.sanitizeBlock({ text: 'y'.repeat(20001) }), /demasiado larga/);
});

test('los siete estados de la versión anterior se pasan al nivel más cercano y se conserva el original', () => {
  const D = load().diary;
  const expected = { radiante: 'muy-bien', tranquila: 'bien', normal: 'neutro', cansada: 'neutro', ansiosa: 'mal', triste: 'mal', enfadada: 'mal' };
  for (const [old, now] of Object.entries(expected)) {
    const b = D.sanitizeBlock({ text: 'x', mood: old });
    assert.equal(b.mood, now, old); assert.equal(b.legacyMood, old);
    assert.equal(D.sanitizeBlock(b).mood, now, 'repetir la conversión no cambia nada'); assert.equal(D.sanitizeBlock(b).legacyMood, old);
  }
  const unknown = D.sanitizeBlock({ text: 'x', mood: 'ilusionada' });
  assert.equal(unknown.mood, null); assert.equal(unknown.legacyMood, 'ilusionada', 'un estado desconocido no cuenta, pero no se pierde');
  assert.equal(D.sanitizeBlock({ text: 'x', mood: 'bien' }).legacyMood, undefined);
  assert.equal(D.sanitizeBlock({ text: 'x', legacyMood: 'Raro!' }).legacyMood, undefined);
});

test('un bloque cuenta si tiene texto, etiquetas, estado o emociones', () => {
  const D = load().diary;
  assert.equal(D.blockHasContent({ text: '', tags: [], mood: null, emotions: [] }), false);
  assert.equal(D.blockHasContent({ text: '  ', tags: [], mood: null }), false);
  assert.equal(D.blockHasContent({ text: '', tags: [], mood: 'muy-bien' }), true);
  assert.equal(D.blockHasContent({ text: '', tags: ['a'], mood: null }), true);
  assert.equal(D.blockHasContent({ text: '', tags: [], mood: null, emotions: ['em_0123abcd'] }), true);
});

// ---------- Entradas ----------
test('una entrada es un día con varios bloques; los vacíos se descartan', () => {
  const D = load().diary;
  const e = D.sanitizeEntry(entry({ blocks: [block('Uno'), block(''), block('', { mood: 'mal' }), block('Tres', { tags: ['t'] })], favorite: 'sí', futuro: { a: 1 } }));
  assert.equal(e.blocks.length, 3);
  assert.equal(e.blocks[1].mood, 'mal'); assert.equal(e.blocks[1].text, '');
  assert.equal(e.favorite, false); assert.deepEqual(plain(e.futuro), { a: 1 });
  assert.ok(!isNaN(Date.parse(e.createdAt)) && !isNaN(Date.parse(e.updatedAt)));
  assert.equal(e.id, undefined, 'el día es la identidad: no hay otro id');
});

test('una entrada puede ser solo un título o solo un ánimo', () => {
  const D = load().diary;
  assert.doesNotThrow(() => D.sanitizeEntry({ day: '2026-10-13', title: 'Solo título' }));
  assert.doesNotThrow(() => D.sanitizeEntry({ day: '2026-10-13', blocks: [{ mood: 'muy-bien' }] }));
  assert.doesNotThrow(() => D.sanitizeEntry({ day: '2026-10-13', blocks: [{ tags: ['x'] }] }));
});

test('entradas inválidas: mensajes claros', () => {
  const D = load().diary;
  const bad = (over, re) => assert.throws(() => D.sanitizeEntry({ ...entry(), ...over }), (e) => { assert.equal(e.code, 'invalid'); assert.match(e.message, re); return true; });
  bad({ day: '2026-02-30' }, /fecha/i); bad({ day: undefined }, /fecha/i);
  bad({ title: 'x'.repeat(201) }, /título/i);
  bad({ title: '', blocks: [block(''), block('  ')] }, /Escribe algo/i);
  bad({ blocks: Array.from({ length: 201 }, () => block('x')) }, /demasiadas entradas/i);
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
  { day: '2026-10-13', title: 'Tarde de sábado', favorite: true, blocks: [block('Quedé con Marcos para tomar algo.', { tags: ['amigos', 'viaje'], mood: 'muy-bien' }), block('Cena tranquila.', { tags: ['casa'], mood: 'bien' })] },
  { day: '2026-10-07', title: 'Un día de lluvia', blocks: [block('Escuché mucha música en casa.', { tags: ['música'], mood: 'muy-mal' })] },
  { day: '2025-10-13', title: 'La capa terminada', favorite: true, blocks: [block('Terminé la primera pasada de la capa.', { tags: ['trabajo'] })] },
  { day: '2026-03-02', title: '', blocks: [block('Sin título, solo texto.')] },
].map((e) => App.diary.sanitizeEntry(e));

test('títulos, extractos, etiquetas y ánimos de un día', () => {
  const D = load().diary; const e = sample({ diary: D });
  assert.equal(D.displayTitle(e[0]), 'Tarde de sábado');
  assert.match(D.displayTitle(e[3]), /Sin título, solo texto\./);
  assert.match(D.displayTitle({ title: '', blocks: [], day: '2026-10-13' }), /13 de octubre/);
  assert.deepEqual(plain(D.entryTags(e[0])), ['amigos', 'viaje', 'casa']);
  assert.deepEqual(plain(D.entryMoods(e[0])), ['muy-bien', 'bien']);
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
  assert.equal(D.search(all, { mood: 'muy-mal' })[0].day, '2026-10-07');
  assert.equal(D.search(all, { mood: 'mal' }).length, 0);
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

test('el resumen de un mes cuenta estados, días, el que predomina (empate: el último del día) y la media', () => {
  const D = load().diary;
  const e = moodEntries(D, [['2026-10-01', ['muy-bien'], ['muy-bien'], ['muy-mal']], ['2026-10-02', ['muy-mal'], ['muy-bien']], ['2026-10-03', [null]], ['2026-09-30', ['neutro']]]);
  const s = D.monthStats(e, '2026-10');
  assert.equal(s.total, 5); assert.equal(s.daysWithMood, 2); assert.equal(s.entryDays, 3);
  assert.deepEqual(plain(s.counts), { 'muy-bien': 3, 'muy-mal': 2 });
  assert.equal(s.days['2026-10-01'].dominant, 'muy-bien');
  assert.equal(s.days['2026-10-02'].dominant, 'muy-bien', 'empate 1-1: gana el de la última entrada');
  assert.equal(s.days['2026-10-03'], undefined);
  assert.equal(s.days['2026-10-01'].percent, 67); assert.equal(s.days['2026-10-02'].percent, 50);
  assert.equal(s.average, 59, 'media de los porcentajes de las páginas: (67 + 50) / 2');
  assert.equal(D.monthStats(e, '2026-08').average, null);
});

test('el reparto sigue el orden de la escala, de "Muy bien" a "Muy mal"', () => {
  const D = load().diary;
  assert.deepEqual(plain(D.moodShares({ 'muy-mal': 2, 'muy-bien': 2, neutro: 5 }, 9).map((s) => s.mood)), ['muy-bien', 'neutro', 'muy-mal']);
  assert.deepEqual(plain(D.moodShares({ x: 1 }, 0)), [{ mood: 'x', count: 1, pct: 0 }]);
  assert.equal(D.moodShares({ 'muy-mal': 1, 'muy-bien': 3 }, 4)[0].pct, 75);
});

test('mes a mes: 12 meses terminando en el indicado, con ceros y con el ánimo medio de cada mes', () => {
  const D = load().diary;
  assert.equal(D.addMonths('2026-01', -1), '2025-12'); assert.equal(D.addMonths('2026-12', 1), '2027-01'); assert.equal(D.addMonths('2026-10', -12), '2025-10');
  const e = moodEntries(D, [['2026-10-01', ['muy-bien']], ['2025-11-05', ['muy-mal'], ['neutro']], ['2025-10-31', ['neutro']]]);
  const t = D.monthlyTrend(e, '2026-10', 12);
  assert.equal(t.length, 12); assert.equal(t[0].key, '2025-11'); assert.equal(t[11].key, '2026-10');
  assert.equal(t[0].total, 2); assert.equal(t[0].average, 25); assert.equal(t[11].average, 100); assert.equal(t[5].total, 0); assert.equal(t[5].average, null);
  assert.ok(!t.some((m) => m.key === '2025-10'), 'fuera de los 12 meses');
});

test('asociaciones etiqueta-ánimo: ánimo medio con esa etiqueta, solo con datos suficientes', () => {
  const D = load().diary;
  const few = moodEntries(D, [['2026-10-01', ['bien', 'paseo'], ['bien', 'paseo']]]);
  const r1 = D.tagAssociations(few, '2026-10', 12);
  assert.equal(r1.total, 2); assert.equal(r1.items.length, 0, 'con pocos datos no se saca ninguna pista');

  const spec = [];
  for (let d = 1; d <= 9; d++) spec.push([`2026-10-${String(d).padStart(2, '0')}`, ['muy-bien', 'paseo'], ['mal', 'trabajo']]);
  spec.push(['2026-10-20', ['neutro', 'paseo']], ['2026-10-21', ['muy-bien', 'rara']]);
  const r = D.tagAssociations(moodEntries(D, spec), '2026-10', 12);
  assert.equal(r.total, 20);
  const paseo = r.items.find((i) => i.tag === 'paseo'), trabajo = r.items.find((i) => i.tag === 'trabajo');
  assert.equal(paseo.total, 10); assert.equal(paseo.average, 95); assert.equal(trabajo.total, 9); assert.equal(trabajo.average, 25);
  assert.equal(paseo.overall, r.overall); assert.equal(r.overall, 64);
  assert.ok(!r.items.some((i) => i.tag === 'rara'), 'una etiqueta con 1 entrada no se muestra');
});

// ---------- Repositorio ----------
test('crear, leer, editar y borrar el día; sobrevive a "cerrar y reabrir"', async () => {
  const fake = createFakeGithub(); const { repo } = makeRepo(fake);
  const saved = await repo.save(entry({ blocks: [block('Uno.', { mood: 'muy-bien', tags: ['a'] }), block('Dos.')] }), { base: null });
  assert.equal(monthDoc(fake, '2026-10').version, 2);
  assert.equal(monthDoc(fake, '2026-10').entries.length, 1);

  const reopened = makeRepo(fake).repo;
  const again = await reopened.get('2026-10-13');
  assert.deepEqual(plain(again.blocks), plain(saved.blocks));
  assert.equal(again.blocks[0].mood, 'muy-bien');

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
  const created = await repo.appendBlock('2026-10-13', { mood: 'mal' });
  assert.equal(created.blocks.length, 1); assert.equal(created.blocks[0].text, ''); assert.equal(created.blocks[0].mood, 'mal');
  const more = await repo.appendBlock('2026-10-13', { text: 'Más tarde.', mood: 'bien', tags: ['paseo'] });
  assert.deepEqual(plain(more.blocks.map((b) => b.mood)), ['mal', 'bien']);
  assert.equal(monthDoc(fake, '2026-10').entries.length, 1);
  await rejectsWith(repo.appendBlock('2026-10-13', { text: '  ' }), 'invalid');
  await rejectsWith(repo.appendBlock('2026-13-40', { mood: 'muy-bien' }), 'invalid');
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
  const r = await repo.appendBlock('2026-10-13', { mood: 'muy-bien' });
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
  await rejectsWith(repo.appendBlock('2026-10-13', { mood: 'muy-bien' }), 'invalid');
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
  assert.equal(drafts.save('2026-10-13', { title: 'Hola', blocks: [{ text: 'A medias', tags: ['a'], mood: 'muy-mal' }, { text: '' }] }), true);
  const d = drafts.get('2026-10-13');
  assert.equal(d.title, 'Hola'); assert.equal(d.blocks.length, 2); assert.equal(d.blocks[0].mood, 'muy-mal'); assert.match(d.blocks[0].id, /^b_[0-9a-f]{8}$/);
  drafts.save('2026-10-12', { blocks: [{ text: 'Ayer' }] });
  assert.equal(drafts.list().length, 2); assert.equal(drafts.list()[0].day, '2026-10-12', 'el más reciente primero');
  drafts.remove('2026-10-13'); assert.equal(drafts.get('2026-10-13'), null);
});

test('un borrador solo con un ánimo cuenta; uno vacío se elimina; las claves inválidas se rechazan', () => {
  const { drafts } = load({ localStorage: memoryStorage() });
  drafts.save('2026-10-13', { blocks: [{ text: '', mood: 'muy-bien' }] });
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


// ---------- Estados de ánimo y porcentaje ----------
test('hay cinco estados con una escala lineal de 0 a 100 y "Neutro" en el centro', () => {
  const D = load().diary;
  assert.deepEqual(plain(D.MOODS.map((m) => [m.id, m.label, m.value])),
    [['muy-bien', 'Muy bien', 100], ['bien', 'Bien', 75], ['neutro', 'Neutro', 50], ['mal', 'Mal', 25], ['muy-mal', 'Muy mal', 0]]);
  assert.equal(D.moodValue('neutro'), 50); assert.equal(D.moodValue('radiante'), null); assert.equal(D.moodValue(null), null);
  assert.equal(D.moodLabel('muy-mal'), 'Muy mal');
});

test('el porcentaje de una página es la media de los estados de sus entradas', () => {
  const D = load().diary;
  const pct = (...moods) => D.dayMood({ blocks: moods.map((m) => ({ mood: m })) }).percent;
  assert.deepEqual([pct('muy-bien'), pct('bien'), pct('neutro'), pct('mal'), pct('muy-mal')], [100, 75, 50, 25, 0]);
  assert.equal(pct('muy-bien', 'muy-mal'), 50);
  assert.equal(pct('muy-bien', 'muy-bien', 'bien'), 92);
  assert.equal(pct('bien', 'neutro'), 63);
  assert.equal(pct('muy-bien', 'bien', 'neutro', 'mal', 'muy-mal'), 50);
});

test('las entradas sin estado no cuentan en la media (no se tratan como neutras)', () => {
  const D = load().diary;
  assert.deepEqual(plain(D.dayMood({ blocks: [{ mood: 'muy-bien' }, { mood: null }, { mood: null, text: 'sin estado' }] })), { percent: 100, rated: 1, total: 3 });
  assert.deepEqual(plain(D.dayMood({ blocks: [{ mood: null }, {}] })), { percent: null, rated: 0, total: 2 }, 'sin ningún estado no hay porcentaje (no un 0 %)');
  assert.deepEqual(plain(D.dayMood({ blocks: [] })), { percent: null, rated: 0, total: 0 });
  assert.equal(D.dayMood({ blocks: [{ mood: 'inventado' }] }).percent, null, 'un estado desconocido no cuenta');
  assert.equal(D.dayMood(null).percent, null);
});

test('una página con estados de la versión anterior usa su nivel convertido', () => {
  const D = load().diary;
  const e = D.sanitizeEntry({ day: '2026-10-13', blocks: [{ text: 'a', mood: 'radiante' }, { text: 'b', mood: 'triste' }] });
  assert.equal(D.dayMood(e).percent, 63);
});

// ---------- Emociones ----------
test('la galería de símbolos: sin repetidos, con nombre y con dibujo', () => {
  const App = load(); const D = App.diary;
  assert.ok(D.EMOTION_SYMBOLS.length >= 20);
  const ids = D.EMOTION_SYMBOLS.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const sym of D.EMOTION_SYMBOLS) {
    assert.ok(sym.label.length > 0, sym.id); assert.equal(D.isSymbol(sym.id), true);
    assert.match(App.icon(sym.id), /<(path|circle)/, `falta el dibujo de ${sym.id}`);
  }
  assert.equal(D.isSymbol('pirata'), false);
});

test('una emoción se valida: nombre, símbolo e identificador', () => {
  const D = load().diary;
  const e = D.sanitizeEmotion({ name: '  Nostalgia  ', symbol: 'moon', futuro: 1 });
  assert.match(e.id, /^em_[0-9a-f]{8}$/); assert.equal(e.name, 'Nostalgia'); assert.equal(e.symbol, 'moon'); assert.equal(e.futuro, 1);
  const bad = (over, re) => assert.throws(() => D.sanitizeEmotion({ name: 'X', symbol: 'moon', ...over }), (err) => { assert.equal(err.code, 'invalid'); assert.match(err.message, re); return true; });
  bad({ name: '   ' }, /nombre/i); bad({ name: 'x'.repeat(31) }, /largo/); bad({ symbol: 'pirata' }, /símbolo/i); bad({ symbol: undefined }, /símbolo/i); bad({ id: 'nope' }, /identificador/i);
  assert.throws(() => D.sanitizeEmotion(null));
  assert.equal(D.sanitizeEmotion({ name: 'a   b', symbol: 'cat' }).name, 'a b');
  assert.equal(D.sanitizeEmotion(JSON.parse('{"name":"x","symbol":"cat","__proto__":{"admin":true}}')).admin, undefined);
  assert.doesNotThrow(() => D.sanitizeEntry({ day: '2026-10-13', blocks: [{ emotions: ['em_0123abcd'] }] }), 'una entrada solo con una emoción es válida');
});

test('crear, listar y editar emociones: se guardan en emotions.json y sobreviven a reabrir', async () => {
  const fake = createFakeGithub(); const { emo } = makeAll(fake);
  assert.deepEqual(plain(await emo.list()), []);
  const nostalgia = await emo.create({ name: 'Nostalgia', symbol: 'moon' });
  await emo.create({ name: 'Ilusión', symbol: 'star' });
  const doc = JSON.parse(fake.state.files.get('emotions.json'));
  assert.equal(doc.version, 1); assert.deepEqual(doc.emotions.map((e) => e.name), ['Nostalgia', 'Ilusión']);

  const reopened = makeAll(fake).emo;
  assert.deepEqual(plain((await reopened.list()).map((e) => e.name)), ['Ilusión', 'Nostalgia'], 'ordenadas por nombre');
  const renamed = await reopened.update(nostalgia.id, { name: 'Añoranza', symbol: 'butterfly' });
  assert.equal(renamed.id, nostalgia.id); assert.equal(renamed.createdAt, nostalgia.createdAt); assert.equal(renamed.symbol, 'butterfly');
  assert.deepEqual(plain((await makeAll(fake).emo.list()).map((e) => [e.name, e.symbol])), [['Añoranza', 'butterfly'], ['Ilusión', 'star']]);
  assert.equal((await reopened.list()).length, 2, 'editar no duplica');
});

test('no se repiten nombres de emociones (sin importar tildes ni mayúsculas) y se rechazan datos inválidos', async () => {
  const fake = createFakeGithub(); const { emo } = makeAll(fake);
  const a = await emo.create({ name: 'Ilusión', symbol: 'star' }); const b = await emo.create({ name: 'Calma', symbol: 'cloud' });
  await rejectsWith(emo.create({ name: 'ILUSION', symbol: 'sun' }), 'invalid');
  await rejectsWith(emo.update(b.id, { name: 'ilusión', symbol: 'cloud' }), 'invalid');
  await emo.update(a.id, { name: 'ilusión', symbol: 'sun' });                       // cambiar solo mayúsculas de la propia es válido
  await rejectsWith(emo.update('em_00000000', { name: 'X', symbol: 'sun' }), 'invalid');
  await rejectsWith(emo.create({ name: '', symbol: 'sun' }), 'invalid');
  await rejectsWith(emo.create({ name: 'Algo', symbol: 'pirata' }), 'invalid');
  assert.equal(JSON.parse(fake.state.files.get('emotions.json')).emotions.length, 2);
});

test('dos dispositivos creando la misma emoción a la vez: solo se crea una', async () => {
  const fake = createFakeGithub(); const A = makeAll(fake).emo, B = makeAll(fake).emo;
  const results = await Promise.allSettled([A.create({ name: 'Nostalgia', symbol: 'moon' }), B.create({ name: 'nostalgia', symbol: 'cat' })]);
  assert.deepEqual(results.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(JSON.parse(fake.state.files.get('emotions.json')).emotions.length, 1);
});

test('un archivo de emociones dañado se avisa y no se toca; lo que no se entiende se conserva', async () => {
  const broken = createFakeGithub({ files: { 'emotions.json': '{"emotions":"mal"}' } });
  await rejectsWith(makeAll(broken).emo.list(), 'invalid');
  await rejectsWith(makeAll(broken).emo.create({ name: 'X', symbol: 'sun' }), 'invalid');
  assert.equal(broken.state.files.get('emotions.json'), '{"emotions":"mal"}');
  const weird = { id: 'raro', cosa: 'de otra versión' };
  const fake = createFakeGithub({ files: { 'emotions.json': JSON.stringify({ version: 1, emotions: [weird] }) } });
  const { emo } = makeAll(fake);
  assert.deepEqual(plain(await emo.list()), []);
  await emo.create({ name: 'Calma', symbol: 'cloud' });
  assert.deepEqual(JSON.parse(fake.state.files.get('emotions.json')).emotions[0], weird);
});

test('hay un máximo de emociones', async () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ id: 'em_' + i.toString(16).padStart(8, '0'), name: 'Emoción ' + i, symbol: 'heart', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' }));
  const fake = createFakeGithub({ files: { 'emotions.json': JSON.stringify({ version: 1, emotions: many }) } });
  await rejectsWith(makeAll(fake).emo.create({ name: 'Una más', symbol: 'sun' }), 'invalid');
});

test('D.emotions() devuelve null sin conexión y reutiliza la biblioteca de la misma conexión', async () => {
  const fake = createFakeGithub(); const App = load({ fetch: fake.fetch, localStorage: memoryStorage() });
  assert.equal(App.diary.emotions(), null);
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const r = App.diary.emotions(); assert.ok(r); assert.equal(App.diary.emotions(), r);
  App.connection.disconnect(); assert.equal(App.diary.emotions(), null);
});

test('estado y emociones se guardan en cada entrada y se recuperan intactos (Bien + Nostalgia e Ilusión)', async () => {
  const fake = createFakeGithub(); const { App, repo, emo } = makeAll(fake); const D = App.diary;
  const nostalgia = await emo.create({ name: 'Nostalgia', symbol: 'moon' }), ilusion = await emo.create({ name: 'Ilusión', symbol: 'star' });
  await repo.save({ day: '2026-10-13', blocks: [{ text: 'Un recuerdo', mood: 'bien', emotions: [nostalgia.id, ilusion.id], tags: ['casa'] }, { text: 'Otro', mood: 'mal' }] }, { base: null });

  const fresh = makeAll(fake);                                       // una sesión nueva, sin caché
  const day = await fresh.repo.get('2026-10-13');
  assert.equal(day.blocks[0].mood, 'bien'); assert.deepEqual(plain(day.blocks[0].emotions), [nostalgia.id, ilusion.id]);
  assert.equal(day.blocks[1].mood, 'mal'); assert.deepEqual(plain(day.blocks[1].emotions), []);
  const names = D.emotionMap(await fresh.emo.list());
  assert.deepEqual(plain(day.blocks[0].emotions.map((id) => names[id].name)), ['Nostalgia', 'Ilusión']);
  assert.equal(D.dayMood(day).percent, 50);                          // (75 + 25) / 2
});

test('modificar las emociones nunca cambia el porcentaje de ánimo ni toca las páginas', async () => {
  const fake = createFakeGithub(); const { App, repo, emo } = makeAll(fake); const D = App.diary;
  const n = await emo.create({ name: 'Nostalgia', symbol: 'moon' }), i = await emo.create({ name: 'Ilusión', symbol: 'star' });
  const saved = await repo.save({ day: '2026-10-13', blocks: [{ text: 'A', mood: 'muy-bien', emotions: [n.id] }, { text: 'B', mood: 'mal', emotions: [i.id] }, { text: 'C' }] }, { base: null });
  const before = D.dayMood(saved).percent;
  assert.equal(before, 63);                                           // (100 + 25) / 2; la entrada sin estado no cuenta
  const fileBefore = fake.state.files.get('entries/2026-10.json');

  await emo.update(n.id, { name: 'Añoranza', symbol: 'butterfly' });
  await emo.create({ name: 'Calma', symbol: 'cloud' });
  await emo.update(i.id, { name: 'Esperanza', symbol: 'sun' });
  assert.equal(fake.state.files.get('entries/2026-10.json'), fileBefore, 'editar emociones no toca ni un byte de las páginas');
  const again = await makeAll(fake).repo.get('2026-10-13');
  assert.equal(D.dayMood(again).percent, before);

  const without = await repo.save({ ...again, blocks: again.blocks.map((b) => ({ ...b, emotions: [] })) }, { base: again.updatedAt });
  assert.equal(D.dayMood(without).percent, before, 'quitar todas las emociones tampoco lo cambia');
  const withAll = await repo.save({ ...without, blocks: without.blocks.map((b) => ({ ...b, emotions: [n.id, i.id] })) }, { base: without.updatedAt });
  assert.equal(D.dayMood(withAll).percent, before, 'ponerlas todas tampoco');
  const onlyEmotion = await repo.save({ ...withAll, blocks: withAll.blocks.concat([{ text: '', emotions: [n.id] }]) }, { base: withAll.updatedAt });
  assert.deepEqual(plain(D.dayMood(onlyEmotion)), { percent: before, rated: 2, total: 4 }, 'una entrada solo con emociones no entra en la media');
  const stats = D.monthStats(await repo.list(), '2026-10');
  assert.equal(stats.average, before); assert.equal(stats.total, 2);
});

test('la copia de seguridad incluye las emociones y el estado de cada entrada', async () => {
  const fake = createFakeGithub(); const { repo, emo, store } = makeAll(fake);
  const e = await emo.create({ name: 'Calma', symbol: 'cloud' });
  await repo.save({ day: '2026-10-13', blocks: [{ text: 'Hola', mood: 'bien', emotions: [e.id] }] }, { base: null });
  const bundle = await store.exportBundle();
  assert.ok(bundle.files['emotions.json']); assert.equal(bundle.files['emotions.json'].emotions[0].name, 'Calma');
  assert.equal(bundle.files['entries/2026-10.json'].entries[0].blocks[0].emotions[0], e.id);
  assert.equal(bundle.files['entries/2026-10.json'].entries[0].blocks[0].mood, 'bien');
});

test('el estado antiguo guardado en GitHub se ve convertido y se conserva el original al guardar', async () => {
  const old = { day: '2026-10-13', title: '', favorite: false, createdAt: '2026-10-13T08:00:00.000Z', updatedAt: '2026-10-13T08:00:00.000Z', blocks: [{ id: 'b_00000001', text: 'Antes', tags: [], mood: 'ansiosa' }] };
  const fake = createFakeGithub({ files: { 'entries/2026-10.json': JSON.stringify({ month: '2026-10', version: 2, entries: [old] }) } });
  const { repo, App } = makeAll(fake);
  const day = await repo.get('2026-10-13');
  assert.equal(day.blocks[0].mood, 'mal'); assert.equal(day.blocks[0].legacyMood, 'ansiosa'); assert.equal(App.diary.dayMood(day).percent, 25);
  assert.equal(JSON.parse(fake.state.files.get('entries/2026-10.json')).entries[0].blocks[0].mood, 'ansiosa', 'leer no modifica lo guardado');
  await repo.save({ ...day, title: 'Editado' }, { base: day.updatedAt });
  const stored = JSON.parse(fake.state.files.get('entries/2026-10.json')).entries[0].blocks[0];
  assert.equal(stored.mood, 'mal'); assert.equal(stored.legacyMood, 'ansiosa');
});

test('los borradores conservan las emociones de cada entrada', () => {
  const { drafts } = load({ localStorage: memoryStorage() });
  drafts.save('2026-10-13', { blocks: [{ text: 'x', emotions: ['em_0123abcd', 'malo', 'em_0123abcd'] }, { text: '', emotions: ['em_ffffffff'] }] });
  const d = drafts.get('2026-10-13');
  assert.deepEqual(plain(d.blocks[0].emotions), ['em_0123abcd']); assert.deepEqual(plain(d.blocks[1].emotions), ['em_ffffffff']);
  assert.equal(drafts.list().length, 1);
});
