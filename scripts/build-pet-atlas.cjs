'use strict';

// Mechanical extraction only: no repainting, background replacement or per-pose scaling.
// Hexo loads scripts/ too, so only build the assets on an explicit CLI invocation.
if (require.main === module) {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const {execFileSync: exec} = require('node:child_process');
  const root = path.resolve(__dirname, '..');
  const input = path.join(root, '规划/原型/assets/pet/field-notes');
  const output = path.join(root, 'source/img/pet/field-notes');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaojiang-atlas-'));
  const cell = 320;
  const frames = [];
  try {
    for (const [file, columns, rows] of [['motions-source.png', 4, 4], ['states-source.png', 2, 2], ['transitions-source.png', 4, 4]]) {
      const source = path.join(input, file);
      const [width, height] = exec('magick', ['identify', '-format', '%w %h', source], {encoding: 'utf8'}).split(' ').map(Number);
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const x = Math.round(col * width / columns), y = Math.round(row * height / rows);
        const w = Math.round((col + 1) * width / columns) - x;
        const h = Math.round((row + 1) * height / rows) - y;
        const frame = path.join(temp, `${frames.length}.png`);
        exec('magick', [source, '-crop', `${w}x${h}+${x}+${y}`, '+repage', '-resize', `${cell}x${cell}!`, frame]);
        frames.push(frame);
      }
    }
    fs.mkdirSync(output, {recursive: true});
    exec('magick', ['montage', ...frames.slice(0, 20), '-tile', '4x5', '-geometry', `${cell}x${cell}+0+0`, '-background', 'none', '-quality', '90', '-define', 'webp:alpha-quality=100', '-define', 'webp:method=6', path.join(output, 'actions.webp')]);
    exec('magick', ['montage', ...frames.slice(20), '-tile', '4x4', '-geometry', `${cell}x${cell}+0+0`, '-background', 'none', '-quality', '90', '-define', 'webp:alpha-quality=100', '-define', 'webp:method=6', path.join(output, 'transitions.webp')]);
    exec('magick', [frames[20], '-quality', '90', '-define', 'webp:alpha-quality=100', '-define', 'webp:method=6', path.join(output, 'idle.webp')]);
    console.log(`Pet atlas: 36 frames, ${cell}px cells, 4 × 5 + 4 × 4, quality 90 / alpha 100.`);
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
}
