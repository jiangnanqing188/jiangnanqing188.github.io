// Cloudflare module Worker. No runtime packages; tests inject only platform boundaries.
const ALLOWED_ORIGIN = 'https://jiangnanqing188.github.io';
const OWNER_ID = 192717492;
const OWNER_LOGIN = 'jiangnanqing188';
const REPO = 'jiangnanqing188.github.io';
const BRANCH = 'master';
const PATH = 'source/_data/daily.json';
const CONTENTS = `https://api.github.com/repos/${OWNER_LOGIN}/${REPO}/contents/${PATH}`;
const COOKIE = '__Host-daily-notes-oauth';
const AUTH_TTL = 600;
const SESSION_TTL = 3600;
const UPSTREAM_LIMIT = 1024 * 1024;
// A Contents API JSON envelope base64-encodes the file; leave room for metadata/newlines.
const FILE_LIMIT = 700 * 1024;
const MOODS = new Set(['随手记', '吐槽一下', '小确幸']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{40}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
function unbase64(text) { return Uint8Array.from(atob(text), c => c.charCodeAt(0)); }
function url64(bytes) { return base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unurl64(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('encoding');
  return unbase64(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4));
}
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function validBody(body) {
  return typeof body === 'string' && body.trim().length > 0 && [...body].length <= 1000
    // Reject invalid Unicode rather than have UTF-8 encoding silently change stored text.
    && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(body);
}
function validInput(value) {
  return exactKeys(value, ['id', 'body', 'mood']) && typeof value.id === 'string'
    && UUID.test(value.id) && validBody(value.body) && MOODS.has(value.mood);
}
function validDocument(value) {
  if (!exactKeys(value, ['version', 'entries']) || value.version !== 1 || !Array.isArray(value.entries)) return false;
  const ids = new Set();
  let previous = Infinity;
  for (const entry of value.entries) {
    if (!exactKeys(entry, ['id', 'created_at', 'body', 'mood'])
      || !validInput({ id: entry.id, body: entry.body, mood: entry.mood })
      || typeof entry.created_at !== 'string'
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(entry.created_at)) return false;
    const time = Date.parse(entry.created_at);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== entry.created_at
      || time > previous || ids.has(entry.id)) return false;
    ids.add(entry.id);
    previous = time;
  }
  return true;
}
async function boundedJSON(message, limit, status, invalidStatus = status) {
  const declared = message.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) fail(status, '数据超过大小限制');
  if (!message.body) fail(invalidStatus, 'JSON 数据无效');
  const reader = message.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        fail(status, '数据超过大小限制');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(decoder.decode(bytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(invalidStatus, 'JSON 数据无效');
  } finally { reader.releaseLock(); }
}

