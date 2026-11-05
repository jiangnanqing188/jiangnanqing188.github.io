'use strict';

// Generated-site contract only. Run after a clean TZ=Asia/Shanghai build.
// Complements check-site.cjs and check-reading.cjs; does not replace either.
// Browser visibility, responsive layout and real interactions need separate QA.
function checkUiRedesign() {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const yaml = require('js-yaml');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'public');
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const config = yaml.load(read('_config.yml'));
  const site = new URL(config.url);
  const projects = yaml.load(read('source/_data/projects.yml'));
  const homeData = yaml.load(read('source/_data/home.yml'));
  const achievements = yaml.load(read('source/_data/achievements.yml'));
  const decode = value => String(value).replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp|#39);/gi, (_, number, name) =>
    number ? String.fromCodePoint(number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number)) :
      ({amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'"})[name.toLowerCase()]);
  const text = html => decode(html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ''));
  const compact = value => value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');
  const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
    .map(match => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4] ?? '')]));
  const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => attrs(match[0]));
  const hasClass = (attributes, name) => (attributes.class || '').split(/\s+/).includes(name);

  // Narrow HTML extraction, including nested instances of the same tag.
  // This is not a browser/DOM emulator; assertions use existing semantic hooks.
  function elements(html, name) {
    return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(open => {
      const token = new RegExp(`<\\/?${name}\\b[^>]*>`, 'gi');
      token.lastIndex = open.index + open[0].length;
      let depth = 1, close;
      while ((close = token.exec(html))) {
        depth += close[0][1] === '/' ? -1 : 1;
        if (!depth) return {attrs: attrs(open[0]), inner: html.slice(open.index + open[0].length, close.index)};
      }
      assert.fail(`Unclosed <${name}> in generated content`);
    });
  }
  const main = html => {
    const section = elements(html, 'main').find(item => item.attrs.id === 'main');
    assert.ok(section, 'Generated page must retain main#main');
    return section.inner;
  };
  const contains = (html, value, label) => assert.ok(compact(text(html)).includes(compact(String(value))), `${label}: missing ${value}`);
  const localPath = href => {
    const url = new URL(href, site);
    return url.origin === site.origin ? decodeURIComponent(url.pathname).replace(/index\.html$/, '') : null;
  };
  function fileFor(href) {
    const pathname = localPath(href);
    assert.ok(pathname, `Expected local URL: ${href}`);
    let file = path.join(output, pathname);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    assert.ok(fs.existsSync(file) && fs.statSync(file).isFile(), `Missing generated target: ${href}`);
    return file;
  }
  const page = href => fs.readFileSync(fileFor(href), 'utf8');
  const linkedPaths = html => tags(html, 'a').filter(a => a.href).map(a => localPath(a.href)).filter(Boolean);
  const sameSet = (actual, expected, label) => assert.deepEqual([...new Set(actual)].sort(), [...new Set(expected)].sort(), label);
  const postLinks = html => linkedPaths(html).filter(href => /^\/\d{4}\/\d{2}\/\d{2}\//.test(href));
  const listingLinks = html => elements(main(html), 'article').filter(item => 'data-note' in item.attrs).flatMap(item => postLinks(item.inner));
  const posts = fs.readdirSync(path.join(root, 'source/_posts')).filter(name => name.endsWith('.md')).map(name => {
    const source = read(`source/_posts/${name}`);
    const front = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    assert.ok(front, `${name}: missing front matter`);
    const data = yaml.load(front[1]);
    // Read the literal calendar date, not a host-timezone-converted Date.
    const date = front[1].match(/^date:\s*["']?(\d{4})-(\d{2})-(\d{2})/m);
    assert.ok(date, `${name}: expected existing calendar date`);
    const href = '/' + (data.permalink || config.permalink.replace(':year', date[1]).replace(':month', date[2])
      .replace(':day', date[3]).replace(':title', name.slice(0, -3))).replace(/^\//, '');
    return {...data, href, date: date.slice(1).join('-'), name};
  });
  const postPaths = posts.map(post => localPath(post.href));
  const home = page('/');
  const projectIndex = page('/projects/');
  const archive = page('/archives/');
  const about = page('/about/');
  const downloads = page('/downloads/');
  const music = page('/music/');
  const notFound = page('/404.html');
  const failures = [];
  let passed = 0;
  function check(label, run) {
    try { run(); passed++; console.log(`PASS ${label}`); }
    catch (error) { failures.push(`${label}: ${error.message}`); console.error(`FAIL ${label}: ${error.message}`); }
  }

  check('four real projects and nine reachable, searchable articles', () => {
    sameSet(projects.map(p => p.id), ['ruikang', 'pharmacy', 'yolov5', 'iscc'], 'Current real project IDs');
    assert.equal(projects.length, 4, 'Do not duplicate project records');
    assert.equal(posts.length, 9, 'Current nine source articles');
    sameSet(linkedPaths(main(projectIndex)).filter(href => /^\/projects\/[^/]+\/$/.test(href)), projects.map(p => `/projects/${p.id}/`), 'Project index destinations');
    sameSet(listingLinks(archive), postPaths, 'Archive must expose all nine article destinations');
    for (const post of posts) {
      const html = page(post.href);
      contains(elements(main(html), 'h1')[0]?.inner || '', post.title, `${post.name} heading`);
      assert.ok(tags(main(html), 'time').some(a => a.datetime === post.date), `${post.name}: original calendar date`);
    }
  });

  check('homepage identity, responsibility, team result and project entry', () => {
    const body = main(home);
    for (const word of ['江南', '长江大学', '计算机科学与技术', '大三', 'ROS', 'AI']) contains(body, word, 'Homepage identity');
    contains(body, homeData.identity.find(item => item.code === 'ROLE').value, 'Homepage responsibility');
    for (const word of ['团队', '一等奖', '94']) contains(body, word, 'Homepage team result');
    for (const href of ['/projects/', '/about/', '/archives/']) assert.ok(linkedPaths(body).includes(href), `Homepage entry missing: ${href}`);
  });

  check('native click-to-play hero video and project-only concept art, no pretend controls', () => {
    const poster = '/img/workshop/tuning-film-poster.webp';
    const blueprint = '/img/workshop/ruikang-blueprint.webp';
    const body = main(home);
    const videos = elements(home, 'video');
    assert.equal(videos.length, 1, 'Homepage must contain exactly one real video');
    const hero = elements(body, 'figure').find(item => hasClass(item.attrs, 'hero-visual'));
    assert.ok(hero && elements(hero.inner, 'video').length === 1, 'Video must stay inside the homepage hero');
    const video = videos[0];
    assert.equal(video.attrs.poster, poster, 'Use the actual laptop-film frame poster, not the old desktop illustration');
    for (const name of ['controls', 'playsinline']) assert.ok(name in video.attrs, `Native video requires ${name}`);
    for (const name of ['autoplay', 'loop']) assert.ok(!(name in video.attrs), `Video must not ${name}`);
    assert.equal(video.attrs.preload, 'none', 'Do not download video before user interaction');
    assert.equal(video.attrs['aria-label'], '播放机器人调试日常短片', 'Video needs the neutral accessible label');
    const caption = elements(hero.inner, 'figcaption').find(item => item.attrs.id && (video.attrs['aria-describedby'] || '').split(/\s+/).includes(item.attrs.id));
    assert.ok(caption, 'Video must reference its figcaption');
    assert.equal(text(elements(caption.inner, 'strong')[0]?.inner || '').trim(), '工位日常', 'Use the neutral hero caption');
    contains(caption.inner, '75秒无对白概念短片 · 非比赛实录', 'Dialogue-free concept film disclosure');
    assert.ok(!/小胖子调车/.test(text(hero.inner) + video.attrs['aria-label']), 'Do not retain the old literal film title');
    assert.ok(!/筹备中/.test(text(hero.inner)), 'Completed animation must not be marked in preparation');
    assert.ok(!('src' in video.attrs), 'Use the single typed local MP4 source');
    const sources = tags(video.inner, 'source');
    assert.equal(sources.length, 1, 'Video must have exactly one MP4 source');
    assert.equal(sources[0].src, '/media/tuning-workshop.mp4');
    assert.equal(sources[0].type, 'video/mp4');
    const tracks = tags(video.inner, 'track');
    assert.equal(tracks.length, 1, 'Video must have one Chinese caption track');
    assert.equal(tracks[0].src, '/media/tuning-workshop.zh-CN.vtt');
    assert.equal(tracks[0].kind, 'captions');
    assert.equal(tracks[0].srclang, 'zh-CN');
    assert.equal(tracks[0].label, '声音说明', 'Optional captions describe non-dialogue sounds');
    assert.ok(!('default' in tracks[0]), 'Sound descriptions must stay off by default to leave the dialogue-free picture unobstructed');
    assert.ok(tags(video.inner, 'a').some(a => a.href === sources[0].src && 'download' in a && !a.target), 'Native fallback must offer a local MP4 download, not a new window');
    contains(video.inner, '下载短片 MP4', 'Neutral download fallback');
    fileFor(poster); fileFor(blueprint); fileFor(sources[0].src); fileFor(tracks[0].src);
    assert.ok(!/<(?:audio|iframe|object|embed|progress)\b|role\s*=\s*["'](?:progressbar|slider)["']/i.test(body), 'No external player or fake progress/slider on homepage');
    assert.ok(!tags(body, '(?:button|a|input)').some(a => /播放|暂停|音量|全屏|\bplay\b|\bpause\b|\bvolume\b|\bfullscreen\b|\brange\b/i.test(`${a['aria-label'] || ''} ${a.title || ''} ${a.class || ''} ${a.type || ''}`)), 'No empty player controls');
    assert.ok(!elements(body, '(?:button|a)').some(item => /^(?:[▶►⏵]|播放|暂停|音量|全屏)/.test(text(item.inner).trim())), 'No placeholder playback action');
    assert.ok(!/\b\d{1,2}:\d{2}\s*[/／]\s*\d{1,2}:\d{2}\b/.test(text(body)), 'No invented playback duration');
    for (const html of [home, projectIndex, page('/projects/ruikang/')]) {
      assert.ok(tags(main(html), 'img').some(a => a.src === blueprint), 'RuiKang project exhibition must use its separate concept illustration');
      contains(main(html), '概念', 'Project art disclosure');
    }
    const files = [];
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name.endsWith('.html')) files.push(file);
      }
    }
    walk(output);
    for (const file of files) {
      const html = fs.readFileSync(file, 'utf8');
      if (!html.includes(blueprint)) continue;
      const relative = path.relative(output, file).split(path.sep).join('/');
      assert.ok(['index.html', 'projects/index.html', 'projects/ruikang/index.html'].includes(relative), `${relative}: blueprint leaked outside project exhibition`);
      assert.ok(!tags(html, 'meta').some(a => ['og:image', 'twitter:image'].includes(a.property || a.name) && (a.content || '').includes(blueprint)), `${relative}: concept exhibition must not replace share image`);
    }
  });

  check('full article text, original images, reproduction facts and AI boundary', () => {
    const xml = read('public/search.xml');
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(match => {
      const get = name => match[1].match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1] || '';
      return {href: localPath(decode(get('url'))), content: get('content').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')};
    });
    assert.equal(entries.length, 9, 'Full-text index must retain exactly nine real entries');
    sameSet(entries.map(entry => entry.href), postPaths, 'Search URLs must retain source permanent links');
    for (const post of posts) {
      const html = page(post.href);
      const prose = elements(main(html), 'article').find(item => hasClass(item.attrs, 'prose'))?.inner;
      assert.ok(prose, `${post.name}: full reading body missing`);
      const entry = entries.find(item => item.href === localPath(post.href));
      assert.ok(entry.content.trim(), `${post.name}: full-text index content missing`);
      const rendered = compact(text(prose));
      // The independent search generator renders source Markdown in full. Compare
      // every substantive rendered line, ignoring only whitespace/punctuation,
      // so table wrappers, highlighting and TOC links do not pin the new layout.
      const lines = entry.content.split(/\r?\n/).map(line => compact(text(line))).filter(line => line.length >= 4);
      assert.ok(lines.length, `${post.name}: no full-text comparison material`);
      for (const line of lines) assert.ok(rendered.includes(line), `${post.name}: full source text lost/replaced: ${line.slice(0, 100)}`);
      const articleImages = tags(prose, 'img').map(a => a.src);
      for (const image of tags(entry.content, 'img')) assert.ok(articleImages.includes(image.src), `${post.name}: original evidence image missing: ${image.src}`);
      if (post.repro) {
        const repro = elements(prose, 'aside').find(item => hasClass(item.attrs, 'lab-repro'))?.inner;
        assert.ok(repro, `${post.name}: reproduction boundary missing`);
        for (const key of ['environment', 'target', 'last_verified', 'evidence']) if (post.repro[key]) contains(repro, post.repro[key], `${post.name} repro.${key}`);
      }
      if (post.project_id) {
        const project = projects.find(item => item.id === post.project_id);
        for (const value of [project.team, project.boundary]) contains(prose, value, `${post.name} project boundary`);
      }
      if (/AI\s*负责/.test(text(entry.content))) contains(prose, 'AI 负责', `${post.name} AI responsibility boundary`);
    }
  });

  check('source-grounded responsibilities, three-person teams and team awards', () => {
    for (const project of projects) {
      const body = main(page(`/projects/${project.id}/`));
      assert.match(project.team, /^3\s*人团队(?:\s*·.*)?$/, `${project.id}: confirmed three-person team size`);
      for (const value of [project.period, project.team, project.role, project.result, project.boundary, ...project.responsibilities]) contains(body, value, `${project.id} facts`);
    }
    assert.match(projects.find(p => p.id === 'pharmacy').result, /智慧药房三等奖/, 'Pharmacy award must not be upgraded');
    assert.match(projects.find(p => p.id === 'yolov5').result, /智慧农业一等奖/, 'Agriculture award must remain first prize');
    for (const award of achievements) for (const key of ['event', 'project', 'result']) contains(main(about), award[key], `About ${award.id}`);
    contains(main(about), '团队', 'Awards remain team results');
  });

  check('about retains existing avatar and only the approved public email', () => {
    const body = main(about);
    const images = tags(body, 'img');
    assert.ok(images.length && images.every(a => a.src === '/img/avatar.jpg'), 'About must retain the existing avatar, not introduce a portrait');
    const email = 'jiangnanqingwqw@163.com';
    const mails = tags(body, 'a').filter(a => a.href?.startsWith('mailto:')).map(a => a.href.slice(7));
    assert.ok(mails.length, 'Approved contact email must be usable');
    sameSet(mails, [email], 'No additional public contact email');
    sameSet(text(body).match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [], [email], 'No extra email in visible copy');
    assert.ok(!tags(body, 'a').some(a => /^(?:tel:|weixin:|mqq:)|wpa\.qq\.com/i.test(a.href || '')), 'No unapproved phone/QQ/WeChat contact entry');
    assert.ok(!/简历下载|下载简历|微信号|QQ\s*[:：]/i.test(text(body)), 'No unapproved resume/contact expansion');
  });

  check('five genuine resources and the existing QQ playlist only', () => {
    const artifacts = posts.flatMap(post => (post.repro?.artifacts || []).map(item => ({...item, post})));
    assert.equal(artifacts.length, 5, 'Five actual source-registered resources');
    const local = artifacts.filter(item => !/^https?:/.test(item.href));
    sameSet(local.map(item => item.href), ['/downloads/train.py', '/downloads/val.py', '/downloads/mydata.yaml', '/downloads/mydata_yolov5s.yaml'], 'Four real local resources');
    sameSet(artifacts.filter(item => /^https?:/.test(item.href)).map(item => item.href), ['https://github.com/jiangnanqing188/roscar-work-loop'], 'Existing external workflow repository only');
    const body = main(downloads);
    const cards = elements(body, '(?:article|a)').filter(item => hasClass(item.attrs, 'lab-resources__card'));
    assert.equal(cards.length, 5, 'Exactly five genuine resource entries');
    for (const artifact of artifacts) {
      const card = cards.find(item => compact(text(item.inner)).includes(compact(artifact.label)));
      assert.ok(card, `${artifact.label}: labelled resource entry missing`);
      assert.ok([card.attrs, ...tags(card.inner, 'a')].some(a => a.href === artifact.href), `${artifact.label}: real resource action missing`);
      contains(card.inner, artifact.post.title, `${artifact.label} source attribution`);
      assert.ok(linkedPaths(card.inner).includes(localPath(artifact.post.href)), `${artifact.label}: source article link missing`);
      if (local.includes(artifact)) assert.ok(fs.readFileSync(fileFor(artifact.href)).equals(fs.readFileSync(path.join(root, 'source', artifact.href))), `${artifact.label}: downloaded bytes differ from source`);
    }
    sameSet(tags(body, 'a').filter(a => 'download' in a || /^\/downloads\/.+/.test(a.href || '')).map(a => a.href), local.map(item => item.href), 'No extra or fake download destination');
    assert.ok(!elements(body, '(?:a|button)').some(a => /下载|download/i.test(text(a.inner)) && (!a.attrs.href || a.attrs.href === '#')), 'No placeholder download controls');
    const playlist = 'https://y.qq.com/n/ryqq/playlist/9545516252';
    const musicBody = main(music);
    assert.ok(tags(musicBody, 'a').some(a => a.href === playlist), 'Existing QQ playlist must remain usable');
    sameSet(tags(musicBody, 'a').filter(a => /^https?:/.test(a.href || '')).map(a => a.href), [playlist], 'No invented music links');
    assert.ok(!/<(?:audio|video|iframe)\b|role\s*=\s*["'](?:slider|progressbar)["']|\.(?:mp3|mp4|ogg|wav)\b/i.test(musicBody), 'No fabricated audio/video player');
    assert.equal(tags(musicBody, 'button').length, 0, 'No nonfunctional music controls');
  });

  check('actual taxonomies, reachable 404 exits and retained shared UI/SEO', () => {
    for (const [kind, field] of [['categories', 'categories'], ['tags', 'tags']]) {
      const values = [...new Set(posts.flatMap(post => post[field] || []))];
      const links = elements(main(page(`/${kind}/`)), 'a').filter(a => localPath(a.attrs.href || '/')?.startsWith(`/${kind}/`) && localPath(a.attrs.href || '/') !== `/${kind}/`);
      const items = links.map(a => ({name: text(elements(a.inner, 'h2')[0]?.inner || ''), href: a.attrs.href}));
      sameSet(items.map(item => item.name), values, `${kind}: only actual source taxonomy names`);
      assert.equal(items.length, values.length, `${kind}: no duplicated or fabricated taxonomy entries`);
      for (const item of items) sameSet(listingLinks(page(item.href)), posts.filter(post => (post[field] || []).includes(item.name)).map(post => localPath(post.href)), `${kind}/${item.name}: real article membership`);
    }
    sameSet(tags(main(archive), 'button').filter(a => 'data-filter' in a).map(a => a['data-filter']), ['全部', ...posts.flatMap(post => post.categories || [])], 'Archive filters follow actual category set');
    for (const href of ['/', '/projects/', '/archives/']) assert.ok(linkedPaths(main(notFound)).includes(href), `404 exit missing: ${href}`);
    assert.ok(tags(main(notFound), 'a').some(a => a.href === '/archives/#search'), '404 must link to the real article search');
    const pages = [home, projectIndex, archive, about, downloads, music, notFound, ...projects.map(p => page(`/projects/${p.id}/`)), ...posts.map(p => page(p.href))];
    for (const html of pages) {
      assert.ok(tags(html, 'button').some(a => 'data-theme-toggle' in a), 'Existing theme-toggle DOM retained');
      assert.ok(/localStorage\.getItem\(\s*(['"])lab-theme\1\s*\)/.test(html), 'Existing theme persistence bootstrap retained');
      assert.equal(tags(html, 'aside').filter(a => a.id === 'blog-pet').length, 1, 'Exactly one existing pet');
      assert.ok(tags(html, 'button').some(a => hasClass(a, 'pet-restore')), 'Pet restore control retained');
      assert.ok(tags(html, 'div').some(a => a.id === 'pet-menu'), 'Pet interaction menu retained');
      for (const src of ['/js/notebook.js', '/js/pet.js', '/js/giscus-manager.js']) assert.ok(tags(html, 'script').some(a => a.src === src), `Existing behavior asset missing: ${src}`);
      assert.ok(tags(html, 'a').some(a => a.href === '#main'), 'Skip-to-content link retained');
    }
    for (const html of [home, projectIndex, ...posts.map(post => page(post.href))]) assert.ok(tags(html, 'script').some(a => a.type === 'application/ld+json'), 'Existing structured data retained');
  });

  check('reset-search and shared responsive-disclosure event regression (VM, not browser)', () => {
    const vm = require('node:vm');
    const eventTarget = extra => ({...extra, events: {}, attributes: {},
      addEventListener(type, callback) { this.events[type] = callback; },
      setAttribute(key, value) { this.attributes[key] = value; }});
    const search = eventTarget({value: '', focus() { this.focused = true; }});
    const reset = eventTarget({});
    const rows = ['alpha', 'beta'].map((word, index) => ({
      dataset: {search: word, category: String(index)},
      querySelector: () => ({href: new URL(posts[index].href, site).href})
    }));
    const filters = ['全部', '0', '1'].map(filter => eventTarget({dataset: {filter}}));
    const disclosures = ['article', 'project', 'about'].map(() => {
      const link = eventTarget({});
      return {open: true, link, querySelectorAll: () => [link]};
    });
    const count = {}, empty = {};
    let mobile = false, mediaChange, replacedUrl, fetches = 0;
    const selectors = new Map([['#search', search], ['[data-reset-search]', reset], ['#result-count', count], ['#empty-state', empty]]);
    vm.runInNewContext(read('public/js/notebook.js'), {
      document: {
        querySelector: selector => selectors.get(selector) || null,
        querySelectorAll: selector => ({'[data-note]': rows, '[data-filter]': filters, '[data-responsive-details]': disclosures})[selector] || [],
        addEventListener() {}
      },
      matchMedia: () => ({get matches() { return mobile; }, addEventListener(type, callback) { mediaChange = callback; }}),
      location: {href: new URL('/archives/?q=&keep=yes#search', site).href, search: '?q=&keep=yes', origin: site.origin},
      history: {replaceState(state, title, url) { replacedUrl = new URL(url); }},
      URL, URLSearchParams, fetch() { fetches++; return new Promise(() => {}); }
    });
    assert.ok(disclosures.every(item => item.open), 'Desktop disclosure starts open');
    mobile = true; mediaChange();
    assert.ok(disclosures.every(item => !item.open), 'Mobile breakpoint closes all three navigation contexts');
    for (const item of disclosures) { item.open = true; item.link.events.click(); assert.equal(item.open, false, 'Mobile link selection closes its disclosure'); }
    mobile = false; mediaChange();
    for (const item of disclosures) { item.link.events.click(); assert.equal(item.open, true, 'Desktop link selection leaves navigation open'); }
    filters[2].events.click();
    assert.equal(rows[0].hidden, true); assert.equal(rows[1].hidden, false);
    search.value = 'no-matching-note'; search.events.input();
    assert.ok(rows.every(item => item.hidden), 'No results hide normal cards');
    assert.equal(empty.hidden, false, 'No results expose empty state');
    assert.equal(fetches, 1, 'Full-text index loads only on nonempty search');
    reset.events.click();
    assert.equal(search.value, '');
    assert.ok(rows.every(item => !item.hidden), 'Reset restores all categories and cards');
    assert.equal(count.textContent, '2 篇记录'); assert.equal(empty.hidden, true);
    assert.deepEqual(filters.map(item => item.attributes['aria-pressed']), ['true', 'false', 'false']);
    assert.ok(search.focused, 'Reset returns focus to search');
    assert.equal(replacedUrl.searchParams.has('q'), false);
    assert.equal(replacedUrl.searchParams.get('keep'), 'yes'); assert.equal(replacedUrl.hash, '#search');
  });

  assert.equal(failures.length, 0, `${failures.length} UI contract group(s) failed:\n${failures.join('\n')}`);
  console.log(`UI redesign contract passed: ${passed} groups, ${projects.length} projects, ${posts.length} full articles, five resources. Browser QA remains separate.`);
}

// Hexo loads scripts/ during generation: imports must never run CLI assertions.
if (require.main === module) checkUiRedesign();
