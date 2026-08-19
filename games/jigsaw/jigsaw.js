(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const piecesEl = document.getElementById('pieces');
  const movesEl = document.getElementById('moves');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const sizeSel = document.getElementById('size');

  // The finished picture lives on this offscreen canvas; pieces sample it.
  const art = document.createElement('canvas');
  const actx = art.getContext('2d');

  let N, pw, ph, frameX, frameY, frameW, frameH;
  let pieces, hEdges, vEdges, dragging, moves, startedAt, timer, gameState;
  let peekActive = false;
  let bursts = [];
  let shakeT = 0;

  const SNAP = 22;

  function spawnBurst(x, y, color, count) {
    count = count || 14;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      bursts.push({x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 28, max: 28, color});
    }
  }
  function shake(amount) { shakeT = Math.max(shakeT, amount); }

  /* ---------- picture generation ----------
     Paints an abstract landscape: banded sky, sun, mountain ridges, water.
     Random palette each time, so every puzzle is a new picture with plenty
     of local detail for the player to match against.                    */

  function paintPicture(w, h) {
    art.width = w; art.height = h;
    const hue = Math.floor(Math.random() * 360);
    const hsl = (hh, s, l) => 'hsl(' + ((hh % 360 + 360) % 360) + ',' + s + '%,' + l + '%)';

    // sky
    const sky = actx.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, hsl(hue, 70, 22));
    sky.addColorStop(1, hsl(hue + 40, 75, 55));
    actx.fillStyle = sky;
    actx.fillRect(0, 0, w, h);

    // sun / moon
    const sx = w * (0.2 + Math.random() * 0.6), sy = h * (0.14 + Math.random() * 0.2);
    const sr = h * 0.09;
    const glow = actx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 2.6);
    glow.addColorStop(0, 'rgba(255,244,214,0.95)');
    glow.addColorStop(0.35, 'rgba(255,220,160,0.5)');
    glow.addColorStop(1, 'rgba(255,220,160,0)');
    actx.fillStyle = glow;
    actx.fillRect(0, 0, w, h);
    actx.fillStyle = hsl(hue + 60, 90, 82);
    actx.beginPath();
    actx.arc(sx, sy, sr, 0, Math.PI * 2);
    actx.fill();

    // mountain ridges, back to front
    for (let ridge = 0; ridge < 3; ridge++) {
      const base = h * (0.42 + ridge * 0.12);
      actx.fillStyle = hsl(hue + 180 + ridge * 14, 34 - ridge * 6, 30 - ridge * 7);
      actx.beginPath();
      actx.moveTo(0, h);
      actx.lineTo(0, base);
      const bumps = 4 + ridge * 2;
      for (let b = 0; b <= bumps; b++) {
        const bx = (w / bumps) * b;
        const by = base - Math.random() * h * (0.16 - ridge * 0.03);
        actx.lineTo(bx, by);
      }
      actx.lineTo(w, h);
      actx.closePath();
      actx.fill();
    }

    // water with light streaks
    const wy = h * 0.78;
    const sea = actx.createLinearGradient(0, wy, 0, h);
    sea.addColorStop(0, hsl(hue + 200, 60, 38));
    sea.addColorStop(1, hsl(hue + 210, 65, 16));
    actx.fillStyle = sea;
    actx.fillRect(0, wy, w, h - wy);
    for (let i = 0; i < 26; i++) {
      actx.fillStyle = 'rgba(255,255,255,' + (0.04 + Math.random() * 0.1) + ')';
      const lw = 20 + Math.random() * 90;
      actx.fillRect(Math.random() * (w - lw), wy + Math.random() * (h - wy), lw, 2);
    }

    // a few birds
    actx.strokeStyle = 'rgba(20,20,40,0.7)';
    actx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const bx = w * (0.15 + Math.random() * 0.7), by = h * (0.18 + Math.random() * 0.2), s = 5 + Math.random() * 5;
      actx.beginPath();
      actx.moveTo(bx - s, by);
      actx.quadraticCurveTo(bx - s / 2, by - s / 1.5, bx, by);
      actx.quadraticCurveTo(bx + s / 2, by - s / 1.5, bx + s, by);
      actx.stroke();
    }
  }

  /* ---------- piece shapes ----------
     Classic jigsaw cut: each interior edge gets a tab pointing one way or
     the other, shared by the two pieces that meet there.                 */

  function buildEdges() {
    hEdges = []; vEdges = [];
    for (let r = 0; r < N + 1; r++) {
      hEdges.push([]);
      for (let c = 0; c < N; c++) hEdges[r].push(r === 0 || r === N ? 0 : (Math.random() < 0.5 ? 1 : -1));
    }
    for (let r = 0; r < N; r++) {
      vEdges.push([]);
      for (let c = 0; c < N + 1; c++) vEdges[r].push(c === 0 || c === N ? 0 : (Math.random() < 0.5 ? 1 : -1));
    }
  }

  // Trace one edge with an optional tab. dir=0 flat, 1 tab out, -1 tab in.
  // (x1,y1)->(x2,y2) along the edge; the tab bulges perpendicular.
  function edgePath(p, x1, y1, x2, y2, dir) {
    if (!dir) { p.lineTo(x2, y2); return; }
    const dx = x2 - x1, dy = y2 - y1;
    const px = -dy, py = dx;                 // perpendicular
    const len = Math.hypot(dx, dy);
    const t = 0.2 * len * dir / len;
    const nub = 0.22;
    const mx1 = x1 + dx * 0.38, my1 = y1 + dy * 0.38;
    const mx2 = x1 + dx * 0.62, my2 = y1 + dy * 0.62;
    const cx = x1 + dx * 0.5 + px * nub * dir, cy = y1 + dy * 0.5 + py * nub * dir;
    p.lineTo(mx1, my1);
    p.bezierCurveTo(
      mx1 + px * t, my1 + py * t,
      cx - dx * 0.12, cy - dy * 0.12,
      cx, cy);
    p.bezierCurveTo(
      cx + dx * 0.12, cy + dy * 0.12,
      mx2 + px * t, my2 + py * t,
      mx2, my2);
    p.lineTo(x2, y2);
  }

  function piecePath(r, c) {
    const p = new Path2D();
    p.moveTo(0, 0);
    edgePath(p, 0, 0, pw, 0, hEdges[r][c]);                    // top
    edgePath(p, pw, 0, pw, ph, vEdges[r][c + 1]);              // right
    edgePath(p, pw, ph, 0, ph, -hEdges[r + 1][c]);             // bottom
    edgePath(p, 0, ph, 0, 0, -vEdges[r][c]);                   // left
    p.closePath();
    return p;
  }

  /* ---------- game flow ---------- */

  function newPuzzle() {
    N = +sizeSel.value || 4;
    frameW = Math.min(W - 200, H - 90);
    frameH = frameW;
    frameX = (W - frameW) / 2;
    frameY = (H - frameH) / 2;
    pw = frameW / N;
    ph = frameH / N;

    paintPicture(frameW, frameH);
    buildEdges();

    pieces = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        pieces.push({r, c, x: 0, y: 0, home: false});
      }
    }
    // Scatter around the frame edges — left and right gutters plus a bit of
    // overlap onto the frame so big cuts still fit on the canvas.
    for (const p of pieces) {
      const side = Math.random() < 0.5;
      const gx = side ? Math.random() * (frameX - pw * 0.7)
                      : frameX + frameW - pw * 0.3 + Math.random() * (W - frameX - frameW - pw * 0.7);
      p.x = Math.max(6, Math.min(W - pw - 6, gx));
      p.y = Math.max(6, Math.min(H - ph - 6, Math.random() * (H - ph - 12)));
    }

    dragging = null;
    moves = 0;
    peekActive = false;
    bursts = [];
    shakeT = 0;
    gameState = 'play';
    piecesEl.textContent = '0/' + (N * N);
    movesEl.textContent = 0;
    startedAt = Date.now();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    timeEl.textContent = '0:00';
    overlay.classList.remove('show');
    statusEl.textContent = 'Drag a piece towards its place and it will snap in.';
    draw();
  }

  function tick() {
    if (gameState !== 'play') return;
    const s = Math.floor((Date.now() - startedAt) / 1000);
    timeEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function homeCount() { return pieces.filter(p => p.home).length; }

  function win() {
    gameState = 'won';
    clearInterval(timer);
    overTitle.textContent = 'Picture complete';
    overMsg.textContent = (N * N) + ' pieces in ' + moves + ' moves, ' + timeEl.textContent + '.';
    overlay.classList.add('show');
    statusEl.textContent = 'Complete.';
    draw();
  }

  /* ---------- drawing ---------- */

  function draw() {
    ctx.save();
    if (shakeT > 0.3) {
      ctx.translate((Math.random() - 0.5) * shakeT, (Math.random() - 0.5) * shakeT);
      shakeT *= 0.82;
    } else {
      shakeT = 0;
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // frame
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(frameX, frameY, frameW, frameH);
    ctx.strokeStyle = 'rgba(139,92,246,0.6)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(frameX - 1, frameY - 1, frameW + 2, frameH + 2);

    // faint cell guides — alignment aid, fades away once the puzzle is solved
    if (gameState !== 'won') {
      ctx.strokeStyle = 'rgba(190,200,255,0.09)';
      ctx.lineWidth = 1;
      for (let k = 1; k < N; k++) {
        ctx.beginPath();
        ctx.moveTo(frameX + k * pw, frameY); ctx.lineTo(frameX + k * pw, frameY + frameH);
        ctx.moveTo(frameX, frameY + k * ph); ctx.lineTo(frameX + frameW, frameY + k * ph);
        ctx.stroke();
      }
    }

    const peeking = peekActive;
    if (peeking) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(art, frameX, frameY);
      ctx.globalAlpha = 1;
    }

    // placed pieces first, loose ones on top, dragged one last
    const order = pieces.slice().sort((a, b) => (a.home === b.home ? 0 : a.home ? -1 : 1));
    for (const p of order) {
      if (p === dragging) continue;
      drawPiece(p);
    }
    if (dragging) drawPiece(dragging, true);

    // placement particle bursts
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    if (peeking || bursts.length || shakeT > 0) requestAnimationFrame(draw);
  }

  function drawPiece(p, lifted) {
    const path = p.path || (p.path = piecePath(p.r, p.c));
    ctx.save();
    ctx.translate(p.x, p.y);
    if (lifted) {
      // actively dragged — larger, softer, offset shadow
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
    } else if (!p.home) {
      // resting loose piece — subtle contact shadow
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;
    }
    ctx.save();
    ctx.clip(path);
    // sample the artwork so the tab overhang carries the neighbour's paint
    ctx.drawImage(art, p.c * pw - pw * 0.35, p.r * ph - ph * 0.35,
      pw * 1.7, ph * 1.7, -pw * 0.35, -ph * 0.35, pw * 1.7, ph * 1.7);
    ctx.restore();
    if (p.home) {
      // placed pieces render flat/seamless so the finished picture reads clean
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke(path);
    } else {
      // raised bevel: dark outline plus a lighter inner highlight
      ctx.strokeStyle = 'rgba(10,10,25,0.85)';
      ctx.lineWidth = 2.4;
      ctx.stroke(path);
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1;
      ctx.stroke(path);
    }
    ctx.restore();
  }

  /* ---------- input ---------- */

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }

  function pickAt(x, y) {
    // topmost loose piece under the cursor (reverse draw order)
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (p.home) continue;
      if (ctx.isPointInPath(p.path || (p.path = piecePath(p.r, p.c)), x - p.x, y - p.y)) return p;
    }
    return null;
  }

  function startDrag(e) {
    if (gameState !== 'play') return;
    const m = pos(e);
    const p = pickAt(m.x, m.y);
    if (!p) return;
    dragging = p;
    p.ox = m.x - p.x;
    p.oy = m.y - p.y;
    // move to the end so it draws on top and picks first next time
    pieces.splice(pieces.indexOf(p), 1);
    pieces.push(p);
    draw();
  }

  function moveDrag(e) {
    if (!dragging) return;
    const m = pos(e);
    dragging.x = Math.max(-pw * 0.4, Math.min(W - pw * 0.6, m.x - dragging.ox));
    dragging.y = Math.max(-ph * 0.4, Math.min(H - ph * 0.6, m.y - dragging.oy));
    draw();
  }

  function endDrag() {
    if (!dragging) return;
    const p = dragging;
    dragging = null;
    moves++;
    movesEl.textContent = moves;
    const hx = frameX + p.c * pw, hy = frameY + p.r * ph;
    if (Math.abs(p.x - hx) < SNAP && Math.abs(p.y - hy) < SNAP) {
      p.x = hx; p.y = hy; p.home = true;
      statusEl.textContent = 'Snapped in.';
      piecesEl.textContent = homeCount() + '/' + (N * N);
      spawnBurst(hx + pw / 2, hy + ph / 2, '#ffffff');
      shake(6);
      if (homeCount() === N * N) { draw(); setTimeout(win, 200); return; }
    }
    draw();
  }

  function shuffleLoose() {
    if (gameState !== 'play') return;
    for (const p of pieces) {
      if (p.home) continue;
      const side = Math.random() < 0.5;
      const gx = side ? Math.random() * (frameX - pw * 0.7)
                      : frameX + frameW - pw * 0.3 + Math.random() * (W - frameX - frameW - pw * 0.7);
      p.x = Math.max(6, Math.min(W - pw - 6, gx));
      p.y = Math.max(6, Math.min(H - ph - 6, Math.random() * (H - ph - 12)));
    }
    statusEl.textContent = 'Loose pieces shuffled.';
    draw();
  }

  canvas.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e); }, {passive: false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDrag(e); }, {passive: false});
  window.addEventListener('touchend', endDrag);

  const peekBtn = document.getElementById('peekBtn');
  function peekOn(e) { if (e) e.preventDefault(); if (gameState !== 'play') return; peekActive = true; draw(); }
  function peekOff(e) { if (e) e.preventDefault(); peekActive = false; draw(); }
  peekBtn.addEventListener('mousedown', peekOn);
  peekBtn.addEventListener('mouseup', peekOff);
  peekBtn.addEventListener('mouseleave', peekOff);
  peekBtn.addEventListener('touchstart', peekOn, {passive: false});
  peekBtn.addEventListener('touchend', peekOff, {passive: false});

  const shuffleBtn = document.getElementById('shuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', shuffleLoose);

  document.getElementById('startBtn').addEventListener('click', newPuzzle);
  document.getElementById('restartOverlay').addEventListener('click', newPuzzle);
  sizeSel.addEventListener('change', newPuzzle);

  newPuzzle();
  overlay.classList.add('show');
})();
