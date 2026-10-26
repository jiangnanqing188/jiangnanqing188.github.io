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
  let bubbleTimer, poseTimer, idleTimer, napTimer, squishTimer;
  let lastTap = -Infinity;
  const messages = {
    首页: ['你好呀，我是小江。点我打招呼，拖我换位置。', '今天也一起把想法写进笔记吧。', '先看看项目，再读一篇复盘吧。'],
    项目: ['好方案得跑起来，还得能回退。', '每个项目，都藏着一些现场才会遇到的问题。'],
    文章: ['慢慢读，遇到喜欢的段落可以停一会儿。', '失败的过程，往往比结论更有用。'],
    关于: ['很高兴认识你。江南的联系方式就在这页。', '欢迎来聊机器人、视觉，或者一个新想法。']
  };
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

  // Throw physics state lives here so nap() and collapse() can stop a throw safely.
  let flight = null;
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
          animate('is-landing');
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
  const animate = pose => {
    clearTimeout(poseTimer);
    pet.classList.remove('is-petted', 'is-jumping', 'is-landing', 'is-squish');
    void pet.offsetWidth;
    pet.classList.add(pose);
    poseTimer = setTimeout(() => pet.classList.remove(pose), 1100);
  };
  // Quick squash on click, so a poke feels physical rather than a static swap.
  const squish = () => {
    if (quiet || reducedMotion.matches) return;
    pet.classList.remove('is-squish');
    void pet.offsetWidth;
    pet.classList.add('is-squish');
    clearTimeout(squishTimer);
    squishTimer = setTimeout(() => pet.classList.remove('is-squish'), 420);
  };
  const speak = (text, pose = 'is-petted') => {
    wake();
    closeMenu();
    const lines = messages[document.querySelector('main').dataset.page] || messages.首页;
    bubble.textContent = text || lines[messageIndex++ % lines.length];
    bubble.hidden = false;
    placeBubble();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 6000);
    animate(pose);
  };
  const jump = () => speak('接住今天的一点小开心！', 'is-jumping');
  avatar.addEventListener('click', event => {
    if (event.detail !== 0 && performance.now() - lastDrag <= 250) return;
    squish();
    const now = performance.now();
    if (event.detail !== 0 && now - lastTap < 320) {
      jump();
      lastTap = -Infinity;
    } else {
      speak();
      lastTap = event.detail === 0 ? -Infinity : now;
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
    if (action === 'reset') {
      const box = pet.getBoundingClientRect();
      position(innerWidth - box.width - 22, innerHeight - box.height - 18);
      save();
      speak('回到右下角啦，继续陪你读。');
    }
    if (action === 'top') {
      scrollTo({top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
      speak('到啦，从这里重新出发。');
    }
    if (action === 'quiet') {
      quiet = !quiet;
      updateQuiet();
      save();
      speak(quiet ? '好，我安静陪着你。' : '小江又精神起来啦。');
    }
  });
  document.addEventListener('pointerdown', event => {
    wake();
    if (!pet.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', wake);
  document.addEventListener('visibilitychange', wake);
  // Reading means scrolling. Without this she fell asleep 45s into every article.
  let lastAwake = 0;
  document.addEventListener('scroll', () => {
    const now = performance.now();
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
      animate('is-landing');
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
