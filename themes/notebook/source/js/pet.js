(() => {
  const pet = document.querySelector('#blog-pet');
  if (!pet) return;
  const avatar = pet.querySelector('.pet-avatar');
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
  let bubbleTimer, poseTimer, idleTimer;
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
  const position = (x, y) => {
    const box = pet.getBoundingClientRect();
    pet.style.left = `${Math.max(10, Math.min(x, innerWidth - box.width - 10))}px`;
    pet.style.top = `${Math.max(10, Math.min(y, innerHeight - box.height - 10))}px`;
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
  const wake = () => {
    clearTimeout(idleTimer);
    pet.classList.remove('is-sleeping');
    if (!hidden && !quiet && !document.hidden) idleTimer = setTimeout(() => {
      if (menu.hidden && !drag) pet.classList.add('is-sleeping');
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
    pet.classList.remove('is-petted', 'is-jumping');
    void pet.offsetWidth;
    pet.classList.add(pose);
    poseTimer = setTimeout(() => pet.classList.remove(pose), 1100);
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
    if (action === 'nap') {
      clearTimeout(idleTimer);
      clearTimeout(poseTimer);
      pet.classList.remove('is-petted', 'is-jumping');
      pet.classList.add('is-sleeping');
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
  avatar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    wake();
    closeMenu();
    const box = pet.getBoundingClientRect();
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: box.x, top: box.y, moved: false};
    avatar.setPointerCapture(event.pointerId);
  });
  avatar.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    pet.classList.add('is-dragging');
    position(drag.left + dx, drag.top + dy);
  });
  const endDrag = event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) { lastDrag = performance.now(); save(); }
    drag = null;
    pet.classList.remove('is-dragging');
  };
  avatar.addEventListener('pointerup', endDrag);
  avatar.addEventListener('pointercancel', endDrag);
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
