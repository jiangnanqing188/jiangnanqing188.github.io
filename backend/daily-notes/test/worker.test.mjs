import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../worker.mjs';

const ORIGIN = 'https://jiangnanqing188.github.io';
const WORKER = 'https://daily-notes.example.workers.dev';
const OWNER = 192717492;
const FILE = 'source/_data/daily.json';
const CONTENTS = `https://api.github.com/repos/jiangnanqing188/jiangnanqing188.github.io/contents/${FILE}`;
const SECRET = '07'.repeat(32); // Test fixture only, NOT a deployable secret.
const ENV = { SESSION_SECRET: SECRET, GITHUB_CLIENT_ID: 'Iv1.fixture', GITHUB_CLIENT_SECRET: 'fixture-only-secret' };
const ID = '171ce780-6fc9-4a24-b590-9d7af156a6a7';
const ID2 = '4991def7-5dd6-47be-a572-663f24145726';
const BLOB = 'a'.repeat(40);
const COMMIT = 'b'.repeat(40);
const INPUT = { id: ID, body: '本地测试夹具，不是博客内容。', mood: '随手记' };
const EMPTY = () => ({ version: 1, entries: [] });
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
function harness(options = {}) {
  let clock = Date.parse('2026-11-07T12:00:00.000Z');
  let document = options.document ?? EMPTY();
  let missing = options.missing ?? false;
  let user = { id: OWNER, login: 'renamed-owner' };
  const usedCodes = new Set();
  const calls = [];
  const values = new Map();
  const cacheEvents = [];
  const cache = {
    async match(key) {
      cacheEvents.push(['match', key.url]);
      const hit = values.get(key.url);
      if (hit && hit.expires > clock) return hit.response.clone();
      values.delete(key.url);
    },
    async put(key, value) { cacheEvents.push(['put', key.url, value.headers.get('Cache-Control')]); values.set(key.url, { response: value.clone(), expires: clock + 120000 }); },
    async delete(key) { cacheEvents.push(['delete', key.url]); return values.delete(key.url); },
  };
  const fetcher = async (url, init = {}) => {
    url = String(url);
    calls.push({ url, ...init });
    if (options.workersRedirects && init.redirect === 'error') {
      throw new TypeError('Workers only supports redirect modes follow and manual');
    }
    assert.equal(init.redirect, 'manual');
    if (options.intercept) {
      const result = await options.intercept(url, init);
      if (result) return result;
    }
    if (url === 'https://github.com/login/oauth/access_token') {
      const value = JSON.parse(init.body);
      assert.equal(value.client_id, ENV.GITHUB_CLIENT_ID);
      assert.equal(value.client_secret, ENV.GITHUB_CLIENT_SECRET);
      assert.equal(value.redirect_uri, `${WORKER}/auth/callback`);
      assert.match(value.code_verifier, /^[A-Za-z0-9_-]{43}$/);
      if (usedCodes.has(value.code)) return response({ error: 'bad_verification_code', error_description: 'SECRET_LEAK' });
      usedCodes.add(value.code);
      return response({ access_token: 'ghu_test_only', token_type: 'bearer', expires_in: 28800, refresh_token: 'ghr_must_not_escape' });
    }
    if (url === 'https://api.github.com/user') {
      assert.equal(init.headers.Authorization, 'Bearer ghu_test_only');
      assert.equal(init.redirect, 'manual');
      return response(user);
    }
    if (url === `${CONTENTS}?ref=master`) {
      if (missing) return response({ message: 'Not Found' }, 404);
      const bytes = Buffer.from(JSON.stringify(document));
      return response({ type: 'file', path: FILE, sha: BLOB, encoding: 'base64', size: bytes.length, content: bytes.toString('base64') });
    }
    if (url === CONTENTS && init.method === 'PUT') {
      const value = JSON.parse(init.body);
      assert.equal(init.headers.Authorization, 'Bearer ghu_test_only');
      assert.equal(value.branch, 'master');
      assert.equal(value.sha, missing ? undefined : BLOB);
      document = JSON.parse(Buffer.from(value.content, 'base64').toString());
      missing = false;
      return response({ commit: { sha: COMMIT }, content: { sha: BLOB, path: FILE } }, 201);
    }
    throw new Error(`Unexpected request ${url}`);
  };
  const worker = createWorker({ fetch: fetcher, now: () => clock, cache, ...(options.testOrigin ? { testOrigin: options.testOrigin } : {}) });
  const request = (path, init, env = ENV) => worker.fetch(new Request(`${WORKER}${path}`, init), env);
  const start = async () => {
    const result = await request('/auth/start?returnURL=https://evil.example');
    assert.equal(result.status, 302);
    return { state: new URL(result.headers.get('Location')).searchParams.get('state'),
      cookie: result.headers.get('Set-Cookie').split(';')[0], result };
  };
  const callback = async (flow, query = `state=${flow.state}&code=code-${usedCodes.size}`) => {
    const result = await request(`/auth/callback?${query}`, { headers: { Cookie: flow.cookie } });
    const html = await result.text();
    const match = html.match(/postMessage\((\{.*?\}),"/);
    assert.ok(match, html);
    return { result, html, message: JSON.parse(match[1]) };
  };
  const login = async () => {
    const result = await callback(await start());
    assert.equal(result.message.status, 'owner');
    return result.message.session;
  };
  const post = (token, input = INPUT, extra = {}) => request('/notes', {
    method: 'POST', body: JSON.stringify(input), headers: { Origin: options.testOrigin || ORIGIN,
      'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
  });
  return { worker, request, start, callback, login, post, calls, cache, cacheEvents, values,
    advance: ms => { clock += ms; }, setUser: value => { user = value; }, document: () => document };
}

// Deliberately craft encrypted fixtures to exercise claim validation, without exporting signing APIs from production.
async function encryptedFixture(value, purpose = 'session') {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', Buffer.from(SECRET, 'hex'), 'AES-GCM', false, ['encrypt']);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
    additionalData: Buffer.from(`daily-notes:v1:${purpose}:${WORKER}:${ORIGIN}`) }, key, Buffer.from(JSON.stringify(value)));
  return `v1.${Buffer.from(iv).toString('base64url')}.${Buffer.from(data).toString('base64url')}`;
}
const CLAIMS = { owner: OWNER, token: 'ghu_test_only', iat: 1794052800, exp: 1794056400 };

test('public GET reads only fixed master Contents API and caches canonical JSON for 120s', async () => {
  const h = harness();
  const first = await h.request('/notes?ref=main&repo=other', { headers: { Origin: ORIGIN } });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), EMPTY());
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(first.headers.get('Vary'), 'Origin');
  assert.equal(h.calls[0].url, `${CONTENTS}?ref=master`);
  assert.equal(h.calls[0].headers.Authorization, undefined);
  assert.deepEqual(h.cacheEvents[1], ['put', `${WORKER}/notes`, 'public, max-age=0, s-maxage=120']);
  const second = await h.request('/notes', { headers: { Origin: 'https://evil.example' } });
  assert.equal(second.headers.get('Access-Control-Allow-Origin'), null);
  assert.deepEqual(await second.json(), EMPTY());
  assert.equal(h.calls.length, 1);
});

