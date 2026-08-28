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
const toArray = value => {
  if (!value) return [];
  if (typeof value.toArray === "function") return value.toArray();
  return Array.isArray(value) ? value : [];
};
const formatPostDate = (post, pattern = "YYYY.MM.DD") =>
  post?.log_date ||
  (post?.date && typeof post.date.format === "function" ? post.date.format(pattern) : "");
const postPath = post => {
  const path = String(post?.path || "");
  return path.startsWith("/") ? path : `/${path}`;
};
const taxonomyNames = collection =>
  toArray(collection)
    .map(item => item?.name || item)
    .filter(Boolean);

const deriveCurrent = post => {
  if (!post) return {};

  const categories = taxonomyNames(post.categories);
  const tags = taxonomyNames(post.tags);

  return {
    id: post.log_id,
    date: formatPostDate(post),
    status: post.log_status,
    title: post.title,
    summary: post.description,
    system: post.log_system || tags.slice(0, 3).join(" / "),
    focus: post.log_focus || [...categories, ...tags].slice(0, 2).join(" / "),
    href: postPath(post)
  };
};

const renderHome = (home, latestPost) => {
  const current = { ...(home.current || {}), ...deriveCurrent(latestPost) };
  const primary = home.primary || {};
  const secondary = { ...(home.secondary || {}), href: current.href || home.secondary?.href };
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
  const date = formatPostDate(page);

  return `
    <section class="lab-entry-meta" aria-label="实验日志信息">
      <span>${escapeHtml(formatLogId(page.log_id))}</span>
      <time datetime="${escapeHtml(String(date).replaceAll(".", "-"))}">${escapeHtml(date)}</time>
      <strong data-status="${escapeHtml(page.log_status)}"><i aria-hidden="true"></i>${escapeHtml(formatStatus(page.log_status))}</strong>
    </section>`;
};

const renderProjectContext = (page, projects) => {
  if (!page?.project_id) return "";

  const project = toArray(projects).find(item => item?.id === page.project_id);
  if (!project) return "";

  return `
    <aside class="lab-project-context" aria-label="文章所属项目">
      <div>
        <span>PROJECT CONTEXT</span>
        <strong>${escapeHtml(project.title)}</strong>
        <small><b>MY ROLE</b>${escapeHtml(project.role)}</small>
      </div>
      <a href="/projects/#project-${escapeHtml(project.id)}">查看项目职责、边界与全部记录 <span aria-hidden="true">→</span></a>
    </aside>`;
};

