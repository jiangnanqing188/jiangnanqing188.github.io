(() => {
  const pet = document.querySelector('#blog-pet');
  if (!pet) return;
  const avatar = pet.querySelector('.pet-avatar');
  const stage = pet.querySelector('.pet-stage');
  const bubble = pet.querySelector('.pet-bubble');
  const restore = pet.querySelector('.pet-restore');
  const storageKey = 'jiangnan-blog-pet-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* Storage may be disabled. */ }
  let hidden = saved.hidden === true;
  let drag = null;
  let lastDrag = -Infinity;
  let messageIndex = 0;
  let bubbleTimer, poseTimer;
  const messages = {
    首页: ['你好呀，我是小白。点我打招呼，拖我换位置。', '今天也一起把想法写进笔记吧。', '先看看项目，再读一篇复盘吧。'],
    项目: ['好方案得跑起来，还得能回退。', '每个项目，都藏着一些现场才会遇到的问题。'],
    文章: ['慢慢读，遇到喜欢的段落可以停一会儿。', '失败的过程，往往比结论更有用。'],
    关于: ['很高兴认识你。江南的联系方式就在这页。', '欢迎来聊机器人、视觉，或者一个新想法。']
  };
  const placeBubble = () => {
    if (bubble.hidden) return;
    const box = pet.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const x = Math.max(12, Math.min(box.left + (box.width - width) / 2, innerWidth - width - 12));
    bubble.style.left = `${x - box.left}px`;
    pet.classList.toggle('bubble-below', box.top < bubble.offsetHeight + 16);
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
    try { localStorage.setItem(storageKey, JSON.stringify({hidden, x: box.x, y: box.y})); } catch { /* The pet still works without persistence. */ }
  };
  const collapse = value => {
    hidden = value;
    stage.hidden = value;
    restore.hidden = !value;
    pet.classList.toggle('is-collapsed', value);
    bubble.hidden = true;
    clearTimeout(bubbleTimer);
    const box = pet.getBoundingClientRect();
    position(box.x, box.y);
  };
  if (hidden) collapse(true);
  if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) position(saved.x, saved.y);
  const speak = () => {
    const lines = messages[document.querySelector('main').dataset.page] || messages.首页;
    bubble.textContent = lines[messageIndex++ % lines.length];
    bubble.hidden = false;
    placeBubble();
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => { bubble.hidden = true; }, 6000);
    clearTimeout(poseTimer);
    pet.classList.remove('is-petted');
    void pet.offsetWidth;
    pet.classList.add('is-petted');
    poseTimer = setTimeout(() => pet.classList.remove('is-petted'), 1000);
  };
  avatar.addEventListener('click', event => { if (event.detail === 0 || performance.now() - lastDrag > 250) speak(); });
  avatar.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
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
  pet.addEventListener('keydown', event => { if (event.key === 'Escape') bubble.hidden = true; });
  addEventListener('resize', () => {
    if (!pet.style.left) return;
    const box = pet.getBoundingClientRect();
    position(box.x, box.y);
  });
})();
