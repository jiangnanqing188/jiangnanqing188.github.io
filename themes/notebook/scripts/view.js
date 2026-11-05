"use strict";

const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
// Content versions change only when the shipped bytes change.
hexo.extend.helper.register('notebook_versioned_asset', url => {
  const file = path.join(hexo.theme_dir, 'source', url);
  const version = createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  return `${url}?v=${version}`;
});
const icon = name => {
  const paths = {
    grid: '<circle cx="5" cy="5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="19" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/>',
    camera: '<path d="M3 6h5l2-3h4l2 3h5v15H3Z"/><circle cx="12" cy="13" r="4"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
    trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0Zm5 12v5m-4 1h8M7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4"/>',
    medal: '<circle cx="12" cy="9" r="6"/><circle cx="12" cy="9" r="3"/><path d="m8 14-3 7 6-2m5-5 3 7-6-2"/>',
    layers: '<path d="m2 7 10-5 10 5-10 5Zm0 5 10 5 10-5M2 17l10 5 10-5"/>',
    file: '<path d="M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8M8 16h8M8 19h5"/>',
    user: '<circle cx="12" cy="6" r="4"/><path d="M4 22v-4a8 8 0 0 1 16 0v4Z"/>',
    folder: '<path d="M2 5h7l3 3h10v13H2Z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="1"/><path d="m2 5 10 8L22 5"/>',
    code: '<path d="m7 5-6 7 6 7m10-14 6 7-6 7M14 3l-4 18"/>',
    route: '<circle cx="5" cy="19" r="3"/><circle cx="12" cy="5" r="3"/><circle cx="20" cy="15" r="3"/><path d="m6 16 5-8m4-1 4 5M8 19h9"/>',
    box: '<path d="m2 7 10-5 10 5v12l-10 4-10-4Zm0 0 10 5 10-5M12 12v11M7 4l10 5"/>',
    robot: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 7V3m-10 8v5m20-5v5M8 20v3m8-3v3"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><path d="M9 16h6"/>',
    play: '<path d="m7 3 15 9-15 9Z" fill="currentColor" stroke-linejoin="round"/>'
  };
  return `<svg class="field-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
};

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const array = value => value?.toArray ? value.toArray() : Array.isArray(value) ? value : [];
const names = value => array(value).map(item => item.name || item);
const covers = new Map(['pharmacy-robots','ruikang-competition','yolov5-vision','iscc-plc','ai-robot-tuning'].map(id => [`/img/covers/${id}.${id === 'iscc-plc' ? 'png' : 'webp'}`, `/img/covers/notebook/${id}.webp`]));
covers.set('/img/covers/pharmacy-robots.webp', '/img/covers/notebook/20261105/pharmacy-dual-robots.webp');
covers.set('/img/covers/yolov5-vision.webp', '/img/covers/notebook/20261105/yolov5-pollination.webp');
covers.set('/img/covers/iscc-plc.png', '/img/covers/notebook/20261105/iscc-secure-factory.webp');
const asset = src => covers.get(src) || src || '/img/avatar.jpg';
const concept = src => asset(src).startsWith('/img/covers/notebook/');
const heading = (label, title, sub = '') => `<header class="page-heading"><span class="eyebrow">${esc(label)}</span><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</header>`;
const tag = text => `<span class="tag">${esc(text)}</span>`;
const postUrl = post => post?.url || '/archives/';
const projectUrl = project => `/projects/${project.id}/`;
// Project pages share their exhibition artwork with Open Graph; article covers stay independent.
// Home alone uses a dedicated wide blueprint for its compact leading-project row.
const projectCover = project => project.id === 'ruikang' ? '/img/workshop/ruikang-blueprint.webp' : asset(project.cover);
const projectAlt = project => `${project.title}封面${project.id === 'ruikang' || concept(project.cover) ? '，AI 概念插画，非比赛现场照片' : ''}`;
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
  const shareCover = page.notebook_project ? projectCover(page.notebook_project) : ['index.html', 'projects/index.html'].includes(page.path) ? '/img/workshop/ruikang-blueprint.webp' : asset(page.cover || '/img/covers/ruikang-competition.webp');
  const image = new URL(shareCover, this.config.url).href;
  const titleText = page.path === 'index.html' ? this.config.title : `${title} · ${this.config.title}`;
  return `<title>${esc(titleText)}</title><meta name="description" content="${esc(description)}"><meta name="keywords" content="${esc(names(page.tags).join(', ') || array(this.config.keywords).join(', '))}"><meta name="author" content="${esc(this.config.author)}"><meta name="generator" content="Hexo ${hexo.version}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="${page.__post ? 'article' : 'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:site_name" content="${esc(this.config.title)}"><meta property="og:locale" content="zh_CN"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image">${page.__post ? `<meta property="article:published_time" content="${page.date.toISOString()}"><meta property="article:modified_time" content="${page.updated.toISOString()}">` : ''}`;
});
hexo.extend.generator.register('notebook-projects', locals => array(locals.data.projects).map(project => ({path:`projects/${project.id}/index.html`,layout:'project',data:{title:project.title,description:project.summary,cover:projectCover(project),notebook_project:project}})));
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
  const homeNotes = posts.filter(post => post !== featured).slice(0,4).map(post => postCard(post)).join('');
  const readingRoute = () => `<section class="reading-path"><details open data-responsive-details><summary>从这里开始读 <span class="eyebrow">READING ROUTE</span></summary><div>${[['010','完整经历','从初赛到国一'],['008','工程取舍','94 分复盘'],['009','技术深入','四套视觉方案']].map(([id,title,caption],i) => { const post = posts.find(item => item.id === id); return post ? `<a href="${postUrl(post)}"><span>${String(i+1).padStart(2,'0')}</span><div><strong>${title}</strong><small>${caption}</small></div><b aria-hidden="true">↗</b></a>` : ''; }).join('')}</div></details></section>`;
  const repro = post => this.notebook_repro(post);
  const entryFacts = post => `<div class="entry-facts">${[['日志状态',post.log_status],['运行系统',post.log_system],['关注问题',post.log_focus]].filter(([,value])=>value).map(([label,value])=>`<span><small>${esc(label)}</small>${esc(({completed:'已完成',pending:'待验证',verified:'已复现',archived:'已归档',ongoing:'记录中'})[value] || value)}</span>`).join('')}</div>`;
  const comments = post => {
    const g = this.theme.giscus;
    if (post.comments === false || !g?.repo) return '';
    return `<section id="post-comment" class="comments-section"><div class="comment-head"><h2 class="comment-headline">交流与评论</h2></div><div id="giscus-wrap"><button class="button" id="load-comments" type="button" ${Object.entries(g).map(([key,value])=>`data-${key.replaceAll('_','-')}="${esc(value)}"`).join(' ')}>加载评论</button></div><p class="muted comment-note">使用 GitHub 账号参与讨论。</p></section>`;
  };
