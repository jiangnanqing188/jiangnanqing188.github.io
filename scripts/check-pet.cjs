'use strict';

// Real Chromium regression, using a small fixture made from the GENERATED pet
// markup, plus full-page desktop/mobile screenshots. No test hooks in pet.js.
// Run after npm run build. Requires Playwright and a locally installed Chrome;
// CHROME_PATH and PET_QA_DIR can override the executable and screenshot folder.
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
async function main() {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const http = require('node:http');
  const os = require('node:os');
  const {chromium} = require('playwright');
  const root = path.resolve(__dirname, '../public');
  const qa = process.env.PET_QA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'xiaojiang-qa-'));
  fs.mkdirSync(qa, {recursive: true});
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const articleFile = fs.readdirSync(path.join(root, '2026'), {recursive: true})
    .find(file => file.endsWith('/睿抗赛94分复盘/index.html'));
  assert.ok(articleFile, 'Expected the generated representative article.');
  const articleRoute = '/2026/' + articleFile.replace(/index\.html$/, '');
  const markup = home.match(/<aside\b[^>]*id="blog-pet"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(markup, 'Build the site before running pet regression.');
  assert.ok(!markup.includes('/img/pet/catgirl'), 'All active poses must use the new style.');
  const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/pet.css"><style>
    :root{--lab-blue:#183f35;--lab-muted:#59675e;--lab-ink:#26372e;--lab-panel:#f5f3eb;--lab-rule:#c5c9b9;--r-card:8px;--r-control:6px;--r-chip:4px;--lab-scrim:20 30 20}
    body{margin:0;background:#f5f3eb}.site-header{height:64px}main{max-width:800px;margin:auto;min-height:6000px}p{line-height:2}
    </style></head><body><header class="site-header"></header><main data-page="首页"><h1>小江动作验证</h1>${'<p>工程手记，慢慢读。</p>'.repeat(100)}</main>${markup}<script src="/js/pet.js"></script></body></html>`;
  const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8'};
  const server = http.createServer((req, res) => {
    if (req.url === '/__pet_fixture__/') { res.setHeader('Content-Type', types['.html']); res.end(fixture); return; }
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); } catch { res.writeHead(400).end(); return; }
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser, passed = 0;
  const state = page => page.locator('#blog-pet').evaluate(pet => ({motion: pet.dataset.motion, pose: Number(pet.dataset.pose), phase: pet.dataset.phase, x: pet.offsetLeft, y: pet.offsetTop}));
  const action = (page, name) => page.locator(`[data-pet-action="${name}"]`).dispatchEvent('click');
  const point = async page => {
    const box = await page.locator('.pet-avatar').boundingBox();
    return {x: box.x + box.width * .48, y: box.y + box.width * .5};
  };
  const trace = async (page, start, duration) => {
    await page.evaluate(() => {
      const pet = document.querySelector('#blog-pet');
      window.poseTrace = [Number(pet.dataset.pose)];
      window.poseObserver = new MutationObserver(() => window.poseTrace.push(Number(pet.dataset.pose)));
      window.poseObserver.observe(pet, {attributes: true, attributeFilter: ['data-pose']});
    });
    await start();
    await page.clock.runFor(duration);
    return page.evaluate(() => { window.poseObserver.disconnect(); return window.poseTrace; });
  };
  const key = 'jiangnan-blog-pet-v1';
  async function open({width = 1440, height = 1000, reducedMotion = 'no-preference', phone = false, url = '/__pet_fixture__/', saved, noAtlas = false, js = true, clock = true, random} = {}) {
    const context = await browser.newContext({viewport: {width, height}, reducedMotion, isMobile: phone, hasTouch: phone, javaScriptEnabled: js});
    if (saved) await context.addInitScript(({key, saved}) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(saved)); }, {key, saved});
    if (random !== undefined) await context.addInitScript(value => { Math.random = () => value; }, random);
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = route.request().url();
      if (!url.startsWith(base) || noAtlas && url.endsWith(`/${noAtlas === true ? 'actions' : noAtlas}.webp`)) return route.abort();
      return route.continue();
    });
    if (js && clock) await page.clock.install({time: new Date('2026-11-04T12:00:00Z')});
    await page.goto(base + url, {waitUntil: 'load'});
    if (js && !noAtlas) await page.waitForSelector('#blog-pet.has-motions');
    if (js && clock) await page.clock.pauseAt(new Date('2026-11-04T12:00:01Z'));
    return {page, context, errors};
  }
  const placed = {v: 2, auto: false, x: 100, y: 500, w: 150, hidden: false, quiet: false};
  async function test(name, options, callback) {
    const {page, context, errors} = await open(options);
    try { await callback(page); assert.deepEqual(errors, [], 'No browser runtime errors'); ++passed; console.log(`PASS ${name}`); }
    finally { await context.close(); }
  }
  try {
    browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--no-sandbox']});
    await test('atlas / alpha / payload', {}, async page => {
      for (const [name, height, limit] of [['actions', 1600, 650000], ['transitions', 1280, 500000]]) {
        assert.ok(fs.statSync(path.join(root, `img/pet/field-notes/${name}.webp`)).size < limit);
        assert.deepEqual(await page.evaluate(async name => {
          const img = new Image(); img.src = `/img/pet/field-notes/${name}.webp`; await img.decode();
          const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          return [img.width, img.height, ctx.getImageData(0, 0, 1, 1).data[3]];
        }, name), [1280, height, 0]);
      }
    });
    await test('greeting raises and lowers the hand to a true neutral', {saved: placed}, async page => {
      const poses = await trace(page, async () => { await page.locator('.pet-avatar').focus(); await page.keyboard.press('Enter'); }, 3100);
      assert.deepEqual(poses, [20,21,22,0,1,2,1,3,1,0,22,21,20]);
      assert.equal((await state(page)).motion, 'idle');
      await page.locator('.pet-menu-toggle').click(); await page.locator('[data-pet-action="read"]').click();
      await page.clock.runFor(850); assert.equal((await state(page)).pose, 5);
    });
    await test('reading has opening and closing inbetweens', {}, async page => {
      const poses = await trace(page, () => action(page, 'read'), 4600);
      assert.deepEqual(poses, [20,23,4,24,5,6,5,7,5,24,4,23,20]);
      assert.equal((await state(page)).motion, 'idle');
    });
    await test('stretch + interrupted gesture has no stale timer', {}, async page => {
      await action(page, 'stretch'); await page.clock.runFor(1600); assert.equal((await state(page)).pose, 10);
      await action(page, 'jump'); await page.clock.runFor(180); assert.equal((await state(page)).motion, 'jump');
      await action(page, 'read'); await page.clock.runFor(1500); assert.equal((await state(page)).motion, 'read');
      await page.clock.runFor(3300); assert.equal((await state(page)).motion, 'idle');
      assert.equal(await page.locator('.pet-previous').count(), 0);
    });
    await test('jump preparation / airborne / landing / recovery', {}, async page => {
      await action(page, 'jump'); assert.equal((await state(page)).phase, 'prepare');
      await page.clock.runFor(170); assert.equal((await state(page)).phase, 'airborne');
      await page.clock.runFor(360); assert.equal((await state(page)).phase, 'land');
      await page.clock.runFor(180); assert.equal((await state(page)).phase, 'recover');
      await page.clock.runFor(300); assert.equal((await state(page)).motion, 'idle');
    });
    await test('sleep sequence / no automatic walking while asleep', {}, async page => {
      await action(page, 'nap'); assert.equal((await state(page)).pose, 25);
      await page.clock.runFor(600); assert.equal((await state(page)).pose, 16);
      await page.clock.runFor(1050); assert.equal((await state(page)).pose, 30);
      await page.clock.runFor(1200); assert.equal((await state(page)).motion, 'sleeping');
      await page.clock.runFor(30000); assert.equal((await state(page)).pose, 18);
    });
    await test('wake before replying / latest intent wins', {}, async page => {
      await action(page, 'nap'); await page.clock.runFor(3000);
      await action(page, 'read'); await page.clock.runFor(150); assert.equal((await state(page)).motion, 'waking');
      await action(page, 'stretch'); await page.clock.runFor(1300); assert.equal((await state(page)).motion, 'stretch');
      await page.clock.runFor(3300); assert.equal((await state(page)).motion, 'idle');
    });
    await test('interrupt falling asleep / no old sleep callback', {}, async page => {
      await action(page, 'nap'); await page.clock.runFor(500);
      await page.locator('.pet-avatar').dispatchEvent('click', {detail: 0});
      assert.equal((await state(page)).motion, 'waking');
      await page.clock.runFor(700); assert.equal((await state(page)).motion, 'wave');
      await page.clock.runFor(3000); assert.equal((await state(page)).motion, 'idle');
    });
    await test('8-phase distance-synchronised gait and planted stop', {saved: placed, random: .4}, async page => {
      const before = await state(page);
      const poses = await trace(page, () => action(page, 'stroll'), 6000);
      for (const frame of [12,32,13,33,14,34,15,35]) assert.ok(poses.includes(frame), `Missing gait phase ${frame}`);
      assert.deepEqual(poses.slice(-3), [14,23,20]);
      const after = await state(page);
      assert.equal(after.motion, 'idle'); assert.ok(Math.abs(after.x - before.x) >= 12);
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
      assert.equal(saved.auto, false); assert.equal(saved.x, after.x);
    });
    await test('small mobile pet keeps the same unhurried footfall cadence', {width: 390, height: 844, phone: true, saved: {...placed, x: 150, w: 106}, random: .4}, async page => {
      await page.evaluate(() => {
        window.gaitTimes = [];
        new MutationObserver(() => {
          const pet = document.querySelector('#blog-pet');
          if (pet.dataset.motion === 'walking') window.gaitTimes.push(performance.now());
        }).observe(document.querySelector('#blog-pet'), {attributes: true, attributeFilter: ['data-pose']});
      });
      await action(page, 'stroll'); await page.clock.runFor(7000);
      const times = await page.evaluate(() => window.gaitTimes);
      assert.ok(times.length >= 8, 'Actually exercise a complete small-screen gait');
      for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 144, 'Small-screen feet must not rush through frames');
      assert.equal((await state(page)).motion, 'idle');
    });
    await test('greeting stops walking, with no surviving movement frame', {saved: placed}, async page => {
      await action(page, 'stroll'); await page.clock.runFor(500);
      await page.locator('.pet-avatar').dispatchEvent('click', {detail: 0});
      const x = (await state(page)).x; assert.equal((await state(page)).motion, 'recovering');
      await page.clock.runFor(520); assert.equal((await state(page)).motion, 'wave');
      await page.clock.runFor(5500); assert.equal((await state(page)).x, x); assert.equal((await state(page)).motion, 'idle');
    });
    await test('interrupted walking plants a foot without flashing neutral first', {saved: placed, random: .4}, async page => {
      await action(page, 'stroll'); await page.clock.runFor(500);
      const before = (await state(page)).pose;
      const plant = [12,32,13,33].includes(before) ? 12 : 14;
      const poses = await trace(page, () => page.locator('.pet-avatar').dispatchEvent('click', {detail: 0}), 350);
      assert.deepEqual(poses, before === plant ? [before,23,20] : [before,plant,23,20]);
    });
    await test('interrupted walk preparation keeps both feet down', {saved: placed, random: .4}, async page => {
      await action(page, 'stroll'); await page.clock.runFor(280);
      const poses = await trace(page, () => action(page, 'read'), 200);
      assert.deepEqual(poses, [23,20]);
      await page.clock.runFor(200); assert.equal((await state(page)).motion, 'read');
    });
    await test('idle does not repeat the last gesture / automatic nap', {random: .4}, async page => {
      const observed = await page.evaluate(() => {
        window.idleHistory = [];
        new MutationObserver(() => { const name = document.querySelector('#blog-pet').dataset.motion; if (['read', 'stretch', 'yawn', 'look-around'].includes(name)) window.idleHistory.push(name); })
          .observe(document.querySelector('#blog-pet'), {attributes: true, attributeFilter: ['data-motion']});
        return true;
      });
      assert.ok(observed); await page.clock.runFor(49000); assert.equal((await state(page)).motion, 'sleeping');
      const history = await page.evaluate(() => window.idleHistory);
      assert.ok(history.length >= 2); assert.ok(history.every((name, i) => i === 0 || name !== history[i - 1]));
    });
    await test('wake before walking, not an instantaneous standing swap', {saved: placed}, async page => {
      await action(page, 'nap'); await page.clock.runFor(3000); await action(page, 'stroll');
      assert.equal((await state(page)).motion, 'waking'); await page.clock.runFor(1450);
      assert.equal((await state(page)).motion, 'walk-start');
    });
    await test('quiet mode cancels motion / static sleeping and waking', {}, async page => {
      await action(page, 'jump'); await page.clock.runFor(300); await action(page, 'quiet');
      assert.equal((await state(page)).motion, 'idle');
      await action(page, 'nap'); assert.equal((await state(page)).pose, 18);
      await page.locator('.pet-avatar').dispatchEvent('click', {detail: 0}); assert.equal((await state(page)).pose, 20);
      await page.clock.runFor(30000); assert.equal((await state(page)).motion, 'idle');
    });
    await test('reduced motion / live preference change', {reducedMotion: 'reduce'}, async page => {
      await action(page, 'stretch'); assert.equal((await state(page)).motion, 'idle');
      await action(page, 'nap'); assert.equal((await state(page)).pose, 18);
      await action(page, 'read'); assert.equal((await state(page)).pose, 20);
      await page.emulateMedia({reducedMotion: 'no-preference'}); await action(page, 'jump'); await page.clock.runFor(200);
      await page.emulateMedia({reducedMotion: 'reduce'}); await page.waitForTimeout(80);
      assert.equal((await state(page)).motion, 'idle');
      assert.equal(await page.locator('.pet-visual').evaluate(el => el.getAnimations().length), 0);
    });
    await test('lift / paused release / cancel / placement persistence', {saved: placed}, async page => {
      await action(page, 'nap'); await page.clock.runFor(3000); const p = await point(page);
      await page.mouse.move(p.x, p.y + 25); await page.mouse.down(); await page.mouse.move(p.x + 90, p.y - 120, {steps: 4});
      assert.equal((await state(page)).motion, 'dragging'); assert.equal((await state(page)).pose, 19);
      await page.clock.runFor(150); await page.mouse.up(); assert.equal((await state(page)).motion, 'settle');
      await page.clock.runFor(600); assert.equal((await state(page)).motion, 'idle');
      const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); assert.equal(saved.auto, false);
      const q = await point(page); await page.mouse.move(q.x, q.y); await page.mouse.down(); await page.mouse.move(q.x + 50, q.y - 40);
      await page.locator('.pet-avatar').dispatchEvent('pointercancel', {pointerId: 1}); await page.mouse.up();
      assert.equal((await state(page)).motion, 'idle');
    });
    await test('throw bounces / lands at viewport floor / settles', {saved: placed}, async page => {
      const p = await point(page); await page.mouse.move(p.x, p.y); await page.mouse.down();
      await page.clock.runFor(16); await page.mouse.move(p.x + 70, p.y - 100);
      await page.clock.runFor(16); await page.mouse.move(p.x + 110, p.y - 140); await page.mouse.up();
      assert.equal((await state(page)).motion, 'flying'); await page.clock.runFor(6500);
      assert.equal((await state(page)).motion, 'idle');
      const box = await page.locator('#blog-pet').boundingBox(); assert.ok(Math.abs(box.y + box.height - 990) < 2);
    });
    await test('collapse / restore / keyboard movement / click-through', {saved: placed}, async page => {
      await action(page, 'read'); await page.locator('.pet-hide').click();
      assert.equal(await page.locator('.pet-stage').evaluate(el => el.hidden), true);
      await page.clock.runFor(4000); await page.locator('.pet-restore').click(); assert.equal((await state(page)).motion, 'idle');
      const before = await state(page); await page.locator('.pet-avatar').press('ArrowRight'); assert.equal((await state(page)).x, before.x + 10);
      const p = await point(page);
      await page.evaluate(({x, y}) => {
        const link = document.createElement('button'); link.textContent = 'underlying control';
        Object.assign(link.style, {position: 'fixed', left: `${x - 15}px`, top: `${y - 15}px`, width: '30px', height: '30px'});
        link.onclick = () => { window.underlyingClicks = (window.underlyingClicks || 0) + 1; }; document.body.prepend(link);
      }, p);
      await page.mouse.click(p.x, p.y); assert.equal(await page.evaluate(() => window.underlyingClicks), 1);
      assert.equal((await state(page)).motion, 'idle');
    });
    await test('background lifecycle cancels pending gestures and drag capture', {saved: placed}, async page => {
      const p = await point(page); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 60, p.y - 50);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable: true, value: true}); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal((await state(page)).motion, 'idle'); await page.mouse.up(); await page.clock.runFor(4000);
      assert.equal((await state(page)).motion, 'idle');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable: true, value: false}); document.dispatchEvent(new Event('visibilitychange')); });
      await action(page, 'read'); assert.equal((await state(page)).motion, 'read');
    });
    await test('sleep and wake both traverse the crouch frames', {}, async page => {
      const asleep = await trace(page, () => action(page, 'nap'), 3000);
      assert.deepEqual(asleep, [20,25,8,16,23,28,29,30,17,18]);
      const awake = await trace(page, () => action(page, 'read'), 1550);
      assert.deepEqual(awake.slice(0, 7), [18,17,30,29,28,23,20]);
      assert.equal((await state(page)).motion, 'read');
    });
    await test('new requests wait for the current hand/book to recover', {}, async page => {
      await action(page, 'read'); await page.clock.runFor(600);
      await action(page, 'stretch'); assert.equal((await state(page)).motion, 'recovering');
      await page.clock.runFor(100); await action(page, 'cheer');
      await page.clock.runFor(350); assert.equal((await state(page)).motion, 'cheer');
      await page.clock.runFor(2100); assert.equal((await state(page)).pose, 20);
      assert.equal((await state(page)).motion, 'idle');
    });
    await test('all gestures render a single opaque pose, with no afterimage layer', {}, async page => {
      assert.equal(await page.locator('.pet-sprite').count(), 1);
      assert.equal(await page.locator('.pet-previous').count(), 0);
      for (const name of ['read', 'stretch', 'nap', 'cheer']) {
        await action(page, name);
        for (let i = 0; i < 300; i++) {
          await page.clock.runFor(16);
          assert.deepEqual(await page.locator('.pet-visual').evaluate(el => ({
            layers: [...el.querySelectorAll('.pet-sprite')].filter(e => !e.hidden && getComputedStyle(e).display !== 'none').length,
            opacity: getComputedStyle(el.querySelector('.pet-sprite')).opacity,
            fallback: getComputedStyle(el.querySelector('.pet-art')).opacity,
            fades: el.querySelector('.pet-sprite').getAnimations().length
          })), {layers: 1, opacity: '1', fallback: '0', fades: 0});
          if (['idle', 'sleeping'].includes((await state(page)).motion)) break;
        }
      }
    });
    await test('slower gesture timing holds inbetweens and keeps a readable rest', {}, async page => {
      const durations = [];
      for (const name of ['read', 'stretch']) {
        await page.evaluate(() => {
          window.poseTimes = [];
          window.timingObserver = new MutationObserver(() => window.poseTimes.push(performance.now()));
          window.timingObserver.observe(document.querySelector('#blog-pet'), {attributes: true, attributeFilter: ['data-pose']});
        });
        const began = await page.evaluate(() => performance.now());
        await action(page, name);
        await page.clock.runFor(2000); assert.equal((await state(page)).motion, name, 'Do not rush through the gesture');
        await page.clock.runFor(2800); assert.equal((await state(page)).motion, 'idle');
        const times = await page.evaluate(() => { window.timingObserver.disconnect(); return window.poseTimes; });
        for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 160, `Too-short pose hold in ${name}`);
        durations.push(times.at(-1) - began);
      }
      assert.ok(durations[0] >= 3900 && durations[1] >= 2800, 'Reading and stretching keep deliberate recovery time');
    });
    await test('late callbacks do not compress the remaining poses into a catch-up burst', {}, async page => {
      await page.evaluate(() => {
        const original = window.setTimeout;
        let delayed = false;
        window.setTimeout = (callback, ms, ...args) => {
          if (!delayed && ms === 160) { delayed = true; ms += 500; }
          return original(callback, ms, ...args);
        };
        window.lateTimes = [];
        new MutationObserver(() => window.lateTimes.push(performance.now()))
          .observe(document.querySelector('#blog-pet'), {attributes: true, attributeFilter: ['data-pose']});
      });
      await action(page, 'read'); await page.clock.runFor(5000);
      const times = await page.evaluate(() => window.lateTimes);
      assert.equal(times.length, 12);
      for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 180, 'A delayed pose must not shorten the next hold');
      assert.equal((await state(page)).motion, 'idle');
    });
    await test('missing transition atlas retains the same-style static fallback', {noAtlas: 'transitions'}, async page => {
      assert.equal(await page.locator('#blog-pet').evaluate(el => el.classList.contains('has-motions')), false);
      assert.equal(await page.locator('.pet-art').evaluate(el => el.complete && el.naturalWidth > 0 && getComputedStyle(el).opacity === '1'), true);
    });
    await test('atlas failure leaves a usable same-style static pet', {noAtlas: true}, async page => {
      assert.equal(await page.locator('.pet-art').evaluate(img => img.complete && img.naturalWidth > 0), true);
      await action(page, 'read'); await page.clock.runFor(4600); assert.equal((await state(page)).motion, 'idle');
      assert.equal(await page.locator('.pet-art').evaluate(img => getComputedStyle(img).opacity), '1');
    });
    for (const [label, width, height, phone] of [['desktop', 1440, 1000, false], ['mobile', 390, 844, true]]) {
      await test(`${label} homepage / projects / article screenshots and viewport`, {width, height, phone, url: '/', clock: false}, async page => {
        for (const route of ['/', '/projects/', articleRoute]) {
          const response = await page.goto(base + route, {waitUntil: 'load'});
          assert.equal(response.status(), 200, 'Screenshot route must exist, not fall back to 404.');
          await page.waitForSelector('#blog-pet.has-motions');
          const box = await page.locator('#blog-pet').boundingBox();
          const flowing = await page.locator('#blog-pet').evaluate(el => getComputedStyle(el).position !== 'fixed');
          if (flowing) {
            const slot = await page.locator('.pet-workstation').boundingBox();
            const geometry = await page.evaluate(() => ({height: document.documentElement.scrollHeight, y: scrollY}));
            assert.ok(slot && slot.height >= box.height, 'Flow slot must reserve the companion’s real height');
            assert.ok(box.x >= slot.x && box.x + box.width <= slot.x + slot.width + 1, 'Flow pet stays in its owned paper edge');
            assert.ok(box.y + geometry.y >= 0 && box.y + geometry.y + box.height <= geometry.height + 1, 'Flow companion remains in the document, not hidden');
            await page.locator('.pet-art').evaluate(img => img.decode());
          } else assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          await page.screenshot({path: path.join(qa, `${label}-${route === '/' ? 'home' : route.includes('projects') ? 'projects' : 'article'}.png`)});
          if (flowing) {
            await page.locator('#blog-pet').scrollIntoViewIfNeeded();
            await page.screenshot({path: path.join(qa, `${label}-${route === '/' ? 'home' : route.includes('projects') ? 'projects' : 'article'}-companion.png`)});
          }
        }
      });
    }
    await test('real mobile default flow owns space / no text overlap / menu and drag / reset', {width: 390, height: 844, phone: true, url: articleRoute, clock: false}, async page => {
      const pet = page.locator('#blog-pet');
      assert.ok(await pet.evaluate(el => el.classList.contains('is-flow') && getComputedStyle(el).position === 'relative'));
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null, 'Automatic defaults must not manufacture saved positions');
      const overlap = async () => pet.evaluate(el => {
        const b = el.getBoundingClientRect();
        const hits = [];
        for (const node of document.querySelectorAll('main p,main h1,main h2,main li,main small,main strong')) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const range = document.createRange(); range.selectNodeContents(walker.currentNode);
            for (const r of range.getClientRects()) if (r.width && r.bottom > 0 && r.top < innerHeight && r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom) hits.push(node.textContent.slice(0, 60));
          }
        }
        return hits;
      });
      assert.deepEqual(await overlap(), [], 'Default mobile companion does not intersect visible prose');
      await pet.scrollIntoViewIfNeeded();
      await page.locator('.pet-art').evaluate(img => img.decode());
      assert.deepEqual(await overlap(), [], 'Paper edge is not laid over the final paragraph');
      const before = await page.evaluate(() => scrollY);
      await page.locator('.pet-menu-toggle').click();
      assert.ok(await page.locator('#pet-menu').isVisible());
      await page.locator('[data-pet-action="read"]').click();
      assert.ok(await pet.evaluate(el => el.classList.contains('is-flow')), 'Static gestures stay at the paper edge');
      await pet.scrollIntoViewIfNeeded();
      const p = await point(page); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x - 55, p.y - 35, {steps: 8}); await page.waitForTimeout(160); await page.mouse.up();
      assert.equal(await pet.evaluate(el => getComputedStyle(el).position), 'fixed', 'Explicit drag leaves the flow slot');
      assert.equal((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).auto, false);
      await action(page, 'reset');
      assert.ok(await pet.evaluate(el => el.classList.contains('is-flow')), 'Reset uses default safe docking again');
      const resetY = await page.evaluate(() => scrollY);
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => scrollY), resetY, 'Returning to flow does not initiate page scrolling');
      assert.ok(before >= 0);
      await action(page, 'stroll');
      assert.equal(await pet.evaluate(el => getComputedStyle(el).position), 'fixed', 'An explicit stroll may leave the paper edge');
      await action(page, 'reset');
      await pet.scrollIntoViewIfNeeded();
      await page.locator('.pet-avatar').press('ArrowLeft');
      assert.equal(await pet.evaluate(el => getComputedStyle(el).position), 'fixed', 'Keyboard placement remains a deliberate fixed position');
    });
    await test('real mobile v2 manual position / quiet / hidden are respected', {width: 390, height: 844, phone: true, url: articleRoute, saved: {...placed, x: 10, y: 480, w: 106, quiet: true}, clock: false}, async page => {
      const pet = page.locator('#blog-pet');
      assert.equal(await pet.evaluate(el => getComputedStyle(el).position), 'fixed');
      assert.equal((await state(page)).x, 10); assert.equal((await state(page)).y, 480);
      assert.equal(await page.locator('[data-pet-action="quiet"]').getAttribute('aria-pressed'), 'true');
      await page.reload({waitUntil: 'load'}); await page.waitForSelector('#blog-pet.has-motions');
      assert.equal(await pet.evaluate(el => getComputedStyle(el).position), 'fixed');
      assert.equal((await state(page)).y, 480);
      await page.locator('.pet-hide').click();
      assert.equal((await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)).hidden, true);
      await page.reload({waitUntil: 'load'});
      assert.equal(await page.locator('.pet-stage').evaluate(el => el.hidden), true, 'Stored hidden preference survives flow-aware startup');
      assert.ok(await page.locator('.pet-restore').isVisible());
    });
    await test('real mobile no-JS uses the visible owned flow slot', {width: 390, height: 844, phone: true, url: articleRoute, js: false, clock: false}, async page => {
      const pet = page.locator('#blog-pet');
      assert.equal(await pet.evaluate(el => getComputedStyle(el).position), 'relative');
      await pet.scrollIntoViewIfNeeded(); await page.locator('.pet-art').evaluate(img => img.decode());
      const b = await pet.boundingBox(), slot = await page.locator('.pet-workstation').boundingBox();
      assert.ok(slot.height >= b.height && b.y >= slot.y && b.y + b.height <= slot.y + slot.height + 1);
      assert.ok(await page.locator('.pet-menu-toggle').isVisible());
    });
    await test('mobile native vertical touch scroll does not drag the pet', {width: 390, height: 844, phone: true, saved: {...placed, x: 10, y: 480, w: 106}, clock: false}, async page => {
      const p = await point(page), before = await state(page); const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: p.x, y: p.y}]});
      for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: p.x, y: p.y - i * 25}]}); await page.waitForTimeout(30); }
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await page.waitForTimeout(100);
      assert.ok(await page.evaluate(() => scrollY) > 0); const after = await state(page);
      assert.equal(after.x, before.x); assert.equal(after.y, before.y); assert.notEqual(after.motion, 'dragging');
    });
    await test('mobile native sideways touch can still pick her up', {width: 390, height: 844, phone: true, saved: {...placed, x: 10, y: 480, w: 106}, clock: false}, async page => {
      const p = await point(page); const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: p.x, y: p.y}]});
      for (let i = 1; i <= 4; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: p.x + i * 20, y: p.y}]}); await page.waitForTimeout(30); }
      assert.equal((await state(page)).motion, 'dragging'); assert.equal((await state(page)).pose, 19);
      await page.waitForTimeout(160); await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      await page.waitForTimeout(600); assert.equal((await state(page)).motion, 'idle');
    });
    await test('print hides pet / quiet preference survives reload / no-JS image', {saved: {...placed, quiet: true}}, async page => {
      await page.reload({waitUntil: 'load'}); await page.waitForSelector('#blog-pet.has-motions');
      assert.equal(await page.locator('[data-pet-action="quiet"]').getAttribute('aria-pressed'), 'true');
      await page.emulateMedia({media: 'print'}); assert.equal(await page.locator('#blog-pet').evaluate(el => getComputedStyle(el).display), 'none');
    });
    await test('no JavaScript still renders the neutral same-style image', {js: false}, async page => {
      assert.equal(await page.locator('.pet-art').isVisible(), true);
    });
    console.log(`Pet regression: ${passed} groups passed. Screenshots: ${qa}`);
    fs.writeFileSync(path.join(qa, 'result.json'), JSON.stringify({passed, screenshots: qa}, null, 2) + '\n');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
