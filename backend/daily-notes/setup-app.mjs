#!/usr/bin/env node
// One-shot local setup only. Never import this module into the production Worker.
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, lstat, realpath, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER = 'jiangnanqing188';
const OWNER_ID = 192717492;
const APP_NAME = `${OWNER}-daily-notes`;
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TTL = 15 * 60 * 1000;
const MAX_RESPONSE = 128 * 1024;
const CALLBACK = 'https://jiangnan-daily-notes.jiangnanqingwqw.workers.dev/auth/callback';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const matches = (a, b) => typeof a === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function readBounded(response) {
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE) throw new Error('unsafe-response');
  if (!response.body) throw new Error('unsafe-response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE) throw new Error('unsafe-response');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validateApp(app) {
  if (!app || app.owner?.id !== OWNER_ID || app.owner?.login !== OWNER ||
      app.name !== APP_NAME || app.slug !== APP_NAME ||
      app.html_url !== `https://github.com/apps/${APP_NAME}` ||
      !app.permissions || app.permissions.contents !== 'write' || app.permissions.metadata !== 'read' ||
      Object.keys(app.permissions).some(key => !['contents', 'metadata'].includes(key)) ||
      !Array.isArray(app.events) || app.events.length ||
      typeof app.client_id !== 'string' || !/^[A-Za-z0-9_.-]{5,128}$/.test(app.client_id) ||
      typeof app.client_secret !== 'string' || !/^[A-Za-z0-9_-]{20,256}$/.test(app.client_secret)) {
    throw new Error('unexpected-app');
  }
  // Deliberately discard PEM and webhook_secret; this flow never uses them.
  return {
    client_id: app.client_id,
    client_secret: app.client_secret,
    app_url: app.html_url,
    slug: app.slug
  };
}

