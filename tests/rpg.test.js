// Pruebas del personaje (fase 5A): niveles, reparto de XP, idempotencia, ajustes, subcategorías y radar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const FILES = ['icons', 'ui', 'components', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'rpg/config', 'rpg/model', 'rpg/repository', 'rpg/activities', 'rpg/weekly', 'rpg/bosses', 'rpg/todos', 'rpg/daily', 'rpg/shadows', 'rpg/growth', 'views/rpg/radar'];
function load(extra = {}) {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL, ...extra });
  ctx.window = ctx;
  for (const f of FILES) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  return ctx.App;
}
// Muchas pruebas usan fechas fijas (semanas de octubre de 2026) y jefes que se derrotan al momento: por defecto se
// permite apuntar actividades en cualquier día pasado y los jefes no esperan. Las pruebas de esas reglas usan
// make(fake, { strict: true }), con los valores reales de config.js.
function make(fake = createFakeGithub(), opts = {}) {
  const App = load({ fetch: fake.fetch });
  if (!opts.strict) {
    App.rpg.CONFIG.activity.daysBack = 100000;
    App.rpg.CONFIG.bosses.tiers.forEach((t) => { t.days = 0; });
  }
  const adapter = App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: fake.fetch });
  const store = App.createStore(adapter);
  const repo = App.createRpgRepo(store);
  const acts = App.createActivityRepo(store, repo);
  return { App, R: App.rpg, fake, repo, store, acts, weekly: App.createWeeklyRepo(store, repo), bosses: App.createBossRepo(store, repo), todos: App.createTodoRepo(store, repo), daily: App.createDailyRepo(store, repo), shadows: App.createShadowRepo(store, repo, acts) };
}
const rejectsWith = (p, code) => assert.rejects(p, (e) => { assert.equal(e.code, code, e.message); return true; });
const ledger = (fake, year = new Date().getFullYear()) => JSON.parse(fake.state.files.get(`rpg/ledger-${year}.json`));

test('niveles: general round(55·n^1,2) hasta el 30 (luego, constelaciones); subcategorías ×0,2 y atributos ×0,3', () => {
  const { R } = make();
  assert.deepEqual(plain(R.levelInfo(0)), { level: 1, max: false, stars: 0, into: 0, need: 55, fraction: 0, total: 0, start: 0, next: 55 });
  const l70 = R.levelInfo(70); assert.equal(l70.level, 2); assert.equal(l70.start, 55); assert.equal(l70.next, 181, 'la ficha enseña «70 / 181 XP»');
  assert.equal(R.xpForLevel(1), 0); assert.equal(R.xpForLevel(3), 181); assert.equal(R.xpForLevel(10), 3531); assert.equal(R.xpForLevel(30), 42801);
  assert.equal(R.levelInfo(54).level, 1);
  const l2 = R.levelInfo(55); assert.equal(l2.level, 2); assert.equal(l2.need, 126);
  const l3 = R.levelInfo(181 + 7); assert.equal(l3.level, 3); assert.equal(l3.into, 7);
  assert.equal(R.levelInfo(677).level, 5); assert.equal(R.levelInfo(3531).level, 10); assert.equal(R.levelInfo(3530).level, 9);
  // Nivel máximo 30: lo de después suma una estrella cada 3.000 XP.
  const top = R.levelInfo(42801 + 7000);
  assert.equal(top.level, 30); assert.equal(top.max, true); assert.equal(top.stars, 2); assert.equal(top.into, 1000); assert.equal(top.need, 3000);
  assert.equal(R.levelInfo(42800).max, false);
  assert.equal(R.levelInfo(11, R.SUB_LEVEL).level, 2); assert.equal(R.levelInfo(36, R.SUB_LEVEL).level, 3); assert.equal(R.levelInfo(706, R.SUB_LEVEL).level, 10);
  assert.equal(R.levelInfo(17, R.MAIN_LEVEL).level, 2);
  const m10 = R.xpForLevel(10, R.MAIN_LEVEL);
  assert.ok(m10 > 1000 && m10 < 1100, 'atributo: nivel 10 con unos 1.060 XP'); assert.equal(R.levelInfo(m10, R.MAIN_LEVEL).level, 10); assert.equal(R.levelInfo(m10 - 1, R.MAIN_LEVEL).level, 9);
  assert.equal(R.levelInfo(99999999, R.SUB_LEVEL).max, false, 'las subcategorías y los atributos no tienen tope');
  assert.equal(R.levelInfo(-50).level, 1, 'nunca por debajo del nivel 1');
  // Los valores salen de config.js: cambiarlos allí cambia la curva sin tocar la lógica.
  R.CONFIG.levels.general.base = 100;
  assert.equal(R.levelInfo(0).need, 100);
});

test('atributos: su XP es la suma de sus subcategorías (también archivadas) y crear o archivar no les baja el nivel', () => {
  const { R } = make();
  const st = R.buildStructure(null), e = (sub, xp) => ({ key: 'k' + sub + xp, day: '2026-10-01', xp, splits: [{ sub, xp }] });
  const entries = [e('fuerza', 300), e('salud', 200)];
  const before = R.computeState(st, entries).mains.find((m) => m.id === 'vitalidad');
  assert.equal(before.xp, 500); assert.equal(before.level, R.levelInfo(500, R.MAIN_LEVEL).level);
  // Archivar «salud» y añadir una nueva no cambia nada.
  const st2 = JSON.parse(JSON.stringify(st));
  st2[0].subs.find((s) => s.id === 'salud').archived = true;
  st2[0].subs.push({ id: 'nueva', name: 'Nueva', icon: 'star', description: '', archived: false, order: 9 });
  const after = R.computeState(st2, entries).mains.find((m) => m.id === 'vitalidad');
  assert.equal(after.xp, 500); assert.equal(after.level, before.level); assert.equal(after.value, before.value);
});

test('títulos: ocho, del 1 al 30, cada uno con su forma femenina, masculina y neutra', () => {
  const { R } = make();
  assert.deepEqual(plain(R.TITLES.map((t) => t.level)), [1, 3, 7, 12, 16, 22, 27, 30]);
  assert.ok(R.TITLES.every((t) => t.names.f && t.names.m && t.names.n));
  assert.equal(R.currentTitle(null, 1).name, 'Muñeca inquieta');
  assert.equal(R.currentTitle(null, 6).name, 'Aprendiz de aguja');
  assert.equal(R.currentTitle(null, 7).name, 'Muñeca susurrante', 'sin elegir: el más alto conseguido');
  assert.equal(R.currentTitle('muneca_inquieta', 31).name, 'Muñeca inquieta', 'el elegido, si ya es tuyo');
  assert.equal(R.currentTitle('gran_posesion', 20).name, 'Guardiana del costurero', 'uno sin conseguir no se ve');
  assert.equal(R.nextTitle(9).name, 'Hilandera de lunas'); assert.equal(R.nextTitle(30), null);
  const t = R.TITLES.find((x) => x.id === 'reina_alfileres');
  assert.deepEqual([R.named(t, 'f'), R.named(t, 'm'), R.named(t, 'n'), R.named(t, 'raro')], ['Reina de los alfileres', 'Rey de los alfileres', 'Monarca de los alfileres', 'Reina de los alfileres']);
  assert.equal(R.named(R.TRAITS.find((x) => x.id === 'noctambula'), 'm'), 'Noctámbulo');
});

test('perfil: forma de los textos, fondo y pantalla de subida de nivel se guardan y se conservan al editar', async () => {
  const { repo, fake } = make();
  let p = (await repo.state()).profile;
  assert.equal(p.form, 'f'); assert.equal(p.background, 'papel'); assert.equal(p.levelUpScreen, true);
  await repo.saveProfile({ name: 'Yo', avatar: 'moon', form: 'n', background: 'cielo', levelUpScreen: false });
  await repo.saveProfile({ name: 'Otra', avatar: 'cat' });
  p = (await repo.state(true)).profile;
  assert.equal(p.form, 'n'); assert.equal(p.background, 'cielo'); assert.equal(p.levelUpScreen, false);
  await rejectsWith(repo.saveProfile({ name: 'Yo', avatar: 'moon', form: 'x' }), 'invalid');
  await rejectsWith(repo.saveProfile({ name: 'Yo', avatar: 'moon', background: 'inventado' }), 'invalid');
  assert.equal(JSON.parse(fake.state.files.get('rpg/profile.json')).form, 'n');
});

test('título elegido: se guarda en el perfil, solo si ya lo tienes, y editar el perfil no lo pierde', async () => {
  const { repo, fake } = make();
  await rejectsWith(repo.setTitle('muneca_susurrante'), 'invalid');   // nivel 1: aún no
  for (let i = 1; i <= 4; i++) await repo.addEntry({ kind: 'manual', key: 'manual:t' + i, label: 'Mucho', xp: 5000, day: '2026-10-0' + i });
  assert.ok((await repo.state()).computed.general.level >= 15);
  await repo.setTitle('muneca_inquieta');
  assert.equal(JSON.parse(fake.state.files.get('rpg/profile.json')).title, 'muneca_inquieta');
  await repo.saveProfile({ name: 'Yo', avatar: 'cat' });
  assert.equal((await repo.state()).profile.title, 'muneca_inquieta', 'cambiar nombre o avatar no toca el título');
  await repo.setTitle(null);
  assert.equal('title' in JSON.parse(fake.state.files.get('rpg/profile.json')), false, 'null: vuelve al más alto conseguido');
  await rejectsWith(repo.setTitle('inventado'), 'invalid');
});

test('radar con evolución: hace 30 días y un estado por mes (hasta 12), solo con el registro hasta esa fecha', () => {
  const { R, App } = make();
  const st = R.buildStructure(null);
  const e = (key, day, sub, xp) => ({ key, day, xp, splits: [{ sub, xp }] });
  const entries = [e('a', '2025-08-10', 'fuerza', 80), e('b', '2026-09-05', 'fuerza', 80), e('c', '2026-10-10', 'arte', 160)];
  const h = R.radarHistory(st, entries, '2026-10-18');
  const v = (c, id) => c.mains.find((m) => m.id === id).value;
  assert.equal(v(h.month, 'creatividad'), 0, 'hace 30 días aún no estaba lo de octubre');
  assert.ok(v(h.month, 'vitalidad') > 0);
  assert.equal(h.months.length, 12, 'como mucho los 12 últimos meses'); assert.equal(h.months[11].key, '2026-09'); assert.equal(h.months[0].key, '2025-10');
  assert.ok(v(h.months[11].computed, 'vitalidad') > v(h.months[0].computed, 'vitalidad'), 'crece de un mes a otro');
  assert.equal(R.radarHistory(st, [], '2026-10-18').months.length, 0);
  assert.equal(R.shiftDay('2026-03-01', -1), '2026-02-28');
  const now = R.computeState(st, entries);
  const svg = App.rpgViews.radar(now.mains, { compare: { mode: 'month', shapes: [now.mains.map((m) => v(h.month, m.id))] } });
  assert.equal((svg.match(/class="rd-past"/g) || []).length, 1);
  const rings = App.rpgViews.radar(now.mains, { compare: { mode: 'rings', shapes: h.months.map((m) => now.mains.map((x) => v(m.computed, x.id))) } });
  assert.equal((rings.match(/class="rd-ring-past"/g) || []).length, 12);
});

test('marcos del avatar: uno por tramo de nivel, con el siguiente', () => {
  const { R } = make();
  assert.deepEqual(plain(R.AVATAR_FRAMES.map((f) => f.level)), [1, 2, 5, 9, 14, 18, 25, 30]);
  assert.equal(R.frameFor(1).frame.id, 'puntada'); assert.equal(R.frameFor(1).next.id, 'hilo_suelto');
  assert.equal(R.frameFor(4).frame.id, 'hilo_suelto'); assert.equal(R.frameFor(5).frame.id, 'encaje');
  assert.equal(R.frameFor(17).frame.id, 'encaje_lunar'); assert.equal(R.frameFor(18).frame.id, 'lazo_ciruela');
  assert.equal(R.frameFor(30).frame.id, 'corona_remendada'); assert.equal(R.frameFor(30).next, null);
  assert.equal(R.AVATAR_FRAMES[0].level, 1, 'el primero empieza en el nivel 1');
});

