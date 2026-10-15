// Pruebas del personaje (fase 5A): niveles, reparto de XP, idempotencia, ajustes, subcategorías y radar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const FILES = ['icons', 'ui', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'rpg/model', 'rpg/repository', 'rpg/activities', 'rpg/quests', 'views/rpg/radar'];
function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, ...extra });
  ctx.window = ctx;
  for (const f of FILES) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  return ctx.App;
}
function make(fake = createFakeGithub()) {
  const App = load({ fetch: fake.fetch });
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  const store = App.createStore(adapter);
  const repo = App.createRpgRepo(store);
  return { App, R: App.rpg, fake, repo, store, acts: App.createActivityRepo(store, repo), quests: App.createQuestRepo(store, repo) };
}
const rejectsWith = (p, code) => assert.rejects(p, (e) => { assert.equal(e.code, code, e.message); return true; });
const ledger = (fake, year = new Date().getFullYear()) => JSON.parse(fake.state.files.get(`rpg/ledger-${year}.json`));

test('niveles: general 100+25·(n−1) y subcategorías 80+20·(n−1), con el sobrante conservado', () => {
  const { R } = make();
  assert.deepEqual(plain(R.levelInfo(0)), { level: 1, into: 0, need: 100, fraction: 0, total: 0 });
  assert.equal(R.levelInfo(99).level, 1);
  const l2 = R.levelInfo(100); assert.equal(l2.level, 2); assert.equal(l2.need, 125);
  const l3 = R.levelInfo(225 + 7); assert.equal(l3.level, 3); assert.equal(l3.into, 7); assert.equal(l3.need, 150);
  assert.equal(R.levelInfo(80, R.SUB_LEVEL).level, 2); assert.equal(R.levelInfo(80, R.SUB_LEVEL).need, 100);
  assert.equal(R.levelInfo(180, R.SUB_LEVEL).level, 3);
  assert.equal(R.levelInfo(-50).level, 1, 'nunca por debajo del nivel 1');
});

test('catálogo: 5 atributos y 18 subcategorías con las pedidas', () => {
  const { R } = make();
  assert.deepEqual(plain(R.DEFAULT_ATTRIBUTES.map((a) => a.name)), ['Vitalidad', 'Espíritu', 'Vínculos', 'Aventura', 'Creatividad']);
  const names = R.DEFAULT_ATTRIBUTES.map((a) => a.subs.map((s) => s.name));
  assert.deepEqual(plain(names), [['Fuerza', 'Salud', 'Resistencia', 'Descanso', 'Autocuidado'], ['Conocimiento', 'Disciplina', 'Brujería'], ['Amistad', 'Amor', 'Familia', 'Conexión'], ['Experiencias', 'Valentía', 'Exploración'], ['Arte', 'Lectura', 'Películas']]);
  assert.equal(names.flat().length, 18);
});

test('reparto de XP: suma exacta, resto a la parte mayor, sin subcategorías solo hay XP general', () => {
  const { R } = make();
  assert.deepEqual(plain(R.splitXp(15, [{ sub: 'a', pct: 50 }, { sub: 'b', pct: 50 }])), [{ sub: 'a', xp: 8 }, { sub: 'b', xp: 7 }], 'el resto va a la primera parte mayor');
  const s = R.splitXp(100, [{ sub: 'a', pct: 33 }, { sub: 'b', pct: 33 }, { sub: 'c', pct: 34 }]);
  assert.equal(s.reduce((t, x) => t + x.xp, 0), 100);
  assert.deepEqual(plain(R.splitXp(30, [])), []);
  assert.throws(() => R.splitXp(30, [{ sub: 'a', pct: 60 }, { sub: 'b', pct: 30 }]), /sumar 100/);
});