test('Workers-compatible fetch permits public API reading without redirect:error', async () => {
  const h = harness({ workersRedirects: true });
  const result = await h.request('/notes');
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), EMPTY());
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].redirect, 'manual');
});

test('Workers-compatible fetch permits OAuth token exchange and authenticated API calls', async () => {
  const h = harness({ workersRedirects: true });
  const auth = await h.callback(await h.start());
  assert.equal(auth.message.status, 'owner');
  assert.ok(auth.message.session);
  assert.deepEqual(h.calls.map(call => [call.url, call.redirect]), [
    ['https://github.com/login/oauth/access_token', 'manual'],
    ['https://api.github.com/user', 'manual'],
  ]);
  assert.equal((await h.post(auth.message.session)).status, 201);
  assert.ok(h.calls.every(call => call.redirect === 'manual'));
});

test('GitHub 3xx fail closed without following, credential forwarding, caching or persisted writes', async t => {
  const token = await encryptedFixture(CLAIMS);
  for (const stage of ['public-read', 'token-exchange', 'owner', 'authenticated-read', 'write']) {
    for (const status of [300, 301, 302, 303, 304, 305, 306, 307, 308, 399]) {
      await t.test(`${stage} ${status}`, async () => {
        const upstreamOrigin = stage === 'token-exchange' ? 'https://github.com' : 'https://api.github.com';
        for (const location of [`${upstreamOrigin}/redirect-target`, 'https://evil.example/redirect-target']) {
          const h = harness({ workersRedirects: true, intercept: (url, init) => {
            const targeted = stage === 'token-exchange' ? url.endsWith('/access_token')
              : stage === 'owner' ? url.endsWith('/user')
              : stage === 'write' ? init.method === 'PUT' : url === `${CONTENTS}?ref=master`;
            if (targeted) return new Response(null, { status, headers: { Location: location } });
          } });
          if (stage === 'token-exchange') {
            const { message, html } = await h.callback(await h.start());
            assert.equal(message.status, 'error');
            assert.equal(message.session, undefined);
            assert.doesNotMatch(html, /fixture-only-secret|ghu_test_only|evil\.example/);
          } else {
            const result = stage === 'public-read' ? await h.request('/notes') : await h.post(token);
            assert.equal(result.status, 503);
            assert.doesNotMatch(await result.text(), /entries|fixture-only-secret|ghu_test_only|evil\.example/);
          }
          const expectedCalls = stage === 'write' ? 3 : stage === 'authenticated-read' ? 2 : 1;
          assert.equal(h.calls.length, expectedCalls);
          assert.equal(h.calls.filter(call => call.method === 'PUT').length, stage === 'write' ? 1 : 0);
          assert.ok(h.calls.every(call => call.redirect === 'manual'));
          assert.equal(h.calls.some(call => call.url === location), false);
          assert.deepEqual(h.document(), EMPTY());
          assert.equal(h.values.size, 0);
          assert.equal(h.cacheEvents.some(([event]) => event !== 'match'), false);
        }
      });
    }
  }
});

