'use strict';

function checkSite() {
  // Check the generated website, including real links and share metadata.
  const fs = require('fs');
  const path = require('path');
  const assert = require('node:assert/strict');
  const yaml = require('js-yaml');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'public');
  const config = yaml.load(fs.readFileSync(path.join(root, '_config.yml'), 'utf8'));
  const site = new URL(config.url);
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith('.html')) files.push(file);
    }
  }
  assert.ok(fs.existsSync(output), 'Run npm run build first.');
  walk(output);
  let checkedPages = 0, checkedLinks = 0;
  const unescape = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
  const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(match => [match[1], unescape(match[3])]));
  const documents = new Map(files.map(file => [file, fs.readFileSync(file, 'utf8')]));
  function checkReference(value, file) {
    const pageUrl = new URL(path.relative(output, file).split(path.sep).join('/'), site);
    const url = new URL(value, pageUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== site.origin) return;
    assert.ok(!decodeURIComponent(url.pathname).includes('/规划/原型/'), `${file}: preview link ${value}`);
    let target = path.join(output, decodeURIComponent(url.pathname));
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    assert.ok(fs.existsSync(target), `${path.relative(output,file)}: missing ${value}`);
    if (url.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      const ids = [...(documents.get(target) || '').matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)].map(match => unescape(match[2]));
      assert.ok(ids.includes(id), `${path.relative(output,file)}: missing anchor ${value}`);
    }
    checkedLinks++;
  }
  for (const [file, html] of documents) {
    if (/<meta\s+http-equiv=["']refresh/i.test(html)) continue; // Existing legacy redirects.
    const relative = path.relative(output, file);
    const ids = [...html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)].map(match => unescape(match[2]));
    assert.equal(new Set(ids).size, ids.length, `${relative}: duplicate IDs`);
    assert.equal(ids.filter(id => id === 'blog-pet').length, 1, `${relative}: pet missing or repeated`);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${relative}: expected one main heading`);
    const tags = html.match(/<[a-zA-Z][^>]*>/g) || [];
    const meta = Object.fromEntries(tags.filter(tag => /^<meta\b/.test(tag)).map(tag => { const a=attrs(tag);return [a.name || a.property,a.content]; }));
    for (const key of ['description','og:title','og:description','og:url','og:image']) assert.ok(meta[key], `${relative}: missing ${key}`);
    const canonical = tags.find(tag => /^<link\b/.test(tag) && attrs(tag).rel === 'canonical');
    assert.ok(canonical && attrs(canonical).href.startsWith(config.url), `${relative}: canonical missing or wrong host`);
    checkReference(meta['og:image'], file);
    for (const tag of tags) {
      const a=attrs(tag);
      for (const key of ['href','src']) if (a[key]) checkReference(a[key], file);
    }
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(match[1]);
    checkedPages++;
  }
  const achievements = yaml.load(fs.readFileSync(path.join(root, 'source/_data/achievements.yml'), 'utf8'));
  const about = fs.readFileSync(path.join(output, 'about/index.html'), 'utf8');
  assert.equal((about.match(/class="award"/g) || []).length, achievements.length, 'About page must render every team achievement.');
  assert.ok(fs.existsSync(path.join(output, 'search.xml')), 'Search index is missing.');
  assert.ok(fs.existsSync(path.join(output, 'sitemap.xml')), 'Sitemap is missing.');
  assert.ok(fs.existsSync(path.join(output, 'robots.txt')), 'Robots file is missing.');
  console.log(`Checked ${checkedPages} pages and ${checkedLinks} local references; metadata, headings, pet, anchors and discovery files passed.`);
}

// Hexo loads files in scripts/; run this check only as the explicit CLI.
if (require.main === module) checkSite();
