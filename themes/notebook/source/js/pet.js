(() => {
  const pet = document.querySelector('#blog-pet');
  if (!pet) return;
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
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* Storage may be disabled. */ }
  let hidden = saved.hidden === true;
  let quiet = saved.quiet === true;
  let drag = null;
  let lastDrag = -Infinity;
  let messageIndex = 0;
  let bubbleTimer, poseTimer, idleTimer, napTimer, squishTimer, idlePoseTimer;
  let lastDozed = -Infinity;
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
      const x = Math.max(12, Math.min(box.left + (box.width - width) / 2, innerWidth - width - 12));
      overlay.style.left = `${x - box.left}px`;
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
  const save = () => {
    const box = pet.getBoundingClientRect();
    try { localStorage.setItem(storageKey, JSON.stringify({hidden, quiet, x: box.x, y: box.y})); } catch { /* The pet still works without persistence. */ }
  };
  const closeMenu = () => {
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  };
  const stopNapTransition = () => {
    clearTimeout(napTimer);
    pet.classList.remove('is-napping', 'is-waking');
  };
  // Throw physics state lives up here so wander() can check it without a TDZ risk.
  let flight = null;
  // Wander: every so often she walks a short way along the bottom of the viewport.
  let wanderTimer, walkRaf;
  const stopWalk = () => {
    cancelAnimationFrame(walkRaf);
    pet.classList.remove('is-walking', 'walk-left');
    walkRaf = null;
  };
  const wander = () => {
    clearTimeout(wanderTimer);
    if (hidden || quiet || reducedMotion.matches || document.hidden || drag || flight) {
      wanderTimer = setTimeout(wander, 20000);
      return;
    }
    const box = pet.getBoundingClientRect();
    const maxX = innerWidth - box.width - 10;
    // Pick a target nearby rather than crossing the whole screen.
    const distance = 60 + Math.random() * 140;
    const direction = Math.random() < .5 ? -1 : 1;
    let targetX = box.x + direction * distance;
    if (targetX < 10 || targetX > maxX) targetX = box.x - direction * distance;
    targetX = Math.max(10, Math.min(targetX, maxX));
    const startX = box.x, startY = box.y;
    const duration = Math.abs(targetX - startX) / .06;
    pet.classList.add('is-walking');
    pet.classList.toggle('walk-left', targetX < startX);
    // face where she is heading: the art is drawn facing right by default
    pet.classList.toggle('face-left', targetX < startX);
    const began = performance.now();
    const step = now => {
      const t = Math.min(1, (now - began) / duration);
      position(startX + (targetX - startX) * t, startY);
      if (t < 1) { walkRaf = requestAnimationFrame(step); return; }
      pet.classList.remove('is-walking', 'walk-left');
      walkRaf = null;
      save();
      wanderTimer = setTimeout(wander, 25000 + Math.random() * 20000);
    };
    walkRaf = requestAnimationFrame(step);
  };
  wanderTimer = setTimeout(wander, 25000);

  const stopFlight = () => {
    if (flight) cancelAnimationFrame(flight.raf);
    flight = null;
    pet.classList.remove('is-flying');
  };
  const nap = () => {
    clearTimeout(idleTimer);
    clearTimeout(poseTimer);
    clearTimeout(bubbleTimer);
    stopWalk();
    stopFlight();
    bubble.hidden = true;
    pet.classList.remove('is-petted', 'is-jumping', 'is-landing');
    stopNapTransition();
    pet.classList.add('is-sleeping');
    if (!quiet && !reducedMotion.matches) {
      pet.classList.add('is-napping');
      napTimer = setTimeout(() => pet.classList.remove('is-napping'), 1800);
    }
    avatar.setAttribute('aria-label', '小江正在打盹；点击唤醒，也可拎起拖动或用方向键移动');
  };
  const fling = (velocityX, velocityY) => {
    stopFlight();
    stopWalk();
    clearTimeout(idleTimer);
    const box = pet.getBoundingClientRect();
    flight = {
      x: box.left, y: box.top,
      // px/ms scaled into a readable throw, capped so it never rockets off-screen.
      vx: Math.max(-1.4, Math.min(1.4, velocityX * 2.2)),
      vy: Math.max(-1.6, Math.min(0.6, velocityY * 2.2)),
      raf: 0, last: performance.now(), began: performance.now()
    };
    pet.classList.add('is-flying');
    const step = now => {
      if (!flight) return;
      const dt = Math.min(32, now - flight.last);
      flight.last = now;
      flight.vy += 0.0032 * dt;                 // gravity
      flight.x += flight.vx * dt;
      flight.y += flight.vy * dt;
      const size = pet.getBoundingClientRect();
      const maxX = innerWidth - size.width - 10;
      const maxY = innerHeight - size.height - 10;
      const floor = topLimit();
      if (flight.x < 10) { flight.x = 10; flight.vx = Math.abs(flight.vx) * .62; }
      if (flight.x > maxX) { flight.x = maxX; flight.vx = -Math.abs(flight.vx) * .62; }
      if (flight.y < floor) { flight.y = floor; flight.vy = Math.abs(flight.vy) * .62; }
      if (flight.y >= maxY) {
        flight.y = maxY;
        // Test the *bounce* velocity, not the impact velocity: at the moment of
        // contact vy is at its largest, so comparing that against a small rest
        // threshold would never settle her.
        const bounce = Math.abs(flight.vy) * .55;
        flight.vx *= .82;                       // ground friction
        const settled = bounce < .35 && Math.abs(flight.vx) < .12;
        if (settled || now - flight.began > 4000) {
          stopFlight();
          play('settle');
          save();
          return;
        }
        flight.vy = -bounce;
      }
      pet.style.left = `${flight.x}px`;
      pet.style.top = `${flight.y}px`;
      pet.style.right = 'auto';
      pet.style.bottom = 'auto';
      flight.raf = requestAnimationFrame(step);
    };
    flight.raf = requestAnimationFrame(step);
  };
  const wake = () => {
    clearTimeout(idleTimer);
    const sleeping = pet.classList.contains('is-sleeping');
    const enteringSleep = pet.classList.contains('is-napping');
    if (sleeping || hidden || quiet || reducedMotion.matches || document.hidden) stopNapTransition();
    pet.classList.remove('is-sleeping');
    if (sleeping && !enteringSleep && !hidden && !quiet && !reducedMotion.matches && !document.hidden) {
      pet.classList.add('is-waking');
      napTimer = setTimeout(() => pet.classList.remove('is-waking'), 1000);
    }
    avatar.setAttribute('aria-label', avatarLabel);
    if (!hidden && !quiet && !document.hidden) idleTimer = setTimeout(() => {
      if (menu.hidden && !drag) nap();
    }, 45000);
  };
  const updateQuiet = () => {
    pet.classList.toggle('is-quiet', quiet);
    quietButton.setAttribute('aria-pressed', String(quiet));
    quietButton.textContent = quiet ? '恢复活泼' : '安静陪伴';
  };
  const collapse = value => {
    hidden = value;
    closeMenu();
    stopWalk();
    stopFlight();
    wake();
    stage.hidden = value;
    restore.hidden = !value;
    pet.classList.toggle('is-collapsed', value);
    bubble.hidden = true;
    clearTimeout(bubbleTimer);
    const box = pet.getBoundingClientRect();
    position(box.x, box.y);
  };
  updateQuiet();
  wake();
  if (hidden) collapse(true);
  if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) position(saved.x, saved.y);
  // Semantic actions. Each one means something specific, instead of reusing a
  // generic wobble: waving back, nodding along, looking around, peeking, shrugging.
  const ACTIONS = {
    'wave':       { cls: 'act-wave',       ms: 1200 },  // 打招呼 / 回应你
    'nod':        { cls: 'act-nod',        ms: 900 },   // 同意、应声
    'peer':       { cls: 'act-peer',       ms: 1400 },  // 凑近看你在读什么
    'look-around':{ cls: 'act-look-around',ms: 2000 },  // 左右张望
    'shrug':      { cls: 'act-shrug',      ms: 1100 },  // 没办法、随你
    'perk':       { cls: 'act-perk',       ms: 800 },   // 听到动静，抬头
    'stretch':    { cls: 'act-stretch',    ms: 1500 },  // 伸懒腰
    'clap':       { cls: 'act-clap',       ms: 900 },   // 高兴、认可
    'settle':     { cls: 'act-settle',     ms: 1300 }   // 落地/安顿下来
  };
  const ACTION_CLASSES = Object.values(ACTIONS).map(a => a.cls);
  const play = name => {
    const action = ACTIONS[name] || ACTIONS.wave;
    // Quiet mode and reduced-motion users still get state changes, but no mime.
    if ((quiet || reducedMotion.matches) && name !== 'settle') return;
    clearTimeout(poseTimer);
    pet.classList.remove(...ACTION_CLASSES);
    void pet.offsetWidth;
    pet.classList.add(action.cls);
    poseTimer = setTimeout(() => pet.classList.remove(action.cls), action.ms);
  };
  // Kept for the older call sites that passed a raw class name.
  const animate = pose => {
    const byClass = Object.entries(ACTIONS).find(([, a]) => a.cls === pose);
    play(byClass ? byClass[0] : 'wave');
  };
  // She stretches a little at random while you read, so the idle state is not frozen.
  const idlePose = () => {
    clearTimeout(idlePoseTimer);
    if (hidden || quiet || reducedMotion.matches || document.hidden || drag || flight || !menu.hidden
        || pet.classList.contains('is-sleeping') || pet.classList.contains('is-walking')) {
      idlePoseTimer = setTimeout(idlePose, 15000);
      return;
    }
    // Idle should look like idling: glance around, stretch, or settle.
    // Never a greeting wave (that would mean you just arrived).
    const idleActions = ['look-around', 'stretch', 'peer'];
    play(idleActions[Math.floor(Math.random() * idleActions.length)]);
    idlePoseTimer = setTimeout(idlePose, 20000 + Math.random() * 25000);
  };
  idlePoseTimer = setTimeout(idlePose, 18000);

  // Quick squash on click, so a poke feels physical rather than a static swap.
  const squish = () => {
    if (quiet || reducedMotion.matches) return;
    pet.classList.remove('is-squish');
    void pet.offsetWidth;
    pet.classList.add('is-squish');
    clearTimeout(squishTimer);
    squishTimer = setTimeout(() => pet.classList.remove('is-squish'), 420);
  };
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
  const jump = () => { speak('接住今天的一点小开心！', 'clap'); pet.classList.add('is-jumping'); };
  // Rapid clicking builds a streak: she gets more excited the more you poke her.
  let streak = 0, streakTimer;
  const combos = [
    '哎，怎么啦？',
    '别戳啦，我在呢。',
    '再戳我就要生气了哦……开玩笑的。',
    '好啦好啦，我投降！你是不是闲下来了？'
  ];
  avatar.addEventListener('click', event => {
    if (event.detail !== 0 && performance.now() - lastDrag <= 250) return;
    squish();
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
    menuToggle.focus();
    if (action === 'jump') jump();
    if (action === 'nap') nap();
    if (action === 'stroll') { wake(); if (!quiet && !reducedMotion.matches) wander(); }
    if (action === 'cheer') speak(praise[Math.floor(Math.random() * praise.length)], 'clap');
    if (action === 'reset') {
      const box = pet.getBoundingClientRect();
      position(innerWidth - box.width - 22, innerHeight - box.height - 18);
      save();
      speak('回到右下角啦，继续陪你读。', 'settle');
    }
    if (action === 'top') {
      scrollTo({top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
      speak('到啦，从这里重新出发。', 'look-around');
    }
    if (action === 'quiet') {
      quiet = !quiet;
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
    }
    wake();
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
          if (!hidden && !quiet) speak('读完了？要不要去项目页看看这些是怎么做出来的。', 'nod');
        }, 600);
      }
    }
    if (now - lastAwake < 2000) return;
    lastAwake = now;
    wake();
  }, {passive: true});
  avatar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
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
      stopNapTransition();
      clearTimeout(poseTimer);
      pet.classList.remove('is-petted', 'is-jumping', 'is-landing');
      bubble.hidden = true;
      drag.moved = true;
      pet.classList.add('is-dragging');
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
    position(event.clientX - width * .61, event.clientY - width * .43);
  });
  const endDrag = (event, cancelled = false) => {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved && !cancelled;
    const throwVelocity = {x: drag.velocityX || 0, y: drag.velocityY || 0};
    drag = null;
    pet.classList.remove('is-dragging');
    pet.style.removeProperty('--pet-lift-angle');
    if (moved) {
      lastDrag = performance.now();
      lastTap = -Infinity;
      play('settle');
      wake();
      // Fling her: a fast release becomes a throw that bounces off the edges.
      const speed = Math.hypot(throwVelocity.x, throwVelocity.y);
      if (!quiet && !reducedMotion.matches && speed > 0.35) {
        fling(throwVelocity.x, throwVelocity.y);
      } else {
        save();
      }
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
      const box = pet.getBoundingClientRect();
      const [x, y] = directions[event.key];
      const step = event.shiftKey ? 24 : 10;
      position(box.x + x * step, box.y + y * step);
      save();
    }
  });
  pet.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    bubble.hidden = true;
    if (!menu.hidden) { closeMenu(); menuToggle.focus(); }
  });
  addEventListener('resize', () => {
    if (!pet.style.left) { placeBubble(); return; }
    const box = pet.getBoundingClientRect();
    position(box.x, box.y);
  });
})();
