// Pruebas de la capa de almacenamiento contra un GitHub de mentira (sin red).
// Ejecutar con: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createFakeGithub } from './helpers/fake-github.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function loadStorage(fake, extra = {}) {
  const ctx = vm.createContext({ btoa, atob, fetch: fake?.fetch, ...extra });
  ctx.window = ctx;
  for (const f of ['errors', 'github-adapter', 'store', 'connection']) {
    vm.runInContext(read(`js/storage/${f}.js`), ctx, { filename: f });
  }
  return ctx.App;
}
const memoryStorage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
};
const adapterFor = (App, fake, token = 'good') =>
  App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token, fetch: fake.fetch });
// Los objetos creados dentro del contexto aislado tienen otros prototipos: se pasan por JSON para compararlos.
const plain = (x) => JSON.parse(JSON.stringify(x));
const rejectsWith = (promise, code) => assert.rejects(promise, (e) => { assert.equal(e.code, code, e.message); return true; });

test('el adaptador guarda y lee texto con acentos y emojis', async () => {
  const fake = createFakeGithub(); const App = loadStorage(fake); const a = adapterFor(App, fake);
  const text = '{"texto":"Querido diario, hoy me sentí rara 🎀 ñandú"}';
  await a.write('entries/2026-10.json', text, { message: 'prueba' });
  assert.equal((await a.read('entries/2026-10.json')).text, text);
  assert.equal(await a.read('no-existe.json'), null);
});

test('los archivos grandes (encoding "none") se leen en bruto', async () => {
  const fake = createFakeGithub({ files: { 'grande.json': '{"a":1}' }, bigFiles: ['grande.json'] });
  const App = loadStorage(fake);
  assert.equal((await adapterFor(App, fake).read('grande.json')).text, '{"a":1}');
});

test('errores de GitHub traducidos: token, permisos, repositorio, red y límite', async () => {
  const fake = createFakeGithub(); const App = loadStorage(fake);
  await rejectsWith(adapterFor(App, fake, 'mal').getRepo(), 'auth');
  const noRepo = App.createGithubAdapter({ owner: 'otra', repo: 'cosa', branch: 'main', token: 'good', fetch: fake.fetch });
  await rejectsWith(noRepo.getRepo(), 'notfound');
  fake.state.rateLimited = true;
  await rejectsWith(adapterFor(App, fake).getRepo(), 'ratelimit');
  fake.state.rateLimited = false; fake.state.offline = true;
  await rejectsWith(adapterFor(App, fake).getRepo(), 'network');
});

test('actualizar sin sha o con sha viejo da conflicto, nunca pisa en silencio', async () => {
  const fake = createFakeGithub({ files: { 'a.json': '{"v":1}' } }); const App = loadStorage(fake); const a = adapterFor(App, fake);
  await rejectsWith(a.write('a.json', '{"v":2}', {}), 'conflict');
  await rejectsWith(a.write('a.json', '{"v":2}', { sha: 'viejo' }), 'conflict');
  assert.equal(fake.state.files.get('a.json'), '{"v":1}');
});

test('writeJson no pisa un archivo existente que no se ha leído; con force sí', async () => {
  const fake = createFakeGithub({ files: { 'a.json': '{"v":1}\n' } }); const App = loadStorage(fake);
  const store = App.createStore(adapterFor(App, fake));
  await rejectsWith(store.writeJson('a.json', { v: 2 }), 'conflict');
  await store.writeJson('a.json', { v: 2 }, { force: true });
  assert.deepEqual(JSON.parse(fake.state.files.get('a.json')), { v: 2 });
});

test('updateJson reintenta y fusiona si otro dispositivo escribe a la vez', async () => {
  const fake = createFakeGithub({ files: { 'lista.json': JSON.stringify({ items: ['a'] }) } });
  const App = loadStorage(fake); const store = App.createStore(adapterFor(App, fake));
  let interfered = false;
  fake.state.beforePut = (path, body, st) => {      // justo antes de nuestra escritura, "otro móvil" añade 'b'
    if (!interfered) { interfered = true; st.files.set('lista.json', JSON.stringify({ items: ['a', 'b'] })); }
  };
  const result = await store.updateJson('lista.json', (d) => ({ items: [...d.items, 'c'] }), { fallback: { items: [] } });
  assert.deepEqual(plain(result).items, ['a', 'b', 'c']);
  assert.deepEqual(JSON.parse(fake.state.files.get('lista.json')).items, ['a', 'b', 'c']);
});

