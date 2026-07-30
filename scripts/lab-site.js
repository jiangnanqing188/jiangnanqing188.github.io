"use strict";

const escapeHtml = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const statusLabels = {
  ongoing: "记录中",
  pending: "待验证",
  verified: "已复现",
  completed: "已完成",
  archived: "已归档"
};

const formatLogId = value => `LOG ${String(value || "").replace(/^LOG\s*/i, "")}`;
const formatStatus = value => statusLabels[value] || value || "已记录";

const renderHome = home => {
  const current = home.current || {};
  const primary = home.primary || {};
  const secondary = home.secondary || {};
  const routes = Array.isArray(home.routes) ? home.routes : [];
  const titleLines = Array.isArray(home.title) ? home.title : [home.title];
  const title = titleLines.map(line => `<span>${escapeHtml(line)}</span>`).join("");

  const routeItems = routes
    .map(
      route => `
        <a class="lab-home__route" href="${escapeHtml(route.href)}">
          <span class="lab-home__route-code">${escapeHtml(route.code)}</span>
          <span class="lab-home__route-copy">
            <strong>${escapeHtml(route.label)}</strong>
            <small>${escapeHtml(route.description)}</small>
          </span>
          <span class="lab-home__route-arrow" aria-hidden="true">↗</span>
        </a>`
    )
    .join("");

  return `
    <section class="lab-home" id="home_top" aria-labelledby="lab-home-title">
      <div class="lab-home__frame">
        <svg class="lab-home__route-map" viewBox="0 0 520 360" aria-hidden="true">
          <path d="M22 304 C106 302 92 210 168 210 S232 116 302 116 S370 54 494 54"></path>
          <circle cx="22" cy="304" r="5"></circle>
          <circle cx="168" cy="210" r="5"></circle>
          <circle cx="302" cy="116" r="5"></circle>
          <circle cx="494" cy="54" r="5"></circle>
        </svg>

        <div class="lab-home__copy">
          <p class="lab-home__eyebrow"><span aria-hidden="true"></span>${escapeHtml(home.eyebrow)}</p>
          <h1 id="lab-home-title">${title}</h1>
          <p class="lab-home__lead">${escapeHtml(home.lead)}</p>
          <div class="lab-home__actions">
            <a class="lab-home__primary" href="${escapeHtml(primary.href)}">${escapeHtml(primary.label)}<span aria-hidden="true">→</span></a>
            <a class="lab-home__secondary" href="${escapeHtml(secondary.href)}">${escapeHtml(secondary.label)}<span aria-hidden="true">→</span></a>
          </div>
        </div>

        <aside class="lab-home__console" aria-label="当前调试状态">
          <div class="lab-home__console-bar">
            <span aria-hidden="true"><i></i><i></i><i></i></span>
            <code>~/jiangnan/current-run</code>
          </div>
          <div class="lab-home__console-body">
            <div class="lab-home__logline">
              <span>${escapeHtml(formatLogId(current.id))}</span>
              <time datetime="${escapeHtml(String(current.date || "").replaceAll(".", "-"))}">${escapeHtml(current.date)}</time>
              <strong data-status="${escapeHtml(current.status)}"><i aria-hidden="true"></i>${escapeHtml(formatStatus(current.status))}</strong>
            </div>
            <p class="lab-home__prompt"><span aria-hidden="true">$</span> roslaunch current_project.launch</p>
            <h2>${escapeHtml(current.title)}</h2>
            <p>${escapeHtml(current.summary)}</p>
            <dl>
              <div><dt>系统</dt><dd>${escapeHtml(current.system)}</dd></div>
              <div><dt>当前关注</dt><dd>${escapeHtml(current.focus)}</dd></div>
            </dl>
            <a href="${escapeHtml(current.href)}">打开完整复盘 <span aria-hidden="true">→</span></a>
          </div>
        </aside>
      </div>

      <nav class="lab-home__routes" aria-label="按内容类型浏览">
        ${routeItems}
      </nav>
    </section>`;
};

const renderLogHeading = () => `
  <header class="lab-log-index">
    <div>
      <span>江南实验日志 / LOG INDEX</span>
      <h2>最近记录</h2>
    </div>
    <p>按时间留下问题、判断和结果。能复现的过程，比一句“终于跑通了”更有用。</p>
  </header>`;