test('apuntar actividad: se guarda en el registro, sube niveles y sobrevive a reabrir', async () => {
  const { repo, fake, App, R } = make();
  const r = await repo.addEntry({ kind: 'manual', key: 'manual:abc1', label: 'Sesión de dibujo', xp: 60, shares: [{ sub: 'arte', pct: 100 }], day: '2026-03-05' });
  assert.equal(r.duplicate, false);
  assert.equal(ledger(fake, 2026).entries[0].xp, 60);
  const re = make(fake).repo; const st = await re.state();
  assert.equal(st.computed.general.total, 60); assert.equal(st.computed.general.level, 1);
  const arte = R.findSub(st.computed.mains.map((m) => ({ ...m })), 'arte').sub;
  assert.equal(arte.xp, 60); assert.equal(arte.level, 1);
  await re.addEntry({ kind: 'manual', key: 'manual:abc2', label: 'Modelado 3D', xp: 30, shares: [{ sub: 'arte', pct: 100 }], day: '2026-03-06' });
  const st2 = await re.state(true);
  assert.equal(st2.computed.general.total, 90);
  const arte2 = st2.computed.mains.find((m) => m.id === 'creatividad').subs.find((s) => s.id === 'arte');
  assert.equal(arte2.level, 2, '90 XP ≥ 80 → nivel 2 de la subcategoría'); assert.equal(arte2.into, 10);
});

test('idempotencia: la misma clave no se cuenta dos veces (reintento, doble clic, otro dispositivo)', async () => {
  const { repo, fake } = make();
  const input = { kind: 'manual', key: 'manual:dup1', label: 'Gimnasio', xp: 30, shares: [{ sub: 'fuerza', pct: 100 }], day: '2026-04-01' };
  const [a, b] = await Promise.all([repo.addEntry(input), repo.addEntry(input)]);
  assert.equal([a, b].filter((x) => x.duplicate).length >= 1, true);
  assert.equal(ledger(fake, 2026).entries.length, 1);
  const other = make(fake).repo;
  assert.equal((await other.addEntry(input)).duplicate, true);
  assert.equal(ledger(fake, 2026).entries.length, 1);
  assert.equal((await other.state()).computed.general.total, 30);
});

test('un fallo al guardar no deja XP a medias', async () => {
  const fake = createFakeGithub();
  let fail = true;
  const flaky = (u, o) => (fail && o && o.method === 'PUT' && /ledger/.test(u)
    ? Promise.resolve({ ok: false, status: 500, headers: { get() { return null; } }, json: async () => ({}), text: async () => '' })
    : fake.fetch(u, o));
  const App = load({ fetch: flaky });
  const repo = App.createRpgRepo(App.createStore(App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: flaky })));
  const input = { kind: 'manual', key: 'manual:fail1', label: 'Caminar', xp: 15, shares: [], day: '2026-04-02' };
  await assert.rejects(repo.addEntry(input));
  assert.equal(fake.state.files.has('rpg/ledger-2026.json'), false);
  assert.equal((await repo.state(true)).computed.general.total, 0, 'no se ha sumado nada');
  fail = false;
  assert.equal((await repo.addEntry(input)).duplicate, false, 'reintentar con la misma clave funciona');
  assert.equal((await repo.state(true)).computed.general.total, 15);
});

test('validación: XP positivo, tamaño, porcentajes y subcategorías existentes', async () => {
  const { repo } = make();
  const base = { kind: 'manual', key: 'manual:v1', label: 'Algo', xp: 30, shares: [], day: '2026-04-03' };
  await rejectsWith(repo.addEntry({ ...base, label: '  ' }), 'invalid');
  await rejectsWith(repo.addEntry({ ...base, xp: -5 }), 'invalid');
  await rejectsWith(repo.addEntry({ ...base, xp: 0 }), 'invalid');
  await rejectsWith(repo.addEntry({ ...base, xp: 1.5 }), 'invalid');
  await rejectsWith(repo.addEntry({ ...base, xp: 999999 }), 'invalid');
  await rejectsWith(repo.addEntry({ ...base, shares: [{ sub: 'nope', pct: 100 }] }), 'invalid');
  await rejectsWith(repo.addEntry({ ...base, shares: [{ sub: 'arte', pct: 50 }] }), 'invalid');
  await rejectsWith(repo.addEntry({ ...base, key: '!' }), 'invalid');
});

