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
const absoluteSiteUrl = value => {
  const base = `${String(hexo.config.url || "").replace(/\/$/, "")}/`;
  const target = String(value || "").replace(/^\//, "").replace(/index\.html$/, "");
  return new URL(target, base).href;
};
const isoDate = value =>
  value && typeof value.toISOString === "function" ? value.toISOString() : undefined;
const renderJsonLd = data =>
  `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;

const renderStructuredData = (page, outputPath, siteData) => {
  const author = {
    "@type": "Person",
    name: "江南",
    url: absoluteSiteUrl("/")
  };

  if (outputPath === "index.html") {
    return renderJsonLd({
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url: absoluteSiteUrl("/"),
      name: hexo.config.title,
      description: hexo.config.description,
      mainEntity: {
        ...author,
        affiliation: {
          "@type": "CollegeOrUniversity",
          name: "长江大学"
        },
        knowsAbout: ["ROS", "移动机器人", "计算机视觉", "AI 应用", "机器人系统集成"],
        award: toArray(siteData.achievements).map(
          achievement => `${achievement.project}：${achievement.result}（团队参赛）`
        ),
        sameAs: ["https://github.com/jiangnanqing188"]
      }
    });
  }

  if (outputPath === "projects/index.html") {
    const projects = toArray(siteData.projects);
    return renderJsonLd({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: absoluteSiteUrl("/projects/"),
      name: page.title,
      description: page.description,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: projects.length,
        itemListElement: projects.map((project, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${absoluteSiteUrl("/projects/")}#project-${project.id}`,
          name: project.title,
          description: project.summary
        }))
      }
    });
  }

  if (page.__post) {
    const project = toArray(siteData.projects).find(item => item?.id === page.project_id);
    const keywords = page.keywords || taxonomyNames(page.tags).join(", ");
    const categories = taxonomyNames(page.categories);
    return renderJsonLd({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: page.title,
      description: page.description,
      image: page.cover ? absoluteSiteUrl(page.cover) : undefined,
      url: absoluteSiteUrl(outputPath),
      mainEntityOfPage: absoluteSiteUrl(outputPath),
      datePublished: isoDate(page.date),
      dateModified: isoDate(page.updated || page.date),
      author,
      publisher: author,
      keywords,
      articleSection: categories[0],
      about: project
        ? {
            "@type": "Thing",
            name: project.title,
            url: `${absoluteSiteUrl("/projects/")}#project-${project.id}`
          }
        : undefined
    });
  }

  return "";
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
      'content="width=device-width, initial-scale=1.0, user-scalable=no"',
      'content="width=device-width, initial-scale=1.0"'
    )
    .replace(/<div class="comment-randomInfo">[\s\S]*?<\/div>/g, "")
    .replace(
      /<img class="nolazyload" id="post-top-bg"(?![^>]*\balt=)/g,
      '<img class="nolazyload" id="post-top-bg" alt="" aria-hidden="true"'
    )
    .replace(
      /<a class="footer-bar-link" href="\/" title="([^"]*)" target="_blank">/g,
      '<a class="footer-bar-link" href="/" title="$1">'
    )
    .replace(
      /<a(?![^>]*\brel=)([^>]*\btarget="_blank"[^>]*)>/g,
      '<a rel="noopener"$1>'
    )
    .replace(
      /<h1 class="author-info__name">([\s\S]*?)<\/h1>/g,
      '<strong class="author-info__name">$1</strong>'
    );

hexo.extend.filter.register(
  "after_render:html",
  (html, locals) => {
    const page = locals?.page || {};
    const outputPath = locals?.path || page.path;
    const siteData = hexo.locals.get("data") || {};
    let output = addAccessibleNames(html);
    const structuredData = renderStructuredData(page, outputPath, siteData);

    if (structuredData && output.includes("</head>")) {
      output = output.replace("</head>", `${structuredData}</head>`);
    }

    if (hexo.config.theme === "notebook") return output;
    // The notebook theme renders its own layout; only the shared head/accessibility
    // pass above applies. (The former anzhiyu injection path was removed with the
    // old theme; restore it from git history if the site ever moves back.)
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

// The active notebook theme retains the existing verification and resource cards.
hexo.extend.helper.register("notebook_repro", renderReproCard);
hexo.extend.helper.register("notebook_resources", renderResourceHub);
