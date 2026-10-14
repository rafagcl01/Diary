// Pruebas automáticas: lógica y accesibilidad sin navegador.
// Los scripts de la aplicación son clásicos (no módulos); se cargan aquí en un contexto aislado.
// Ejecutar con: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const files = [
  'icons.js', 'prefs.js', 'ui.js', 'router.js',
  'storage/errors.js', 'storage/github-adapter.js', 'storage/store.js', 'storage/connection.js',
  'diary/entries.js', 'diary/repository.js', 'diary/drafts.js',
  'views/home.js', 'views/diary/html.js', 'views/diary/list.js', 'views/diary/read.js', 'views/diary/editor.js', 'views/diary.js', 'views/people.js', 'views/mood.js',
  'views/character.js', 'views/quests.js', 'views/collection.js', 'views/settings.js',
  'sections.js',
];
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function loadApp(extra = {}) {
  const ctx = vm.createContext({ ...extra });
  ctx.window = ctx;
  ctx.document = { documentElement: { dataset: {}, removeAttribute() {} } };
  ctx.btoa = btoa; ctx.atob = atob;
  for (const f of files) vm.runInContext(read(`js/${f}`), ctx, { filename: f });
  return ctx.App;
}

const fakeRoot = () => {
  const el = { addEventListener() {}, setAttribute() {}, textContent: '', value: '', checked: false, disabled: false, hidden: false };
  return { innerHTML: '', querySelector: () => el };
};

test('las secciones tienen identificadores únicos, vista e icono', () => {
  const App = loadApp();
  const ids = App.sections.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of App.sections) {
    assert.equal(typeof s.view.render, 'function', s.id);
    assert.match(App.icon(s.icon), /<(path|circle)/, `falta el icono ${s.icon}`);
  }
});

test('cada vista pinta un título principal accesible', () => {
  const App = loadApp();
  for (const s of App.sections) {
    const root = fakeRoot();
    s.view.render(root);
    assert.match(root.innerHTML, /<h1 id="page-title"/, `falta h1 en ${s.id}`);
  }
});

test('escapeHtml neutraliza HTML en datos del usuario', () => {
  const App = loadApp();
  assert.equal(App.escapeHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
});

test('el saludo escapa el nombre guardado en preferencias', () => {
  const App = loadApp();
  App.prefs.set({ name: '<b>Ana</b>' });
  const root = fakeRoot();
  App.views.home.render(root);
  assert.ok(!root.innerHTML.includes('<b>Ana</b>'));
  assert.ok(root.innerHTML.includes('&lt;b&gt;Ana&lt;/b&gt;'));
});

test('sin almacenamiento disponible, las preferencias usan valores por defecto', () => {
  const prefs = loadApp().prefs.get();
  assert.equal(prefs.name, '');
  assert.equal(prefs.motion, 'auto');
  assert.equal(prefs.theme, 'auto');
});

test('las preferencias guardadas con valores desconocidos se sanean al cargar', () => {
  const localStorage = { getItem: () => '{"motion":"turbo","theme":"neon","name":5}', setItem() {} };
  const prefs = loadApp({ localStorage }).prefs.get();
  assert.equal(prefs.motion, 'auto');
  assert.equal(prefs.theme, 'auto');
  assert.equal(prefs.name, '');
});

test('las preferencias válidas se conservan', () => {
  const localStorage = { getItem: () => '{"motion":"off","theme":"dark","name":"Ana"}', setItem() {} };
  const prefs = loadApp({ localStorage }).prefs.get();
  assert.deepEqual([prefs.motion, prefs.theme, prefs.name], ['off', 'dark', 'Ana']);
});

test('el inicio muestra las siete caras de ánimo sin dar más peso a unas que a otras', () => {
  const App = loadApp();
  const root = fakeRoot();
  App.views.home.render(root);
  const faces = root.innerHTML.match(/class="face m-[a-z]+"/g) || [];
  assert.equal(faces.length, 7);
  assert.match(root.innerHTML, /href="#\/diario\/nueva"/, 'el acceso principal lleva a escribir');
  assert.match(root.innerHTML, /href="#\/animo"/);
});

test('index.html: scripts existentes, en orden y sin módulos', () => {
  const html = read('index.html');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length > 0);
  for (const s of srcs) assert.ok(fs.existsSync(new URL(`../${s}`, import.meta.url)), s);
  assert.ok(srcs.indexOf('js/icons.js') < srcs.indexOf('js/ui.js'));
  assert.ok(srcs.indexOf('js/views/home.js') < srcs.indexOf('js/sections.js'));
  const order = ['js/storage/errors.js', 'js/storage/github-adapter.js', 'js/storage/store.js', 'js/storage/connection.js',
    'js/diary/entries.js', 'js/diary/repository.js', 'js/diary/drafts.js', 'js/views/home.js', 'js/views/diary/html.js', 'js/views/diary/editor.js', 'js/views/diary.js', 'js/sections.js'];
  assert.deepEqual(order.map((x) => srcs.indexOf(x)), order.map((x) => srcs.indexOf(x)).sort((a, b) => a - b));
  assert.ok(srcs.indexOf('js/storage/connection.js') >= 0);
  assert.equal(srcs[srcs.length - 1], 'js/main.js');
  assert.ok(!/type="module"/.test(html), 'los módulos no funcionan con doble clic');
});