const renderCardMeta = post => {
  if (!post) return "";
  const id = escapeHtml(formatLogId(post.log_id));
  const status = escapeHtml(formatStatus(post.log_status));

  return `<div class="lab-card-logline"><span>${id}</span><strong data-status="${escapeHtml(post.log_status)}"><i aria-hidden="true"></i>${status}</strong></div>`;
};

const renderEntryMeta = page => {
  const date =
    page.log_date ||
    (page.date && typeof page.date.format === "function" ? page.date.format("YYYY.MM.DD") : "");

  return `
    <section class="lab-entry-meta" aria-label="实验日志信息">
      <span>${escapeHtml(formatLogId(page.log_id))}</span>
      <time datetime="${escapeHtml(String(date).replaceAll(".", "-"))}">${escapeHtml(date)}</time>
      <strong data-status="${escapeHtml(page.log_status)}"><i aria-hidden="true"></i>${escapeHtml(formatStatus(page.log_status))}</strong>
    </section>`;
};

const addAccessibleNames = html =>
  html
    .replace(
      /<h1 class="author-info__name">([\s\S]*?)<\/h1>/g,
      '<strong class="author-info__name">$1</strong>'
    )
    .replace(/<nav id="nav"(?![^>]*aria-label)/g, '<nav id="nav" aria-label="主导航"')
    .replace(
      /(<div class="nav-button" id="randomPost_button"><a\b)(?![^>]*aria-label)/g,
      '$1 aria-label="随机文章"'
    )
    .replace(
      /(<div class="nav-button" id="search-button"><a\b)(?![^>]*aria-label)/g,
      '$1 aria-label="搜索"'
    )
    .replace(
      /(<div id="toggle-menu"><a\b)(?![^>]*aria-label)/g,
      '$1 aria-label="打开导航菜单" aria-controls="sidebar-menus" aria-expanded="false"'
    )
    .replace(
      /(<div class="nav-button" id="nav-totop"><a\b)(?![^>]*aria-label)/g,
      '$1 aria-label="返回顶部"'
    );

hexo.extend.filter.register(
  "after_render:html",
  (html, locals) => {
    const page = locals?.page || {};
    const outputPath = locals?.path || page.path;
    let output = addAccessibleNames(html);

    if (outputPath === "index.html") {
      const mainAnchor = '<main id="blog-container">';
      const postsAnchor = '<div class="recent-posts" id="recent-posts">';

      if (!output.includes(mainAnchor) || !output.includes(postsAnchor)) {
        hexo.log.warn("[lab-site] Homepage injection anchor is missing; check the active theme markup.");
        return output;
      }

      if (output.includes('class="lab-home"')) return output;

      const siteData = hexo.locals.get("data") || {};
      const home = siteData.home || {};
      const posts =
        page.posts && typeof page.posts.toArray === "function"
          ? page.posts.toArray()
          : Array.isArray(page.posts?.data)
            ? page.posts.data
            : [];
      let postIndex = 0;

      output = output.replace(
        mainAnchor,
        `${mainAnchor}${renderHome(home)}`
      );
      output = output.replace(
        postsAnchor,
        `${postsAnchor}${renderLogHeading()}`
      );
      output = output.replace(/<div class="recent-post-info">/g, match => {
        const meta = renderCardMeta(posts[postIndex]);
        postIndex += 1;
        return `${match}${meta}`;
      });

      if (postIndex !== posts.length) {
        hexo.log.warn(
          `[lab-site] Rendered ${postIndex} homepage log cards for ${posts.length} posts; check the theme card markup.`
        );
      }
    }

    if (page.__post && page.log_id) {
      const articleAnchor = /(<article class="post-content" id="article-container"[^>]*>)/;
      if (articleAnchor.test(output)) {
        output = output.replace(articleAnchor, `$1${renderEntryMeta(page)}`);
      } else {
        hexo.log.warn(`[lab-site] Article injection anchor is missing for ${outputPath}.`);
      }
    }

    return output;
  },
  90
);

const legacyRedirects = [
  ["categories/AI学习/index.html", "/categories/学习笔记/"],
  ["categories/比赛/index.html", "/categories/比赛复盘/"],
  ["tags/python/index.html", "/tags/Python/"]
];

hexo.extend.generator.register("lab-legacy-redirects", () =>
  legacyRedirects.map(([path, target]) => ({
    path,
    data: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${hexo.config.url.replace(/\/$/, "")}${target}"><title>页面已移动</title></head><body><p>页面已移动到 <a href="${target}">${target}</a>。</p></body></html>`
  }))
);
