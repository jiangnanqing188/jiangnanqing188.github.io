'use strict';

// Standalone renderer regression, not visual approval or proof about encoded MP4 bytes.
// NODE_PATH=/home/jnq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
//   node scripts/video/check-tuning-motion.cjs
// Hexo may import this file: no Canvas, asset loading or assertions outside the CLI.
async function checkTuningMotion() {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const {createHash} = require('node:crypto');
  const acorn = require('acorn');
  const rendererFile = require.resolve('./create-tuning-film.cjs');
  const source = fs.readFileSync(rendererFile, 'utf8');
  const film = require(rendererFile);
  const FPS = 24, DURATION = 75, dt = 1 / 240;
  const digest = text => createHash('sha256').update(text).digest('hex');
  const near = (a, b, label, tolerance = 1e-6) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance, `${label}: ${a} != ${b}`);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const samePoints = (a, b) => a.length === b.length && a.every((p, i) => p.every((v, k) => Math.abs(v - b[i][k]) < 1e-5));
  const matrix = ctx => { const m = ctx.getTransform(); return [m.a, m.b, m.c, m.d, m.e, m.f]; };
  for (const name of ['progressAt', 'routeAt', 'viewAt', 'speedAt', 'cameraAt', 'roverRegistration', 'loadAssets', 'createRenderer']) {
    assert.equal(typeof film[name], 'function', `Missing renderer API: ${name}`);
  }

  // Parse executable syntax; comments and old asset/document paths are not calls.
  const forbidden = /hand|switch|battery|plug|connector/i;
  const calleeName = node => node?.type === 'Identifier' ? node.name : node?.type === 'MemberExpression' ? node.computed ? node.property.value : node.property.name : '';
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration') assert.ok(!forbidden.test(node.id?.name || ''), `Removed action helper is still defined: ${node.id?.name}`);
    if (node.type === 'CallExpression') assert.ok(!forbidden.test(calleeName(node.callee) || ''), `Removed action is still called: ${calleeName(node.callee)}`);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(acorn.parse(source, {ecmaVersion: 'latest', sourceType: 'script'}));
  assert.ok(!Object.keys(film).some(name => forbidden.test(name)), 'Do not export removed action features');

  let previous, maxSpeed = 0, maxStep = 0, maxSpeedDelta = 0, viewChanges = 0;
  for (let i = 0; i <= DURATION / dt; i++) {
    const t = i * dt, progress = film.progressAt(t), r = film.routeAt(progress), speed = film.speedAt(t), view = film.viewAt(t);
    assert.ok(Number.isFinite(progress) && progress >= 0 && progress <= 1, `${t}: invalid route progress`);
    assert.ok([r.x, r.y, r.angle, speed].every(Number.isFinite) && speed >= 0 && speed <= 100, `${t}: invalid/excessive motion state`);
    assert.ok(Number.isInteger(view) && view >= 0 && view < film.CONTACTS.length, `${t}: invalid sprite orientation`);
    if (previous) {
      const step = distance(previous.r, r), speedDelta = Math.abs(speed - previous.speed);
      // At 720p, >100 px/s translation or >100 px/s² scalar acceleration is a regression bound,
      // not a claim that a particular velocity looks physically correct.
      assert.ok(step <= 100 * dt + 1e-3, `${t}: world position jumped ${step}px`);
      assert.ok(speedDelta <= 100 * dt + 1e-2, `${t}: speed jumped ${speedDelta}px/s`);
      assert.ok(progress >= previous.progress, `${t}: unexpected path reversal`);
      const turn = Math.abs(Math.atan2(Math.sin(r.angle - previous.r.angle), Math.cos(r.angle - previous.r.angle)));
      assert.ok(turn <= Math.PI / 9, `${t}: route tangent jumped by ${turn} radians`);
      if (view !== previous.view) {
        // Sprite heading changes may use a camera cut, but only after braking.
        for (const stopped of [t - .1, previous.t, t, t + .1]) assert.ok(film.speedAt(stopped) < .1, `${t}: heading changed before a stable stop`);
        assert.ok(distance(film.routeAt(film.progressAt(t - .1)), film.routeAt(film.progressAt(t + .1))) < .01, `${t}: heading changed while translating`);
        viewChanges++;
      }
      maxStep = Math.max(maxStep, step); maxSpeedDelta = Math.max(maxSpeedDelta, speedDelta);
    }
    const a = Math.max(0, t - dt), b = Math.min(DURATION, t + dt);
    const measured = distance(film.routeAt(film.progressAt(a)), film.routeAt(film.progressAt(b))) / (b - a);
    near(speed, measured, `${t}: reported speed must match actual world displacement`, .5);
    const camera = film.cameraAt(t);
    assert.ok([camera.z, camera.dx, camera.dy].every(Number.isFinite) && camera.z > 0, `${t}: invalid camera projection`);
    maxSpeed = Math.max(maxSpeed, speed);
    previous = {t, r, speed, progress, view};
  }
  assert.ok(maxSpeed > 1 && viewChanges > 0, 'Motion test must exercise driving and orientation changes');
  for (const [a, b] of film.RUNS) for (const t of [a, b]) assert.ok(film.speedAt(t) < .1, `${t}: driving segment must start/end at rest`);
  console.log(`PASS world-motion bounds: 240Hz, max speed ${maxSpeed.toFixed(3)}px/s, step ${maxStep.toFixed(4)}px, speed delta ${maxSpeedDelta.toFixed(4)}px/s; ${viewChanges} stopped heading changes. Camera cuts are not compared as screen-pixel jumps.`);

  const assets = await film.loadAssets();
  assert.ok(!Object.keys(assets).some(name => forbidden.test(name)), 'Removed actions must not load dedicated assets');
  const {createCanvas, loadImage} = require('@napi-rs/canvas');
  const laptop = await loadImage(path.resolve(__dirname, '../../规划/视频/20261104-小胖子调车/assets/engineer-laptop.png'));
  const engineer = assets.engineer.image;
  assert.equal(engineer.width, laptop.width, 'Engineer must use the delivered laptop sheet dimensions');
  assert.equal(engineer.height, laptop.height, 'Engineer must use the delivered laptop sheet dimensions');
  const rgba = image => {
    const canvas = createCanvas(image.width, image.height), context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height).data;
  };
  assert.equal(digest(rgba(engineer)), digest(rgba(laptop)), 'Loaded engineer pixels must equal engineer-laptop.png; no fallback to the old desktop sheet');
  console.log('PASS laptop asset identity: loaded engineer RGBA pixels match engineer-laptop.png, not a filename-only assertion.');
  const sheet = assets.rover;
  const probe = createCanvas(sheet.image.width, sheet.image.height), probeContext = probe.getContext('2d');
  probeContext.drawImage(sheet.image, 0, 0);
  const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
  assert.equal(sheet.contactStrips.length, 4, 'Check all four rover orientations');
  for (let cell = 0; cell < 4; cell++) {
    const ox = cell % 2 * sheet.w, oy = Math.floor(cell / 2) * sheet.h;
    const strips = sheet.contactStrips[cell];
    assert.equal(strips.length, 2, `view ${cell}: require near/far tread strips`);
    for (const [side, strip] of strips.entries()) {
      assert.ok(strip.length >= 5, `view ${cell}: missing actual tread samples`);
      const [from, to] = film.CONTACTS[cell][side];
      for (const [x, y] of strip) {
        assert.ok(x >= from / 627 * sheet.w - 1 && x <= to / 627 * sheet.w + 1, `view ${cell}: sample outside tread interval`);
        assert.ok(y >= sheet.h * .6 && y < sheet.h, `view ${cell}: contact not in lower silhouette`);
        const alpha = py => pixels[((oy + py) * sheet.image.width + ox + x) * 4 + 3];
        assert.ok(alpha(y) > 190, `view ${cell}: contact sample is not opaque source artwork`);
        for (let below = y + 1; below < sheet.h; below++) assert.ok(alpha(below) <= 190, `view ${cell}: opaque wheel pixels lie below the alleged ground`);
      }
    }
    const centers = strips.map(strip => [0, 1].map(k => strip.reduce((sum, p) => sum + p[k], 0) / strip.length));
    const anchor = [0, 1].map(k => (centers[0][k] + centers[1][k]) / 2);
    for (const [x, y] of film.ROUTE) {
      const reg = film.roverRegistration(sheet, cell, {x, y});
      for (const k of [0, 1]) near(reg.anchor[k], anchor[k], `view ${cell}: anchor must bisect the two source contact centers`);
      near(reg.x + anchor[0] * reg.scale, x, `view ${cell}: registered contact center x`);
      near(reg.y + anchor[1] * reg.scale, y, `view ${cell}: registered contact center y`);
    }
  }
  console.log('PASS source-silhouette registration: all 4 views, both lower opaque tread strips, independently computed contact-center anchors at every route waypoint. Not visual grounding approval.');

  const renderer = film.createRenderer(assets), ctx = renderer.canvas.getContext('2d');
  const originals = new Map();
  let frame = 0, points = [], strokes = [], fills = [], roverImages = [], textCalls = [];
  const wrap = (name, observe) => {
    const original = ctx[name]; originals.set(name, original);
    ctx[name] = function(...args) { observe(args); return original.apply(this, args); };
  };
  wrap('beginPath', () => { points = []; });
  wrap('moveTo', args => { points.push(args.slice(0, 2)); });
  wrap('lineTo', args => { points.push(args.slice(0, 2)); });
  wrap('stroke', () => { strokes.push({points: points.map(p => [...p]), matrix: matrix(ctx), width: ctx.lineWidth, alpha: ctx.globalAlpha}); });
  wrap('fill', () => { if (points.length === 4) fills.push({points: points.map(p => [...p]), matrix: matrix(ctx), alpha: ctx.globalAlpha}); });
  wrap('drawImage', args => {
    assert.ok([assets.field, assets.engineer.image, assets.rover.image].includes(args[0]), `frame ${frame}: unexpected image output (removed-action asset?)`);
    if (args[0] === assets.rover.image) roverImages.push({args, matrix: matrix(ctx)});
  });
  for (const name of ['fillText', 'strokeText']) wrap(name, args => {
    textCalls.push({method: name, text: String(args[0]), x: args[1], y: args[2], font: ctx.font, alpha: ctx.globalAlpha, matrix: matrix(ctx)});
  });
  let textFrames = 0;
  try {
    // Render every actual 24fps output timestamp, not only selected stills.
    for (frame = 0; frame < FPS * DURATION; frame++) {
      const t = frame / FPS;
      points = []; strokes = []; fills = []; roverImages = []; textCalls = [];
      renderer.render(t);
      assert.equal(roverImages.length, 1, `${t}: expected one rover body draw, no shell crossfade`);
      const {args, matrix: bodyMatrix} = roverImages[0];
      assert.equal(args.length, 9, `${t}: expected explicit source-cell and destination registration`);
      const ground = film.routeAt(film.progressAt(t)), cell = film.viewAt(t), reg = film.roverRegistration(sheet, cell, ground);
      const box = sheet.boxes[cell];
      [cell % 2 * sheet.w + box.x, Math.floor(cell / 2) * sheet.h + box.y, box.w, box.h,
        reg.x + box.x * reg.scale, reg.y + box.y * reg.scale, box.w * reg.scale, box.h * reg.scale]
        .forEach((value, i) => near(args[i + 1], value, `${t}: actual rover draw argument ${i + 1}`));
      const camera = film.cameraAt(t);
      // Native Canvas stores transforms at float precision; allow <0.001px numerical rounding.
      [camera.z, 0, 0, camera.z, camera.dx, camera.dy].forEach((v, i) => near(bodyMatrix[i], v, `${t}: shared scene-camera matrix ${i}`, 1e-3));
      const worldStrips = reg.contacts.map(strip => strip.map(p => [reg.x + p[0] * reg.scale, reg.y + p[1] * reg.scale]));
      for (const strip of worldStrips) {
        const shadows = strokes.filter(s => samePoints(s.points, strip));
        assert.ok(shadows.length >= 2, `${t}: missing contact-shadow strokes along actual tyre bottoms`);
        for (const shadow of shadows) {
          assert.ok(shadow.width > 0 && shadow.alpha > 0, `${t}: contact-shadow draw is disabled`);
          shadow.matrix.forEach((v, i) => near(v, bodyMatrix[i], `${t}: tyre and contact-shadow must share the same scene plane`, 1e-4));
        }
      }
      const footprint = [worldStrips[0][0], worldStrips[0].at(-1), worldStrips[1].at(-1), worldStrips[1][0]];
      const cast = fills.find(fill => samePoints(fill.points, footprint));
      assert.ok(cast && cast.alpha > 0, `${t}: missing cast-shadow footprint from the contact strips`);
      for (let i = 0; i < 4; i++) near(cast.matrix[i], bodyMatrix[i], `${t}: cast shadow must retain ground-plane scale/axes`, 1e-4);
      assert.ok(Math.hypot(cast.matrix[4] - bodyMatrix[4], cast.matrix[5] - bodyMatrix[5]) <= 16 * camera.z, `${t}: detached cast-shadow translation`);
      if (t <= 72) assert.equal(textCalls.length, 0, `${t}: picture must be wordless, including invisible text calls`);
      for (const call of textCalls) {
        assert.ok(t > 72, `${t}: title/explanation text before sign-off`);
        assert.equal(call.method, 'fillText', `${t}: no outlined title text`);
        assert.equal(call.text, '江南的机器人手记', `${t}: only the quiet sign-off is permitted`);
        const size = Number(call.font.match(/([\d.]+)px/)?.[1]);
        assert.ok(size > 0 && size <= 20 && call.x >= 1000 && call.y >= 640, `${t}: sign-off must remain small and in the lower-right corner`);
        call.matrix.forEach((v, i) => near(v, [1, 0, 0, 1, 0, 0][i], `${t}: sign-off must not inherit scene zoom`));
      }
      assert.ok(textCalls.length <= 1, `${t}: multiple text overlays`);
      if (textCalls.length) textFrames++;
      if (frame % (FPS * 15) === 0) console.log(`Rendered-call check ${t}/${DURATION}s`);
    }
  } finally {
    for (const [name, original] of originals) ctx[name] = original;
  }
  assert.ok(textFrames > 0, 'Exercise the ending sign-off, not only the wordless part');
  assert.equal(digest(fs.readFileSync(rendererFile, 'utf8')), digest(source), 'Renderer changed during test; rerun against the stable candidate');
  console.log(`PASS ${FPS * DURATION} actual render calls: body/contact/cast-shadow scene-plane registration, no text through 72s, only a small ending sign-off (${textFrames} frames), no dedicated hand/switch/battery/connector helpers or assets.`);
  console.log(`Renderer SHA-256: ${digest(source)}. These are renderer regression checks only: continuous-film visual review and final MP4 correspondence remain separate.`);
}

if (require.main === module) checkTuningMotion().catch(error => { console.error(error); process.exitCode = 1; });