test('updateJson crea el archivo si no existe usando el valor por defecto', async () => {
  const fake = createFakeGithub(); const App = loadStorage(fake); const store = App.createStore(adapterFor(App, fake));
  await store.updateJson('nuevo.json', (d) => ({ n: d.n + 1 }), { fallback: { n: 0 } });
  assert.deepEqual(JSON.parse(fake.state.files.get('nuevo.json')), { n: 1 });
});

test('las escrituras van de una en una aunque se pidan a la vez', async () => {
  const fake = createFakeGithub(); const App = loadStorage(fake); const store = App.createStore(adapterFor(App, fake));
  await Promise.all(['a', 'b', 'c', 'd'].map((n) => store.writeJson(`${n}.json`, { n })));
  assert.equal(fake.state.files.size, 4);
  assert.equal(fake.state.maxInFlight, 1);
});

test('solo se aceptan rutas .json seguras', async () => {
  const fake = createFakeGithub(); const App = loadStorage(fake); const store = App.createStore(adapterFor(App, fake));
  for (const bad of ['../x.json', '/x.json', 'a b.json', 'x.txt', 'a//b.json', '.git/x.json', 'a/../b.json', '__proto__']) {
    await rejectsWith(store.readJson(bad), 'invalid');
  }
  assert.equal(fake.state.calls.length, 0, 'no debe llegar ninguna petición');
  assert.ok(App.validStoragePath('entries/2026-10.json'));
});

test('connect rechaza repositorios públicos, sin permiso o con otros archivos', async () => {
  const App = loadStorage(createFakeGithub(), { localStorage: memoryStorage() });
  const attempt = (fake, over = {}) => {
    const A = loadStorage(fake, { localStorage: memoryStorage() });
    return A.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch, ...over });
  };
  await rejectsWith(attempt(createFakeGithub({ isPrivate: false })), 'public-repo');
  await rejectsWith(attempt(createFakeGithub({ canPush: false })), 'forbidden');
  await rejectsWith(attempt(createFakeGithub({ files: { 'index.html': '<html>', 'js/app.js': '' } })), 'invalid');
  await rejectsWith(attempt(createFakeGithub(), { token: 'mal' }), 'auth');
  await rejectsWith(attempt(createFakeGithub(), { repo: 'no es un repo' }), 'invalid');
  assert.ok(App.connection);
});

test('connect crea meta.json en un repositorio vacío y es idempotente', async () => {
  const fake = createFakeGithub(); const ls = memoryStorage(); const App = loadStorage(fake, { localStorage: ls });
  const first = await App.connection.connect({ repo: 'https://github.com/ana/diario-datos.git', token: 'good', fetch: fake.fetch });
  assert.equal(first.repo, 'ana/diario-datos');
  const meta = JSON.parse(fake.state.files.get('meta.json'));
  assert.equal(meta.app, 'diario-rpg'); assert.match(meta.userId, /^u_[0-9a-f]{16}$/);
  const again = await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  assert.equal(again.meta.userId, meta.userId, 'no debe crear otro usuario');
});

test('un repositorio con solo README y licencia se acepta', async () => {
  const fake = createFakeGithub({ files: { 'README.md': '# datos', LICENSE: 'MIT' } });
  const App = loadStorage(fake, { localStorage: memoryStorage() });
  await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  assert.ok(fake.state.files.has('meta.json'));
});

test('el token solo se guarda en el navegador si se marca "recordar"', async () => {
  for (const remember of [true, false]) {
    const fake = createFakeGithub(); const ls = memoryStorage(); const App = loadStorage(fake, { localStorage: ls });
    await App.connection.connect({ repo: 'ana/diario-datos', token: 'good', remember, fetch: fake.fetch });
    const saved = JSON.parse(ls.getItem('diario-rpg.conn.v1'));
    assert.equal(saved.token, remember ? 'good' : undefined);
    assert.equal(App.connection.describe().state, 'connected');
    App.connection.disconnect();
    assert.equal(ls.getItem('diario-rpg.conn.v1'), null, 'desconectar borra la configuración y el token');
    assert.equal(App.connection.getStore(), null);
  }
});

test('los mensajes de error nunca contienen el token', async () => {
  const secret = 'github_pat_SECRETO123';
  const fake = createFakeGithub({ isPrivate: false, token: secret }); const App = loadStorage(fake, { localStorage: memoryStorage() });
  const err = await App.connection.connect({ repo: 'ana/diario-datos', token: secret, fetch: fake.fetch }).catch((e) => e);
  assert.ok(!err.message.includes(secret));
  assert.ok(!JSON.stringify(App.connection.describe()).includes(secret));
});

