(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const GRAVITY = 0.2;

  const FRUITS = [
    {emoji: '🍎', color: '#ef4444'},
    {emoji: '🍊', color: '#f97316'},
    {emoji: '🍋', color: '#facc15'},
    {emoji: '🍉', color: '#f87171'},
    {emoji: '🍇', color: '#a855f7'},
    {emoji: '🥝', color: '#84cc16'},
    {emoji: '🍓', color: '#dc2626'},
    {emoji: '🍑', color: '#fb923c'},
    {emoji: '🥭', color: '#fbbf24'}
  ];

  let items;         // fruits + bombs
  let halves;        // sliced pieces
  let particles;
  let trail;
  let score, best, lives, missed, hits;
  let gameState;     // 'ready' | 'play' | 'over'
  let spawnTimer;

  best = +localStorage.getItem('slice-best') || 0;
  bestEl.textContent = best;

  function reset() {
    items = []; halves = []; particles = []; trail = [];
    score = 0; lives = 3; missed = 0; hits = 0;
    scoreEl.textContent = 0;
    updateLives();
    spawnTimer = 0;
    gameState = 'ready';
    overTitle.textContent = 'Ready?';
    overMsg.textContent = 'Drag through fruit to slice. Avoid bombs.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
  }
  function updateLives() {
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '—';
  }

  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Slice!';
  }
  function gameOver() {
    gameState = 'over';
    if (score > best) {
      best = score;
      localStorage.setItem('slice-best', best);
      bestEl.textContent = best;
      overTitle.textContent = 'New Best!';
      overMsg.textContent = `${score} pts.`;
    } else {
      overTitle.textContent = 'Game Over';
      overMsg.textContent = `Score: ${score}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start to play again.';
  }

  function spawnWave() {
    // spawn 1-3 items
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const isBomb = Math.random() < 0.14;
      const type = isBomb ? {emoji: '💣', color: '#0f172a', bomb: true} : FRUITS[Math.floor(Math.random() * FRUITS.length)];
      const x = 80 + Math.random() * (W - 160);
      const y = H + 30;
      const vx = (W / 2 - x) * 0.004 + (Math.random() - 0.5) * 2;
      const vy = -10 - Math.random() * 2;
      const rot = (Math.random() - 0.5) * 0.15;
      items.push({
        x, y, vx, vy, rot, rotVel: (Math.random() - 0.5) * 0.1,
        r: 34, ...type, sliced: false
      });
    }
  }

  function sliceAt(item, tx, ty, tvx, tvy) {
    item.sliced = true;
    // spawn two halves flying opposite
    const perpX = -tvy, perpY = tvx;
    const norm = Math.hypot(perpX, perpY) || 1;
    const px = perpX / norm, py = perpY / norm;
    halves.push({
      x: item.x, y: item.y,
      vx: item.vx + px * 4, vy: item.vy - 1 + py * 4,
      rot: item.rot, rotVel: -0.15,
      emoji: item.emoji, r: item.r, life: 60
    });
    halves.push({
      x: item.x, y: item.y,
      vx: item.vx - px * 4, vy: item.vy - 1 - py * 4,
      rot: item.rot, rotVel: 0.15,
      emoji: item.emoji, r: item.r, life: 60
    });
    // juice
    for (let k = 0; k < 14; k++) {
      particles.push({
        x: item.x, y: item.y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 2,
        life: 40, max: 40,
        color: item.color
      });
    }
  }

  function update() {
    // spawn
    if (gameState === 'play') {
      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnWave();
        spawnTimer = 95 + Math.floor(Math.random() * 70);
      }
    }

    // items
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.vy += GRAVITY;
      it.x += it.vx; it.y += it.vy;
      it.rot += it.rotVel;
      if (it.y - it.r > H + 80) {
        // missed
        if (gameState === 'play' && !it.sliced && !it.bomb) {
          missed++;
          if (missed >= 3) {
            statusEl.innerHTML = 'Missed too many fruits.';
            gameOver();
          } else {
            statusEl.innerHTML = `Missed! (${missed}/3)`;
          }
        }
        items.splice(i, 1);
      }
    }

    // halves
    for (let i = halves.length - 1; i >= 0; i--) {
      const h = halves[i];
      h.vy += GRAVITY;
      h.x += h.vx; h.y += h.vy;
      h.rot += h.rotVel;
      h.life--;
      if (h.life <= 0 || h.y > H + 80) halves.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += GRAVITY * 0.6;
      p.x += p.vx; p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // trail decay
    trail = trail.filter(t => (t.age = (t.age || 0) + 1) < 12);

    // slice detection — check recent trail segments against items
    if (trail.length >= 2 && gameState === 'play') {
      for (let i = trail.length - 1; i >= Math.max(1, trail.length - 4); i--) {
        const a = trail[i - 1], b = trail[i];
        const sx = b.x - a.x, sy = b.y - a.y;
        for (const it of items) {
          if (it.sliced) continue;
          if (segmentHitsCircle(a.x, a.y, b.x, b.y, it.x, it.y, it.r)) {
            if (it.bomb) {
              // bomb hit
              hits++;
              // big explosion particles
              for (let k = 0; k < 30; k++) {
                particles.push({
                  x: it.x, y: it.y,
                  vx: (Math.random() - 0.5) * 12,
                  vy: (Math.random() - 0.5) * 12,
                  life: 60, max: 60,
                  color: '#ef4444'
                });
              }
              it.sliced = true;
              lives--;
              updateLives();
              if (lives <= 0) { statusEl.innerHTML = 'Hit a bomb!'; gameOver(); }
              else statusEl.innerHTML = '-1 life';
            } else {
              sliceAt(it, b.x, b.y, sx, sy);
              score++;
              scoreEl.textContent = score;
              statusEl.innerHTML = `Sliced! +1`;
            }
          }
        }
      }
    }
  }

  function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy || 1;
    let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx, py = y1 + t * dy;
    const distSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    return distSq <= r * r;
  }

  function draw() {
    // bg
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#0a0a25');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // subtle stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 40; i++) {
      const x = (i * 137) % W;
      const y = (i * 97) % H;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // particles
    particles.forEach(p => {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // items
    for (const it of items) {
      if (it.sliced) continue;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      ctx.font = '52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (it.bomb) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
      }
      ctx.fillText(it.emoji, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // halves
    for (const h of halves) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.font = '46px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.max(0, h.life / 60);
      ctx.fillText(h.emoji, 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // trail
    if (trail.length >= 2) {
      ctx.strokeStyle = 'rgba(6, 212, 247, 0.85)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const alpha = 1 - (b.age || 0) / 12;
        ctx.strokeStyle = `rgba(6, 212, 247, ${Math.max(0, alpha).toFixed(2)})`;
        ctx.lineWidth = 6 * (0.4 + 0.6 * alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // ---- Input ----
  let pointerDown = false;
  function addTrail(x, y) { trail.push({x, y, age: 0}); if (trail.length > 25) trail.shift(); }
  function localXY(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const c = e.touches ? e.touches[0] : e;
    return {x: (c.clientX - rect.left) * scale, y: (c.clientY - rect.top) * scale};
  }
  canvas.addEventListener('mousedown', e => { pointerDown = true; const {x, y} = localXY(e); addTrail(x, y); });
  canvas.addEventListener('mousemove', e => { if (!pointerDown) return; const {x, y} = localXY(e); addTrail(x, y); });
  canvas.addEventListener('mouseup', () => { pointerDown = false; });
  canvas.addEventListener('mouseleave', () => { pointerDown = false; });

  canvas.addEventListener('touchstart', e => { e.preventDefault(); pointerDown = true; const {x, y} = localXY(e); addTrail(x, y); }, {passive: false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!pointerDown) return; const {x, y} = localXY(e); addTrail(x, y); }, {passive: false});
  canvas.addEventListener('touchend', () => { pointerDown = false; });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
