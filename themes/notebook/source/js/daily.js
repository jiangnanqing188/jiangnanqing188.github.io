/* Credentials live only in this closure. Entries and previews are always literal text. */
(() => {
  'use strict';
  const root = document.querySelector('[data-daily]');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const moods = ['随手记', '吐槽一下', '小确幸'];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const draftKey = 'fieldnotes-daily-draft-v1';
  const body = $('#daily-body');
  const form = $('[data-compose-form]');
  const publish = $('[data-publish]');
  const login = $('[data-login]');
  const composer = $('[data-composer]');
  let entries = [];
  let filter = '全部';
  let session = '';
  let expires = 0;
  let authGeneration = 0;
  let expiryTimer;
  let popup = null;
  let popupTimer;
  let pendingAuth = false;
  let publishing = false;
  let loading = false;
  let readFailed = false;
  let staticFailed = false;
  let readGeneration = 0;
  let needsRefresh = false;
  let draftId = '';
  let draftMemory = null;
  // These acknowledged entries overlay stale edge-cache reads for this page lifetime.
  const confirmed = new Map();
  const feedback = (element, message, error = false) => {
    element.textContent = message;
    element.dataset.error = String(error);
  };
  const authStatus = (message, error) => feedback($('[data-auth-status]'), message, error);
  const publishStatus = (message, error) => feedback($('[data-publish-status]'), message, error);
  const validText = text => typeof text === 'string' && text.trim().length > 0 && [...text].length <= 1000 && !/[\uD800-\uDFFF]/u.test(text);
  const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  const validEntry = entry => exactKeys(entry, ['id', 'created_at', 'body', 'mood']) && typeof entry.id === 'string' && uuid.test(entry.id) && validText(entry.body) && moods.includes(entry.mood) && typeof entry.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.created_at) && Number.isFinite(Date.parse(entry.created_at)) && new Date(entry.created_at).toISOString() === entry.created_at;
  const parseEntries = data => {
    if (!exactKeys(data, ['version', 'entries']) || data.version !== 1 || !Array.isArray(data.entries) || !data.entries.every((entry, i) => validEntry(entry) && (!i || data.entries[i - 1].created_at >= entry.created_at)) || new Set(data.entries.map(entry => entry.id)).size !== data.entries.length) throw new Error('小记数据格式异常，未替换当前历史。');
    return data.entries.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  };
  const mood = () => form.querySelector('input[name="mood"]:checked').value;
  let api = null;
  const configured = root.dataset.apiUrl.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
      api = url.origin;
    } catch { authStatus('小记服务地址配置有误，登录与发布暂不可用。', true); }
  }
  try { entries = parseEntries(JSON.parse($('#daily-initial').textContent)); }
  catch { staticFailed = readFailed = true; feedback($('[data-read-status]'), '静态小记数据无法读取，请稍后重试。', true); }

  function renderNotes() {
    const list = $('[data-notes]');
    const visible = entries.filter(entry => filter === '全部' || entry.mood === filter);
    list.replaceChildren();
    const format = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
    for (const entry of visible) {
      const parts = Object.fromEntries(format.formatToParts(new Date(entry.created_at)).map(part => [part.type, part.value]));
      const article = document.createElement('article');
      article.className = 'daily-entry';
      const time = document.createElement('time');
      time.dateTime = entry.created_at;
      time.setAttribute('aria-label', `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}，上海时间`);
      for (const [tag, text] of [['strong', `${parts.month}.${parts.day}`], ['span', `${parts.year} / ${parts.weekday.toUpperCase()}`], ['span', `${parts.hour}:${parts.minute}`]]) {
        const node = document.createElement(tag);
        node.textContent = text;
        time.append(node);
      }
      const copy = document.createElement('div');
      copy.className = 'daily-entry-copy';
      const label = document.createElement('span');
      label.className = 'daily-mood';
      label.textContent = entry.mood;
      const text = document.createElement('p');
      text.textContent = entry.body;
      copy.append(label, text);
      article.append(time, copy);
      list.append(article);
    }
    $('[data-note-count]').textContent = `${entries.length} 则小记`;
    const empty = $('[data-empty]');
    empty.hidden = visible.length > 0 || (!entries.length && (staticFailed || (Boolean(api) && (loading || readFailed))));
    empty.querySelector('h3').textContent = entries.length ? '这个心情，还没有留下小记。' : '这一页，等你落下第一笔。';
    empty.querySelector('p').textContent = entries.length ? '换个心情翻翻，或看看全部。' : '还没有公开的小记。短一点，真一点，也很好。';
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(api + path, {...options, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal});
      if (!response.ok) {
        const error = new Error(({401: '登录已过期，请重新以作者身份登录。', 403: '此账号或当前页面没有发布权限，您仍可公开阅读。', 409: '远端记录有变化或此编号已存在。草稿已保留，请先点击“重新读取”，再确认重试。', 413: '正文或小记档案已超出服务容量，请保留草稿并检查。', 429: '请求较多，请稍后手动重试。', 503: 'GitHub 或小记服务暂时不可用，请稍后手动重试。'})[response.status] || '请求未完成，请保留草稿后稍后重试。');
        error.status = response.status;
        throw error;
      }
      try { return await response.json(); } catch { throw new Error('服务返回了无法识别的内容，请稍后再试。'); }
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('请求超时。若正在发布，保存结果尚不确定，请保留原草稿并以相同编号手动重试。');
      if (error instanceof TypeError) throw new Error('网络连接失败，请保留草稿后稍后重试。');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function loadNotes() {
    if (!api || loading) return;
    const generation = ++readGeneration;
    loading = true;
    if (!entries.length) $('[data-empty]').hidden = true;
    $('[data-retry]').disabled = true;
    feedback($('[data-read-status]'), '正在翻开最新的一页…');
    $('[data-notes]').setAttribute('aria-busy', 'true');
    try {
      const remote = parseEntries(await request('/notes'));
      if (generation !== readGeneration) return;
      // This API is append-only: a stale edge response cannot delete already-known records.
      const merged = new Map(entries.map(entry => [entry.id, entry]));
      for (const entry of remote) {
        const known = merged.get(entry.id);
        if (known && (known.body !== entry.body || known.mood !== entry.mood || known.created_at !== entry.created_at)) throw new Error('小记数据不一致，未替换当前历史。');
        merged.set(entry.id, entry);
      }
      for (const [id, entry] of confirmed) merged.set(id, entry);
      entries = [...merged.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
      needsRefresh = false;
      readFailed = staticFailed = false;
      loading = false;
      renderNotes();
      feedback($('[data-read-status]'), '按发布时间 · 新 → 旧 / 上海时间');
      $('[data-retry]').hidden = true;
    } catch (error) {
      if (generation !== readGeneration) return;
      readFailed = true;
      feedback($('[data-read-status]'), `${error.message} ${entries.length ? '下方保留已读取的历史。' : '当前无法确认是否有新内容。'}`, true);
      // An upstream failure must not look like a confirmed empty collection.
      if (!entries.length) $('[data-empty]').hidden = true;
      $('[data-retry]').hidden = false;
    } finally {
      loading = false;
      $('[data-retry]').disabled = false;
      $('[data-notes]').setAttribute('aria-busy', 'false');
      updateForm();
    }
  }

  function updateForm() {
    const count = [...body.value].length;
    $('#daily-count').textContent = `${count} / 1000`;
    $('#daily-count').dataset.overLimit = String(count > 1000);
    body.setAttribute('aria-invalid', String(count > 1000));
    publish.disabled = !session || expires <= Date.now() || !validText(body.value) || publishing || needsRefresh;
    publish.textContent = publishing ? '正在写入 GitHub…' : '发布小记 ↗';
    for (const control of form.querySelectorAll('textarea,input,[data-clear],[data-preview-toggle]')) control.disabled = publishing;
    $('[data-preview-mood]').textContent = mood();
    $('[data-preview-body]').textContent = body.value;
  }

  function saveDraft() {
    draftMemory = {id: draftId, body: body.value, mood: mood()};
    try {
      if (body.value) localStorage.setItem(draftKey, JSON.stringify(draftMemory));
      else localStorage.removeItem(draftKey);
      $('#daily-draft-state').textContent = '草稿仅保存在本机';
    } catch { $('#daily-draft-state').textContent = '本机存储不可用，请勿关闭本页'; }
  }

  function restoreDraft() {
    let draft = draftMemory;
    try { draft = JSON.parse(localStorage.getItem(draftKey)) || draft; } catch { $('#daily-draft-state').textContent = '本机存储不可用，请勿关闭本页'; }
    if (!draft || typeof draft.body !== 'string' || !moods.includes(draft.mood)) return;
    body.value = draft.body;
    form.querySelectorAll('input[name="mood"]').forEach(input => { input.checked = input.value === draft.mood; });
    draftId = typeof draft.id === 'string' && uuid.test(draft.id) ? draft.id : '';
    updateForm();
  }

  function clearDraft() {
    body.value = '';
    draftId = '';
    draftMemory = null;
    form.querySelectorAll('input[name="mood"]').forEach(input => { input.checked = input.value === moods[0]; });
    $('[data-preview]').hidden = true;
    $('[data-preview-toggle]').textContent = '预览';
    $('[data-preview-toggle]').setAttribute('aria-expanded', 'false');
    try { localStorage.removeItem(draftKey); $('#daily-draft-state').textContent = '草稿仅保存在本机'; }
    catch { $('#daily-draft-state').textContent = '无法清除本机存储，请检查浏览器设置'; }
    updateForm();
  }

  function stopPopup() {
    clearInterval(popupTimer);
    popupTimer = undefined;
    pendingAuth = false;
    login.disabled = !api || Boolean(session);
  }

  function closeSession(message) {
    authGeneration++;
    session = '';
    expires = 0;
    clearTimeout(expiryTimer);
    composer.hidden = true;
    $('[data-owner-bar]').hidden = true;
    login.hidden = false;
    login.disabled = !api;
    // Do not reveal the previous author's draft to a subsequent read-only login.
    body.value = '';
    draftId = '';
    $('[data-preview-body]').textContent = '';
    $('[data-preview]').hidden = true;
    authStatus(message);
    updateForm();
  }

  login.addEventListener('click', () => {
    if (!api || pendingAuth || session || publishing) return;
    authGeneration++;
    try { popup = window.open(api + '/auth/start', 'fieldnotes-daily-auth', 'popup,width=620,height=740'); }
    catch { authStatus('登录窗口未能打开，请允许本站弹出窗口后重试。', true); return; }
    if (!popup) { authStatus('登录窗口被浏览器拦截，请允许弹出窗口后重试。', true); return; }
    pendingAuth = true;
    login.disabled = true;
    authStatus('请在弹出窗口中完成 GitHub 登录。仅作者账号可发布。');
    const started = Date.now();
    let closedSince = null;
    popupTimer = setInterval(() => {
      if (!pendingAuth) return;
      // postMessage is queued; the callback closes before its message is necessarily delivered.
      if (popup.closed && Date.now() - started <= 180000) {
        if (closedSince === null) closedSince = Date.now();
        if (Date.now() - closedSince < 1000) return;
      }
      if (popup.closed || Date.now() - started > 180000) {
        const cancelled = popup.closed;
        if (!cancelled) popup.close();
        authGeneration++;
        stopPopup();
        popup = null;
        authStatus(cancelled ? '已取消登录，您可以继续阅读。' : '登录等待超时，请重新打开登录窗口。', true);
      }
    }, 500);
  });

  window.addEventListener('message', async event => {
    if (!api || !pendingAuth || event.origin !== api || event.source !== popup || !event.data || event.data.type !== 'daily-notes-auth') return;
    const data = event.data;
    const generation = authGeneration;
    stopPopup();
    if (popup && !popup.closed) popup.close();
    popup = null;
    if (data.status === 'readonly') {
      closeSession('这个 GitHub 账号是访客身份，可以阅读；发布入口仅对作者开放。');
      return;
    }
    if (data.status !== 'owner' || typeof data.session !== 'string' || !data.session || data.session.length > 16000) {
      authStatus(data.status === 'error' ? 'GitHub 登录未完成或授权失败，请重新登录。' : '登录结果无法验证，请重新登录。', true);
      return;
    }
    login.disabled = true;
    authStatus('正在核对作者身份…');
    try {
      const info = await request('/session', {headers: {Authorization: `Bearer ${data.session}`}});
      if (generation !== authGeneration) return;
      const expiry = Date.parse(info.expires_at);
      if (info.role !== 'owner' || info.login !== 'jiangnanqing188' || !Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 3600000 + 10000) throw new Error('登录身份或有效期无法确认，请重新登录。');
      session = data.session;
      expires = expiry;
      composer.hidden = false;
      $('[data-owner-bar]').hidden = false;
      login.hidden = true;
      restoreDraft();
      updateForm();
      expiryTimer = setTimeout(() => closeSession('作者登录已过期。草稿已保留在本机，请重新登录后继续。'), expiry - Date.now());
      authStatus('作者身份已确认。正文公开可读，请不要发布密钥或他人隐私。');
      body.focus({preventScroll: true});
    } catch (error) { if (generation === authGeneration) { login.disabled = false; authStatus(error.message, true); } }
  });

  $('[data-logout]').addEventListener('click', () => closeSession('已退出作者身份。草稿保留在本机，您仍可阅读全部小记。'));
  $('[data-clear]').addEventListener('click', () => {
    if (body.value && !window.confirm('清除这份本机草稿？此操作不会删除已发布的小记。')) return;
    clearDraft();
    publishStatus('本机草稿已清除。');
  });
  $('[data-preview-toggle]').addEventListener('click', event => {
    updateForm();
    const preview = $('[data-preview]');
    preview.hidden = !preview.hidden;
    event.currentTarget.textContent = preview.hidden ? '预览' : '收起预览';
    event.currentTarget.setAttribute('aria-expanded', String(!preview.hidden));
  });
  for (const control of form.querySelectorAll('textarea,input')) control.addEventListener('input', () => {
    if (!session) return;
    draftId = '';
    saveDraft();
    publishStatus('');
    updateForm();
  });
  for (const button of root.querySelectorAll('[data-daily-filter]')) button.addEventListener('click', () => {
    filter = button.dataset.dailyFilter;
    root.querySelectorAll('[data-daily-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    renderNotes();
  });
  $('[data-retry]').addEventListener('click', loadNotes);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (publishing || needsRefresh || !session || !validText(body.value)) return;
    if (expires <= Date.now()) { closeSession('作者登录已过期。草稿已保留，请重新登录。'); return; }
    if (!draftId) {
      if (typeof crypto.randomUUID !== 'function') { publishStatus('当前浏览器无法生成安全发布编号，请使用 HTTPS 页面及新版浏览器。', true); return; }
      draftId = crypto.randomUUID();
    }
    saveDraft();
    const submission = {id: draftId, body: body.value, mood: mood()};
    const generation = authGeneration;
    publishing = true;
    updateForm();
    publishStatus('正在写入 GitHub，请稍候。');
    try {
      const result = await request('/notes', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${session}`}, body: JSON.stringify(submission)});
      if (generation !== authGeneration) return;
      const entry = result.entry;
      const matches = validEntry(entry) && entry.id === submission.id && entry.body === submission.body && entry.mood === submission.mood;
      const created = result.duplicate === false && typeof result.commit_sha === 'string' && /^[0-9a-f]{40}$/.test(result.commit_sha);
      const duplicate = result.duplicate === true && result.commit_sha === null;
      if (!matches || (!created && !duplicate)) throw new Error('服务未返回可验证的保存结果。草稿已保留，请以相同编号手动重试。');
      confirmed.set(entry.id, entry);
      entries = [entry, ...entries.filter(item => item.id !== entry.id)].sort((a, b) => b.created_at.localeCompare(a.created_at));
      filter = '全部';
      root.querySelectorAll('[data-daily-filter]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.dailyFilter === filter)));
      renderNotes();
      clearDraft();
      publishStatus(duplicate ? '已确认保存在 GitHub，未重复发布。' : '已写入 GitHub，小记发布成功。');
      if (created) {
        const link = document.createElement('a');
        link.href = `https://github.com/jiangnanqing188/jiangnanqing188.github.io/commit/${result.commit_sha}`;
        link.textContent = ' 查看本次提交 ↗';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        $('[data-publish-status]').append(link);
      }
      feedback($('[data-read-status]'), '本页已显示保存结果。其他地区访客可能延迟约 120 秒可见。');
    } catch (error) {
      if (generation !== authGeneration) return;
      publishStatus(error.message, true);
      if (error.status === 409) {
        // A read started before this conflict cannot satisfy the required refresh.
        readGeneration++;
        needsRefresh = true;
        $('[data-retry]').hidden = false;
        feedback($('[data-read-status]'), '远端存在并发变化，请重新读取后确认重试；原草稿和发布编号已保留。', true);
      }
      if (error.status === 401 || error.status === 403) closeSession(error.message + ' 草稿已保留，重新登录后可恢复。');
    } finally { publishing = false; updateForm(); }
  });

  renderNotes();
  updateForm();
  if (api) {
    login.disabled = false;
    loadNotes();
  } else {
    if (!staticFailed) feedback($('[data-read-status]'), configured ? '服务地址配置有误：当前仅显示构建时静态历史，无法检查最新内容。' : '在线小记服务尚未启用。当前仅显示构建时的静态历史，登录与发布暂不可用。');
    if (!configured) authStatus('访客可以阅读；作者登录将在小记服务配置完成后启用。');
    login.title = '尚未配置可用的小记服务';
  }
})();