test('al reabrir, init recupera la configuración y check la verifica', async () => {
  const fake = createFakeGithub(); const ls = memoryStorage();
  await loadStorage(fake, { localStorage: ls }).connection.connect({ repo: 'ana/diario-datos', token: 'good', fetch: fake.fetch });
  const App2 = loadStorage(fake, { localStorage: ls });
  assert.equal(App2.connection.init().state, 'configured');
  assert.equal((await App2.connection.check(fake.fetch)).state, 'connected');
  fake.state.offline = true;
  const App3 = loadStorage(fake, { localStorage: ls }); App3.connection.init();
  const failed = await App3.connection.check(fake.fetch);
  assert.equal(failed.state, 'error'); assert.match(failed.message, /conexión/);
});

test('exportar e importar devuelve exactamente los mismos datos', async () => {
  const files = { 'meta.json': '{"app":"diario-rpg"}', 'entries/2026-10.json': JSON.stringify({ e: ['hola 🎀'] }), 'people.json': '[]' };
  const src = createFakeGithub({ files }); const A = loadStorage(src); const s1 = A.createStore(adapterFor(A, src));
  const bundle = await s1.exportBundle();
  assert.equal(bundle.format, 'diario-rpg-export');
  assert.deepEqual(Object.keys(bundle.files).sort(), ['entries/2026-10.json', 'meta.json', 'people.json']);
  assert.deepEqual(plain(bundle.files['entries/2026-10.json']), { e: ['hola 🎀'] });

  const dst = createFakeGithub(); const B = loadStorage(dst); const s2 = B.createStore(adapterFor(B, dst));
  const plan = await s2.planImport(JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(plain(plan.files).map((f) => f.status), ['new', 'skipped', 'new']);
  const out = await s2.applyImport(JSON.parse(JSON.stringify(bundle)), { overwrite: false });
  assert.deepEqual([out.written, out.skipped, out.failed], [2, 1, null]);
  assert.deepEqual(JSON.parse(dst.state.files.get('entries/2026-10.json')), { e: ['hola 🎀'] });
  assert.ok(!dst.state.files.has('meta.json'), 'meta.json del destino nunca se sustituye');
});

test('importar sin "sobrescribir" no toca lo que ya existe; con sobrescribir sí', async () => {
  const fake = createFakeGithub({ files: { 'people.json': '["viejo"]' } }); const A = loadStorage(fake); const s = A.createStore(adapterFor(A, fake));
  const bundle = { format: 'diario-rpg-export', formatVersion: 1, files: { 'people.json': ['nuevo'] } };
  assert.equal((await s.applyImport(bundle, { overwrite: false })).skipped, 1);
  assert.equal(fake.state.files.get('people.json'), '["viejo"]');
  assert.equal((await s.applyImport(bundle, { overwrite: true })).written, 1);
  assert.deepEqual(JSON.parse(fake.state.files.get('people.json')), ['nuevo']);
});

test('una copia malformada o peligrosa se rechaza antes de escribir nada', async () => {
  const fake = createFakeGithub(); const A = loadStorage(fake); const s = A.createStore(adapterFor(A, fake));
  const base = { format: 'diario-rpg-export', formatVersion: 1 };
  for (const bad of [null, [], 'texto', { format: 'otra-cosa', files: {} }, { ...base, formatVersion: 99, files: {} },
    { ...base }, { ...base, files: [] }, { ...base, files: { '../fuera.json': {} } }, { ...base, files: { 'a.txt': {} } },
    JSON.parse('{"format":"diario-rpg-export","formatVersion":1,"files":{"__proto__":{}}}')]) {
    assert.equal((await s.planImport(bad)).ok, false, JSON.stringify(bad));
    await rejectsWith(s.applyImport(bad, { overwrite: true }), 'invalid');
  }
  assert.equal(fake.state.files.size, 0);
});

test('si falla una escritura al importar, se detiene e informa de lo hecho', async () => {
  const fake = createFakeGithub(); const App = loadStorage(fake);
  const failing = async (url, init) => (init?.method === 'PUT' && url.includes('/contents/b.json')
    ? { ok: false, status: 403, headers: { get: () => null }, json: async () => ({ message: 'forbidden' }), text: async () => '' }
    : fake.fetch(url, init));
  const store = App.createStore(App.createGithubAdapter({ owner: 'ana', repo: 'diario-datos', branch: 'main', token: 'good', fetch: failing }));
  const bundle = { format: 'diario-rpg-export', formatVersion: 1, files: { 'a.json': 1, 'b.json': 2, 'c.json': 3 } };
  const r = await store.applyImport(bundle, { overwrite: true });
  assert.equal(r.written, 1);
  assert.equal(r.failed.path, 'b.json');
  assert.deepEqual([...fake.state.files.keys()], ['a.json'], 'c.json no se escribe tras el fallo');
});