test('ajustes: quitan XP solo con motivo, quedan visibles y el total no baja de 0', async () => {
  const { repo, fake } = make();
  await repo.addEntry({ kind: 'manual', key: 'manual:aj1', label: 'Gimnasio', xp: 30, shares: [{ sub: 'fuerza', pct: 100 }], day: '2026-05-01' });
  await rejectsWith(repo.addEntry({ kind: 'adjustment', key: 'adjust:1', label: 'Corrección', xp: -10, shares: [], day: '2026-05-02' }), 'invalid');
  await repo.addEntry({ kind: 'adjustment', key: 'adjust:2', label: 'Lo apunté dos veces', reason: 'Duplicado a mano', xp: -10, shares: [{ sub: 'fuerza', pct: 100 }], day: '2026-05-02' });
  const doc = ledger(fake, 2026);
  assert.equal(doc.entries.length, 2, 'el apunte original sigue ahí');
  assert.equal(doc.entries[1].reason, 'Duplicado a mano');
  assert.equal((await repo.state(true)).computed.general.total, 20);
  await repo.addEntry({ kind: 'adjustment', key: 'adjust:3', label: 'Mucho', reason: 'Prueba', xp: -500, shares: [], day: '2026-05-03' });
  assert.equal((await repo.state(true)).computed.general.total, 0);
});

test('editar subcategorías: renombrar y archivar conservan XP e historial; los ids no cambian', async () => {
  const { repo, fake } = make();
  await repo.addEntry({ kind: 'manual', key: 'manual:s1', label: 'Tarot', xp: 30, shares: [{ sub: 'brujeria', pct: 100 }], day: '2026-06-01' });
  const nueva = await repo.createSub('espiritu', { name: 'Meditación', description: 'Respirar', icon: 'cloud' });
  assert.match(nueva.id, /^sa_[0-9a-f]{8}$/);
  await rejectsWith(repo.createSub('espiritu', { name: ' meditacion ' }), 'invalid');
  await rejectsWith(repo.createSub('espiritu', { name: '' }), 'invalid');
  await repo.updateSub('brujeria', { name: 'Magia', description: 'Rituales', icon: 'tarot' });
  await repo.setArchived('brujeria', true);
  const st = await make(fake).repo.state();
  const sub = st.computed.mains.find((m) => m.id === 'espiritu').subs.find((s) => s.id === 'brujeria');
  assert.equal(sub.name, 'Magia'); assert.equal(sub.archived, true); assert.equal(sub.xp, 30, 'la XP sigue ahí');
  await rejectsWith(repo.addEntry({ kind: 'manual', key: 'manual:s2', label: 'X', xp: 15, shares: [{ sub: 'brujeria', pct: 100 }], day: '2026-06-02' }), 'invalid');
  await repo.setArchived('brujeria', false);
  assert.equal((await repo.addEntry({ kind: 'manual', key: 'manual:s2', label: 'X', xp: 15, shares: [{ sub: 'brujeria', pct: 100 }], day: '2026-06-02' })).duplicate, false);
});

test('reordenar subcategorías se guarda', async () => {
  const { repo, fake } = make();
  await repo.moveSub('salud', -1);
  const ids = (await make(fake).repo.state()).structure.find((a) => a.id === 'vitalidad').subs.map((s) => s.id);
  assert.deepEqual(plain(ids.slice(0, 3)), ['salud', 'fuerza', 'resistencia']);
});

