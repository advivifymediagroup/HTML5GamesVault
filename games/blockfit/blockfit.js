(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const streakEl = document.getElementById('streak');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const N = 9;
  const CELL = 46;
  const BX = (W - N * CELL) / 2;
  const BY = 30;
  const TRAY_Y = BY + N * CELL + 34;
  const TRAY_CELL = 26;

  // Piece library: offsets [dr, dc]. Mix of lines, squares, Ls and dots.
  const SHAPES = [
    [[0, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [1, 0], [1, 1]],
    [[0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [1, 0]],
    [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 1], [1, 1], [2, 0], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]
  ];
  const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#06d4f7', '#3b82f6', '#8b5cf6', '#ec4899'];

  let grid, tray, score, best, streak, dragging, gameState, clearFx;

  best = +localStorage.getItem('blockfit-best') || 0;
  bestEl.textContent = best;

  /* ---------- game flow ---------- */

  function newGame() {
    grid = new Array(N * N).fill(null);
    tray = [];
    refillTray();
    score = 0; streak = 0;
    dragging = null;
    clearFx = [];
    gameState = 'play';
    scoreEl.textContent = 0;
    streakEl.textContent = 0;
    overlay.classList.remove('show');
    statusEl.textContent = 'Drag a block from the tray onto the grid.';
    draw();
  }

  function makePiece(slot) {
    // the 3x3 block is rare; everything else uniform
    const pool = Math.random() < 0.06 ? [SHAPES.length - 1]
      : [Math.floor(Math.random() * (SHAPES.length - 1))];
    const cells = SHAPES[pool[0]];
    return {
      cells,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      slot, used: false,
      x: 0, y: 0
    };
  }

  function refillTray() {
    tray = [makePiece(0), makePiece(1), makePiece(2)];
    layoutTray();
  }

  function layoutTray() {
    for (const p of tray) {
      if (p.used) continue;
      const wCells = Math.max(...p.cells.map(c => c[1])) + 1;
      const hCells = Math.max(...p.cells.map(c => c[0])) + 1;
      const slotW = W / 3;
      p.x = p.slot * slotW + (slotW - wCells * TRAY_CELL) / 2;
      p.y = TRAY_Y + (H - TRAY_Y - hCells * TRAY_CELL) / 2 - 6;
      p.scale = TRAY_CELL;
    }
  }

  function canPlace(p, r, c) {
    for (const [dr, dc] of p.cells) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) return false;
      if (grid[rr * N + cc]) return false;
    }
    return true;
  }

  function anyMoveLeft() {
    for (const p of tray) {
      if (p.used) continue;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (canPlace(p, r, c)) return true;
        }
      }
    }
    return false;
  }

  function place(p, r, c) {
    for (const [dr, dc] of p.cells) grid[(r + dr) * N + (c + dc)] = p.color;
    p.used = true;
    score += p.cells.length;

    // find full rows / cols / boxes
    const rows = [], cols = [], boxes = [];
    for (let k = 0; k < N; k++) {
      let rOk = true, cOk = true;
      for (let i = 0; i < N; i++) {
        if (!grid[k * N + i]) rOk = false;
        if (!grid[i * N + k]) cOk = false;
      }
      if (rOk) rows.push(k);
      if (cOk) cols.push(k);
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        let ok = true;
        for (let r2 = 0; r2 < 3; r2++) {
          for (let c2 = 0; c2 < 3; c2++) {
            if (!grid[(br * 3 + r2) * N + bc * 3 + c2]) ok = false;
          }
        }
        if (ok) boxes.push([br, bc]);
      }
    }

    const units = rows.length + cols.length + boxes.length;
    if (units) {
      streak++;
      // more units at once is worth disproportionately more
      score += units * 18 + (units - 1) * 12 + streak * 5;
      for (const r2 of rows) for (let i = 0; i < N; i++) { fx(r2, i); grid[r2 * N + i] = null; }
      for (const c2 of cols) for (let i = 0; i < N; i++) { fx(i, c2); grid[i * N + c2] = null; }
      for (const [br, bc] of boxes) {
        for (let r2 = 0; r2 < 3; r2++) {
          for (let c2 = 0; c2 < 3; c2++) { fx(br * 3 + r2, bc * 3 + c2); grid[(br * 3 + r2) * N + bc * 3 + c2] = null; }
        }
      }
      statusEl.textContent = units === 1 ? 'Line cleared.' : units + ' clears at once!';
    } else {
      streak = 0;
      statusEl.textContent = 'Placed.';
    }
    streakEl.textContent = streak;
    scoreEl.textContent = score;

    if (tray.every(q => q.used)) refillTray();
    if (!anyMoveLeft()) gameOver();
  }

  function fx(r, c) {
    clearFx.push({r, c, t: 14});
  }

  function gameOver() {
    gameState = 'over';
    if (score > best) {
      best = score;
      localStorage.setItem('blockfit-best', best);
      bestEl.textContent = best;
      overTitle.textContent = 'New best';
    } else {
      overTitle.textContent = 'No moves left';
    }
    overMsg.textContent = score + ' points. Best is ' + best + '.';
    overlay.classList.add('show');
    statusEl.textContent = 'No block fits anywhere.';
  }

  /* ---------- drawing ---------- */

  function shade(hex, amt) {
    const v = parseInt(hex.slice(1), 16);
    const cl = x => Math.max(0, Math.min(255, x));
    return '#' + ((cl(((v >> 16) & 255) + amt) << 16) | (cl(((v >> 8) & 255) + amt) << 8) | cl((v & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  function cellRect(x, y, size, color) {
    const grad = ctx.createLinearGradient(x, y, x, y + size);
    grad.addColorStop(0, shade(color, 26));
    grad.addColorStop(1, shade(color, -34));
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1.5, y + 1.5, size - 3, size - 3);
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // grid with 3x3 box tinting
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const dark = (((r / 3) | 0) + ((c / 3) | 0)) % 2 === 0;
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.028)';
        ctx.fillRect(BX + c * CELL, BY + r * CELL, CELL, CELL);
        const v = grid[r * N + c];
        if (v) cellRect(BX + c * CELL, BY + r * CELL, CELL, v);
      }
    }
    ctx.strokeStyle = 'rgba(190,200,255,0.14)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= N; k++) {
      ctx.beginPath();
      ctx.moveTo(BX + k * CELL, BY); ctx.lineTo(BX + k * CELL, BY + N * CELL);
      ctx.moveTo(BX, BY + k * CELL); ctx.lineTo(BX + N * CELL, BY + k * CELL);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(139,92,246,0.55)';
    ctx.lineWidth = 2;
    for (let k = 0; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(BX + k * 3 * CELL, BY); ctx.lineTo(BX + k * 3 * CELL, BY + N * CELL);
      ctx.moveTo(BX, BY + k * 3 * CELL); ctx.lineTo(BX + N * CELL, BY + k * 3 * CELL);
      ctx.stroke();
    }

    // clear flashes
    for (let i = clearFx.length - 1; i >= 0; i--) {
      const f = clearFx[i];
      ctx.fillStyle = 'rgba(255,255,255,' + (f.t / 14 * 0.6) + ')';
      ctx.fillRect(BX + f.c * CELL, BY + f.r * CELL, CELL, CELL);
      if (--f.t <= 0) clearFx.splice(i, 1);
    }

    // ghost preview
    if (dragging) {
      const t = snapTarget(dragging);
      if (t) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (const [dr, dc] of dragging.cells) {
          ctx.fillRect(BX + (t.c + dc) * CELL + 2, BY + (t.r + dr) * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    }

    // tray
    ctx.strokeStyle = 'rgba(190,200,255,0.12)';
    ctx.strokeRect(8, TRAY_Y - 8, W - 16, H - TRAY_Y);
    for (const p of tray) {
      if (p.used || p === dragging) continue;
      drawPiece(p, p.scale);
    }
    if (dragging) drawPiece(dragging, CELL, true);

    if (clearFx.length) requestAnimationFrame(draw);
  }

  function drawPiece(p, size, lifted) {
    ctx.save();
    if (lifted) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
    }
    for (const [dr, dc] of p.cells) cellRect(p.x + dc * size, p.y + dr * size, size, p.color);
    ctx.restore();
  }

  /* ---------- input ---------- */

  function snapTarget(p) {
    const r = Math.round((p.y - BY) / CELL);
    const c = Math.round((p.x - BX) / CELL);
    if (r < -1 || c < -1 || r > N || c > N) return null;
    return canPlace(p, r, c) ? {r, c} : null;
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }

  function startDrag(e) {
    if (gameState !== 'play') return;
    const m = pos(e);
    for (const p of tray) {
      if (p.used) continue;
      const wC = (Math.max(...p.cells.map(c => c[1])) + 1) * TRAY_CELL;
      const hC = (Math.max(...p.cells.map(c => c[0])) + 1) * TRAY_CELL;
      if (m.x >= p.x - 8 && m.x <= p.x + wC + 8 && m.y >= p.y - 8 && m.y <= p.y + hC + 8) {
        dragging = p;
        // grab scales the piece up to grid size, centred under the finger
        const wG = (Math.max(...p.cells.map(c => c[1])) + 1) * CELL;
        p.x = m.x - wG / 2;
        p.y = m.y - CELL * 1.4;      // lift above the finger for visibility
        draw();
        return;
      }
    }
  }

  function moveDrag(e) {
    if (!dragging) return;
    const m = pos(e);
    const wG = (Math.max(...dragging.cells.map(c => c[1])) + 1) * CELL;
    dragging.x = m.x - wG / 2;
    dragging.y = m.y - CELL * 1.4;
    draw();
  }

  function endDrag() {
    if (!dragging) return;
    const p = dragging;
    dragging = null;
    const t = snapTarget(p);
    if (t) place(p, t.r, t.c);
    else layoutTray();
    draw();
  }

  canvas.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e); }, {passive: false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDrag(e); }, {passive: false});
  window.addEventListener('touchend', endDrag);

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  newGame();
  overlay.classList.add('show');
})();
