(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scoreEl = document.getElementById('score');
  const accEl = document.getElementById('acc');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const modeSel = document.getElementById('mode');

  const MODES = {
    relaxed: {life: 2600, size: [30, 46], min: 3, max: 5, spawn: 620},
    normal:  {life: 1900, size: [22, 36], min: 3, max: 5, spawn: 480},
    hard:    {life: 1300, size: [16, 27], min: 4, max: 6, spawn: 360}
  };
  const ROUND_MS = 30000;

  let targets, score, hits, shots, endsAt, gameState, spawnAcc, lastTs, best, streak, bestStreak;

  best = +localStorage.getItem('aim-best') || 0;
  bestEl.textContent = best;

  function cfg() { return MODES[modeSel.value] || MODES.normal; }

  // Radius actually on screen — targets pop in and shrink slightly as they age.
  // Hit-testing uses this so accuracy reflects what the player sees.
  function drawnR(t, ts) {
    const age = ts - t.born;
    const inK = Math.min(1, age / 130);
    const leftK = 1 - Math.min(1, age / t.life);
    return t.r * inK * (0.78 + leftK * 0.22);
  }

  function reset() {
    targets = [];
    score = 0; hits = 0; shots = 0; streak = 0; bestStreak = 0;
    spawnAcc = 0; lastTs = 0;
    scoreEl.textContent = 0;
    accEl.textContent = '—';
    timeEl.textContent = '30s';
    gameState = 'ready';
    overTitle.textContent = 'Aim Trainer';
    overMsg.textContent = 'Hit as many targets as you can in 30 seconds.';
    overlay.classList.add('show');
    statusEl.textContent = 'Click the targets. Misses cost accuracy.';
  }

  function start() {
    reset();
    gameState = 'play';
    endsAt = performance.now() + ROUND_MS;
    overlay.classList.remove('show');
    statusEl.textContent = 'Go.';
    for (let i = 0; i < 3; i++) spawn();
  }

  function spawn() {
    const c = cfg();
    const r = c.size[0] + Math.random() * (c.size[1] - c.size[0]);
    const pad = r + 14;
    let x = 0, y = 0;
    // a few tries to avoid dropping one on top of another
    for (let tryN = 0; tryN < 12; tryN++) {
      x = pad + Math.random() * (W - pad * 2);
      y = pad + Math.random() * (H - pad * 2);
      const clash = targets.some(t => !t.dead && Math.hypot(x - t.x, y - t.y) < r + t.r + 8);
      if (!clash) break;
    }
    targets.push({x, y, r, born: performance.now(), life: c.life, dead: false, hitAt: 0});
  }

  function update(ts) {
    if (gameState !== 'play') return;
    const left = Math.max(0, endsAt - ts);
    timeEl.textContent = Math.ceil(left / 1000) + 's';
    if (left <= 0) return finish();

    const c = cfg();

    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (t.dead) { if (ts - t.hitAt > 260) targets.splice(i, 1); continue; }
      if (ts - t.born > t.life) {
        // expired without being hit — breaks the streak
        targets.splice(i, 1);
        streak = 0;
      }
    }

    const live = targets.reduce((n, t) => n + (t.dead ? 0 : 1), 0);
    // Always keep something to shoot at, then trickle up to the mode's cap.
    if (live < c.min) {
      for (let i = live; i < c.min; i++) spawn();
    } else {
      if (!lastTs) lastTs = ts;
      spawnAcc += ts - lastTs;
      if (spawnAcc >= c.spawn) {
        spawnAcc = 0;
        if (live < c.max) spawn();
      }
    }
    lastTs = ts;
  }

  function finish() {
    gameState = 'over';
    const acc = shots ? Math.round((hits / shots) * 100) : 0;
    if (score > best) {
      best = score; localStorage.setItem('aim-best', best); bestEl.textContent = best;
      overTitle.textContent = 'New best';
    } else {
      overTitle.textContent = 'Time up';
    }
    overMsg.textContent = `${score} points · ${acc}% accuracy · best streak ${bestStreak}`;
    overlay.classList.add('show');
    statusEl.textContent = 'Round over.';
  }

  function shoot(mx, my) {
    if (gameState === 'over' || gameState === 'ready') { start(); return; }
    if (gameState !== 'play') return;
    shots++;
    let hit = null;
    // topmost (most recent) target wins the click
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (t.dead) continue;
      if (Math.hypot(mx - t.x, my - t.y) <= drawnR(t, performance.now())) { hit = t; break; }
    }
    if (hit) {
      hits++; streak++;
      bestStreak = Math.max(bestStreak, streak);
      // smaller targets and longer streaks are worth more
      const sizeBonus = Math.round(60 / hit.r * 10);
      score += 10 + sizeBonus + Math.min(streak, 10);
      hit.dead = true; hit.hitAt = performance.now();
      ring(hit.x, hit.y, hit.r);
    } else {
      streak = 0;
      miss(mx, my);
    }
    scoreEl.textContent = score;
    accEl.textContent = Math.round((hits / shots) * 100) + '%';
  }

  const fx = [];
  function ring(x, y, r) { fx.push({x, y, r, max: r * 2.4, a: 1, kind: 'ring'}); }
  function miss(x, y) { fx.push({x, y, a: 1, kind: 'miss'}); }

  function draw(ts) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0a20');
    g.addColorStop(1, '#12122e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // faint grid for depth reference
    ctx.strokeStyle = 'rgba(139,92,246,0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    for (const t of targets) {
      const age = ts - t.born;
      if (t.dead) {
        const k = 1 - Math.min(1, (ts - t.hitAt) / 260);
        ctx.globalAlpha = k;
        target(t.x, t.y, t.r * (1 + (1 - k) * 0.5));
        ctx.globalAlpha = 1;
        continue;
      }
      // pop-in, then shrink slightly as it is about to expire
      const leftK = 1 - Math.min(1, age / t.life);
      target(t.x, t.y, drawnR(t, ts), leftK);
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      const p = fx[i];
      p.a -= 0.06;
      if (p.a <= 0) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = p.a;
      if (p.kind === 'ring') {
        p.r += (p.max - p.r) * 0.25;
        ctx.strokeStyle = '#06d4f7'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x - 9, p.y - 9); ctx.lineTo(p.x + 9, p.y + 9);
        ctx.moveTo(p.x + 9, p.y - 9); ctx.lineTo(p.x - 9, p.y + 9);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    if (gameState === 'play' && streak >= 3) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 18px "Space Grotesk", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(streak + ' in a row', 16, 30);
    }
  }

  function target(x, y, r, leftK) {
    if (r <= 0) return;
    const warm = leftK !== undefined && leftK < 0.3;
    const outer = warm ? '#f97316' : '#8b5cf6';
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, outer);
    g.addColorStop(1, warm ? '#7c2d12' : '#3b1d8f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, r * 0.16), 0, Math.PI * 2); ctx.fill();
  }

  function frame(ts) { update(ts); draw(ts); requestAnimationFrame(frame); }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }
  canvas.addEventListener('mousedown', e => { const p = pos(e); shoot(p.x, p.y); });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); const p = pos(e); shoot(p.x, p.y); }, {passive: false});
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);
  modeSel.addEventListener('change', reset);

  reset();
  requestAnimationFrame(frame);
})();