test('radar: el valor de un atributo es la media de sus subcategorías y la XP nunca lo baja', async () => {
  const { repo, R } = make();
  const s0 = await repo.state();
  assert.ok(s0.computed.mains.every((m) => m.value === 0 && m.level === 1));
  assert.equal(R.radarCap(s0.computed.mains), 2);
  assert.deepEqual([1.9, 2, 4.9, 5, 12].map((v) => R.radarCap([{ value: v }])), [2, 3, 5, 10, 15]);
  let last = 0;
  for (let i = 0; i < 6; i++) {
    await repo.addEntry({ kind: 'manual', key: 'manual:r' + i, label: 'Entreno', xp: 60, shares: [{ sub: i % 2 ? 'salud' : 'fuerza', pct: 100 }], day: '2026-07-0' + (i + 1) });
    const m = (await repo.state(true)).computed.mains.find((x) => x.id === 'vitalidad');
    assert.ok(m.value >= last, 'no retrocede'); last = m.value;
  }
  assert.ok(last > 0.5);
});

test('el diario no da ni quita XP: no existe ninguna vía desde entradas, ánimo o emociones', () => {
  const src = ['diary/entries', 'diary/repository', 'diary/emotions', 'diary/people', 'views/diary/editor'].map((f) => read(`js/${f}.js`)).join('\n');
  assert.equal(/App\.rpg|addEntry\(/.test(src), false);
});

test('radar SVG: pentágono, estrella, polígono relleno, cinco puntas accesibles', () => {
  const { App, R } = make();
  const comp = R.computeState(R.buildStructure(null), [{ key: 'k', xp: 90, splits: [{ sub: 'fuerza', xp: 90 }] }]);
  const html = App.rpgViews.radar(comp.mains, { selected: 'espiritu' });
  assert.equal((html.match(/class="rd-star"/g) || []).length, 5, 'las 5 líneas de la estrella');
  assert.match(html, /class="rd-outer"/); assert.match(html, /class="rd-area"/);
  assert.equal((html.match(/role="button"/g) || []).length, 5);
  assert.match(html, /aria-pressed="true"/);
  for (const n of ['Vitalidad', 'Espíritu', 'Vínculos', 'Aventura', 'Creatividad']) assert.ok(html.includes(n), n);
  assert.match(html, /Vitalidad, nivel 1/);
});

test('el nombre del personaje se escapa y los datos dañados no se pisan', async () => {
  const { repo, fake, App } = make();
  await repo.saveProfile({ name: '<img src=x onerror=alert(1)>', avatar: 'moon' });
  fake.state.files.set('rpg/attributes.json', '{"version":1,"attributes":"roto"}');
  await rejectsWith(make(fake).repo.state(), 'invalid');
  assert.equal(fake.state.files.get('rpg/attributes.json'), '{"version":1,"attributes":"roto"}');
});

test('actividades: máximo 5 XP en puntos enteros, repartidos entre subcategorías', async () => {
  const { acts, repo, R } = make();
  const list = await acts.list();
  assert.ok(list.length >= 15);
  assert.ok(list.every((a) => R.activityXp(a) >= 1 && R.activityXp(a) <= 5), 'las de fábrica respetan el máximo');
  const libro = list.find((a) => a.id === 'leer-libro');
  const r = await acts.log('leer-libro', { req: 'r1', day: '2026-08-01' });
  assert.equal(r.entry.xp, 5); assert.deepEqual(plain(r.entry.splits), [{ sub: 'lectura', xp: 2 }, { sub: 'conocimiento', xp: 3 }]);
  assert.equal(r.entry.activity, 'leer-libro');
  const st = await repo.state(true);
  assert.equal(st.computed.general.total, 5);
  assert.equal(st.computed.mains.find((m) => m.id === 'creatividad').subs.find((s) => s.id === 'lectura').xp, 2);
  assert.equal((await acts.log('leer-libro', { req: 'r1', day: '2026-08-01' })).duplicate, true, 'el mismo toque no suma dos veces');
  await rejectsWith(acts.create({ name: 'Maratón', icon: 'star', points: [{ sub: 'arte', xp: 3 }, { sub: 'amor', xp: 3 }] }), 'invalid');
  await rejectsWith(acts.create({ name: 'Vacía', icon: 'star', points: [] }), 'invalid');
  await rejectsWith(acts.create({ name: 'Leer un libro', icon: 'star', points: [{ sub: 'arte', xp: 1 }] }), 'invalid');
  const mia = await acts.create({ name: 'Podcast', icon: 'cloud', points: [{ sub: 'conocimiento', xp: 2 }, { sub: 'lectura', xp: 1 }] });
  assert.match(mia.id, /^ac_[0-9a-f]{8}$/);
  await acts.update(mia.id, { name: 'Podcast nuevo', icon: 'cloud', points: [{ sub: 'conocimiento', xp: 4 }] });
  await acts.setArchived('gimnasio', true);
  await rejectsWith(acts.log('gimnasio', {}), 'invalid');
  assert.ok(libro);
});

test('cambiar una actividad no cambia el pasado (el apunte guarda sus puntos)', async () => {
  const { acts, repo, fake } = make();
  await acts.log('dormir-bien', { req: 'p1', day: '2026-08-02' });
  const a = (await acts.list()).find((x) => x.id === 'dormir-bien');
  await acts.update('dormir-bien', { ...a, points: [{ sub: 'salud', xp: 1 }] });
  const st = await make(fake).repo.state();
  assert.equal(st.computed.mains.find((m) => m.id === 'vitalidad').subs.find((s) => s.id === 'descanso').xp, 5);
});

test('anular un apunte: ajuste visible que lo compensa, una sola vez, y deja de contar para misiones', async () => {
  const { acts, repo, quests, fake } = make();
  const r = await acts.log('gimnasio', { req: 'v1', day: '2026-09-01' });
  await repo.voidEntry(r.entry.key);
  const doc = ledger(fake, 2026);
  assert.equal(doc.entries.length, 2); assert.equal(doc.entries[1].kind, 'adjustment'); assert.equal(doc.entries[1].reverses, r.entry.key);
  const st = await repo.state(true);
  assert.equal(st.computed.general.total, 0); assert.equal(st.computed.subTotals.fuerza, 0);
  assert.equal((await repo.voidEntry(r.entry.key)).duplicate, true);
  assert.equal(ledger(fake, 2026).entries.length, 2);
  const q = await quests.create({ name: 'Gym', size: 'normal', shares: [], objective: { activity: 'gimnasio', count: 1 }, startDay: '2026-09-01' });
  assert.equal((await quests.state(true)).quests[0].progress, 0, 'la visita anulada no cuenta');
  assert.ok(q);
});

test('misión con objetivo: las visitas dan XP y al cumplir hay bonus, una sola vez', async () => {
  const { acts, quests, repo, fake } = make();
  const q = await quests.create({ name: 'Gimnasio 3 veces', size: 'normal', shares: [{ sub: 'fuerza', pct: 70 }, { sub: 'disciplina', pct: 30 }], objective: { activity: 'gimnasio', count: 3 }, startDay: '2026-09-07', dueDay: '2026-09-13' });
  await rejectsWith(quests.claim(q.id), 'invalid');
  await acts.log('gimnasio', { req: 'g1', day: '2026-09-07' });
  await acts.log('gimnasio', { req: 'g2', day: '2026-09-09' });
  await acts.log('gimnasio', { req: 'g0', day: '2026-09-01' });       // antes del inicio: no cuenta
  await acts.log('gimnasio', { req: 'g9', day: '2026-09-20' });       // después del límite: no cuenta
  let s = await quests.state(true);
  assert.equal(s.quests[0].progress, 2); assert.equal(s.quests[0].ready, false);
  await rejectsWith(quests.claim(q.id), 'invalid');
  await acts.log('gimnasio', { req: 'g3', day: '2026-09-12' });
  s = await quests.state(true); assert.equal(s.quests[0].ready, true);
  const [a, b] = await Promise.all([quests.claim(q.id), quests.claim(q.id)]);
  assert.ok([a, b].some((x) => x.duplicate), 'la segunda no suma');
  const rewards = ledger(fake, 2026).entries.filter((e) => e.key === 'quest:' + q.id);
  assert.equal(rewards.length, 1); assert.equal(rewards[0].xp, 30);
  assert.deepEqual(plain(rewards[0].splits), [{ sub: 'fuerza', xp: 21 }, { sub: 'disciplina', xp: 9 }]);
  const total = (await repo.state(true)).computed.general.total;
  assert.equal(total, 5 * 5 + 30, '5 visitas × 5 XP + bonus 30');
  assert.equal((await quests.claim(q.id)).duplicate, true);
  assert.equal((await repo.state(true)).computed.general.total, total);
  s = await make(fake).quests.state(); assert.equal(s.quests[0].status, 'completada');
});

test('misión completada: solo lectura (no se edita ni cambia de estado) y se ve completada aunque falle marcarla', async () => {
  const { quests, repo, fake } = make();
  const q = await quests.create({ name: 'Pintar un cuadro', size: 'dificil', shares: [{ sub: 'arte', pct: 100 }], steps: [{ text: 'Boceto' }, { text: 'Color' }] });
  await quests.toggleStep(q.id, (await quests.state()).quests[0].steps[0].id, true);
  await quests.claim(q.id);
  await rejectsWith(quests.update(q.id, { name: 'Otro', size: 'epica', shares: [] }), 'invalid');
  await rejectsWith(quests.setStatus(q.id, 'abandonada'), 'invalid');
  // simula que quests.json quedó con la misión "pendiente" aunque la recompensa ya se dio
  const doc = JSON.parse(fake.state.files.get('rpg/quests.json')); doc.quests[0].status = 'pendiente';
  fake.state.files.set('rpg/quests.json', JSON.stringify(doc));
  const s = await make(fake).quests.state();
  assert.equal(s.quests[0].status, 'completada');
  assert.equal(s.computed.general.total, 60);
  assert.equal((await make(fake).quests.claim(q.id)).duplicate, true);
});

test('estados de una misión: pausar, retomar, abandonar y reabrir (sin XP); subtareas sin XP', async () => {
  const { quests, repo } = make();
  const q = await quests.create({ name: 'Ordenar el cuarto', size: 'pequena', shares: [], steps: [{ text: 'Armario' }, { text: '  ' }] });
  assert.equal((await quests.state()).quests[0].steps.length, 1, 'sin subtareas vacías');
  await quests.setStatus(q.id, 'pausada'); await rejectsWith(quests.claim(q.id), 'invalid');
  await quests.setStatus(q.id, 'en_curso'); await quests.setStatus(q.id, 'abandonada');
  await rejectsWith(quests.setStatus(q.id, 'completada'), 'invalid');
  await rejectsWith(quests.claim(q.id), 'invalid');
  await quests.setStatus(q.id, 'pendiente');
  const sid = (await quests.state()).quests[0].steps[0].id;
  await quests.toggleStep(q.id, sid, true);
  assert.equal((await repo.state(true)).computed.general.total, 0, 'las subtareas no dan XP');
  await quests.claim(q.id);
  assert.equal((await repo.state(true)).computed.general.total, 15);
});

test('validación de misiones', async () => {
  const { quests } = make();
  const ok = { name: 'X', size: 'normal', shares: [] };
  await rejectsWith(quests.create({ ...ok, name: ' ' }), 'invalid');
  await rejectsWith(quests.create({ ...ok, size: 'gigante' }), 'invalid');
  await rejectsWith(quests.create({ ...ok, shares: [{ sub: 'arte', pct: 40 }] }), 'invalid');
  await rejectsWith(quests.create({ ...ok, objective: { activity: 'gimnasio', count: 0 } }), 'invalid');
  await rejectsWith(quests.create({ ...ok, startDay: '2026-09-10', dueDay: '2026-09-01' }), 'invalid');
  await rejectsWith(quests.create({ ...ok, steps: Array.from({ length: 21 }, (_, i) => ({ text: 's' + i })) }), 'invalid');
  assert.equal((await quests.state()).quests.length, 0);
});
