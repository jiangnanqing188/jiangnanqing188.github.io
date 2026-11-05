'use strict';

// Offline film renderer. Hexo can require this file without Canvas or side effects.
// NODE_PATH=/home/jnq/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
//   node scripts/video/create-tuning-film.cjs --preview-dir /tmp/tuning-film-wordless-preview
//   node scripts/video/create-tuning-film.cjs --motion-preview /tmp/tuning-motion-review.mp4
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
let createCanvas, loadImage, GlobalFonts;
const ROOT = path.resolve(__dirname, '../..');
const ASSETS = path.join(ROOT, '规划/视频/20261104-小胖子调车/assets');
const FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
const WIDTH = 1280, HEIGHT = 720, FPS = 24, DURATION = 75;
const PREVIEW_TIMES = [0, 7, 14, 22, 25, 29, 31, 38, 41, 48, 50, 59, 64, 68, 74];
const C = { paper: '#f5f0e6', ink: '#214b3b', orange: '#d98a45' };
// Inspected engineer-laptop.png (1263x1246): first-cell interior coordinates.
// The other poses share this screen/desk registration; only the body above it changes.
const LAPTOP_LANDMARKS = {
  screen: [[431,221],[537,194],[503,309],[395,336]],
  keys: { x: 284, y: 319, w: 87, h: 33 },
  feet: [[112,562],[258,604],[574,529],[461,487],[211,557],[345,569],[409,552]],
};
// Optional sound descriptions, never burned into the picture.
const CAPTIONS = [[0, 8, '[轻音乐，键盘敲击声]'], [8, 15, '[电机短响，履带转动后停下]'],
  [15, 24, '[轻音乐继续，电机安静下来]'], [24, 32, '[柔和启动提示音，电机低鸣]'],
  [32, 58, '[履带与电机转动声，间歇停顿]'], [58, 66, '[履带缓转后停下]'],
  [66, 75, '[轻快提示音，音乐渐弱]']];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const ease = p => { p = clamp(p); return p * p * (3 - 2 * p); };
const smoother = p => { p = clamp(p); return p * p * p * (10 + p * (-15 + 6 * p)); };
const ROUTE = [[610, 394], [690, 416], [845, 415], [963, 391],
  [935, 355], [815, 341], [675, 345], [611, 374], [610, 394]];
const CONE = { x: 820, y: 380 };
// Stops are intentional match-cut opportunities, not invisible shell dissolves.
const RUNS = [[8, 14.2, 0, .13, 0], [30.8, 40, .13, .36, 0],
  [41.8, 49, .36, .48, 2], [51, 58, .48, .78, 3], [60, 66, .78, 1, 1]];
const perspectiveAt = y => 1 + (y - 390) * .0018;
const reviewTimeAt = t => t + 36;
function line(ctx, points, color, width = 2) {
  ctx.beginPath(); ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
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
  for (const [a, b, from, to] of RUNS) {
    if (t < a) return from;
    if (t <= b) return lerp(from, to, smoother((t - a) / (b - a)));
  }
  return 1;
}
function viewAt(t) { return t < 41.1 ? 0 : t < 50.2 ? 2 : t < 59 ? 3 : 1; }
function speedAt(t) {
  const dt = .002;
  return Math.max(0, (progressAt(t + dt) - progressAt(t - dt)) * DISTANCE.at(-1) / (2 * dt));
}
function poseAt(t) { return t >= 14.5 && t < 23.7 ? 2 : t >= 66 ? 3 : 0; }
// Independent near/far tread intervals, in normalized source-cell x. Their
// actual lower alpha silhouette is sampled at load time, rather than using
// either the four-cell union or the frontmost wheel as the ground origin.
const CONTACTS = [[ [105,320],[480,553] ], [ [307,522],[74,147] ],
  [ [290,535],[89,180] ], [ [92,337],[447,538] ]];