test('perfil: avatar con foto o con GIF; lo que no vale se rechaza y no se guarda', async () => {
  const { repo, fake } = make();
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(400) + '==';
  let p = (await repo.saveProfile({ name: 'Yo', avatar: 'moon', image: { kind: 'photo', data: photo } })).image;
  assert.equal(p.kind, 'photo'); assert.equal(p.data, photo);
  p = (await repo.saveProfile({ name: 'Yo', avatar: 'moon', image: { kind: 'url', url: 'https://media.giphy.com/media/abc/giphy.gif' } })).image;
  assert.equal(p.kind, 'url');
  await rejectsWith(repo.saveProfile({ name: 'Yo', avatar: 'moon', image: { kind: 'url', url: 'https://evil.example/a.gif' } }), 'invalid');
  await rejectsWith(repo.saveProfile({ name: 'Yo', avatar: 'moon', image: { kind: 'photo', data: 'data:text/html;base64,PHNjcmlwdD4=' } }), 'invalid');
  await rejectsWith(repo.saveProfile({ name: 'Yo', avatar: 'moon', image: { kind: 'photo', data: 'data:image/jpeg;base64,' + 'A'.repeat(90000) } }), 'invalid');
  assert.equal(JSON.parse(fake.state.files.get('rpg/profile.json')).image.kind, 'url', 'lo rechazado no ha pisado lo guardado');
  const plainSym = await repo.saveProfile({ name: 'Yo', avatar: 'cat', image: null });
  assert.equal(plainSym.image, null); assert.equal(plainSym.avatar, 'cat');
  assert.equal('image' in JSON.parse(fake.state.files.get('rpg/profile.json')), false);
});

test('avatar: marco según el nivel, imagen escapada y símbolo de respaldo para el GIF', () => {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL });
  ctx.window = ctx;
  for (const f of [...FILES, 'views/rpg/pickers', 'views/rpg/avatar']) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  const V = ctx.App.rpgViews;
  assert.match(V.avatar({ avatar: 'moon' }, 1), /data-frame="puntada"/);
  assert.match(V.avatar({ avatar: 'moon' }, 30), /data-frame="corona_remendada"/);
  const gif = V.avatar({ avatar: 'cat', image: { kind: 'url', url: 'https://i.imgur.com/a.gif?x="><script>' } }, 12);
  assert.ok(!/"><script>/.test(gif)); assert.match(gif, /data-symbol="cat"/); assert.match(gif, /data-frame="puntada_doble"/);
  for (const fr of ctx.App.rpg.AVATAR_FRAMES) assert.match(V.frameSvg(fr.id), /<svg class="fr-deco"/, 'cada marco tiene su dibujo');
});

test('catálogo: 7 atributos y 24 subcategorías con las pedidas', () => {
  const { R } = make();
  assert.deepEqual(plain(R.DEFAULT_ATTRIBUTES.map((a) => a.name)), ['Vitalidad', 'Espíritu', 'Vínculos', 'Aventura', 'Creatividad', 'Inteligencia', 'Yo futuro']);
  const names = R.DEFAULT_ATTRIBUTES.map((a) => a.subs.map((s) => s.name));
  assert.deepEqual(plain(names), [['Fuerza', 'Salud', 'Resistencia', 'Descanso', 'Autocuidado'], ['Conocimiento', 'Disciplina', 'Brujería'], ['Amistad', 'Amor', 'Familia', 'Conexión'], ['Experiencias', 'Valentía', 'Exploración'], ['Arte', 'Lectura', 'Películas'],
    ['Lógica', 'Idioma', 'Comunicación'], ['Finanzas', 'Carrera profesional', 'Objetivos personales']]);
  assert.equal(names.flat().length, 24);
  for (const a of R.DEFAULT_ATTRIBUTES) { assert.ok(R.isIcon(a.icon), a.id); for (const s of a.subs) { assert.ok(R.isIcon(s.icon), s.id); assert.match(s.id, R.SUB_ID_RE); } }
  assert.deepEqual(plain(R.MAIN_IDS), plain(R.DEFAULT_ATTRIBUTES.map((a) => a.id)));
});

