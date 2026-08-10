(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const levelEl = document.getElementById('level');
  const placedEl = document.getElementById('placed');
  const movesEl = document.getElementById('moves');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  let cols, rows, sw, sh, gx, gy;
  let slots, tray, dragging, moves, level, gameState;

  level = 1;

  /* ---------- generation ----------
     Bilinear blend between four random corner colours gives every cell a
     unique colour with a smooth flow — misplaced swatches stand out, and
     the solved board is unambiguous.                                     */

  function hsv(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  function corners() {
    const h0 = Math.random() * 360;
    // spread the four corner hues so the blend has real movement
    return [
      hsv(h0, 0.85, 0.95),
      hsv(h0 + 80 + Math.random() * 40, 0.8, 0.9),
      hsv(h0 + 180 + Math.random() * 40, 0.75, 0.85),
      hsv(h0 + 270 + Math.random() * 30, 0.85, 0.95)
    ];
  }

  function blend(c, tl, tr, bl, br, u, v) {
    const top = tl.map((x, i) => x + (tr[i] - x) * u);
    const bot = bl.map((x, i) => x + (br[i] - x) * u);
    return top.map((x, i) => Math.round(x + (bot[i] - x) * v));
  }

  function gridFor(lv) {
    if (lv <= 2) return [6, 4];
    if (lv <= 4) return [7, 5];
    if (lv <= 6) return [8, 5];
    return [9, 6];
  }

  function newLevel() {
    [cols, rows] = gridFor(level);
    sw = Math.floor(Math.min((W - 40) / cols, 58));
    sh = sw;
    gx = Math.floor((W - cols * sw) / 2);
    gy = 34;

    const [tl, tr, bl, br] = corners();
    slots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const col = blend(null, tl, tr, bl, br, c / (cols - 1), r / (rows - 1));
        // corners stay fixed as anchors
        const fixed = (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
        slots.push({r, c, color: col, fixed, holding: fixed ? {color: col} : null});
      }
    }

    // pull out every non-fixed swatch and shuffle into the tray
    tray = [];
    for (const s of slots) {
      if (s.fixed) continue;
      tray.push({color: s.color, x: 0, y: 0, slot: -1});
    }
    for (let i = tray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = tray[i]; tray[i] = tray[j]; tray[j] = t;
    }
    layoutTray();

    dragging = null;
    moves = 0;
    gameState = 'play';
    levelEl.textContent = level;
    movesEl.textContent = 0;
    updatePlaced();
    overlay.classList.remove('show');
    statusEl.textContent = 'Drag a swatch into the gap where it belongs.';
    draw();
  }

  function layoutTray() {
    const trayY = gy + rows * sh + 24;
    const size = Math.min(sw - 6, Math.floor((H - trayY - 12) / 2) - 4, 40);
    const perRow = Math.floor((W - 24) / (size + 6));
    let i = 0;
    for (const t of tray) {
      if (t.slot >= 0) continue;
      t.size = size;
      t.x = 14 + (i % perRow) * (size + 6);
      t.y = trayY + Math.floor(i / perRow) * (size + 6);
      i++;
    }
  }

  function updatePlaced() {
    const need = slots.filter(s => !s.fixed).length;
    const got = slots.filter(s => !s.fixed && s.holding).length;
    placedEl.textContent = got + '/' + need;
  }

  function checkWin() {
    for (const s of slots) {
      if (s.fixed) continue;
      if (!s.holding) return;
      if (s.holding.color !== s.color) return;
    }
    gameState = 'won';
    overTitle.textContent = 'Level ' + level + ' blended';
    overMsg.textContent = 'Sorted in ' + moves + ' moves.';
    document.getElementById('restartOverlay').textContent = 'Next Level';
    overlay.classList.add('show');
    statusEl.textContent = 'Perfect blend.';
    draw();
  }

  /* ---------- drawing ---------- */

  function css(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of slots) {
      const x = gx + s.c * sw, y = gy + s.r * sh;
      if (s.holding) {
        ctx.fillStyle = css(s.holding.color);
        ctx.fillRect(x + 1, y + 1, sw - 2, sh - 2);
        if (s.fixed) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.arc(x + sw / 2, y + sh / 2, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x + 1, y + 1, sw - 2, sh - 2);
        ctx.strokeStyle = 'rgba(190,200,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 4.5, y + 4.5, sw - 9, sh - 9);
      }
    }
    ctx.strokeStyle = 'rgba(139,92,246,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(gx - 1, gy - 1, cols * sw + 2, rows * sh + 2);

    for (const t of tray) {
      if (t.slot >= 0 || t === dragging) continue;
      ctx.fillStyle = css(t.color);
      ctx.fillRect(t.x, t.y, t.size, t.size);
      ctx.strokeStyle = 'rgba(10,10,25,0.6)';
      ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.size - 1, t.size - 1);
    }

    if (dragging) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = css(dragging.color);
      ctx.fillRect(dragging.x, dragging.y, sw - 4, sh - 4);
      ctx.restore();
    }
  }

  /* ---------- input ---------- */

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }

  function slotAt(x, y) {
    if (x < gx || y < gy) return null;
    const c = ((x - gx) / sw) | 0, r = ((y - gy) / sh) | 0;
    if (c >= cols || r >= rows) return null;
    return slots[r * cols + c];
  }

  function startDrag(e) {
    if (gameState !== 'play') return;
    const m = pos(e);
    // from tray?
    for (let i = tray.length - 1; i >= 0; i--) {
      const t = tray[i];
      if (t.slot >= 0) continue;
      if (m.x >= t.x && m.x <= t.x + t.size && m.y >= t.y && m.y <= t.y + t.size) {
        dragging = t;
        dragging.x = m.x - sw / 2; dragging.y = m.y - sh / 2;
        draw();
        return;
      }
    }
    // from a placed slot?
    const s = slotAt(m.x, m.y);
    if (s && !s.fixed && s.holding) {
      const t = tray.find(q => q.slot === slots.indexOf(s));
      if (t) {
        t.slot = -1;
        s.holding = null;
        dragging = t;
        dragging.x = m.x - sw / 2; dragging.y = m.y - sh / 2;
        updatePlaced();
        draw();
      }
    }
  }

  function moveDrag(e) {
    if (!dragging) return;
    const m = pos(e);
    dragging.x = m.x - sw / 2;
    dragging.y = m.y - sh / 2;
    draw();
  }

  function endDrag(e) {
    if (!dragging) return;
    const t = dragging;
    dragging = null;
    const s = slotAt(t.x + sw / 2, t.y + sh / 2);
    if (s && !s.fixed && !s.holding) {
      s.holding = t;
      t.slot = slots.indexOf(s);
      moves++;
      movesEl.textContent = moves;
      updatePlaced();
      checkWin();
    } else {
      layoutTray();
    }
    draw();
  }

  canvas.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e); }, {passive: false});
  canvas.addEventListener('touchmove', e => { e.preventDefault(); moveDrag(e); }, {passive: false});
  window.addEventListener('touchend', endDrag);

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (gameState !== 'play') return;
    for (const s of slots) if (!s.fixed) s.holding = null;
    for (const t of tray) t.slot = -1;
    layoutTray();
    updatePlaced();
    statusEl.textContent = 'All swatches back in the tray.';
    draw();
  });
  document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('restartOverlay').textContent = 'Start';
    newLevel();
  });
  document.getElementById('restartOverlay').addEventListener('click', () => {
    if (gameState === 'won') level++;
    document.getElementById('restartOverlay').textContent = 'Start';
    newLevel();
  });

  newLevel();
  overlay.classList.add('show');
})();
