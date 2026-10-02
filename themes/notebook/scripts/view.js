"use strict";

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const array = value => value?.toArray ? value.toArray() : Array.isArray(value) ? value : [];
const names = value => array(value).map(item => item.name || item);
const covers = new Map(['pharmacy-robots','ruikang-competition','yolov5-vision','iscc-plc','ai-robot-tuning'].map(id => [`/img/covers/${id}.${id === 'iscc-plc' ? 'png' : 'webp'}`, `/img/covers/notebook/${id}.webp`]));
const asset = src => covers.get(src) || src || '/img/avatar.jpg';
const concept = src => asset(src).startsWith('/img/covers/notebook/');
const heading = (label, title, sub = '') => `<header class="page-heading"><span class="eyebrow">${esc(label)}</span><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</header>`;
const tag = text => `<span class="tag">${esc(text)}</span>`;
const postUrl = post => post?.url || '/archives/';
const projectUrl = project => `/projects/${project.id}/`;
const shell = (title, active, content) => content;
const active = page => page.__post || page.archive || page.category || page.tag || String(page.path).startsWith('archives/') ? '文章' : String(page.path).startsWith('projects/') ? '项目' : String(page.path).startsWith('about/') ? '关于' : page.path === 'index.html' ? '首页' : '';
const normalize = post => ({source: post, title: post.title, description: post.description || String(post.content || '').replace(/<[^>]*>/g,'').slice(0,130), cover: asset(post.cover), project_id: post.project_id, id: post.log_id || '', url: '/' + post.path.replace(/index\.html$/, ''), content: post.content || '', date: post.date.format('YYYY-MM-DD'), tags: names(post.tags), category: names(post.categories)[0] || '记录'});

hexo.extend.filter.register('before_post_render', data => {
  data.cover = asset(data.cover);
  return data;
});
hexo.extend.helper.register('notebook_active', active);
hexo.extend.helper.register('notebook_head', function(page) {
  const title = page.tag ? `标签：${page.tag}` : page.category ? `分类：${page.category}` : page.archive ? '文章' : page.title || this.config.title;
  const description = page.description || this.config.description;
  const canonical = new URL(String(page.path || '').replace(/index\.html$/, ''), this.config.url).href;
  const image = new URL(asset(page.cover || '/img/covers/ruikang-competition.webp'), this.config.url).href;
  const titleText = page.path === 'index.html' ? this.config.title : `${title} · ${this.config.title}`;
  return `<title>${esc(titleText)}</title><meta name="description" content="${esc(description)}"><meta name="keywords" content="${esc(names(page.tags).join(', ') || array(this.config.keywords).join(', '))}"><meta name="author" content="${esc(this.config.author)}"><meta name="generator" content="Hexo ${hexo.version}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="${page.__post ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:site_name" content="${esc(this.config.title)}"><meta property="og:locale" content="zh_CN"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">${page.__post ? `<meta property="article:published_time" content="${page.date.toISOString()}"><meta property="article:modified_time" content="${page.updated.toISOString()}">` : ''}`;
});
hexo.extend.generator.register('notebook-projects', locals => array(locals.data.projects).map(project => ({path:`projects/${project.id}/index.html`,layout:'project',data:{title:project.title,description:project.summary,cover:asset(project.cover),notebook_project:project}})));
hexo.extend.generator.register('notebook-404', () => ({path:'404.html',layout:'404',data:{title:'页面未找到',notebook_404:true}}));

