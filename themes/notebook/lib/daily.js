'use strict';

const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const moods = ['随手记', '吐槽一下', '小确幸'];
const dateParts = value => new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(value)).reduce((out, part) => ({...out, [part.type]: part.value}), {});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const valid = entry => exactKeys(entry, ['id', 'created_at', 'body', 'mood']) && typeof entry.id === 'string' && uuid.test(entry.id)
  && typeof entry.body === 'string' && entry.body.trim().length > 0 && [...entry.body].length <= 1000 && !/[\uD800-\uDFFF]/u.test(entry.body)
  && moods.includes(entry.mood) && typeof entry.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.created_at)
  && Number.isFinite(Date.parse(entry.created_at)) && new Date(entry.created_at).toISOString() === entry.created_at;
const entryHTML = entry => {
  const d = dateParts(entry.created_at);
  return `<article class="daily-entry"><time datetime="${escape(entry.created_at)}" aria-label="${escape(`${d.year}年${d.month}月${d.day}日 ${d.hour}:${d.minute}，上海时间`)}"><strong>${d.month}.${d.day}</strong><span>${d.year} / ${d.weekday.toUpperCase()}</span><span>${d.hour}:${d.minute}</span></time><div class="daily-entry-copy"><span class="daily-mood">${escape(entry.mood)}</span><p>${escape(entry.body)}</p></div></article>`;
};

module.exports = (data, config) => {
  const validData = exactKeys(data, ['version', 'entries']) && data.version === 1 && Array.isArray(data.entries)
    && data.entries.every((entry, i) => valid(entry) && (!i || data.entries[i - 1].created_at >= entry.created_at))
    && new Set(data.entries.map(entry => entry.id)).size === data.entries.length;
  const entries = validData ? data.entries : [];
  // Do not launder corrupt source data into a valid empty collection.
  const payload = JSON.stringify(validData ? {version: 1, entries} : null).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
  return `<section class="daily-page" data-daily data-api-url="${escape(config?.api_url || '')}">
    <div class="daily-identity" data-owner-bar hidden><span>✓ 已以作者身份登录</span><button type="button" data-logout>退出</button></div>
    <header class="daily-hero"><div class="daily-hero-copy"><p class="daily-eyebrow">OFF THE RECORD <span>/ 日常页</span></p><div class="daily-title-line"><h1>日常<span>小记</span></h1><p class="daily-annotation">不必每句<br>都有结论。<span aria-hidden="true">⤶</span></p></div><p class="daily-lead">调车之外，生活之内。<span>偶尔吐槽，也认真开心。</span></p></div><figure class="daily-art"><img src="/img/daily/notebook-still-life.webp" width="1536" height="1024" alt="手绘笔记本、咖啡与钢笔，AI 概念插画" fetchpriority="high"></figure></header>
    <div class="daily-toolbar"><div class="daily-toolbar-title"><h2>随手翻翻</h2><span aria-hidden="true">/</span><span data-note-count>${entries.length} 则小记</span></div><div class="daily-access"><span>访客可读 · 仅作者可写</span><button type="button" class="daily-outline" data-login disabled>作者登录 ↗</button></div></div>
    <p class="daily-feedback" data-auth-status role="status" aria-live="polite"></p>
    <section class="daily-composer" data-composer hidden aria-labelledby="daily-compose-title"><form data-compose-form><h2 id="daily-compose-title">此刻，想说点什么？</h2><p class="daily-compose-sub">只写给这一页的生活。</p><fieldset><legend class="daily-sr-only">这则小记的心情</legend>${moods.map((mood, i) => `<label><input type="radio" name="mood" value="${mood}" ${i === 0 ? 'checked' : ''}>${mood}</label>`).join('')}</fieldset><label class="daily-sr-only" for="daily-body">小记正文，最多 1000 字</label><textarea id="daily-body" name="body" rows="6" placeholder="今天有什么想记下来的？" aria-describedby="daily-count daily-draft-state"></textarea><div class="daily-compose-meta"><span id="daily-count">0 / 1000</span><span id="daily-draft-state">草稿仅保存在本机</span></div><div class="daily-preview" data-preview hidden><h3>发布预览</h3><span class="daily-mood" data-preview-mood></span><p data-preview-body></p></div><div class="daily-compose-actions"><button type="button" class="daily-outline" data-preview-toggle aria-expanded="false">预览</button><button type="submit" class="daily-publish" data-publish disabled>发布小记 ↗</button><button type="button" class="daily-clear" data-clear>清除草稿</button></div><p class="daily-compose-hint">发布后会写入您的 GitHub 仓库，所有人可读。</p><p class="daily-feedback" data-publish-status role="status" aria-live="polite"></p></form></section>
    <div class="daily-layout"><section class="daily-journal" aria-label="小记时间线"><div class="daily-filters" role="group" aria-label="按心情筛选">${['全部', ...moods].map((mood, i) => `<button type="button" data-daily-filter="${mood}" aria-pressed="${i === 0}">${mood}</button>`).join('')}</div><div class="daily-read-state"><p data-read-status role="status" aria-live="polite">${validData ? '当前显示构建时的静态历史；启用 JavaScript 后检查最新小记。' : '静态小记数据异常，无法读取历史；请检查源数据。'}</p><button type="button" class="daily-retry" data-retry hidden>重新读取 ↻</button></div><div data-notes>${entries.map(entryHTML).join('')}</div><div class="daily-empty" data-empty ${!validData || entries.length ? 'hidden' : ''}><span aria-hidden="true">✎</span><h3>这一页，等你落下第一笔。</h3><p>还没有公开的小记。短一点，真一点，也很好。</p></div><noscript><p>当前为静态历史。登录、最新小记与发布功能需要启用 JavaScript。</p></noscript></section>
    <aside class="daily-aside"><section class="daily-paper-note"><h2>这页写什么？<svg aria-hidden="true" viewBox="0 0 24 26" width="26" height="26"><path d="M5 3h14v19l-7-4-7 4Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></h2><p>不写完整攻略。<br>留一点没想明白的，<br>也留一点值得高兴的。</p></section><div class="daily-aside-caption"><span aria-hidden="true">/</span><p>短一点，真一点。<small>A SMALL NOTE IS ENOUGH.</small></p></div><p class="daily-timezone">时间按上海时区显示。<br>新发布的小记，其他地区可能稍后可见。</p></aside></div>
    <script id="daily-initial" type="application/json">${payload}</script></section>`;
};
