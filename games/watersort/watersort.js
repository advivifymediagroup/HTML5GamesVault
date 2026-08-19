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
  let shake = 0;             // screen-shake magnitude, decays each frame
  const bursts = [];         // particle-burst list for completed tubes

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
      const srcBefore = tubes[from].length;
      const dstBefore = tubes[idx].length;
      const n = pourInto(tubes, from, idx);
      const color = tubes[idx][tubes[idx].length - 1];
      picked = -1;
      moves++;
      movesEl.textContent = moves;
      anim = {from, to: idx, n, color, t: 0, max: 26, srcBefore, dstBefore, settled: false};
      statusEl.textContent = 'Poured ' + n + '.';
      if (alreadyDone(tubes)) { draw(); setTimeout(win, 420); return; }
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

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    const L = layout();
    for (let i = 0; i < tubes.length; i++) tube(L[i], tubes[i], i === picked, i);

    // animated liquid arc streaming between the pouring tubes' mouths
    if (anim) {
      const p = anim.t / anim.max;
      let a = 0;
      if (p < 0.4) a = p / 0.4;
      else if (p < 0.8) a = 1;
      else a = 1 - (p - 0.8) / 0.2;
      if (a > 0.01) {
        const srcB = L[anim.from], dstB = L[anim.to];
        const liftSrc = anim.from === picked ? 14 : 0;
        const sx = srcB.x + srcB.w * 0.82, sy = srcB.y - liftSrc - 4;
        const dx = dstB.x + dstB.w * 0.18, dy = dstB.y - 4;
        const midY = Math.min(sy, dy) - 26;
        ctx.strokeStyle = shade(COLORS[anim.color], 15);
        ctx.globalAlpha = a;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx, midY, dx, midY, dx, dy);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // particle bursts for completed tubes
    for (let i = bursts.length - 1; i >= 0; i--) {
      const pt = bursts[i];
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.16; pt.life--;
      if (pt.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.globalAlpha = pt.life / pt.max;
      ctx.fillStyle = pt.c;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (shake > 0.2) shake *= 0.88; else shake = 0;

    if (anim || bursts.length || shake) {
      if (anim) {
        anim.t++;
        if (anim.t >= anim.max) {
          if (!anim.settled) { anim.settled = true; checkTubeComplete(anim.to); }
          if (anim.t > anim.max + 2) anim = null;
        }
      }
      requestAnimationFrame(draw);
    }
  }

  function burst(x, y, c) {
    for (let i = 0; i < 16; i++) {
      bursts.push({x, y, vx: (Math.random() - 0.5) * 5.5, vy: (Math.random() - 0.5) * 5.5 - 1, life: 30, max: 30, c});
    }
  }

  function checkTubeComplete(idx) {
    const t = tubes[idx];
    if (t.length === CAP && t.every(c => c === t[0])) {
      const b = layout()[idx];
      shake = 9;
      burst(b.x + b.w / 2, b.y + b.h * 0.4, COLORS[t[0]]);
    }
  }

  function tube(b, contents, isPicked, idx) {
    const r = b.w / 2;
    const segH = (b.h - 10) / CAP;
    const lift = isPicked ? 14 : 0;

    // glow halo under a selected (lifted) tube
    if (isPicked) {
      const cx = b.x + r, cy = b.y + b.h;
      const glowColor = contents.length ? COLORS[contents[contents.length - 1]] : '#fde047';
      const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.6);
      glow.addColorStop(0, shade(glowColor, 30));
      glow.addColorStop(0.5, glowColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.6, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }

    b = {x: b.x, y: b.y - lift, w: b.w, h: b.h};

    // effective segment counts, animated during a pour
    let renderContents = contents;
    let growFrac = 0; // extra partial segment height (0..1) grown/removed at the pour end
    if (anim && (idx === anim.from || idx === anim.to)) {
      const p = Math.min(1, anim.t / anim.max);
      const g = p < 0.5 ? 0 : easeOut((p - 0.5) / 0.5);
      if (idx === anim.to) {
        renderContents = contents.slice(0, Math.max(0, contents.length - anim.n));
        growFrac = g;
      } else {
        renderContents = contents.slice(0, contents.length); // already at final (reduced) length
        growFrac = 1 - g; // extra segments fading back in while removed
      }
    }

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

    // liquid segments, with a lighter meniscus band at the top of each colour run
    for (let i = 0; i < renderContents.length; i++) {
      const c = COLORS[renderContents[i]];
      const isTopOfRun = i === renderContents.length - 1 || renderContents[i + 1] !== renderContents[i];
      const y = b.y + b.h - 5 - (i + 1) * segH;
      drawLiquidSegment(b, y, segH, c, isTopOfRun && !(anim && idx === anim.to && growFrac > 0));
    }
    // the growing/shrinking partial segment during a pour
    if (anim && growFrac > 0.001 && (idx === anim.to ? anim.n > 0 : true)) {
      const c = COLORS[anim.color];
      const h = growFrac * anim.n * segH;
      const y = b.y + b.h - 5 - renderContents.length * segH - h;
      drawLiquidSegment(b, y, h, c, true);
    }

    // specular highlight strip down one side of the glass
    const spec = ctx.createLinearGradient(b.x + b.w * 0.14, 0, b.x + b.w * 0.3, 0);
    spec.addColorStop(0, 'rgba(255,255,255,0.22)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.fillRect(b.x + b.w * 0.1, b.y, b.w * 0.22, b.h);

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

  // one liquid band: 4-stop horizontal gradient (dark edge -> base -> light highlight -> dark edge),
  // optionally with a lighter meniscus oval band at its top for a liquid-surface look.
  function drawLiquidSegment(b, y, h, c, withMeniscus) {
    if (h <= 0) return;
    const grad = ctx.createLinearGradient(b.x, y, b.x + b.w, y);
    grad.addColorStop(0, shade(c, -34));
    grad.addColorStop(0.32, c);
    grad.addColorStop(0.62, shade(c, 26));
    grad.addColorStop(1, shade(c, -40));
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, y, b.w, h + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + 4, y + 3, b.w * 0.2, Math.max(0, h - 7));
    if (withMeniscus && h > 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, y + 2, b.w / 2 - 1, Math.min(4, h / 2), 0, 0, Math.PI * 2);
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
