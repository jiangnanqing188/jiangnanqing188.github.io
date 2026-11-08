import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, stat, mkdir, symlink, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createSetupServer, createPrivateCredentialSink } from '../setup-app.mjs';

const SECRET = 'mock_secret_never_expose_1234567890';
const CODE = 'mock_code_never_expose';
const fixture = () => ({
  name: 'jiangnanqing188-daily-notes', slug: 'jiangnanqing188-daily-notes',
  owner: { id: 192717492, login: 'jiangnanqing188' },
  html_url: 'https://github.com/apps/jiangnanqing188-daily-notes',
  client_id: 'Iv1.mock12345', client_secret: SECRET,
  permissions: { contents: 'write', metadata: 'read' }, events: [],
  pem: 'mock-unused-pem', webhook_secret: 'mock-unused-webhook'
});
const unescape = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
async function setup(t, overrides = {}) {
  let received, calls = 0;
  const server = await createSetupServer({
    onCredentials: async value => { received = value; },
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, `https://api.github.com/app-manifests/${CODE}/conversions`);
      assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Accept, 'application/vnd.github+json');
      return Response.json(fixture());
    }, ...overrides
  });
  t.after(server.close);
  const response = await fetch(server.url);
  assert.equal(response.status, 200);
  const html = await response.text();
  const manifest = JSON.parse(unescape(html.match(/name="manifest" value="([^"]+)"/)[1]));
  const state = html.match(/settings\/apps\/new\?state=([a-f0-9]+)/)[1];
  const callback = `${manifest.redirect_url}?state=${state}&code=${CODE}`;
  return { ...server, html, manifest, state, callback, get received() { return received; }, get calls() { return calls; } };
}
function raw(url, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', x => { text += x; });
      res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers }));
    }); req.on('error', reject);
  });
}

test('manifest is fixed, private, no webhook or unwanted permissions', async t => {
  const s = await setup(t);
  assert.equal(s.manifest.name, 'jiangnanqing188-daily-notes');
  assert.equal(s.manifest.url, 'https://jiangnanqing188.github.io/daily/');
  assert.deepEqual(s.manifest.default_permissions, { contents: 'write', metadata: 'read' });
  assert.deepEqual(s.manifest.callback_urls, ['https://jiangnan-daily-notes.jiangnanqingwqw.workers.dev/auth/callback']);
  assert.deepEqual(s.manifest.hook_attributes, { active: false });
  assert.deepEqual(s.manifest.default_events, []);
  assert.equal(s.manifest.public, false);
  assert.equal(new URL(s.url).hostname, '127.0.0.1');
  assert.ok(new URL(s.manifest.redirect_url).pathname.endsWith(s.state));
  assert.ok(!s.html.includes(SECRET));
});

test('success exchanges only server-side, strips unused secrets, and rejects replay', async t => {
  const s = await setup(t);
  const r = await fetch(s.callback);
  assert.equal(r.status, 200);
  assert.ok(!(await r.text()).includes(SECRET));
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(r.headers.get('content-security-policy').includes("default-src 'none'"));
  assert.equal(s.received.client_secret, SECRET);
  assert.equal(s.received.pem, undefined); assert.equal(s.received.webhook_secret, undefined);
  const result = await s.done;
  assert.equal(result.status, 'complete');
  assert.ok(!JSON.stringify(result).includes(SECRET));
  assert.equal((await fetch(s.callback)).status, 410);
  assert.equal((await fetch(s.url)).status, 410);
  assert.equal(s.calls, 1);
});

for (const [name, mutate] of [
  ['missing state', u => u.searchParams.delete('state')],
  ['wrong state', u => u.searchParams.set('state', 'bad')],
  ['duplicate state', u => u.searchParams.append('state', u.searchParams.get('state'))],
  ['missing code', u => u.searchParams.delete('code')],
  ['duplicate code', u => u.searchParams.append('code', CODE)],
  ['invalid code', u => u.searchParams.set('code', '../bad')],
  ['unexpected query', u => u.searchParams.set('redirect', 'https://evil.test')]
]) test(`reject ${name} before exchange`, async t => {
  const s = await setup(t); const u = new URL(s.callback); mutate(u);
  const r = await fetch(u); assert.equal(r.status, 400);
  assert.ok(!(await r.text()).includes(CODE)); assert.equal(s.calls, 0);
});