test('initial 404 is empty; network, forbidden/rate-limit and server failures are 503, never fake empty', async t => {
  assert.deepEqual(await (await harness({ missing: true }).request('/notes')).json(), EMPTY());
  for (const status of [401, 403, 429, 500, 502]) await t.test(String(status), async () => {
    const h = harness({ intercept: () => response({ message: 'SECRET_LEAK' }, status) });
    const result = await h.request('/notes');
    assert.equal(result.status, 503);
    assert.doesNotMatch(await result.text(), /entries|SECRET_LEAK/);
    assert.equal(h.values.size, 0);
  });
  const h = harness({ intercept: () => { throw new Error('token=SECRET_LEAK'); } });
  const result = await h.request('/notes');
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /SECRET_LEAK/);
});

test('OAuth start uses bound encrypted __Host cookie, state, PKCE, no scope/returnURL', async () => {
  const h = harness();
  const { result, cookie } = await h.start();
  assert.match(result.headers.get('Set-Cookie'), /^__Host-daily-notes-oauth=v1\.[\w.-]+; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=600$/);
  const url = new URL(result.headers.get('Location'));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('redirect_uri'), `${WORKER}/auth/callback`);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.has('scope'), false);
  assert.equal(url.searchParams.has('returnURL'), false);
  assert.equal(cookie.includes(url.searchParams.get('state')), false);
  assert.equal(url.searchParams.get('state').length, 43);
});

test('complete OAuth → /session → POST sequence, fixed numeric OwnerID not login, server date, invalidates cache', async () => {
  const h = harness();
  await h.request('/notes');
  const token = await h.login();
  const session = await h.request('/session', { headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN } });
  assert.deepEqual(await session.json(), { role: 'owner', login: 'jiangnanqing188', expires_at: '2026-11-07T13:00:00.000Z' });
  const result = await h.post(token);
  assert.equal(result.status, 201);
  assert.deepEqual(await result.json(), { entry: { ...INPUT, created_at: '2026-11-07T12:00:00.000Z' }, commit_sha: COMMIT, duplicate: false });
  assert.equal(h.values.size, 0);
  assert.equal(h.cacheEvents.at(-1)[0], 'delete');
  assert.deepEqual(h.calls.map(c => [c.method || 'GET', c.url]), [
    ['GET', `${CONTENTS}?ref=master`], ['POST', 'https://github.com/login/oauth/access_token'],
    ['GET', 'https://api.github.com/user'], ['GET', 'https://api.github.com/user'],
    ['GET', 'https://api.github.com/user'], ['GET', `${CONTENTS}?ref=master`], ['PUT', CONTENTS],
  ]);
  assert.equal((await (await h.request('/notes')).json()).entries.length, 1);
});

