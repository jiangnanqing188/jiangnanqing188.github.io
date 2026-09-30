const search = document.querySelector('#search');
if (search) {
  let category = '全部';
  const rows = [...document.querySelectorAll('[data-note]')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const apply = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const row of rows) {
      row.hidden = !(category === '全部' || row.dataset.category === category) || !row.dataset.search.toLocaleLowerCase().includes(query);
      if (!row.hidden) count++;
    }
    document.querySelector('#result-count').textContent = `${count} 篇记录`;
    document.querySelector('#empty-state').hidden = count !== 0;
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
const sections = [...document.querySelectorAll('.prose h2, .prose h3')];
if (sections.length) {
  const links = [...document.querySelectorAll('.toc nav a')];
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting);
    if (!visible.length) return;
    const id = visible[0].target.id;
    links.forEach(link => {
      if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, {rootMargin: '-80px 0px -65% 0px'});
  sections.forEach(section => observer.observe(section));
}