test('expired flow does not exchange', async t => {
  let time = 1;
  const s = await setup(t, { now: () => time }); time += 900_000;
  assert.equal((await fetch(s.callback)).status, 410); assert.equal(s.calls, 0);
});
test('reject remote Host, Origin, preflight, non-GET, and unknown path', async t => {
  const s = await setup(t);
  assert.equal((await raw(s.url, { Host: 'evil.test' })).status, 403);
  assert.equal((await fetch(s.url, { headers: { Origin: 'https://evil.test' } })).status, 403);
  const preflight = await fetch(s.url, { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 403); assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  assert.equal((await fetch(s.url, { method: 'POST' })).status, 405);
  assert.equal((await fetch(new URL('/unknown', s.url))).status, 404);
  assert.equal((await raw(s.url, { 'Content-Length': '1' })).status, 400);
});

for (const [name, fetchImpl] of [
  ['upstream failure', async () => new Response(SECRET, { status: 500 })],
  ['exception leakage', async () => { throw new Error(`${SECRET} ${CODE}`); }],
  ['invalid json', async () => new Response(`bad ${SECRET}`)],
  ['oversized streaming body', async () => new Response('a'.repeat(128 * 1024 + 1))],
  ['oversized declared body', async () => new Response('{}', { headers: { 'content-length': '200000' } })],
  ['wrong owner', async () => Response.json({ ...fixture(), owner: { id: 1, login: 'other' } })],
  ['wrong app name', async () => Response.json({ ...fixture(), name: 'other' })],
  ['wrong slug', async () => Response.json({ ...fixture(), slug: 'other' })],
  ['wrong permissions', async () => Response.json({ ...fixture(), permissions: { contents: 'read', metadata: 'read' } })],
  ['extra permissions', async () => Response.json({ ...fixture(), permissions: { contents: 'write', metadata: 'read', issues: 'write' } })],
  ['unexpected events', async () => Response.json({ ...fixture(), events: ['push'] })],
  ['invalid client secret', async () => Response.json({ ...fixture(), client_secret: '' })]
]) test(`${name} fails closed without leaking`, async t => {
  const s = await setup(t, { fetchImpl }); const r = await fetch(s.callback);
  assert.equal(r.status, 502); const body = await r.text();
  assert.ok(!body.includes(SECRET)); assert.ok(!body.includes(CODE));
  assert.equal(s.received, undefined); assert.deepEqual(await s.done, { status: 'failed' });
  assert.equal((await fetch(s.callback)).status, 410);
});

test('concurrent callbacks exchange only once', async t => {
  let calls = 0;
  const s = await setup(t, { fetchImpl: async () => { calls++; await new Promise(r => setTimeout(r, 15)); return Response.json(fixture()); } });
  const responses = await Promise.all([fetch(s.callback), fetch(s.callback)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 410]); assert.equal(calls, 1);
});
test('sink failure is safe and not a success', async t => {
  const s = await setup(t, { onCredentials: async () => { throw new Error(SECRET); } });
  const r = await fetch(s.callback); assert.equal(r.status, 502);
  assert.ok(!(await r.text()).includes(SECRET)); assert.equal((await s.done).status, 'failed');
});
test('private files are exclusive 0600 in a new 0700 directory; only two Worker secrets', async t => {
  const root = await mkdtemp(path.join('/tmp', 'daily-setup-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'private');
  const sink = await createPrivateCredentialSink(directory);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  await sink({ client_id: fixture().client_id, client_secret: SECRET, app_url: fixture().html_url, slug: fixture().slug });
  const secretsPath = path.join(directory, 'worker-secrets.json');
  assert.equal((await stat(secretsPath)).mode & 0o777, 0o600);
  assert.equal((await stat(path.join(directory, 'app-metadata.json'))).mode & 0o777, 0o600);
  const secrets = JSON.parse(await readFile(secretsPath, 'utf8'));
  assert.deepEqual(Object.keys(secrets).sort(), ['GITHUB_CLIENT_SECRET', 'SESSION_SECRET']);
  assert.equal(secrets.GITHUB_CLIENT_SECRET, SECRET); assert.match(secrets.SESSION_SECRET, /^[a-f0-9]{64}$/);
  const metadata = await readFile(path.join(directory, 'app-metadata.json'), 'utf8');
  assert.ok(!metadata.includes(SECRET)); assert.ok(!metadata.includes('pem'));
  assert.deepEqual((await readdir(directory)).sort(), ['app-metadata.json', 'worker-secrets.json']);
  await assert.rejects(sink({}));
  await assert.rejects(createPrivateCredentialSink(directory));
  await assert.rejects(createPrivateCredentialSink('relative-path'));
  await assert.rejects(createPrivateCredentialSink(path.join(root, 'repo-child'), { repoRoot: root }));
  await symlink(directory, path.join(root, 'link'));
  await assert.rejects(createPrivateCredentialSink(path.join(root, 'link', 'nested')));
  await assert.rejects(createPrivateCredentialSink(path.join(root, 'link')));
  await mkdir(path.join(root, 'unsafe'), { mode: 0o777 });
  // Existing directory never accepted, regardless of umask.
  await assert.rejects(createPrivateCredentialSink(path.join(root, 'unsafe')));
});

test('expiry during exchange never delivers credentials', async t => {
  let time = 1;
  const s = await setup(t, { now: () => time, fetchImpl: async () => { time += 900_000; return Response.json(fixture()); } });
  assert.equal((await fetch(s.callback)).status, 502);
  assert.equal(s.received, undefined);
});

test('CLI prints only a local entry URL and safe stopped status', async t => {
  const { spawn } = await import('node:child_process');
  const root = await mkdtemp('/tmp/daily-setup-cli-test-');
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = new URL('../setup-app.mjs', import.meta.url);
  const child = spawn(process.execPath, [cli.pathname, '--private-dir', path.join(root, 'private')], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGTERM'));
  let stdout = '', stderr = '';
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  child.stderr.setEncoding('utf8'); child.stderr.on('data', x => { stderr += x; });
  const entry = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('CLI startup timeout')), 3000);
    child.stdout.setEncoding('utf8'); child.stdout.on('data', x => {
      stdout += x;
      const match = stdout.match(/Local setup URL: (http:\/\/127\.0\.0\.1:\d+\/setup\/[a-f0-9]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.once('exit', () => { clearTimeout(timeout); reject(new Error('CLI did not start')); });
  });
  assert.equal((await fetch(entry)).status, 200);
  child.kill('SIGTERM');
  assert.equal(await exited, 1);
  assert.match(stderr, /Setup closed\. No secret values displayed/);
  assert.ok(!stdout.includes(SECRET)); assert.ok(!stdout.includes(CODE));
  assert.deepEqual(await readdir(path.join(root, 'private')), []);
});
