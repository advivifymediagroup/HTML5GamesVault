(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const levelEl = document.getElementById('level');
  const pipesEl = document.getElementById('pipes');
  const bestEl = document.getElementById('best');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const COLORS = [
    '#ef4444', '#06d4f7', '#22c55e', '#fbbf24', '#ec4899',
    '#8b5cf6', '#f97316', '#3b82f6'
  ];

  let N, cellPx, ox, oy;
  let dot, owner, paths, cur, level, moves, gameState;

  level = 1;
  let best = +localStorage.getItem('flow-best') || 0;
  bestEl.textContent = best || '—';

  const idx = (r, c) => r * N + c;
  const rowOf = i => (i / N) | 0;
  const colOf = i => i % N;
  const adjacent = (a, b) =>
    Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;

  /* ---------- generation ----------

     Levels are built backwards from a guaranteed solution: lay a single
     Hamiltonian path that visits every square once, then chop it into
     contiguous runs. Each run becomes one colour, its two ends become the
     dots. That construction is itself a valid solve, so the level is always
     solvable and always fills the board.                                   */

  function hamiltonian(n) {
    const total = n * n;
    const visited = new Array(total).fill(false);
    const path = [];
    let budget = 300000;

    function neighbours(i) {
      const r = (i / n) | 0, c = i % n;
      const out = [];
      if (r > 0) out.push(i - n);
      if (r < n - 1) out.push(i + n);
      if (c > 0) out.push(i - 1);
      if (c < n - 1) out.push(i + 1);
      return out;
    }

    function freeCount(i) {
      return neighbours(i).filter(j => !visited[j]).length;
    }

    function walk(i) {
      if (budget-- <= 0) return false;
      visited[i] = true;
      path.push(i);
      if (path.length === total) return true;

      // Warnsdorff: try the most constrained neighbour first. Without this
      // the search strands itself in a dead end almost immediately.
      const opts = neighbours(i).filter(j => !visited[j]);
      opts.sort((a, b) => freeCount(a) - freeCount(b) || Math.random() - 0.5);
      for (const j of opts) {
        if (walk(j)) return true;
      }
      visited[i] = false;
      path.pop();
      return false;
    }

    for (let tries = 0; tries < 30; tries++) {
      visited.fill(false);
      path.length = 0;
      budget = 300000;
      const start = Math.floor(Math.random() * total);
      if (walk(start)) return path.slice();
    }
    return null;
  }

  function buildLevel(n, k) {
    const path = hamiltonian(n);
    if (!path) return null;

    // Chop into k runs of at least 3 cells so no colour is a trivial pair of
    // neighbours and every colour has a real route to find.
    const total = path.length;
    const minRun = 3;
    if (k * minRun > total) k = Math.floor(total / minRun);

    const cuts = [];
    let remaining = total - k * minRun;
    for (let i = 0; i < k; i++) {
      const extra = i === k - 1 ? remaining : Math.floor(Math.random() * (remaining + 1));
      cuts.push(minRun + extra);
      remaining -= extra;
    }

    const d = new Array(total).fill(-1);
    let at = 0;
    for (let c = 0; c < cuts.length; c++) {
      const seg = path.slice(at, at + cuts[c]);
      at += cuts[c];
      d[seg[0]] = c;
      d[seg[seg.length - 1]] = c;
    }
    return {dot: d, colours: cuts.length};
  }

  /* ---------- game flow ---------- */

  function sizeFor(lv) {
    return Math.min(8, 5 + Math.floor((lv - 1) / 3));
  }
  function coloursFor(n) {
    return Math.min(COLORS.length, Math.max(3, n - 1));
  }

  function newLevel() {
    N = sizeFor(level);
    let built = null;
    for (let t = 0; t < 6 && !built; t++) built = buildLevel(N, coloursFor(N));
    if (!built) { N = 5; built = buildLevel(5, 4); }

    dot = built.dot;
    paths = [];
    for (let i = 0; i < built.colours; i++) paths.push([]);
    owner = new Array(N * N).fill(-1);
    cur = null;
    moves = 0;
    gameState = 'play';

    cellPx = Math.floor((Math.min(W, H) - 24) / N);
    ox = Math.floor((W - cellPx * N) / 2);
    oy = Math.floor((H - cellPx * N) / 2);

    levelEl.textContent = level;
    overlay.classList.remove('show');
    statusEl.textContent = 'Drag from one dot to its matching pair.';
    updateCount();
    draw();
  }

  function endpointsOf(k) {
    const out = [];
    for (let i = 0; i < dot.length; i++) if (dot[i] === k) out.push(i);
    return out;
  }

  function complete(k) {
    const p = paths[k];
    if (p.length < 2) return false;
    return dot[p[0]] === k && dot[p[p.length - 1]] === k && p[0] !== p[p.length - 1];
  }

  function updateCount() {
    const done = paths.filter((_, k) => complete(k)).length;
    pipesEl.textContent = done + '/' + paths.length;
  }

  function filled() {
    return owner.every(v => v >= 0);
  }

  function checkWin() {
    if (!paths.every((_, k) => complete(k))) return;
    if (!filled()) {
      statusEl.textContent = 'All joined — but some squares are still empty.';
      return;
    }
    gameState = 'won';
    if (!best || moves < best) {
      best = moves;
      localStorage.setItem('flow-best', best);
      bestEl.textContent = best;
    }
    overTitle.textContent = 'Level ' + level + ' complete';
    overMsg.textContent = 'Board filled in ' + moves + ' moves.';
    document.getElementById('restartOverlay').textContent = 'Next Level';
    overlay.classList.add('show');
    statusEl.textContent = 'Complete.';
  }

  /* ---------- path editing ---------- */

  function setPath(k, list) {
    for (let i = 0; i < owner.length; i++) if (owner[i] === k) owner[i] = -1;
    paths[k] = list;
    for (const c of list) owner[c] = k;
  }

  function truncate(k, upto) {
    // keep cells [0 .. upto] inclusive
    setPath(k, paths[k].slice(0, upto + 1));
  }

  function startAt(i) {
    if (gameState !== 'play' || i < 0) return;
    if (dot[i] >= 0) {
      cur = dot[i];
      setPath(cur, [i]);           // grabbing a dot restarts that colour
      moves++;
      statusEl.textContent = 'Drag to the matching dot.';
    } else if (owner[i] >= 0) {
      cur = owner[i];
      const at = paths[cur].indexOf(i);
      truncate(cur, at);           // grabbing mid-pipe cuts it back to here
      moves++;
    } else {
      cur = null;
      return;
    }
    updateCount();
    draw();
  }

  function extendTo(i) {
    if (cur === null || i < 0 || gameState !== 'play') return;
    const p = paths[cur];
    if (!p.length) return;
    const last = p[p.length - 1];
    if (i === last) return;
    if (!adjacent(last, i)) return;

    const backAt = p.indexOf(i);
    if (backAt >= 0) { truncate(cur, backAt); draw(); return; }

    // A finished colour can't be extended past its second dot.
    if (dot[last] === cur && p.length > 1) return;

    if (dot[i] >= 0 && dot[i] !== cur) return;   // never run through another dot

    if (owner[i] >= 0 && owner[i] !== cur) {
      // crossing someone else's pipe cuts it where we entered
      const k = owner[i];
      const at = paths[k].indexOf(i);
      truncate(k, at - 1);
    }

    p.push(i);
    owner[i] = cur;
    updateCount();
    draw();

    if (dot[i] === cur) {
      cur = null;
      checkWin();
    }
  }

  /* ---------- drawing ---------- */

  function centre(i) {
    return {x: ox + colOf(i) * cellPx + cellPx / 2, y: oy + rowOf(i) * cellPx + cellPx / 2};
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(ox, oy, cellPx * N, cellPx * N);

    ctx.strokeStyle = 'rgba(190,200,255,0.16)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= N; k++) {
      ctx.beginPath();
      ctx.moveTo(ox + k * cellPx, oy);
      ctx.lineTo(ox + k * cellPx, oy + N * cellPx);
      ctx.moveTo(ox, oy + k * cellPx);
      ctx.lineTo(ox + N * cellPx, oy + k * cellPx);
      ctx.stroke();
    }

    // pipes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < paths.length; k++) {
      const p = paths[k];
      if (p.length < 2) continue;
      ctx.strokeStyle = COLORS[k % COLORS.length];
      ctx.lineWidth = cellPx * 0.38;
      ctx.globalAlpha = complete(k) ? 1 : 0.72;
      ctx.beginPath();
      const a = centre(p[0]);
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < p.length; i++) {
        const b = centre(p[i]);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // the free end of the pipe being drawn
    if (cur !== null && paths[cur].length) {
      const t = centre(paths[cur][paths[cur].length - 1]);
      ctx.fillStyle = COLORS[cur % COLORS.length];
      ctx.beginPath();
      ctx.arc(t.x, t.y, cellPx * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }

    // dots
    for (let i = 0; i < dot.length; i++) {
      const k = dot[i];
      if (k < 0) continue;
      const p = centre(i);
      const r = cellPx * 0.31;
      const grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, COLORS[k % COLORS.length]);
      grad.addColorStop(1, COLORS[k % COLORS.length]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (complete(k)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /* ---------- input ---------- */

  function at(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const x = (p.clientX - r.left) * (W / r.width) - ox;
    const y = (p.clientY - r.top) * (H / r.height) - oy;
    if (x < 0 || y < 0) return -1;
    const c = (x / cellPx) | 0, rr = (y / cellPx) | 0;
    if (c >= N || rr >= N) return -1;
    return idx(rr, c);
  }

  canvas.addEventListener('mousedown', e => startAt(at(e)));
  canvas.addEventListener('mousemove', e => { if (cur !== null) extendTo(at(e)); });
  window.addEventListener('mouseup', () => { cur = null; draw(); });

  canvas.addEventListener('touchstart', e => { e.preventDefault(); startAt(at(e)); }, {passive: false});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (cur !== null) extendTo(at(e));
  }, {passive: false});
  window.addEventListener('touchend', () => { cur = null; draw(); });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (gameState !== 'play') return;
    for (let k = 0; k < paths.length; k++) setPath(k, []);
    cur = null;
    updateCount();
    statusEl.textContent = 'Board cleared.';
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
  gameState = 'play';
  overlay.classList.add('show');
})();
