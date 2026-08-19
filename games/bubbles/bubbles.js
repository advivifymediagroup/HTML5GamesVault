(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const leftEl = document.getElementById('left');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const R = 18;                              // bubble radius
  const D = R * 2;                           // diameter
  const COLS = 11;
  const ROWS = 12;
  const ROW_H = R * 1.75;                    // hex offset
  const START_ROWS = 6;
  const LOSE_Y = H - 90;

  const COLORS = ['#ef4444', '#22c55e', '#06d4f7', '#fde047', '#a855f7'];

  let grid;                                   // 2D array [row][col] = color idx or null
  let shooter;                                // {x, y, angle, color}
  let flying;                                 // {x, y, vx, vy, color} or null
  let nextColor;
  let score, best, gameState;                 // 'aim' | 'flying' | 'over' | 'win'

  // Pop feedback: radial particle bursts, plus a screen shake that scales with cluster size.
  let bursts = [];                            // pop particles
  let fallers = [];                           // disconnected bubbles falling off-screen with gravity
  let shakeT = 0;                             // screen shake magnitude, decays each frame

  function spawnBurst(x, y, color, count) {
    count = count || 9;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      bursts.push({x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 24, max: 24, color});
    }
  }
  function shakeScreen(amount) { shakeT = Math.max(shakeT, amount); }

  best = +localStorage.getItem('bubbles-best') || 0;
  bestEl.textContent = best;

  function cellX(r, c) {
    const offset = (r % 2 === 1) ? R : 0;
    return R + c * D + offset + 6;
  }
  function cellY(r) { return R + r * ROW_H + 6; }

  function newGame() {
    grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));
    // Fill top START_ROWS
    for (let r = 0; r < START_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r % 2 === 1 && c === COLS - 1) continue; // odd rows have 1 fewer
        grid[r][c] = Math.floor(Math.random() * COLORS.length);
      }
    }
    shooter = {x: W / 2, y: H - 34, angle: -Math.PI / 2, color: activeRandColor()};
    nextColor = activeRandColor();
    flying = null;
    bursts = [];
    fallers = [];
    shakeT = 0;
    score = 0;
    scoreEl.textContent = 0;
    gameState = 'aim';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Aim, click to shoot.';
    updateCount();
  }

  function activeRandColor() {
    // Only choose colors still present on the board (avoid dead-color runs)
    const present = new Set();
    for (const row of (grid || [])) for (const v of row) if (v !== null) present.add(v);
    const pool = present.size ? [...present] : COLORS.map((_, i) => i);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function updateCount() {
    let n = 0;
    for (const row of grid) for (const v of row) if (v !== null) n++;
    leftEl.textContent = n;
  }

  function shoot() {
    if (gameState !== 'aim') return;
    const speed = 8;
    flying = {
      x: shooter.x,
      y: shooter.y,
      vx: Math.cos(shooter.angle) * speed,
      vy: Math.sin(shooter.angle) * speed,
      color: shooter.color
    };
    shooter.color = nextColor;
    nextColor = activeRandColor();
    gameState = 'flying';
  }

  function nearestCell(x, y) {
    // Find closest grid cell to (x, y)
    let best = null, bestDist = Infinity;
    for (let r = 0; r < ROWS; r++) {
      const maxC = r % 2 === 1 ? COLS - 1 : COLS;
      for (let c = 0; c < maxC; c++) {
        if (grid[r][c] !== null) continue;
        const dx = cellX(r, c) - x, dy = cellY(r) - y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = {r, c}; }
      }
    }
    return best;
  }

  function neighbors(r, c) {
    const odd = r % 2 === 1;
    const rel = odd
      ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
      : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
    const out = [];
    for (const [dr, dc] of rel) {
      const nr = r + dr, nc = c + dc;
      const maxC = nr % 2 === 1 ? COLS - 1 : COLS;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < maxC) out.push([nr, nc]);
    }
    return out;
  }

  function matchGroup(r, c) {
    const color = grid[r][c];
    if (color === null) return [];
    const visited = new Set();
    const stack = [[r, c]];
    const found = [];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const key = cr + ',' + cc;
      if (visited.has(key)) continue;
      visited.add(key);
      if (grid[cr][cc] !== color) continue;
      found.push([cr, cc]);
      for (const [nr, nc] of neighbors(cr, cc)) {
        if (!visited.has(nr + ',' + nc)) stack.push([nr, nc]);
      }
    }
    return found;
  }

  function dropDisconnected() {
    // BFS from top row — every unreached bubble should drop
    const reached = new Set();
    const queue = [];
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c] !== null) { queue.push([0, c]); reached.add('0,' + c); }
    }
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of neighbors(r, c)) {
        const key = nr + ',' + nc;
        if (reached.has(key)) continue;
        if (grid[nr][nc] !== null) { reached.add(key); queue.push([nr, nc]); }
      }
    }
    let dropped = 0;
    for (let r = 0; r < ROWS; r++) {
      const maxC = r % 2 === 1 ? COLS - 1 : COLS;
      for (let c = 0; c < maxC; c++) {
        if (grid[r][c] !== null && !reached.has(r + ',' + c)) {
          // give the disconnected bubble gravity + drift instead of deleting it outright
          fallers.push({
            x: cellX(r, c), y: cellY(r),
            vx: (Math.random() - 0.5) * 1.8, vy: 1 + Math.random(),
            color: COLORS[grid[r][c]]
          });
          grid[r][c] = null;
          dropped++;
        }
      }
    }
    return dropped;
  }

  function stickAndResolve(cell) {
    grid[cell.r][cell.c] = flying.color;
    flying = null;
    // check win
    const remaining = grid.flat().filter(v => v !== null).length;
    if (remaining === 0) return winGame();
    // match
    const group = matchGroup(cell.r, cell.c);
    if (group.length >= 3) {
      const gcolor = COLORS[grid[group[0][0]][group[0][1]]];
      for (const [r, c] of group) { spawnBurst(cellX(r, c), cellY(r), gcolor); grid[r][c] = null; }
      const dropped = dropDisconnected();
      shakeScreen(Math.min(16, 4 + (group.length + dropped) * 0.9));
      score += (group.length + dropped) * 10;
      scoreEl.textContent = score;
      statusEl.innerHTML = `+${group.length}${dropped ?` and ${dropped} fell` : ''}!`;
    }
    updateCount();
    // check lose — any bubble past LOSE_Y?
    for (let r = 0; r < ROWS; r++) {
      const maxC = r % 2 === 1 ? COLS - 1 : COLS;
      for (let c = 0; c < maxC; c++) {
        if (grid[r][c] !== null && cellY(r) > LOSE_Y) return gameOver();
      }
    }
    // check win again after cascades
    if (grid.flat().filter(v => v !== null).length === 0) return winGame();
    gameState = 'aim';
    // if next color no longer valid, refresh
    if (!colorPresent(shooter.color)) shooter.color = activeRandColor();
  }

  function colorPresent(idx) {
    for (const row of grid) for (const v of row) if (v === idx) return true;
    return false;
  }

  function winGame() {
    gameState = 'win';
    if (score > best) { best = score; localStorage.setItem('bubbles-best', best); bestEl.textContent = best; }
    overTitle.textContent = 'Cleared!';
    overMsg.textContent = `Score: ${score}`;
    overlay.classList.add('show');
    statusEl.innerHTML = 'Board cleared!';
  }
  function gameOver() {
    gameState = 'over';
    if (score > best) { best = score; localStorage.setItem('bubbles-best', best); bestEl.textContent = best; }
    overTitle.textContent = 'Overflow';
    overMsg.textContent = `Score: ${score}`;
    overlay.classList.add('show');
    statusEl.innerHTML = 'Bubbles reached the line.';
  }

  function update() {
    if (flying) {
      flying.x += flying.vx;
      flying.y += flying.vy;
      // walls
      if (flying.x - R < 6) { flying.x = 6 + R; flying.vx *= -1; }
      if (flying.x + R > W - 6) { flying.x = W - 6 - R; flying.vx *= -1; }
      // top
      if (flying.y - R < 6) { flying.y = 6 + R; flying.vy = Math.abs(flying.vy); }
      // collision with any bubble
      let hit = false;
      for (let r = 0; r < ROWS && !hit; r++) {
        const maxC = r % 2 === 1 ? COLS - 1 : COLS;
        for (let c = 0; c < maxC; c++) {
          if (grid[r][c] === null) continue;
          const dx = cellX(r, c) - flying.x;
          const dy = cellY(r) - flying.y;
          if (dx * dx + dy * dy < (R + R - 2) * (R + R - 2)) { hit = true; break; }
        }
      }
      // near top row and no hit
      if (!hit && flying.y - R <= 6.5) hit = true;
      if (hit) {
        const cell = nearestCell(flying.x, flying.y);
        if (cell) stickAndResolve(cell);
        else { flying = null; gameState = 'aim'; }
      }
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life <= 0) bursts.splice(i, 1);
    }
    for (let i = fallers.length - 1; i >= 0; i--) {
      const f = fallers[i];
      f.vy += 0.35;
      f.x += f.vx; f.y += f.vy;
      if (f.y - R > H + 40) fallers.splice(i, 1);
    }
  }

  function draw() {
    ctx.save();
    if (shakeT > 0.3) {
      ctx.translate((Math.random() - 0.5) * shakeT, (Math.random() - 0.5) * shakeT);
      shakeT *= 0.82;
    } else {
      shakeT = 0;
    }

    ctx.fillStyle = '#050514';
    ctx.fillRect(0, 0, W, H);

    // subtle grid guide
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    // lose line
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(0, LOSE_Y);
    ctx.lineTo(W, LOSE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // bubbles in grid
    for (let r = 0; r < ROWS; r++) {
      const maxC = r % 2 === 1 ? COLS - 1 : COLS;
      for (let c = 0; c < maxC; c++) {
        if (grid[r][c] === null) continue;
        drawBubble(cellX(r, c), cellY(r), COLORS[grid[r][c]]);
      }
    }

    // aim line
    if (gameState === 'aim') {
      let x = shooter.x, y = shooter.y;
      let vx = Math.cos(shooter.angle), vy = Math.sin(shooter.angle);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 100; i++) {
        x += vx * 6; y += vy * 6;
        if (x - R < 6 || x + R > W - 6) vx *= -1;
        if (y < 20) break;
        // stop at first grid contact
        let hit = false;
        for (let r = 0; r < ROWS && !hit; r++) {
          const maxC = r % 2 === 1 ? COLS - 1 : COLS;
          for (let c = 0; c < maxC; c++) {
            if (grid[r][c] === null) continue;
            const dx = cellX(r, c) - x, dy = cellY(r) - y;
            if (dx * dx + dy * dy < (R + R) * (R + R)) { hit = true; break; }
          }
        }
        ctx.lineTo(x, y);
        if (hit) break;
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // ghost landing indicator — snaps to the predicted grid cell
      const landCell = nearestCell(x, y);
      const gx = landCell ? cellX(landCell.r, landCell.c) : x;
      const gy = landCell ? cellY(landCell.r) : y;
      ctx.strokeStyle = COLORS[shooter.color];
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // shooter platform
    ctx.fillStyle = 'rgba(20, 20, 58, 0.8)';
    ctx.fillRect(0, H - 60, W, 60);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, H - 60);
    ctx.lineTo(W, H - 60);
    ctx.stroke();

    // next bubble
    drawBubble(30, H - 20, COLORS[nextColor], 12);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Space Grotesk"';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', 46, H - 16);

    // current shooter bubble
    drawBubble(shooter.x, shooter.y, COLORS[shooter.color]);

    // flying
    if (flying) drawBubble(flying.x, flying.y, COLORS[flying.color]);

    // falling disconnected bubbles
    for (const f of fallers) drawBubble(f.x, f.y, f.color);

    // pop particle bursts
    for (const p of bursts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawBubble(x, y, color, r = R) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.15, color);
    g.addColorStop(1, shade(color, -40));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // outline
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function shade(hex, amt) {
    let h = hex.replace('#','');
    const num = parseInt(h, 16);
    let r = ((num >> 16) & 0xff) + amt; r = Math.max(0, Math.min(255, r));
    let g = ((num >> 8) & 0xff) + amt; g = Math.max(0, Math.min(255, g));
    let b = (num & 0xff) + amt; b = Math.max(0, Math.min(255, b));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    let ang = Math.atan2(y - shooter.y, x - shooter.x);
    // Clamp so we can't aim below horizontal
    if (ang > -Math.PI * 0.05) ang = -Math.PI * 0.05;
    if (ang < -Math.PI + Math.PI * 0.05) ang = -Math.PI + Math.PI * 0.05;
    shooter.angle = ang;
  });
  canvas.addEventListener('click', shoot);
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const t = e.touches[0];
    const x = (t.clientX - rect.left) * scale;
    const y = (t.clientY - rect.top) * scale;
    let ang = Math.atan2(y - shooter.y, x - shooter.x);
    if (ang > -Math.PI * 0.05) ang = -Math.PI * 0.05;
    if (ang < -Math.PI + Math.PI * 0.05) ang = -Math.PI + Math.PI * 0.05;
    shooter.angle = ang;
  }, {passive: false});
  canvas.addEventListener('touchend', shoot);

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);

  newGame();
  loop();
})();