function spriteSheet(image) {
  const w = image.width / 2, h = image.height / 2;
  const probe = createCanvas(image.width, image.height), ctx = probe.getContext('2d');
  ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  const boxes = Array.from({ length: 4 }, (_, cell) => {
    const ox = cell % 2 * w, oy = Math.floor(cell / 2) * h;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, count = 0;
    for (let y = Math.ceil(oy); y < Math.floor(oy + h); y++) for (let x = Math.ceil(ox); x < Math.floor(ox + w); x++) {
      if (pixels[(y * image.width + x) * 4 + 3] < 96) continue;
      x0 = Math.min(x0, x - ox); y0 = Math.min(y0, y - oy);
      x1 = Math.max(x1, x - ox + 1); y1 = Math.max(y1, y - oy + 1); count++;
    }
    if (count < 1000) throw new Error(`精灵格 ${cell} 缺少有效透明主体。`);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  });
  const contactStrips = CONTACTS.map((intervals, cell) => intervals.map(([from,to]) => {
    const points=[];
    const ox=cell%2*w, oy=Math.floor(cell/2)*h;
    for(let px=from;px<=to;px+=5){
      const x=Math.round(ox+px/627*w);let bottom=-1;
      for(let y=Math.ceil(oy+h*.60);y<Math.floor(oy+h);y++)
        if(pixels[(y*image.width+x)*4+3]>190) bottom=y-oy;
      if(bottom>=0)points.push([x-ox,bottom]);
    }
    if(points.length<5)throw new Error(`精灵格 ${cell} 无法标定履带轮底。`);
    return points;
  }));
  return { image, w, h, boxes, contactStrips };
}
function sourceCell(ctx, sheet, cell, x, y, scale) {
  const b = sheet.boxes[cell];
  ctx.drawImage(sheet.image, cell % 2 * sheet.w + b.x, Math.floor(cell / 2) * sheet.h + b.y, b.w, b.h,
    x + b.x * scale, y + b.y * scale, b.w * scale, b.h * scale);
}
async function loadAssets() {
  ({ createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas'));
  const names = ['field.png', 'engineer-laptop.png', 'rover.png'];
  const missing = names.filter(n => !fs.existsSync(path.join(ASSETS, n)));
  if (missing.length) throw new Error(`缺少主线程素材：\n${missing.map(n => path.join(ASSETS, n)).join('\n')}\n未生成预览或成片。`);
  if (!fs.existsSync(FONT) || !GlobalFonts.registerFromPath(FONT, 'FilmCJK')) throw new Error(`无法注册字体：${FONT}`);
  const [field, engineer, rover] = await Promise.all(names.map(n => loadImage(path.join(ASSETS, n))));
  return { field, engineer: spriteSheet(engineer), rover: spriteSheet(rover) };
}
function floorShadow(ctx, points, alpha, blur, offsetX = 0, offsetY = 0) {
  ctx.save(); ctx.shadowColor = `rgba(69,53,30,${alpha})`; ctx.shadowBlur = blur;
  ctx.fillStyle = `rgba(69,53,30,${alpha})`; ctx.filter = `blur(${blur * .4}px)`; ctx.translate(offsetX, offsetY);
  ctx.beginPath(); ctx.moveTo(...points[0]); for (const p of points.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); ctx.restore();
}
function roverRegistration(sheet, cell, r) {
  const contacts = sheet.contactStrips[cell];
  const centers=contacts.map(points=>[points.reduce((s,p)=>s+p[0],0)/points.length,
    points.reduce((s,p)=>s+p[1],0)/points.length]);
  const anchor=[(centers[0][0]+centers[1][0])/2,(centers[0][1]+centers[1][1])/2];
  const scale = 163 * perspectiveAt(r.y) / sheet.boxes[cell].w;
  const x = r.x - anchor[0] * scale, y = r.y - anchor[1] * scale;
  const point = p => [x + p[0] / 627 * sheet.w * scale, y + p[1] / 627 * sheet.h * scale];
  return { x, y, scale, anchor, contacts, centers, point };
}
function drawRover(ctx, assets, t, override) {
  const r = override?.ground || routeAt(progressAt(t)), cell = override?.cell ?? viewAt(t), reg = roverRegistration(assets.rover, cell, r);
  const { x, y, scale, contacts } = reg;
  const strips = contacts.map(strip => strip.map(p => [x + p[0] * scale, y + p[1] * scale]));
  // Diffuse light falls from the upper left, like the field. The dark contact
  // strips overlap the actual tyre bottoms; no detached oval underneath.
  const footprint=[strips[0][0],strips[0].at(-1),strips[1].at(-1),strips[1][0]];
  // One soft, downward-right cast shadow plus two narrow silhouette-following
  // contact shadows. The visible tyre edge overlaps each dark core by ~1px.
  floorShadow(ctx, footprint, .055, 7, 3.5, 2.5);
  ctx.save();ctx.shadowColor='#493d2e60';ctx.shadowBlur=3;
  for(const strip of strips)line(ctx,strip,'#493d2e65',4.2*perspectiveAt(r.y));
  ctx.shadowBlur=0;
  for(const strip of strips)line(ctx,strip,'#3a302852',1.8*perspectiveAt(r.y));ctx.restore();
  sourceCell(ctx, assets.rover, cell, x, y, scale);
  // Cover the asset's pale matte fringe at the actual tread/floor interface.
  // Device-sized AO: 1px into the tyre and <2px below it even in close shots.
  const transform=ctx.getTransform(),zoom=Math.hypot(transform.a,transform.b);
  for(const strip of strips)line(ctx,strip.map(([px,py])=>[px,py+.4/zoom]),'#302b24b8',2.8/zoom);
  const moving = speedAt(t), phase = progressAt(t) * DISTANCE.at(-1) * .22;
  const wheels = [ [[112,420],[199,476],[286,506]], [[341,506],[428,476],[515,420]],
    [[333,505],[414,465],[494,421]], [[132,421],[213,465],[294,505]] ][cell];
  if (moving > .1) for (const p of wheels) {
    const [wx,wy] = reg.point(p), a = phase;
    line(ctx, [[wx+Math.cos(a)*2.8, wy+Math.sin(a)*4], [wx-Math.cos(a)*2.8, wy-Math.sin(a)*4]], '#e5d3ab90', 1.1);
  }
  const radar = [[354,156],[273,156],[346,118],[281,118]][cell], [rx,ry] = reg.point(radar);
  if (t > 29.3 || t < 15) {
    ctx.save(); ctx.translate(rx,ry); ctx.scale(1,.42); ctx.rotate(t*1.9);
    line(ctx, [[0,0],[8,0]], '#fff2b3c0', 1.5); ctx.restore();
  }
  if(t>=25){
    const light=reg.point([[511,351],[116,351],[171,325],[456,325]][cell]);
    const intensity=ease((t-25)/4.2);
    ctx.save();ctx.globalAlpha=intensity;ctx.shadowColor='#d4e0a8';ctx.shadowBlur=5;
    ctx.fillStyle='#c2d99c';ctx.beginPath();ctx.arc(...light,2.1,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  return { r, reg };
}
function drawCone(ctx) {
  const {x,y}=CONE;
  floorShadow(ctx, [[x-16,y-4],[x+13,y-6],[x+23,y+2],[x-6,y+8]], .09, 4, 3, 2);
  ctx.fillStyle='#bb713c';ctx.beginPath();ctx.ellipse(x,y,19,6,0,0,Math.PI*2);ctx.fill();
  const g=ctx.createLinearGradient(x-13,0,x+13,0);g.addColorStop(0,'#cd7f38');g.addColorStop(.45,'#e8a158');g.addColorStop(1,'#c0803c');
  ctx.beginPath();ctx.moveTo(x-13,y-3);ctx.lineTo(x-5,y-40);ctx.quadraticCurveTo(x,y-44,x+5,y-40);ctx.lineTo(x+13,y-3);ctx.quadraticCurveTo(x,y+3,x-13,y-3);ctx.fillStyle=g;ctx.fill();
  line(ctx,[[x-9,y-21],[x+9,y-21]],'#f6ead0',6);
}
function drawFloorMarks(ctx,t) {
  // Thin chalk on the existing ground, not a diagram over the footage.
  ctx.save();ctx.globalAlpha=.2;ctx.setLineDash([2,16]);line(ctx,ROUTE_SAMPLES,'#8f9177',1.2);ctx.setLineDash([]);
  if(t>32){ctx.globalAlpha=.34;line(ctx,ROUTE_SAMPLES.slice(0,Math.max(2,Math.round(progressAt(t)*800))),C.orange,1.8);}
  ctx.restore();
}
function drawEngineer(ctx, sheet, t) {
  const ground={x:340,y:471}, scale=.485*perspectiveAt(ground.y);
  const x=ground.x-328*scale,y=ground.y-592*scale;
  // Four desk/chair contact points share the same scene projection as the rover.
  for(const p of LAPTOP_LANDMARKS.feet) {
    const q=[x+p[0]*scale,y+p[1]*scale];ctx.save();ctx.shadowColor='#55473035';ctx.shadowBlur=2;
    ctx.fillStyle='#55473038';ctx.beginPath();ctx.ellipse(q[0]+.5,q[1]+.15,4.1,1,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  const split=y+344*scale;
  ctx.save();ctx.beginPath();ctx.rect(x-3,y-5,sheet.w*scale+6,split-y+5);ctx.clip();
  // Reaction poses change only on motivated camera cuts. Never alpha-blend
  // two faces, shoulders or hands in the same shot.
  sourceCell(ctx,sheet,poseAt(t),x,y,scale);
  ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(x-3,split,sheet.w*scale+6,sheet.h*scale);ctx.clip();sourceCell(ctx,sheet,0,x,y,scale);ctx.restore();
  const typing=poseAt(t)===0&&(t<7.5||(t>=31.2&&t<35));
  if(typing){
    // One opaque patch from the SAME pose. A small press and release, not a
    // translucent second hand. Maximum displacement is <1.3 output px here.
    const press=Math.pow(Math.max(0,Math.sin(t*12)),2);
    const {x:sx,y:sy,w:sw,h:sh}=LAPTOP_LANDMARKS.keys;
    ctx.save();ctx.beginPath();ctx.rect(x+(sx-2)*scale,y+(sy-2)*scale,(sw+4)*scale,(sh+4)*scale);ctx.clip();
    ctx.drawImage(sheet.image,sx,sy,sw,sh,x+sx*scale,y+sy*scale+press*.52,sw*scale,sh*scale);
    ctx.restore();
  }
  const corners=LAPTOP_LANDMARKS.screen;
  const at=(a,b)=>[x+lerp(lerp(corners[0][0],corners[1][0],a),lerp(corners[3][0],corners[2][0],a),b)*scale,
    y+lerp(lerp(corners[0][1],corners[1][1],a),lerp(corners[3][1],corners[2][1],a),b)*scale];
  ctx.save();ctx.globalAlpha=.44;line(ctx,[at(.14,.7),at(.32,.42),at(.57,.58),at(.81,.25)],C.ink,1);
  const p=t<8?clamp(t/7):progressAt(t),q=catmull([[.14,.7],[.32,.42],[.57,.58],[.81,.25]],p);
  const dot=at(...q);ctx.fillStyle=C.orange;ctx.beginPath();ctx.arc(...dot,1.5,0,Math.PI*2);ctx.fill();ctx.restore();
}
function cameraAt(t) {
  const r=routeAt(progressAt(t));let z,fx,fy;
  if(t<7.5){z=lerp(2.02,1.87,ease(t/7.5));fx=405;fy=330;}
  else if(t<14.5){z=lerp(1.55,1.82,ease((t-7.5)/7));fx=r.x-15;fy=r.y-40;}
  else if(t<23.7){z=1.94;fx=402;fy=329;}
  else if(t<26.5){z=1.3;fx=600;fy=365;}
  else if(t<31.2){z=lerp(2.7,3.35,ease((t-26.5)/4.7));fx=r.x+10;fy=r.y-103;}
  else if(t<40){z=lerp(1.7,1.42,ease((t-31.2)/8.8));fx=r.x;fy=r.y-45;}
  else if(t<41.1){z=2.8;fx=r.x;fy=r.y-46;}
  else if(t<41.8){z=4;fx=r.x+4;fy=r.y-109;}
  else if(t<49){z=1.78;fx=r.x;fy=r.y-46;}
  else if(t<50.2){z=2.8;fx=r.x;fy=r.y-46;}
  else if(t<51){z=4;fx=r.x;fy=r.y-110;}
  else if(t<58){z=lerp(1.65,1.36,ease((t-51)/7));fx=r.x;fy=r.y-42;}
  else if(t<59){z=2.8;fx=r.x;fy=r.y-46;}
  else if(t<60){z=3.9;fx=r.x;fy=r.y-110;}
  else if(t<66){z=lerp(1.52,1.25,ease((t-60)/6));fx=lerp(r.x,620,ease((t-62)/4));fy=365;}
  else if(t<69){z=lerp(1.9,1.82,ease((t-66)/3));fx=405;fy=328;}
  else{z=lerp(1.25,1.08,ease((t-69)/3));fx=620;fy=365;}
  return {z,dx:clamp(640-z*fx,WIDTH*(1-z),0),dy:clamp(360-z*fy,HEIGHT*(1-z),0)};
}
function createRenderer(assets) {
  const canvas=createCanvas(WIDTH,HEIGHT),ctx=canvas.getContext('2d');
  return {canvas,render(t){
    ctx.resetTransform();ctx.globalAlpha=1;ctx.fillStyle=C.paper;ctx.fillRect(0,0,WIDTH,HEIGHT);
    const camera=cameraAt(t);ctx.save();ctx.translate(camera.dx,camera.dy);ctx.scale(camera.z,camera.z);
    ctx.drawImage(assets.field,0,0,WIDTH,HEIGHT);drawFloorMarks(ctx,t);
    drawEngineer(ctx,assets.engineer,t);
    const r=routeAt(progressAt(t));
    if(r.y<CONE.y){drawRover(ctx,assets,t);drawCone(ctx);}else{drawCone(ctx);drawRover(ctx,assets,t);}
    ctx.restore();
    // The only typography in the picture: a quiet sign-off after 72 seconds.
    if(t>=72.5){ctx.save();ctx.globalAlpha=ease((t-72.5)/1.1);ctx.font='19px FilmCJK';ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle=C.ink;ctx.fillText('江南的机器人手记',1230,682);ctx.restore();}
    return canvas;
  }};
}

function contactDebug(assets,directory) {
  if(!path.relative(ROOT,directory).startsWith('..'))throw new Error('接地debug必须在项目之外。');
  fs.mkdirSync(directory,{recursive:true});
  for(let cell=0;cell<4;cell++){
    const c=createCanvas(960,620),ctx=c.getContext('2d'),ground={x:480,y:448};
    ctx.fillStyle=C.paper;ctx.fillRect(0,0,960,620);
    ctx.save();ctx.translate(480,410);ctx.scale(2.3,2.3);ctx.translate(-ground.x,-ground.y);
    ctx.drawImage(assets.field,0,0,1280,720);
    const {reg}=drawRover(ctx,assets,35,{cell,ground});
    for(let k=0;k<2;k++){
      const strip=reg.contacts[k].map(p=>[reg.x+p[0]*reg.scale,reg.y+p[1]*reg.scale]);
      line(ctx,strip,k?'#e68132':'#38709c',1.2);
      const center=[reg.x+reg.centers[k][0]*reg.scale,reg.y+reg.centers[k][1]*reg.scale];
      line(ctx,[center,[ground.x,ground.y]],'#3a8e8a',.55);
      ctx.fillStyle='#e68132';ctx.beginPath();ctx.arc(...center,1.4,0,Math.PI*2);ctx.fill();
    }
    line(ctx,[[ground.x-4,ground.y],[ground.x+4,ground.y]],'#d74744',1);
    line(ctx,[[ground.x,ground.y-4],[ground.x,ground.y+4]],'#d74744',1);ctx.restore();
    ctx.fillStyle=C.ink;ctx.font='20px FilmCJK';ctx.fillText(`DEBUG ONLY · source cell ${cell}`,30,35);
    ctx.font='17px FilmCJK';ctx.fillText('蓝/橙：近/远履带实际轮底；红十字：两条接地印迹中心的中点',30,572);
    ctx.fillText(`anchor: (${reg.anchor.map(v=>v.toFixed(2)).join(', ')}) · world: (480, 448)`,30,600);
    fs.writeFileSync(path.join(directory,`contact-${cell}.png`),c.toBuffer('image/png'));
  }
  console.log(`接地debug：${directory}`);
}

function vttTime(t) {
  const ms = Math.round(t * 1000); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
function subtitles() { return 'WEBVTT\n\n' + CAPTIONS.map(([a, b, s, sub], i) => `${i + 1}\n${vttTime(a)} --> ${vttTime(b)}\n${s}${sub ? '\n' + sub : ''}\n`).join('\n'); }

// Original pentatonic score and synthesized Foley, mixed before PCM encoding.
// No samples, recordings, copyrighted tracks, fake speech or network requests.
function writeAudio(filename, review = false) {
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
    const start = beat * .625 + .5, quiet = start >= 15 && start < 29 ? .65 : 1;
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
  for (const [a, b] of [[.2, 7.3], [31.2, 34.8]]) {
    for (let t = a; t < b; t += .21) { tick(t); tick(t + .072, .025, .022); }
  }
  note(29.2, .32, 392, .045); note(29.45, .5, 523.251, .04);

  for (const [a, b] of RUNS) {
    for (let i = Math.floor(a * rate); i < Math.floor(b * rate); i++) {
      const t = i / rate, envelope = Math.sqrt(clamp(speedAt(t) / 52));
      samples[i] += .023 * envelope * (Math.sin(t * Math.PI * 2 * 84 + .9 * Math.sin(t * 4)) + .35 * Math.sin(t * Math.PI * 2 * 168));
    }
  }
  [523.251, 659.255, 783.991].forEach((f, i) => note(66.2 + i * .16, 1.2, f, .055));
  const count = rate * (review ? 8 : DURATION);
  const wav = Buffer.alloc(44 + count * 2); wav.write('RIFF', 0); wav.writeUInt32LE(36 + count * 2, 4);
  wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  let peak = 0, sum = 0;
  for (let i = 0; i < count; i++) {
    const clock = i / rate, t = review ? reviewTimeAt(clock) : clock;
    let fade = Math.min(ease(t / 1.2), ease((DURATION - t) / 2));
    if (review) fade *= Math.min(ease(clock / .08), ease((8-clock) / .08));
    const sample = clamp(samples[Math.floor(t * rate)] * fade, -.95, .95);
    peak = Math.max(peak, Math.abs(sample)); sum += sample * sample;
    wav.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filename, wav);
  return { seconds: count / rate, peak: +peak.toFixed(4), rms: +Math.sqrt(sum / count).toFixed(4), rate };
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
    if (!['--preview-dir', '--motion-preview', '--debug-contact-dir', '--output'].includes(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      throw new Error('用法：node scripts/video/create-tuning-film.cjs [--preview-dir /tmp/预览目录] [--motion-preview /tmp/motion.mp4] [--debug-contact-dir /tmp/contacts] [--output /path/film.mp4]');
    options[flag === '--output' ? 'output' : flag === '--preview-dir' ? 'previewDir' : flag === '--debug-contact-dir' ? 'debugContactDir' : 'motionPreview'] = path.resolve(args[++i]);
  }
  if (path.extname(options.output).toLowerCase() !== '.mp4') throw new Error('--output 必须以 .mp4 结尾。');
  return options;
}
async function encode(renderer, audio, destination, review = false) {
  const duration = review ? 8 : DURATION;
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-y',
    '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', `${WIDTH}x${HEIGHT}`, '-framerate', String(FPS), '-i', 'pipe:0',
    '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
    '-b:v', '1250k', '-maxrate', '1650k', '-bufsize', '3300k', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-g', '48', '-c:a', 'aac', '-b:a', '112k', '-ar', '44100', '-ac', '2',
    '-t', String(duration), '-movflags', '+faststart', '-metadata', 'title=机器人调试日常',
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
    for (let frame = 0; frame < FPS * duration; frame++) {
      if (pipeError || child.exitCode !== null) throw new Error(`编码输入提前关闭：${pipeError?.message || errors}`);
      const bytes = renderer.render(review ? reviewTimeAt(frame / FPS) : frame / FPS).data();
      if (!child.stdin.write(bytes)) await once(child.stdin, 'drain');
      if (frame % (FPS * 5) === 0) console.log(`渲染 ${frame / FPS}/${duration} 秒`);
    }
    child.stdin.end(); await complete;
  } catch (e) { child.stdin.destroy(); child.kill('SIGTERM'); await complete.catch(() => {}); throw e; }
}
function inspectMovie(filename, seconds = DURATION) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filename], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`ffprobe 失败：${probe.stderr || probe.error?.message}`);
  const result = JSON.parse(probe.stdout), v = result.streams.find(s => s.codec_type === 'video'), a = result.streams.find(s => s.codec_type === 'audio');
  if (!v || !a || v.codec_name !== 'h264' || v.width !== WIDTH || v.height !== HEIGHT || v.pix_fmt !== 'yuv420p' || v.avg_frame_rate !== '24/1' ||
      Number(v.nb_frames) !== FPS * seconds || a.codec_name !== 'aac' || Math.abs(Number(result.format.duration) - seconds) > .15 || Number(result.format.size) > 20 * 1024 * 1024)
    throw new Error(`成片未通过规格核验：${JSON.stringify(result)}`);
  return { duration: result.format.duration, bytes: Number(result.format.size), video: `${v.codec_name} ${v.width}x${v.height} ${v.pix_fmt} ${v.avg_frame_rate}`, frames: v.nb_frames, audio: `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` };
}
async function main() {
  const options = parseArgs(process.argv.slice(2)), assets = await loadAssets(), renderer = createRenderer(assets);
  console.log('素材尺寸：', Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, `${(v.image || v).width}x${(v.image || v).height}`])));
  if (options.previewDir) preview(renderer, options.previewDir);
  if (options.debugContactDir) contactDebug(assets,options.debugContactDir);
  if ((options.previewDir || options.debugContactDir) && !options.motionPreview) return;
  const review = Boolean(options.motionPreview), output = review ? options.motionPreview : options.output;
  if (review && !path.relative(ROOT, output).startsWith('..')) throw new Error('动作预览必须输出到项目之外的临时目录。');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tuning-film-'));
  try {
    const wav = path.join(temp, 'original-score.wav'), movie = path.join(temp, 'film.mp4');
    console.log('原创音轨：', writeAudio(wav, review));
    await encode(renderer, wav, movie, review);
    const report = inspectMovie(movie, review ? 8 : DURATION);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const staging = `${output}.rendering-${process.pid}`;
    fs.copyFileSync(movie, staging); fs.renameSync(staging, output);
    if (!review) fs.writeFileSync(output.replace(/\.mp4$/i, '.zh-CN.vtt'), subtitles());
    console.log(JSON.stringify({ output, review, ...report }, null, 2));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { CAPTIONS, ROUTE, RUNS, CONTACTS, PREVIEW_TIMES, progressAt, routeAt, poseAt, viewAt, speedAt, cameraAt,
  roverRegistration, contactDebug, reviewTimeAt, writeAudio, subtitles, loadAssets, createRenderer, inspectMovie };