const renderReproCard = page => {
  const repro = page.repro;
  if (!repro || typeof repro !== "object") return "";

  const fields = [
    ["运行环境", repro.environment],
    ["验证对象", repro.target],
    ["最后验证", repro.last_verified],
    ["验证证据", repro.evidence]
  ]
    .filter(([, value]) => value)
    .map(
      ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`
    )
    .join("");

  const artifacts = toArray(repro.artifacts)
    .filter(item => item?.label && item?.href)
    .map(
      item => `
        <a href="${escapeHtml(item.href)}"${String(item.href).startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>
          <span>${escapeHtml(item.kind || "ARTIFACT")}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.description || "打开项目材料")}</small>
        </a>`
    )
    .join("");

  return `
    <aside class="lab-repro" aria-labelledby="lab-repro-title">
      <header class="lab-repro__head">
        <div>
          <span>REPRODUCTION NOTE</span>
          <h2 id="lab-repro-title">复现与验证</h2>
        </div>
        <strong data-status="${escapeHtml(page.log_status)}"><i aria-hidden="true"></i>${escapeHtml(formatStatus(page.log_status))}</strong>
      </header>
      ${fields ? `<dl class="lab-repro__facts">${fields}</dl>` : ""}
      ${artifacts ? `<nav class="lab-repro__artifacts" aria-label="本文相关材料">${artifacts}</nav>` : ""}
    </aside>`;
};

const renderProjectHub = (projects, posts) => {
  const projectList = toArray(projects);
  const postList = toArray(posts);
  const projectCards = projectList
    .map(project => {
      const records = postList
        .filter(post => post.project_id === project.id)
        .sort((a, b) => Number(b.date) - Number(a.date));
      if (!records.length) return "";

      const recordLinks = records
        .map(
          post => `
            <a class="lab-projects__record" href="${escapeHtml(postPath(post))}">
              <span>${escapeHtml(formatLogId(post.log_id))}</span>
              <strong>${escapeHtml(post.title)}</strong>
              <time datetime="${escapeHtml(formatPostDate(post, "YYYY-MM-DD"))}">${escapeHtml(formatPostDate(post))}</time>
            </a>`
        )
        .join("");
      const stack = toArray(project.stack)
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join("");
      const responsibilities = toArray(project.responsibilities)
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join("");
      const facts = [
        ["PERIOD", "项目周期", project.period],
        ["TEAM", "团队", project.team],
        ["ROLE", "本人角色", project.role]
      ]
        .filter(([, , value]) => value)
        .map(
          ([code, label, value]) => `
            <div>
              <dt><span>${escapeHtml(code)}</span>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>`
        )
        .join("");

      return `
        <article class="lab-projects__card" id="project-${escapeHtml(project.id)}">
          <a class="lab-projects__cover" href="${escapeHtml(postPath(records[0]))}" aria-label="打开${escapeHtml(project.title)}的最新记录">
            <img src="${escapeHtml(project.cover)}" width="1200" height="675" alt="${escapeHtml(project.title)}项目封面">
            <span>${escapeHtml(project.code)}</span>
          </a>
          <div class="lab-projects__body">
            <header class="lab-projects__card-head">
              <div>
                <span>PROJECT DOSSIER</span>
                <h2>${escapeHtml(project.title)}</h2>
              </div>
              <strong data-status="${escapeHtml(project.status)}"><i aria-hidden="true"></i>${escapeHtml(formatStatus(project.status))}</strong>
            </header>
            <p>${escapeHtml(project.summary)}</p>
            ${stack ? `<ul class="lab-projects__stack" aria-label="项目技术栈">${stack}</ul>` : ""}
            ${facts ? `<dl class="lab-projects__facts">${facts}</dl>` : ""}
            <section class="lab-projects__scope" aria-label="个人职责与协作边界">
              <div class="lab-projects__ownership">
                <span>MY SCOPE</span>
                <h3>我负责</h3>
                ${responsibilities ? `<ul>${responsibilities}</ul>` : ""}
              </div>
              <div class="lab-projects__boundary">
                <span>BOUNDARY</span>
                <h3>协作边界</h3>
                <p>${escapeHtml(project.boundary)}</p>
              </div>
            </section>
            <div class="lab-projects__problem">
              <span>KEY PROBLEM</span>
              <strong>${escapeHtml(project.problem)}</strong>
            </div>
            <div class="lab-projects__outcomes">
              <div><span>RESULT</span><strong>${escapeHtml(project.result)}</strong></div>
              <div><span>EVIDENCE</span><strong>${escapeHtml(project.evidence)}</strong></div>
            </div>
            <section class="lab-projects__records" aria-label="项目相关文章">
              <h3>相关记录 · ${records.length}</h3>
              ${recordLinks}
            </section>
          </div>
        </article>`;
    })
    .join("");

  return `
    <div class="lab-projects">
      <header class="lab-projects__hero">
        <div>
          <span>JIANGNAN / PROJECT INDEX</span>
          <h1>项目档案</h1>
          <p>先看我负责的问题、系统边界和验证结果，再进入长文查看每个项目走过的路线、失败候选与最终取舍。</p>
        </div>
        <dl>
          <div><dt>PROJECTS</dt><dd>${projectList.length.toString().padStart(2, "0")}</dd></div>
          <div><dt>RECORDS</dt><dd>${postList.filter(post => post.project_id).length.toString().padStart(2, "0")}</dd></div>
        </dl>
      </header>
      <section class="lab-projects__list" aria-label="项目列表">${projectCards}</section>
    </div>`;
};

const renderResourceHub = posts => {
  const resources = toArray(posts).flatMap(post =>
    toArray(post.repro?.artifacts)
      .filter(item => item?.label && item?.href)
      .map(item => ({ ...item, post }))
  );

  const cards = resources
    .map(resource => {
      const external = String(resource.href).startsWith("http");
      return `
        <a class="lab-resources__card" href="${escapeHtml(resource.href)}"${external ? ' target="_blank" rel="noopener"' : " download"}>
          <span class="lab-resources__kind">${escapeHtml(resource.kind || "FILE")}</span>
          <strong>${escapeHtml(resource.label)}</strong>
          <p>${escapeHtml(resource.description || "项目材料")}</p>
          <small>来自 ${escapeHtml(formatLogId(resource.post.log_id))} · ${escapeHtml(resource.post.title)}</small>
          <i aria-hidden="true">${external ? "↗" : "↓"}</i>
        </a>`;
    })
    .join("");

  return `
    <div class="lab-resources">
      <header class="lab-resources__hero">
        <span>BUILD ARTIFACTS / DOWNLOADS</span>
        <h1>资源下载</h1>
        <p>文章里真正使用或公开的脚本、配置与项目入口集中放在这里，并保留它们来自哪篇记录。</p>
        <strong>${resources.length.toString().padStart(2, "0")} ITEMS AVAILABLE</strong>
      </header>
      <section class="lab-resources__grid" aria-label="可用资源">${cards}</section>
    </div>`;
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

      output = output.replace(mainAnchor, `${mainAnchor}${renderHome(home, posts[0])}`);
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
        const siteData = hexo.locals.get("data") || {};
        output = output.replace(
          articleAnchor,
          `$1${renderEntryMeta(page)}${renderProjectContext(page, siteData.projects)}${renderReproCard(page)}`
        );
      } else {
        hexo.log.warn(`[lab-site] Article injection anchor is missing for ${outputPath}.`);
      }
    }

    if (outputPath === "projects/index.html") {
      const siteData = hexo.locals.get("data") || {};
      output = output.replace(
        '<div id="lab-projects-root"></div>',
        renderProjectHub(siteData.projects, hexo.locals.get("posts"))
      );
    }

    if (outputPath === "downloads/index.html") {
      output = output.replace(
        '<div id="lab-resources-root"></div>',
        renderResourceHub(hexo.locals.get("posts"))
      );
    }

    return output;
  },
  90
);

const legacyRedirects = [
  ["categories/比赛/index.html", "/categories/比赛复盘/"],
  ["tags/python/index.html", "/tags/Python/"]
];

hexo.extend.generator.register("lab-legacy-redirects", () =>
  legacyRedirects.map(([path, target]) => ({
    path,
    data: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${hexo.config.url.replace(/\/$/, "")}${target}"><title>页面已移动</title></head><body><p>页面已移动到 <a href="${target}">${target}</a>。</p></body></html>`
  }))
);
