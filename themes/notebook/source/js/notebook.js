const search = document.querySelector('#search');
if (search) {
  let category = '全部';
  const rows = [...document.querySelectorAll('[data-note]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  let textIndex = new Map();
  let indexRequest;
  const loadTextIndex = () => {
    if (indexRequest) return indexRequest;
    indexRequest = fetch('/search.xml').then(response => {
      if (!response.ok) throw new Error('Search index unavailable');
      return response.text();
    }).then(xml => {
      const documentIndex = new DOMParser().parseFromString(xml, 'application/xml');
      if (documentIndex.querySelector('parsererror')) throw new Error('Invalid search index');
      for (const entry of documentIndex.querySelectorAll('entry')) {
        const path = decodeURI(new URL(entry.querySelector('url').textContent, location.origin).pathname).replace(/index\.html$/, '');
        const content = entry.querySelector('content')?.textContent || '';
        const text = new DOMParser().parseFromString(content, 'text/html').body.textContent;
        textIndex.set(path, text.toLocaleLowerCase());
      }
      apply();
    }).catch(() => {
      const note = document.createElement('p');
      note.className = 'search-note';
      note.textContent = '正文搜索暂时不可用，仍可搜索标题、分类和技术关键词。';
      document.querySelector('.archive-controls').append(note);
    });
    return indexRequest;
  };
  const apply = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const row of rows) {
      const path = decodeURI(new URL(row.querySelector('a').href).pathname).replace(/index\.html$/, '');
      const text = row.dataset.search.toLocaleLowerCase() + ' ' + (textIndex.get(path) || '');
      row.hidden = !(category === '全部' || row.dataset.category === category) || !text.includes(query);
      if (!row.hidden) count++;
    }
    document.querySelector('#result-count').textContent = `${count} 篇记录`;
    document.querySelector('#empty-state').hidden = count !== 0;
    if (query && !indexRequest) loadTextIndex();
  };
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    apply();
  }));
  search.addEventListener('input', apply);
  search.value = new URLSearchParams(location.search).get('q') || '';
  apply();
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      event.preventDefault();
      search.focus();
    }
  });
}
const toc = document.querySelector('.toc details');
if (toc && matchMedia('(max-width: 760px)').matches) toc.open = false;
const tocNav = document.querySelector('.toc nav');
const links = [...document.querySelectorAll('.toc nav a')];
links.forEach(link => link.addEventListener('click', () => {
  if (matchMedia('(max-width: 760px)').matches) toc.open = false;
}));
const tocLinks = new Map(links.map(link => [decodeURIComponent(link.hash.slice(1)), link]));
const sections = [...document.querySelectorAll('.prose h2, .prose h3')].filter(section => tocLinks.has(section.id));
if (sections.length) {
  const updateToc = () => {
    const headerBottom = document.querySelector('.site-header').getBoundingClientRect().bottom;
    const readingLine = Math.max(headerBottom + 24, innerHeight * .35);
    let current;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= readingLine) current = tocLinks.get(section.id);
    }
    links.forEach(link => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    if (current && toc.open && matchMedia('(min-width: 761px)').matches) {
      const linkBox = current.getBoundingClientRect();
      const navBox = tocNav.getBoundingClientRect();
      if (linkBox.top < navBox.top) tocNav.scrollTop += linkBox.top - navBox.top;
      else if (linkBox.bottom > navBox.bottom) tocNav.scrollTop += linkBox.bottom - navBox.bottom;
    }
  };
  let pending = false;
  const scheduleToc = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; updateToc(); });
  };
  addEventListener('scroll', scheduleToc, {passive: true});
  addEventListener('resize', scheduleToc);
  addEventListener('load', scheduleToc);
  updateToc();
}

// Keep code readable and comments tied to the existing article pathname.
for (const figure of document.querySelectorAll('.prose figure.highlight')) {
  const button = document.createElement('button');
  button.className = 'code-copy';
  button.type = 'button';
  button.textContent = '复制';
  button.setAttribute('aria-label', '复制这段代码');
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(figure.querySelector('.code pre')?.textContent || figure.querySelector('pre').textContent);
      button.textContent = '已复制';
    } catch { button.textContent = '请选中复制'; }
    setTimeout(() => { button.textContent = '复制'; }, 2000);
  });
  figure.prepend(button);
}
const commentButton = document.querySelector('#load-comments');
if (commentButton) commentButton.addEventListener('click', () => {
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  for (const key of ['repo','repoId','category','categoryId','mapping','strict','emitMetadata','lang']) {
    const attribute = key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
    script.setAttribute('data-' + attribute, commentButton.dataset[key]);
  }
  script.setAttribute('data-theme', 'dark');
  script.setAttribute('data-input-position', 'bottom');
  script.setAttribute('data-loading', 'lazy');
  script.addEventListener('error', () => { commentButton.disabled = false; commentButton.textContent = '重新加载评论'; script.remove(); });
  commentButton.disabled = true;
  commentButton.textContent = '正在加载…';
  script.addEventListener('load', () => commentButton.remove());
  document.querySelector('#giscus-wrap').append(script);
});
