(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const levelEl = document.getElementById('level');
  const movesEl = document.getElementById('moves');
  const bestEl = document.getElementById('best');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const CAP = 4;               // segments per tube
  const EMPTY_TUBES = 2;       // free working space
  // Ordered so the early levels get the most distinguishable colours first —
  // three shades of orange next to each other would be unreadable.
  const COLORS = [
    '#ef4444', '#06d4f7', '#22c55e', '#fbbf24', '#ec4899',
    '#8b5cf6', '#f97316', '#3b82f6', '#14b8a6', '#a3e635'
  ];

  let tubes, level, moves, picked, history, gameState, anim;

  level = 1;
  let best = +localStorage.getItem('watersort-best') || 0;
  bestEl.textContent = best || '—';

  // How many colours this level uses. Grows slowly so the ramp stays gentle.
  function colourCount(lv) { return Math.min(COLORS.length, 3 + Math.floor((lv - 1) / 2)); }

  /* ---------- generation ---------- */

  // Deal colours at random, then prove the deal is solvable before using it.
  // A random deal with two free tubes almost always is, so this rarely retries.
  function deal(nColours) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const pool = [];
      for (let c = 0; c < nColours; c++) {
        for (let i = 0; i < CAP; i++) pool.push(c);
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
      }
      const t = [];
      for (let i = 0; i < nColours; i++) t.push(pool.slice(i * CAP, i * CAP + CAP));
      for (let i = 0; i < EMPTY_TUBES; i++) t.push([]);
      if (alreadyDone(t)) continue;          // a pre-sorted deal is no puzzle
      if (solvable(t)) return t;
    }
    return null; // caller falls back
  }

  function key(t) {
    // Tube order is irrelevant to solvability, so sort for a canonical key.
    return t.map(x => x.join(',')).sort().join('|');
  }

  function alreadyDone(t) {
    return t.every(tb => tb.length === 0 || (tb.length === CAP && tb.every(c => c === tb[0])));
  }

  // Depth-first search with a visited set and a node budget.
  function solvable(start) {
    const seen = new Set();
    const stack = [start.map(x => x.slice())];
    let budget = 40000;
    while (stack.length && budget-- > 0) {
      const st = stack.pop();
      if (alreadyDone(st)) return true;
      const k = key(st);
      if (seen.has(k)) continue;
      seen.add(k);
      for (let a = 0; a < st.length; a++) {
        for (let b = 0; b < st.length; b++) {
          if (a === b || !canPour(st, a, b)) continue;
          const next = st.map(x => x.slice());
          pourInto(next, a, b);
          if (!seen.has(key(next))) stack.push(next);
        }
      }
    }
    return false;
  }

  /* ---------- rules ---------- */

  function topRun(tube) {
    // length of the run of identical colours at the top of the tube
    if (!tube.length) return 0;
    const c = tube[tube.length - 1];
    let n = 1;
    while (n < tube.length && tube[tube.length - 1 - n] === c) n++;
    return n;
  }

  function canPour(t, from, to) {
    const a = t[from], b = t[to];
    if (!a.length || b.length >= CAP) return false;
    if (from === to) return false;
    if (b.length && b[b.length - 1] !== a[a.length - 1]) return false;
    // shuffling a whole single-colour tube into an empty one achieves nothing
    if (!b.length && topRun(a) === a.length) return false;
    return true;
  }

  function pourInto(t, from, to) {
    const a = t[from], b = t[to];
    let n = Math.min(topRun(a), CAP - b.length);
    const c = a[a.length - 1];
    for (let i = 0; i < n; i++) { a.pop(); b.push(c); }
    return n;
  }

  /* ---------- game flow ---------- */

  function newLevel() {
    const n = colourCount(level);
    let t = deal(n);
    if (!t) {                       // extremely unlikely; drop back a colour
      t = deal(Math.max(3, n - 1)) || deal(3);
    }
    tubes = t;
    moves = 0; picked = -1; history = []; anim = null;
    gameState = 'play';
    levelEl.textContent = level;
    movesEl.textContent = 0;
    overlay.classList.remove('show');
    statusEl.textContent = 'Click a tube to lift its top colour, then click where to pour it.';
    draw();
  }

  function snapshot() {
    history.push({t: tubes.map(x => x.slice()), m: moves});
    if (history.length > 400) history.shift();
  }

  function undo() {
    if (gameState !== 'play' || !history.length) return;
    const h = history.pop();
    tubes = h.t; moves = h.m; picked = -1;
    movesEl.textContent = moves;
    statusEl.textContent = 'Move undone.';
    draw();
  }

  function win() {
    gameState = 'won';
    picked = -1;
    if (!best || moves < best) {
      best = moves;
      localStorage.setItem('watersort-best', best);
      bestEl.textContent = best;
    }
    overTitle.textContent = 'Level ' + level + ' sorted';
    overMsg.textContent = moves + ' moves. Next level adds another colour.';
    document.getElementById('restartOverlay').textContent = 'Next Level';
    overlay.classList.add('show');
    statusEl.textContent = 'Sorted.';
    draw();
  }

  function click(idx) {
    if (gameState !== 'play' || idx < 0) return;
    if (picked === -1) {
      if (!tubes[idx].length) return;
      picked = idx;
      statusEl.textContent = 'Now click the tube to pour into.';
    } else if (picked === idx) {
      picked = -1;
      statusEl.textContent = 'Cancelled.';
    } else if (canPour(tubes, picked, idx)) {
      snapshot();
      const from = picked;
      const n = pourInto(tubes, from, idx);
      picked = -1;
      moves++;
      movesEl.textContent = moves;
      anim = {to: idx, n, t: 0};
      statusEl.textContent = 'Poured ' + n + '.';
      if (alreadyDone(tubes)) { draw(); setTimeout(win, 260); return; }
    } else {
      statusEl.textContent = "That pour isn't allowed.";
      picked = tubes[idx].length ? idx : -1;
    }
    draw();
  }

  /* ---------- layout + drawing ---------- */

  function layout() {
    const n = tubes.length;
    const perRow = n > 6 ? Math.ceil(n / 2) : n;
    const rows = Math.ceil(n / perRow);
    const tw = Math.min(54, Math.floor((W - 40) / perRow) - 12);
    const th = rows > 1 ? 150 : 250;
    const gap = (W - perRow * tw) / (perRow + 1);
    const totalH = rows * th + (rows - 1) * 26;
    const top = (H - totalH) / 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / perRow), c = i % perRow;
      const inRow = Math.min(perRow, n - r * perRow);
      const g = (W - inRow * tw) / (inRow + 1);
      out.push({x: g + c * (tw + g), y: top + r * (th + 26), w: tw, h: th});
    }
    return out;
  }

  function hit(mx, my) {
    const L = layout();
    for (let i = 0; i < L.length; i++) {
      const b = L[i];
      // generous vertical target so the whole column is clickable
      if (mx >= b.x - 6 && mx <= b.x + b.w + 6 && my >= b.y - 18 && my <= b.y + b.h + 10) return i;
    }
    return -1;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const L = layout();
    for (let i = 0; i < tubes.length; i++) tube(L[i], tubes[i], i === picked, i);

    if (anim) {
      anim.t++;
      if (anim.t > 12) anim = null; else requestAnimationFrame(draw);
    }
  }

  function tube(b, contents, isPicked, idx) {
    const r = b.w / 2;
    const segH = (b.h - 10) / CAP;

    ctx.save();
    // glass body: rounded bottom, open top
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + b.h - r);
    ctx.arc(b.x + r, b.y + b.h - r, r, Math.PI, 0, true);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    for (let i = 0; i < contents.length; i++) {
      const c = COLORS[contents[i]];
      const y = b.y + b.h - 5 - (i + 1) * segH;
      const grad = ctx.createLinearGradient(b.x, y, b.x + b.w, y);
      grad.addColorStop(0, shade(c, -30));
      grad.addColorStop(0.45, c);
      grad.addColorStop(1, shade(c, -46));
      ctx.fillStyle = grad;
      ctx.fillRect(b.x, y, b.w, segH + 1);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 4, y + 3, b.w * 0.22, segH - 7);
    }

    if (anim && anim.to === idx) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 * (1 - anim.t / 12)) + ')';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.restore();

    // glass outline
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + b.h - r);
    ctx.arc(b.x + r, b.y + b.h - r, r, Math.PI, 0, true);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.lineWidth = isPicked ? 3 : 2;
    ctx.strokeStyle = isPicked ? '#fde047' : 'rgba(190,200,255,0.4)';
    ctx.stroke();

    if (isPicked) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(b.x + r, b.y - 14);
      ctx.lineTo(b.x + r - 6, b.y - 4);
      ctx.lineTo(b.x + r + 6, b.y - 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    return '#' + ((cl(((n >> 16) & 255) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  /* ---------- input ---------- */

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }
  canvas.addEventListener('mousedown', e => { const p = pos(e); click(hit(p.x, p.y)); });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const p = pos(e); click(hit(p.x, p.y));
  }, {passive: false});

  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!history.length) return;
    tubes = history[0].t.map(x => x.slice());
    history = []; moves = 0; picked = -1;
    movesEl.textContent = 0;
    statusEl.textContent = 'Board reset.';
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
  document.addEventListener('keydown', e => {
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  });

  // Show the board straight away behind the intro overlay.
  newLevel();
  gameState = 'play';
  overlay.classList.add('show');
})();