test('el CSS respeta "reducir movimiento" y permite desactivar los efectos', () => {
  const css = read('css/app.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /html\[data-motion="off"\]/);
});

// ---- Contraste (WCAG 2.x) ----
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

test('contraste suficiente en tema claro (texto 4.5:1, controles 3:1)', () => {
  const css = read('css/tokens.css');
  const t = tokens(css.slice(0, css.indexOf('@media')));
  assert.ok(ratio(t.ink, t.bg) >= 4.5, 'ink/bg');
  assert.ok(ratio(t['ink-soft'], t.bg) >= 4.5, 'ink-soft/bg');
  assert.ok(ratio(t['ink-soft'], t.surface) >= 4.5, 'ink-soft/surface');
  assert.ok(ratio(t['on-accent'], t.accent) >= 4.5, 'on-accent/accent');
  assert.ok(ratio(t.accent, t.bg) >= 4.5, 'accent/bg');
  assert.ok(ratio(t['paper-ink'], t.paper) >= 4.5, 'paper-ink/paper');
  assert.ok(ratio(t['paper-soft'], t.paper) >= 4.5, 'paper-soft/paper');
  assert.ok(ratio('#2A1A24', t['pink-pastel']) >= 4.5, 'texto sobre rosa pastel');
});

test('contraste suficiente en tema oscuro', () => {
  const css = read('css/tokens.css');
  const t = tokens(css.slice(css.indexOf(':root[data-theme="dark"]')));
  assert.ok(ratio(t.ink, t.bg) >= 4.5, 'ink/bg');
  assert.ok(ratio(t['ink-soft'], t.bg) >= 4.5, 'ink-soft/bg');
  assert.ok(ratio(t['ink-soft'], t.surface) >= 4.5, 'ink-soft/surface');
  assert.ok(ratio(t['on-accent'], t.accent) >= 4.5, 'on-accent/accent');
  assert.ok(ratio(t.accent, t.bg) >= 4.5, 'accent/bg');
});

test('contraste de la barra lateral y de la escena del personaje', () => {
  assert.ok(ratio('#F8EAF1', '#19131B') >= 7, 'texto crema sobre negro ciruela');
  assert.ok(ratio('#19131B', '#F3C6DA') >= 7, 'elemento activo de navegación');
  assert.ok(ratio('#CDB8C4', '#19131B') >= 4.5, 'texto secundario en escenas oscuras');
});

test('la política de seguridad solo permite hablar con GitHub', () => {
  const html = read('index.html');
  const csp = html.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
  assert.match(csp, /connect-src https:\/\/api\.github\.com(;|$)/);
  assert.ok(!/connect-src[^;]*(\*|http:)/.test(csp));
  // Ningún script de la aplicación contacta con otros servidores.
  for (const f of fs.readdirSync(new URL('../js/', import.meta.url), { recursive: true }).filter((n) => n.endsWith('.js'))) {
    const urls = [...read(`js/${f}`).matchAll(/https?:\/\/[^\s'"`)]+/g)].map((m) => m[0].replace(/[.,;:)]+$/, ''));
    for (const u of urls) assert.match(u, /^https:\/\/api\.github\.com$/, `${f} menciona ${u}`);
  }
});

test('el inicio avisa de que faltan los datos solo mientras no hay conexión configurada', () => {
  const App = loadApp();
  App.connection.init();
  const root = fakeRoot();
  App.views.home.render(root);
  assert.match(root.innerHTML, /Todavía no has conectado tus datos/);
  assert.match(root.innerHTML, /href="#\/ajustes"/);
  const localStorage = { getItem: () => '{"owner":"ana","repo":"datos","branch":"main","remember":true,"token":"t"}', setItem() {}, removeItem() {} };
  const App2 = loadApp({ localStorage });
  App2.connection.init();
  const root2 = fakeRoot();
  App2.views.home.render(root2);
  assert.ok(!/Todavía no has conectado/.test(root2.innerHTML));
});

test('Configuración muestra la conexión, la copia de seguridad y avisa de que no hay cifrado', () => {
  const App = loadApp();
  App.connection.init();
  const root = fakeRoot();
  App.views.settings.render(root);
  for (const id of ['conn-form', 'conn-repo', 'conn-token', 'conn-remember', 'conn-connect', 'backup-export', 'backup-file', 'import-dialog']) {
    assert.ok(root.innerHTML.includes(`id="${id}"`), `falta #${id}`);
  }
  assert.match(root.innerHTML, /No están cifradas/);
  assert.match(root.innerHTML, /type="password"/);
  assert.ok(!/value="[^"]*github_pat/.test(root.innerHTML), 'el token nunca se vuelca en el HTML');
});

test('el nombre de usuario en Configuración se escapa', () => {
  const App = loadApp();
  App.prefs.set({ name: '"><script>x</script>' });
  const root = fakeRoot();
  App.views.settings.render(root);
  assert.ok(!root.innerHTML.includes('<script>x</script>'));
});
