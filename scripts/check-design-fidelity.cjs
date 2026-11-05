'use strict';

// Run AFTER the main implementation's build; never builds or edits the site.
// NODE_PATH=/home/jnq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/check-design-fidelity.cjs
// FIDELITY_QA_DIR (or Fidelity_QA_DIR) overrides the default /tmp screenshot folder.
// These are measurable browser regressions, NOT a pixel-perfect design verdict.
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

async function main() {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const http = require('node:http');
  const {createHash} = require('node:crypto');
  const {chromium} = require('playwright');
  const repo = path.resolve(__dirname, '..');
  const root = path.join(repo, 'public');
  const qa = process.env.FIDELITY_QA_DIR || process.env.Fidelity_QA_DIR || fs.mkdtempSync('/tmp/design-fidelity-');
  fs.mkdirSync(qa, {recursive: true});
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Build the site before running this checker.');
  const hero = '/img/fieldnotes/hero-testground-4bfaf6cf83.webp';
  const notebook = '/img/fieldnotes/about-notebook-ce22731fe9.webp';
  const film = '/media/tuning-workshop.mp4';
  const photo = '/img/covers/ruikang-national-first.jpg';
  const photoSha = 'ea4ddecc8155c479504be99edb254102094d69eadb4c8abd92fc7685e48c250f';
  const projectImages = {
    ruikang: '/img/workshop/ruikang-blueprint.webp',
    pharmacy: '/img/covers/notebook/20261105/pharmacy-dual-robots.webp',
    yolov5: '/img/covers/notebook/20261105/yolov5-pollination.webp',
    iscc: '/img/covers/notebook/20261105/iscc-secure-factory.webp'
  };
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const sourceBytes = url => fs.readFileSync(path.join(repo, 'source', decodeURIComponent(url)));
  const generatedBytes = url => fs.readFileSync(path.join(root, decodeURIComponent(url)));
  const report = {scope: 'Local generated-site regression, not pixel-perfect fidelity or production deployment verification', groups: [], screenshots: qa};
  const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.json': 'application/json'};
  // Serve the real public tree, with byte ranges for native Chrome media controls.
  const server = http.createServer((req, res) => {
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const size = fs.statSync(file).size;
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    let start = 0, end = size - 1;
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!range || (!range[1] && !range[2])) { res.writeHead(416).end(); return; }
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
      if (start > end || start >= size) { res.writeHead(416, {'Content-Range': `bytes */${size}`}).end(); return; }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(file, {start, end});
    res.on('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  async function group(name, run) {
    try { const evidence = await run(); report.groups.push({name, passed: true, evidence}); console.log(`PASS ${name}`); }
    catch (error) { report.groups.push({name, passed: false, error: error.stack}); console.error(`FAIL ${name}: ${error.message}`); }
  }
  async function withPage(viewport, js, run) {
    const context = await browser.newContext({viewport, javaScriptEnabled: js, reducedMotion: 'reduce', isMobile: viewport.width < 500, hasTouch: viewport.width < 500});
    // Tests are deliberately local. No comments, analytics or other external requests.
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    const badLocalResponses = [];
    page.on('response', response => { if (response.url().startsWith(base + '/') && response.status() >= 400) badLocalResponses.push(`${response.status()} ${response.url()}`); });
    try {
      const evidence = await run(page);
      assert.deepEqual(badLocalResponses, [], 'Observed missing/failed local page resources');
      return evidence;
    } catch (error) {
      await page.screenshot({path: path.join(qa, `failure-${report.groups.length + 1}.png`)}).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  async function visit(page, route) {
    const response = await page.goto(base + route, {waitUntil: 'load'});
    assert.equal(response.status(), 200, `${route}: actual route must return 200, no 404 fallback`);
    await page.evaluate(() => document.fonts.ready);
  }
  async function noOverflow(page, label) {
    const dimensions = await page.evaluate(() => ({width: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
    if (dimensions.html > dimensions.width + 1 || dimensions.body > dimensions.width + 1) {
      const offenders = await page.locator('body *').evaluateAll(elements => elements.filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).slice(0, 8).map(e => ({tag: e.tagName, class: e.className?.baseVal ?? e.className, right: e.getBoundingClientRect().right})));
      assert.fail(`${label}: horizontal overflow ${JSON.stringify({ ...dimensions, offenders })}`);
    }
  }
  async function stableDarkTheme(page) {
    await page.waitForFunction(() => {
      if (document.documentElement.dataset.theme !== 'dark') return false;
      const body = getComputedStyle(document.body);
      const color = token => {
        const sample = document.createElement('span');
        sample.style.color = `var(${token})`;
        document.body.append(sample);
        const value = getComputedStyle(sample).color;
        sample.remove();
        return value;
      };
      return body.backgroundColor === color('--lab-paper') && body.color === color('--lab-ink');
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return page.evaluate(() => ({background: getComputedStyle(document.body).backgroundColor, ink: getComputedStyle(document.body).color}));
  }
  async function image(page, selector, expected, transparent = false) {
    const img = page.locator(selector);
    assert.equal(await img.count(), 1, `${selector}: expected a unique real image`);
    assert.equal(await img.getAttribute('src'), expected, `${selector}: wrong production image`);
    await img.evaluate(async element => { element.loading = 'eager'; await element.decode(); });
    const info = await img.evaluate((element, alphaRequired) => {
      const result = {width: element.naturalWidth, height: element.naturalHeight, fit: getComputedStyle(element).objectFit};
      if (alphaRequired) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d'); ctx.drawImage(element, 0, 0, 128, 128);
        const pixels = ctx.getImageData(0, 0, 128, 128).data;
        let clear = 0, opaque = 0;
        for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] < 16) clear++; if (pixels[i] > 240) opaque++; }
        result.clearFraction = clear / (128 * 128); result.opaqueFraction = opaque / (128 * 128);
      }
      return result;
    }, transparent);
    assert.ok(info.width >= 200 && info.height >= 150, `${selector}: actual image did not decode at a usable size`);
    if (transparent) {
      assert.ok(info.clearFraction > .03 && info.opaqueFraction > .1, `${selector}: must be artwork with real transparent background, not an opaque full-page mockup: ${JSON.stringify(info)}`);
      assert.notEqual(info.fit, 'cover', `${selector}: must not crop the transparent production art`);
    }
    const response = await page.request.get(base + expected);
    assert.equal(response.status(), 200, `${expected}: asset HTTP status`);
    assert.equal(sha(await response.body()), sha(sourceBytes(expected)), `${expected}: served image differs from source`);
    assert.equal(sha(generatedBytes(expected)), sha(sourceBytes(expected)), `${expected}: stale generated image`);
    return info;
  }
  async function versionsAndFonts(page) {
    const urls = await page.locator('link[rel="stylesheet"], script[src]').evaluateAll(elements => elements.map(e => e.getAttribute('href') || e.getAttribute('src')));
    const assets = [];
    for (const asset of ['/css/notebook.css', '/js/notebook.js']) {
      const matches = urls.filter(value => new URL(value, base).pathname === asset);
      assert.equal(matches.length, 1, `${asset}: expected one shared layout asset`);
      const url = new URL(matches[0], base);
      const bytes = generatedBytes(asset);
      assert.equal(sha(bytes), sha(fs.readFileSync(path.join(repo, 'themes/notebook/source', asset))), `${asset}: build is stale relative to the current theme`);
      // Accept actual digest prefixes, independent of a particular hash algorithm.
      const tokens = [...url.searchParams.values(), ...(path.basename(url.pathname).match(/[a-f0-9]{8,128}/gi) || [])];
      const token = tokens.find(value => /^[a-f0-9]{8,128}$/i.test(value) && ['sha256', 'sha1', 'md5', 'sha384', 'sha512'].some(algorithm => createHash(algorithm).update(bytes).digest('hex').startsWith(value.toLowerCase())));
      assert.ok(token, `${asset}: URL must carry a real content digest, not a fixed cache constant (${matches[0]})`);
      const response = await page.request.get(url.href);
      assert.equal(response.status(), 200); assert.equal(sha(await response.body()), sha(bytes));
      assets.push({url: matches[0], digestPrefix: token});
    }
    assert.notEqual(assets[0].digestPrefix, assets[1].digestPrefix, 'CSS and JS must be individually versioned by their different contents');
    const fonts = await page.evaluate(() => {
      const family = getComputedStyle(document.querySelector('h1')).fontFamily;
      return {family, loaded: [...document.fonts].filter(f => f.status === 'loaded' && family.includes(f.family.replace(/["']/g, ''))).map(f => f.family), resources: performance.getEntriesByType('resource').filter(r => /\/fonts\/.*\.woff2?(?:\?|$)/.test(r.name)).map(r => r.name)};
    });
    assert.ok(fonts.loaded.length && fonts.resources.length, `A local display font must actually load and participate in h1 styling: ${JSON.stringify(fonts)}`);
    for (const url of fonts.resources) {
      const response = await page.request.get(url); assert.equal(response.status(), 200, `${url}: font status`);
      assert.equal(sha(await response.body()), sha(sourceBytes(new URL(url).pathname)), 'Served font differs from source');
    }
    return {assets, fonts};
  }
  async function nativePlayButton(page) {
    const video = page.locator('[data-tuning-player] video');
    await video.scrollIntoViewIfNeeded();
    const box = await video.boundingBox();
    assert.ok(box && box.width > 250 && box.height > 140, 'Native player must have a usable visible control area');
    await page.mouse.move(box.x + 24, box.y + box.height - 48);
    await page.mouse.click(box.x + 24, box.y + box.height - 48);
  }
  async function eventually(check, message, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await check()) return;
      // Node-side polling also works when application JavaScript is disabled.
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.fail(message);
  }
  async function playback(page, js) {
    await visit(page, '/');
    const details = page.locator('details[data-tuning-player]');
    const video = details.locator('video');
    assert.equal(await details.count(), 1);
    assert.equal(await details.getAttribute('open'), null, 'Static scene must be the default, not a video poster card');
    assert.equal(await page.locator('.testground-art').isVisible(), true);
    assert.equal(await video.isVisible(), false);
    assert.equal(await video.locator('source').getAttribute('src'), film);
    assert.equal(await video.locator('track[kind="captions"]').getAttribute('src'), '/media/tuning-workshop.zh-CN.vtt');
    assert.equal(await video.evaluate(v => v.controls && !v.autoplay), true, 'Keep native controls without autoplay');
    await details.locator('summary').click();
    await eventually(() => details.evaluate(el => el.open), 'Native details did not open');
    assert.equal(await video.isVisible(), true);
    await eventually(async () => !await page.locator('.testground-art').isVisible(), 'Film must hide the static scene');
    assert.equal(await video.evaluate(v => v.paused), true, 'Opening player must not autoplay');
    await nativePlayButton(page);
    await eventually(() => video.evaluate(v => !v.paused && v.currentTime > .2), 'Native play did not advance the actual video timeline', 15000);
    const duration = await video.evaluate(v => v.duration);
    assert.ok(duration >= 74 && duration <= 76, `Real decoded video must be ~75 seconds, got ${duration}`);
    await nativePlayButton(page);
    await eventually(() => video.evaluate(v => v.paused), 'Native pause/closing did not stop the video');
    const pausedAt = await video.evaluate(v => v.currentTime);
    await page.waitForTimeout(250);
    assert.ok(Math.abs(await video.evaluate(v => v.currentTime) - pausedAt) < .1, 'Pause must actually stop the timeline');
    // Also verify the script's close-while-playing pause contract.
    if (js) {
      await nativePlayButton(page);
      await eventually(() => video.evaluate(v => !v.paused), 'Native play did not resume the video');
    }
    await details.locator('summary').click();
    await eventually(() => details.evaluate(el => !el.open), 'Native details did not close');
    await eventually(() => video.evaluate(v => v.paused), 'Native pause/closing did not stop the video');
    await eventually(() => page.locator('.testground-art').isVisible(), 'Closing player must restore static scene');
    assert.equal(await video.isVisible(), false);
    return {javaScript: js, duration, controls: 'Clicked native Chromium play/pause; timeline advanced/stopped; returned to static scene'};
  }

  try {
    browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox']});
    for (const [label, viewport] of [['desktop', {width: 1440, height: 1000}], ['mobile', {width: 390, height: 844}]]) {
      await group(`${label}: home density / three-line heading / static transparent art / real fonts and cache versions`, () => withPage(viewport, true, async page => {
        await visit(page, '/');
        const assets = await versionsAndFonts(page);
        const art = await image(page, '.testground-art', hero, true);
        const heading = await page.locator('.hero-copy h1').evaluate(element => {
          const tops = [];
          const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          while (walk.nextNode()) {
            const node = walk.currentNode;
            for (let i = 0; i < node.length; i++) {
              if (!node.textContent[i].trim()) continue;
              const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
              const top = range.getBoundingClientRect().top;
              if (!tops.some(y => Math.abs(top - y) < 2)) tops.push(top);
            }
          }
          return {text: element.innerText.split('\n').map(line => line.trim()).filter(Boolean), lines: tops.length, size: parseFloat(getComputedStyle(element).fontSize)};
        });
        assert.deepEqual(heading.text, ['把机器人调通，', '也把过程', '写清楚。']);
        assert.equal(heading.lines, 3, `${label}: real glyph positions should form three lines, got ${JSON.stringify(heading)}`);
        assert.ok(heading.size >= (label === 'desktop' ? 60 : 36) && heading.size <= (label === 'desktop' ? 68 : 42), `${label}: title became too small or too large (${heading.size}px)`);
        assert.equal(await page.locator('[data-tuning-player] video').isVisible(), false);
        assert.equal(await page.locator('.testground-art').isVisible(), true);
        const strip = await page.locator('.result-strip').boundingBox();
        const selected = await page.locator('#selected-title').boundingBox();
        assert.ok(strip && selected, 'Result strip and representative project heading are required');
        if (label === 'desktop') {
          assert.ok(strip.y + strip.height <= 680, `Desktop result strip ends at ${strip.y + strip.height}px, should be within ~680px`);
          assert.ok(selected.y + selected.height <= 900, `Representative project heading must be visible within ~900px, got ${selected.y + selected.height}`);
          const lead = await page.locator('.selected-project-lead').boundingBox();
          assert.ok(lead.y < 900 && Math.min(lead.height, 1000 - lead.y) > 100, 'Actual representative project content, not only its section label, must enter the first viewport');
        }
        const links = await page.locator('.result-strip a').evaluateAll(elements => elements.map(e => e.getAttribute('href')));
        assert.equal(links.length, 4);
        for (const link of links) assert.equal((await page.request.get(base + link)).status(), 200, `Result strip link: ${link}`);
        await noOverflow(page, `${label} home`);
        await page.screenshot({path: path.join(qa, `${label}-home-light.png`)});
        await page.locator('[data-theme-toggle]').click();
        await stableDarkTheme(page);
        await noOverflow(page, `${label} dark home`);
        await page.screenshot({path: path.join(qa, `${label}-home-dark.png`)});
        return {heading, strip, selected, art, ...assets};
      }));
      await group(`${label}: about illustration + original avatar / public contact / actual section navigation`, () => withPage(viewport, true, async page => {
        await visit(page, '/about/');
        const art = await image(page, '.about-notebook', notebook, true);
        await image(page, '.about-avatar', '/img/avatar.jpg');
        const illustration = await page.locator('.about-notebook').boundingBox();
        const avatar = await page.locator('.about-avatar').boundingBox();
        assert.ok(illustration && avatar && illustration.width >= (label === 'desktop' ? 300 : 200) && illustration.height >= 160, 'About must retain a substantial real illustration, not only the avatar');
        assert.ok(illustration.width > avatar.width * 1.5, 'Illustration and portrait must remain separate, differently scaled images');
        const contacts = await page.locator('#main').evaluate(main => ({text: main.innerText, hrefs: [...main.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))}));
        const emails = [...new Set((contacts.text + '\n' + contacts.hrefs.join('\n')).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))];
        assert.deepEqual(emails, ['jiangnanqingwqw@163.com'], 'Only the approved public email may be shown');
        assert.ok(contacts.hrefs.includes('mailto:jiangnanqingwqw@163.com'));
        assert.ok(!contacts.hrefs.some(href => /^(tel:|weixin:)|wpa\.qq|qm\.qq/i.test(href)), 'Unexpected phone/WeChat/QQ contact link');
        assert.ok(!/(?:^|\D)1[3-9]\d{9}(?:\D|$)|(?:QQ|微信|wechat)\s*[:：号]?\s*[a-zA-Z0-9_-]{5,}/i.test(contacts.text), 'Unexpected extra contact identifier');
        await noOverflow(page, `${label} about`);
        await page.screenshot({path: path.join(qa, `${label}-about-light.png`)});
        const nav = page.locator('nav[aria-label="关于页导航"]');
        const anchors = await nav.locator('a').evaluateAll(elements => elements.map(a => a.getAttribute('href')));
        assert.deepEqual(anchors, ['#practice', '#skills', '#journey', '#results', '#contact']);
        for (const href of anchors) {
          const link = nav.locator(`a[href="${href}"]`);
          if (!await link.isVisible()) await page.locator('.about-index summary').click();
          await link.click();
          await page.waitForFunction(id => {
            const el = document.getElementById(id); if (!el) return false;
            const rect = el.getBoundingClientRect();
            return decodeURIComponent(location.hash) === '#' + id && rect.top < innerHeight && rect.bottom > 0;
          }, href.slice(1));
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator('[data-theme-toggle]').click();
        await stableDarkTheme(page);
        await noOverflow(page, `${label} dark about`);
        await page.screenshot({path: path.join(qa, `${label}-about-dark.png`)});
        return {art, illustration, avatar, emails, navigationTargets: anchors};
      }));
    }
    await group('Real 75-second native video: play / pause / close pauses audio / return to static scene', () => withPage({width: 1440, height: 1000}, true, page => playback(page, true)));
    await group('No application JavaScript: native details and real video play / pause / static return remain usable', () => withPage({width: 1440, height: 1000}, false, page => playback(page, false)));
    await group('Four project covers decode; three renewed images match detail Open Graph images', () => withPage({width: 1440, height: 1000}, true, async page => {
      await visit(page, '/projects/');
      assert.equal(await page.locator('.project-list-item').count(), 4);
      for (const [id, src] of Object.entries(projectImages)) await image(page, `#project-${id} .project-cover img`, src);
      await noOverflow(page, 'Project index');
      for (const [id, src] of Object.entries(projectImages)) {
        await visit(page, `/projects/${id}/`);
        await image(page, '.project-detail-cover img', src);
        if (id !== 'ruikang') {
          for (const selector of ['meta[property="og:image"]']) {
            const url = await page.locator(selector).getAttribute('content');
            assert.equal(new URL(url).pathname, src, `${id}: detail image and share image must use the same renewed artwork`);
            assert.equal((await page.request.get(base + new URL(url).pathname)).status(), 200);
          }
        }
        await noOverflow(page, `Project ${id}`);
      }
      return projectImages;
    }));
    await group('Nine original article routes and real covers still load; protected group-photo SHA unchanged', () => withPage({width: 1440, height: 1000}, true, async page => {
      const articles = fs.readdirSync(path.join(repo, 'source/_posts')).filter(name => name.endsWith('.md')).map(filename => {
        const text = fs.readFileSync(path.join(repo, 'source/_posts', filename), 'utf8');
        const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
        assert.ok(front, `${filename}: missing front matter`);
        const date = /^date:\s*(\d{4})-(\d{2})-(\d{2})/m.exec(front);
        const cover = /^cover:\s*(\S+)/m.exec(front)?.[1];
        assert.ok(date && cover, `${filename}: expected current permalink date and cover`);
        return {route: '/' + date.slice(1).join('/') + '/' + path.basename(filename, '.md') + '/', cover};
      });
      assert.equal(articles.length, 9, 'Do not lose or fabricate articles');
      for (const article of articles) {
        await visit(page, article.route);
        assert.equal(await page.locator('.article-heading h1').count(), 1);
        await image(page, '.article-cover', article.cover);
        assert.equal(new URL(await page.locator('meta[property="og:image"]').getAttribute('content')).pathname, article.cover);
        await noOverflow(page, article.route);
      }
      assert.equal(sha(sourceBytes(photo)), photoSha, 'Protected original group photo changed');
      assert.equal(sha(generatedBytes(photo)), photoSha, 'Protected generated group photo changed');
      const response = await page.request.get(base + photo); assert.equal(response.status(), 200);
      assert.equal(sha(await response.body()), photoSha, 'Protected served group photo changed');
      return {routes: articles.map(a => a.route), protectedPhotoSha256: photoSha};
    }));
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.writeFileSync(path.join(qa, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  }
  const failed = report.groups.filter(group => !group.passed);
  console.log(`Design fidelity regression: ${report.groups.length - failed.length}/${report.groups.length} groups passed. Evidence: ${qa}`);
  console.log('This checks real layout, assets, fonts, cache digests, video interaction, navigation and preservation; manual reference-image review is still required.');
  if (failed.length) process.exitCode = 1;
}
