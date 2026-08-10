(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const placedEl = document.getElementById('placed');
  const bestEl = document.getElementById('best');
  const nextEl = document.getElementById('next');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const slotsSel = document.getElementById('slots');

  const MAXV = 999;

  let S, slots, current, placed, gameState, flash;

  let best = +localStorage.getItem('numberline-best-' + (slotsSel.value || 15)) || 0;
  bestEl.textContent = best;

  function bestKey() { return 'numberline-best-' + S; }

  function newGame() {
    S = +slotsSel.value || 15;
    slots = new Array(S).fill(null);
    placed = 0;
    flash = null;
    gameState = 'play';
    best = +localStorage.getItem(bestKey()) || 0;
    bestEl.textContent = best;
    placedEl.textContent = 0;
    nextNumber();
    overlay.classList.remove('show');
    statusEl.textContent = 'Click an empty slot to drop the number in.';
    draw();
  }

  function nextNumber() {
    // avoid duplicates so ordering is never ambiguous
    let v;
    do { v = 1 + Math.floor(Math.random() * MAXV); }
    while (slots.includes(v));
    current = v;
    nextEl.textContent = v;
  }

  function legal(i) {
    if (slots[i] !== null) return false;
    for (let k = i - 1; k >= 0; k--) {
      if (slots[k] !== null) { if (slots[k] > current) return false; break; }
    }
    for (let k = i + 1; k < S; k++) {
      if (slots[k] !== null) { if (slots[k] < current) return false; break; }
    }
    return true;
  }

  function anyLegal() {
    for (let i = 0; i < S; i++) if (legal(i)) return true;
    return false;
  }

  function drop(i) {
    if (gameState !== 'play') return;
    if (!legal(i)) {
      statusEl.textContent = 'That slot would break the order.';
      return;
    }
    slots[i] = current;
    placed++;
    placedEl.textContent = placed;
    flash = {i, t: 12};

    if (placed === S) {
      finish(true);
      return;
    }
    nextNumber();
    if (!anyLegal()) finish(false);
    draw();
  }

  function finish(full) {
    gameState = 'over';
    if (placed > best) {
      best = placed;
      localStorage.setItem(bestKey(), best);
      bestEl.textContent = best;
    }
    overTitle.textContent = full ? 'Line complete' : 'No legal slot';
    overMsg.textContent = full
      ? 'All ' + S + ' numbers placed in order. Rare.'
      : placed + ' of ' + S + ' placed — ' + current + ' had nowhere to go.';
    overlay.classList.add('show');
    statusEl.textContent = full ? 'Perfect line.' : 'Run over.';
    draw();
  }

  /* ---------- drawing ---------- */

  function slotGeom() {
    const perRow = S <= 10 ? 5 : 5;
    const rows = Math.ceil(S / perRow);
    const swW = Math.min(96, (W - 40) / perRow - 10);
    const swH = 44;
    const gapX = (W - perRow * swW) / (perRow + 1);
    const totalH = rows * swH + (rows - 1) * 18;
    const top = (H - totalH) / 2 + 26;
    const out = [];
    for (let i = 0; i < S; i++) {
      const r = (i / perRow) | 0, c = i % perRow;
      out.push({x: gapX + c * (swW + gapX), y: top + r * (swH + 18), w: swW, h: swH});
    }
    return out;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // the number being placed
    if (gameState === 'play') {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 34px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(current, W / 2, 34);
      ctx.fillStyle = 'rgba(190,200,255,0.55)';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText('place this number', W / 2, 58);
    }

    const G = slotGeom();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < S; i++) {
      const b = G[i];
      const ok = gameState === 'play' && legal(i);
      if (slots[i] !== null) {
        const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        grad.addColorStop(0, '#8b5cf6');
        grad.addColorStop(1, '#5b21b6');
        ctx.fillStyle = grad;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 19px "Space Grotesk", sans-serif';
        ctx.fillText(slots[i], b.x + b.w / 2, b.y + b.h / 2 + 1);
      } else {
        ctx.fillStyle = ok ? 'rgba(6,212,247,0.12)' : 'rgba(255,255,255,0.03)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = ok ? 'rgba(6,212,247,0.6)' : 'rgba(190,200,255,0.14)';
        ctx.lineWidth = ok ? 2 : 1;
        ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        ctx.fillStyle = ok ? 'rgba(6,212,247,0.7)' : 'rgba(190,200,255,0.28)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText(i + 1, b.x + b.w / 2, b.y + b.h / 2);
      }
      if (flash && flash.i === i && flash.t > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (flash.t / 12 * 0.55) + ')';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        flash.t--;
        requestAnimationFrame(draw);
      }
    }
  }

  /* ---------- input ---------- */

  canvas.addEventListener('mousedown', e => {
    if (gameState !== 'play') return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width);
    const y = (e.clientY - r.top) * (H / r.height);
    const G = slotGeom();
    for (let i = 0; i < S; i++) {
      const b = G[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { drop(i); return; }
    }
  });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (gameState !== 'play') return;
    const r = canvas.getBoundingClientRect();
    const c = e.touches[0];
    const x = (c.clientX - r.left) * (W / r.width);
    const y = (c.clientY - r.top) * (H / r.height);
    const G = slotGeom();
    for (let i = 0; i < S; i++) {
      const b = G[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { drop(i); return; }
    }
  }, {passive: false});

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);
  slotsSel.addEventListener('change', newGame);

  newGame();
  overlay.classList.add('show');
})();
