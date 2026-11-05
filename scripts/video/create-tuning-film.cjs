'use strict';

// Offline, deterministic animation. No site code, network, external music or voice.
// NODE_PATH=/home/jnq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
//   node scripts/video/create-tuning-film.cjs --preview-dir /tmp/tuning-film-preview
// Repeat without --preview-dir to encode the complete film; --output changes its destination.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
// Hexo may require this file while building; Canvas is a CLI-only dependency.
let createCanvas, loadImage, GlobalFonts;

const ROOT = path.resolve(__dirname, '../..');
const ASSETS = path.join(ROOT, '规划/视频/20261104-小胖子调车/assets');
const FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
const WIDTH = 1280, HEIGHT = 720, FPS = 24, DURATION = 75;
const PREVIEW_TIMES = [0, 7, 14, 22, 29, 38, 48, 59, 68, 74];
const C = { paper: '#f5f0e6', ink: '#214b3b', orange: '#d98a45', muted: '#6e7763', pale: '#dfdccb' };
const CAPTIONS = [
  [0, 6, '小胖子调车', '一段原创黏土概念动画'],
  [6, 11, '先把路线想清楚，再把它写进电脑。'],
  [11, 16, '敲几行，画几笔。小车，你准备好了吗？'],
  [16, 20.5, '咦？怎么一点动静都没有……'],
  [20.5, 25, '先别急着重写，挨个检查。'],
  [25, 29, '先看电，再看代码。', '供电小插曲为原创借梗，不是比赛故障复现'],
  [29, 34, '啊，插头还在这儿呢。', '供电小插曲为原创借梗，不是比赛故障复现'],
  [34, 40, '改一点，跑一圈。'],
  [40, 47, '不是只盯屏幕，也要看看车怎么走。'],
  [47, 53, '路锥挡在前面？把路线让开一点。'],
  [53, 60, '绕过去，再记下这次改了什么。'],
  [60, 65, '慢慢转回来，回到熟悉的起点。'],
  [65, 70, '这一次，平平安安回来啦。'],
  [70, 75, '调车没有魔法，只有一轮又一轮。', '江南的机器人手记'],
];
// Ground coordinates are in the 1280 × 720 background projection. The loop stays
// below the rear obstacles and above the foreground pipe, with a cone in its hole.
const ROUTE = [[505, 389], [606, 425], [803, 444], [929, 420], [956, 392],
  [901, 365], [775, 359], [631, 363], [544, 373], [505, 389]];
const CONE = { x: 817, y: 402 };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => { p = clamp(p); return p * p * (3 - 2 * p); };
const windowAt = (t, a, b, fade = .4) => ease((t - a) / fade) * ease((b - t) / fade);