test('callback returns only opaque session, nonce CSP, safe headers and clears cookie', async () => {
  const h = harness();
  const { result, html, message } = await h.callback(await h.start());
  assert.equal(message.status, 'owner');
  assert.match(message.session, /^v1\./);
  assert.doesNotMatch(html, /ghu_test_only|ghr_must_not_escape|fixture-only-secret|localStorage|location.hash/);
  assert.match(html, /,"https:\/\/jiangnanqing188.github.io"\)/);
  const nonce = html.match(/script nonce="([^"]+)"/)[1];
  assert.ok(result.headers.get('Content-Security-Policy').includes(`script-src 'nonce-${nonce}'`));
  assert.doesNotMatch(result.headers.get('Content-Security-Policy'), /unsafe-inline/);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(result.headers.get('Referrer-Policy'), 'no-referrer');
  assert.match(result.headers.get('Set-Cookie'), /Max-Age=0/);
});

test('wrong/missing/expired/tampered OAuth state cannot exchange code', async t => {
  for (const kind of ['wrong', 'missing', 'expired', 'cookie-tampered', 'cookie-missing', 'duplicate-state', 'duplicate-cookie']) {
    await t.test(kind, async () => {
      const h = harness();
      const flow = await h.start();
      let query = `state=${flow.state}&code=good-code`;
      if (kind === 'wrong') query = 'state=wrong&code=good-code';
      if (kind === 'missing') query = 'code=good-code';
      if (kind === 'expired') h.advance(600000);
      if (kind === 'cookie-tampered') flow.cookie += 'x';
      if (kind === 'cookie-missing') flow.cookie = '';
      if (kind === 'duplicate-state') query += `&state=${flow.state}`;
      if (kind === 'duplicate-cookie') flow.cookie += `; ${flow.cookie}`;
      const { message, result } = await h.callback(flow, query);
      assert.equal(message.status, 'error');
      assert.equal(h.calls.length, 0);
      assert.match(result.headers.get('Set-Cookie'), /Max-Age=0/);
    });
  }
});

test('authorization code single-use and browser cookie consumption; cancel/failure are secret-free errors', async () => {
  const h = harness();
  const flow = await h.start();
  const query = `state=${flow.state}&code=one-use`;
  assert.equal((await h.callback(flow, query)).message.status, 'owner');
  const replay = await h.callback(flow, query);
  assert.equal(replay.message.status, 'error');
  assert.doesNotMatch(replay.html, /SECRET_LEAK|ghu_|ghr_/);
  const cancel = await h.callback(await h.start(), 'error=access_denied&error_description=SECRET_LEAK&state=wrong');
  assert.equal(cancel.message.status, 'error');
  assert.doesNotMatch(cancel.html, /SECRET_LEAK/);
  const next = await h.start();
  assert.equal((await h.callback(next, `state=${next.state}&error=access_denied`)).message.status, 'error');
});

test('non-owner using owner login receives readonly with no credentials', async () => {
  const h = harness();
  h.setUser({ id: 1, login: 'jiangnanqing188' });
  const { message, html } = await h.callback(await h.start());
  assert.deepEqual(message, { type: 'daily-notes-auth', status: 'readonly' });
  assert.doesNotMatch(html, /ghu_|session/);
});

test('anonymous /session and POST denied without Contents write', async () => {
  const h = harness();
  assert.equal((await h.request('/session')).status, 401);
  assert.equal((await h.post()).status, 401);
  assert.equal(h.calls.length, 0);
});