// testOrigin is constructor-only, never read from request/env. The default export cannot enable it.
export function createWorker({ fetch: fetcher = (...args) => globalThis.fetch(...args),
  now = () => Date.now(), cache, testOrigin } = {}) {
  if (testOrigin && !/^http:\/\/localhost:\d+$/.test(testOrigin)) throw new Error('Invalid test origin');
  const origin = testOrigin || ALLOWED_ORIGIN;
  const seconds = () => Math.floor(now() / 1000);
  const publicCache = () => cache ?? globalThis.caches?.default;
  function config(env, auth = false) {
    if ((env.ALLOWED_ORIGIN !== undefined && env.ALLOWED_ORIGIN !== origin)
      || (env.OWNER_ID !== undefined && String(env.OWNER_ID) !== String(OWNER_ID))) fail(503, '后端配置无效');
    if (auth && (!/^[0-9a-fA-F]{64}$/.test(env.SESSION_SECRET || '')
      || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET)) fail(503, '后端认证尚未配置');
  }
  async function key(env) {
    const bytes = Uint8Array.from(env.SESSION_SECRET.match(/../g), pair => parseInt(pair, 16));
    return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const aad = (purpose, request) => encoder.encode(`daily-notes:v1:${purpose}:${new URL(request.url).origin}:${origin}`);
  async function seal(data, purpose, request, env) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData: aad(purpose, request) }, await key(env), encoder.encode(JSON.stringify(data)));
    return `v1.${url64(iv)}.${url64(new Uint8Array(encrypted))}`;
  }
  async function open(token, purpose, request, env) {
    try {
      if (typeof token !== 'string' || token.length > 8192) throw new Error('size');
      const parts = token.split('.');
      if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('format');
      const iv = unurl64(parts[1]);
      if (iv.length !== 12) throw new Error('iv');
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv,
        additionalData: aad(purpose, request) }, await key(env), unurl64(parts[2]));
      const value = JSON.parse(decoder.decode(plaintext));
      const ttl = purpose === 'oauth' ? AUTH_TTL : SESSION_TTL;
      if (!Number.isInteger(value.iat) || !Number.isInteger(value.exp)
        || value.iat > seconds() || value.exp <= seconds() || value.exp <= value.iat
        || value.exp - value.iat > ttl) throw new Error('expiry');
      return value;
    } catch { fail(401, '认证无效或已过期，请重新登录'); }
  }
  async function github(url, token, options = {}) {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'daily-notes-worker',
      'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}) };
    try {
      // Workers supports manual, not error; never forward credentials through redirects.
      const response = await fetcher(url, { ...options, headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (response.status >= 300 && response.status < 400) fail(503, 'GitHub 暂时不可用，请稍后重试');
      return response;
    } catch { fail(503, 'GitHub 暂时不可用，请稍后重试'); }
  }
  async function owner(token) {
    const response = await github('https://api.github.com/user', token);
    if (response.status === 401) fail(401, 'GitHub 授权已失效，请重新登录');
    if (!response.ok) fail(503, 'GitHub 用户核验暂时不可用');
    const user = await boundedJSON(response, 64 * 1024, 503);
    if (user.id !== OWNER_ID) fail(403, '仅博主本人可以发布');
    return user;
  }
  async function session(request, env) {
    config(env, true);
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)) fail(401, '请先登录');
    const value = await open(authorization.slice(7), 'session', request, env);
    if (value.owner !== OWNER_ID) fail(403, '仅博主本人可以发布');
    if (typeof value.token !== 'string' || !value.token || value.token.length > 4096) fail(401, '会话无效');
    await owner(value.token); // Revalidate actual numeric identity on EVERY write/session check.
    return value;
  }
  async function readNotes(token) {
    const response = await github(`${CONTENTS}?ref=${BRANCH}`, token);
    if (response.status === 404) return { document: { version: 1, entries: [] }, sha: undefined };
    if (!response.ok) fail(503, 'GitHub 小记读取失败，请稍后重试');
    const file = await boundedJSON(response, UPSTREAM_LIMIT, 503);
    try {
      if (file.type !== 'file' || file.path !== PATH || file.encoding !== 'base64'
        || !SHA.test(file.sha) || !Number.isInteger(file.size) || file.size < 0 || file.size > FILE_LIMIT
        || typeof file.content !== 'string') throw new Error('file');
      const bytes = unbase64(file.content.replace(/\s/g, ''));
      if (bytes.length !== file.size || bytes.length > FILE_LIMIT) throw new Error('size');
      const document = JSON.parse(decoder.decode(bytes));
      if (!validDocument(document)) throw new Error('document');
      return { document, sha: file.sha };
    } catch { fail(503, '远端小记文件格式无效，未作修改'); }
  }
  const cacheKey = request => new Request(`${new URL(request.url).origin}/notes`);
  async function clearCache(request) {
    // Cache failure cannot turn a GitHub-confirmed commit into a failed publish.
    try { await publicCache()?.delete(cacheKey(request)); } catch { /* At most the existing 120s TTL remains. */ }
  }
  async function publicNotes(request) {
    const key = cacheKey(request);
    let hit;
    try { hit = await publicCache()?.match(key); } catch { /* Read canonical source instead. */ }
    if (hit) return hit;
    const { document } = await readNotes();
    const response = json(document);
    response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=120');
    try { await publicCache()?.put(key, response.clone()); } catch { /* Canonical read still succeeded. */ }
    return response;
  }
  async function appendNote(request, env) {
    if (request.headers.get('Origin') !== origin) fail(403, '来源不允许');
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') || '')) {
      fail(415, '仅接受 application/json');
    }
    const input = await boundedJSON(request, 16 * 1024, 413, 400);
    if (!validInput(input)) fail(400, '需要 UUID、1–1000 字符非空纯文本和有效心情；不接受额外字段');
    const auth = await session(request, env);
    const { document, sha } = await readNotes(auth.token);
    const existing = document.entries.find(entry => entry.id === input.id);
    if (existing) {
      if (existing.body !== input.body || existing.mood !== input.mood) fail(409, '该 ID 已用于不同内容');
      await clearCache(request);
      // No new commit on a duplicate; Contents API blob SHA is NOT a commit SHA.
      return json({ entry: existing, commit_sha: null, duplicate: true });
    }
    const entry = { id: input.id, created_at: new Date(now()).toISOString(), body: input.body, mood: input.mood };
    document.entries.unshift(entry);
    document.entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const bytes = encoder.encode(`${JSON.stringify(document, null, 2)}\n`);
    if (bytes.length > FILE_LIMIT) fail(413, '小记档案已达到容量上限，未写入');
    const response = await github(CONTENTS, auth.token, { method: 'PUT', body: JSON.stringify({
      message: `Add daily note ${input.id}`, branch: BRANCH, content: base64(bytes), ...(sha ? { sha } : {}),
    }) });
    if (response.status === 409 || response.status === 422) fail(409, '远端版本或写入条件冲突，请读取后重试同一 ID');
    if (!response.ok) fail(503, 'GitHub 未确认保存，请保留原 ID 后重试');
    const result = await boundedJSON(response, UPSTREAM_LIMIT, 503);
    if (!SHA.test(result.commit?.sha) || result.content?.path !== PATH || !SHA.test(result.content?.sha)) {
      fail(503, 'GitHub 保存确认不完整，请保留原 ID 后重试');
    }
    await clearCache(request);
    return json({ entry, commit_sha: result.commit.sha, duplicate: false }, 201);
  }
  const cookie = (value, maxAge) => `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  function callbackPage(request, message) {
    const nonce = url64(crypto.getRandomValues(new Uint8Array(18)));
    // Escape script-breaking characters even though all message fields are server-owned.
    const safeJSON = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>日常小记登录</title>`
      + `<p>登录流程已结束，可以关闭此窗口。</p><script nonce="${nonce}">`
      + `if(window.opener){window.opener.postMessage(${safeJSON({ type: 'daily-notes-auth', ...message })},${safeJSON(origin)});window.close();}`
      + '</script></html>', { headers: {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Set-Cookie': cookie('', 0), 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      // Keep cross-origin window.opener; do not add COOP same-origin here.
    } });
  }
  async function authStart(request, env) {
    config(env, true);
    const state = url64(crypto.getRandomValues(new Uint8Array(32)));
    const verifier = url64(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = url64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
    const iat = seconds();
    const sealed = await seal({ state, verifier, iat, exp: iat + AUTH_TTL }, 'oauth', request, env);
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, state,
      redirect_uri: `${new URL(request.url).origin}/auth/callback`, code_challenge: challenge, code_challenge_method: 'S256' });
    return new Response(null, { status: 302, headers: { Location: url.href,
      'Set-Cookie': cookie(sealed, AUTH_TTL), 'Cache-Control': 'no-store' } });
  }
  async function authCallback(request, env) {
    try {
      config(env, true);
      const url = new URL(request.url);
      const matches = (request.headers.get('Cookie') || '').split(';').map(part => part.trim())
        .filter(part => part.startsWith(`${COOKIE}=`));
      if (matches.length !== 1) fail(401, '登录状态丢失，请重新登录');
      const flow = await open(matches[0].slice(COOKIE.length + 1), 'oauth', request, env);
      if (typeof flow.state !== 'string' || typeof flow.verifier !== 'string'
        || url.searchParams.getAll('state').length !== 1 || url.searchParams.get('state') !== flow.state) {
        fail(401, '登录状态不匹配，请重新登录');
      }
      if (url.searchParams.has('error')) fail(401, '登录已取消或未获授权');
      const code = url.searchParams.get('code');
      if (!code || code.length > 2048 || url.searchParams.getAll('code').length !== 1) fail(401, '登录凭据缺失');
      let response;
      try {
        response = await fetcher('https://github.com/login/oauth/access_token', {
          method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
            code, code_verifier: flow.verifier, redirect_uri: `${url.origin}/auth/callback` }),
        });
      } catch { fail(503, 'GitHub 登录暂时不可用'); }
      if (!response.ok) fail(503, 'GitHub 登录暂时不可用');
      const token = await boundedJSON(response, 64 * 1024, 503);
      if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 4096
        || token.token_type?.toLowerCase() !== 'bearer' || token.error) fail(401, 'GitHub 授权失败，请重新登录');
      try { await owner(token.access_token); } catch (error) {
        if (error instanceof HttpError && error.status === 403) return callbackPage(request, { status: 'readonly' });
        throw error;
      }
      const iat = seconds();
      const ttl = token.expires_in === undefined ? SESSION_TTL : Math.min(SESSION_TTL, token.expires_in);
      if (!Number.isInteger(ttl) || ttl <= 0) fail(401, 'GitHub 授权有效期无效');
      const opaque = await seal({ token: token.access_token, owner: OWNER_ID, iat, exp: iat + ttl }, 'session', request, env);
      return callbackPage(request, { status: 'owner', session: opaque });
    } catch (error) {
      return callbackPage(request, { status: 'error',
        message: error instanceof HttpError ? error.message : '登录失败，请重新登录' });
    }
  }
  function finish(request, response) {
    const result = new Response(response.body, response);
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('Referrer-Policy', 'no-referrer');
    result.headers.set('Vary', 'Origin');
    result.headers.delete('Access-Control-Allow-Origin');
    if (request.headers.get('Origin') === origin) result.headers.set('Access-Control-Allow-Origin', origin);
    return result;
  }
  async function route(request, env) {
    config(env);
    const path = new URL(request.url).pathname;
    if (request.method === 'OPTIONS') {
      if (request.headers.get('Origin') !== origin) fail(403, '来源不允许');
      const methods = path === '/notes' ? ['GET', 'POST'] : path === '/session' ? ['GET'] : [];
      const method = request.headers.get('Access-Control-Request-Method');
      const headers = (request.headers.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
      if (!methods.includes(method) || headers.some(h => !['authorization', 'content-type'].includes(h))) fail(403, '预检请求不允许');
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Methods': methods.join(', '), 'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store',
      } });
    }
    if (path === '/auth/start' && request.method === 'GET') return authStart(request, env);
    if (path === '/auth/callback' && request.method === 'GET') return authCallback(request, env);
    if (path === '/notes' && request.method === 'GET') return publicNotes(request);
    if (path === '/notes' && request.method === 'POST') return appendNote(request, env);
    if (path === '/session' && request.method === 'GET') {
      const auth = await session(request, env);
      return json({ role: 'owner', login: OWNER_LOGIN, expires_at: new Date(auth.exp * 1000).toISOString() });
    }
    if (path === '/health' && request.method === 'GET') { config(env, true); return json({ ok: true }); }
    fail(404, '接口不存在');
  }
  return { async fetch(request, env) {
    try { return finish(request, await route(request, env)); } catch (error) {
      return finish(request, json({ error: error instanceof HttpError ? error.message : '后端暂时不可用' },
        error instanceof HttpError ? error.status : 503));
    }
  } };
}

export default createWorker();
