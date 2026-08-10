(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const nextEl = document.getElementById('nextTier');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  // Tiers grow in size and value as they merge.
  const TIERS = [
    {r: 14, c: '#ef4444', v: 1},
    {r: 19, c: '#f97316', v: 3},
    {r: 25, c: '#fbbf24', v: 6},
    {r: 32, c: '#a3e635', v: 10},
    {r: 40, c: '#22c55e', v: 15},
    {r: 49, c: '#06d4f7', v: 21},
    {r: 59, c: '#3b82f6', v: 28},
    {r: 70, c: '#8b5cf6', v: 36},
    {r: 82, c: '#ec4899', v: 45}
  ];
  const SPAWN_MAX = 4;         // only the first few tiers ever drop in
  const WALL = 8;
  const FLOOR = H - WALL;
  const DEATH_Y = 70;          // above this for too long = game over
  const GRAV = 0.42;
  const REST = 0.18;           // bounciness
  const FRICTION = 0.986;

  let balls, score, best, dropX, nextTier, cooling, gameState, overflowTimer;

  best = +localStorage.getItem('mergedrop-best') || 0;
  bestEl.textContent = best;

  function reset() {
    balls = [];
    score = 0; scoreEl.textContent = 0;
    dropX = W / 2;
    nextTier = rndTier();
    paintNext();
    cooling = 0; overflowTimer = 0;
    gameState = 'ready';
    overTitle.textContent = 'Merge Drop';
    overMsg.textContent = 'Drop circles. Two of the same merge into a bigger one.';
    overlay.classList.add('show');
    statusEl.textContent = 'Move with the mouse, click to drop.';
  }

  function rndTier() { return Math.floor(Math.random() * SPAWN_MAX); }
  function paintNext() { nextEl.textContent = TIERS[nextTier].v; nextEl.style.color = TIERS[nextTier].c; }

  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.textContent = 'Merge matching circles to score.';
  }

  function drop() {
    if (gameState === 'over') return start();
    if (gameState === 'ready') { start(); return; }
    if (cooling > 0) return;
    const t = TIERS[nextTier];
    const x = Math.max(WALL + t.r, Math.min(W - WALL - t.r, dropX));
    balls.push({x, y: 40, vx: 0, vy: 0, t: nextTier, merged: 0});
    nextTier = rndTier();
    paintNext();
    cooling = 18;
  }

  function step() {
    if (gameState !== 'play') return;
    if (cooling > 0) cooling--;

    for (const b of balls) {
      const r = TIERS[b.t].r;
      b.vy += GRAV;
      b.x += b.vx; b.y += b.vy;
      b.vx *= FRICTION;
      if (b.merged > 0) b.merged--;

      // walls / floor
      if (b.x - r < WALL) { b.x = WALL + r; b.vx = Math.abs(b.vx) * REST; }
      if (b.x + r > W - WALL) { b.x = W - WALL - r; b.vx = -Math.abs(b.vx) * REST; }
      if (b.y + r > FLOOR) { b.y = FLOOR - r; b.vy = -Math.abs(b.vy) * REST; b.vx *= 0.94; }
    }

    // pairwise collision + merge, a couple of relaxation passes for stability
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          if (!a || !b) continue;
          const ra = TIERS[a.t].r, rb = TIERS[b.t].r;
          let dx = b.x - a.x, dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          const min = ra + rb;
          if (d === 0) { dx = 0.01; d = 0.01; }
          if (d >= min) continue;

          // same tier and not the top tier -> merge
          if (a.t === b.t && a.t < TIERS.length - 1 && !a.merged && !b.merged) {
            const nt = a.t + 1;
            const nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2;
            balls.splice(j, 1); balls.splice(i, 1);
            balls.push({x: nx, y: ny, vx: 0, vy: -1.6, t: nt, merged: 6});
            score += TIERS[nt].v;
            scoreEl.textContent = score;
            pop(nx, ny, TIERS[nt].c);
            i = -1; break; // restart scan; indices shifted
          }

          // otherwise push apart
          const overlap = (min - d) / 2;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * overlap; a.y -= uy * overlap;
          b.x += ux * overlap; b.y += uy * overlap;
          const rel = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
          if (rel < 0) {
            const imp = rel * REST;
            a.vx += imp * ux; a.vy += imp * uy;
            b.vx -= imp * ux; b.vy -= imp * uy;
          }
        }
      }
    }

    // overflow check — a settled ball sitting above the line ends the run
    const over = balls.some(b => b.y - TIERS[b.t].r < DEATH_Y && Math.abs(b.vy) < 0.6);
    overflowTimer = over ? overflowTimer + 1 : 0;
    if (overflowTimer > 90) gameOver();
  }

  const bursts = [];
  function pop(x, y, c) {
    for (let i = 0; i < 12; i++) {
      bursts.push({x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 26, max: 26, c});
    }
  }

  function gameOver() {
    gameState = 'over';
    if (score > best) {
      best = score; localStorage.setItem('mergedrop-best', best); bestEl.textContent = best;
      overTitle.textContent = 'New best';
      overMsg.textContent = score + ' points.';
    } else {
      overTitle.textContent = 'Filled up';
      overMsg.textContent = score + ' points. Best is ' + best + '.';
    }
    overlay.classList.add('show');
    statusEl.textContent = 'The jar overflowed.';
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // jar
    ctx.strokeStyle = 'rgba(139,92,246,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(WALL, DEATH_Y);
    ctx.lineTo(WALL, FLOOR); ctx.lineTo(W - WALL, FLOOR); ctx.lineTo(W - WALL, DEATH_Y);
    ctx.stroke();

    // fill line
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = 'rgba(239,68,68,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(WALL, DEATH_Y); ctx.lineTo(W - WALL, DEATH_Y); ctx.stroke();
    ctx.setLineDash([]);

    // aim guide + held circle
    if (gameState === 'play') {
      const t = TIERS[nextTier];
      const x = Math.max(WALL + t.r, Math.min(W - WALL - t.r, dropX));
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, FLOOR); ctx.stroke();
      ctx.setLineDash([]);
      if (cooling <= 0) circle(x, 40, t.r, t.c, t.v);
    }

    for (const b of balls) {
      const t = TIERS[b.t];
      circle(b.x, b.y, t.r, t.c, t.v, b.merged > 0);
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
      if (p.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function circle(x, y, r, c, label, flash) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.22, c);
    g.addColorStop(1, shade(c, -45));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    if (flash) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(x - r * 0.34, y - r * 0.34, r * 0.24, 0, Math.PI * 2); ctx.fill();
    if (r > 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.font = `bold ${Math.round(r * 0.72)}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + 1);
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    return '#' + ((cl(((n >> 16) & 255) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  function loop() { step(); draw(); requestAnimationFrame(loop); }

  function px(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return (c.clientX - r.left) * (W / r.width);
  }
  canvas.addEventListener('mousemove', e => { dropX = px(e); });
  canvas.addEventListener('mousedown', drop);
  canvas.addEventListener('touchmove', e => { e.preventDefault(); dropX = px(e); }, {passive: false});
  canvas.addEventListener('touchstart', e => { e.preventDefault(); dropX = px(e); drop(); }, {passive: false});
  document.addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); drop(); }
    if (e.key === 'ArrowLeft') dropX -= 18;
    if (e.key === 'ArrowRight') dropX += 18;
  });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