test('atributos nuevos: aparecen en datos guardados antes, sin tocar lo personalizado ni la XP, y reciben XP como los demás', async () => {
  const fake = createFakeGithub();
  const { repo, weekly, acts } = make(fake);
  // Un attributes.json de antes, con solo los 5 de siempre y cambios del usuario.
  const old = { version: 1, attributes: make().R.DEFAULT_ATTRIBUTES.slice(0, 5).map((a) => ({ id: a.id, name: a.id === 'espiritu' ? 'Alma' : a.name, icon: a.icon, description: a.description, subs: a.subs.map((s, i) => ({ id: s.id, name: s.name, icon: s.icon, description: s.description, archived: s.id === 'peliculas', order: i })) })) };
  fake.state.files.set('rpg/attributes.json', JSON.stringify(old));
  await repo.addEntry({ kind: 'manual', key: 'manual:old1', label: 'Antes', xp: 80, shares: [{ sub: 'arte', pct: 100 }], day: '2026-09-01' });
  const st = await repo.state(true);
  assert.deepEqual(plain(st.structure.map((a) => a.id)), ['vitalidad', 'espiritu', 'vinculos', 'aventura', 'creatividad', 'inteligencia', 'yo_futuro']);
  assert.equal(st.structure[1].name, 'Alma', 'lo renombrado se respeta');
  assert.equal(st.structure[4].subs.find((s) => s.id === 'peliculas').archived, true, 'lo archivado sigue archivado');
  assert.equal(st.computed.mains[4].subs.find((s) => s.id === 'arte').xp, 80, 'la XP de antes sigue');
  assert.equal(st.computed.mains[5].level, 1); assert.equal(st.computed.mains[6].level, 1);
  // Reciben XP por las reglas de siempre: misión semanal con reparto y actividad propia.
  const m = await weekly.create({ name: 'Ahorrar', size: 'normal', shares: [{ sub: 'finanzas', pct: 60 }, { sub: 'objetivos', pct: 40 }], mode: 'checks', target: 1 });
  await weekly.toggleCheck(m.id, 0, true, WEEK);
  const a = await acts.create({ name: 'Clase de inglés', icon: 'globe', points: [{ sub: 'idioma', xp: 4 }, { sub: 'comunicacion', xp: 1 }] });
  await acts.log(a.id, { req: 'en1', day: MON });
  const st2 = await repo.state(true), sub = (id) => st2.computed.mains.flatMap((x) => x.subs).find((s) => s.id === id).xp;
  assert.equal(sub('finanzas'), 18); assert.equal(sub('objetivos'), 12); assert.equal(sub('idioma'), 4); assert.equal(sub('comunicacion'), 1);
  assert.equal(st2.computed.general.total, 80 + 30 + 5);
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
  const r = await repo.addEntry({ kind: 'manual', key: 'manual:abc1', label: 'Sesión de dibujo', xp: 10, shares: [{ sub: 'arte', pct: 100 }], day: '2026-03-05' });
  assert.equal(r.duplicate, false);
  assert.equal(ledger(fake, 2026).entries[0].xp, 10);
  const re = make(fake).repo; const st = await re.state();
  assert.equal(st.computed.general.total, 10); assert.equal(st.computed.general.level, 1);
  const arte = R.findSub(st.computed.mains.map((m) => ({ ...m })), 'arte').sub;
  assert.equal(arte.xp, 10); assert.equal(arte.level, 1);
  await re.addEntry({ kind: 'manual', key: 'manual:abc2', label: 'Modelado 3D', xp: 30, shares: [{ sub: 'arte', pct: 100 }], day: '2026-03-06' });
  const st2 = await re.state(true);
  assert.equal(st2.computed.general.total, 40); assert.equal(st2.computed.general.level, 1);
  const arte2 = st2.computed.mains.find((m) => m.id === 'creatividad').subs.find((s) => s.id === 'arte');
  assert.equal(arte2.level, 3, '40 XP ≥ 36 → nivel 3 de la subcategoría'); assert.equal(arte2.into, 4);
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

test('el diario nunca da XP por el ánimo o las emociones: solo por escribir (vía rpg/activities.js) y por las actividades y tareas de sus entradas', () => {
  const src = ['diary/entries', 'diary/repository', 'diary/emotions', 'diary/people'].map((f) => read(`js/${f}.js`)).join('\n');
  assert.equal(/App\.rpg|addEntry\(/.test(src), false);
  const editor = read('js/views/diary/editor.js');
  assert.equal(/addEntry\(|voidEntry\(/.test(editor), false, 'el editor nunca apunta ni anula XP directamente');
  const calls = [...new Set(editor.match(/\bR\.[A-Za-z]+/g))].sort();
  assert.deepEqual(calls, ['R.activities', 'R.applyDiaryRemovals', 'R.diaryRemovals', 'R.recordDiaryActivities', 'R.repo', 'R.shadows', 'R.todos'], 'la única vía son las actividades y tareas elegidas en las entradas (al registrarlas o al quitarlas); las sombras no tocan la XP');
  const shadows = read('js/rpg/shadows.js') + read('js/views/rpg/shadows.js');
  assert.equal(/addEntry\(|removeEntry\(|voidEntry\(|adjust\(/.test(shadows), false, 'las sombras nunca apuntan ni quitan XP');
});

test('actividades en las entradas del diario: se registran una vez por entrada y actividad, y quitarlas no resta', async () => {
  const { R, acts, repo } = make();
  const day = '2026-10-12';
  const blocks = [{ id: 'b_00000001', activities: ['gimnasio', 'leer-libro'] }, { id: 'b_00000002', activities: ['gimnasio'] }];
  const r1 = await acts.logBlocks(day, blocks);
  assert.equal(r1.logged.length, 3); assert.equal(r1.failed.length, 0);
  assert.ok(r1.logged.every((e) => R.isDiaryKey(e.key) && e.day === day && e.xp === R.ACTIVITY_XP));
  const r2 = await acts.logBlocks(day, blocks);
  assert.equal(r2.logged.length, 0, 'volver a guardar la página no suma otra vez');
  await acts.logBlocks(day, [{ id: 'b_00000001', activities: ['gimnasio'] }]);
  const st = await repo.state(true);
  assert.equal(st.computed.general.total, 15, 'quitar una actividad de la entrada no resta XP');
  assert.equal(st.entries.filter((e) => e.kind === 'adjustment').length, 0);
  await acts.setArchived('dormir-bien', true);
  const r3 = await acts.logBlocks(day, [{ id: 'b_00000003', activities: ['dormir-bien'] }]);
  assert.equal(r3.logged.length, 0); assert.equal(r3.failed.length, 1, 'una archivada no suma y se avisa');
});

test('radar SVG: estrella de siete puntas {7/3}, polígono relleno, siete puntas accesibles', () => {
  const { App, R } = make();
  const comp = R.computeState(R.buildStructure(null), [{ key: 'k', xp: 90, splits: [{ sub: 'fuerza', xp: 90 }] }]);
  const html = App.rpgViews.radar(comp.mains, { selected: 'espiritu' });
  assert.equal((html.match(/class="rd-star"/g) || []).length, 7, 'las 7 líneas de la estrella');
  // {7/3}: la punta 0 (arriba) se une con la 3; su segundo extremo queda abajo, a la derecha del centro.
  const first = /class="rd-star" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/.exec(html);
  assert.equal(Number(first[1]), 220); assert.ok(Number(first[4]) > 290 && Number(first[3]) > 220 && Number(first[3]) < 280, 'salta tres puntas, no dos');
  assert.match(html, /class="rd-outer"/); assert.match(html, /class="rd-area"/);
  assert.equal((html.match(/role="button"/g) || []).length, 7);
  assert.match(html, /aria-pressed="true"/);
  assert.equal((html.match(/data-main=/g) || []).length, 7);
  const five = App.rpgViews.radar(comp.mains.slice(0, 5), {});
  assert.equal((five.match(/class="rd-star"/g) || []).length, 5, 'con 5, el pentagrama de siempre');
  const subs = App.rpgViews.radar(comp.mains[1].subs.map((s) => ({ id: s.id, name: s.name, level: s.level, fraction: s.fraction, value: s.progress, magic: s.id === 'brujeria' })), { kind: 'sub', selected: 'brujeria' });
  assert.equal((subs.match(/role="button"/g) || []).length, 3, 'tres subcategorías de Espíritu');
  assert.match(subs, /data-sub="brujeria"/); assert.match(subs, /rd-label on magic/); assert.doesNotMatch(subs, /class="rd-star"/, 'con 3 ejes no hay diagonales');
  for (const n of ['Vitalidad', 'Espíritu', 'Vínculos', 'Aventura', 'Creatividad', 'Inteligencia', 'Yo futuro']) assert.ok(html.includes(n), n);
  assert.match(html, /Vitalidad, nivel 3/, '90 XP en Fuerza: Vitalidad suma 90 con la curva ×0,3');
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

test('borrar una actividad: desaparece del registro, deja de contar y solo vale para actividades', async () => {
  const { acts, repo, fake, R } = make();
  const r = await acts.log('gimnasio', { req: 'v1', day: '2026-09-01' });
  await acts.log('leer-libro', { req: 'v2', day: '2026-09-02' });
  await repo.removeEntry(r.entry.key);
  const doc = ledger(fake, 2026);
  assert.equal(doc.entries.length, 1); assert.equal(doc.entries[0].activity, 'leer-libro');
  const st = await repo.state(true);
  assert.equal(st.computed.general.total, 5);
  assert.equal(R.activityCount(st.entries, 'gimnasio', '2026-09-01', '2026-09-30'), 0);
  await rejectsWith(repo.removeEntry(r.entry.key), 'invalid');
  const m = await repo.addEntry({ kind: 'manual', key: 'manual:x1', label: 'Otra cosa', xp: 10, day: '2026-09-03' });
  await rejectsWith(repo.removeEntry(m.entry.key), 'invalid');
  // Un anulado del sistema anterior: al borrar la actividad se va también su ajuste (no resta dos veces).
  const old = await acts.log('gimnasio', { req: 'v3', day: '2026-09-04' });
  await repo.addEntry({ kind: 'adjustment', key: 'void:' + old.entry.key, label: 'Anulado', reason: 'antes', xp: -5, reverses: old.entry.key, day: '2026-09-05', points: old.entry.splits.map((p) => ({ sub: p.sub, xp: -p.xp })) });
  await repo.removeEntry(old.entry.key);
  assert.equal((await repo.state(true)).computed.general.total, 15);
});

test('diario: quitar una actividad o una tarea de su entrada quita su XP al guardar (lo que no dio XP no cuenta)', async () => {
  const fake = createFakeGithub();
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL, setTimeout, clearTimeout, fetch: fake.fetch, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  ctx.window = ctx; ctx.document = { documentElement: { dataset: {}, removeAttribute() {} } };
  for (const f of ['icons', 'ui', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'diary/entries', 'diary/repository', 'diary/drafts', 'rpg/config', 'rpg/model', 'rpg/repository', 'rpg/activities', 'rpg/weekly', 'rpg/bosses', 'rpg/todos']) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  const App = ctx.App, R = App.rpg;
  R.CONFIG.activity.daysBack = 100000;   // fechas fijas de octubre de 2026
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const todos = R.todos();
  for (const t of [{ text: 'Llamar' }, { text: 'Sábanas', size: 'pequena' }, { text: 'Otra (queda pendiente: la lista no se completa)' }]) await todos.addTask(t);
  const l = (await todos.state()).list;
  const ref = (t) => ({ list: l.id, task: t.id, text: t.text });
  const before = [
    { id: 'b_00000001', activities: ['gimnasio', 'leer-libro'], tasks: [ref(l.tasks[0])] },
    { id: 'b_00000002', activities: ['dormir-bien'], tasks: [ref(l.tasks[1])] }
  ];
  await R.recordDiaryActivities('2026-10-12', before);
  const total = async () => (await R.repo().state()).computed.general.total;
  assert.equal(await total(), 5 * 3 + 5 + 2);
  // Se quita «leer-libro» y la tarea «Llamar» de la entrada 1, y la entrada 2 entera.
  const after = [{ id: 'b_00000001', activities: ['gimnasio'], tasks: [] }];
  const items = await R.diaryRemovals(before, after);
  assert.deepEqual(plain(items.map((it) => [it.kind, it.label, it.xp, it.n]).sort()), [['act', 'Dormir bien', 5, 2], ['act', 'Leer un libro', 5, 1], ['task', 'Llamar', 5, 1], ['task', 'Sábanas', 2, 2]]);
  const res = await R.applyDiaryRemovals(items);
  assert.equal(res.removed.length, 4); assert.equal(res.failed.length, 0);
  assert.equal(await total(), 5, 'solo queda el gimnasio');
  assert.ok((await todos.state()).lists[0].tasks.every((t) => !t.done), 'las tareas vuelven a estar pendientes');
  assert.equal((await R.diaryRemovals(after, after)).length, 0, 'sin cambios, nada que quitar');
  // Con la lista ya completa, sus tareas quedan fijas: quitarlas de la entrada no las desmarca.
  const all3 = l.tasks.map(ref), withAll = [{ id: 'b_00000003', tasks: all3 }];
  await R.recordDiaryActivities('2026-10-12', withAll);
  assert.equal((await todos.state()).lists[0].completed, true);
  assert.equal((await R.diaryRemovals(withAll, [{ id: 'b_00000003', tasks: [] }])).length, 0);
  assert.equal((await R.diaryRemovals([{ id: 'b_00000009', activities: ['meditar'] }], [])).length, 0, 'lo que nunca dio XP no se quita');
});

test('borrar una actividad apuntada en el diario la quita también de su entrada', async () => {
  const fake = createFakeGithub();
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL, setTimeout, clearTimeout, fetch: fake.fetch, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  ctx.window = ctx; ctx.document = { documentElement: { dataset: {}, removeAttribute() {} } };
  for (const f of ['icons', 'ui', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'diary/entries', 'diary/repository', 'diary/drafts', 'rpg/config', 'rpg/model', 'rpg/repository', 'rpg/activities', 'rpg/weekly', 'rpg/bosses']) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  const App = ctx.App, R = App.rpg;
  R.CONFIG.activity.daysBack = 100000;   // fechas fijas de octubre de 2026
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const day = '2026-10-12', diary = App.diary.repo();
  await diary.save({ day, title: '', blocks: [{ id: 'b_00000001', text: 'Gimnasio y lectura', activities: ['gimnasio', 'leer-libro'] }, { id: 'b_00000002', text: '', activities: ['gimnasio'] }] });
  const res = await R.recordDiaryActivities(day, (await diary.get(day)).blocks);
  assert.equal(res.logged.length, 3);
  await R.deleteActivityEntry('act:blk:b_00000001:gimnasio');
  let page = await diary.get(day);
  assert.equal(page.blocks[0].activities.join(), 'leer-libro'); assert.equal(page.blocks[0].text, 'Gimnasio y lectura');
  assert.equal((await R.repo().state(true)).computed.general.total, 10);
  // La segunda entrada solo tenía esa actividad: la entrada se va; la página sigue por la primera.
  await R.deleteActivityEntry('act:blk:b_00000002:gimnasio');
  page = await diary.get(day);
  assert.equal(page.blocks.length, 1);
  // Volver a registrar la página ya no suma lo borrado.
  assert.equal((await R.recordDiaryActivities(day, page.blocks)).logged.length, 0);
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

test('semanal: una visita borrada no cuenta; y la semana siguiente empieza de cero', async () => {
  const { acts, weekly, repo } = make();
  await weekly.create({ ...gymMission, target: 2 });
  const a = await acts.log('gimnasio', { req: 'a', day: MON }); await acts.log('gimnasio', { req: 'b', day: '2026-10-13' });
  await repo.removeEntry(a.entry.key);
  assert.equal((await weekly.sync([WEEK])).length, 0, 'borrada: 1 de 2');
  const other = await weekly.state(true, '2026-W41'); assert.equal(other.missions[0].count, 0); assert.equal(other.missions[0].done, false);
  await acts.log('gimnasio', { req: 'c', day: '2026-10-14' });
  assert.equal((await weekly.sync([WEEK])).length, 1);
  await acts.log('gimnasio', { req: 'd', day: '2026-10-06' }); await acts.log('gimnasio', { req: 'e', day: '2026-10-07' });
  assert.equal((await weekly.sync(['2026-W41'])).length, 1, 'otra semana, otra recompensa');
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

test('semanales: editar no vuelve a premiar; eliminar la quita sin tocar la XP ganada; validación', async () => {
  const { weekly, acts, repo, fake } = make();
  const m = await weekly.create(gymMission);
  await acts.log('gimnasio', { req: 'a', day: MON }); await acts.log('gimnasio', { req: 'b', day: '2026-10-13' }); await acts.log('gimnasio', { req: 'c', day: '2026-10-14' });
  await weekly.sync([WEEK]);
  await weekly.update(m.id, { ...gymMission, name: 'Gym x3', size: 'dificil' });
  assert.equal((await weekly.sync([WEEK])).length, 0, 'editar no vuelve a premiar');
  const c = await weekly.create({ name: 'Leer', size: 'normal', shares: [], mode: 'checks', target: 2 });
  await weekly.toggleCheck(c.id, 0, true, WEEK);
  await weekly.remove(m.id); await weekly.remove(c.id);
  const doc = JSON.parse(fake.state.files.get('rpg/weekly.json'));
  assert.equal(doc.missions.length, 0); assert.equal(Object.keys(doc.progress).length, 0, 'sin rastro de sus casillas');
  assert.equal((await repo.state(true)).computed.general.total, 15 + 30, 'la XP ya ganada se queda');
  await rejectsWith(weekly.remove(m.id), 'invalid');
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

test('jefe: desmarcar un paso quita sus 5 XP; volver a marcarlo los da una sola vez; derrotado, queda fijo', async () => {
  const { bosses, repo } = make();
  const b = await bosses.create({ ...boss, steps: [{ text: 'Uno' }, { text: 'Dos' }] });
  const [s1, s2] = (await bosses.state()).bosses[0].steps;
  const total = async () => (await repo.state(true)).computed.general.total;
  await bosses.completeStep(b.id, s1.id); assert.equal(await total(), 5);
  await bosses.uncompleteStep(b.id, s1.id); assert.equal(await total(), 0);
  assert.equal((await bosses.state(true)).bosses[0].steps[0].done, false);
  for (let i = 0; i < 3; i++) { await bosses.completeStep(b.id, s1.id); await bosses.completeStep(b.id, s1.id); await bosses.uncompleteStep(b.id, s1.id); }
  assert.equal(await total(), 0, 'marcar y desmarcar muchas veces no acumula nada');
  assert.deepEqual(plain(await bosses.uncompleteStep(b.id, s1.id)), [], 'desmarcar uno ya desmarcado no hace nada');
  await bosses.completeStep(b.id, s1.id); await bosses.completeStep(b.id, s2.id);
  assert.equal(await total(), 5 + 5 + 250, 'pasos y derrota');
  await rejectsWith(bosses.uncompleteStep(b.id, s1.id), 'invalid');
  assert.equal(await total(), 260, 'con el jefe derrotado no se resta nada');
  await rejectsWith(repo.removeEntry('boss:' + b.id), 'invalid');   // la derrota no se borra así
});

test('rendimiento: marcar o desmarcar un paso solo lee y escribe el registro de ese año (2 llamadas), sin releerlo todo', async () => {
  const { bosses, repo, fake } = make();
  await repo.addEntry({ kind: 'manual', key: 'manual:p0', label: 'Año pasado', xp: 5, day: '2025-03-01' });
  const b = await bosses.create({ ...boss, steps: [{ text: 'Uno' }, { text: 'Dos' }] });
  const s = (await bosses.state()).bosses[0].steps[0];
  await repo.state();
  const count = async (job) => { fake.state.calls.length = 0; await job(); return fake.state.calls.map((c) => c.method + ' ' + new URL(c.url).pathname.split('/contents/')[1]); };
  assert.deepEqual(await count(() => bosses.completeStep(b.id, s.id)), ['GET rpg/ledger-' + new Date().getFullYear() + '.json', 'PUT rpg/ledger-' + new Date().getFullYear() + '.json']);
  assert.deepEqual(await count(() => bosses.uncompleteStep(b.id, s.id)), ['GET rpg/ledger-' + new Date().getFullYear() + '.json', 'PUT rpg/ledger-' + new Date().getFullYear() + '.json']);
  const st = await repo.state();
  assert.equal(st.computed.general.total, 5, 'la caché queda al día: el año pasado sigue y el paso ya no cuenta');
});

test('tareas: una sola lista del día; cada tarea da su XP; +20 al completarla (con 3 o más); desmarcar resta solo la tarea', async () => {
  const { todos, repo, R } = make();
  assert.equal((await todos.state()).list, null, 'sin tareas todavía no hay lista');
  await todos.addTask({ text: 'Portfolio', size: 'grande' }); await todos.addTask({ text: 'Ropa', size: 'pequena' });
  await rejectsWith(todos.addTask({ text: '  ' }), 'invalid');
  await todos.addTask({ text: 'Leer sobre la empresa' });   // Normal por defecto
  assert.equal(todos.setShares, undefined, 'las tareas ya no tienen reparto');
  let s = (await todos.state()).list;
  assert.equal((await todos.state()).lists.length, 1, 'una sola lista');
  assert.equal(s.day, R.logicalDay()); assert.deepEqual(plain(s.tasks.map((t) => t.xp)), [10, 2, 5]);
  const total = async () => (await repo.state()).computed.general.total;
  const [a, b, c] = s.tasks;
  assert.deepEqual(plain(await todos.completeTask(s.id, a.id)), []); assert.equal(await total(), 10);
  await todos.completeTask(s.id, b.id);
  await todos.uncompleteTask(s.id, b.id); assert.equal(await total(), 10, 'desmarcar quita solo esa tarea');
  await todos.completeTask(s.id, b.id); await todos.completeTask(s.id, b.id);
  assert.equal(await total(), 12, 'marcar dos veces no cuenta dos veces');
  const ev = await todos.completeTask(s.id, c.id);
  assert.deepEqual(plain(ev), [{ type: 'todo', label: 'Lista del día', xp: 20 }]);
  assert.equal(await total(), 10 + 2 + 5 + 20);
  assert.ok((await repo.state()).computed.mains.every((m) => m.subs.every((x) => x.xp === 0)), 'toda la XP de tareas va solo al nivel general');
  assert.equal((await todos.sync()).length, 0, 'el bonus no se da dos veces');
  s = (await todos.state()).list; assert.equal(s.completed, true); assert.equal(s.rewardXp, 20);
  await rejectsWith(todos.uncompleteTask(s.id, a.id), 'invalid');
  // Completada, se pueden seguir añadiendo y marcando tareas (sin otro bonus).
  const d = await todos.addTask({ text: 'Mandar el correo' });
  assert.deepEqual(plain(await todos.completeTask(s.id, d.id)), []);
  assert.equal(await total(), 37 + 5);
  assert.ok(R.isTodoTaskKey('todo:' + s.id + ':' + a.id)); assert.ok(!R.isTodoTaskKey('todo:' + s.id));
});

test('tareas: tope de 40 XP al día; la que lo cruza da lo que queda y las siguientes se marcan con 0 XP', async () => {
  const { todos, repo, fake } = make();
  for (const t of ['A', 'B', 'C']) await todos.addTask({ text: t, size: 'grande' });
  await todos.addTask({ text: 'D', size: 'normal' }); await todos.addTask({ text: 'E', size: 'grande' }); await todos.addTask({ text: 'F', size: 'pequena' });
  let l = (await todos.state()).list;
  for (const t of l.tasks.slice(0, 4)) await todos.completeTask(l.id, t.id);   // 10 + 10 + 10 + 5 = 35
  l = (await todos.state()).list;
  assert.equal(l.usedXp, 35); assert.equal(l.tasks[4].xp, 5, 'a la grande solo le quedan 5'); assert.equal(l.tasks[4].capped, true);
  await todos.completeTask(l.id, l.tasks[4].id);
  const ev = await todos.completeTask(l.id, l.tasks[5].id);
  const entries = ledger(fake, Number(l.day.slice(0, 4))).entries;
  assert.deepEqual(plain(entries.filter((e) => e.key.startsWith('todo:' + l.id + ':')).map((e) => e.xp)), [10, 10, 10, 5, 5, 0]);
  assert.equal(entries.find((e) => e.label === 'F').capped, true);
  assert.deepEqual(plain(ev), [{ type: 'todo', label: 'Lista del día', xp: 20 }], 'el bonus va aparte del tope');
  assert.equal((await repo.state()).computed.general.total, 40 + 20);
});

test('tareas: editar, reordenar y quitar; no se tocan las marcadas; con menos de 3 tareas no hay bonus', async () => {
  const { todos, repo } = make();
  const a = await todos.addTask({ text: 'Cajas' }), b = await todos.addTask({ text: 'Llaves' });
  const id = (await todos.state()).list.id;
  await todos.completeTask(id, a.id);
  await rejectsWith(todos.removeTask(a.id), 'invalid');
  await rejectsWith(todos.updateTask(a.id, { text: 'Otra' }), 'invalid');
  await todos.updateTask(b.id, { text: 'Llaves del trastero', size: 'grande' });
  await todos.moveTask(b.id, -1);
  let l = (await todos.state()).list;
  assert.deepEqual(plain(l.tasks.map((t) => [t.text, t.size])), [['Llaves del trastero', 'grande'], ['Cajas', 'normal']]);
  assert.equal(await todos.moveTask(b.id, -1), false, 'la primera no sube más');
  const ev = await todos.removeTask(b.id);
  assert.deepEqual(plain(ev), [], 'todas hechas, pero solo 1 tarea: sin bonus');
  l = (await todos.state()).list; assert.equal(l.allDone, true); assert.equal(l.eligible, false); assert.equal(l.completed, false);
  assert.equal((await repo.state()).computed.general.total, 5);
});

test('día de uso: cambia a las 3:00, no a medianoche', () => {
  const { R } = make();
  assert.equal(R.logicalDay(new Date(2026, 9, 18, 2, 59)), '2026-10-17', 'de madrugada cuenta como el día anterior');
  assert.equal(R.logicalDay(new Date(2026, 9, 18, 3, 0)), '2026-10-18');
  assert.equal(R.currentWeek(new Date(2026, 9, 19, 2, 0)), '2026-W42', 'el lunes antes de las 3:00 sigue siendo la semana anterior');
  assert.equal(R.currentWeek(new Date(2026, 9, 19, 3, 0)), '2026-W43');
});

test('tareas: a las 3:00 lo hecho se borra y lo pendiente pasa a la lista de hoy; la XP se queda', async () => {
  const fake = createFakeGithub();
  const { todos, repo, R } = make(fake);
  await todos.addTask({ text: 'Banco' }); await todos.addTask({ text: 'Correos', size: 'grande' });
  const a = (await todos.state()).list;
  await todos.completeTask(a.id, a.tasks[0].id);
  const before = (await repo.state()).computed.general.total;
  // Pasa la noche: se fecha como de ayer en el archivo.
  const doc = JSON.parse(fake.state.files.get('rpg/todos.json'));
  doc.list.day = '2020-01-01';
  fake.state.files.set('rpg/todos.json', JSON.stringify(doc));
  const again = make(fake);
  assert.equal((await again.todos.state()).list, null, 'la de ayer ya no se ve');
  assert.equal(await again.todos.cleanup(), 1, 'una tarea pendiente');
  const l = (await again.todos.state()).list;
  assert.notEqual(l.id, a.id);
  assert.deepEqual(plain(l.tasks.map((t) => [t.text, t.size, t.done])), [['Correos', 'grande', false]]);
  assert.equal(l.day, R.logicalDay());
  assert.equal((await again.repo.state()).computed.general.total, before, 'la XP ganada ayer se queda');
  assert.equal(await again.todos.cleanup(), 0, 'sin nada que limpiar no escribe');
});

test('tareas: las varias listas de antes se juntan en la lista de hoy; lo hecho se queda en el historial con su XP', async () => {
  const fake = createFakeGithub();
  const { repo, R } = make(fake);
  const today = R.logicalDay(), S = [{ sub: 'carrera', pct: 100 }];
  const tk = (n) => 'tk_0000000' + n;
  fake.state.files.set('rpg/todos.json', JSON.stringify({ version: 1, lists: [
    { id: 'tl_00000001', name: 'Hoy', size: 'normal', shares: S, day: today, tasks: [{ id: tk(1), text: 'Hecha hoy', size: 'normal' }, { id: tk(2), text: 'Pendiente hoy', size: 'normal' }] },
    { id: 'tl_00000002', name: 'Vieja', size: 'epica', shares: S, day: '2020-01-01', tasks: [{ id: tk(3), text: 'Hecha antes', size: 'grande' }, { id: tk(4), text: 'Pendiente vieja', size: 'pequena' }] },
    { id: 'tl_00000003', name: 'Completada', size: 'normal', shares: S, day: today, tasks: [{ id: tk(5), text: 'Fija', size: 'normal' }] }] }));
  await repo.addEntry({ kind: 'quest', key: 'todo:tl_00000001:' + tk(1), label: 'Hecha hoy', xp: 5, day: today });
  await repo.addEntry({ kind: 'quest', key: 'todo:tl_00000002:' + tk(3), label: 'Hecha antes', xp: 10, day: '2026-01-02' });
  await repo.addEntry({ kind: 'quest', key: 'todo:tl_00000003', label: 'Completada', xp: 30, day: today });
  const total = (await repo.state(true)).computed.general.total;
  const again = make(fake);
  let l = (await again.todos.state()).list;   // ya se ve junta antes de escribir nada
  assert.equal(l.id, 'tl_00000001', 'la de hoy conserva su id (y lo que tenía hecho)');
  assert.deepEqual(plain(l.tasks.map((t) => [t.text, t.done])), [['Hecha hoy', true], ['Pendiente hoy', false], ['Pendiente vieja', false]]);
  assert.deepEqual(plain(l.shares), S);
  await again.todos.cleanup();
  const doc = JSON.parse(fake.state.files.get('rpg/todos.json'));
  assert.equal(doc.version, 2); assert.equal(doc.lists, undefined); assert.equal(doc.list.tasks.length, 3);
  assert.equal((await again.repo.state(true)).computed.general.total, total, 'lo ganado se queda');
  // Aunque el archivo antiguo traiga reparto, marcar una tarea da su XP solo al nivel general.
  await again.todos.completeTask(l.id, tk(2));
  const st = await again.repo.state(true);
  assert.equal(st.computed.general.total, total + 5);
  assert.equal(st.computed.mains.find((m) => m.id === 'yo_futuro').subs.find((x) => x.id === 'carrera').xp, 0, 'el reparto antiguo se ignora');
  assert.equal(doc.notice, undefined, 'sin avisos de reparto');
});

test('misiones: «solo esta semana» se borra al pasar la semana; «repetir» y las de antes siguen', async () => {
  const fake = createFakeGithub();
  const { weekly, R } = make(fake);
  const once = await weekly.create({ ...gymMission, name: 'Una vez' });
  const rep = await weekly.create({ ...gymMission, name: 'Siempre', repeat: true });
  assert.equal(once.repeat, false); assert.equal(once.week, R.currentWeek()); assert.equal(rep.repeat, true); assert.equal(rep.week, null);
  const doc = JSON.parse(fake.state.files.get('rpg/weekly.json'));
  doc.missions.find((m) => m.id === once.id).week = '2020-W01';
  doc.missions.push({ ...gymMission, id: 'wm_0000000a', name: 'De antes', createdAt: '2026-01-01' });   // sin el campo: repite
  doc.progress[once.id + '|2020-W01'] = { checks: [true] };
  fake.state.files.set('rpg/weekly.json', JSON.stringify(doc));
  const again = make(fake);
  assert.deepEqual(plain((await again.weekly.state()).missions.map((m) => m.name).sort()), ['De antes', 'Siempre']);
  assert.equal(await again.weekly.cleanup(), 1);
  const d2 = JSON.parse(fake.state.files.get('rpg/weekly.json'));
  assert.equal(d2.missions.length, 2); assert.equal(d2.progress[once.id + '|2020-W01'], undefined);
  // Editar sin tocar la duración la conserva; pasar a «solo esta semana» la fecha en la semana actual.
  const kept = await again.weekly.update('wm_0000000a', { ...gymMission, name: 'De antes' });
  assert.equal(kept.repeat, true);
  const now1 = await again.weekly.update(rep.id, { ...gymMission, name: 'Siempre', repeat: false });
  assert.equal(now1.repeat, false); assert.equal(now1.week, R.currentWeek());
});

test('tareas desde el diario: al guardar la página se marcan en su lista, una vez; quitarlas de la entrada no las desmarca', async () => {
  const { todos, repo } = make();
  await todos.addTask({ text: 'Llamar a la abuela' }); await todos.addTask({ text: 'Sábanas', size: 'pequena' }); await todos.addTask({ text: 'Regar' });
  const l = (await todos.state()).list;
  const [t1, t2, t3] = l.tasks;
  const blocks = [{ id: 'b_00000001', tasks: [{ list: l.id, task: t1.id, text: 'Llamar a la abuela' }] }];
  const r1 = await todos.completeFromBlocks(blocks);
  assert.deepEqual(plain(r1.logged.map((e) => [e.label, e.xp])), [['Llamar a la abuela', 5]]);
  assert.equal((await todos.completeFromBlocks(blocks)).logged.length, 0, 'volver a guardar no suma');
  const r2 = await todos.completeFromBlocks([{ id: 'b_00000002', tasks: [{ list: l.id, task: t2.id, text: 'Sábanas' }, { list: l.id, task: t3.id, text: 'Regar' }, { list: 'tl_ffffffff', task: 'tk_ffffffff', text: 'De otra lista' }] }]);
  assert.equal(r2.logged.length, 2, 'una tarea de una lista que ya no existe se ignora');
  assert.deepEqual(plain(r2.events), [{ type: 'todo', label: 'Lista del día', xp: 20 }], 'era la última: la lista se completa');
  assert.equal((await repo.state()).computed.general.total, 5 + 2 + 5 + 20);
  await todos.completeFromBlocks([{ id: 'b_00000001', tasks: [] }]);
  assert.equal((await todos.state()).lists[0].tasks[0].done, true, 'quitarla de la entrada no la desmarca');
});

test('diarias: la batería de fábrica cubre las 24 subcategorías, con ids válidos y tamaños 15 o 30', () => {
  const { R } = make();
  const st = R.buildStructure(null), subs = st.flatMap((a) => a.subs.map((s) => s.id));
  assert.ok(R.DAILY_DEFAULTS.length >= 45, 'unas 45 o más');
  for (const m of R.DAILY_DEFAULTS) { assert.match(m.id, R.DAILY_ID_RE); assert.ok(subs.includes(m.sub), m.sub); assert.ok([15, 30].includes(R.sizeXp(m.size)), m.id); }
  for (const s of subs) assert.ok(R.DAILY_DEFAULTS.some((m) => m.sub === s), 'falta alguna para ' + s);
  assert.equal(new Set(R.DAILY_DEFAULTS.map((m) => m.id)).size, R.DAILY_DEFAULTS.length, 'ids únicos');
});

test('diarias: tres al día de atributos distintos, que no cambian al recargar; XP a su subcategoría y +15 por las tres', async () => {
  const fake = createFakeGithub();
  const { daily, repo, R } = make(fake);
  const s = await daily.state();
  assert.equal(s.missions.length, 3); assert.equal(s.rerollsLeft, 3); assert.equal(s.day, R.logicalDay());
  const st = await repo.state(), mains = s.missions.map((m) => R.findSub(st.structure, m.sub).main.id);
  assert.equal(new Set(mains).size, 3, 'de tres atributos distintos');
  const again = make(fake);
  assert.deepEqual(plain((await again.daily.state()).missions.map((m) => m.id)), plain(s.missions.map((m) => m.id)), 'recargar no las cambia');
  const [a, b, c] = s.missions;
  await daily.complete(a.id);
  let st2 = await repo.state();
  assert.equal(st2.computed.general.total, a.xp);
  assert.equal(st2.computed.mains.flatMap((x) => x.subs).find((x) => x.id === a.sub).xp, a.xp, 'va a su subcategoría');
  await daily.complete(a.id); assert.equal((await repo.state()).computed.general.total, a.xp, 'marcar dos veces no cuenta dos veces');
  await daily.uncomplete(a.id); assert.equal((await repo.state()).computed.general.total, 0, 'desmarcar quita su XP');
  await daily.complete(a.id); await daily.complete(b.id);
  const ev = await daily.complete(c.id);
  assert.deepEqual(plain(ev), [{ type: 'daily', label: '¡Día completo!', xp: 15 }]);
  st2 = await repo.state();
  assert.equal(st2.computed.general.total, a.xp + b.xp + c.xp + 15);
  assert.equal((await daily.state()).complete, true);
  await rejectsWith(daily.uncomplete(a.id), 'invalid');   // con el día completo, quedan fijas
  assert.equal((await daily.complete(a.id)).length, 0, 'el premio del día no se repite');
});

test('diarias: tres cambios al día, nunca por una que ya tengas ni de una hecha; mañana salen otras', async () => {
  const fake = createFakeGithub();
  const { daily, R } = make(fake);
  const s = await daily.state();
  await daily.complete(s.missions[0].id);
  await rejectsWith(daily.reroll(s.missions[0].id), 'invalid');   // hecha: no se cambia
  const target = s.missions[1].id;
  const n1 = await daily.reroll(target);
  const now = (await daily.state()).missions.map((m) => m.id);
  assert.ok(!now.includes(target) && now.includes(n1.id)); assert.equal(new Set(now).size, 3);
  await daily.reroll(n1.id); const n3 = await daily.reroll((await daily.state()).missions[1].id);
  assert.ok(n3);
  assert.equal((await daily.state()).rerollsLeft, 0);
  await rejectsWith(daily.reroll((await daily.state()).missions[2].id), 'invalid');
  // Pasa la noche: otro día, otras tres y cambios de nuevo.
  const doc = JSON.parse(fake.state.files.get('rpg/daily.json')); doc.day = '2020-01-01';
  fake.state.files.set('rpg/daily.json', JSON.stringify(doc));
  const tomorrow = await make(fake).daily.state();
  assert.equal(tomorrow.day, R.logicalDay()); assert.equal(tomorrow.rerollsLeft, 3); assert.equal(tomorrow.missions.length, 3);
});

test('diarias: añadir las tuyas, eliminar (las de fábrica se recuperan) y lo eliminado no vuelve a salir', async () => {
  const { daily, R } = make();
  const mine = await daily.addCustom({ name: 'Ve un capítulo en versión original', sub: 'idioma', size: 'normal' });
  assert.match(mine.id, /^dc_/);
  await rejectsWith(daily.addCustom({ name: 've un capítulo en VERSIÓN original', sub: 'idioma' }), 'invalid');
  await rejectsWith(daily.addCustom({ name: 'X', sub: 'nope' }), 'invalid');
  await rejectsWith(daily.addCustom({ name: ' ', sub: 'arte' }), 'invalid');
  let cat = await daily.catalog();
  assert.equal(cat.missions.length, R.DAILY_DEFAULTS.length + 1);
  // Deja solo tres misiones de fábrica: las de hoy (de mañana en adelante) salen de ahí.
  const keep = ['dm_agua', 'dm_tarot', 'dm_gastos'];
  for (const m of R.DAILY_DEFAULTS) if (!keep.includes(m.id)) await daily.removeMission(m.id);
  await daily.removeMission(mine.id);
  cat = await daily.catalog();
  assert.deepEqual(plain(cat.missions.map((m) => m.id).sort()), keep.slice().sort());
  assert.equal(cat.removedDefaults, R.DAILY_DEFAULTS.length - 3);
  assert.ok(cat.missions.every((m) => !m.custom), 'la tuya eliminada no queda');
  await daily.restoreDefaults();
  assert.equal((await daily.catalog()).missions.length, R.DAILY_DEFAULTS.length);
  assert.ok(R.isDailyKey('daily:2026-10-18:dm_agua')); assert.ok(!R.isDailyKey('daily:2026-10-18'));
});

test('el registro avisa de cada cambio guardado (XP, perfil, atributos) para repintar el inicio y la ficha', async () => {
  const { repo, acts } = make();
  const seen = [];
  const off = repo.onChange((k) => seen.push(k));
  await acts.log('gimnasio', { req: 'n1', day: '2026-10-01' });
  await repo.saveProfile({ name: 'Yo', avatar: 'moon' });
  await repo.updateSub('arte', { name: 'Dibujo' });
  assert.ok(seen.includes('entries') && seen.includes('profile') && seen.includes('structure'), seen.join());
  off(); const n = seen.length;
  await acts.log('gimnasio', { req: 'n2', day: '2026-10-02' });
  assert.equal(seen.length, n, 'tras darse de baja no avisa');
  const st = await repo.state();
  assert.equal(st.computed.general.total, 10, 'lo que se lee después ya está al día');
});

test('número con − y +: salta de step en step, respeta mínimo y máximo, y avisa como si se escribiera', () => {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL, Event: class { constructor(t) { this.type = t; } } });
  ctx.window = ctx;
  for (const f of ['icons', 'ui', 'components']) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  const ui = ctx.App.ui;
  const html = ui.stepper({ value: 50, min: 1, max: 100, step: 5, unit: '%', label: 'Arte', attrs: 'data-pkval="arte"' });
  assert.match(html, /class="stepper"/); assert.match(html, /data-pkval="arte"/); assert.match(html, /data-st-step="5"/); assert.match(html, /aria-label="Arte"/);
  assert.equal((html.match(/class="st-btn"/g) || []).length, 2);
  const events = [];
  const input = { value: '50', disabled: false, attrs: { 'data-st-step': '5', min: '1', max: '100' }, getAttribute(k) { return this.attrs[k]; }, dispatchEvent(e) { events.push(e.type); } };
  const btn = (d) => ({ getAttribute: () => String(d), closest: () => ({ querySelector: () => input }) });
  ui.stepperClick(btn(1)); assert.equal(input.value, '55');
  input.value = '53'; ui.stepperClick(btn(1)); assert.equal(input.value, '55', 'redondea al siguiente múltiplo');
  input.value = '53'; ui.stepperClick(btn(-1)); assert.equal(input.value, '50');
  input.value = '98'; ui.stepperClick(btn(1)); assert.equal(input.value, '100', 'no pasa del máximo');
  input.value = '3'; ui.stepperClick(btn(-1)); assert.equal(input.value, '1', 'ni baja del mínimo');
  assert.deepEqual(events.slice(0, 2), ['input', 'change']);
  assert.match(ui.editButton('data-act="edit" data-id="x"', 'Editar <b>'), /class="edit-fab"[^>]*aria-label="Editar &lt;b&gt;"/);
});

test('jefe: se puede eliminar vivo o derrotado, sin tocar la XP ganada', async () => {
  const { bosses, acts, repo, fake } = make();
  const live = await bosses.create(boss);
  const won = await bosses.create({ ...boss, name: 'Derrotado', steps: [{ text: 'Un paso' }] });
  const s = (await bosses.state()).bosses.find((x) => x.id === won.id).steps[0];
  await bosses.completeStep(won.id, s.id);
  assert.equal((await bosses.state(true)).bosses.find((x) => x.id === won.id).defeated, true);
  const before = (await repo.state(true)).computed.general.total;
  await bosses.remove(won.id); await bosses.remove(live.id);
  assert.equal(JSON.parse(fake.state.files.get('rpg/bosses.json')).bosses.length, 0);
  assert.equal((await bosses.state(true)).bosses.length, 0);
  assert.equal((await repo.state(true)).computed.general.total, before, 'la XP ya ganada se queda');
  await acts.log('gimnasio', { req: 'x', day: '2026-10-05' }); await acts.log('gimnasio', { req: 'y', day: '2026-10-06' });
  assert.equal((await bosses.sync()).length, 0, 'un jefe eliminado ya no da nada');
  await rejectsWith(bosses.remove(live.id), 'invalid');
});

test('los archivados del sistema anterior no se ven y se borran del archivo al abrir la ficha', async () => {
  const fake = createFakeGithub();
  const { weekly, bosses } = make(fake);
  const keep = await weekly.create(gymMission); const old = await weekly.create({ ...gymMission, name: 'Vieja' });
  const bKeep = await bosses.create(boss); const bOld = await bosses.create({ ...boss, name: 'Viejo' });
  const wDoc = JSON.parse(fake.state.files.get('rpg/weekly.json'));
  wDoc.missions.find((m) => m.id === old.id).archived = true; wDoc.progress[old.id + '|' + WEEK] = { checks: [true] };
  fake.state.files.set('rpg/weekly.json', JSON.stringify(wDoc));
  const bDoc = JSON.parse(fake.state.files.get('rpg/bosses.json'));
  bDoc.bosses.find((b) => b.id === bOld.id).archived = true;
  fake.state.files.set('rpg/bosses.json', JSON.stringify(bDoc));
  const again = make(fake);
  assert.deepEqual(plain((await again.weekly.state(true)).missions.map((m) => m.id)), [keep.id]);
  assert.deepEqual(plain((await again.bosses.state(true)).bosses.map((b) => b.id)), [bKeep.id]);
  assert.equal(await again.weekly.cleanup(), 1); assert.equal(await again.bosses.purgeArchived(), 1);
  const w2 = JSON.parse(fake.state.files.get('rpg/weekly.json')), b2 = JSON.parse(fake.state.files.get('rpg/bosses.json'));
  assert.deepEqual(w2.missions.map((m) => m.id), [keep.id]); assert.equal(w2.progress[old.id + '|' + WEEK], undefined);
  assert.deepEqual(b2.bosses.map((b) => b.id), [bKeep.id]);
  assert.equal(await again.weekly.cleanup(), 0, 'sin archivados no escribe nada');
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

test('imágenes por enlace: fotos de los sitios admitidos (avatar y jefes), y cada sitio permitido en la política de index.html', async () => {
  const { R } = make();
  const urls = ['https://media.giphy.com/a.gif', 'https://i.giphy.com/a.gif', 'https://media1.tenor.com/a.gif', 'https://c.tenor.com/a.gif', 'https://i.imgur.com/a.jpg',
    'https://i.pinimg.com/736x/aa/bb/foto.jpg', 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Foto.png', 'https://images.unsplash.com/photo-1?w=800',
    'https://plus.unsplash.com/premium_photo-1', 'https://lh3.googleusercontent.com/abc=w800', 'https://i.redd.it/abc.png', 'https://preview.redd.it/abc.jpg?width=640',
    'https://64.media.tumblr.com/abc/def.png', 'https://live.staticflickr.com/1/2_3.jpg', 'https://farm5.staticflickr.com/1/2.jpg', 'https://pbs.twimg.com/media/abc.jpg'];
  const csp = /img-src ([^;]+);/.exec(read('index.html'))[1].split(/\s+/).filter((s) => s.startsWith('https://'));
  const allowed = (host) => csp.some((src) => { const h = src.slice(8); return h.startsWith('*.') ? host.endsWith(h.slice(1)) : host === h; });
  for (const u of urls) {
    assert.equal(R.imageUrl(u), new URL(u).href, u);
    assert.ok(allowed(new URL(u).hostname), 'la política de index.html debe permitir ' + new URL(u).hostname);
  }
  for (const bad of ['https://evil.example/a.jpg', 'http://i.pinimg.com/a.jpg', 'https://i.pinimg.com.evil.com/a.jpg', 'https://pinterest.com/pin/1', 'javascript:alert(1)', 'https://media.tumblr.com.evil.io/a.png'])
    assert.equal(R.imageUrl(bad), null, bad);
  const { repo } = make();
  const p = await repo.saveProfile({ name: 'Yo', avatar: 'moon', image: { kind: 'url', url: 'https://i.pinimg.com/736x/aa/bb/foto.jpg' } });
  assert.deepEqual(plain(p.image), { kind: 'url', url: 'https://i.pinimg.com/736x/aa/bb/foto.jpg' });
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

// ---- Sombras ----
const act = (activity, day, key = 'act:' + activity + ':' + day) => ({ kind: 'activity', key, activity, day, xp: 5, label: activity });
const insomnio = { id: 'sh_0000000a', name: 'Insomnio', icon: 'moon', counters: ['dormir-bien', 'meditar'], archived: false, offerFrom: null };

test('sombras: una aparición se purifica con un contrahechizo ese día o el siguiente (no después, ni anulado, ni otra actividad)', () => {
  const { R } = make();
  assert.equal(R.shadowPurified(insomnio, '2026-10-10', [act('dormir-bien', '2026-10-10')]), true, 'el mismo día');
  assert.equal(R.shadowPurified(insomnio, '2026-10-10', [act('meditar', '2026-10-11')]), true, 'el día siguiente');
  assert.equal(R.shadowPurified(insomnio, '2026-10-31', [act('meditar', '2026-11-01')]), true, 'aunque cambie el mes');
  assert.equal(R.shadowPurified(insomnio, '2026-10-10', [act('dormir-bien', '2026-10-12')]), false, 'dos días después ya no');
  assert.equal(R.shadowPurified(insomnio, '2026-10-10', [act('dormir-bien', '2026-10-09')]), false, 'antes no cuenta');
  assert.equal(R.shadowPurified(insomnio, '2026-10-10', [act('gimnasio', '2026-10-10')]), false, 'otra actividad no');
  const voided = [act('dormir-bien', '2026-10-10', 'act:x'), { kind: 'adjustment', key: 'adj:1', reverses: 'act:x', day: '2026-10-10', xp: -5 }];
  assert.equal(R.shadowPurified(insomnio, '2026-10-10', voided), false, 'una actividad anulada no purifica');
});

test('sombras: la tarjeta (tira de 14 días, mes, hoy) y la oferta de jefe con 4 apariciones en 14 días', () => {
  const { R } = make();
  const today = '2026-10-18', ap = (d) => ({ shadow: insomnio.id, day: d, at: '', from: 'ficha' });
  const apps = [ap('2026-10-06'), ap('2026-10-09'), ap('2026-10-13'), ap('2026-10-18'), ap('2026-09-30'), { shadow: 'sh_0000000b', day: '2026-10-18' }];
  const v = R.shadowView(insomnio, apps, [act('dormir-bien', '2026-10-10'), act('meditar', '2026-10-13')], today);
  assert.equal(v.strip.length, 14); assert.equal(v.strip[13].day, today); assert.equal(v.strip[0].day, '2026-10-05');
  assert.deepEqual(plain(v.strip.filter((d) => d.state !== 'none').map((d) => [d.day, d.state])), [['2026-10-06', 'ap'], ['2026-10-09', 'ok'], ['2026-10-13', 'ok'], ['2026-10-18', 'ap']]);
  assert.equal(v.monthCount, 4); assert.equal(v.monthPurified, 2);
  assert.deepEqual(plain(v.today), { from: 'ficha', purified: false });
  assert.equal(v.recentCount, 4); assert.equal(v.offer, true);
  assert.equal(R.shadowView(Object.assign({}, insomnio, { offerFrom: '2026-10-09' }), apps, [], today).offer, false, '«Ahora no»: solo cuentan las de después');
  assert.equal(R.shadowView(Object.assign({}, insomnio, { offerFrom: '2026-10-05' }), apps, [], today).offer, true);
  assert.equal(R.shadowView(insomnio, apps.slice(1), [], today).offer, false, 'con 3 no se ofrece');
});

test('sombras: glitch del avatar con una aparición de hoy o de ayer sin purificar; calmado si se purifica hoy', () => {
  const { R } = make();
  const today = '2026-10-18', ap = (d, s = insomnio.id) => ({ shadow: s, day: d });
  assert.equal(R.shadowAura([insomnio], [], [], today, today), null);
  assert.equal(R.shadowAura([insomnio], [ap(today)], [], today, today), 'glitch');
  assert.equal(R.shadowAura([insomnio], [ap('2026-10-17')], [], today, today), 'glitch', 'la de anoche sigue sin purificar');
  assert.equal(R.shadowAura([insomnio], [ap('2026-10-16')], [], today, today), null, 'la de hace dos días ya no');
  assert.equal(R.shadowAura([insomnio], [ap('2026-10-17')], [act('dormir-bien', today)], today, today), 'calm', 'purificada hoy: calmado');
  assert.equal(R.shadowAura([insomnio], [ap('2026-10-17')], [act('dormir-bien', '2026-10-17')], today, today), null, 'purificada ayer: ya no se ve nada');
  assert.equal(R.shadowAura([insomnio], [ap(today), ap('2026-10-17')], [act('dormir-bien', '2026-10-17')], today, today), 'glitch', 'otra sin purificar manda');
  assert.equal(R.shadowAura([Object.assign({}, insomnio, { archived: true })], [ap(today)], [], today, today), null, 'las archivadas no');
});

test('sombras: frecuencia de los últimos 6 meses, purificadas y sin purificar, de todas o de una', () => {
  const { R } = make();
  const rumiar = { id: 'sh_0000000b', name: 'Rumiar', icon: 'eye', counters: ['tarot'], archived: true };
  const apps = [{ shadow: insomnio.id, day: '2026-10-02' }, { shadow: insomnio.id, day: '2026-10-05' }, { shadow: rumiar.id, day: '2026-10-07' }, { shadow: insomnio.id, day: '2026-05-01' }, { shadow: insomnio.id, day: '2026-04-30' }];
  const rows = R.shadowStats([insomnio, rumiar], apps, [act('dormir-bien', '2026-10-03')], '2026-10-18');
  assert.deepEqual(plain(rows.map((r) => r.key)), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(plain(rows[5]), { key: '2026-10', purified: 1, open: 2 });
  assert.equal(rows[0].open, 1, 'abril queda fuera');
  assert.deepEqual(plain(R.shadowStats([insomnio, rumiar], apps, [], '2026-10-18', rumiar.id)[5]), { key: '2026-10', purified: 0, open: 1 }, 'las archivadas siguen en la frecuencia');
  assert.deepEqual(plain(R.shadowStats([insomnio], [], [], '2026-02-10').map((r) => r.key)), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
});

test('sombras: crear (con contrahechizos), apuntar una vez por día, deshacer y archivar, sin tocar nunca la XP', async () => {
  const { R, shadows, repo, fake } = make();
  await rejectsWith(shadows.create({ name: 'Insomnio', icon: 'moon', counters: [] }), 'invalid');
  await rejectsWith(shadows.create({ name: 'Insomnio', icon: 'moon', counters: ['no-existe'] }), 'invalid');
  await rejectsWith(shadows.create({ name: '', icon: 'moon', counters: ['dormir-bien'] }), 'invalid');
  const s = await shadows.create({ name: 'Insomnio', icon: 'moon', counters: ['dormir-bien', 'dormir-bien', 'meditar'] });
  assert.match(s.id, R.SHADOW_ID_RE); assert.deepEqual(plain(s.counters), ['dormir-bien', 'meditar']);
  await rejectsWith(shadows.create({ name: 'insomnio', icon: 'moon', counters: ['meditar'] }), 'invalid');
  const today = R.logicalDay();
  assert.equal((await shadows.appear(s.id, today, 'ficha')).duplicate, false);
  assert.equal((await shadows.appear(s.id, today, 'ficha')).duplicate, true, 'una por día');
  let st = await shadows.state(true);
  assert.equal(st.shadows[0].today.purified, false); assert.equal(st.aura, 'glitch');
  assert.equal((await repo.state(true)).computed.general.total, 0, 'apuntar una sombra no da ni quita XP');
  assert.equal([...fake.state.files.keys()].some((k) => k.startsWith('rpg/ledger-')), false, 'ni toca el registro');
  await shadows.unappear(s.id, today);
  st = await shadows.state(true);
  assert.equal(st.shadows[0].today, null); assert.equal(st.aura, null);
  await shadows.setArchived(s.id, true);
  await rejectsWith(shadows.appear(s.id, today), 'invalid');
  st = await shadows.state(true);
  assert.equal(st.shadows.length, 0); assert.equal(st.archived.length, 1);
  await shadows.dismissOffer(s.id);
  assert.equal((await shadows.state(true)).all[0].offerFrom, today);
});

test('sombras desde el diario: al guardar la página se apuntan para su día y las quitadas se borran', async () => {
  const { shadows } = make();
  const a = await shadows.create({ name: 'Insomnio', icon: 'moon', counters: ['dormir-bien'] });
  const b = await shadows.create({ name: 'Rumiar', icon: 'eye', counters: ['tarot'] });
  const day = '2026-10-12', ref = (s) => ({ id: s.id, name: s.name });
  let r = await shadows.syncDiary(day, [], [{ id: 'b_00000001', shadows: [ref(a)] }, { id: 'b_00000002', shadows: [ref(a), ref(b)] }]);
  assert.deepEqual(plain(r), { added: ['Insomnio', 'Rumiar'], removed: [] });
  let st = await shadows.state(true);
  assert.deepEqual(plain(st.appearances.map((x) => [x.shadow, x.day, x.from])), [[a.id, day, 'diario'], [b.id, day, 'diario']]);
  r = await shadows.syncDiary(day, [{ id: 'b_00000001', shadows: [ref(a), ref(b)] }], [{ id: 'b_00000001', shadows: [ref(a), ref(b)] }]);
  assert.deepEqual(plain(r), { added: [], removed: [] }, 'volver a guardar no cambia nada');
  r = await shadows.syncDiary(day, [{ id: 'b_00000001', shadows: [ref(a), ref(b)] }], [{ id: 'b_00000001', shadows: [ref(b)] }]);
  assert.deepEqual(plain(r), { added: [], removed: ['Insomnio'] });
  r = await shadows.syncDiary(day, [{ id: 'b_00000001', shadows: [ref(b)] }], []);
  assert.deepEqual(plain(r), { added: [], removed: ['Rumiar'] }, 'borrar la página las borra');
  st = await shadows.state(true);
  assert.equal(st.appearances.length, 0);
});

test('sombras: el archivo se lee con tolerancia y uno dañado no se toca', async () => {
  const { R, fake, shadows } = make();
  const data = R.buildShadows({ shadows: [insomnio, insomnio, { id: 'mal', name: 'x' }], appearances: [{ shadow: insomnio.id, day: '2026-10-01' }, { shadow: insomnio.id, day: '2026-10-01' }, { shadow: 'sh_99999999', day: '2026-10-01' }, { shadow: insomnio.id, day: 'ayer' }] });
  assert.equal(data.shadows.length, 1); assert.equal(data.appearances.length, 1);
  fake.state.files.set('rpg/shadows.json', JSON.stringify({ shadows: 'roto' }));
  await rejectsWith(shadows.state(true), 'invalid');
});

// ---- Rebalanceo: diario, topes, días, misiones y jefes ----
function connected(strict) {
  const fake = createFakeGithub();
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL, setTimeout, clearTimeout, fetch: fake.fetch, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  ctx.window = ctx; ctx.document = { documentElement: { dataset: {}, removeAttribute() {} } };
  for (const f of ['icons', 'ui', 'storage/errors', 'storage/github-adapter', 'storage/store', 'storage/connection', 'diary/entries', 'diary/repository', 'diary/drafts', 'rpg/config', 'rpg/model', 'rpg/repository', 'rpg/activities', 'rpg/weekly', 'rpg/bosses', 'rpg/todos', 'rpg/growth']) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  if (!strict) ctx.App.rpg.CONFIG.activity.daysBack = 100000;
  return { App: ctx.App, R: ctx.App.rpg, fake };
}

test('escribir en el diario: 10 XP una vez al día, solo la página de hoy, solo al nivel general; fijos salvo si se borra la página', async () => {
  const { App, R, fake } = connected();
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const today = R.today(), text = [{ id: 'b_00000001', text: 'Hoy ha sido raro' }];
  assert.equal(await R.recordDiaryWriting(today, [{ id: 'b_00000001', text: '   ', mood: 'bien' }]), null, 'sin texto (solo ánimo) no da nada');
  const e = await R.recordDiaryWriting(today, text);
  assert.equal(e.xp, 10); assert.equal(e.kind, 'diary'); assert.equal(e.key, 'diary:' + today); assert.deepEqual(plain(e.splits), [], 'solo al nivel general');
  assert.equal(await R.recordDiaryWriting(today, [{ id: 'b_00000002', text: 'Otro bloque' }]), null, 'una sola vez al día');
  assert.equal(await R.recordDiaryWriting('2026-01-05', text), null, 'una página de otro día no da XP');
  const res = await R.recordDiaryActivities(today, text);
  assert.equal(res.logged.length, 0, 'volver a guardar no suma');
  assert.equal((await R.repo().state(true)).computed.general.total, 10);
  // Una vez ganados, se quedan fijos: editar o quitar el texto no los toca ni pregunta. Solo borrar la página los quita.
  assert.equal((await R.diaryRemovals(text, [{ id: 'b_00000001', text: '', mood: 'bien' }], today)).length, 0, 'quitar el texto no quita nada');
  assert.equal((await R.diaryRemovals(text, [{ id: 'b_00000001', text: 'cambiado' }], today)).length, 0, 'cambiar el texto no quita nada');
  const items = await R.diaryRemovals(text, null, today);   // la página se borra
  assert.deepEqual(plain(items.map((it) => [it.kind, it.xp])), [['diary', 10]]);
  await R.applyDiaryRemovals(items);
  assert.equal((await R.repo().state(true)).computed.general.total, 0);
  assert.equal((await R.recordDiaryWriting(today, text)).xp, 10, 'escribir otra vez lo da otra vez (una sola)');
  assert.throws(() => R.sanitizeEntry({ kind: 'diary', key: 'diary:' + today, label: 'x', xp: 50 }, R.buildStructure(null)), /diario/);
});

test('actividades: solo las 10 primeras del día dan XP; las siguientes se registran con 0 XP y cuentan para las misiones', async () => {
  const { acts, repo, weekly, R } = make();
  const day = '2026-10-14';
  const m = await weekly.create({ name: 'Leer', size: 'normal', shares: [], mode: 'activity', activities: ['leer-libro'], target: 1 });
  const ids = ['gimnasio', 'cardio', 'comer-bien', 'dormir-bien', 'skincare', 'arreglarme', 'estudiar', 'leer-comic', 'tarot', 'meditar'];
  for (const [i, id] of ids.entries()) await acts.log(id, { req: 'r' + i, day });
  const extra = await acts.log('leer-libro', { req: 'r11', day });
  assert.equal(extra.entry.xp, 0); assert.equal(extra.entry.capped, true); assert.deepEqual(plain(extra.entry.splits), []);
  assert.equal((await repo.state(true)).computed.general.total, 50, 'como mucho 50 XP de actividades al día');
  assert.equal((await acts.log('gimnasio', { req: 'r12', day: '2026-10-15' })).entry.xp, 5, 'otro día, otro cupo');
  const s = await weekly.state(true, '2026-W42');
  assert.equal(s.missions.find((x) => x.id === m.id).count, 1, 'la de 0 XP cuenta para la misión');
  assert.throws(() => R.sanitizeEntry({ kind: 'manual', key: 'manual:z', label: 'x', xp: 0, capped: true }, R.buildStructure(null)), /entero distinto de 0/);
});

test('actividades: solo se pueden apuntar hoy o ayer', async () => {
  const { acts, R } = make(createFakeGithub(), { strict: true });
  const today = R.today();
  assert.equal((await acts.log('gimnasio', { req: 'a', day: today })).entry.xp, 5);
  assert.equal((await acts.log('gimnasio', { req: 'b', day: R.shiftDay(today, -1) })).entry.xp, 5);
  await rejectsWith(acts.log('gimnasio', { req: 'c', day: R.shiftDay(today, -2) }), 'invalid');
  await rejectsWith(acts.log('gimnasio', { req: 'd', day: R.shiftDay(today, 1) }), 'invalid');
  await rejectsWith(acts.logOnce({ name: 'Patinar', points: [{ sub: 'resistencia', xp: 5 }], req: 'e', day: R.shiftDay(today, -3) }), 'invalid');
  const old = await acts.logBlocks(R.shiftDay(today, -5), [{ id: 'b_00000001', activities: ['gimnasio'] }]);
  assert.equal(old.logged.length, 0); assert.equal(old.oldPage, true, 'una página vieja se queda como está, sin XP');
});

test('«haz N veces»: una por actividad y día; una semanal puede valer con varias actividades', async () => {
  const { acts, weekly, R } = make();
  const m = await weekly.create({ name: 'Hacer ejercicio', size: 'normal', shares: [], mode: 'activity', activities: ['gimnasio', 'cardio'], target: 3 });
  assert.deepEqual(plain(m.activities), ['gimnasio', 'cardio']);
  await acts.log('gimnasio', { req: 'a', day: MON }); await acts.log('gimnasio', { req: 'b', day: MON }); await acts.log('gimnasio', { req: 'c', day: MON });
  let v = (await weekly.state(true, WEEK)).missions[0];
  assert.equal(v.count, 1, 'tres veces el mismo día cuentan una');
  await acts.log('cardio', { req: 'd', day: MON });
  v = (await weekly.state(true, WEEK)).missions[0];
  assert.equal(v.count, 2, 'otra actividad el mismo día sí cuenta');
  await acts.log('cardio', { req: 'e', day: '2026-10-15' });
  assert.equal((await weekly.sync([WEEK])).length, 1, 'gimnasio + correr + correr otro día = 3');
  // Las misiones de antes (con una sola `activity`) siguen funcionando.
  assert.deepEqual(plain(R.weeklyActivities({ activity: 'gimnasio' })), ['gimnasio']);
  await rejectsWith(weekly.create({ name: 'X', size: 'normal', shares: [], mode: 'activity', activities: [], target: 2 }), 'invalid');
});

test('misiones semanales: como mucho 5 activas a la vez', async () => {
  const { weekly } = make();
  const mk = (i) => weekly.create({ name: 'M' + i, size: 'pequena', shares: [], mode: 'checks', target: 1 });
  for (let i = 0; i < 5; i++) await mk(i);
  await rejectsWith(mk(5), 'invalid');
  const s = await weekly.state(true);
  await weekly.remove(s.missions[0].id);
  assert.equal((await mk(6)).name, 'M6', 'al quitar una, se puede crear otra');
});

test('jefes: su premio grande se cobra a partir de 7 / 14 / 30 días desde que lo creas; los pasos dan sus 5 XP al momento', async () => {
  const fake = createFakeGithub();
  const { bosses, repo, R } = make(fake, { strict: true });
  assert.deepEqual(plain(R.BOSS_TIERS.map((t) => [t.id, t.xp, t.days])), [['jefe', 250, 7], ['mayor', 400, 14], ['final', 600, 30]]);
  const b = await bosses.create({ name: 'Meta grande', tier: 'jefe', shares: [], steps: [{ text: 'Paso único' }] });
  const ev = await bosses.completeStep(b.id, b.steps[0].id);
  assert.deepEqual(plain(ev.map((e) => e.type)), ['step'], 'sin derrota todavía');
  let v = (await bosses.state(true)).bosses[0];
  assert.equal(v.allDone, true); assert.equal(v.defeated, false); assert.equal(v.unlocked, false);
  assert.equal(v.unlockDay, R.shiftDay(R.today(), 7));
  assert.equal((await repo.state(true)).computed.general.total, 5);
  // Pasan los días (se fecha la creación 7 días antes): la siguiente comprobación da la derrota.
  const doc = JSON.parse(fake.state.files.get('rpg/bosses.json'));
  doc.bosses[0].createdAt = R.shiftDay(R.today(), -7) + 'T10:00:00.000Z';
  fake.state.files.set('rpg/bosses.json', JSON.stringify(doc));
  const again = make(fake, { strict: true });
  const ev2 = await again.bosses.sync();
  assert.deepEqual(plain(ev2.map((e) => [e.type, e.xp])), [['boss', 250]]);
  assert.equal((await again.repo.state(true)).computed.general.total, 255);
});

// ---- Fase 4: XP descansada, atributo dormido y rasgos ----
const ent = (day, extra = {}) => ({ key: 'k:' + day + ':' + Math.random(), kind: 'activity', activity: 'gimnasio', day, xp: 5, splits: [{ sub: 'fuerza', xp: 5 }], ...extra });

test('XP descansada: tras 3 días o más sin apuntar, al volver (ese día y el siguiente) las 3 primeras actividades dan +5', () => {
  const { R } = make();
  assert.equal(R.restState([], '2026-10-07'), null, 'sin historial no hay descanso');
  assert.equal(R.restState([ent('2026-10-06'), ent('2026-10-07')], '2026-10-07'), null, 'la primera racha no viene de descansar');
  assert.deepEqual(plain(R.restState([ent('2026-10-02')], '2026-10-06')), { state: 'pending', days: 3, left: 3 }, '3 días vacíos: lo próximo lo activa');
  assert.equal(R.restState([ent('2026-10-03')], '2026-10-06'), null, 'con 2 días vacíos, no');
  const back = [ent('2026-10-01'), ent('2026-10-02'), ent('2026-10-07')];
  assert.deepEqual(plain(R.restState(back, '2026-10-07')), { state: 'active', start: '2026-10-07', until: '2026-10-08', days: 4, left: 3 });
  assert.equal(R.restState(back, '2026-10-08').left, 3, 'también el día siguiente');
  assert.equal(R.restState(back, '2026-10-09'), null, 'pasadas las 48 h, ya no');
  const used = back.concat([1, 2, 3].map((i) => ({ key: 'rested:x' + i, kind: 'rested', day: '2026-10-07', xp: 5 })));
  assert.equal(R.restState(used, '2026-10-07'), null, 'ya usadas las 3');
});

test('XP descansada: se apunta aparte, no gasta el cupo de 10 y se va con su actividad', async () => {
  const { acts, repo, R } = make();
  const today = R.today();
  await acts.log('gimnasio', { req: 'old', day: R.shiftDay(today, -5) });
  const got = [];
  for (const id of ['gimnasio', 'cardio', 'meditar', 'tarot']) got.push(await acts.log(id, { req: 'n' + id, day: today }));
  assert.deepEqual(plain(got.map((r) => !!r.rested)), [true, true, true, false], 'solo las 3 primeras');
  assert.equal(got[0].rested.kind, 'rested'); assert.equal(got[0].rested.key, 'rested:' + got[0].entry.key);
  assert.deepEqual(plain(got[0].rested.splits), plain(got[0].entry.splits), 'a las mismas subcategorías');
  assert.equal((await repo.state(true)).computed.general.total, 5 + 4 * 5 + 3 * 5);
  assert.equal(R.activitiesWithXp((await repo.state()).entries, today), 4, 'el extra no cuenta como actividad');
  await repo.removeEntry(got[0].entry.key);
  assert.equal((await repo.state(true)).computed.general.total, 5 + 3 * 5 + 2 * 5, 'borrar la actividad quita también su extra');
});

test('atributo dormido: el que menos XP ha recibido estos 7 días; una misión diaria es suya con el sello «Despierta»', async () => {
  const { R, repo, daily } = make();
  const st = R.buildStructure(null), today = R.today();
  assert.equal(R.dormantMain(st, [], today), null, 'sin XP esta semana, ninguno');
  const subs = ['fuerza', 'conocimiento', 'amistad', 'arte', 'logica', 'finanzas'];   // de todos menos Aventura
  const week = subs.map((s, i) => ent(R.shiftDay(today, -i), { splits: [{ sub: s, xp: 5 }] }));
  assert.equal(R.dormantMain(st, week.concat([ent(R.shiftDay(today, -9), { splits: [{ sub: 'valentia', xp: 50 }] })]), today).id, 'aventura', 'lo de hace más de 7 días no cuenta');
  for (const [i, s] of subs.entries()) await repo.addEntry({ kind: 'manual', key: 'manual:w' + i, label: 'x', xp: 5, shares: [{ sub: s, pct: 100 }], day: today });
  const d = await daily.state();
  const wake = d.missions.filter((m) => m.wake);
  assert.equal(wake.length, 1); assert.equal(R.findSub(st, wake[0].sub).main.id, 'aventura');
  assert.equal(wake[0].xp, R.sizeXp(wake[0].size), 'misma XP que las demás');
  const swapped = await daily.reroll(wake[0].id);
  assert.equal(swapped.wake, true); assert.equal(R.findSub(st, swapped.sub).main.id, 'aventura', 'el dado la cambia por otra del mismo atributo');
});

test('rasgos: salen del historial (horas, días, variedad, rituales, sombras) y, conseguidos, son para siempre', () => {
  const { R } = make();
  const at = (day, h) => { const [y, m, dd] = day.split('-').map(Number); return new Date(y, m - 1, dd, h, 0).toISOString(); };
  const days = (n, from = '2026-09-01') => Array.from({ length: n }, (_, i) => R.shiftDay(from, i));
  const by = (list) => Object.fromEntries(R.traitsState(list, null, '2026-12-31').map((t) => [t.id, t]));
  // Noctámbula: 10 actividades entre las 22:00 y las 3:00 en 30 días (la 1:00 también cuenta).
  const night = days(10).map((d, i) => ent(d, { at: at(d, i % 2 ? 1 : 23) }));
  let t = by(night);
  assert.equal(t.noctambula.earned, true); assert.equal(t.noctambula.earnedOn, '2026-09-10');
  assert.equal(by(night.slice(0, 9)).noctambula.earned, false);
  const spread = days(10).map((d, i) => ent(R.shiftDay('2026-09-01', i * 4), { at: at(d, 23) }));   // 10 en 37 días
  assert.equal(by(spread).noctambula.earned, false, 'tienen que caber en 30 días');
  // Para siempre: dos meses después, sin nada nuevo, sigue conseguido; el progreso de ahora vuelve a 0.
  t = R.traitsState(night, null, '2026-12-31').find((x) => x.id === 'noctambula');
  assert.equal(t.earned, true); assert.equal(t.progress, 0);
  // Exploradora: 10 actividades distintas; Hilo firme: 20 días distintos.
  const ids = ['gimnasio', 'cardio', 'comer-bien', 'dormir-bien', 'skincare', 'arreglarme', 'estudiar', 'leer-libro', 'leer-comic', 'tarot'];
  assert.equal(by(ids.map((a, i) => ent(R.shiftDay('2026-09-01', i), { activity: a, at: at('2026-09-01', 12) }))).exploradora.earned, true);
  assert.equal(by(ids.map((a, i) => ent(R.shiftDay('2026-09-01', i), { activity: 'gimnasio', at: at('2026-09-01', 12) }))).exploradora.earned, false, 'la misma no vale');
  assert.equal(by(days(20).map((d) => ent(d, { at: at(d, 12) }))).hilo_firme.earned, true);
  const firm = R.traitsState(days(19).map((d) => ent(d, { at: at(d, 12) })), null, '2026-09-25').find((x) => x.id === 'hilo_firme');
  assert.equal(firm.earned, false); assert.equal(firm.progress, 19, 'progreso: lo de los últimos 30 días');
  // Bruja del alba: 5 rituales antes de las 9:00 (en total, sin ventana).
  const rituals = [0, 40, 80, 120, 160].map((n) => { const d = R.shiftDay('2026-01-01', n); return ent(d, { activity: 'tarot', splits: [{ sub: 'brujeria', xp: 5 }], at: at(d, 7) }); });
  assert.equal(by(rituals).bruja_alba.earned, true);
  // Corazón remendado: 5 sombras purificadas.
  const sh = { id: 'sh_0000000a', name: 'Insomnio', icon: 'moon', counters: ['dormir-bien'], archived: false };
  const apps = days(5).map((d) => ({ shadow: sh.id, day: d }));
  const counter = days(5).map((d) => ent(d, { activity: 'dormir-bien', at: at(d, 12) }));
  const cr = R.traitsState(counter, { all: [sh], appearances: apps }, '2026-12-31').find((x) => x.id === 'corazon_remendado');
  assert.equal(cr.earned, true);
  assert.equal(R.traitsState(counter, null, '2026-12-31').find((x) => x.id === 'corazon_remendado').earned, false, 'sin sombras, no');
});

test('rasgos secretos: Luna llena, Hilo de vuelta y Criatura de medianoche', () => {
  const { R } = make();
  const at = (day, h, m = 0) => { const [y, mo, d] = day.split('-').map(Number); return new Date(y, mo - 1, d, h, m).toISOString(); };
  const by = (list) => Object.fromEntries(R.traitsState(list, null, '2026-12-31').map((x) => [x.id, x]));
  assert.deepEqual(plain(R.TRAITS.filter((x) => x.secret).map((x) => x.id)), ['luna_llena', 'hilo_de_vuelta', 'criatura_medianoche']);
  // Luna llena: el mismo día, diario + las tres diarias + la lista completa.
  const d = '2026-10-05', base = [{ key: 'diary:' + d, kind: 'diary', day: d, xp: 10, at: at(d, 12) }, { key: 'daily:' + d, kind: 'quest', day: d, xp: 15, at: at(d, 12) }];
  assert.equal(by(base).luna_llena.earned, false, 'falta la lista');
  const full = by(base.concat([{ key: 'todo:tl_0000000a', kind: 'quest', day: d, xp: 20, at: at(d, 12) }]));
  assert.equal(full.luna_llena.earned, true); assert.equal(full.luna_llena.earnedOn, d);
  // Hilo de vuelta: algo apuntado tras 14 días sin nada.
  const e = (day, h = 12, m = 0) => ent(day, { at: at(day, h, m) });
  assert.equal(by([e('2026-09-01'), e('2026-09-15')]).hilo_de_vuelta.earned, false, '13 días vacíos: aún no');
  assert.equal(by([e('2026-09-01'), e('2026-09-16')]).hilo_de_vuelta.earnedOn, '2026-09-16');
  // Criatura de medianoche: entre las 0:00 y las 0:05.
  assert.equal(by([e('2026-09-01', 0, 4)]).criatura_medianoche.earned, true);
  assert.equal(by([e('2026-09-01', 0, 5), e('2026-09-02', 23, 59)]).criatura_medianoche.earned, false);
});

test('jefes: con todos los pasos hechos antes de tiempo queda «Derrotado» con el botín lacrado; sus pasos y su edición, fijos', async () => {
  const { bosses, R } = make(createFakeGithub(), { strict: true });
  const b = await bosses.create({ name: 'Meta', tier: 'mayor', shares: [], steps: [{ text: 'Uno' }] });
  let v = (await bosses.state(true)).bosses[0];
  assert.equal(v.sealed, false, 'con pasos pendientes, todavía no');
  await bosses.completeStep(b.id, b.steps[0].id);
  v = (await bosses.state(true)).bosses[0];
  assert.equal(v.sealed, true); assert.equal(v.defeated, false); assert.equal(v.daysLeft, 14);
  await rejectsWith(bosses.uncompleteStep(b.id, b.steps[0].id), 'invalid');
  await rejectsWith(bosses.update(b.id, { name: 'Otra', tier: 'jefe', shares: [], steps: [{ text: 'Uno' }] }), 'invalid');
});

test('subida de nivel: premios entre dos niveles (marcos, títulos y fondos) y estrellas de la constelación en el marco', () => {
  const ctx = vm.createContext({ btoa, atob, crypto: globalThis.crypto, URL });
  ctx.window = ctx;
  for (const f of [...FILES, 'views/rpg/pickers', 'views/rpg/avatar', 'views/rpg/levelup']) vm.runInContext(read(`js/${f}.js`), ctx, { filename: f });
  const V = ctx.App.rpgViews;
  assert.deepEqual(plain(V.levelUp.rewards(8, 10, 'f').map((x) => [x.kind, x.name])), [['Marco nuevo', 'Puntada doble'], ['Fondo nuevo', 'Acolchado ciruela']]);
  assert.deepEqual(plain(V.levelUp.rewards(6, 7, 'm').map((x) => x.name)), ['Muñeco susurrante']);
  assert.equal(V.levelUp.rewards(10, 11, 'f').length, 0);
  assert.equal(V.starsSvg(0), '');
  assert.equal((V.starsSvg(5).match(/class="fr-star"/g) || []).length, 5);
  const many = V.starsSvg(15);
  assert.equal((many.match(/class="fr-star"/g) || []).length, 12, 'como mucho 12 se ven'); assert.match(many, /✦ 15/);
  assert.match(V.avatar({ avatar: 'moon' }, 30, { stars: 2 }), /2 estrellas en su constelación/);
  for (const fr of ctx.App.rpg.AVATAR_FRAMES) assert.ok(!/NaN/.test(V.frameSvg(fr.id)), fr.id + ' sin números rotos');
});

test('copia de seguridad: exportar e importar en un repositorio vacío conserva todo el personaje', async () => {
  const fake = createFakeGithub();
  const { repo, acts, todos, shadows, store, R } = make(fake);
  await repo.saveProfile({ name: 'Yo', avatar: 'moon', form: 'n', background: 'papel' });
  await acts.log('gimnasio', { req: 'a', day: '2026-10-12' });
  await todos.addTask({ text: 'Regar' });
  const s = await shadows.create({ name: 'Insomnio', icon: 'moon', counters: ['dormir-bien'] });
  await shadows.appear(s.id, '2026-10-12');
  const bundle = await store.exportBundle();
  for (const p of ['rpg/profile.json', 'rpg/todos.json', 'rpg/shadows.json']) assert.ok(bundle.files[p], 'la copia incluye ' + p);
  assert.ok(Object.keys(bundle.files).some((p) => /^rpg\/ledger-\d{4}\.json$/.test(p)), 'y el registro de XP');
  // A un repositorio de prueba vacío.
  const other = make();
  await other.store.applyImport(JSON.parse(JSON.stringify(bundle)), { overwrite: false });
  const a = await repo.state(true), b = await other.repo.state(true);
  assert.equal(b.computed.general.total, a.computed.general.total); assert.equal(b.profile.form, 'n');
  assert.equal((await other.shadows.state(true)).appearances.length, 1);
  assert.equal((await other.todos.state(true)).list.tasks[0].text, 'Regar');
});

test('diario: la página de ayer también da sus 10 XP (una vez); la de anteayer, no', async () => {
  const { App, R, fake } = connected();
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const text = [{ id: 'b_00000001', text: 'Ayer no pude escribir' }], yesterday = R.shiftDay(R.today(), -1);
  assert.equal((await R.recordDiaryWriting(yesterday, text)).xp, 10);
  assert.equal(await R.recordDiaryWriting(yesterday, text), null, 'una sola vez por día');
  assert.equal(await R.recordDiaryWriting(R.shiftDay(R.today(), -2), text), null);
});

test('sombras: se pueden apuntar y quitar en días pasados (desde la tira), pero no en el futuro', async () => {
  const { shadows, R } = make();
  const s = await shadows.create({ name: 'Rumiar', icon: 'spark', counters: ['tarot'] });
  const d = R.shiftDay(R.logicalDay(), -5);
  await shadows.appear(s.id, d, 'ficha');
  let v = (await shadows.state(true)).shadows[0];
  assert.equal(v.strip.find((x) => x.day === d).state, 'ap');
  await shadows.unappear(s.id, d);
  v = (await shadows.state(true)).shadows[0];
  assert.equal(v.strip.find((x) => x.day === d).state, 'none');
  await rejectsWith(shadows.appear(s.id, R.shiftDay(R.today(), 1)), 'invalid');
});

test('símbolos: una sola galería para todo, con lo que ya había, y una sola caja', () => {
  const { App, R } = make();
  const before = ['heart', 'dumbbell', 'leaf', 'bolt', 'moon', 'mirror', 'star', 'book', 'key', 'tarot', 'spark', 'eye', 'people', 'butterfly', 'rose', 'locket', 'bow', 'compass', 'sun', 'candle', 'umbrella', 'pencil', 'film', 'ghost', 'skull', 'cat', 'cross', 'cherry', 'cloud', 'drop', 'crown', 'flower', 'mended', 'globe', 'speech', 'coin', 'briefcase', 'flag'];
  for (const id of before) assert.ok(App.isSymbol(id), id + ' sigue valiendo');
  assert.equal(R.ICONS, App.SYMBOL_IDS); assert.equal(R.AVATARS, App.SYMBOL_IDS, 'atributos, actividades, sombras y avatar: la misma galería');
  assert.equal(new Set(App.SYMBOL_IDS).size, App.SYMBOL_IDS.length, 'sin repetidos');
  assert.ok(App.SYMBOLS.every((s) => s.label));
  const html = App.ui.symbolPicker({ name: 'x', value: 'moon' });
  assert.equal((html.match(/type="radio"/g) || []).length, App.SYMBOL_IDS.length);
  assert.match(html, /value="moon" checked/); assert.match(html, /class="sym-box" hidden/, 'al editar, cerrada');
  assert.doesNotMatch(App.ui.symbolPicker({ name: 'x', value: 'moon', open: true }), /class="sym-box" hidden/, 'al crear, abierta');
  const withInitial = App.ui.symbolPicker({ name: 'p', value: '', extra: [{ id: '', label: 'La inicial del nombre', html: 'Aa' }] });
  assert.match(withInitial, /value="" checked/);
});