test('tampered and expired sessions cannot read session or write', async t => {
  for (const kind of ['tampered', 'expired']) await t.test(kind, async () => {
    const h = harness();
    let token = await h.login();
    if (kind === 'tampered') token += 'x';
    else h.advance(3600000);
    const before = h.calls.length;
    assert.equal((await h.post(token)).status, 401);
    assert.equal((await h.request('/session', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
    assert.equal(h.calls.length, before);
  });
});

test('session owner claim, duration and future iat are enforced', async t => {
  for (const [claims, status] of [[{ ...CLAIMS, owner: 1 }, 403], [{ ...CLAIMS, exp: CLAIMS.iat + 3601 }, 401],
    [{ ...CLAIMS, iat: CLAIMS.iat + 10 }, 401]]) await t.test(JSON.stringify(claims), async () => {
    const h = harness();
    assert.equal((await h.post(await encryptedFixture(claims))).status, status);
    assert.equal(h.calls.length, 0);
  });
});

test('every write rechecks /user numeric id (including string spoof) and revoked/rate-limited authorization', async t => {
  for (const id of [1, String(OWNER), null]) await t.test(String(id), async () => {
    const h = harness();
    const token = await h.login();
    h.setUser({ id, login: 'jiangnanqing188' });
    assert.equal((await h.post(token)).status, 403);
    assert.equal((await h.request('/session', { headers: { Authorization: `Bearer ${token}` } })).status, 403);
    assert.equal(h.calls.filter(c => c.url.includes('/contents/')).length, 0);
  });
  for (const [upstream, status] of [[401, 401], [403, 503], [429, 503], [500, 503]]) await t.test(`user ${upstream}`, async () => {
    const h = harness({ intercept: url => url.endsWith('/user') ? response({ message: 'SECRET_LEAK' }, upstream) : undefined });
    const result = await h.post(await encryptedFixture(CLAIMS));
    assert.equal(result.status, status);
    assert.doesNotMatch(await result.text(), /SECRET_LEAK/);
    assert.equal(h.calls.length, 1);
  });
});

test('origin exactness, spoofed forwarded headers and preflight rules', async t => {
  const h = harness();
  for (const origin of ['', 'null', `${ORIGIN}.evil.example`, `${ORIGIN}/`, 'http://localhost:4000']) await t.test(origin || 'missing', async () => {
    const result = await h.post(undefined, INPUT, { Origin: origin, 'X-Forwarded-Origin': ORIGIN });
    assert.equal(result.status, 403);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
  });
  const good = await h.request('/notes', { method: 'OPTIONS', headers: { Origin: ORIGIN,
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' } });
  assert.equal(good.status, 204);
  assert.equal(good.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(good.headers.has('Access-Control-Allow-Credentials'), false);
  for (const [path, origin, method, headers] of [['/notes', 'https://evil.example', 'POST', 'authorization'],
    ['/notes', ORIGIN, 'DELETE', ''], ['/notes', ORIGIN, 'POST', 'x-repo'], ['/session', ORIGIN, 'POST', ''],
    ['/auth/start', ORIGIN, 'GET', '']]) {
    assert.equal((await h.request(path, { method: 'OPTIONS', headers: { Origin: origin,
      'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers } })).status, 403);
  }
  assert.equal(h.calls.length, 0);
});

test('production origin/OwnerID cannot be changed by env; localhost exists only in explicit test constructor', async () => {
  const h = harness();
  for (const env of [{ ...ENV, ALLOWED_ORIGIN: 'http://localhost:4000' }, { ...ENV, OWNER_ID: '1' }]) {
    assert.equal((await h.request('/notes', {}, env)).status, 503);
  }
  assert.throws(() => createWorker({ testOrigin: 'https://evil.example' }), /Invalid test origin/);
  const local = harness({ testOrigin: 'http://localhost:4000' });
  assert.equal((await local.post()).status, 401);
  assert.equal((await local.post(undefined, INPUT, { Origin: ORIGIN })).status, 403);
  assert.equal((await h.request('/notes', {}, { ...ENV, OWNER_ID: OWNER, ALLOWED_ORIGIN: ORIGIN })).status, 200);
});

test('request Content-Type, JSON, unknown fields, UUID, moods, whitespace, Unicode and 16KiB limits', async t => {
  const h = harness();
  assert.equal((await h.post(undefined, INPUT, { 'Content-Type': 'text/plain' })).status, 415);
  for (const input of [null, [], {}, { ...INPUT, id: '1' }, { ...INPUT, mood: 'bad' }, { ...INPUT, body: ' \n\t' },
    { ...INPUT, body: '😀'.repeat(1001) }, { ...INPUT, body: '\ud800' }, { ...INPUT, created_at: 'fake' },
    { ...INPUT, repo: 'attacker/repo', path: 'anything', branch: 'main' }]) await t.test(JSON.stringify(input)?.slice(0, 60), async () => {
    assert.equal((await h.post(undefined, input)).status, 400);
  });
  for (const raw of ['{', 'x'.repeat(16385)]) {
    const result = await h.request('/notes', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: raw });
    assert.equal(result.status, raw === '{' ? 400 : 413);
  }
  assert.equal((await h.post(undefined, INPUT, { 'Content-Length': '16385' })).status, 413);
  const token = await h.login();
  assert.equal((await h.post(token, { ...INPUT, body: '😀'.repeat(1000) })).status, 201);
});

test('streamed body limit enforced without Content-Length', async () => {
  const h = harness();
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(10000)); controller.enqueue(new Uint8Array(10000)); controller.close();
  } });
  const result = await h.request('/notes', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: stream, duplex: 'half' });
  assert.equal(result.status, 413);
  assert.equal(h.calls.length, 0);
});

test('XSS-looking note remains literal JSON and base64 Contents, never enters callback HTML', async () => {
  const h = harness();
  const token = await h.login();
  const input = { ...INPUT, body: '</script><img src=x onerror=alert(1)> & 文本' };
  assert.equal((await h.post(token, input)).status, 201);
  assert.equal((await (await h.request('/notes')).json()).entries[0].body, input.body);
  const next = await h.callback(await h.start());
  assert.equal(next.html.includes(input.body), false);
  assert.equal(h.document().entries[0].body, input.body);
});

test('append sorted newest-first; initial 404 create omits SHA and still targets fixed source branch/path', async () => {
  const h = harness({ missing: true });
  const token = await h.login();
  assert.equal((await h.post(token)).status, 201);
  h.advance(1000);
  assert.equal((await h.post(token, { ...INPUT, id: ID2 })).status, 201);
  assert.deepEqual(h.document().entries.map(e => e.id), [ID2, ID]);
  const puts = h.calls.filter(c => c.method === 'PUT');
  assert.equal(JSON.parse(puts[0].body).sha, undefined);
  for (const put of puts) {
    assert.equal(put.url, CONTENTS);
    assert.equal(JSON.parse(put.body).branch, 'master');
    assert.equal(put.url.includes('/public/'), false);
  }
});

test('same ID+body+mood is idempotent, no PUT; changed payload is 409', async () => {
  const h = harness();
  const token = await h.login();
  const first = await (await h.post(token)).json();
  h.advance(1000);
  const retry = await h.post(token);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { entry: first.entry, commit_sha: null, duplicate: true });
  assert.equal(h.calls.filter(c => c.method === 'PUT').length, 1);
  assert.equal((await h.post(token, { ...INPUT, body: 'different' })).status, 409);
  assert.equal((await h.post(token, { ...INPUT, mood: '小确幸' })).status, 409);
  assert.equal(h.document().entries.length, 1);
});

test('SHA conflict is not swallowed, overwritten or automatically retried', async () => {
  const h = harness({ intercept: (url, init) => init.method === 'PUT' ? response({ message: 'SECRET_LEAK' }, 409) : undefined });
  const token = await h.login();
  await h.request('/notes');
  const result = await h.post(token);
  assert.equal(result.status, 409);
  assert.doesNotMatch(await result.text(), /SECRET_LEAK/);
  assert.equal(h.calls.filter(c => c.method === 'PUT').length, 1);
  assert.equal(h.values.size, 1);
  assert.deepEqual(h.document(), EMPTY());
});

test('GitHub write failures/incomplete commit confirmations are not success', async t => {
  for (const status of [403, 429, 500, 422]) await t.test(String(status), async () => {
    const h = harness({ intercept: (url, init) => init.method === 'PUT' ? response({ message: 'SECRET_LEAK' }, status) : undefined });
    const result = await h.post(await h.login());
    assert.equal(result.status, status === 422 ? 409 : 503);
    assert.doesNotMatch(await result.text(), /SECRET_LEAK/);
  });
  const h = harness({ intercept: (url, init) => init.method === 'PUT' ? response({ commit: {} }, 201) : undefined });
  assert.equal((await h.post(await h.login())).status, 503);
});

test('malformed/unbounded canonical file rejected on both reads and writes', async t => {
  const goodEntry = { ...INPUT, created_at: '2026-11-06T12:00:00.000Z' };
  for (const document of [{ version: 2, entries: [] }, { version: 1, entries: [{}] }, { ...EMPTY(), extra: true },
    { version: 1, entries: [goodEntry, goodEntry] }, { version: 1, entries: [{ ...goodEntry, created_at: '2026-02-30T00:00:00.000Z' }] },
    { version: 1, entries: [goodEntry, { ...goodEntry, id: ID2, created_at: '2026-11-07T00:00:00.000Z' }] }]) {
    await t.test(JSON.stringify(document).slice(0, 80), async () => {
      const h = harness({ document });
      assert.equal((await h.request('/notes')).status, 503);
      assert.equal((await h.post(await h.login())).status, 503);
      assert.equal(h.calls.some(c => c.method === 'PUT'), false);
    });
  }
  const huge = harness({ intercept: url => url.includes('/contents/') ? new Response('x'.repeat(1024 * 1024 + 1)) : undefined });
  assert.equal((await huge.request('/notes')).status, 503);
  const wrongPath = harness({ intercept: url => url.includes('/contents/') ? response({ type: 'file', path: 'other', sha: BLOB,
    encoding: 'base64', size: 2, content: 'e30=' }) : undefined });
  assert.equal((await wrongPath.request('/notes')).status, 503);
});

test('cache outage does not fake public data or fail a GitHub-confirmed commit', async () => {
  const h = harness();
  h.cache.match = h.cache.put = h.cache.delete = async () => { throw new Error('cache down'); };
  assert.deepEqual(await (await h.request('/notes')).json(), EMPTY());
  assert.equal((await h.post(await h.login())).status, 201);
});

test('missing/bad auth configuration fails closed, public reading needs no secret', async () => {
  const h = harness();
  assert.equal((await h.request('/notes', {}, {})).status, 200);
  for (const env of [{}, { ...ENV, SESSION_SECRET: 'bad' }, { ...ENV, GITHUB_CLIENT_SECRET: '' }]) {
    assert.equal((await h.request('/auth/start', {}, env)).status, 503);
    assert.equal((await h.request('/health', {}, env)).status, 503);
    const result = await h.request('/auth/callback?code=SECRET_LEAK', {}, env);
    assert.doesNotMatch(await result.text(), /SECRET_LEAK/);
  }
});

test('120s cache expiry requires a new canonical read; no stale fallback on GitHub outage', async () => {
  let offline = false;
  const h = harness({ intercept: () => offline ? response({ message: 'limit' }, 429) : undefined });
  assert.equal((await h.request('/notes')).status, 200);
  offline = true;
  h.advance(119999);
  assert.equal((await h.request('/notes')).status, 200);
  h.advance(1);
  const result = await h.request('/notes');
  assert.equal(result.status, 503);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(h.calls.length, 2);
});

test('OAuth PKCE verifier matches authorize challenge; state cookie is bound to Worker origin', async () => {
  const h = harness();
  const flow = await h.start();
  await h.callback(flow);
  const exchange = JSON.parse(h.calls[0].body);
  const expected = Buffer.from(await crypto.subtle.digest('SHA-256', Buffer.from(exchange.code_verifier))).toString('base64url');
  assert.equal(new URL(flow.result.headers.get('Location')).searchParams.get('code_challenge'), expected);
  const result = await h.worker.fetch(new Request('https://other.example/auth/callback?state=' + flow.state + '&code=other', {
    headers: { Cookie: flow.cookie },
  }), ENV);
  assert.match(await result.text(), /"status":"error"/);
  assert.equal(h.calls.length, 2);
});

test('GitHub token exchange and malformed JSON errors remain safe callback messages', async t => {
  for (const kind of ['network', 'status', 'json', 'oauth-error', 'bad-ttl']) await t.test(kind, async () => {
    const h = harness({ intercept: url => {
      if (!url.endsWith('/access_token')) return;
      if (kind === 'network') throw new Error('SECRET_LEAK');
      if (kind === 'status') return response({ message: 'SECRET_LEAK' }, 503);
      if (kind === 'json') return new Response('SECRET_LEAK');
      if (kind === 'bad-ttl') return response({ access_token: 'ghu_test_only', token_type: 'bearer', expires_in: -1 });
      return response({ error: 'SECRET_LEAK', error_description: 'SECRET_LEAK' });
    } });
    const { html, message } = await h.callback(await h.start());
    assert.equal(message.status, 'error');
    assert.doesNotMatch(html, /SECRET_LEAK|ghu_test_only/);
  });
});

test('invalid Contents metadata/base64/size and malformed JSON cannot be overwritten', async t => {
  const bytes = Buffer.from(JSON.stringify(EMPTY()));
  const valid = { type: 'file', path: FILE, sha: BLOB, encoding: 'base64', content: bytes.toString('base64'), size: bytes.length };
  const cases = [{ ...valid, type: 'symlink' }, { ...valid, sha: 'bad' }, { ...valid, encoding: 'none' },
    { ...valid, content: '%' }, { ...valid, size: 1 }, { ...valid, size: 1024 * 1024 },
    { ...valid, content: Buffer.from('not-json').toString('base64'), size: 8 }];
  for (const file of cases) await t.test(JSON.stringify(file).slice(0, 70), async () => {
    const h = harness({ intercept: url => url.includes('/contents/') ? response(file) : undefined });
    assert.equal((await h.post(await h.login())).status, 503);
    assert.equal(h.calls.some(call => call.method === 'PUT'), false);
  });
  const badJSON = harness({ intercept: url => url.includes('/contents/') ? new Response('bad JSON') : undefined });
  assert.equal((await badJSON.request('/notes')).status, 503);
});

test('uncertain network result is safe to retry with same ID after a persisted write', async () => {
  let contents = EMPTY();
  let firstWrite = true;
  const h = harness({ intercept: (url, init) => {
    if (url === `${CONTENTS}?ref=master`) {
      const bytes = Buffer.from(JSON.stringify(contents));
      return response({ type: 'file', path: FILE, sha: BLOB, encoding: 'base64', size: bytes.length, content: bytes.toString('base64') });
    }
    if (init.method === 'PUT' && firstWrite) {
      contents = JSON.parse(Buffer.from(JSON.parse(init.body).content, 'base64').toString());
      firstWrite = false;
      throw new Error('connection lost AFTER commit');
    }
  } });
  const token = await h.login();
  assert.equal((await h.post(token)).status, 503);
  const retry = await h.post(token);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).duplicate, true);
  assert.equal(h.calls.filter(call => call.method === 'PUT').length, 1);
  assert.equal(contents.entries.length, 1);
});

test('remote file capacity fails closed without dropping existing entries', async () => {
  const entries = Array.from({ length: 240 }, (_, i) => ({
    id: `171ce780-6fc9-4a24-b590-${String(i).padStart(12, '0')}`,
    created_at: '2026-11-06T00:00:00.000Z', body: '字'.repeat(1000), mood: '小确幸',
  }));
  // Grow to just below the decoded-file budget; the next note must exceed it.
  const document = { version: 1, entries };
  while (Buffer.byteLength(JSON.stringify(document, null, 2) + '\n') > 700 * 1024) entries.pop();
  const h = harness({ document });
  const before = JSON.stringify(document);
  const result = await h.post(await h.login(), { ...INPUT, body: '😀'.repeat(1000) });
  assert.equal(result.status, 413);
  assert.equal(h.calls.some(call => call.method === 'PUT'), false);
  assert.equal(JSON.stringify(h.document()), before);
});

test('session lifetime never exceeds shorter GitHub expiry; bad routes/methods never write', async () => {
  const h = harness({ intercept: url => url.endsWith('/access_token')
    ? response({ access_token: 'ghu_test_only', token_type: 'bearer', expires_in: 60 }) : undefined });
  const token = await h.login();
  const result = await h.request('/session', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal((await result.json()).expires_at, '2026-11-07T12:01:00.000Z');
  h.advance(60000);
  assert.equal((await h.post(token)).status, 401);
  for (const [path, method] of [['/unknown', 'GET'], ['/notes', 'DELETE'], ['/session', 'POST']]) {
    assert.equal((await h.request(path, { method })).status, 404);
  }
  assert.equal(h.calls.some(call => call.method === 'PUT'), false);
});
