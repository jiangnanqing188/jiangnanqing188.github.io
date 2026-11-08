'use strict';

// Local Chromium UI regression with a deliberately fake Worker/GitHub boundary.
// No account, real OAuth, public note, Cloudflare deployment or repository write.
// NODE_PATH=<existing Playwright modules> node scripts/check-daily.cjs
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

async function main() {
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {randomUUID} = require('node:crypto');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../public');
const qa = process.env.DAILY_QA_DIR || fs.mkdtempSync('/tmp/daily-qa-');
const report = {scope: 'Local generated HTML and Chromium; simulated Worker/OAuth responses, NOT production identity or GitHub/Cloudflare validation.', groups: []};
const draftKey = 'fieldnotes-daily-draft-v1';
const opaque = 'v1.TEST-ONLY-NOT-A-CREDENTIAL.opaque';
const fixture = [
  {id: randomUUID(), created_at: '2026-11-07T13:36:00.000Z', mood: '吐槽一下', body: '[本地测试示例]\n有时候调的不是车，是自己的心态。先睡了，明天再和它讲道理。'},
  {id: randomUUID(), created_at: '2026-11-05T10:12:00.000Z', mood: '小确幸', body: '[本地测试示例] 今天的小车，终于自己跑完了一圈。'},
];
let apiOn = false;
let state;
let base;
let api;
let browser;
const reset = () => { state = {entries: [], login: 'owner', ttl: 300, gets: 0, sessions: 0, posts: [], postMode: 'success', readError: false, sessionError: false}; };
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.vtt': 'text/vtt', '.mp4': 'video/mp4'};
function listen(server) { return new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, 'localhost', resolve); }); }
function json(res, code, value) { res.writeHead(code, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}).end(JSON.stringify(value)); }
const staticServer = http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  // Test-only injection in served bytes. Never changes public/ or production configuration.
  if (file === path.join(root, 'daily/index.html')) {
    let html = fs.readFileSync(file, 'utf8');
    if (apiOn) {
      assert.ok(html.includes('data-api-url=""'), 'Production config must remain disabled until real setup');
      html = html.replace('data-api-url=""', `data-api-url="${api}"`);
    }
    res.end(html); return;
  }
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
});
const apiServer = http.createServer(async (req, res) => {
  if (req.headers.origin === base) res.setHeader('Access-Control-Allow-Origin', base);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') { res.writeHead(204, {'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type'}).end(); return; }
  const endpoint = new URL(req.url, 'http://localhost').pathname;
  if (endpoint === '/notes' && req.method === 'GET') {
    state.gets++;
    return json(res, state.readError ? 503 : 200, state.readError ? {error: 'TEST upstream unavailable'} : {version: 1, entries: state.entries});
  }
  if (endpoint === '/session') {
    state.sessions++;
    if (state.sessionError || req.headers.authorization !== `Bearer ${opaque}`) return json(res, 403, {error: 'TEST not owner'});
    return json(res, 200, {role: 'owner', login: 'jiangnanqing188', expires_at: new Date(Date.now() + state.ttl * 1000).toISOString()});
  }
  if (endpoint === '/auth/start') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const message = {type: 'daily-notes-auth', status: state.login, ...(state.login === 'owner' ? {session: opaque} : {})};
    res.end(`<!doctype html><title>本地模拟登录 · 不连接 GitHub</title><p>这是自动化测试窗口，不是真实 GitHub 登录。</p>${state.login === 'hold' ? '' : `<script>setTimeout(()=>{window.opener.postMessage(${JSON.stringify(message)},${JSON.stringify(base)});},50)</script>`}`);
    return;
  }
  if (endpoint === '/notes' && req.method === 'POST') {
    let text = '';
    for await (const chunk of req) text += chunk;
    const input = JSON.parse(text);
    state.posts.push({input, origin: req.headers.origin, authorization: req.headers.authorization});
    if (req.headers.origin !== base || req.headers.authorization !== `Bearer ${opaque}`) return json(res, 403, {error: 'TEST permission denied'});
    const entry = {...input, created_at: '2026-11-07T14:00:00.000Z'};
    if (state.postMode === 'uncertain') { state.entries.unshift(entry); return json(res, 503, {error: 'TEST saved, response uncertain'}); }
    if (state.postMode === 'error') return json(res, 503, {error: 'TEST upstream failed'});
    if (state.postMode === 'conflict') return json(res, 409, {error: 'TEST SHA conflict'});
    if (state.postMode === 'unconfirmed') return json(res, 200, {entry, duplicate: false, commit_sha: null});
    const old = state.entries.find(item => item.id === input.id);
    if (old) return json(res, 200, {entry: old, duplicate: true, commit_sha: null});
    // Deliberately keep GET stale to check acknowledged local overlays.
    return json(res, 201, {entry, duplicate: false, commit_sha: 'a'.repeat(40)});
  }
  res.writeHead(404).end();
});
async function group(name, run) {
  reset();
  try { await run(); report.groups.push({name, passed: true}); console.log(`PASS ${name}`); }
  catch (error) { report.groups.push({name, passed: false, error: error.stack}); console.error(`FAIL ${name}: ${error.message}`); }
}
async function contextPage(width, run, {dark = false, js = true, storageFails = false} = {}) {
  const context = await browser.newContext({viewport: {width, height: width > 760 ? 1000 : 844}, reducedMotion: 'reduce', javaScriptEnabled: js});
  await context.route('**/*', route => [base, api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
  if (dark) await context.addInitScript(() => localStorage.setItem('lab-theme', 'dark'));
  if (storageFails) await context.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Test denied storage'); }; });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try { await run(page, context); assert.deepEqual(errors, [], 'No browser script errors'); }
  catch (error) { await page.screenshot({path: path.join(qa, `failure-${report.groups.length + 1}.png`), fullPage: true}).catch(() => {}); throw error; }
  finally { await context.close(); }
}
async function visit(page, route = '/daily/') {
  const response = await page.goto(base + route, {waitUntil: 'load'});
  assert.equal(response.status(), 200);
  await page.evaluate(() => document.fonts.ready);
  if (route === '/daily/' && apiOn) await page.locator('[data-notes][aria-busy="false"]').waitFor({state: 'attached'});
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({viewport: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
  assert.ok(size.doc <= size.viewport + 1 && size.body <= size.viewport + 1, `No horizontal overflow: ${JSON.stringify(size)}`);
}
async function shot(page, name) {
  // Capture the neutral top-of-page state. Otherwise Chromium paints sticky
  // navigation at the previous scroll offset inside a full-page screenshot.
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({top: 0, left: 0, behavior: 'instant'}); });
  await page.waitForFunction(() => scrollY === 0);
  await page.screenshot({path: path.join(qa, name + '.png'), fullPage: true});
}
async function signIn(page) {
  const popupPromise = page.waitForEvent('popup');
  await page.locator('[data-login]').click();
  const popup = await popupPromise;
  if (state.login !== 'hold') {
    if (state.login === 'owner' && !state.sessionError) await page.locator('[data-composer]').waitFor({state: 'visible'});
    else await page.waitForFunction(() => !document.querySelector('[data-login]').disabled);
  }
  return popup;
}
async function fill(page, value = '[本地测试示例] 网页草稿，不会真的发送。') { await page.locator('#daily-body').fill(value); }
await (async () => {
  fs.mkdirSync(qa, {recursive: true});
  assert.ok(fs.existsSync(path.join(root, 'daily/index.html')), 'Run npm run build first');
  await listen(staticServer); base = `http://localhost:${staticServer.address().port}`;
  await listen(apiServer); api = `http://localhost:${apiServer.address().port}`;
  try {
    browser = await chromium.launch({executablePath: process.env.CHROME_BIN || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
    await group('未配置/真实空数据/桌面与320、390手机/深色/导航与焦点', async () => {
      apiOn = false;
      for (const [width, dark] of [[1440, false], [1024, false], [800, false], [761, false], [760, false], [390, false], [320, false], [390, true], [1440, true]]) {
        await contextPage(width, async page => {
          await visit(page);
          assert.ok(await page.locator('[data-login]').isDisabled());
          assert.equal(await page.locator('[data-composer]').isVisible(), false);
          assert.equal(await page.locator('.daily-entry').count(), 0);
          assert.match(await page.locator('[data-read-status]').innerText(), /尚未启用/);
          assert.equal(await page.locator('header nav [aria-current="page"]').innerText(), '小记');
          await page.locator('[data-daily-filter="全部"]').focus();
          assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
          assert.equal(await page.locator('.daily-title-line h1 span').evaluate(node => getComputedStyle(node, '::before').animationName), 'none');
          await noOverflow(page);
          await shot(page, `daily-${width}-${dark ? 'dark' : 'light'}-unconfigured`);
          if (width === 320 || width === 390) {
            for (const route of ['/', '/projects/', '/archives/', '/about/']) { await visit(page, route); await noOverflow(page); }
          }
        }, {dark});
      }
      await contextPage(390, async page => { await visit(page); assert.equal(await page.locator('[data-composer]').isVisible(), false); assert.ok(await page.locator('[data-login]').isDisabled()); await noOverflow(page); }, {js: false});
    });
    await group('访客公开读取/时间线筛选/纯文本XSS与长正文', async () => {
      apiOn = true; state.entries = [...fixture, {id: randomUUID(), created_at: '2026-11-01T00:00:00.000Z', mood: '随手记', body: '<img src=x onerror="window.testXss=1"><script>window.testXss=1</script>\n' + 'A'.repeat(800)}];
      await contextPage(1440, async page => {
        await visit(page); assert.equal(await page.locator('.daily-entry').count(), 3);
        assert.equal(await page.locator('.daily-entry p img,.daily-entry p script').count(), 0);
        assert.equal(await page.evaluate(() => window.testXss), undefined);
        assert.match(await page.locator('.daily-entry time').first().getAttribute('aria-label'), /2026年11月07日 21:36/);
        assert.equal(await page.locator('[data-composer]').isVisible(), false);
        await noOverflow(page); await shot(page, 'daily-desktop-public-mock');
        await page.locator('[data-daily-filter="小确幸"]').click(); assert.equal(await page.locator('.daily-entry').count(), 1);
        assert.equal(await page.locator('[data-daily-filter="小确幸"]').getAttribute('aria-pressed'), 'true');
      });
      await contextPage(390, async page => { await visit(page); await noOverflow(page); await shot(page, 'daily-mobile-public-mock'); });
    });
    await group('读取503显式失败/重试恢复而非假空', async () => {
      apiOn = true; state.readError = true;
      await contextPage(390, async page => {
        await visit(page); assert.equal(await page.locator('[data-empty]').isVisible(), false);
        assert.match(await page.locator('[data-read-status]').innerText(), /无法确认/);
        assert.ok(await page.locator('[data-retry]').isVisible());
        state.readError = false; state.entries = fixture;
        await page.locator('[data-retry]').click(); await page.waitForFunction(() => document.querySelectorAll('.daily-entry').length === 2);
      });
    });
    await group('其他账号只读/伪造消息的来源与窗口拒绝', async () => {
      apiOn = true; state.login = 'readonly';
      await contextPage(390, async page => {
        await visit(page); await signIn(page);
        assert.match(await page.locator('[data-auth-status]').innerText(), /访客身份/);
        assert.equal(await page.locator('[data-composer]').isVisible(), false); assert.equal(state.sessions, 0);
        state.login = 'hold'; const popup = await signIn(page);
        await popup.waitForLoadState();
        for (const event of [{origin: api, source: null}, {origin: 'https://not-the-worker.example', source: 'popup'}]) {
          await page.evaluate(({origin, usePopup, api}) => {
            const other = window.open('', 'fieldnotes-daily-auth');
            window.dispatchEvent(new MessageEvent('message', {origin, source: usePopup ? other : window, data: {type: 'daily-notes-auth', status: 'owner', session: 'FORGED'}}));
          }, {origin: event.origin, usePopup: event.source === 'popup', api});
        }
        await page.waitForTimeout(100); assert.equal(state.sessions, 0); assert.equal(await page.locator('[data-composer]').isVisible(), false);
        await popup.close();
      });
    });
    await group('作者登录/Unicode计数/纯文本预览/确认提交后才清草稿', async () => {
      apiOn = true;
      await contextPage(390, async page => {
        await visit(page); await signIn(page);
        await fill(page, '🙂'.repeat(1001)); assert.equal(await page.locator('#daily-count').innerText(), '1001 / 1000'); assert.ok(await page.locator('[data-publish]').isDisabled());
        const text = '[本地测试示例] <img src=x onerror="window.testXss=1">\n🙂保留换行，不执行 HTML。';
        await fill(page, text); await page.locator('[data-preview-toggle]').click();
        assert.equal(await page.locator('[data-preview-body]').innerText(), text);
        assert.equal(await page.locator('[data-preview-body] img').count(), 0);
        const stored = await page.evaluate(key => JSON.stringify(localStorage.getItem(key)), draftKey);
        assert.ok(!stored.includes(opaque));
        await noOverflow(page); await shot(page, 'daily-mobile-owner-mock');
        await page.locator('[data-publish]').click();
        await page.waitForFunction(() => document.querySelector('[data-publish-status]').textContent.includes('发布成功'));
        assert.equal(state.posts.length, 1); assert.equal(state.posts[0].origin, base);
        assert.equal(await page.locator('#daily-body').inputValue(), '');
        assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null);
        assert.equal(await page.locator('.daily-entry p').innerText(), text);
        assert.ok(await page.locator('[data-publish-status] a').getAttribute('href').then(url => url.endsWith('a'.repeat(40))));
        assert.equal(await page.evaluate(() => window.testXss), undefined);
        await fill(page, '[本地测试示例] 再存一份草稿');
        await page.locator('[data-logout]').click(); assert.equal(await page.locator('#daily-body').inputValue(), '');
        assert.equal(await page.locator('[data-composer]').isVisible(), false);
        await signIn(page); assert.equal(await page.locator('#daily-body').inputValue(), '[本地测试示例] 再存一份草稿');
        await page.reload({waitUntil: 'load'}); assert.equal(await page.locator('[data-composer]').isVisible(), false); assert.equal(await page.locator('#daily-body').inputValue(), '');
      });
      await contextPage(1440, async page => { await visit(page); await signIn(page); await noOverflow(page); await shot(page, 'daily-desktop-owner-mock'); });
    });
    await group('网络保存不确定后同ID幂等重试/不制造提交链接', async () => {
      apiOn = true; state.postMode = 'uncertain';
      await contextPage(390, async page => {
        await visit(page); await signIn(page); await fill(page);
        await page.locator('[data-publish]').click();
        await page.waitForFunction(() => document.querySelector('[data-publish-status]').dataset.error === 'true');
        const saved = await page.locator('#daily-body').inputValue(); assert.ok(saved.length > 0);
        const firstId = state.posts[0].input.id; assert.ok(firstId);
        state.postMode = 'success'; await page.locator('[data-publish]').click();
        await page.waitForFunction(() => document.querySelector('[data-publish-status]').textContent.includes('未重复发布'));
        assert.equal(state.posts[1].input.id, firstId); assert.equal(await page.locator('.daily-entry').count(), 1);
        assert.equal(await page.locator('[data-publish-status] a').count(), 0); assert.equal(await page.locator('#daily-body').inputValue(), '');
      });
    });
    await group('SHA冲突先重读再同ID重试/新发布不被旧缓存覆盖', async () => {
      apiOn = true; state.postMode = 'conflict';
      await contextPage(390, async page => {
        await visit(page); await signIn(page); await fill(page); await page.locator('[data-publish]').click();
        await page.waitForFunction(() => document.querySelector('[data-publish-status]').textContent.includes('远端记录'));
        const id = state.posts[0].input.id;
        assert.ok(await page.locator('[data-publish]').isDisabled()); assert.ok(await page.locator('[data-retry]').isVisible());
        await page.locator('[data-retry]').click(); await page.waitForFunction(() => !document.querySelector('[data-publish]').disabled);
        state.postMode = 'success'; await page.locator('[data-publish]').click();
        await page.waitForFunction(() => document.querySelector('[data-publish-status]').textContent.includes('发布成功'));
        assert.equal(state.posts[1].input.id, id); assert.equal(await page.locator('.daily-entry').count(), 1);
        // Make another CAS conflict, exposing manual refresh while GET is stale.
        await fill(page, '[本地测试示例] 第二份草稿'); state.postMode = 'conflict';
        await page.locator('[data-publish]').click(); await page.waitForFunction(() => document.querySelector('[data-retry]').hidden === false);
        await page.locator('[data-retry]').click(); await page.waitForFunction(() => !document.querySelector('[data-publish]').disabled);
        assert.equal(await page.locator('.daily-entry').count(), 1, 'Acknowledged note survives stale GET');
      });
    });
    await group('未确认保存不得显示成功/本机存储失败仍可写/过期收起表单', async () => {
      apiOn = true; state.postMode = 'unconfirmed';
      await contextPage(320, async page => {
        await visit(page); await signIn(page); await fill(page); await noOverflow(page);
        await page.locator('[data-publish]').click(); await page.waitForFunction(() => document.querySelector('[data-publish-status]').dataset.error === 'true');
        assert.ok((await page.locator('#daily-body').inputValue()).length > 0); assert.equal(await page.locator('.daily-entry').count(), 0);
        assert.match(await page.locator('#daily-draft-state').innerText(), /不可用/);
      }, {storageFails: true});
      reset(); state.ttl = 2;
      await contextPage(390, async page => {
        await visit(page); await signIn(page); await fill(page);
        await page.locator('[data-composer]').waitFor({state: 'hidden', timeout: 8000});
        assert.match(await page.locator('[data-auth-status]').innerText(), /已过期/);
        assert.ok(await page.evaluate(key => Boolean(localStorage.getItem(key)), draftKey));
      });
    });
    await group('登录后端拒绝仍不可写/没有凭据持久化或URL泄漏', async () => {
      apiOn = true; state.sessionError = true;
      await contextPage(390, async page => {
        await visit(page); await signIn(page); assert.equal(await page.locator('[data-composer]').isVisible(), false);
        assert.equal(state.posts.length, 0);
        const persisted = await page.evaluate(() => JSON.stringify({local: {...localStorage}, session: {...sessionStorage}, url: location.href, html: document.documentElement.outerHTML}));
        assert.ok(!persisted.includes(opaque));
      });
    });
  } finally {
    if (browser) await browser.close();
    await Promise.all([new Promise(r => staticServer.close(r)), new Promise(r => apiServer.close(r))]);
    fs.writeFileSync(path.join(qa, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Evidence: ${qa}`);
  }
  if (report.groups.some(item => !item.passed)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; staticServer.close(); apiServer.close(); });
}