hexo.extend.helper.register('notebook_view', function(page) {
  const projects = array(this.site.data.projects);
  const home = this.site.data.home || {};
  const identity = array(home.identity);
  const representative = projects.find(project => project.id === 'ruikang');
  const achievements = array(this.site.data.achievements);
  const posts = array(this.site.posts.sort('date', -1)).map(normalize);
  const categories = [...new Set(posts.map(p=>p.category))];
  const featured = posts.find(p=>p.id==='008') || posts[0];
  const homeRecent = posts.slice(0,4);
  const homeDesktopRecent = posts.filter(post => post !== featured).slice(0,4);
  const homeNotes = [...new Set([...homeRecent, ...homeDesktopRecent])].map(post => {
    const visibility = !homeDesktopRecent.includes(post) ? ' home-featured-repeat' : !homeRecent.includes(post) ? ' home-extra-note' : '';
    return postCard(post).replace('class="post-card"', `class="post-card${visibility}"`);
  }).join('');
  const repro = post => this.notebook_repro(post);
  const entryFacts = post => `<div class="entry-facts">${[['日志状态',post.log_status],['运行系统',post.log_system],['关注问题',post.log_focus]].filter(([,value])=>value).map(([label,value])=>`<span><small>${esc(label)}</small>${esc(({completed:'已完成',pending:'待验证',verified:'已复现',archived:'已归档',ongoing:'记录中'})[value] || value)}</span>`).join('')}</div>`;
  const comments = post => {
    const g = this.theme.giscus;
    if (post.comments === false || !g?.repo) return '';
    return `<section id="post-comment" class="comments-section"><div class="comment-head"><h2 class="comment-headline">交流与评论</h2></div><div id="giscus-wrap"><button class="button" id="load-comments" type="button" ${Object.entries(g).map(([key,value])=>`data-${key.replaceAll('_','-')}="${esc(value)}"`).join(' ')}>加载评论</button></div><p class="muted comment-note">使用 GitHub 账号参与讨论。</p></section>`;
  };
function noteRow(p, base = '', filter = false) {
  return `<article class="note-row" ${filter ? `data-note data-category="${esc(p.category)}" data-search="${esc(p.title+' '+p.description+' '+(p.tags||[]).join(' '))}"` : ''}><div class="note-date"><time datetime="${p.date}">${p.date.replaceAll('-','.')}</time><span>LOG ${p.id}</span></div><div><span class="category">${esc(p.category)}</span><h3><a href="${postUrl(p,base)}">${esc(p.title)}</a></h3><p>${esc(p.description)}</p></div><a class="row-arrow" href="${postUrl(p,base)}" aria-label="阅读${esc(p.title)}">↗</a></article>`;
}
function postCard(p, base = '', filter = false) {
  return `<article class="post-card" ${filter ? `data-note data-category="${esc(p.category)}" data-search="${esc(p.title+' '+p.description+' '+(p.tags||[]).join(' '))}"` : ''}>
    <a class="post-card-cover" href="${postUrl(p,base)}"><img src="${asset(p.cover,base)}" alt="${esc(p.title)}${concept(p.cover) ? "封面，AI 概念插画" : "封面"}" width="1200" height="675" loading="lazy"><span class="image-tag">${esc(p.category)}</span></a>
    <div class="post-card-body"><div class="card-meta"><time datetime="${p.date}">${p.date.replaceAll('-','.')}</time><span>LOG ${p.id}</span></div><h3><a href="${postUrl(p,base)}">${esc(p.title)}</a></h3><p>${esc(p.description)}</p><div class="card-bottom"><span>${esc((p.tags||[]).slice(0,2).join(' / '))}</span><a href="${postUrl(p,base)}" aria-label="阅读${esc(p.title)}">阅读全文 ↗</a></div></div>
  </article>`;
}
function profileCard(base = '') {
  return `<section class="profile-card"><div class="profile-grid" aria-hidden="true"></div><img class="profile-avatar" src="${asset('/img/avatar.jpg',base)}" width="80" height="80" alt="江南的头像"><h2>江南</h2><span class="profile-caption">长江大学 · 计算机科学与技术</span><p>在 ROS、视觉与 AI 的交汇处，<br>把想法调成能运行的系统。</p><div class="profile-stats"><a href="${base}/archives/"><strong>${posts.length}</strong><span>篇技术记录</span></a><a href="${base}/projects/"><strong>${projects.length}</strong><span>个项目档案</span></a></div><a class="button button-wide" href="${base}/about/">关于我与联系方式 ↗</a></section>`;
}

  const renderHome = () => shell('首页','首页',`
<section class="lab-hero">
  <div class="hero-copy">
    <span class="eyebrow"><i class="status-dot"></i> JIANGNAN / ROBOTICS NOTEBOOK</span>
    <p class="hero-identity desktop-only">${esc(identity.find(item => item.code === 'EDU')?.value)}</p>
    <h1>${esc(home.title?.[0] || "把机器人调通，")}<br><span>${esc(home.title?.[1] || "也把过程写清楚。")}</span></h1>
    <p>你好，我是江南。${esc(home.lead)}</p>
    <div class="hero-role desktop-only"><span>项目职责</span><strong>${esc(identity.find(item => item.code === 'ROLE')?.value)}</strong></div>
    <div class="hero-actions"><a class="button" href="/projects/">探索项目 <span>↗</span></a><a class="secondary-button" href="/archives/">阅读技术记录 →</a></div>
    <div class="hero-topics">${['ROS / 导航','CV / 视觉','AI / 工程'].map(tag).join('')}</div>
  </div>
  <a class="hero-visual" href="${projectUrl(representative)}" aria-label="查看睿抗智能侦察车项目">
    <img src="${asset(representative.cover)}" alt="睿抗智能侦察车项目封面，AI 概念插画" width="1200" height="675">
    <div class="hero-visual-top"><span>${esc(representative.code)}</span><span>睿抗 · 智能侦察车</span></div>
    <div class="hero-visual-bottom">
      <div class="hero-result desktop-only"><span>代表项目 · 团队成果</span><p>${esc(representative.result).replaceAll('一等奖', '<em>一等奖</em>').replaceAll('94 分', '<em>94 分</em>')}</p><b>查看项目职责与复盘 <span>↗</span></b></div>
      <small>从系统迁移到正式赛场 · AI 概念封面</small>
      <strong class="hero-motto">做选择，也留下依据。 <span>↗</span></strong>
      <div class="hero-route"><span>定义问题</span><span>选择方案</span><span>实车验证</span></div>
    </div>
  </a>
</section>
<div class="home-layout"><div><div class="section-title"><div><span class="eyebrow">FEATURED NOTE</span><h2>值得展开的一次复盘</h2></div><span class="section-index">01</span></div><article class="feature-note"><div class="feature-number desktop-only" aria-hidden="true"><span>FIELD NOTE</span><strong>${esc(featured.id)}</strong><span>一次工程取舍</span></div><a class="cover" href="${postUrl(featured)}"><img src="${asset(featured.cover)}" width="1200" height="675" alt="睿抗智能侦察车文章封面"><span class="image-tag">比赛复盘</span></a><div class="feature-copy"><div class="feature-meta"><span class="category">实车证据与最终取舍</span><time>${featured.date.replaceAll('-','.')}</time></div><h2><a href="${postUrl(featured)}">${esc(featured.title)}</a></h2><p>${esc(featured.description)}</p><a class="text-link" href="${postUrl(featured)}">进入完整复盘 <span>↗</span></a></div></article><section class="home-latest"><div class="section-title"><div><span class="eyebrow">LATEST NOTES</span><h2>最近写下的事</h2></div><a class="text-link" href="/archives/">全部文章 ↗</a></div><div class="post-grid">${homeNotes}</div></section></div>
<aside class="home-aside">${profileCard()}<section class="sidebar-card"><div class="aside-heading"><span class="eyebrow">PROJECT FILES</span><h2>项目档案</h2></div>${projects.slice(0,3).map((p,i)=>`<a class="mini-project" href="${projectUrl(p)}"><img src="${asset(p.cover)}" width="56" height="56" alt=""><div><h3>${esc(p.title)}</h3><small>${esc(p.role)}</small></div><span>↗</span></a>`).join('')}<a class="text-link all-projects" href="/projects/">查看全部项目 →</a></section><section class="sidebar-card reading-path"><span class="eyebrow">READING ROUTE</span><h2>从哪里开始读？</h2><a href="${postUrl(posts.find(post=>post.id==='010'))}"><span>01</span><div><strong>一段成长经历</strong><small>从初赛到国一</small></div></a><a href="${postUrl(posts.find(post=>post.id==='008'))}"><span>02</span><div><strong>一次工程取舍</strong><small>94 分复盘</small></div></a><a href="${postUrl(posts.find(post=>post.id==='009'))}"><span>03</span><div><strong>深入视觉模块</strong><small>四套视觉方案</small></div></a></section></aside></div>`);
  const renderProjects = () => shell('项目档案','项目',`${heading('PROJECTS / 项目档案','从一段代码，到一套系统。','一些比赛，一些真实问题。这里说明我做了什么、与谁协作，以及最后留下了什么。')}<div class="project-index">${projects.map((p,i)=>`<article class="project-list-item" id="project-${esc(p.id)}"><a class="project-cover" href="${projectUrl(p)}"><img src="${asset(p.cover)}" alt="${esc(p.title)}${concept(p.cover) ? "封面，AI 概念插画" : "封面"}" width="1200" height="675" ${i?'loading="lazy"':''}></a><div class="project-list-copy"><div class="item-meta"><span class="eyebrow">0${i+1} / ${esc(p.period)}</span>${tag(p.team.split(' · ')[0])}</div><h2><a href="${projectUrl(p)}">${esc(p.title)} ↗</a></h2><p>${esc(p.summary)}</p><div class="role-line"><span>我的职责</span>${esc(p.role)}</div><div class="tags">${p.stack.map(tag).join('')}</div><a class="text-link" href="${projectUrl(p)}">查看项目档案 →</a></div></article>`).join('')}</div>`);
  const renderProject = p => {
    const related = posts.filter(post => post.project_id === p.id);
    return shell(p.title,'项目',`
<a class="breadcrumb" href="/projects/">← 项目档案</a>
<div class="project-intro">
  ${heading(p.code,p.title,p.summary)}
  <div class="project-detail-cover"><img src="${asset(p.cover,'../')}" alt="${esc(p.title)}${concept(p.cover) ? "封面，AI 概念插画" : "封面"}" width="1200" height="675"></div>
  <section class="project-brief desktop-only" aria-label="项目概要">
    <dl class="project-brief-facts"><div><dt>项目周期</dt><dd>${esc(p.period)}</dd></div><div><dt>团队</dt><dd>${esc(p.team)}</dd></div><div class="brief-role"><dt>本人角色</dt><dd>${esc(p.role)}</dd></div></dl>
    <div class="project-brief-result"><span class="eyebrow">团队成果与项目进展</span><p>${esc(p.result).replace(/一等奖|三等奖|94 分/g, value => `<em>${value}</em>`)}</p></div>
    <nav class="project-brief-links" aria-label="项目阅读入口"><a href="#responsibility">本人职责 ↓</a><a href="#outcome">结果与证据 ↓</a><a href="#project-notes">相关记录 ↓</a></nav>
  </section>
</div>
${concept(p.cover) ? '<p class="cover-credit">封面为 AI 概念插画，比赛证据见下方记录。</p>' : ''}
<div class="detail-layout"><div>
  <section class="detail-section"><span class="eyebrow">01 / PROBLEM</span><h2>要解决的问题</h2><p>${esc(p.problem)}</p></section>
  <section class="detail-section" id="responsibility"><span class="eyebrow">02 / RESPONSIBILITY</span><h2>我负责的部分</h2><ul>${p.responsibilities.map(item=>`<li>${esc(item)}</li>`).join('')}</ul><div class="boundary"><h3>协作边界</h3><p>${esc(p.boundary)}</p></div></section>
  <section class="detail-section" id="outcome"><span class="eyebrow">03 / OUTCOME</span><h2>结果与证据</h2><p>${esc(p.result)}</p><p class="muted">${esc(p.evidence)}</p></section>
  <section class="detail-section" id="project-notes"><span class="eyebrow">04 / NOTES</span><h2>项目里的记录</h2>${related.map(post=>noteRow(post,'../')).join('')}</section>
</div><aside class="project-facts"><span class="eyebrow">PROJECT FILE</span><dl><dt>项目周期</dt><dd>${esc(p.period)}</dd><dt>团队</dt><dd>${esc(p.team)}</dd><dt>本人角色</dt><dd>${esc(p.role)}</dd><dt>技术栈</dt><dd>${p.stack.map(esc).join(' · ')}</dd></dl><h3>系统路线</h3><ol class="route">${p.route.map(item=>`<li>${esc(item)}</li>`).join('')}</ol></aside></div>`,'../');
  };
  const renderArchive = () => {
    const listing = page.path === 'archives/index.html' ? posts : array(page.posts).map(normalize);
    const archiveTitle = page.tag ? `标签：${page.tag}` : page.category ? `分类：${page.category}` : page.year ? `${page.year}${page.month ? ` / ${page.month}` : ''} 的记录` : '问题、过程，还有后来想明白的事。';
    const archiveDescription = page.tag || page.category || page.year ? '沿着一个主题，继续阅读相关的记录。' : '把比赛里的经历，整理成下一次能用上的经验。';
    return shell('文章','文章',`${heading('WRITING / 技术与生活的记录', archiveTitle, archiveDescription)}<div class="archive-layout"><section><section class="archive-controls" aria-label="查找文章"><label class="search-box" for="search"><span>⌕</span><input type="search" id="search" placeholder="搜索文章标题、技术或关键词" autocomplete="off"><kbd>/</kbd></label><div class="filter-bar" role="group" aria-label="文章分类">${['全部',...categories].map((c,i)=>`<button type="button" data-filter="${esc(c)}" aria-pressed="${i===0}">${esc(c)}</button>`).join('')}</div></section><div class="archive-caption"><span>${esc(page.year || "全部记录")} / ${esc(page.month || "NOTEBOOK")}</span><span id="result-count" role="status" aria-live="polite">${listing.length} 篇记录</span></div><div class="post-grid archive-list">${listing.map(p=>postCard(p,'',true)).join('')}</div><p class="empty-state" id="empty-state" hidden>没有找到相关记录。试试其他关键词，或切换到“全部”。</p></section><aside class="home-aside">${profileCard()}<section class="sidebar-card topic-card"><span class="eyebrow">EXPLORE BY TOPIC</span><h2>沿着技术读下去</h2><div class="topic-links">${['ROS','YOLO','AI编程','多车协同','Linux','工程验证'].map(topic=>`<a href="/archives/?q=${encodeURIComponent(topic)}#search">${esc(topic)} <span>↗</span></a>`).join('')}</div><p>从一个具体问题出发，<br>把零散的经验连起来。</p></section></aside></div>`) + (page.total > 1 ? `<nav class="pagination" aria-label="文章分页">${this.paginator({prev_text:'← 上一页',next_text:'下一页 →'})}</nav>` : '');
  };
  const renderArticle = p => {
    const headings = [];
    let html = p.content.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, (match, level, attrs, text) => {
      const id = attrs.match(/\bid="([^"]+)"/)?.[1] || `section-${headings.length+1}`;
      headings.push({id,level,text:text.replace(/<[^>]*>/g,'')});
      return `<h${level}${/\bid=/.test(attrs) ? attrs : `${attrs} id="${id}"`}>${text}</h${level}>`;
    });
    const figures=[];
    html=html.replace(/<figure\b[\s\S]*?<\/figure>/g, match=>`NOTEBOOK_FIGURE_${figures.push(match)-1}_END`);
    html=html.replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/g, (_, attrs, body) => {
      const firstRow = body.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/)?.[1] || '';
      const wide = (firstRow.match(/<(?:th|td)\b/g) || []).length >= 5;
      return `<div class="table-scroll${wide ? ' table-wide' : ''}" tabindex="0" role="region" aria-label="可横向滚动的表格">${wide ? '<span class="table-scroll-hint desktop-only">↔ 横向滚动查看完整表格</span>' : ''}<table${attrs}>${body}</table></div>`;
    });
    html=html.replace(/NOTEBOOK_FIGURE_(\d+)_END/g,(_,index)=>figures[index]);
    const project=projects.find(x=>x.id===p.project_id);
    return shell(p.title,'文章',`<a class="breadcrumb" href="/archives/">← 全部文章</a><header class="article-heading"><img class="article-cover" src="${asset(p.cover,'../')}" alt="${esc(p.title)}${concept(p.cover) ? "封面，AI 概念插画" : "封面"}" width="1200" height="675"><div class="article-heading-copy">${concept(p.cover) ? '<span class="cover-credit">封面为 AI 概念插画，用于主题表达</span>' : ''}<div class="article-meta"><span class="category">${esc(p.category)}</span><time datetime="${p.date}">${p.date.replaceAll('-','.')}</time><span class="eyebrow">LOG ${p.id}</span></div><h1>${esc(p.title)}</h1><p>${esc(p.description)}</p><div class="tags">${(p.tags||[]).slice(0,5).map(tag).join('')}</div></div></header><div class="reading-layout"><article class="prose">${project?`<a class="project-context" href="${projectUrl(project,'../')}"><span>所属项目</span><strong>${esc(project.title)}</strong><span>项目档案 ↗</span></a>`:''}${entryFacts(p.source)}${repro(p.source)}${html}<div class="article-end"><span class="eyebrow">END OF NOTE / ${p.id}</span><a class="text-link" href="/archives/">继续阅读其他记录 →</a></div>${comments(p.source)}</article><aside class="toc"><details open><summary>本篇目录</summary><nav aria-label="文章目录">${headings.map(h=>`<a class="toc-level-${h.level}" href="#${h.id}">${esc(h.text)}</a>`).join('')}</nav></details><a class="back-top" href="#main">回到顶部 ↑</a></aside></div>`,'../');
  };
  const awards = () => `<div class="awards">${achievements.map(a=>`<div class="award"><span>${esc(a.year)}</span><div><h3>${esc(a.project)} · ${esc(a.result)}</h3><p>${esc(a.event)}</p><small>团队参赛结果 · 已核对证书</small></div></div>`).join('')}</div>`;
  if (page.__post) return renderArticle(normalize(page));
  if (page.notebook_project) return renderProject(page.notebook_project);
  if (page.path === 'projects/index.html') return renderProjects();
  if (page.path === 'about/index.html') return page.content.replace(/<div id="notebook-awards">\s*<\/div>/, awards());
  if (page.path === 'downloads/index.html') return this.notebook_resources(this.site.posts);
  if (page.type === 'tags' || page.type === 'categories') {
    const items=array(this.site[page.type]);
    return heading('EXPLORE / 沿着主题阅读',page.type === 'tags' ? '标签' : '文章分类','从一个具体问题出发，把零散经验连起来。')+`<div class="taxonomy-grid">${items.map(item=>`<a class="sidebar-card" href="/${item.path}"><h2>${esc(item.name)} ↗</h2><span class="muted">${item.length} 篇记录</span></a>`).join('')}</div>`;
  }
  if (page.notebook_404) return heading('404 / 这页走丢了','暂时没有找到这个页面。','可以回到首页，或搜索一篇文章。')+'<div class="hero-actions"><a class="button" href="/">回到首页 ↗</a><a class="text-link" href="/archives/#search">搜索文章 →</a></div>';
  if (page.archive || page.category || page.tag || page.current > 1) return renderArchive();
  if (page.path === 'index.html') return renderHome();
  return heading('NOTEBOOK / 生活与记录',page.title,page.description)+`<article class="prose standalone-page">${page.content || ''}</article>`;
});