function noteRow(p, base = '', filter = false) {
  return `<article class="note-row" ${filter ? `data-note data-category="${esc(p.category)}" data-search="${esc(p.title+' '+p.description+' '+(p.tags||[]).join(' '))}"` : ''}><div class="note-date"><time datetime="${p.date}">${p.date.replaceAll('-','.')}</time><span>LOG ${p.id}</span></div><div><span class="category">${esc(p.category)}</span><h3><a href="${postUrl(p,base)}">${esc(p.title)}</a></h3><p>${esc(p.description)}</p></div><a class="row-arrow" href="${postUrl(p,base)}" aria-label="阅读${esc(p.title)}">↗︎</a></article>`;
}
function postCard(p, base = '', filter = false) {
  return `<article class="post-card" ${filter ? `data-note data-category="${esc(p.category)}" data-search="${esc(p.title+' '+p.description+' '+(p.tags||[]).join(' '))}"` : ''}>
    <a class="post-card-cover" href="${postUrl(p,base)}"><img src="${asset(p.cover,base)}" alt="${esc(p.title)}${concept(p.cover) ? "封面，AI 概念插画" : "封面"}" width="1200" height="675" loading="lazy"><span class="image-tag">${esc(p.category)}</span></a>
    <div class="post-card-body"><div class="card-meta"><time datetime="${p.date}">${p.date.replaceAll('-','.')}</time><span>LOG ${p.id}</span></div><h3><a href="${postUrl(p,base)}">${esc(p.title)}</a></h3><p>${esc(p.description)}</p><div class="card-bottom"><span>${esc((p.tags||[]).slice(0,2).join(' / '))}</span><a href="${postUrl(p,base)}" aria-label="阅读${esc(p.title)}">阅读全文 ↗︎</a></div></div>
  </article>`;
}
  const renderHome = () => `
<section class="lab-hero">
  <div class="hero-copy">
    <span class="eyebrow"><i class="status-dot" aria-hidden="true"></i>FIELD NOTES / VOL. 2026</span>
    <p class="hero-greeting brush-label">你好，我是江南<span class="sketch-rays" aria-hidden="true"></span></p>
    <h1>把机器人调通，<br>也把过程<br><span class="pencil-mark">写清楚。</span></h1>
    <p class="hero-identity">${esc(identity.find(item => item.code === 'EDU')?.value)}</p>
    <p class="hero-lead">关注 ROS 导航、计算机视觉与 AI 应用，承担<span class="hero-role">${esc(identity.find(item => item.code === 'ROLE')?.value)}</span>；记录每次调通、踩坑与改进。</p>
    <div class="hero-actions"><a class="button" href="/projects/">翻开项目档案 ↗</a><a class="secondary-button" href="/archives/">读一篇手记 →</a></div>
    <ul class="hero-disciplines" aria-label="实践方向"><li>${icon('grid')}ROS 导航</li><li>${icon('camera')}计算机视觉</li><li>${icon('chip')}AI 工程</li></ul>
  </div>
  <figure class="hero-visual">
    <div class="testground-scene" aria-hidden="true"><img class="testground-art" src="/img/fieldnotes/hero-testground-4bfaf6cf83.webp" alt="" width="1685" height="933" fetchpriority="high"><span class="scene-note">先跑一圈？<span>↘</span></span><span class="scene-cross cross-one">＋</span><span class="scene-cross cross-two">＋</span><svg class="scene-axis" viewBox="0 0 100 80"><path d="M24 8v50h58m-63-44 5-6 5 6m47 39 6 5-6 5" fill="none" stroke="currentColor" stroke-width="1"/><text x="9" y="73">O</text><text x="28" y="13">y</text><text x="85" y="63">x</text></svg></div>
    <span class="scene-disclosure brush-label">概念插画 · 非比赛实录</span>
    <details class="tuning-player" data-tuning-player>
      <summary>${icon('play')}<span class="watch-label">看一段调车日常</span><span class="return-label">收起短片，返回试验场</span><span class="film-duration">01:15</span></summary>
      <figure class="tuning-screen"><video controls playsinline preload="none" poster="/img/workshop/tuning-film-poster.webp" width="1280" height="720" aria-label="播放机器人调试日常短片" aria-describedby="tuning-video-caption">
        <source src="/media/tuning-workshop.mp4" type="video/mp4">
        <track kind="captions" src="/media/tuning-workshop.zh-CN.vtt" srclang="zh-CN" label="声音说明">
        您的浏览器不支持视频播放，可<a href="/media/tuning-workshop.mp4" download>下载短片 MP4</a>观看。
      </video><figcaption id="tuning-video-caption"><strong>工位日常</strong><small>75秒无对白概念短片 · 非比赛实录</small></figcaption></figure>
    </details>
  </figure>
</section>
<section class="result-strip" aria-label="团队结果与站内记录">
  <strong>团队参赛成果 <span aria-hidden="true">／</span></strong>
  <a href="${projectUrl(representative)}">${icon('trophy')}<span>RAICOM 2026 · 全国一等奖</span></a>
  <a href="${projectUrl(representative)}">${icon('medal')}正式赛 <b>94</b> 分</a>
  <a href="/projects/">${icon('layers')}<b>${projects.length}</b> 个项目档案</a>
  <a href="/archives/">${icon('file')}<b>${posts.length}</b> 篇技术手记</a>
</section>
<section class="selected-projects" aria-labelledby="selected-title">
  <div class="section-title"><div><span class="eyebrow">SELECTED PROJECTS</span><h2 id="selected-title">从赛场，带回来的东西。</h2></div><a class="text-link" href="/projects/">全部项目 ↗</a></div>
  <div class="selected-project-grid">${projects.slice(0,3).map((p,i)=>`<article class="selected-project${i===0?' selected-project-lead':''}"><a class="project-cover" href="${projectUrl(p)}"><img src="${i===0?'/img/fieldnotes/project-banner-ac71989ce5.webp':projectCover(p)}" alt="${esc(projectAlt(p))}" width="${i===0?2172:1200}" height="${i===0?724:675}" loading="lazy"><span class="image-tag">${esc(p.code)} · 概念插画</span></a><div class="selected-project-copy"><div class="project-lead-heading"><h3><a href="${projectUrl(p)}">${esc(p.title)}</a></h3>${i===0?`<span class="result-ticket">团队一等奖 / 94 分</span>`:''}</div><p>${esc(p.summary)}</p><div class="role-line">${icon('user')}<span>本人角色</span>${esc(p.role)}</div><a class="text-link" href="${projectUrl(p)}">项目档案 ↗</a>${i===0&&featured?`<a class="text-link" href="${postUrl(featured)}">阅读复盘 →</a>`:''}</div></article>`).join('')}</div>
</section>
<div class="home-layout"><div class="home-main">
  <section class="home-featured"><div class="section-title"><div><span class="eyebrow">FEATURED NOTE</span><h2>值得展开的一次复盘</h2></div><span class="section-index">01</span></div><article class="feature-note"><a class="cover" href="${postUrl(featured)}"><img src="${asset(featured.cover)}" width="1200" height="675" alt="${esc(featured.title)}封面，AI 概念插画" loading="lazy"></a><div class="feature-copy"><div class="feature-meta"><span class="category">${esc(featured.category)}</span><time datetime="${featured.date}">${featured.date.replaceAll('-','.')}</time></div><h2><a href="${postUrl(featured)}">${esc(featured.title)}</a></h2><p>${esc(featured.description)}</p><a class="text-link" href="${postUrl(featured)}">进入完整复盘 ↗</a></div></article></section>
  <section class="home-latest"><div class="section-title"><div><span class="eyebrow">LATEST NOTES</span><h2>最近写下的事</h2></div><a class="text-link" href="/archives/">全部手记 ↗</a></div><div class="post-grid">${homeNotes}</div></section>
</div><aside class="home-aside">${readingRoute()}<section class="aside-note"><span class="eyebrow">ABOUT THE NOTEBOOK</span><p>做选择，<br>也留下依据。</p><a class="text-link" href="/about/">关于我与联系方式 ↗</a></section></aside></div>`;

  const renderProjects = () => `${heading('PROJECT FILES / 01—04','项目档案','从能跑起来，到知道为什么能跑。这里记录项目结果，也记录我的职责、失败的尝试和最后的取舍。')}
<div class="project-index">${projects.map((p,i)=>`<article class="project-list-item" id="project-${esc(p.id)}"><a class="project-cover" href="${projectUrl(p)}"><img src="${projectCover(p)}" alt="${esc(projectAlt(p))}" width="1200" height="675" ${i?'loading="lazy"':''}><span class="image-tag">概念插画 · 非现场照片</span></a><div class="project-list-copy"><div class="item-meta"><span class="project-number">${String(i+1).padStart(2,'0')}</span><span class="eyebrow">${esc(p.code)}</span></div><h2><a href="${projectUrl(p)}">${esc(p.title)}</a></h2><p class="project-list-result"><span>团队结果</span>${esc(p.result)}</p><p>${esc(p.summary)}</p><dl class="project-list-facts"><div><dt>时间</dt><dd>${esc(p.period)}</dd></div><div><dt>团队</dt><dd>${esc(p.team)}</dd></div><div><dt>本人角色</dt><dd>${esc(p.role)}</dd></div></dl><div class="tags">${p.stack.map(tag).join('')}</div><a class="text-link" href="${projectUrl(p)}">查看项目档案 ↗</a></div></article>`).join('')}</div>
<section class="archive-guide"><h2>如何阅读这些档案？</h2><div><p>项目职责 <span>→</span> 技术记录 <span>→</span> 证据与边界</p><small>奖项均为团队结果，个人职责在各档案中单独说明。封面为概念插画，不作为比赛证据。</small></div></section>`;

  const renderProject = p => {
    const related = posts.filter(post => post.project_id === p.id);
    const index = projects.indexOf(p);
    const previous = projects[index-1];
    const next = projects[index+1];
    return `<a class="breadcrumb" href="/projects/">← 全部项目 / ${esc(p.code)}</a>
<div class="project-intro">
  ${heading(p.code,p.title,p.summary)}
  <section class="project-brief" aria-label="项目概要">
    <dl class="project-brief-facts"><div><dt>项目周期</dt><dd>${esc(p.period)}</dd></div><div><dt>团队</dt><dd>${esc(p.team)}</dd></div><div class="brief-role"><dt>本人角色</dt><dd>${esc(p.role)}</dd></div></dl>
    <div class="project-brief-result"><span class="eyebrow">团队成果与项目进展</span><p>${esc(p.result).replace(/一等奖|三等奖|94 分/g, value => `<em>${value}</em>`)}</p></div>
    <nav class="project-brief-links" aria-label="项目阅读入口"><a href="#responsibility">本人职责 ↓</a><a href="#outcome">结果与证据 ↓</a><a href="#project-notes">相关记录 ↓</a></nav>
  </section>
  <figure class="project-detail-cover"><img src="${projectCover(p)}" alt="${esc(projectAlt(p))}" width="1200" height="675"><figcaption>AI 概念插画 · 非比赛现场照片，原始证据见项目记录</figcaption></figure>
</div>
<div class="detail-layout"><div>
  <section class="detail-section" id="problem"><span class="eyebrow">01 / PROBLEM</span><h2>要解决什么</h2><p>${esc(p.problem)}</p></section>
  <section class="detail-section" id="responsibility"><span class="eyebrow">02 / RESPONSIBILITY</span><h2>我负责的部分</h2><ul class="responsibility-list">${p.responsibilities.map(item=>`<li>${esc(item)}</li>`).join('')}</ul><div class="boundary"><h3>协作边界</h3><p>${esc(p.boundary)}</p></div></section>
  <section class="detail-section" id="system-route"><span class="eyebrow">03 / SYSTEM ROUTE</span><h2>系统路线</h2><ol class="system-route">${p.route.map((item,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span>${esc(item)}</li>`).join('')}</ol></section>
  <section class="detail-section" id="outcome"><span class="eyebrow">04 / EVIDENCE</span><h2>结果与证据</h2><p>${esc(p.result)}</p><div class="evidence-note"><span>公开材料与验证边界</span><p>${esc(p.evidence)}</p></div></section>
  <section class="detail-section" id="project-notes"><span class="eyebrow">05 / FIELD NOTES</span><h2>继续阅读</h2>${related.map(post=>noteRow(post)).join('')}</section>
