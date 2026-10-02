// Hexo loads scripts/ during generation; run this regression only as an explicit CLI.
if (require.main === module) {
  const assert = require('node:assert/strict');
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const code = fs.readFileSync(path.join(__dirname, '../themes/notebook/source/js/notebook.js'), 'utf8');
  const links = ['方案总览', '第二章：实车验证'].map(id => ({
    hash: '#' + encodeURIComponent(id), attributes: {}, events: {},
    addEventListener(type, callback) { this.events[type] = callback; },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; }
  }));
  const sections = [{id: 'lab-repro-title', top: 60}, {id: '方案总览', top: 200}, {id: '第二章：实车验证', top: 1200}];
  sections.forEach(section => { section.getBoundingClientRect = () => ({top: section.top}); });
  const toc = {open: true};
  const nav = {scrollTop: 0, getBoundingClientRect: () => ({top: 100, bottom: 400})};
  links.forEach((link, index) => { link.getBoundingClientRect = () => ({top: 100 + index * 600 - nav.scrollTop, bottom: 120 + index * 600 - nav.scrollTop}); });
  let desktop = true;
  const events = {};
  let frame, observer;
  vm.runInNewContext(code, {
    document: {
      querySelector(selector) {
        if (selector === '.toc details') return toc;
        if (selector === '.toc nav') return nav;
        if (selector === '.site-header') return {getBoundingClientRect: () => ({bottom: 82})};
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '.prose h2, .prose h3') return sections;
        if (selector === '.toc nav a') return links;
        return [];
      }
    },
    innerHeight: 720,
    matchMedia: query => ({matches: query.includes('min-width') ? desktop : !desktop}),
    addEventListener(type, callback) { events[type] = callback; },
    requestAnimationFrame(callback) { frame = callback; },
    IntersectionObserver: class { constructor(callback) { observer = callback; } observe() {} }
  });
  // Also reproduce the previous observer path so this fixture fails before the fix.
  if (observer) observer([{target: sections[1], isIntersecting: true}]);
  const current = () => links.find(link => link.attributes['aria-current'] === 'location');
  const scroll = () => { events.scroll?.(); if (frame) { const callback = frame; frame = null; callback(); } };
  assert.equal(current(), links[0], 'Chinese anchor must match the active heading; injected headings must be ignored.');
  sections[1].top = -800;
  sections[2].top = 180;
  scroll();
  assert.equal(current(), links[1], 'Scrolling down must activate the next chapter.');
  assert.equal(nav.scrollTop, 320, 'A long desktop TOC must reveal the active chapter inside its own scrolling area.');
  sections[1].top = 200;
  sections[2].top = 1200;
  scroll();
  assert.equal(current(), links[0], 'Scrolling up must restore the previous chapter.');
  assert.equal(nav.scrollTop, 0, 'Scrolling up must also reveal the earlier TOC entry.');
  desktop = false;
  sections[1].top = -800;
  sections[2].top = 180;
  scroll();
  assert.equal(nav.scrollTop, 0, 'Mobile TOC must not be scrolled automatically.');
  toc.open = true;
  links[1].events.click();
  assert.equal(toc.open, false, 'Mobile chapter selection must collapse the sticky TOC.');
  desktop = true;
  toc.open = true;
  links[0].events.click();
  assert.equal(toc.open, true, 'Desktop chapter selection must keep the TOC expanded.');
  toc.open = false;
  scroll();
  assert.equal(nav.scrollTop, 0, 'Collapsed TOC must not be scrolled automatically.');
  sections[1].top = 900;
  sections[2].top = 1200;
  scroll();
  assert.equal(current(), undefined, 'No chapter should be active above the article body.');
  console.log('Reading regression passed: encoded Chinese anchors, downward/upward scrolling, injected headings, initial article position and desktop TOC visibility.');
}
