(() => {
  const pet = document.querySelector('#blog-pet');
  if (!pet) return;
  const workstation = pet.closest('.pet-workstation');
  const avatar = pet.querySelector('.pet-avatar');
  const header = document.querySelector('.site-header');
  const avatarLabel = avatar.getAttribute('aria-label');
  const stage = pet.querySelector('.pet-stage');
  const bubble = pet.querySelector('.pet-bubble');
  const restore = pet.querySelector('.pet-restore');
  const menu = pet.querySelector('.pet-menu');
  const menuToggle = pet.querySelector('.pet-menu-toggle');
  const quietButton = pet.querySelector('[data-pet-action="quiet"]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'jiangnan-blog-pet-v1';
  // Keep v2 manual positions, quiet and hidden preferences unchanged.
  // Automatic docking no longer chooses an overlapping corner as a fallback.
  const STORAGE_VERSION = 2;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* Storage may be disabled. */ }
  let hidden = saved.hidden === true;
  let quiet = saved.quiet === true;
  let drag = null;
  let lastDrag = -Infinity;
  let messageIndex = 0;
  let bubbleTimer, idleTimer, idlePoseTimer;
  let lastTap = -Infinity;
  // Small encouragements, shown by the "夸我一句" menu item.
  const praise = [
    '你已经做得很好了，别老觉得自己不够。',
    '这段代码今天比昨天顺眼多了。',
    '能坐下来解决问题的人，本来就不多。',
    '卡住不代表退步，你只是还没找到那个点。',
    '写得慢没关系，能跑通才算数。',
    '你今天至少推进了一点点，这就够了。'
  ];
  const messages = {
    首页: [
      '你好呀，我是小江。点我打招呼，拖我换位置。',
      '今天也一起把想法写进笔记吧。',
      '先看看项目，再读一篇复盘吧。',
      '右上角的「项目」里，有几个我自己也调了很久的东西。',
      '这里的文章都留着失败的部分，不只写结论。',
      '拖着我到处走也行，我会记住你放的位置。'
    ],
    项目: [
      '好方案得跑起来，还得能回退。',
      '每个项目，都藏着一些现场才会遇到的问题。',
      '奖项是结果，真正花时间的是调不通的那几周。',
      '看项目时值得多问一句：这段代码谁写的、证据在哪。',
      '硬编码能跑通，但换台车就得重来，这不算通用方案。'
    ],
    文章: [
      '慢慢读，遇到喜欢的段落可以停一会儿。',
      '失败的过程，往往比结论更有用。',
      '我陪着的时候不出声，除非你想聊两句。',
      '长文可以直接看目录跳章节，不用从头读。',
      '读到代码块，可以点右上角复制。',
      '看完有想法的话，页尾可以留言。'
    ],
    关于: [
      '很高兴认识你。江南的联系方式就在这页。',
      '欢迎来聊机器人、视觉，或者一个新想法。',
      '他现在的方向是机器人系统与 AI 应用。',
      '想合作或者只是交流，邮箱都在这一页。',
      '这页写的是他在项目里具体做了什么。'
    ]
  };
  // Time-aware first greeting, then the page-specific pool takes over.
  const timeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return '这么晚还没睡？我陪你一会儿。';
    if (hour < 9) return '早上好，今天想先从哪篇看起？';
    if (hour < 12) return '上午好，慢慢看，不着急。';
    if (hour < 14) return '中午了，记得先吃点东西。';
    if (hour < 18) return '下午好，接着看吧。';
    if (hour < 23) return '晚上好，今天也辛苦啦。';
    return '夜深了，别熬太晚。';
  };
  let firstLine = true;
  const placeBubble = () => {
    const box = pet.getBoundingClientRect();
    for (const [overlay, className] of [[bubble, 'bubble-below'], [menu, 'menu-below']]) {
      if (overlay.hidden) continue;
      const width = overlay.offsetWidth;
      const viewportWidth = document.documentElement.clientWidth;
      const x = Math.max(12, Math.min(box.left + (box.width - width) / 2, viewportWidth - width - 12));
      overlay.style.left = `${x - box.left}px`;
      if (pet.classList.contains('is-flow')) {
        pet.classList.remove(className);
        overlay.style.top = 'auto';
        overlay.style.bottom = 'calc(100% + 8px)';
        continue;
      }
      const below = box.top < overlay.offsetHeight + 16;
      pet.classList.toggle(className, below);
      const y = below ? box.bottom + 8 : box.top - overlay.offsetHeight - 8;
      overlay.style.bottom = 'auto';
      overlay.style.top = `${Math.max(12, Math.min(y, innerHeight - overlay.offsetHeight - 12)) - box.top}px`;
    }
  };
  const topLimit = () => {
    const bar = header ? header.getBoundingClientRect() : null;
    // Keep her out from under the sticky nav so she can never sit on top of it.
    return Math.max(10, (bar && bar.bottom > 0 ? bar.bottom : 0) + 8);
  };
  const position = (x, y) => {
    const box = pet.getBoundingClientRect();
    pet.style.left = `${Math.max(10, Math.min(x, innerWidth - box.width - 10))}px`;
    pet.style.top = `${Math.max(topLimit(), Math.min(y, innerHeight - box.height - 10))}px`;
    pet.style.right = 'auto';
    pet.style.bottom = 'auto';
    placeBubble();
  };
  // ---- Docking -----------------------------------------------------------
  // A fixed bottom-right corner parked her on top of the home sidebar and on
  // article tables of contents. Docking measures the page instead: it prefers
  // the empty margin outside the text column, then whichever corner she covers
  // least, and shrinks her rather than sit on something a reader needs.
  const PROTECTED = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,time,img,table,pre,blockquote,figcaption,footer,input,textarea,select,button,summary,a,.toc,.lab-repro,.mini-project,.home-aside,.profile-grid';
  // Two tiers, because not all pixels cost the same. Losing a link or a whole
  // sidebar card is a real defect; grazing a paragraph's last character is not.
  const CRITICAL = 'a,button,input,textarea,select,label,summary,.toc,.home-aside,.profile-grid,.mini-project,.lab-repro';
  let userMoved = false;   // once you drag her somewhere, docking stops arguing
  let dockBand = null;     // the range she may stroll in without leaving her spot
  const protectedRects = () => {
    const rects = [];
    const scrolled = scrollY;
    for (const el of document.querySelectorAll(PROTECTED)) {
      if (pet.contains(el) || workstation?.contains(el)) continue;
      // A sidebar card already contains the links inside it, so counting both
      // would multiply the same pixels and skew the choice.
      if (el.querySelector('a,button')) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 3 || box.height < 3) continue;
      rects.push({
        l: box.left, r: box.right,
        t: box.top + scrolled, b: box.bottom + scrolled,
        w: el.matches(CRITICAL) || el.closest(CRITICAL) ? 1000 : 1
      });
    }
    return rects;
  };
  const textColumn = () => {
    const box = document.querySelector('.reading-layout') || document.querySelector('main');
    if (!box) return {left: 0, right: 0};
    const r = box.getBoundingClientRect();
    return {left: Math.max(0, r.left), right: Math.max(0, innerWidth - r.right)};
  };
  const scrollSamples = maxScroll => {
    const out = [0];
    for (let s = 600; s < maxScroll; s += 600) out.push(s);
    if (maxScroll > 0) out.push(maxScroll);
    return out;
  };
  const coverScore = (x, y, w, h, rects, samples) => {
    // Score the silhouette rather than the square: the artwork's corners are empty.
    const left = x + w * .12, right = x + w * .9;
    const top = y + w * .03, bottom = y + w * .97;
    let critical = 0, cosmetic = 0;
    for (const s of samples) {
      const t = top + s, b = bottom + s;
      for (const q of rects) {
        const oy = Math.min(b, q.b) - Math.max(t, q.t);
        if (oy <= 0) continue;
        const ox = Math.min(right, q.r) - Math.max(left, q.l);
        if (ox <= 0) continue;
        const area = ox * oy;
        if (q.w > 1) critical += area; else cosmetic += area;
      }
      const tt = y + h - 34 + s, tb = y + h + s;   // her buttons are real targets too
      for (const q of rects) {
        const oy = Math.min(tb, q.b) - Math.max(tt, q.t);
        if (oy <= 0) continue;
        const ox = Math.min(x + w, q.r) - Math.max(x, q.l);
        if (ox > 0) (q.w > 1 ? critical += ox * oy : cosmetic += ox * oy * .5);
      }
    }
    return {critical, cosmetic, total: critical * 1000 + cosmetic};
  };
  const leaveFlow = () => {
    if (!pet.classList.contains('is-flow')) return;
    const box = pet.getBoundingClientRect();
    pet.classList.remove('is-flow');
    workstation?.classList.add('is-vacant');
    pet.style.width = `${box.width}px`;
    position(box.x, box.y);
  };
  const dockInFlow = () => {
    pet.classList.add('is-flow');
    workstation?.classList.remove('is-vacant');
    for (const name of ['left', 'top', 'right', 'bottom', 'width']) pet.style.removeProperty(name);
    dockBand = null;
    placeBubble();
  };
  const dock = () => {
    if (hidden) return;
    if (innerWidth <= 760) { dockInFlow(); return; }
    const column = textColumn();
    const maxW = Math.min(170, Math.floor((innerHeight - 80) * 2 / 3));
    const rects = protectedRects();
    const samples = scrollSamples(Math.max(0, document.documentElement.scrollHeight - innerHeight));
    const widths = [maxW, Math.round(maxW * .87), Math.round(maxW * .74), Math.round(maxW * .62)]
      .filter((w, i, all) => w >= 88 && all.indexOf(w) === i);
    // A real clear side margin is required. The old least-bad overlapping corner
    // is no longer an automatic fallback; the page has a dedicated paper edge.
    for (const w of widths) {
      for (const side of ['right', 'left']) {
        const space = column[side];
        if (space < w + 12) continue;
        pet.style.width = `${w}px`;
        const h = pet.offsetHeight || Math.round(w * 1.21);
        const x = side === 'right' ? innerWidth - w - 10 : 10;
        const y = Math.max(topLimit(), innerHeight - h - 18);
        const score = coverScore(x, y, w, h, rects, samples);
        if (score.total !== 0) continue;
        leaveFlow();
        pet.style.width = `${w}px`;
        dockBand = side === 'right'
          ? {min: innerWidth - space + 2, max: innerWidth - w - 10}
          : {min: 10, max: Math.max(10, space - w - 2)};
        position(x, y);
        return;
      }
    }
    dockInFlow();
  };
  const save = () => {
    const box = pet.getBoundingClientRect();
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        v: STORAGE_VERSION, auto: !userMoved,
        hidden, quiet,
        x: Math.round(box.x), y: Math.round(box.y),
        w: hidden ? undefined : Math.round(box.width)
      }));
    } catch { /* The pet still works without persistence. */ }
  };
  const closeMenu = () => {
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  };
  // One pose lane owns every gesture, sleep transition and locomotion. Cancelling
  // it invalidates its timer before another action can change the visible pose.
  const visual = pet.querySelector('.pet-visual');
  const sprite = pet.querySelector('.pet-sprite');
  const REST_POSE = 20;
  let motion = 'idle', pose = REST_POSE, motionToken = 0, motionTimer, bodyAnimation;
  let pendingAction = null;
  const animated = () => !quiet && !reducedMotion.matches;
  const paintPose = (layer, frame) => {
    const bridge = frame >= 20, index = bridge ? frame - 20 : frame;
    layer.style.backgroundImage = `url('/img/pet/field-notes/${bridge ? 'transitions' : 'actions'}.webp')`;
    layer.style.backgroundSize = bridge ? '400% 400%' : '400% 500%';
    layer.style.backgroundPosition = `${index % 4 * 100 / 3}% ${Math.floor(index / 4) * (bridge ? 100 / 3 : 25)}%`;
  };
  // One opaque pose only: even a 32ms old/new overlap produced double outlines.
  // Continuity comes from the authored inbetweens and their hold time, not fades.
  const setPose = frame => {
    if (frame === pose) return;
    pose = frame;
    paintPose(sprite, frame);
    pet.dataset.pose = String(frame);
  };
  const setMotion = name => {
    motion = name;
    pet.dataset.motion = name;
    for (const state of ['sleeping', 'napping', 'waking', 'dragging', 'flying']) {
      pet.classList.toggle(`is-${state}`, name === state);
    }
    pet.classList.toggle('is-walking', ['walk-start', 'walking', 'walk-stop'].includes(name));
  };
  const cancelMotion = () => {
    const transform = getComputedStyle(visual).transform;
    ++motionToken;
    clearTimeout(motionTimer);
    bodyAnimation?.cancel();
    bodyAnimation = null;
    visual.style.removeProperty('transform');
    return transform;
  };
  const rest = () => {
    cancelMotion();
    pendingAction = null;
    setMotion('idle');
    pet.dataset.phase = 'rest';
    setPose(REST_POSE);
  };
  // Each step is [pose, milliseconds, phase]. Give every displayed pose its full
  // hold time; a busy main thread must not trigger a burst of overdue frames.
  const run = (name, steps, {end = 'idle', keys, done} = {}) => {
    const from = cancelMotion();
    const token = motionToken;
    setMotion(name);
    const duration = steps.reduce((sum, step) => sum + step[1], 0);
    if (!keys && animated() && from !== 'none') {
      bodyAnimation = visual.animate([{transform: from}, {transform: 'none'}], {duration: 140, easing: 'ease-out', fill: 'both'});
    }
    if (keys && animated()) {
      bodyAnimation = visual.animate([{transform: from}, ...keys, {transform: 'none'}], {
        duration, easing: 'ease-in-out', fill: 'both'
      });
    }
    let index = 0;
    const step = () => {
      if (token !== motionToken) return;
      if (index === steps.length) {
        bodyAnimation?.cancel();
        bodyAnimation = null;
        setMotion(end);
        pet.dataset.phase = 'rest';
        setPose(end === 'sleeping' ? 18 : REST_POSE);
        done?.();
        return;
      }
      const [frame, ms, phase = 'perform'] = steps[index++];
      pet.dataset.phase = phase;
      setPose(frame);
      motionTimer = setTimeout(step, ms);
    };
    step();
  };
  // Both atlases must decode before replacing the neutral fallback. The rest
  // image is exactly the first cell of the transition sheet.
  let decodedAtlases = 0;
  for (const name of ['actions', 'transitions']) {
    const atlas = new Image();
    atlas.fetchPriority = 'low';
    atlas.decoding = 'async';
    atlas.onload = async () => {
      try { await atlas.decode(); } catch { return; }
      if (++decodedAtlases !== 2) return;
      paintPose(sprite, pose);
      sprite.hidden = false;
      pet.classList.add('has-motions');
    };
    atlas.src = `/img/pet/field-notes/${name}.webp`;
  }

  const ACTIONS = {
    wave: {steps: [[20, 180, 'prepare'], [21, 170, 'prepare'], [22, 180], [0, 180], [1, 220], [2, 260], [1, 240], [3, 360], [1, 240], [0, 160, 'recover'], [22, 180, 'recover'], [21, 180, 'recover'], [20, 230, 'recover']]},
    read: {steps: [[20, 160, 'prepare'], [23, 220], [4, 180], [24, 260], [5, 800], [6, 400], [5, 700], [7, 420], [5, 220, 'recover'], [24, 240, 'recover'], [4, 200, 'recover'], [23, 200, 'recover'], [20, 250, 'recover']]},
    stretch: {steps: [[20, 160, 'prepare'], [25, 180], [8, 380], [9, 400], [26, 260], [10, 650], [26, 220, 'recover'], [27, 220, 'recover'], [11, 180, 'recover'], [21, 180, 'recover'], [20, 230, 'recover']],
      keys: [{transform: 'translateY(-2px) scale(.99, 1.02)'}, {transform: 'translateY(-3px) scale(.99, 1.025)'}]},
    yawn: {steps: [[20, 160, 'prepare'], [25, 200], [8, 650], [9, 450], [8, 260], [25, 200, 'recover'], [21, 180, 'recover'], [20, 220, 'recover']]},
    nod: {steps: [[20, 1100]], keys: [{transform: 'translateY(3px) rotate(1deg)'}, {transform: 'translateY(1px)'}]},
    peer: {steps: [[20, 180, 'prepare'], [23, 220], [24, 260], [7, 850], [24, 220], [23, 200], [20, 220, 'recover']],
      keys: [{transform: 'translateX(-2px) rotate(-2deg)'}, {transform: 'translateX(-2px) rotate(-2deg)'}]},
    'look-around': {steps: [[20, 800], [31, 90], [20, 1120], [31, 90], [20, 800]], keys: [{transform: 'rotate(-2deg)'}, {transform: 'rotate(2deg)'}]},
    shrug: {steps: [[21, 240], [22, 380], [21, 300], [20, 320, 'recover']],
      keys: [{transform: 'rotate(2deg)'}, {transform: 'rotate(-2deg)'}]},
    perk: {steps: [[20, 950]], keys: [{transform: 'translateY(-4px)'}, {transform: 'translateY(-1px)'}]},
    cheer: {steps: [[21, 180, 'prepare'], [0, 200], [3, 750], [1, 220], [22, 180], [21, 180], [20, 240, 'recover']],
      keys: [{transform: 'translateY(-4px)'}, {transform: 'translateY(-1px)'}]},
    settle: {steps: [[28, 110, 'land'], [23, 130, 'recover'], [20, 220, 'recover']],
      keys: [{transform: 'translateY(2px) scale(1.025, .97)'}, {transform: 'translateY(-1px)'}]},
    jump: {steps: [[28, 160, 'prepare'], [3, 360, 'airborne'], [28, 180, 'land'], [23, 100, 'recover'], [20, 160, 'recover']],
      keys: [{transform: 'translateY(3px) scale(1.025, .97)', offset: .15},
        {transform: 'translateY(-24px) rotate(-3deg)', offset: .38},
        {transform: 'translateY(0)', offset: .58},
        {transform: 'translateY(1px)', offset: .68}, {transform: 'translateY(-1px)', offset: .82}]}
  };
  // Mid-action replies first put the book/hand away instead of teleporting from
  // an open-book or raised-arm pose. A second request replaces, not extends, it.
  const recoverySteps = () => {
    if (['walk-start', 'walking', 'walk-stop'].includes(motion)) {
      if (![12, 13, 14, 15, 32, 33, 34, 35].includes(pose)) return [[23, 160, 'recover'], [20, 160, 'recover']];
      const plant = [12, 32, 13, 33].includes(pose) ? 12 : 14;
      return [[plant, 140, 'plant'], [23, 160, 'recover'], [20, 160, 'recover']];
    }
    if ([4, 5, 6, 7, 24].includes(pose)) return [[24, 140, 'recover'], [23, 140, 'recover'], [20, 140, 'recover']];
    if ([8, 9, 10, 11, 25, 26, 27].includes(pose)) return [[27, 160, 'recover'], [21, 140, 'recover'], [20, 140, 'recover']];
    if (motion === 'jump') return [[28, 90, 'land'], [23, 80, 'recover'], [20, 70, 'recover']];
    if ([0, 1, 2, 3, 22].includes(pose)) return [[22, 140, 'recover'], [21, 140, 'recover'], [20, 160, 'recover']];
    return [];
  };
  const finishPending = () => {
    const next = pendingAction;
    pendingAction = null;
    if (next) play(next);
  };
  let flight = null, wanderTimer, walkRaf;
  const stopWalk = (reset = true) => {
    cancelAnimationFrame(walkRaf);
    walkRaf = null;
    if (reset && ['walk-start', 'walking', 'walk-stop'].includes(motion)) rest();
  };
  const stopFlight = () => {
    if (flight) cancelAnimationFrame(flight.raf);
    flight = null;
    if (motion === 'flying') rest();
  };
  const play = name => {
    if (hidden || drag || document.hidden) return;
    if (['sleeping', 'napping', 'waking'].includes(motion)) {
      pendingAction = name; // Latest intent wins; never replay a backlog of clicks.
      wake();
      return;
    }
    if (motion === 'recovering') { pendingAction = name; return; }
    const recovery = animated() && name !== 'jump' && name !== 'settle' ? recoverySteps() : [];
    stopWalk(false); // Preserve the visible gait pose for its planted recovery.
    stopFlight();
    if (!animated()) { rest(); return; }
    if (recovery.length) {
      pendingAction = name;
      run('recovering', recovery, {done: finishPending});
      return;
    }
    if (name === 'stroll') { rest(); wander(); return; }
    const action = ACTIONS[name];
    run(name, action.steps, {keys: action.keys});
  };
  const canIdle = () => !hidden && animated() && !document.hidden && !drag && !flight && menu.hidden && motion === 'idle';
  const wander = () => {
    clearTimeout(wanderTimer);
    wanderTimer = setTimeout(wander, 25000 + Math.random() * 20000);
    if (!canIdle() || pet.classList.contains('is-flow')) return;
    const box = pet.getBoundingClientRect();
    const lane = dockBand || {min: 10, max: Math.max(10, innerWidth - box.width - 10)};
    const distance = 60 + Math.random() * 140;
    const direction = Math.random() < .5 ? -1 : 1;
    let targetX = box.x + direction * distance;
    if (targetX < lane.min || targetX > lane.max) targetX = box.x - direction * distance;
    targetX = Math.max(lane.min, Math.min(targetX, lane.max));
    if (Math.abs(targetX - box.x) < 12) { play('look-around'); return; }
    pet.classList.toggle('face-right', targetX > box.x);
    run('walk-start', [[20, 160, 'prepare'], [23, 240, 'prepare']], {done: () => {
      const began = performance.now();
      // Speed and stride scale together, so the small mobile pet does not
      // cycle her feet faster than the desktop pet.
      const duration = Math.abs(targetX - box.x) / (box.width * .00021);
      const stride = box.width * .42;
      const gait = [12, 32, 13, 33, 14, 34, 15, 35];
      cancelMotion();
      const token = motionToken;
      setMotion('walking');
      setPose(gait[0]); // No one-frame neutral flash before the first RAF.
      pet.dataset.phase = 'perform';
      const step = now => {
        if (token !== motionToken) return;
        const t = Math.min(1, (now - began) / duration);
        const eased = t * t * (3 - 2 * t);
        const distance = Math.abs(targetX - box.x) * eased;
        const phase = distance / stride;
        setPose(gait[Math.floor(phase * 8) % 8]);
        visual.style.transform = `translateY(${-(Math.sin(phase * Math.PI * 2) ** 2) * box.width * .007}px)`;
        position(box.x + (targetX - box.x) * eased, box.y);
        if (t < 1) { walkRaf = requestAnimationFrame(step); return; }
        walkRaf = null;
        const plant = [12, 32, 13, 33].includes(pose) ? 12 : 14;
        run('walk-stop', [[plant, 160, 'plant'], [23, 200, 'recover'], [20, 240, 'recover']], {done: save});
      };
      walkRaf = requestAnimationFrame(step);
    }});
  };

  const nap = () => {
    clearTimeout(idleTimer);
    clearTimeout(bubbleTimer);
    pendingAction = null;
    stopWalk();
    stopFlight();
    bubble.hidden = true;
    avatar.setAttribute('aria-label', '小江正在打盹；点击唤醒，也可拎起拖动或用方向键移动');
    if (!animated()) {
      cancelMotion();
      setMotion('sleeping');
      setPose(18);
      return;
    }
    run('napping', [[25, 170, 'drowsy'], [8, 300, 'drowsy'], [16, 450, 'drowsy'], [23, 180, 'crouch'], [28, 220, 'crouch'], [29, 240, 'crouch'], [30, 260, 'sit'], [17, 400, 'sit'], [18, 450, 'doze']], {end: 'sleeping'});
  };
  const wake = () => {
    clearTimeout(idleTimer);
    if (!hidden && !quiet && !document.hidden) idleTimer = setTimeout(() => {
      if (canIdle()) nap();
      else if (!['sleeping', 'napping'].includes(motion)) wake();
    }, 45000);
    avatar.setAttribute('aria-label', avatarLabel);
    if (!['sleeping', 'napping', 'waking'].includes(motion)) return;
    if (hidden || !animated() || document.hidden) { rest(); return; }
    if (motion === 'waking') return; // Repeated pointer/keyboard activity must not restart waking.
    const steps = [17, 18, 30].includes(pose)
      ? [[17, 250, 'sit'], [30, 240, 'stand'], [29, 240, 'stand'], [28, 220, 'stand'], [23, 200, 'stand'], [20, 250, 'recover']]
      : pose === 29 ? [[29, 180, 'stand'], [28, 180, 'stand'], [23, 180], [20, 220, 'recover']]
      : pose === 28 ? [[28, 180, 'stand'], [23, 180], [20, 220, 'recover']]
      : [[pose, 140, 'stand'], [25, 160], [21, 160], [20, 200, 'recover']];
    run('waking', steps, {done: finishPending});
  };

  const fling = (velocityX, velocityY) => {
    stopFlight();
    stopWalk();
    cancelMotion();
    clearTimeout(idleTimer);
    pendingAction = null;
    setMotion('flying');
    setPose(19);
    const box = pet.getBoundingClientRect();
    flight = {x: box.left, y: box.top,
      vx: Math.max(-1.4, Math.min(1.4, velocityX * 2.2)),
      vy: Math.max(-1.6, Math.min(.6, velocityY * 2.2)),
      raf: 0, last: performance.now(), began: performance.now()};
    const step = now => {
      if (!flight) return;
      const dt = Math.min(32, now - flight.last);
      flight.last = now;
      flight.vy += .0032 * dt;
      flight.x += flight.vx * dt;
      flight.y += flight.vy * dt;
      const size = pet.getBoundingClientRect();
      const maxX = Math.max(10, innerWidth - size.width - 10);
      const floor = topLimit(), maxY = Math.max(floor, innerHeight - size.height - 10);
      if (flight.x < 10) { flight.x = 10; flight.vx = Math.abs(flight.vx) * .62; }
      if (flight.x > maxX) { flight.x = maxX; flight.vx = -Math.abs(flight.vx) * .62; }
      if (flight.y < floor) { flight.y = floor; flight.vy = Math.abs(flight.vy) * .62; }
      if (flight.y >= maxY) {
        flight.y = maxY;
        const bounce = Math.abs(flight.vy) * .55;
        flight.vx *= .82;
        position(flight.x, flight.y); // Commit the contact point before saving/ending flight.
        if ((bounce < .35 && Math.abs(flight.vx) < .12) || now - flight.began > 4000) {
          stopFlight();
          play('settle');
          save();
          wake();
          return;
        }
        flight.vy = -bounce;
      }
      position(flight.x, flight.y);
      flight.raf = requestAnimationFrame(step);
    };
    flight.raf = requestAnimationFrame(step);
  };
  const updateQuiet = () => {
    pet.classList.toggle('is-quiet', quiet);
    quietButton.setAttribute('aria-pressed', String(quiet));
    quietButton.textContent = quiet ? '恢复活泼' : '安静陪伴';
  };
  const cancelDrag = () => {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (previous.moved) {
      userMoved = true;
      dockBand = null;
      lastDrag = performance.now();
    }
    if (avatar.hasPointerCapture(previous.id)) avatar.releasePointerCapture(previous.id);
    pet.style.removeProperty('--pet-lift-angle');
    rest();
    save();
  };
  const collapse = value => {
    hidden = value;
    cancelDrag();
    closeMenu();
    stopWalk();
    stopFlight();
    rest();
    wake();
    stage.hidden = value;
    restore.hidden = !value;
    pet.classList.toggle('is-collapsed', value);
    bubble.hidden = true;
    clearTimeout(bubbleTimer);
    if (value) { pet.style.removeProperty('width'); return; }
    if (userMoved) {
      const box = pet.getBoundingClientRect();
      position(box.x, box.y);
    } else dock();
  };
  updateQuiet();
  wake();
  const savedOwnSpot = saved.v === STORAGE_VERSION && saved.auto === false
    && Number.isFinite(saved.x) && Number.isFinite(saved.y);
  if (savedOwnSpot) {
    leaveFlow();
    userMoved = true;
    if (Number.isFinite(saved.w)) pet.style.width = `${saved.w}px`;
    position(saved.x, saved.y);
  } else dock();
  if (hidden) collapse(true);
  let lastIdleAction = '';
  const idlePose = () => {
    clearTimeout(idlePoseTimer);
    idlePoseTimer = setTimeout(idlePose, 16000 + Math.random() * 14000);
    if (!canIdle()) return;
    const pool = ['read', 'stretch', 'yawn', 'look-around'].filter(name => name !== lastIdleAction);
    lastIdleAction = pool[Math.floor(Math.random() * pool.length)];
    play(lastIdleAction);
  };
  idlePoseTimer = setTimeout(idlePose, 18000);
  wanderTimer = setTimeout(wander, 27000);
  const speak = (text, action = 'wave') => {
    wake();
    closeMenu();
    const lines = messages[document.querySelector('main').dataset.page] || messages.首页;
    let line = text;
    if (!line) {
      if (firstLine) { firstLine = false; line = timeGreeting(); }
      else line = lines[messageIndex++ % lines.length];
    }
    bubble.textContent = line;
    bubble.hidden = false;
    placeBubble();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 6000);
    play(action);
  };
  const jump = () => speak('接住今天的一点小开心！', 'jump');
  // Rapid clicking builds a streak: she gets more excited the more you poke her.
  let streak = 0, streakTimer;
  const combos = [
    '哎，怎么啦？',
    '别戳啦，我在呢。',
    '再戳我就要生气了哦……开玩笑的。',
    '好啦好啦，我投降！你是不是闲下来了？'
  ];
  avatar.addEventListener('click', event => {
    // She only reacts to clicks she really is under; otherwise hand the click
    // to whatever the reader could see through her—the link still works.
    const below = event.detail !== 0 ? yieldTarget(event.clientX, event.clientY) : null;
    if (below) { below.click(); return; }
    if (event.detail !== 0 && performance.now() - lastDrag <= 250) return;
    const now = performance.now();
    streak += 1;
    clearTimeout(streakTimer);
    streakTimer = setTimeout(() => { streak = 0; }, 3000);
    if (event.detail !== 0 && now - lastTap < 320) {
      jump();
      lastTap = -Infinity;
    } else if (streak >= 3) {
      speak(combos[Math.min(streak - 3, combos.length - 1)], 'shrug');
      lastTap = event.detail === 0 ? -Infinity : now;
    } else {
      speak();
      lastTap = event.detail === 0 ? -Infinity : now;
    }
  });
  // Right-click opens the menu too, the way desktop pets usually behave.
  avatar.addEventListener('contextmenu', event => {
    event.preventDefault();
    stopWalk();
    stopFlight();
    wake();
    const opening = menu.hidden;
    closeMenu();
    bubble.hidden = true;
    if (opening) {
      menu.hidden = false;
      menuToggle.setAttribute('aria-expanded', 'true');
      placeBubble();
    }
  });
  menuToggle.addEventListener('click', () => {
    stopWalk();
    stopFlight();
    wake();
    const opening = menu.hidden;
    closeMenu();
    bubble.hidden = true;
    if (opening) {
      menu.hidden = false;
      menuToggle.setAttribute('aria-expanded', 'true');
      placeBubble();
    }
  });
  menu.addEventListener('click', event => {
    const action = event.target.closest('[data-pet-action]')?.dataset.petAction;
    if (!action) return;
    closeMenu();
    menuToggle.focus({preventScroll: true});
    if (action === 'jump') jump();
    if (action === 'read') speak('这页我也想再看一遍。', 'read');
    if (action === 'stretch') speak('伸个懒腰，继续慢慢来。', 'stretch');
    if (action === 'nap') nap();
    if (action === 'stroll') {
      leaveFlow();
      userMoved = true;
      dockBand = null;
      save();
      wake();
      play('stroll');
    }
    if (action === 'cheer') speak(praise[Math.floor(Math.random() * praise.length)], 'cheer');
    if (action === 'reset') {
      stopWalk();
      stopFlight();
      rest();
      userMoved = false;
      dock();
      save();
      speak('回到不挡字的位置啦，继续陪你读。', 'settle');
    }
    if (action === 'top') {
      scrollTo({top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
      speak('到啦，从这里重新出发。', 'look-around');
    }
    if (action === 'quiet') {
      quiet = !quiet;
      stopWalk();
      stopFlight();
      rest();
      updateQuiet();
      save();
      speak(quiet ? '好，我安静陪着你。' : '小江又精神起来啦。', quiet ? 'settle' : 'perk');
    }
  });
  document.addEventListener('pointerdown', event => {
    wake();
    if (!pet.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', wake);
  let lastVisible = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !quiet && !hidden) {
      const away = Date.now() - lastVisible;
      lastVisible = Date.now();
      // Only comment if you were actually away for a while.
      if (away > 90000 && !drag) {
        setTimeout(() => {
          if (!hidden && !quiet && !document.hidden) speak('回来啦，我一直在。', 'perk');
        }, 800);
      }
    } else if (document.hidden) {
      lastVisible = Date.now();
      cancelDrag();
      stopWalk();
      stopFlight();
      rest();
      save();
    }
    wake();
  });
  reducedMotion.addEventListener('change', () => {
    cancelDrag();
    stopWalk();
    stopFlight();
    rest();
    wake();
    save();
  });
  // Reading means scrolling. Without this she fell asleep 45s into every article.
  let lastAwake = 0;
  let reachedEnd = false;
  document.addEventListener('scroll', () => {
    const now = performance.now();
    // She notices when you reach the bottom of an article, once per page.
    if (!reachedEnd && !quiet && !hidden) {
      const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 120;
      if (atEnd && scrollY > 400) {
        reachedEnd = true;
        setTimeout(() => {
          if (!hidden && !quiet && !document.hidden && menu.hidden && !drag && motion === 'idle') speak('读完了？要不要去项目页看看这些是怎么做出来的。', 'nod');
        }, 600);
      }
    }
    if (now - lastAwake < 2000) return;
    lastAwake = now;
    wake();
  }, {passive: true});
  const hitLayer = pet.querySelector('.pet-hit');
  // What the reader would hit if she were not in the way. Her own layer is on
  // top, so it has to be switched off for the question to have an answer.
  const underPointer = (x, y) => {
    if (!hitLayer) return null;
    const previous = hitLayer.style.pointerEvents;
    hitLayer.style.pointerEvents = 'none';
    const element = document.elementFromPoint(x, y);
    hitLayer.style.pointerEvents = previous;
    return element;
  };
  // On a narrow window there may be nowhere to stand that is fully clear, so
  // the pixel decides: where a link or button is what the reader sees under the
  // pointer, the click belongs to the page. Returns that element, or null.
  const yieldTarget = (x, y) => {
    const below = underPointer(x, y);
    return below && below.closest('a,button,input,textarea,select,label,summary') ? below : null;
  };
  avatar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    if (yieldTarget(event.clientX, event.clientY)) return;
    wake();
    closeMenu();
    stopWalk();
    stopFlight();
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, previousX: event.clientX, previousY: event.clientY, previousT: event.timeStamp, velocityX: 0, velocityY: 0, moved: false};
    avatar.setPointerCapture(event.pointerId);
  });
  avatar.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    // On touch the browser owns vertical panning (touch-action: pan-y), so a mostly
    // vertical swipe is someone reading the page, not picking her up.
    if (!drag.moved && event.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) return;
    if (!drag.moved) {
      leaveFlow();
      cancelMotion();
      pendingAction = null;
      setMotion('dragging');
      setPose(19);
      bubble.hidden = true;
      drag.moved = true;
    }
    const angle = quiet || reducedMotion.matches ? 0 : Math.max(-8, Math.min(8, (event.clientX - drag.previousX) * -.35));
    pet.style.setProperty('--pet-lift-angle', `${angle}deg`);
    const elapsed = Math.max(1, event.timeStamp - drag.previousT);
    // px per ms, smoothed so one jittery sample cannot fake a throw.
    drag.velocityX = .7 * drag.velocityX + .3 * ((event.clientX - drag.previousX) / elapsed);
    drag.velocityY = .7 * drag.velocityY + .3 * ((event.clientY - drag.previousY) / elapsed);
    drag.previousX = event.clientX;
    drag.previousY = event.clientY;
    drag.previousT = event.timeStamp;
    const width = avatar.offsetWidth;
    // Keep the raised jacket collar under the pointer while the body hangs below.
    position(event.clientX - width * (pet.classList.contains('face-right') ? .52 : .48), event.clientY - width * .46);
  });
  const endDrag = (event, cancelled = false) => {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved;
    // A fast move followed by a pause is a placement, not a delayed throw.
    const fresh = event.timeStamp - drag.previousT < 100;
    const velocity = {x: fresh ? drag.velocityX : 0, y: fresh ? drag.velocityY : 0};
    drag = null;
    pet.style.removeProperty('--pet-lift-angle');
    if (!moved) return;
    lastDrag = performance.now();
    lastTap = -Infinity;
    rest();
    wake();
    userMoved = true;
    dockBand = null;
    if (!cancelled && animated() && Math.hypot(velocity.x, velocity.y) > .35) fling(velocity.x, velocity.y);
    else {
      if (!cancelled) play('settle');
      save();
    }
  };
  avatar.addEventListener('pointerup', endDrag);
  avatar.addEventListener('pointercancel', event => endDrag(event, true));
  avatar.addEventListener('lostpointercapture', endDrag);
  pet.querySelector('.pet-hide').addEventListener('click', () => { collapse(true); save(); restore.focus(); });
  restore.addEventListener('click', () => { collapse(false); save(); avatar.focus(); });
  avatar.addEventListener('keydown', event => {
    const directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (directions[event.key]) {
      event.preventDefault();
      stopWalk();
      stopFlight();
      rest();
      wake();
      leaveFlow();
      const box = pet.getBoundingClientRect();
      const [x, y] = directions[event.key];
      const step = event.shiftKey ? 24 : 10;
      // Nudging her with the keyboard is a placement decision too, otherwise
      // the next reload would drop her back on the dock.
      userMoved = true;
      dockBand = null;
      position(box.x + x * step, box.y + y * step);
      save();
    }
  });
  pet.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    bubble.hidden = true;
    if (!menu.hidden) { closeMenu(); menuToggle.focus({preventScroll: true}); }
  });
  addEventListener('resize', () => {
    cancelDrag();
    stopWalk();
    stopFlight();
    // Only automatic placement follows the available page margins.
    if (!userMoved) { dock(); return; }
    const box = pet.getBoundingClientRect();
    position(box.x, box.y);
  });
})();
