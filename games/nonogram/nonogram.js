(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const sizeEl = document.getElementById('size');
  const filledEl = document.getElementById('filled');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const sizeSel = document.getElementById('size');

  // 0 = untouched, 1 = filled, 2 = marked empty
  let N, solution, cell, rowClues, colClues, cellPx, gx, gy, clueW, clueH;
  let startedAt, timer, gameState, drag;

  /* ---------- generation ---------- */

  function clues(line) {
    const out = [];
    let run = 0;
    for (const v of line) {
      if (v) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out.length ? out : [0];
  }

  // Work out everything a single line's clue forces, given what is already
  // known about it. Returns a new state array, or null if the clue cannot be
  // satisfied at all. 0 = unknown, 1 = filled, 2 = empty.
  function solveLine(clue, state) {
    const n = state.length;
    const total = clue[0] === 0 ? 0 : clue.reduce((a, b) => a + b, 0);
    const tally = new Array(n).fill(0);
    let arrangements = 0;

    const line = new Array(n).fill(2);

    function place(ci, from) {
      if (ci === clue.length || total === 0) {
        for (let i = from; i < n; i++) {
          if (state[i] === 1) return;      // a known-filled cell left uncovered
          line[i] = 2;
        }
        arrangements++;
        for (let i = 0; i < n; i++) if (line[i] === 1) tally[i]++;
        return;
      }
      const len = clue[ci];
      // remaining blocks plus the gaps between them
      let need = 0;
      for (let k = ci; k < clue.length; k++) need += clue[k];
      need += clue.length - ci - 1;

      for (let s = from; s + need <= n; s++) {
        let bad = false;
        for (let i = from; i < s; i++) {
          if (state[i] === 1) { bad = true; break; }   // skipped a filled cell
          line[i] = 2;
        }
        if (bad) break;
        for (let i = s; i < s + len; i++) {
          if (state[i] === 2) { bad = true; break; }   // ran over a known blank
          line[i] = 1;
        }
        if (!bad) {
          const gap = s + len;
          if (gap < n) {
            if (state[gap] === 1) bad = true;          // needs a gap here
            else line[gap] = 2;
          }
          if (!bad) place(ci + 1, gap + 1);
        }
      }
    }

    place(0, 0);
    if (!arrangements) return null;

    const out = state.slice();
    for (let i = 0; i < n; i++) {
      if (tally[i] === arrangements) out[i] = 1;
      else if (tally[i] === 0) out[i] = 2;
    }
    return out;
  }

  // A puzzle is worth playing only if pure line-by-line deduction cracks it.
  // Anything that needs a guess gets thrown away.
  function lineSolvable(sol, n, rc, cc) {
    const st = new Array(n * n).fill(0);
    for (let pass = 0; pass < 40; pass++) {
      let changed = false;
      for (let r = 0; r < n; r++) {
        const cur = [];
        for (let c = 0; c < n; c++) cur.push(st[r * n + c]);
        const next = solveLine(rc[r], cur);
        if (!next) return false;
        for (let c = 0; c < n; c++) {
          if (next[c] !== st[r * n + c]) { st[r * n + c] = next[c]; changed = true; }
        }
      }
      for (let c = 0; c < n; c++) {
        const cur = [];
        for (let r = 0; r < n; r++) cur.push(st[r * n + c]);
        const next = solveLine(cc[c], cur);
        if (!next) return false;
        for (let r = 0; r < n; r++) {
          if (next[r] !== st[r * n + c]) { st[r * n + c] = next[r]; changed = true; }
        }
      }
      if (!changed) break;
    }
    for (let i = 0; i < n * n; i++) {
      if (st[i] === 0) return false;                      // still ambiguous
      if ((st[i] === 1 ? 1 : 0) !== sol[i]) return false; // shouldn't happen
    }
    return true;
  }

  function cluesFor(sol, n) {
    const rc = [], cc = [];
    for (let r = 0; r < n; r++) {
      const line = [];
      for (let c = 0; c < n; c++) line.push(sol[r * n + c]);
      rc.push(clues(line));
    }
    for (let c = 0; c < n; c++) {
      const line = [];
      for (let r = 0; r < n; r++) line.push(sol[r * n + c]);
      cc.push(clues(line));
    }
    return {rc, cc};
  }

  function generate(n) {
    const density = n <= 5 ? 0.55 : 0.52;
    let fallback = null;
    // Hard wall-clock budget so a stubborn size can never hang the page.
    const deadline = Date.now() + 700;

    for (let attempt = 0; attempt < 300; attempt++) {
      if (attempt && Date.now() > deadline) break;
      let sol = [];
      for (let i = 0; i < n * n; i++) sol.push(Math.random() < density ? 1 : 0);

      // Smooth toward its neighbours. Blobby shapes give longer runs, which
      // read as a picture and are far more likely to be solvable by logic
      // than the salt-and-pepper noise a raw random fill produces.
      for (let pass = 0; pass < 2; pass++) {
        const next = sol.slice();
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            let on = 0, seen = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                const rr = r + dr, cc2 = c + dc;
                if (rr < 0 || cc2 < 0 || rr >= n || cc2 >= n) continue;
                seen++;
                on += sol[rr * n + cc2];
              }
            }
            next[r * n + c] = on * 2 > seen ? 1 : 0;
          }
        }
        sol = next;
      }

      let blank = false;
      for (let i = 0; i < n; i++) {
        let r = 0, c = 0;
        for (let k = 0; k < n; k++) { r += sol[i * n + k]; c += sol[k * n + i]; }
        if (!r || !c) { blank = true; break; }
      }
      if (blank) continue;

      const filledTotal = sol.reduce((a, b) => a + b, 0);
      if (filledTotal < n * n * 0.28 || filledTotal > n * n * 0.72) continue;

      if (!fallback) fallback = sol;
      const {rc, cc} = cluesFor(sol, n);
      if (lineSolvable(sol, n, rc, cc)) return sol;
    }
    return fallback || new Array(n * n).fill(0).map(() => (Math.random() < 0.5 ? 1 : 0));
  }

  function buildClues() {
    const c = cluesFor(solution, N);
    rowClues = c.rc;
    colClues = c.cc;
  }

  /* ---------- layout ---------- */

  function layout() {
    const maxRow = Math.max(...rowClues.map(c => c.length));
    const maxCol = Math.max(...colClues.map(c => c.length));
    // Reserve space for the clue gutters, then fit the grid in what's left.
    const unit = Math.floor(Math.min(
      (W - 24) / (N + maxRow * 0.72),
      (H - 24) / (N + maxCol * 0.82)
    ));
    cellPx = Math.max(14, unit);
    clueW = Math.ceil(maxRow * cellPx * 0.72);
    clueH = Math.ceil(maxCol * cellPx * 0.82);
    gx = Math.floor((W - (clueW + N * cellPx)) / 2) + clueW;
    gy = Math.floor((H - (clueH + N * cellPx)) / 2) + clueH;
  }

  /* ---------- game flow ---------- */

  function newPuzzle() {
    N = +sizeSel.value || 10;
    solution = generate(N);
    buildClues();
    layout();
    cell = new Array(N * N).fill(0);
    gameState = 'play';
    drag = null;
    sizeEl.textContent = N + '×' + N;
    startedAt = Date.now();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    timeEl.textContent = '0:00';
    overlay.classList.remove('show');
    statusEl.textContent = 'Left click fills a square, right click marks it empty.';
    updateCount();
    draw();
  }

  function tick() {
    if (gameState !== 'play') return;
    const s = Math.floor((Date.now() - startedAt) / 1000);
    timeEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function updateCount() {
    const have = cell.filter(v => v === 1).length;
    const need = solution.reduce((a, b) => a + b, 0);
    filledEl.textContent = have + '/' + need;
  }

  // A line is satisfied when the runs the player has filled match its clue.
  // Comparing runs rather than exact cells means any valid picture counts.
  function lineDone(vals, clue) {
    const got = clues(vals.map(v => (v === 1 ? 1 : 0)));
    if (got.length !== clue.length) return false;
    for (let i = 0; i < got.length; i++) if (got[i] !== clue[i]) return false;
    return true;
  }

  function rowVals(r) {
    const a = [];
    for (let c = 0; c < N; c++) a.push(cell[r * N + c]);
    return a;
  }
  function colVals(c) {
    const a = [];
    for (let r = 0; r < N; r++) a.push(cell[r * N + c]);
    return a;
  }

  function checkWin() {
    for (let r = 0; r < N; r++) if (!lineDone(rowVals(r), rowClues[r])) return;
    for (let c = 0; c < N; c++) if (!lineDone(colVals(c), colClues[c])) return;
    gameState = 'won';
    clearInterval(timer);
    overTitle.textContent = 'Solved';
    overMsg.textContent = 'Every clue satisfied in ' + timeEl.textContent + '.';
    overlay.classList.add('show');
    statusEl.textContent = 'Solved.';
  }

  function paint(i, mode) {
    if (gameState !== 'play' || i < 0) return;
    if (cell[i] === mode) return;
    cell[i] = mode;
    updateCount();
    draw();
    checkWin();
  }

  /* ---------- drawing ---------- */

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const rowOk = [], colOk = [];
    for (let r = 0; r < N; r++) rowOk.push(lineDone(rowVals(r), rowClues[r]));
    for (let c = 0; c < N; c++) colOk.push(lineDone(colVals(c), colClues[c]));

    // clue gutters
    ctx.font = Math.round(cellPx * 0.46) + 'px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < N; r++) {
      ctx.textAlign = 'right';
      ctx.fillStyle = rowOk[r] ? 'rgba(160,170,205,0.42)' : '#cdd4f5';
      const cl = rowClues[r];
      for (let k = 0; k < cl.length; k++) {
        const x = gx - 7 - (cl.length - 1 - k) * cellPx * 0.72;
        ctx.fillText(cl[k], x, gy + r * cellPx + cellPx / 2);
      }
    }
    for (let c = 0; c < N; c++) {
      ctx.textAlign = 'center';
      ctx.fillStyle = colOk[c] ? 'rgba(160,170,205,0.42)' : '#cdd4f5';
      const cl = colClues[c];
      for (let k = 0; k < cl.length; k++) {
        const y = gy - 9 - (cl.length - 1 - k) * cellPx * 0.82;
        ctx.fillText(cl[k], gx + c * cellPx + cellPx / 2, y);
      }
    }

    // cells
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = cell[r * N + c];
        const x = gx + c * cellPx, y = gy + r * cellPx;
        if (v === 1) {
          const grad = ctx.createLinearGradient(x, y, x + cellPx, y + cellPx);
          grad.addColorStop(0, '#a78bfa');
          grad.addColorStop(1, '#6d28d9');
          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, y + 1, cellPx - 2, cellPx - 2);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.045)';
          ctx.fillRect(x + 1, y + 1, cellPx - 2, cellPx - 2);
          if (v === 2) {
            ctx.strokeStyle = 'rgba(239,68,68,0.75)';
            ctx.lineWidth = 1.8;
            const p = cellPx * 0.3;
            ctx.beginPath();
            ctx.moveTo(x + p, y + p); ctx.lineTo(x + cellPx - p, y + cellPx - p);
            ctx.moveTo(x + cellPx - p, y + p); ctx.lineTo(x + p, y + cellPx - p);
            ctx.stroke();
          }
        }
      }
    }

    // grid lines, heavier every fifth to help counting
    for (let k = 0; k <= N; k++) {
      const heavy = k % 5 === 0;
      ctx.strokeStyle = heavy ? 'rgba(190,200,255,0.5)' : 'rgba(190,200,255,0.16)';
      ctx.lineWidth = heavy ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(gx + k * cellPx, gy);
      ctx.lineTo(gx + k * cellPx, gy + N * cellPx);
      ctx.moveTo(gx, gy + k * cellPx);
      ctx.lineTo(gx + N * cellPx, gy + k * cellPx);
      ctx.stroke();
    }
  }

  /* ---------- input ---------- */

  function at(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const x = (p.clientX - r.left) * (W / r.width) - gx;
    const y = (p.clientY - r.top) * (H / r.height) - gy;
    if (x < 0 || y < 0) return -1;
    const c = (x / cellPx) | 0, rr = (y / cellPx) | 0;
    if (c >= N || rr >= N) return -1;
    return rr * N + c;
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('mousedown', e => {
    const i = at(e);
    if (i < 0) return;
    // The first cell decides the stroke: dragging then repeats that same
    // action, so you can sweep a run without toggling cells back off.
    const want = e.button === 2 ? 2 : 1;
    drag = cell[i] === want ? 0 : want;
    paint(i, drag);
  });
  canvas.addEventListener('mousemove', e => {
    if (drag === null) return;
    paint(at(e), drag);
  });
  window.addEventListener('mouseup', () => { drag = null; });

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const i = at(e);
    if (i < 0) return;
    drag = cell[i] === 1 ? 0 : 1;
    paint(i, drag);
  }, {passive: false});
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (drag === null) return;
    paint(at(e), drag);
  }, {passive: false});
  window.addEventListener('touchend', () => { drag = null; });

  document.getElementById('startBtn').addEventListener('click', newPuzzle);
  document.getElementById('restartOverlay').addEventListener('click', newPuzzle);
  sizeSel.addEventListener('change', newPuzzle);

  newPuzzle();
  gameState = 'play';
  overlay.classList.add('show');
})();
