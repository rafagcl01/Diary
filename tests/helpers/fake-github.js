// Servidor de GitHub de mentira: imita lo que la aplicación usa de la API (repositorio, contenidos y árbol)
// con las mismas reglas que importan: token, permisos, sha obligatorio al actualizar y conflictos.
import { createHash } from 'node:crypto';

export function createFakeGithub(opts = {}) {
  const state = {
    repoName: opts.repoName ?? 'ana/diario-datos',
    isPrivate: opts.isPrivate ?? true,
    canPush: opts.canPush ?? true,
    omitPermissions: opts.omitPermissions ?? false,
    token: opts.token ?? 'good',
    files: new Map(Object.entries(opts.files ?? {})),
    bigFiles: new Set(opts.bigFiles ?? []),       // se sirven con encoding "none", como los de más de 1 MB
    offline: false,
    rateLimited: false,
    beforePut: null,                               // gancho para simular a otro dispositivo escribiendo
    maxInFlight: 0,
    calls: [],
  };
  let inFlight = 0;
  const sha = (text) => createHash('sha1').update(text).digest('hex');
  const res = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });

  async function fetch(url, init = {}) {
    if (state.offline) throw new TypeError('Failed to fetch');
    const method = init.method ?? 'GET';
    const headers = init.headers ?? {};
    state.calls.push({ method, url, headers, body: init.body });
    inFlight++; state.maxInFlight = Math.max(state.maxInFlight, inFlight);
    try {
      await new Promise((r) => setTimeout(r, 1));
      const u = new URL(url);
      if (headers.Authorization !== `Bearer ${state.token}`) return res(401, { message: 'Bad credentials' });
      if (state.rateLimited) return res(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0' });
      const prefix = `/repos/${state.repoName}`;
      if (!u.pathname.startsWith(prefix)) return res(404, { message: 'Not Found' });
      const rest = u.pathname.slice(prefix.length);

      if (rest === '') {
        const body = { private: state.isPrivate };
        if (!state.omitPermissions) body.permissions = { push: state.canPush, pull: true };
        return res(200, body);
      }
      if (rest.startsWith('/git/trees/')) {
        if (state.files.size === 0) return res(409, { message: 'Git Repository is empty.' });
        return res(200, { truncated: false, tree: [...state.files.keys()].map((path) => ({ path, type: 'blob' })) });
      }
      if (rest.startsWith('/contents/')) {
        const path = decodeURIComponent(rest.slice('/contents/'.length));
        const current = state.files.get(path);
        if (method === 'GET') {
          if (current === undefined) return res(404, { message: 'Not Found' });
          if ((headers.Accept ?? '').includes('raw')) return res(200, current);
          if (state.bigFiles.has(path)) return res(200, { type: 'file', encoding: 'none', content: '', sha: sha(current) });
          const b64 = Buffer.from(current, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
          return res(200, { type: 'file', encoding: 'base64', content: b64, sha: sha(current) });
        }
        const body = JSON.parse(init.body);
        if (state.beforePut) state.beforePut(path, body, state);
        const now = state.files.get(path);
        if (method === 'PUT') {
          if (now !== undefined && !body.sha) return res(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
          if (now !== undefined && body.sha !== sha(now)) return res(409, { message: `${path} does not match ${sha(now)}` });
          const text = Buffer.from(body.content, 'base64').toString('utf8');
          state.files.set(path, text);
          return res(now === undefined ? 201 : 200, { content: { sha: sha(text) } });
        }
        if (method === 'DELETE') {
          if (now === undefined) return res(404, { message: 'Not Found' });
          if (body.sha !== sha(now)) return res(409, { message: 'sha does not match' });
          state.files.delete(path);
          return res(200, {});
        }
      }
      return res(404, { message: 'Not Found' });
    } finally {
      inFlight--;
    }
  }
  return { fetch, state, sha };
}