</div><aside class="project-facts"><h2>项目速览</h2><dl><dt>项目周期</dt><dd>${esc(p.period)}</dd><dt>团队</dt><dd>${esc(p.team)}</dd><dt>本人角色</dt><dd>${esc(p.role)}</dd><dt>技术栈</dt><dd>${p.stack.map(esc).join(' · ')}</dd></dl><details open data-responsive-details><summary>本页目录</summary><nav aria-label="项目目录">${[['problem','要解决什么'],['responsibility','我负责的部分'],['system-route','系统路线'],['outcome','结果与证据'],['project-notes','继续阅读']].map(([id,label],i)=>`<a href="#${id}"><span>0${i+1}</span>${label}</a>`).join('')}</nav></details></aside></div>
<nav class="project-pagination" aria-label="浏览其他项目">${previous?`<a href="${projectUrl(previous)}">← 上一项目<span>${esc(previous.title)}</span></a>`:'<a href="/projects/">← 全部项目</a>'}${next?`<a href="${projectUrl(next)}">下一项目 →<span>${esc(next.title)}</span></a>`:'<a href="/projects/">全部项目 →</a>'}</nav>`;
  };

  const renderArchive = () => {
    const listing = page.path === 'archives/index.html' ? posts : array(page.posts).map(normalize);
    const archiveTitle = page.tag ? `标签：${page.tag}` : page.category ? `分类：${page.category}` : page.year ? `${page.year}${page.month ? ` / ${page.month}` : ''} 的记录` : '技术手记';
    const archiveDescription = page.tag || page.category || page.year ? '沿着一个主题，继续阅读相关的记录。' : '车不动的时候，故事才刚开始。写下问题如何出现、判断如何形成，以及最后为什么这样选择。';
    return `${heading('FIELD NOTES / 写下过程', archiveTitle, archiveDescription)}<div class="archive-layout"><section class="archive-main"><section class="archive-controls" aria-label="查找文章"><label class="search-box" for="search"><span aria-hidden="true">⌕</span><input type="search" id="search" aria-label="搜索标题、标签或正文" placeholder="搜索标题、标签或正文…" autocomplete="off"><kbd>/</kbd></label><div class="filter-label"><span>分类筛选</span><span class="eyebrow">CATEGORIES</span></div><div class="filter-bar" role="group" aria-label="文章分类">${['全部',...categories].map((c,i)=>`<button type="button" data-filter="${esc(c)}" aria-pressed="${i===0}">${esc(c)}</button>`).join('')}</div></section><div class="archive-caption"><span id="result-count" role="status" aria-live="polite">${listing.length} 篇记录</span><span>按发布时间 · 新 → 旧</span></div><div class="post-grid archive-list">${listing.map(p=>postCard(p,'',true)).join('')}</div><section class="empty-state" id="empty-state" hidden><span class="empty-glyph" aria-hidden="true">⌕</span><h2>没有找到相关手记。</h2><p>换个关键词，或者重新查看当前列表。</p><button type="button" class="button" data-reset-search>重置筛选 ↻</button><a class="text-link" href="/archives/">查看全部文章 →</a></section></section><aside class="home-aside">${readingRoute()}<section class="sidebar-card topic-card"><span class="eyebrow">PROJECT FILES</span><h2>按项目找记录</h2><div class="project-topic-links">${projects.map(p=>`<a href="${projectUrl(p)}">${esc(p.title)} <span>→</span></a>`).join('')}</div><a class="text-link" href="/projects/">返回项目档案 ↗</a></section></aside></div>${page.total > 1 ? `<nav class="pagination" aria-label="文章分页">${this.paginator({prev_text:'← 上一页',next_text:'下一页 →'})}</nav>` : ''}`;
  };
  const renderArticle = p => {
    const headings = [];
    let html = p.content.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, (match, level, attrs, text) => {
      const id = attrs.match(/\bid="([^"]+)"/)?.[1] || `section-${headings.length+1}`;
      headings.push({id,level,text:text.replace(/<[^>]*>/g,'')});
      if (level === '2') {
        attrs += ' data-field-section';
        const plain = text.replace(/<[^>]*>/g, '').trim();
        // Authored section numbers remain the only number when already present.
        if (!/^(?:第[一二三四五六七八九十百\d]+|[一二三四五六七八九十]+[、.．]|\d+[、.．)）\s])/u.test(plain)) attrs += ' data-field-heading';
      }
      return `<h${level}${/\bid=/.test(attrs) ? attrs : `${attrs} id="${id}"`}>${text}</h${level}>`;
    });
    const figures=[];
    html=html.replace(/<figure\b[\s\S]*?<\/figure>/g, match=>`NOTEBOOK_FIGURE_${figures.push(match)-1}_END`);
    html=html.replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/g, (_, attrs, body) => {
      const firstRow = body.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/)?.[1] || '';
      const wide = (firstRow.match(/<(?:th|td)\b/g) || []).length >= 5;
      return `<div class="table-scroll${wide ? ' table-wide' : ''}" tabindex="0" role="region" aria-label="可横向滚动的表格"><span class="table-scroll-hint">↔ 可左右滑动，查看表格其余列</span><table${attrs}>${body}</table></div>`;
    });
    html=html.replace(/NOTEBOOK_FIGURE_(\d+)_END/g,(_,index)=>figures[index]);
    const project=projects.find(x=>x.id===p.project_id);
    return `<a class="breadcrumb" href="/archives/">← 全部文章</a><header class="article-heading"><img class="article-cover" src="${asset(p.cover,'../')}" alt="${esc(p.title)}${concept(p.cover) ? "封面，AI 概念插画" : "封面"}" width="1200" height="675"><div class="article-heading-copy">${concept(p.cover) ? '<span class="cover-credit">封面为 AI 概念插画，用于主题表达</span>' : ''}<div class="article-meta"><span class="category">${esc(p.category)}</span><time datetime="${p.date}">${p.date.replaceAll('-','.')}</time><span class="eyebrow">LOG ${p.id}</span></div><h1>${esc(p.title)}</h1><p>${esc(p.description)}</p><div class="tags">${(p.tags||[]).slice(0,5).map(tag).join('')}</div></div></header><div class="reading-layout"><article class="prose">${project?`<a class="project-context" href="${projectUrl(project,'../')}"><span>所属项目</span><strong>${esc(project.title)}</strong><span>项目档案 ↗︎</span></a>`:''}${project ? `<section class="article-project-summary" aria-label="项目与职责"><span>${esc(project.team)}</span><strong>${esc(project.role)}</strong><p>${esc(project.result)}</p><small>${esc(project.boundary)}</small></section>` : ''}${entryFacts(p.source)}${repro(p.source)}${html}<div class="article-end"><span class="eyebrow">END OF NOTE / ${p.id}</span><a class="text-link" href="/archives/">继续阅读其他记录 →︎</a></div>${comments(p.source)}</article><aside class="toc"><details open data-responsive-details><summary>本篇目录</summary><nav aria-label="文章目录">${headings.map(h=>`<a class="toc-level-${h.level}" href="#${h.id}">${esc(h.text)}</a>`).join('')}</nav></details>${project ? `<a class="text-link toc-project" href="${projectUrl(project)}">返回项目档案 ↗</a>` : ''}<a class="back-top" href="#main">回到顶部 ↑</a></aside></div>`;
  };
  const awards = () => `<div class="awards">${achievements.map(a=>`<div class="award"><span>${icon('trophy')}${esc(a.year)}</span><div><h3><a href="${esc(a.href)}">${esc(a.project)}</a><span class="award-result">${esc(a.result)}</span></h3><p>${esc(a.event)}</p><small>团队参赛结果 · 已核对证书</small></div></div>`).join('')}</div>`;
  if (page.__post) return renderArticle(normalize(page));
  if (page.notebook_project) return renderProject(page.notebook_project);
  if (page.path === 'projects/index.html') return renderProjects();
  if (page.path === 'about/index.html') return page.content.replace(/<div id="notebook-awards">\s*<\/div>/, awards()).replace(/<span data-field-icon="([a-z]+)"><\/span>/g, (_, name) => icon(name));
  if (page.path === 'downloads/index.html') return this.notebook_resources(this.site.posts);
  if (page.type === 'tags' || page.type === 'categories') {
    const items = array(this.site[page.type]);
    const isTags = page.type === 'tags';
    return `${heading('EXPLORE / 沿着主题阅读',isTags ? '给好奇心找条路。' : '沿着主题继续读。','从一个具体问题出发，把零散经验连起来。这里仅收录已有文章的真实主题。')}<div class="taxonomy-grid ${isTags ? 'taxonomy-tags' : 'taxonomy-categories'}">${items.map((item,i)=>`<a class="taxonomy-item" href="/${item.path}"><span class="taxonomy-number">${String(i+1).padStart(2,'0')}</span><h2>${esc(item.name)}</h2><span class="muted">${item.length} 篇记录</span><span class="taxonomy-arrow" aria-hidden="true">↗</span></a>`).join('')}</div><a class="text-link" href="/archives/">查看全部技术手记 →</a>`;
  }
  if (page.notebook_404) return `<section class="not-found"><div class="not-found-copy"><span class="eyebrow">OFF THE ROUTE / 走错一个航点</span><div class="lost-field"><strong>404</strong></div><h1>这页走丢了。</h1><p>暂时没有找到这个页面。换一条路线，继续探索。</p><div class="hero-actions"><a class="button" href="/">回到首页 ↗</a><a class="secondary-button" href="/archives/#search">搜索文章 →</a></div><a class="text-link" href="/projects/">或者，翻开一份项目档案 ↗</a></div><img class="detour-illustration" src="/img/fieldnotes/detour-notebook-13bcf3e306.webp" alt="" aria-hidden="true" width="1536" height="1024"></section>`;
  if (page.path === 'music/index.html') return `<section class="music-page">${page.content || ''}</section>`;
  if (page.archive || page.category || page.tag || page.current > 1) return renderArchive();
  if (page.path === 'index.html') return renderHome();
  return heading('NOTEBOOK / 生活与记录',page.title,page.description)+`<article class="prose standalone-page">${page.content || ''}</article>`;
});
