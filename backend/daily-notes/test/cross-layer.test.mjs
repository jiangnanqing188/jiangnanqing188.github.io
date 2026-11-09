// Source-only DOM logic regressions. No build, browser service or real GitHub traffic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createWorker } from '../worker.mjs';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom'); // Existing Hexo dependency; no installation required.
const render = require('../../../themes/notebook/lib/daily.js');
const source = readFileSync(new URL('../../../themes/notebook/source/js/daily.js', import.meta.url), 'utf8');
const BLOG = 'https://jiangnanqing188.github.io';
const API = 'https://daily-notes.example.workers.dev';
const NOW = Date.parse('2026-11-07T12:00:00.000Z');
const ID = '171ce780-6fc9-4a24-b590-9d7af156a6a7';
const ID2 = '4991def7-5dd6-47be-a572-663f24145726';
const TOKEN = 'opaque-session-only-for-dom-test';
const KEY = 'fieldnotes-daily-draft-v1';
const note = (id = ID, body = 'DOM 逻辑夹具', date = '2026-11-06T12:00:00.000Z') => ({ id, body, mood: '随手记', created_at: date });
const doc = (entries = []) => ({ version: 1, entries });
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup(t, { data = doc(), api = API, fetch, draft } = {}) {
  const dom = new JSDOM(render(data, { api_url: api }), { url: `${BLOG}/daily/`, runScripts: 'outside-only' });
  const { window } = dom;
  t.after(() => window.close());
  let time = NOW;
  window.Date.now = () => time;
  window.crypto.randomUUID = () => ID2;
  const timeouts = new Map();
  const intervals = new Map();
  let timerId = 0;
  window.setTimeout = (fn, delay) => { const id = ++timerId; timeouts.set(id, { fn, delay }); return id; };
  window.clearTimeout = id => timeouts.delete(id);
  window.setInterval = fn => { const id = ++timerId; intervals.set(id, fn); return id; };
  window.clearInterval = id => intervals.delete(id);
  const popup = { closed: false, close() { this.closed = true; } };
  window.open = () => { popup.closed = false; return popup; };
  window.confirm = () => true;
  const calls = [];
  window.fetch = async (url, options = {}) => {
    calls.push({ url, ...options });
    const custom = await fetch?.(url, options);
    if (custom) return custom;
    if (url.endsWith('/notes') && options.method !== 'POST') return reply(doc());
    if (url.endsWith('/session')) return reply({ role: 'owner', login: 'jiangnanqing188', expires_at: new Date(time + 3600000).toISOString() });
    throw new Error('Unexpected mock request');
  };
  if (draft) window.localStorage.setItem(KEY, JSON.stringify(draft));
  window.eval(source);
  const $ = selector => window.document.querySelector(selector);
  const message = (data, origin = API, sender = popup) => window.dispatchEvent(new window.MessageEvent('message', { data, origin, source: sender }));
  const click = selector => $(selector).click();
  const login = async (token = TOKEN) => { click('[data-login]'); message({ type: 'daily-notes-auth', status: 'owner', session: token }); await settle(); };
  const input = value => { $('#daily-body').value = value; $('#daily-body').dispatchEvent(new window.Event('input', { bubbles: true })); };
  const submit = async () => { $('[data-compose-form]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await settle(); };
  return { window, $, click, login, message, input, submit, calls, popup,
    advance: ms => { time += ms; },
    tickIntervals: () => { for (const fn of [...intervals.values()]) fn(); },
    expire: async () => {
      time += 3600001;
      for (const [id, timer] of [...timeouts]) if (timer.delay > 20000) { timeouts.delete(id); timer.fn(); }
      await settle();
    },
  };
}

test('static helper escapes HTML/config and preserves literal Unicode JSON', () => {
  const body = '</script><img src=x onerror=alert(1)> 😀 & "';
  const dom = new JSDOM(render(doc([note(ID, body)]), { api_url: '"><script>bad</script>' }));
  assert.equal(dom.window.document.querySelectorAll('script').length, 1);
  assert.equal(dom.window.document.querySelector('[data-notes] p').textContent, body);
  assert.equal(JSON.parse(dom.window.document.querySelector('#daily-initial').textContent).entries[0].body, body);
  assert.equal(dom.window.document.querySelector('[data-daily]').dataset.apiUrl, '"><script>bad</script>');
  dom.window.close();
});

test('static helper rejects a malformed document instead of silently filtering into normal empty', async t => {
  for (const data of [undefined, { version: 2, entries: [] }, doc([note(), note()]), doc([{ ...note(), id: 'not-uuid' }]),
    doc([{ ...note(), created_at: 123 }]), doc([{ ...note(), created_at: '2026-02-30T00:00:00.000Z' }]),
    doc([note(ID, ' ')]), doc([note(ID, '\ud800')]), doc([note(ID, '字'.repeat(1001))]),
    doc([note(ID, 'older'), note(ID2, 'newer', '2026-11-07T00:00:00.000Z')])]) {
    await t.test(JSON.stringify(data)?.slice(0, 65) || 'missing', () => {
      const dom = new JSDOM(render(data));
      const d = dom.window.document;
      assert.match(d.querySelector('[data-read-status]').textContent, /异常|无法读取/);
      assert.equal(d.querySelector('[data-empty]').hidden, true);
      assert.equal(d.querySelectorAll('.daily-entry').length, 0);
      assert.equal(JSON.parse(d.querySelector('#daily-initial').textContent), null);
      dom.window.close();
    });
  }
});

test('malformed static JSON without configured service stays an error, not a confirmed empty', async t => {
  const h = setup(t, { data: doc([note(ID, '')]), api: '' });
  await settle();
  assert.equal(h.$('[data-empty]').hidden, true);
  assert.match(h.$('[data-read-status]').textContent, /异常|无法读取/);
  assert.equal(h.$('[data-login]').disabled, true);
});

test('unconfigured service and failed upstream never claim fresh empty data', async t => {
  const off = setup(t, { api: '' });
  assert.match(off.$('[data-read-status]').textContent, /尚未启用.*静态历史/);
  assert.equal(off.calls.length, 0);
  const broken = setup(t, { fetch: () => reply({ error: 'unavailable' }, 503) });
  await settle();
  assert.equal(broken.$('[data-empty]').hidden, true);
  assert.match(broken.$('[data-read-status]').textContent, /当前无法确认/);
  assert.equal(broken.$('[data-retry]').hidden, false);
});

test('stale public cache cannot remove previously known static or fetched entries', async t => {
  let reads = 0;
  const original = note();
  const newer = note(ID2, 'a newer stored entry', '2026-11-07T00:00:00.000Z');
  const h = setup(t, { data: doc([original]), fetch: url => {
    if (!url.endsWith('/notes')) return;
    reads++;
    return reply(doc(reads === 1 ? [newer] : []));
  } });
  await settle();
  assert.equal(h.$('[data-note-count]').textContent, '2 则小记');
  h.click('[data-retry]');
  await settle();
  assert.equal(h.$('[data-note-count]').textContent, '2 则小记');
});

test('same stored ID with conflicting data is rejected rather than replacing known text', async t => {
  const h = setup(t, { data: doc([note()]), fetch: url => url.endsWith('/notes') ? reply(doc([note(ID, 'changed')])) : undefined });
  await settle();
  assert.equal(h.$('[data-notes] p').textContent, 'DOM 逻辑夹具');
  assert.match(h.$('[data-read-status]').textContent, /异常|不一致/);
});

test('message origin AND exact popup source gate auth; token is verified before composer/draft appears', async t => {
  const check = deferred();
  const h = setup(t, { draft: { id: ID, body: 'private draft', mood: '小确幸' },
    fetch: url => url.endsWith('/session') ? check.promise : undefined });
  await settle();
  h.click('[data-login]');
  const payload = { type: 'daily-notes-auth', status: 'owner', session: TOKEN };
  h.message(payload, 'https://evil.example');
  h.message(payload, API, {});
  await settle();
  assert.equal(h.calls.filter(call => call.url.endsWith('/session')).length, 0);
  h.message(payload);
  await settle();
  assert.equal(h.$('[data-composer]').hidden, true);
  assert.equal(h.$('#daily-body').value, '');
  assert.equal(h.$('[data-login]').disabled, true);
  check.resolve(reply({ role: 'owner', login: 'jiangnanqing188', expires_at: new Date(NOW + 3600000).toISOString() }));
  await settle();
  assert.equal(h.$('[data-composer]').hidden, false);
  assert.equal(h.$('#daily-body').value, 'private draft');
  assert.doesNotMatch(h.window.document.documentElement.outerHTML, new RegExp(TOKEN));
  assert.doesNotMatch(h.window.localStorage.getItem(KEY), new RegExp(TOKEN));
});

test('non-JSON 401/403 publish response clears author state but keeps credential-free retry draft', async t => {
  for (const status of [401, 403]) await t.test(String(status), async t => {
    const h = setup(t, { fetch: (url, options) => options.method === 'POST' ? new Response('upstream html', { status }) : undefined });
    await h.login();
    h.input('keep retry text');
    await h.submit();
    assert.equal(h.$('[data-composer]').hidden, true);
    assert.equal(h.$('#daily-body').value, '');
    const draft = JSON.parse(h.window.localStorage.getItem(KEY));
    assert.deepEqual(draft, { id: ID2, body: 'keep retry text', mood: '随手记' });
    assert.equal(h.$('[data-login]').hidden, false);
  });
});

test('logout, expiry and reload never persist Bearer; readonly cannot restore author draft', async t => {
  const h = setup(t);
  await h.login();
  h.input('owner private draft 😀');
  h.click('[data-preview-toggle]');
  h.click('[data-logout]');
  assert.equal(h.$('#daily-body').value, '');
  assert.equal(h.$('[data-preview-body]').textContent, '');
  h.click('[data-login]');
  h.message({ type: 'daily-notes-auth', status: 'readonly' });
  await settle();
  assert.equal(h.$('#daily-body').value, '');
  assert.equal(h.$('[data-composer]').hidden, true);
  await h.login();
  assert.equal(h.$('#daily-body').value, 'owner private draft 😀');
  await h.expire();
  assert.equal(h.$('[data-composer]').hidden, true);
  const draft = h.window.localStorage.getItem(KEY);
  assert.doesNotMatch(draft, new RegExp(TOKEN));
  const reload = setup(t, { draft: JSON.parse(draft) });
  assert.equal(reload.$('[data-composer]').hidden, true);
  assert.equal(reload.$('#daily-body').value, '');
});

test('network-uncertain retry keeps ID over reload; duplicate acknowledgement survives stale GET', async t => {
  let attempt = 0;
  const submissions = [];
  const fetch = (url, options) => {
    if (options.method !== 'POST') return;
    const input = JSON.parse(options.body);
    submissions.push(input);
    if (attempt++ === 0) throw new TypeError('network uncertain');
    return reply({ entry: { ...input, created_at: new Date(NOW).toISOString() }, duplicate: true, commit_sha: null });
  };
  const h = setup(t, { fetch });
  await h.login();
  h.input('one intended record 😀');
  await h.submit();
  const restored = JSON.parse(h.window.localStorage.getItem(KEY));
  const next = setup(t, { fetch, draft: restored });
  await next.login();
  await next.submit();
  assert.deepEqual(submissions[0], submissions[1]);
  assert.equal(next.$('[data-note-count]').textContent, '1 则小记');
  assert.equal(next.window.localStorage.getItem(KEY), null);
  next.click('[data-retry]');
  await settle();
  assert.equal(next.$('[data-note-count]').textContent, '1 则小记');
});

test('409 blocks resubmit until a later successful read and preserves original ID', async t => {
  let writes = 0;
  let failRead = false;
  const inputs = [];
  const h = setup(t, { fetch: (url, options) => {
    if (options.method === 'POST') {
      writes++;
      const input = JSON.parse(options.body);
      inputs.push(input);
      return writes === 1 ? new Response('gateway conflict page, not JSON', { status: 409 })
        : reply({ entry: { ...input, created_at: new Date(NOW).toISOString() }, commit_sha: 'a'.repeat(40), duplicate: false }, 201);
    }
    if (url.endsWith('/notes') && failRead) return reply({ error: 'unavailable' }, 503);
  } });
  await h.login();
  h.input('CAS retry');
  await h.submit();
  assert.equal(h.$('[data-publish]').disabled, true);
  await h.submit();
  assert.equal(writes, 1);
  failRead = true;
  h.click('[data-retry]');
  await settle();
  assert.equal(h.$('[data-publish]').disabled, true);
  failRead = false;
  h.click('[data-retry]');
  await settle();
  assert.equal(h.$('[data-publish]').disabled, false);
  await h.submit();
  assert.deepEqual(inputs[0], inputs[1]);
});

test('Unicode code points align with backend and literal preview never becomes HTML', async t => {
  const h = setup(t, { api: API });
  await h.login();
  h.input('😀'.repeat(1000));
  assert.equal(h.$('[data-publish]').disabled, false);
  assert.equal(h.$('#daily-count').textContent, '1000 / 1000');
  h.input('😀'.repeat(1001));
  assert.equal(h.$('[data-publish]').disabled, true);
  h.input('\ud800');
  assert.equal(h.$('[data-publish]').disabled, true);
  h.input('</script><img src=x onerror=alert(1)>');
  h.click('[data-preview-toggle]');
  assert.equal(h.$('[data-preview-body]').textContent, '</script><img src=x onerror=alert(1)>');
  assert.equal(h.$('[data-preview-body] img'), null);
});

test('callback message already queued before popup.close is not lost to closed-window polling', async t => {
  const h = setup(t);
  await settle();
  h.click('[data-login]');
  // The callback posts a message and closes immediately. A queued timer may run first.
  h.popup.closed = true;
  h.tickIntervals();
  h.message({ type: 'daily-notes-auth', status: 'owner', session: TOKEN });
  await settle();
  assert.equal(h.$('[data-composer]').hidden, false);
});

test('late POST success after logout cannot reopen composer or clear the retained retry draft', async t => {
  const pending = deferred();
  const h = setup(t, { fetch: (url, options) => options.method === 'POST' ? pending.promise : undefined });
  await h.login();
  h.input('in-flight logout text');
  await h.submit();
  h.click('[data-logout]');
  const stored = h.window.localStorage.getItem(KEY);
  pending.resolve(reply({ entry: note(ID2, 'in-flight logout text', new Date(NOW).toISOString()), duplicate: false, commit_sha: 'a'.repeat(40) }, 201));
  await settle();
  assert.equal(h.$('[data-composer]').hidden, true);
  assert.equal(h.$('#daily-body').value, '');
  assert.equal(h.window.localStorage.getItem(KEY), stored);
  assert.doesNotMatch(stored, new RegExp(TOKEN));
});

test('remote records with impossible calendar dates or noncanonical fields fail without fake empty', async t => {
  for (const entry of [{ ...note(), created_at: '2026-02-30T00:00:00.000Z' }, { ...note(), extra: true },
    { ...note(), id: '171ce780-6fc9-0a24-1590-9d7af156a6a7' }]) {
    const h = setup(t, { fetch: url => url.endsWith('/notes') ? reply(doc([entry])) : undefined });
    await settle();
    assert.equal(h.$('[data-empty]').hidden, true);
    assert.match(h.$('[data-read-status]').textContent, /格式异常/);
  }
});

test('actually cancelled popup exits after bounded grace; late messages from it are rejected', async t => {
  const h = setup(t);
  await settle();
  h.click('[data-login]');
  h.popup.closed = true;
  h.tickIntervals();
  h.advance(1001);
  h.tickIntervals();
  assert.match(h.$('[data-auth-status]').textContent, /取消登录/);
  h.message({ type: 'daily-notes-auth', status: 'owner', session: TOKEN });
  await settle();
  assert.equal(h.calls.filter(call => call.url.endsWith('/session')).length, 0);
  assert.equal(h.$('[data-composer]').hidden, true);
});

test('DOM client integrates with real Worker encryption, user checks, source CAS and response validation (mock GitHub only)', async t => {
  const env = { SESSION_SECRET: '13'.repeat(32), GITHUB_CLIENT_ID: 'Iv1.test', GITHUB_CLIENT_SECRET: 'test-only' };
  const path = 'source/_data/daily.json';
  const fileURL = `https://api.github.com/repos/jiangnanqing188/jiangnanqing188.github.io/contents/${path}`;
  const blobSHA = 'a'.repeat(40);
  const commitSHA = 'b'.repeat(40);
  let canonical = doc();
  let userChecks = 0;
  let puts = 0;
  const worker = createWorker({ now: () => NOW, fetch: async (url, options) => {
    if (url === 'https://github.com/login/oauth/access_token') return reply({ access_token: 'ghu_local_fixture', token_type: 'bearer', expires_in: 3600 });
    if (url === 'https://api.github.com/user') {
      userChecks++;
      assert.equal(options.headers.Authorization, 'Bearer ghu_local_fixture');
      return reply({ id: 192717492, login: 'jiangnanqing188' });
    }
    if (url === `${fileURL}?ref=master`) {
      const bytes = Buffer.from(JSON.stringify(canonical));
      return reply({ type: 'file', path, sha: blobSHA, encoding: 'base64', size: bytes.length, content: bytes.toString('base64') });
    }
    assert.equal(url, fileURL);
    assert.equal(options.method, 'PUT');
    const update = JSON.parse(options.body);
    assert.equal(update.branch, 'master');
    assert.equal(update.sha, blobSHA);
    canonical = JSON.parse(Buffer.from(update.content, 'base64').toString());
    puts++;
    return reply({ commit: { sha: commitSHA }, content: { path, sha: blobSHA } }, 201);
  } });
  const start = await worker.fetch(new Request(`${API}/auth/start`), env);
  const state = new URL(start.headers.get('Location')).searchParams.get('state');
  const callback = await worker.fetch(new Request(`${API}/auth/callback?state=${state}&code=fixture`, {
    headers: { Cookie: start.headers.get('Set-Cookie').split(';')[0] },
  }), env);
  const html = await callback.text();
  const auth = JSON.parse(html.match(/postMessage\((\{.*?\}),"/)[1]);
  assert.equal(auth.status, 'owner');
  // A pending Worker request must outlive settle() without being mistaken for a completed publish.
  const postGate = deferred();
  const h = setup(t, { fetch: async (url, options) => {
    if (options.method === 'POST') await postGate.promise;
    return worker.fetch(new Request(url, {
      ...options, headers: { ...options.headers, Origin: BLOG },
    }), env);
  } });
  const waitForUI = predicate => new Promise((resolve, reject) => {
    const observer = new h.window.MutationObserver(check);
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('DOM transition did not finish')); }, 5000);
    function check() {
      if (!predicate()) return;
      observer.disconnect();
      clearTimeout(timeout);
      resolve();
    }
    observer.observe(h.window.document, { subtree: true, childList: true, attributes: true, characterData: true });
    check();
  });
  await h.login(auth.session);
  await waitForUI(() => !h.$('[data-composer]').hidden || h.$('[data-auth-status]').dataset.error === 'true');
  assert.equal(h.$('[data-composer]').hidden, false);
  h.input('真实组件连接的本地夹具 😀 <script>plain text</script>');
  await h.submit();
  assert.equal(puts, 0);
  assert.equal(h.$('[data-publish]').textContent, '正在写入 GitHub…');
  postGate.resolve();
  await waitForUI(() => h.$('[data-publish]').textContent === '发布小记 ↗');
  assert.equal(h.$('[data-note-count]').textContent, '1 则小记');
  assert.equal(h.$('[data-notes] p').textContent, canonical.entries[0].body);
  assert.equal(puts, 1);
  assert.equal(userChecks, 3); // OAuth owner + /session + publish /user checks.
  assert.equal(h.window.localStorage.getItem(KEY), null);
  assert.doesNotMatch(h.window.document.documentElement.outerHTML, /ghu_local_fixture|v1\.[A-Za-z0-9_-]+\./);
});