function rounded(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function line(ctx, points, color, width = 3) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
function text(ctx, s, x, y, size = 28, color = C.ink, align = 'left') {
  ctx.font = `${size}px FilmCJK`; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}
function shadow(ctx, x, y, rx, ry, alpha = .12) {
  ctx.save(); ctx.fillStyle = `rgba(55,48,31,${alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function catmull(points, u) {
  const q = clamp(u) * (points.length - 1), i = Math.min(points.length - 2, Math.floor(q)), f = q - i;
  const p = [points[Math.max(0, i - 1)], points[i], points[i + 1], points[Math.min(points.length - 1, i + 2)]];
  return [0, 1].map(k => .5 * (2 * p[1][k] + (-p[0][k] + p[2][k]) * f +
    (2 * p[0][k] - 5 * p[1][k] + 4 * p[2][k] - p[3][k]) * f * f +
    (-p[0][k] + 3 * p[1][k] - 3 * p[2][k] + p[3][k]) * f * f * f));
}
const ROUTE_SAMPLES = Array.from({ length: 801 }, (_, i) => catmull(ROUTE, i / 800));
const DISTANCE = [0];
for (let i = 1; i < ROUTE_SAMPLES.length; i++) DISTANCE.push(DISTANCE[i - 1] + Math.hypot(
  ROUTE_SAMPLES[i][0] - ROUTE_SAMPLES[i - 1][0], ROUTE_SAMPLES[i][1] - ROUTE_SAMPLES[i - 1][1]));
function routeAt(p) {
  const d = clamp(p) * DISTANCE.at(-1);
  let i = 1; while (i < DISTANCE.length - 1 && DISTANCE[i] < d) i++;
  const f = (d - DISTANCE[i - 1]) / (DISTANCE[i] - DISTANCE[i - 1]);
  return { x: lerp(ROUTE_SAMPLES[i - 1][0], ROUTE_SAMPLES[i][0], f),
    y: lerp(ROUTE_SAMPLES[i - 1][1], ROUTE_SAMPLES[i][1], f),
    angle: Math.atan2(ROUTE_SAMPLES[i][1] - ROUTE_SAMPLES[i - 1][1], ROUTE_SAMPLES[i][0] - ROUTE_SAMPLES[i - 1][0]) };
}
function progressAt(t) {
  if (t < 34) return 0;
  if (t < 47) return .47 * ease((t - 34) / 13);
  if (t < 50) return .47;
  return .47 + .53 * ease((t - 50) / 17.8);
}
function movingAt(t) { return (t > 34.2 && t < 46.8) || (t > 50.2 && t < 67.6); }
function viewAt(t) {
  const { angle } = routeAt(progressAt(t));
  return Math.cos(angle) >= 0 ? (Math.sin(angle) >= 0 ? 0 : 2) : (Math.sin(angle) >= 0 ? 1 : 3);
}
function poseAt(t) {
  if (t >= 16 && t < 31.5) return 2;
  if (t >= 65) return 3;
  const typing = (t >= 6 && t < 16) || (t >= 35 && t < 37) || (t >= 48 && t < 50) || (t >= 53 && t < 59);
  return typing ? Math.floor(t / .58) % 2 : 0;
}

// Read alpha extents without creating cropped files. Keep a common registration
// across all four source rectangles so the desk does not jump between poses.
function spriteSheet(image) {
  const w = image.width / 2, h = image.height / 2;
  const probe = createCanvas(image.width, image.height), ctx = probe.getContext('2d');
  ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  const boxes = Array.from({ length: 4 }, (_, cell) => {
    const ox = (cell % 2) * w, oy = Math.floor(cell / 2) * h;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, count = 0;
    for (let y = Math.ceil(oy); y < Math.floor(oy + h); y++) {
      for (let x = Math.ceil(ox); x < Math.floor(ox + w); x++) {
        if (pixels[(y * image.width + x) * 4 + 3] < 64) continue;
        x0 = Math.min(x0, x - ox); y0 = Math.min(y0, y - oy);
        x1 = Math.max(x1, x - ox + 1); y1 = Math.max(y1, y - oy + 1); count++;
      }
    }
    if (count < 1000) throw new Error(`精灵格 ${cell} 缺少有效透明主体，请检查素材。`);
    return { x: Math.max(0, x0 - 2), y: Math.max(0, y0 - 2),
      w: Math.min(w, x1 + 2) - Math.max(0, x0 - 2), h: Math.min(h, y1 + 2) - Math.max(0, y0 - 2) };
  });
  const union = { x: Math.min(...boxes.map(b => b.x)), y: Math.min(...boxes.map(b => b.y)) };
  union.w = Math.max(...boxes.map(b => b.x + b.w)) - union.x;
  union.h = Math.max(...boxes.map(b => b.y + b.h)) - union.y;
  return { image, w, h, boxes, union };
}
function sprite(ctx, sheet, cell, x, y, width, height) {
  const b = sheet.boxes[cell], u = sheet.union, scale = Math.min(width / u.w, height / u.h);
  const left = x - u.w * scale / 2, top = y - u.h * scale;
  ctx.drawImage(sheet.image, cell % 2 * sheet.w + b.x, Math.floor(cell / 2) * sheet.h + b.y, b.w, b.h,
    left + (b.x - u.x) * scale, top + (b.y - u.y) * scale, b.w * scale, b.h * scale);
}
async function loadAssets() {
  ({ createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas'));
  const names = ['field.png', 'engineer.png', 'rover.png'];
  const missing = names.filter(n => !fs.existsSync(path.join(ASSETS, n)));
  if (missing.length) throw new Error(`缺少主线程素材：\n${missing.map(n => path.join(ASSETS, n)).join('\n')}\n未生成预览或成片。`);
  if (!fs.existsSync(FONT)) throw new Error(`缺少中文字体：${FONT}`);
  if (!GlobalFonts.registerFromPath(FONT, 'FilmCJK')) throw new Error(`无法注册中文字体：${FONT}`);
  const [field, engineer, rover] = await Promise.all(names.map(n => loadImage(path.join(ASSETS, n))));
  if (Math.abs(field.width / field.height - 16 / 9) > .02) throw new Error('field.png 必须是约16:9空场地。');
  return { field, engineer: spriteSheet(engineer), rover: spriteSheet(rover) };
}

function drawRoute(ctx, t) {
  if (t < 7 || t >= 70) return;
  ctx.save(); ctx.globalAlpha = ease((t - 7) / 2) * .8;
  const adjusted = ease((t - 47.5) / 2);
  const turn = routeAt(.47);
  const planned = ROUTE_SAMPLES.map((point, i) => {
    if (i / 800 <= .47) return point;
    const old = catmull([[turn.x, turn.y], [CONE.x, CONE.y], [631, 363], ROUTE[0]], (i / 800 - .47) / .53);
    return [lerp(old[0], point[0], adjusted), lerp(old[1], point[1], adjusted)];
  });
  ctx.setLineDash([3, 11]); line(ctx, planned, '#9f9f82', 2); ctx.setLineDash([]);
  const p = progressAt(t), n = Math.max(2, Math.round(p * 800));
  if (p > 0) { ctx.globalAlpha = .9; line(ctx, ROUTE_SAMPLES.slice(0, n), C.orange, 4); }
  for (let i = 0; i < 19; i++) {
    const point = routeAt(i / 18), lit = i / 18 <= p && t > 34;
    ctx.fillStyle = lit ? C.orange : '#d5cbb4'; ctx.beginPath();
    ctx.ellipse(point.x, point.y, lit ? 4 : 2.5, lit ? 2.6 : 1.6, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = .9;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(505, 390, 48, 20, -.04, 0, Math.PI * 2); ctx.stroke();
  text(ctx, '起点', 507, 419, 16, C.ink, 'center'); ctx.restore();
}
function drawCone(ctx, t) {
  const { x, y } = CONE;
  ctx.save(); shadow(ctx, x, y + 3, 25, 7, .12);
  ctx.fillStyle = '#bb713c'; ctx.beginPath(); ctx.ellipse(x, y, 24, 7, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(x - 15, 0, x + 15, 0); g.addColorStop(0, '#dd8a3c'); g.addColorStop(.5, '#f1a657'); g.addColorStop(1, '#c67a32');
  ctx.beginPath(); ctx.moveTo(x - 17, y - 3); ctx.lineTo(x - 6, y - 47); ctx.quadraticCurveTo(x, y - 51, x + 6, y - 47);
  ctx.lineTo(x + 17, y - 3); ctx.quadraticCurveTo(x, y + 6, x - 17, y - 3); ctx.fillStyle = g; ctx.fill();
  line(ctx, [[x - 11, y - 24], [x + 11, y - 24]], '#f8edcf', 8);
  if (t >= 47 && t < 60) {
    ctx.globalAlpha = windowAt(t, 47, 60); ctx.setLineDash([4, 6]);
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 59, 31, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
const WHEELS = [
  [[.105,.70],[.255,.82],[.40,.89]], [[.60,.89],[.75,.82],[.895,.70]],
  [[.55,.88],[.70,.79],[.85,.70]], [[.15,.70],[.30,.79],[.45,.88]],
];
function rover(ctx, assets, t, x, y, size, options = {}) {
  const moving = options.moving ?? movingAt(t), v = options.view ?? viewAt(t);
  const active = t >= 31.3;
  ctx.save(); ctx.translate(x, y);
  if (options.scale) ctx.scale(options.scale, options.scale);
  shadow(ctx, 0, -4, size * .37, size * .095, .16);
  // A ground-level light fan, not a gun or fake telemetry.
  if (active) {
    const a = routeAt(progressAt(t)).angle + .16 * Math.sin(t * 1.5), r = size * 1.2;
    ctx.save(); ctx.globalAlpha = .12;
    const g = ctx.createRadialGradient(0, -12, 8, Math.cos(a) * r, Math.sin(a) * r * .35 - 12, r);
    g.addColorStop(0, '#f3b951'); g.addColorStop(1, '#f3b95100'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(Math.cos(a - .35) * r, Math.sin(a - .35) * r * .35 - 12);
    ctx.quadraticCurveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * .35 - 12, Math.cos(a + .35) * r, Math.sin(a + .35) * r * .35 - 12); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // A 120 ms source-frame dissolve at direction boundaries; position never resets.
  const previous = options.view === undefined ? viewAt(Math.max(0, t - .12)) : v;
  if (previous !== v) {
    let lo = t - .12, hi = t;
    for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (viewAt(mid) === previous) lo = mid; else hi = mid; }
    const blend = clamp((t - hi) / .12);
    ctx.globalAlpha = 1 - blend; sprite(ctx, assets.rover, previous, 0, 0, size, size); ctx.globalAlpha = blend;
  }
  sprite(ctx, assets.rover, v, 0, 0, size, size); ctx.globalAlpha = 1;
  const u = assets.rover.union, scale = Math.min(size / u.w, size / u.h), w = u.w * scale, h = u.h * scale;
  if (moving) {
    ctx.strokeStyle = 'rgba(243,224,183,.65)'; ctx.lineWidth = 1.5;
    for (const [nx, ny] of WHEELS[v]) {
      const wx = (nx - .5) * w, wy = (ny - 1) * h, a = t * 15;
      ctx.beginPath(); ctx.moveTo(wx + Math.cos(a) * 8, wy + Math.sin(a) * 10);
      ctx.lineTo(wx - Math.cos(a) * 8, wy - Math.sin(a) * 10); ctx.stroke();
    }
  }
  if (active) {
    const rx = (v === 0 ? .55 : v === 1 ? .45 : .50) * w - w / 2, ry = -.79 * h;
    ctx.save(); ctx.translate(rx, ry); ctx.scale(1, .42); ctx.rotate(t * 2.7);
    line(ctx, [[0, 0], [size * .09, 0]], '#fff0b2', 3);
    ctx.fillStyle = '#fff5d0'; ctx.beginPath(); ctx.arc(size * .09, 0, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (t % 2 < .7) { ctx.fillStyle = '#bbd59d'; ctx.beginPath(); ctx.arc(w * .11, -h * .42, 2.4, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
function speech(ctx, s, x, y, t, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineWidth = 2;
  rounded(ctx, x - 36, y - 38, 72, 63, 23, '#fff9ec', '#d8c5a7');
  ctx.fillStyle = '#fff9ec'; ctx.beginPath(); ctx.moveTo(x - 9, y + 24); ctx.lineTo(x - 19, y + 36); ctx.lineTo(x + 4, y + 24); ctx.fill();
  text(ctx, s, x, y - 5 + 2 * Math.sin(t * 3), 38, C.ink, 'center'); ctx.restore();
}
function screenRoute(ctx, sheet, t, x, bottom, w, h) {
  const u = sheet.union, scale = Math.min(w / u.w, h / u.h);
  const left = x - u.w * scale / 2 - u.x * scale;
  const top = bottom - u.h * scale - u.y * scale;
  // Inside the actual monitor bezel, in a single 2x2 sheet cell's coordinates.
  const corners = [[420, 170], [560, 143], [541, 296], [405, 322]];
  const at = (a, b) => {
    const tx = lerp(corners[0][0], corners[1][0], a), ty = lerp(corners[0][1], corners[1][1], a);
    const bx = lerp(corners[3][0], corners[2][0], a), by = lerp(corners[3][1], corners[2][1], a);
    return [left + lerp(tx, bx, b) * scale, top + lerp(ty, by, b) * scale];
  };
  ctx.save(); ctx.beginPath(); ctx.moveTo(...at(0, 0));
  for (const p of [[1, 0], [1, 1], [0, 1]]) ctx.lineTo(...at(...p));
  ctx.closePath(); ctx.clip();
  ctx.globalAlpha = .30;
  line(ctx, [at(.16,.70), at(.30,.43), at(.56,.59), at(.78,.27)], C.ink, 1.3);
  const progress = t < 16 ? clamp((t - 6) / 9) : progressAt(t);
  const points = [[.16,.70],[.30,.43],[.56,.59],[.78,.27]];
  const count = Math.max(2, Math.floor(progress * 60));
  const drawn = Array.from({length: count}, (_, i) => at(...catmull(points, Math.min(progress, i / 59))));
  ctx.globalAlpha = .72; line(ctx, drawn, C.orange, 1.7);
  const tip = drawn.at(-1); ctx.globalAlpha = .5 + .2 * Math.sin(t * 3);
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(...tip, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function engineer(ctx, assets, t) {
  const large = windowAt(t, 6, 16, .65) + windowAt(t, 16.2, 25, .65) + windowAt(t, 65, 70, .6);
  const w = lerp(288, 350, clamp(large)), h = w * 1.05;
  const x = 207, bottom = lerp(460, 493, clamp(large));
  ctx.save(); ctx.shadowColor = '#6a4f3420'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  rounded(ctx, 28, 114, 358, 408, 34, '#f5f0e6ed'); ctx.restore();
  // Fix desk, keyboard, chair base and legs to cell 0. Only change the upper
  // pose, without drawing a second opaque desk over the first one.
  const sheet = assets.engineer, u = sheet.union, scale = Math.min(w / u.w, h / u.h);
  const split = bottom - u.h * scale + (341 - u.y) * scale;
  ctx.save(); ctx.beginPath(); ctx.rect(20, 110, 375, split - 110); ctx.clip();
  sprite(ctx, sheet, poseAt(t), x, bottom, w, h); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(20, split, 375, 530 - split); ctx.clip();
  sprite(ctx, sheet, 0, x, bottom, w, h); ctx.restore();
  screenRoute(ctx, sheet, t, x, bottom, w, h);
  if (t >= 16 && t < 25) speech(ctx, '?', 331, 207, t, windowAt(t, 16, 25));
  if (t >= 65 && t < 70) {
    for (let i = 0; i < 5; i++) { const a = i * 1.25 + t * .15;
      const x1 = 204 + Math.cos(a) * 105, y1 = 242 + Math.sin(a) * 65;
      ctx.save(); ctx.globalAlpha = windowAt(t, 65, 70) * .7; line(ctx, [[x1 - 4, y1], [x1 + 4, y1]], C.orange, 2);
      line(ctx, [[x1, y1 - 4], [x1, y1 + 4]], C.orange, 2); ctx.restore(); }
  }
}
function routeNotebook(ctx, t) {
  const alpha = windowAt(t, 6.5, 16) + windowAt(t, 53, 60);
  if (!alpha) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(535, 135); ctx.rotate(-.065);
  ctx.shadowColor = '#55412425'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 7;
  rounded(ctx, -115, -89, 230, 178, 8, '#fcf5df'); ctx.shadowColor = 'transparent';
  for (let y = -50; y < 70; y += 24) line(ctx, [[-90, y], [92, y]], '#d9d9bf', 1);
  text(ctx, t < 16 ? '先画一条路线' : '记下这次修改', -89, -64, 19);
  const p = clamp((t < 16 ? t - 7 : t - 53) / 4), points = [[-72, 30], [-35, -8], [30, 20], [74, -28]];
  const count = Math.max(2, Math.ceil(p * 80));
  const traced = Array.from({ length: count }, (_, i) => catmull(points, Math.min(p, i / 79)));
  line(ctx, traced, C.orange, 3);
  const tip = traced.at(-1); ctx.save(); ctx.translate(tip[0] + 12, tip[1] - 12); ctx.rotate(.5);
  rounded(ctx, -4, -55, 8, 65, 2, '#335f49'); ctx.fillStyle = '#c69b66'; ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(0, 19); ctx.lineTo(4, 10); ctx.fill(); ctx.restore();
  ctx.restore();
}
function batteryCloseup(ctx, assets, t) {
  const alpha = windowAt(t, 25, 34, .45); if (!alpha) return;
  const plugged = ease((t - 29.6) / 1.6);
  ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = '#614b3624'; ctx.shadowBlur = 22;
  rounded(ctx, 440, 165, 790, 372, 35, '#f8f0df'); ctx.shadowColor = 'transparent';
  text(ctx, '先看电，再看代码', 480, 205, 33);
  rover(ctx, assets, t, 1008, 493, 236, { moving: false, view: 1 });
  shadow(ctx, 630, 458, 92, 12);
  const bg = ctx.createLinearGradient(540, 320, 725, 440); bg.addColorStop(0, '#59775a'); bg.addColorStop(1, '#314f3c');
  rounded(ctx, 535, 324, 190, 120, 18, bg, '#2b4c36');
  rounded(ctx, 562, 307, 22, 22, 5, '#d4bb80'); rounded(ctx, 676, 307, 22, 22, 5, '#d4bb80');
  text(ctx, '电池', 630, 385, 32, '#f5efd8', 'center');
  const plugX = lerp(770, 871, plugged), plugY = lerp(467, 407, plugged);
  ctx.beginPath(); ctx.moveTo(719, 386); ctx.bezierCurveTo(760, 386, 720, 489, plugX - 12, plugY);
  ctx.strokeStyle = '#8c5e3c'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke();
  rounded(ctx, plugX - 13, plugY - 12, 30, 24, 5, C.orange);
  if (plugged < .96) { line(ctx, [[plugX + 17, plugY - 5], [plugX + 26, plugY - 5]], '#b6ab8f', 4);
    line(ctx, [[plugX + 17, plugY + 5], [plugX + 26, plugY + 5]], '#b6ab8f', 4); }
  if (t > 31.2) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(755, 345, 7, 0, Math.PI * 2); ctx.fill();
    text(ctx, '接上了！', 790, 345, 24); }
  else text(ctx, '……原来在这儿', 752, 288, 25);
  ctx.restore();
}
function magnifier(ctx, assets, t) {
  const alpha = windowAt(t, 37, 45) + windowAt(t, 55, 59.7); if (!alpha) return;
  ctx.save(); ctx.globalAlpha = alpha;
  rounded(ctx, 1000, 112, 240, 220, 28, '#f6f0e5ee');
  text(ctx, t < 47 ? '履带转起来了' : '看一眼，再记录', 1120, 140, 18, C.muted, 'center');
  ctx.beginPath(); ctx.roundRect(1009, 160, 222, 161, 22); ctx.clip();
  rover(ctx, assets, t, 1116, 355, 230, { moving: true, view: t < 47 ? 0 : 3 }); ctx.restore();
}
function headings(ctx, t) {
  let heading = '', sub = '';
  if (t >= 6 && t < 16) { heading = '把想法写下来'; sub = '一张草图，几行代码'; }
  if (t >= 16 && t < 25) { heading = '等等，车呢？'; sub = '先检查，再下结论'; }
  if (t >= 25 && t < 34) { heading = '原来还有这一步'; sub = '一个小小的供电插曲'; }
  if (t >= 34 && t < 47) { heading = '改一点，跑一圈'; sub = '让小车自己告诉你'; }
  if (t >= 47 && t < 60) { heading = '给路锥留点空间'; sub = '调整路线，也留下记录'; }
  if (t >= 60 && t < 70) { heading = '回到起点'; sub = '稳稳回来，就是开心'; }
  if (heading) {
    const veil = ctx.createLinearGradient(0, 0, 455, 0);
    veil.addColorStop(0, '#f5f0e6fa'); veil.addColorStop(.77, '#f5f0e6ec'); veil.addColorStop(1, '#f5f0e600');
    ctx.fillStyle = veil; ctx.fillRect(0, 15, 455, 98);
    text(ctx, heading, 43, 58, 37); text(ctx, sub, 45, 94, 18, C.muted);
  }
}
function caption(ctx, t) {
  const cue = CAPTIONS.find(([a, b]) => t >= a && t < b); if (!cue) return;
  ctx.save(); ctx.fillStyle = C.paper; ctx.fillRect(0, 614, WIDTH, 106);
  line(ctx, [[45, 615], [1235, 615]], '#d9ccaf', 1);
  const size = cue[2].length > 25 ? 29 : 32;
  text(ctx, cue[2], 640, cue[3] ? 651 : 664, size, C.ink, 'center');
  if (cue[3]) text(ctx, cue[3], 640, 691, 18, C.muted, 'center');
  ctx.restore();
}
function titleCard(ctx, assets, t) {
  const opening = t < 6, local = opening ? t : t - 70;
  const alpha = opening ? 1 - ease((t - 5.35) / .65) : ease(local / .6);
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, 0, 990, 0); g.addColorStop(0, '#f5f0e6fa'); g.addColorStop(.64, '#f5f0e6e8'); g.addColorStop(1, '#f5f0e600');
  ctx.fillStyle = g; ctx.fillRect(0, 0, WIDTH, 614);
  text(ctx, '江南的机器人手记', 81, 126, 22, C.muted);
  if (opening) {
    text(ctx, '小胖子', 76, 232, 82); text(ctx, '调车', 76, 326, 82);
    line(ctx, [[82, 392], [185 + 165 * ease(local / 2), 392]], C.orange, 7);
    text(ctx, '一段有点笨拙、但一直向前的小故事', 81, 439, 25);
    sprite(ctx, assets.engineer, Math.floor(t / .5) % 2, 869, 552, 420, 430);
    rover(ctx, assets, 31.4 + t, 1170, 560, 168, { moving: false, view: 1 });
  } else {
    text(ctx, '调车没有魔法，', 78, 242, 49);
    text(ctx, '只有一轮又一轮。', 78, 318, 49);
    line(ctx, [[82, 385], [386, 385]], C.orange, 5);
    text(ctx, '江南的机器人手记', 81, 435, 27);
    sprite(ctx, assets.engineer, 3, 959, 557, 379, 390);
    rover(ctx, assets, t, 1164, 566, 145, { moving: false, view: 1 });
  }
  ctx.restore();
}
function createRenderer(assets) {
  const canvas = createCanvas(WIDTH, HEIGHT), ctx = canvas.getContext('2d');
  return { canvas, render(t) {
    ctx.resetTransform(); ctx.globalAlpha = 1; ctx.fillStyle = C.paper; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Push in on the moving rover, hold through the cone inspection, then
    // return to the wide field. Captions and disclosure are outside this camera.
    const push = ease((t - 34) / 7) * (1 - ease((t - 56) / 7));
    const focus = routeAt(progressAt(t)), z = 1.012 + .208 * push;
    const fx = lerp(640, focus.x, push * .7), fy = lerp(365, focus.y - 37, push * .7);
    const dx = clamp(640 - z * fx, WIDTH * (1 - z), 0);
    const dy = clamp(365 - z * fy, HEIGHT * (1 - z), 0);
    ctx.save(); ctx.translate(dx, dy); ctx.scale(z, z);
    ctx.drawImage(assets.field, 0, 0, WIDTH, HEIGHT);
    drawRoute(ctx, t); if (t >= 6 && t < 70) drawCone(ctx, t);
    const r = routeAt(progressAt(t));
    if (t >= 6 && t < 70) rover(ctx, assets, t, r.x, r.y, 155 + (r.y - 360) * .18);
    if (t >= 16 && t < 25) speech(ctx, '?', r.x + 69, r.y - 151, t, windowAt(t, 16, 25));
    if (t >= 60 && t < 70) { ctx.save(); ctx.globalAlpha = windowAt(t, 67, 70);
      line(ctx, [[583, 307], [596, 320], [622, 290]], C.ink, 6); ctx.restore(); }
    ctx.restore();
    if (t >= 6 && t < 70) { engineer(ctx, assets, t); routeNotebook(ctx, t); headings(ctx, t);
      magnifier(ctx, assets, t); batteryCloseup(ctx, assets, t); }
    if (t < 6 || t >= 70) titleCard(ctx, assets, t);
    rounded(ctx, 935, 20, 315, 38, 18, '#f5f0e6e8');
    text(ctx, '概念动画 · 非比赛实录', 1093, 39, 20, C.ink, 'center');
    caption(ctx, t);
    return canvas;
  } };
}

function vttTime(t) {
  const ms = Math.round(t * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
function subtitles() { return 'WEBVTT\n\n' + CAPTIONS.map(([a, b, s, sub], i) => `${i + 1}\n${vttTime(a)} --> ${vttTime(b)}\n${s}${sub ? '\n' + sub : ''}\n`).join('\n'); }

// Original pentatonic score and synthesized Foley, mixed before PCM encoding.
// No samples, recordings, copyrighted tracks, fake speech or network requests.
function writeAudio(filename) {
  const rate = 44100, n = rate * DURATION, samples = new Float32Array(n);
  function note(start, duration, freq, gain, bass = false) {
    const begin = Math.floor(start * rate), end = Math.min(n, Math.floor((start + duration) * rate));
    for (let i = Math.max(0, begin); i < end; i++) {
      const t = (i - begin) / rate;
      const envelope = Math.min(1, t / .025) * Math.exp(-t * (bass ? 2.2 : 2.8)) * Math.min(1, (duration - t) / .10);
      samples[i] += gain * envelope * (Math.sin(2 * Math.PI * freq * t) + .16 * Math.sin(2 * Math.PI * freq * 2 * t));
    }
  }
  const scale = [261.6256, 293.6648, 329.6276, 391.9954, 440];
  const melody = [0, 2, 3, 2, 1, -1, 0, 4, 3, -1, 2, 1, 0, -1, 1, -1];
  for (let beat = 0; beat * .625 < DURATION - 1; beat++) {
    const start = beat * .625 + .5, quiet = start >= 16 && start < 31 ? .65 : 1;
    const key = melody[beat % melody.length];
    if (key >= 0) note(start, 1.55, scale[key], .055 * quiet);
    if (beat % 4 === 0) note(start, 2, [130.8128, 110, 98, 130.8128][Math.floor(beat / 4) % 4], .055 * quiet, true);
    if (beat % 2 === 1) note(start, .10, 155, .012 * quiet, true);
  }
  let seed = 8041;
  function tick(start, duration = .035, gain = .035) {
    const begin = Math.floor(start * rate), end = Math.min(n, begin + Math.floor(duration * rate));
    for (let i = begin; i < end; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const t = (i - begin) / rate;
      samples[i] += ((seed / 4294967296) * 2 - 1) * gain * Math.exp(-t * 110);
    }
  }
  for (const [a, b] of [[6.4, 15.6], [35, 37], [48, 50], [54, 57]]) {
    for (let t = a; t < b; t += .21) { tick(t); tick(t + .072, .025, .022); }
  }
  tick(30.9, .06, .12); note(31.3, .32, 392, .055); note(31.55, .5, 523.251, .05);
  note(18, .4, 220, .028); note(18.3, .5, 196, .025);
  for (const [a, b] of [[34, 47], [50, 67.8]]) {
    for (let i = Math.floor(a * rate); i < Math.floor(b * rate); i++) {
      const t = i / rate, envelope = Math.min(ease((t - a) / 1), ease((b - t) / 1));
      samples[i] += .018 * envelope * (Math.sin(t * Math.PI * 2 * 84 + .9 * Math.sin(t * 4)) + .35 * Math.sin(t * Math.PI * 2 * 168));
    }
  }
  [523.251, 659.255, 783.991].forEach((f, i) => note(67.8 + i * .16, 1.2, f, .055));
  const wav = Buffer.alloc(44 + n * 2); wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4);
  wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate, fade = Math.min(ease(t / 1.2), ease((DURATION - t) / 2));
    const sample = clamp(samples[i] * fade, -.95, .95);
    peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
    wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filename, wav);
  return { seconds: DURATION, peak: +peak.toFixed(4), rms: +Math.sqrt(sum / n).toFixed(4), rate };
}
function preview(renderer, directory) {
  const relative = path.relative(ROOT, directory);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('--preview-dir 必须在项目之外（例如 /tmp/tuning-film-preview），避免中间帧进入 Git 或 source。');
  fs.mkdirSync(directory, { recursive: true });
  for (const t of PREVIEW_TIMES) fs.writeFileSync(path.join(directory, `frame-${String(t).padStart(2, '0')}.png`), renderer.render(t).toBuffer('image/png'));
  console.log(`预览完成：${directory}（${PREVIEW_TIMES.join(', ')} 秒）`);
}
function parseArgs(args) {
  const options = { output: path.join(ROOT, 'source/media/tuning-workshop.mp4') };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--preview-dir', '--output'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      throw new Error('用法：node scripts/video/create-tuning-film.cjs [--preview-dir /tmp/预览目录] [--output /path/film.mp4]');
    options[flag === '--output' ? 'output' : 'previewDir'] = path.resolve(args[++i]);
  }
  if (path.extname(options.output).toLowerCase() !== '.mp4') throw new Error('--output 必须以 .mp4 结尾。');
  return options;
}
async function encode(renderer, audio, destination) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${WIDTH}x${HEIGHT}`, '-framerate', String(FPS), '-i', 'pipe:0',
    '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
    '-b:v', '1250k', '-maxrate', '1650k', '-bufsize', '3300k', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-g', '48', '-c:a', 'aac', '-b:a', '112k', '-ar', '44100', '-ac', '2',
    '-t', String(DURATION), '-movflags', '+faststart', '-metadata', 'title=小胖子调车',
    '-metadata', 'comment=原创概念动画，非比赛实录；原创合成音乐和音效，无真人旁白。', destination], { stdio: ['pipe', 'ignore', 'pipe'] });
  let errors = '', pipeError;
  child.stderr.on('data', b => { errors = (errors + b).slice(-8000); });
  child.stdin.on('error', e => { pipeError = e; });
  const complete = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg 退出 ${code}：${errors || pipeError?.message || '无诊断'}`)));
  });
  // Observe a rejected child immediately even while we are still producing frames.
  complete.catch(() => {});
  try {
    for (let frame = 0; frame < FPS * DURATION; frame++) {
      if (pipeError || child.exitCode !== null) throw new Error(`编码输入提前关闭：${pipeError?.message || errors}`);
      const bytes = renderer.render(frame / FPS).data();
      if (!child.stdin.write(bytes)) await once(child.stdin, 'drain');
      if (frame % (FPS * 5) === 0) console.log(`渲染 ${frame / FPS}/${DURATION} 秒`);
    }
    child.stdin.end(); await complete;
  } catch (e) { child.stdin.destroy(); child.kill('SIGTERM'); await complete.catch(() => {}); throw e; }
}
function inspectMovie(filename) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filename], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`ffprobe 失败：${probe.stderr || probe.error?.message}`);
  const result = JSON.parse(probe.stdout), v = result.streams.find(s => s.codec_type === 'video'), a = result.streams.find(s => s.codec_type === 'audio');
  if (!v || !a || v.codec_name !== 'h264' || v.width !== WIDTH || v.height !== HEIGHT || v.pix_fmt !== 'yuv420p' || v.avg_frame_rate !== '24/1' ||
      Number(v.nb_frames) !== FPS * DURATION || a.codec_name !== 'aac' || Math.abs(Number(result.format.duration) - DURATION) > .15 || Number(result.format.size) > 20 * 1024 * 1024)
    throw new Error(`成片未通过规格核验：${JSON.stringify(result)}`);
  return { duration: result.format.duration, bytes: Number(result.format.size), video: `${v.codec_name} ${v.width}x${v.height} ${v.pix_fmt} ${v.avg_frame_rate}`, frames: v.nb_frames, audio: `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` };
}
async function main() {
  const options = parseArgs(process.argv.slice(2)), assets = await loadAssets(), renderer = createRenderer(assets);
  console.log('素材尺寸：', Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, `${(v.image || v).width}x${(v.image || v).height}`])));
  if (options.previewDir) { preview(renderer, options.previewDir); return; }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tuning-film-'));
  try {
    preview(renderer, path.join(temp, 'previews'));
    const wav = path.join(temp, 'original-score.wav'), movie = path.join(temp, 'film.mp4');
    console.log('原创音轨：', writeAudio(wav));
    await encode(renderer, wav, movie);
    const report = inspectMovie(movie);
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    // Publish complete local files only after ffprobe passes; no remote deployment.
    const staging = `${options.output}.rendering-${process.pid}`;
    fs.copyFileSync(movie, staging); fs.renameSync(staging, options.output);
    const vtt = options.output.replace(/\.mp4$/i, '.zh-CN.vtt'); fs.writeFileSync(vtt, subtitles());
    console.log(JSON.stringify({ output: options.output, subtitles: vtt, ...report }, null, 2));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { CAPTIONS, ROUTE, PREVIEW_TIMES, progressAt, routeAt, poseAt, viewAt, writeAudio, subtitles, loadAssets, createRenderer, inspectMovie };