/** onCredentials is server-side only; no secrets are written to HTTP responses. */
export async function createSetupServer({ onCredentials, fetchImpl = fetch, now = Date.now, port = 0 } = {}) {
  if (typeof onCredentials !== 'function') throw new Error('A private credential sink is required.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid local port.');
  const state = randomBytes(32).toString('hex');
  const nonce = randomBytes(24).toString('hex');
  const startPath = `/setup/${nonce}`;
  // The random callback path is also bound to this setup; GitHub appends query state.
  const callbackPath = `/callback/${state}`;
  const expires = now() + TTL;
  let origin, used = false, closed = false;
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  let timer;
  const server = http.createServer(async (req, res) => {
    function reply(status, text, html = false) {
      res.writeHead(status, {
        'Content-Type': html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action https://github.com"
      });
      res.end(text);
    }
    // No CORS, no remote Host or unsafe methods, even on the secret setup path.
    if (req.headers.host !== new URL(origin).host ||
        (req.headers.origin && req.headers.origin !== origin) ||
        req.headers['access-control-request-method']) return reply(403, 'Request rejected.');
    if (req.method !== 'GET') return reply(405, 'GET only.');
    if (req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length'] !== '0')) {
      return reply(400, 'Request rejected.');
    }
    if (now() >= expires) return reply(410, 'Setup expired. Start a new local setup.');
    if (!req.url?.startsWith('/') || req.url.length > 2048) return reply(400, 'Request rejected.');
    let url;
    try { url = new URL(req.url, origin); } catch { return reply(400, 'Request rejected.'); }
    if (url.origin !== origin) return reply(403, 'Request rejected.');
    if (url.pathname === startPath) {
      if (url.search || used) return reply(410, 'This setup is unavailable.');
      const manifest = {
        name: APP_NAME,
        url: `https://${OWNER}.github.io/daily/`,
        redirect_url: `${origin}${callbackPath}`,
        callback_urls: [CALLBACK],
        hook_attributes: { active: false },
        public: false,
        default_permissions: { contents: 'write', metadata: 'read' },
        default_events: []
      };
      return reply(200, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>日常小记一次性开通</title><h1>日常小记 · GitHub App 设置</h1><p>仅注册私有 App；仓库安装将在 GitHub 中另行选择。请先核对账号和权限，再确认创建。</p><form method="post" action="https://github.com/settings/apps/new?state=${state}"><input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}"><button type="submit">前往 GitHub 核对并创建</button></form><p>此本机入口 15 分钟后失效，不显示或传抄任何密钥。</p></html>`, true);
    }
    if (url.pathname !== callbackPath) return reply(404, 'Not found.');
    if (used) return reply(410, 'This setup has already been used.');
    if (url.searchParams.getAll('state').length !== 1 || !matches(url.searchParams.get('state'), state) ||
        url.searchParams.getAll('code').length !== 1 ||
        [...url.searchParams.keys()].some(key => !['state', 'code'].includes(key)) ||
        !/^[A-Za-z0-9_-]{1,256}$/.test(url.searchParams.get('code') ?? '')) {
      return reply(400, 'Callback rejected. No credentials exchanged.');
    }
    // Consume before any await: simultaneous callbacks cannot exchange twice.
    used = true;
    try {
      const response = await fetchImpl(`https://api.github.com/app-manifests/${encodeURIComponent(url.searchParams.get('code'))}/conversions`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'daily-notes-local-setup' }
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw new Error('exchange-failed');
      }
      const credentials = validateApp(await readBounded(response));
      if (now() >= expires || closed) throw new Error('setup-expired');
      await onCredentials(credentials);
      res.once('finish', () => finish({ status: 'complete', client_id: credentials.client_id, app_url: credentials.app_url, slug: credentials.slug }));
      reply(200, 'Setup complete. Credentials saved privately on this computer. You may close this tab.');
    } catch {
      // Never include remote exception text, upstream bodies, code, or headers.
      res.once('finish', () => finish({ status: 'failed' }));
      reply(502, 'Setup failed. No credentials displayed. Check the private setup status; do not reuse this callback.');
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 30;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  const close = () => {
    closed = true;
    clearTimeout(timer);
    finish({ status: 'closed' });
    server.close();
    server.closeAllConnections();
  };
  timer = setTimeout(() => { finish({ status: 'expired' }); close(); }, TTL);
  timer.unref();
  return { url: `${origin}${startPath}`, done, close };
}

/** Create a NEW, private directory outside the repo, without traversing symlinks. */
export async function createPrivateCredentialSink(directory, { repoRoot = REPO_ROOT } = {}) {
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory || directory === path.parse(directory).root) {
    throw new Error('Use a new absolute private directory outside the repository.');
  }
  const repo = await realpath(repoRoot);
  const relative = path.relative(repo, directory);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Private directory must be outside the repository.');
  }
  const parent = path.dirname(directory);
  let current = path.parse(parent).root;
  for (const part of parent.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory() ||
        ![0, process.getuid?.()].includes(stat.uid) ||
        (stat.mode & 0o022 && !(stat.mode & 0o1000))) {
      throw new Error('Unsafe private directory parent.');
    }
  }
  await mkdir(directory, { mode: 0o700 }); // EEXIST intentionally rejects reuse and symlinks.
  const dirStat = await lstat(directory);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink() || (dirStat.mode & 0o777) !== 0o700 || dirStat.uid !== process.getuid?.()) {
    throw new Error('Unsafe private directory.');
  }
  let written = false;
  return async credentials => {
    const currentStat = await lstat(directory);
    if (currentStat.isSymbolicLink() || currentStat.ino !== dirStat.ino || currentStat.dev !== dirStat.dev ||
        (currentStat.mode & 0o777) !== 0o700 || currentStat.uid !== dirStat.uid) {
      throw new Error('Private directory changed.');
    }
    if (written) throw new Error('Private setup already written.');
    written = true;
    const secrets = { GITHUB_CLIENT_SECRET: credentials.client_secret, SESSION_SECRET: randomBytes(32).toString('hex') };
    const metadata = { client_id: credentials.client_id, app_url: credentials.app_url, slug: credentials.slug, purpose: 'One-time setup; remove this directory after secret upload.' };
    for (const [filename, data] of [['worker-secrets.json', secrets], ['app-metadata.json', metadata]]) {
      const handle = await open(path.join(directory, filename), 'wx', 0o600);
      try { await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`); } finally { await handle.close(); }
    }
  };
}

async function main(args) {
  if (args.length !== 2 && args.length !== 4 || args[0] !== '--private-dir' || args.length === 4 && args[2] !== '--port') {
    throw new Error('Usage: node backend/daily-notes/setup-app.mjs --private-dir /tmp/NEW-private-directory [--port 8765]');
  }
  const sink = await createPrivateCredentialSink(args[1]);
  const setup = await createSetupServer({ onCredentials: sink, port: args.length === 4 ? Number(args[3]) : 0 });
  console.log(`Local setup URL: ${setup.url}`);
  const stop = () => setup.close();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const result = await setup.done;
  setup.close();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
  if (result.status === 'complete') {
    console.log(JSON.stringify(result)); // Public metadata only; never log credentials.
    console.log('Private one-time files saved. Upload worker-secrets.json securely, then remove the private directory.');
  } else {
    console.error(`Setup ${result.status}. No secret values displayed.`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    console.error('Local setup could not start. Use a new absolute private directory outside the repository and an available port. No sensitive error details displayed.');
    process.exitCode = 1;
  });
}
