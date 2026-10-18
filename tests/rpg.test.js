// Pruebas del personaje (fase 5A): niveles, reparto de XP, idempotencia, ajustes, subcategorías y radar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const FILES = ['icons', 'ui', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'rpg/model', 'rpg/repository', 'rpg/activities', 'rpg/weekly', 'rpg/bosses', 'views/rpg/radar'];
function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL, ...extra });
  ctx.window = ctx;
  for (const f of FILES) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  return ctx.App;
}
function make(fake = createFakeGithub()) {
  const App = load({ fetch: fake.fetch });
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  const store = App.createStore(adapter);
  const repo = App.createRpgRepo(store);
  return { App, R: App.rpg, fake, repo, store, acts: App.createActivityRepo(store, repo), weekly: App.createWeeklyRepo(store, repo), bosses: App.createBossRepo(store, repo) };
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
  assert.equal((html.match(/data-main=/g) || []).length, 5);
  const subs = App.rpgViews.radar(comp.mains[1].subs.map((s) => ({ id: s.id, name: s.name, level: s.level, fraction: s.fraction, value: s.progress, magic: s.id === 'brujeria' })), { kind: 'sub', selected: 'brujeria' });
  assert.equal((subs.match(/role="button"/g) || []).length, 3, 'tres subcategorías de Espíritu');
  assert.match(subs, /data-sub="brujeria"/); assert.match(subs, /rd-label on magic/); assert.doesNotMatch(subs, /class="rd-star"/, 'con 3 ejes no hay diagonales');
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

test('actividades: todas dan exactamente 5 XP, repartidos en puntos enteros', async () => {
  const { acts, repo, R } = make();
  const list = await acts.list();
  assert.ok(list.length >= 15);
  assert.ok(list.every((a) => R.activityXp(a) === 5), 'las de fábrica dan 5');
  const r = await acts.log('leer-libro', { req: 'r1', day: '2026-08-01' });
  assert.equal(r.entry.xp, 5); assert.deepEqual(plain(r.entry.splits), [{ sub: 'lectura', xp: 2 }, { sub: 'conocimiento', xp: 3 }]);
  assert.equal((await repo.state(true)).computed.general.total, 5);
  assert.equal((await acts.log('leer-libro', { req: 'r1', day: '2026-08-01' })).duplicate, true, 'el mismo toque no suma dos veces');
  await rejectsWith(acts.create({ name: 'Maratón', icon: 'star', points: [{ sub: 'arte', xp: 3 }, { sub: 'amor', xp: 3 }] }), 'invalid');
  await rejectsWith(acts.create({ name: 'Corta', icon: 'star', points: [{ sub: 'arte', xp: 4 }] }), 'invalid');
  await rejectsWith(acts.create({ name: 'Vacía', icon: 'star', points: [] }), 'invalid');
  await rejectsWith(acts.create({ name: 'Leer un libro', icon: 'star', points: [{ sub: 'arte', xp: 5 }] }), 'invalid');
  const mia = await acts.create({ name: 'Podcast', icon: 'cloud', points: [{ sub: 'conocimiento', xp: 2 }, { sub: 'lectura', xp: 3 }] });
  assert.match(mia.id, /^ac_[0-9a-f]{8}$/);
  await acts.setArchived('gimnasio', true);
  await rejectsWith(acts.log('gimnasio', {}), 'invalid');
});

test('actividad puntual: da 5 XP, no se guarda y no cuenta para objetivos', async () => {
  const { acts, repo, fake } = make();
  const r = await acts.logOnce({ name: 'Paseo con Lola', points: [{ sub: 'resistencia', xp: 5 }], req: 'o1', day: '2026-09-01' });
  assert.equal(r.entry.activity, 'puntual'); assert.equal(r.entry.xp, 5);
  assert.equal((await acts.list()).some((a) => a.name === 'Paseo con Lola'), false);
  assert.equal((await repo.state(true)).computed.general.total, 5);
  await rejectsWith(acts.logOnce({ name: 'X', points: [{ sub: 'arte', xp: 2 }], day: '2026-09-01' }), 'invalid');
  assert.equal(fake.state.files.has('rpg/activities.json'), false, 'no se crea ninguna actividad guardada');
});

test('anular un apunte: ajuste visible que lo compensa, una sola vez, y deja de contar', async () => {
  const { acts, repo, fake, R } = make();
  const r = await acts.log('gimnasio', { req: 'v1', day: '2026-09-01' });
  await repo.voidEntry(r.entry.key);
  const doc = ledger(fake, 2026);
  assert.equal(doc.entries.length, 2); assert.equal(doc.entries[1].kind, 'adjustment'); assert.equal(doc.entries[1].reverses, r.entry.key);
  const st = await repo.state(true);
  assert.equal(st.computed.general.total, 0);
  assert.equal((await repo.voidEntry(r.entry.key)).duplicate, true);
  assert.equal(R.activityCount(st.entries, 'gimnasio', '2026-09-01', '2026-09-30'), 0);
});

test('semanas ISO: lunes a domingo, año con semana 53 y cambio de año', () => {
  const { R } = make();
  assert.equal(R.weekKey('2026-10-12'), '2026-W42'); assert.equal(R.weekKey('2026-10-18'), '2026-W42'); assert.equal(R.weekKey('2026-10-19'), '2026-W43');
  assert.equal(R.weekKey('2026-01-01'), '2026-W01'); assert.equal(R.weekKey('2027-01-03'), '2026-W53');
  assert.deepEqual(plain(R.weekRange('2026-W42')), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(plain(R.weekRange('2026-W01')), { from: '2025-12-29', to: '2026-01-04' });
});

const WEEK = '2026-W42', MON = '2026-10-12';
const gymMission = { name: 'Gimnasio 3 veces', size: 'normal', shares: [{ sub: 'fuerza', pct: 70 }, { sub: 'disciplina', pct: 30 }], mode: 'activity', activity: 'gimnasio', target: 3 };

test('semanal ligada a actividad: se completa sola a la tercera visita y da el bonus una sola vez', async () => {
  const { acts, weekly, repo, fake, R } = make();
  const m = await weekly.create(gymMission);
  await acts.log('gimnasio', { req: 'a', day: MON }); await acts.log('gimnasio', { req: 'b', day: '2026-10-14' });
  let ev = await weekly.sync([WEEK]); assert.deepEqual(plain(ev), [], 'con 2 de 3 no se completa');
  await acts.log('gimnasio', { req: 'c', day: '2026-10-16' });
  await acts.log('gimnasio', { req: 'z', day: '2026-10-05' });        // otra semana: no cuenta
  const [e1, e2] = await Promise.all([weekly.sync([WEEK]), weekly.sync([WEEK])]);
  assert.equal(e1.length + e2.length, 1, 'un solo aviso');
  const reward = ledger(fake, 2026).entries.filter((e) => e.key === `weekly:${m.id}:${WEEK}`);
  assert.equal(reward.length, 1); assert.equal(reward[0].xp, 30);
  assert.deepEqual(plain(reward[0].splits), [{ sub: 'fuerza', xp: 21 }, { sub: 'disciplina', xp: 9 }]);
  assert.equal((await repo.state(true)).computed.general.total, 4 * 5 + 30);
  assert.equal((await weekly.sync([WEEK])).length, 0, 'repetir no da más');
  const s = await weekly.state(true, WEEK); assert.equal(s.missions[0].done, true); assert.equal(s.missions[0].weeksDone, 1);
});

test('semanal: una visita anulada no cuenta; y la semana siguiente empieza de cero', async () => {
  const { acts, weekly, repo } = make();
  await weekly.create({ ...gymMission, target: 2 });
  const a = await acts.log('gimnasio', { req: 'a', day: MON }); await acts.log('gimnasio', { req: 'b', day: '2026-10-13' });
  await repo.voidEntry(a.entry.key);
  assert.equal((await weekly.sync([WEEK])).length, 0, 'anulada: 1 de 2');
  const next = await weekly.state(true, '2026-W43'); assert.equal(next.missions[0].count, 0); assert.equal(next.missions[0].done, false);
  await acts.log('gimnasio', { req: 'c', day: '2026-10-14' });
  assert.equal((await weekly.sync([WEEK])).length, 1);
  await acts.log('gimnasio', { req: 'd', day: '2026-10-20' }); await acts.log('gimnasio', { req: 'e', day: '2026-10-21' });
  assert.equal((await weekly.sync(['2026-W43'])).length, 1, 'otra semana, otra recompensa');
});

test('semanal con checks: al marcar la última se completa; completada queda bloqueada', async () => {
  const { weekly, repo, fake } = make();
  const m = await weekly.create({ name: 'Ordenar la casa', size: 'pequena', shares: [], mode: 'checks', target: 3 });
  assert.deepEqual(plain(await weekly.toggleCheck(m.id, 0, true, WEEK)), []);
  await weekly.toggleCheck(m.id, 0, false, WEEK); await weekly.toggleCheck(m.id, 0, true, WEEK); await weekly.toggleCheck(m.id, 1, true, WEEK);
  const ev = await weekly.toggleCheck(m.id, 2, true, WEEK);
  assert.deepEqual(plain(ev), [{ type: 'weekly', label: 'Ordenar la casa', xp: 15 }]);
  await rejectsWith(weekly.toggleCheck(m.id, 2, false, WEEK), 'invalid');
  assert.equal((await repo.state(true)).computed.general.total, 15);
  const one = await weekly.create({ name: 'Llamar al médico', size: 'pequena', shares: [], mode: 'checks', target: 1 });
  assert.equal((await weekly.toggleCheck(one.id, 0, true, WEEK)).length, 1, 'un solo check');
  assert.ok(fake.state.files.has('rpg/weekly.json'));
});

test('semanales: editar/archivar conserva el historial; validación', async () => {
  const { weekly, acts } = make();
  const m = await weekly.create(gymMission);
  await acts.log('gimnasio', { req: 'a', day: MON }); await acts.log('gimnasio', { req: 'b', day: MON }); await acts.log('gimnasio', { req: 'c', day: MON });
  await weekly.sync([WEEK]);
  await weekly.update(m.id, { ...gymMission, name: 'Gym x3', size: 'dificil' });
  assert.equal((await weekly.sync([WEEK])).length, 0, 'editar no vuelve a premiar');
  await weekly.setArchived(m.id, true);
  const ok = { name: 'X', size: 'normal', shares: [], mode: 'checks', target: 2 };
  await rejectsWith(weekly.create({ ...ok, name: ' ' }), 'invalid');
  await rejectsWith(weekly.create({ ...ok, size: 'gigante' }), 'invalid');
  await rejectsWith(weekly.create({ ...ok, mode: 'otro' }), 'invalid');
  await rejectsWith(weekly.create({ ...ok, target: 0 }), 'invalid');
  await rejectsWith(weekly.create({ ...ok, mode: 'activity', activity: 'puntual' }), 'invalid');
  await rejectsWith(weekly.create({ ...ok, shares: [{ sub: 'arte', pct: 40 }] }), 'invalid');
});

const boss = { name: 'El Rey Fantasma', tier: 'jefe', shares: [{ sub: 'disciplina', pct: 100 }], image: { kind: 'art', id: 'fantasma' }, startDay: '2026-10-01',
  steps: [{ text: 'Ordenar el armario' }, { text: 'Entrenar 2 veces', activity: 'gimnasio', count: 2 }] };

test('jefe: pasos dan 5 XP, la derrota da la XP grande, todo una sola vez', async () => {
  const { bosses, acts, repo, R } = make();
  const b = await bosses.create(boss);
  assert.match(b.id, /^bo_[0-9a-f]{8}$/);
  const step0 = (await bosses.state()).bosses[0].steps[0];
  let ev = await bosses.completeStep(b.id, step0.id);
  assert.deepEqual(plain(ev), [{ type: 'step', label: 'Ordenar el armario', xp: 5, boss: 'El Rey Fantasma' }]);
  assert.equal((await bosses.completeStep(b.id, step0.id)).length, 0, 'el mismo paso no se repite');
  await acts.log('gimnasio', { req: 'a', day: '2026-10-05' });
  assert.equal((await bosses.sync()).length, 0);
  await acts.log('gimnasio', { req: 'b', day: '2026-10-06' });
  await acts.log('gimnasio', { req: 'old', day: '2026-09-20' });          // antes del inicio del jefe: no cuenta
  const [e1, e2] = await Promise.all([bosses.sync(), bosses.sync()]);
  const all = e1.concat(e2);
  assert.deepEqual(plain(all.map((e) => e.type)), ['step', 'boss'], 'paso de actividad y derrota, una sola vez');
  assert.equal(all[1].xp, 250);
  const st = await repo.state(true);
  assert.equal(st.computed.general.total, 5 + 3 * 5 + 5 + 250);
  const v = (await bosses.state(true)).bosses[0];
  assert.equal(v.defeated, true); assert.equal(v.doneCount, 2);
  assert.equal((await bosses.sync()).length, 0);
  await rejectsWith(bosses.update(b.id, boss), 'invalid');                  // derrotado: solo lectura
  assert.ok(R.tierXp('final') === 600);
});

test('jefe: pasos ya hechos no se pueden quitar; validación y enlaces de GIF', async () => {
  const { bosses, R } = make();
  const b = await bosses.create(boss);
  const s0 = (await bosses.state()).bosses[0].steps[0];
  await bosses.completeStep(b.id, s0.id);
  await rejectsWith(bosses.update(b.id, { ...boss, steps: [{ text: 'Otro' }] }), 'invalid');
  const b2 = await bosses.update(b.id, { ...boss, name: 'El Rey', steps: [{ id: s0.id, text: 'Ordenar el armario' }, { text: 'Nuevo' }] });
  assert.equal(b2.steps.length, 2);
  await rejectsWith(bosses.create({ ...boss, steps: [] }), 'invalid');
  await rejectsWith(bosses.create({ ...boss, tier: 'dios' }), 'invalid');
  await rejectsWith(bosses.create({ ...boss, image: { kind: 'art', id: 'nope' } }), 'invalid');
  await rejectsWith(bosses.create({ ...boss, image: { kind: 'url', url: 'http://media.giphy.com/a.gif' } }), 'invalid');
  await rejectsWith(bosses.create({ ...boss, image: { kind: 'url', url: 'https://evil.example/a.gif' } }), 'invalid');
  assert.equal(R.gifUrl('https://media.giphy.com/media/abc/giphy.gif'), 'https://media.giphy.com/media/abc/giphy.gif');
  assert.equal(R.gifUrl('https://media1.tenor.com/m/x/y.gif') !== null, true);
  assert.equal(R.gifUrl('https://i.imgur.com/a.gif') !== null, true);
  assert.equal(R.gifUrl('https://giphy.com.evil.com/a.gif'), null);
  const ok = await bosses.create({ ...boss, name: 'Con gif', image: { kind: 'url', url: 'https://media.giphy.com/media/abc/giphy.gif' } });
  assert.equal(ok.image.kind, 'url');
  await rejectsWith(bosses.completeStep(ok.id, ok.steps[1].id), 'invalid');   // el paso de actividad no se marca a mano
});

test('R.syncRewards: tras una actividad avisa de la misión semanal, el paso y la derrota del jefe', async () => {
  const { App, R, weekly, bosses, acts, store } = make();
  App.connection = { getStore: () => store };
  await weekly.create({ ...gymMission, target: 1 });
  await bosses.create({ ...boss, steps: [{ text: 'Entrenar', activity: 'gimnasio', count: 1 }] });
  await acts.log('gimnasio', { req: 'q', day: R.today() });
  const ev = await R.syncRewards(R.today());
  assert.deepEqual(plain(ev.map((e) => e.type)), ['weekly', 'step', 'boss']);
  assert.deepEqual(plain(await R.syncRewards(R.today())), [], 'repetir no avisa de nuevo');
});
