(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const boardEl = document.getElementById('board');
  const placedEl = document.getElementById('placed');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const sizeSel = document.getElementById('size');

  const COLORS = [
    '#ef4444', '#f97316', '#fbbf24', '#22c55e', '#06d4f7',
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#a3e635',
    '#f43f5e', '#0ea5e9'
  ];

  let N, cellPx, bx, by;          // board geometry
  let shapes, grid, dragging, startedAt, timer, gameState;

  /* ---------- generation ----------
     Cut the full board into polyomino regions by flood-growing seeds, so
     reassembly is guaranteed possible. Pieces are 3-6 cells each.        */

  function cutBoard(n) {
    const owner = new Array(n * n).fill(-1);
    const sizes = [];
    let next = 0;

    function grow(seed, want) {
      const cells = [seed];
      owner[seed] = next;
      while (cells.length < want) {
        // collect frontier of the region
        const frontier = [];
        for (const c of cells) {
          const r = (c / n) | 0, cc = c % n;
          [[r - 1, cc], [r + 1, cc], [r, cc - 1], [r, cc + 1]].forEach(([rr, c2]) => {
            if (rr < 0 || c2 < 0 || rr >= n || c2 >= n) return;
            const j = rr * n + c2;
            if (owner[j] === -1 && !frontier.includes(j)) frontier.push(j);
          });
        }
        if (!frontier.length) break;
        const pick = frontier[Math.floor(Math.random() * frontier.length)];
        owner[pick] = next;
        cells.push(pick);
      }
      sizes.push(cells.length);
      next++;
    }

    for (let i = 0; i < n * n; i++) {
      if (owner[i] !== -1) continue;
      grow(i, 3 + Math.floor(Math.random() * 4));   // aim for 3-6 cells
    }

    // absorb any 1-cell leftovers into a neighbouring region
    for (let i = 0; i < n * n; i++) {
      const id = owner[i];
      if (sizes[id] > 1) continue;
      const r = (i / n) | 0, c = i % n;
      const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < n && cc < n);
      if (nb.length) {
        const [rr, cc] = nb[0];
        sizes[id]--;
        owner[i] = owner[rr * n + cc];
        sizes[owner[i]]++;
      }
    }
    return owner;
  }

  function buildShapes(owner, n) {
    const byId = {};
    for (let i = 0; i < n * n; i++) {
      (byId[owner[i]] = byId[owner[i]] || []).push(i);
    }
    const out = [];
    let k = 0;
    for (const id in byId) {
      const cells = byId[id];
      let minR = 1e9, minC = 1e9;
      for (const c of cells) {
        minR = Math.min(minR, (c / n) | 0);
        minC = Math.min(minC, c % n);
      }
      out.push({
        cells: cells.map(c => [((c / n) | 0) - minR, (c % n) - minC]),  // [dr,dc]
        homeR: minR, homeC: minC,
        color: COLORS[(k++) % COLORS.length],
        placed: false, atR: -1, atC: -1,
        x: 0, y: 0
      });
    }
    return out;
  }

  /* ---------- game flow ---------- */

  function newBoard() {
    N = +sizeSel.value || 6;
    cellPx = Math.floor(Math.min(300, W - 240) / N);
    bx = Math.floor((W - N * cellPx) / 2);
    by = 46;

    shapes = buildShapes(cutBoard(N), N);
    grid = new Array(N * N).fill(-1);

    // tray: lay the pieces along the bottom, jittered
    const trayY = by + N * cellPx + 28;
    let tx = 14;
    for (const s of shapes) {
      const wCells = Math.max(...s.cells.map(c => c[1])) + 1;
      const hCells = Math.max(...s.cells.map(c => c[0])) + 1;
      if (tx + wCells * cellPx > W - 14) tx = 14;
      s.x = tx + Math.random() * 8;
      s.y = trayY + Math.random() * Math.max(4, H - trayY - hCells * cellPx - 10);
      s.y = Math.min(s.y, H - hCells * cellPx - 8);
      tx += wCells * cellPx + 16;
    }

    dragging = null;
    gameState = 'play';
    boardEl.textContent = N + ' × ' + N;
    placedEl.textContent = '0/' + shapes.length;
    startedAt = Date.now();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    timeEl.textContent = '0:00';
    overlay.classList.remove('show');
    statusEl.textContent = 'Drag a piece from the tray onto the board.';
    draw();
  }

  function tick() {
    if (gameState !== 'play') return;
    const s = Math.floor((Date.now() - startedAt) / 1000);
    timeEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function placedCount() { return shapes.filter(s => s.placed).length; }

  function canPlace(s, r, c) {
    for (const [dr, dc] of s.cells) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) return false;
      if (grid[rr * N + cc] !== -1) return false;
    }
    return true;
  }

  function place(s, r, c) {
    const id = shapes.indexOf(s);
    for (const [dr, dc] of s.cells) grid[(r + dr) * N + (c + dc)] = id;
    s.placed = true; s.atR = r; s.atC = c;
    s.x = bx + c * cellPx; s.y = by + r * cellPx;
    placedEl.textContent = placedCount() + '/' + shapes.length;
    if (placedCount() === shapes.length) {
      gameState = 'won';
      clearInterval(timer);
      overTitle.textContent = 'Board filled';
      overMsg.textContent = shapes.length + ' pieces back in place, ' + timeEl.textContent + '.';
      overlay.classList.add('show');
      statusEl.textContent = 'Complete.';
    }
  }

  function unplace(s) {
    const id = shapes.indexOf(s);
    for (let i = 0; i < grid.length; i++) if (grid[i] === id) grid[i] = -1;
    s.placed = false; s.atR = -1; s.atC = -1;
    placedEl.textContent = placedCount() + '/' + shapes.length;
  }

  /* ---------- drawing ---------- */

  function shade(hex, amt) {
    const v = parseInt(hex.slice(1), 16);
    const cl = x => Math.max(0, Math.min(255, x));
    return '#' + ((cl(((v >> 16) & 255) + amt) << 16) | (cl(((v >> 8) & 255) + amt) << 8) | cl((v & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // board
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(bx, by, N * cellPx, N * cellPx);
    ctx.strokeStyle = 'rgba(190,200,255,0.2)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= N; k++) {
      ctx.beginPath();
      ctx.moveTo(bx + k * cellPx, by); ctx.lineTo(bx + k * cellPx, by + N * cellPx);
      ctx.moveTo(bx, by + k * cellPx); ctx.lineTo(bx + N * cellPx, by + k * cellPx);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(139,92,246,0.6)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx - 1, by - 1, N * cellPx + 2, N * cellPx + 2);

    // ghost preview while dragging
    if (dragging) {
      const t = snapTarget(dragging);
      if (t) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        for (const [dr, dc] of dragging.cells) {
          ctx.fillRect(bx + (t.c + dc) * cellPx + 1, by + (t.r + dr) * cellPx + 1, cellPx - 2, cellPx - 2);
        }
      }
    }

    for (const s of shapes) {
      if (s === dragging) continue;
      drawShape(s);
    }
    if (dragging) drawShape(dragging, true);
  }

  function drawShape(s, lifted) {
    ctx.save();
    if (lifted) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
    }
    for (const [dr, dc] of s.cells) {
      const x = s.x + dc * cellPx, y = s.y + dr * cellPx;
      const grad = ctx.createLinearGradient(x, y, x, y + cellPx);
      grad.addColorStop(0, shade(s.color, 26));
      grad.addColorStop(1, shade(s.color, -34));
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 1, cellPx - 2, cellPx - 2);
    }
    ctx.restore();
    // outline the silhouette lightly
    ctx.strokeStyle = 'rgba(10,10,25,0.55)';
    ctx.lineWidth = 1.4;
    for (const [dr, dc] of s.cells) {
      ctx.strokeRect(s.x + dc * cellPx + 1, s.y + dr * cellPx + 1, cellPx - 2, cellPx - 2);
    }
  }

  /* ---------- input ---------- */

  function snapTarget(s) {
    const r = Math.round((s.y - by) / cellPx);
    const c = Math.round((s.x - bx) / cellPx);
    const dx = Math.abs(s.x - (bx + c * cellPx)), dy = Math.abs(s.y - (by + r * cellPx));
    if (dx > cellPx * 0.55 || dy > cellPx * 0.55) return null;
    return canPlace(s, r, c) ? {r, c} : null;
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }

  function hitShape(x, y) {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      for (const [dr, dc] of s.cells) {
        if (x >= s.x + dc * cellPx && x < s.x + (dc + 1) * cellPx &&
            y >= s.y + dr * cellPx && y < s.y + (dr + 1) * cellPx) return s;
      }
    }
    return null;
  }

  function startDrag(e) {
    if (gameState !== 'play') return;
    const m = pos(e);
    const s = hitShape(m.x, m.y);
    if (!s) return;
    if (s.placed) unplace(s);
    dragging = s;
    s.ox = m.x - s.x; s.oy = m.y - s.y;
    shapes.splice(shapes.indexOf(s), 1);
    shapes.push(s);
    statusEl.textContent = 'Drop it where it fits.';
    draw();
  }

  function moveDrag(e) {
    if (!dragging) return;
    const m = pos(e);
    dragging.x = m.x - dragging.ox;
    dragging.y = m.y - dragging.oy;
    draw();
  }

  function endDrag() {
    if (!dragging) return;
    const s = dragging;
    dragging = null;
    const t = snapTarget(s);
    if (t) {
      place(s, t.r, t.c);
      statusEl.textContent = gameState === 'won' ? 'Complete.' : 'Placed.';
    } else {
      // return to the tray area if dropped over the board illegally
      if (s.y < by + N * cellPx) s.y = by + N * cellPx + 26;
      s.y = Math.min(s.y, H - cellPx - 8);
      statusEl.textContent = "It doesn't fit there.";
    }
    draw();
  }

  canvas.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e); }, {passive: false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDrag(e); }, {passive: false});
  window.addEventListener('touchend', endDrag);

  document.getElementById('clearBtn').addEventListener('click', () => {
    if (gameState !== 'play') return;
    let ty = by + N * cellPx + 28, tx = 14;
    for (const s of shapes) {
      if (s.placed) unplace(s);
      const wCells = Math.max(...s.cells.map(c => c[1])) + 1;
      if (tx + wCells * cellPx > W - 14) tx = 14;
      s.x = tx; s.y = Math.min(ty + Math.random() * 30, H - cellPx * 2);
      tx += wCells * cellPx + 16;
    }
    statusEl.textContent = 'All pieces back in the tray.';
    draw();
  });
  document.getElementById('startBtn').addEventListener('click', newBoard);
  document.getElementById('restartOverlay').addEventListener('click', newBoard);
  sizeSel.addEventListener('change', newBoard);

  newBoard();
  overlay.classList.add('show');
})();
