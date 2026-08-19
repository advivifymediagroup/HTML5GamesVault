(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const diffEl = document.getElementById('diff');
  const emptyEl = document.getElementById('empty');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const levelSel = document.getElementById('level');

  const PAD = 26;
  const BOARD = Math.min(W, H) - PAD * 2;
  const CELL = BOARD / 9;
  const OX = (W - BOARD) / 2, OY = (H - BOARD) / 2;

  // How many cells to strip out. More holes means more searching for the player.
  const HOLES = {easy: 38, medium: 48, hard: 55};
  const MAX_HINTS = 3;

  let solution, given, grid, notes, sel, startedAt, timer, gameState;
  let notesMode = false, hintsLeft = MAX_HINTS, history = [];
  let shakeTimer = 0, flashCell = -1, flashTimer = 0;
  const bursts = [];

  /* ---------- generation ---------- */

  function emptyGrid() { return new Array(81).fill(0); }

  function ok(g, i, v) {
    const r = (i / 9) | 0, c = i % 9;
    for (let k = 0; k < 9; k++) {
      if (g[r * 9 + k] === v) return false;
      if (g[k * 9 + c] === v) return false;
    }
    const br = r - r % 3, bc = c - c % 3;
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        if (g[(br + a) * 9 + bc + b] === v) return false;
      }
    }
    return true;
  }

  function shuffled() {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 8; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Fill an empty grid by backtracking with randomised candidates.
  function fill(g, i) {
    if (i === 81) return true;
    if (g[i]) return fill(g, i + 1);
    for (const v of shuffled()) {
      if (!ok(g, i, v)) continue;
      g[i] = v;
      if (fill(g, i + 1)) return true;
      g[i] = 0;
    }
    return false;
  }

  // Count solutions, stopping at 2 — that's all we need to prove uniqueness.
  function countSolutions(g, cap) {
    let best = -1, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      let n = 0;
      for (let v = 1; v <= 9; v++) if (ok(g, i, v)) n++;
      if (n === 0) return 0;
      if (n < bestN) { bestN = n; best = i; if (n === 1) break; }
    }
    if (best === -1) return 1;
    let total = 0;
    for (let v = 1; v <= 9; v++) {
      if (!ok(g, best, v)) continue;
      g[best] = v;
      total += countSolutions(g, cap - total);
      g[best] = 0;
      if (total >= cap) break;
    }
    return total;
  }

  function makePuzzle(holes) {
    const full = emptyGrid();
    fill(full, 0);
    const puz = full.slice();

    // Remove cells in random order, keeping only removals that stay unique.
    const order = [];
    for (let i = 0; i < 81; i++) order.push(i);
    for (let i = 80; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }

    let removed = 0;
    for (const i of order) {
      if (removed >= holes) break;
      const keep = puz[i];
      puz[i] = 0;
      if (countSolutions(puz.slice(), 2) !== 1) puz[i] = keep;
      else removed++;
    }
    return {solution: full, puzzle: puz};
  }

  /* ---------- game flow ---------- */

  function newPuzzle() {
    const lv = levelSel.value;
    statusEl.textContent = 'Building a puzzle…';
    const made = makePuzzle(HOLES[lv] || 38);
    solution = made.solution;
    grid = made.puzzle.slice();
    given = made.puzzle.map(v => v !== 0);
    notes = grid.map(() => new Set());
    history = [];
    hintsLeft = MAX_HINTS;
    updateHintBtn();
    sel = -1;
    shakeTimer = 0; flashCell = -1; flashTimer = 0; bursts.length = 0;
    gameState = 'play';
    diffEl.textContent = lv.charAt(0).toUpperCase() + lv.slice(1);
    startedAt = Date.now();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    timeEl.textContent = '0:00';
    overlay.classList.remove('show');
    statusEl.textContent = 'Click a cell, then type a number.';
    updateEmpty();
    draw();
  }

  function updateHintBtn() {
    const btn = document.getElementById('hintBtn');
    if (btn) btn.textContent = 'Hint (' + hintsLeft + ')';
  }

  function updateNotesBtn() {
    const btn = document.getElementById('notesBtn');
    if (btn) {
      btn.textContent = 'Notes: ' + (notesMode ? 'On' : 'Off');
      btn.style.opacity = notesMode ? '1' : '0.7';
    }
  }

  // Visit every row/column/box peer of cell i (a peer may be revisited once, harmless).
  function forPeers(i, fn) {
    const r = (i / 9) | 0, c = i % 9;
    for (let k = 0; k < 9; k++) {
      if (k !== c) fn(r * 9 + k);
      if (k !== r) fn(k * 9 + c);
    }
    const br = r - r % 3, bc = c - c % 3;
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        const j = (br + a) * 9 + bc + b;
        if (j !== i) fn(j);
      }
    }
  }

  function cellCenter(i) {
    const r = (i / 9) | 0, c = i % 9;
    return {x: OX + c * CELL + CELL / 2, y: OY + r * CELL + CELL / 2};
  }

  // A row, column or box that is completely filled and matches the solution.
  function rowColBoxComplete(i) {
    const r = (i / 9) | 0, c = i % 9;
    let rowFull = true, colFull = true, boxFull = true;
    for (let k = 0; k < 9; k++) {
      if (grid[r * 9 + k] !== solution[r * 9 + k]) rowFull = false;
      if (grid[k * 9 + c] !== solution[k * 9 + c]) colFull = false;
    }
    const br = r - r % 3, bc = c - c % 3;
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) {
        if (grid[(br + a) * 9 + bc + b] !== solution[(br + a) * 9 + bc + b]) boxFull = false;
      }
    }
    return rowFull || colFull || boxFull;
  }

  function pushHistory() {
    history.push({grid: grid.slice(), notes: notes.map(s => new Set(s)), given: given.slice()});
    if (history.length > 50) history.shift();
  }

  function undo() {
    if (gameState !== 'play' || !history.length) return;
    const h = history.pop();
    grid = h.grid; notes = h.notes; given = h.given;
    updateEmpty();
    statusEl.textContent = 'Undid last move.';
    draw();
  }

  function toggleNotesMode() {
    notesMode = !notesMode;
    updateNotesBtn();
  }

  function toggleNote(v) {
    if (gameState !== 'play' || sel < 0 || given[sel] || grid[sel]) return;
    pushHistory();
    if (notes[sel].has(v)) notes[sel].delete(v); else notes[sel].add(v);
    draw();
  }

  function triggerMistake(i) {
    shakeTimer = 14;
    flashCell = i; flashTimer = 20;
  }

  function burstAt(x, y, c) {
    for (let k = 0; k < 14; k++) {
      bursts.push({x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 - 1, life: 28, max: 28, c});
    }
  }

  function tick() {
    if (gameState !== 'play') return;
    const s = Math.floor((Date.now() - startedAt) / 1000);
    timeEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function updateEmpty() {
    emptyEl.textContent = grid.filter(v => v === 0).length;
  }

  // A cell clashes if the same digit sits in its row, column or box.
  function conflicts() {
    const bad = new Set();
    for (let i = 0; i < 81; i++) {
      const v = grid[i];
      if (!v) continue;
      const r = (i / 9) | 0, c = i % 9;
      for (let k = 0; k < 9; k++) {
        const a = r * 9 + k, b = k * 9 + c;
        if (a !== i && grid[a] === v) { bad.add(i); bad.add(a); }
        if (b !== i && grid[b] === v) { bad.add(i); bad.add(b); }
      }
      const br = r - r % 3, bc = c - c % 3;
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) {
          const j = (br + a) * 9 + bc + b;
          if (j !== i && grid[j] === v) { bad.add(i); bad.add(j); }
        }
      }
    }
    return bad;
  }

  function place(v) {
    if (gameState !== 'play' || sel < 0 || given[sel]) return;
    pushHistory();
    grid[sel] = v;
    if (v) {
      notes[sel].clear();
      forPeers(sel, p => notes[p].delete(v));
      if (v !== solution[sel]) {
        triggerMistake(sel);
      } else if (rowColBoxComplete(sel)) {
        const p = cellCenter(sel);
        burstAt(p.x, p.y, '#22c55e');
      }
    }
    updateEmpty();
    draw();
    if (grid.every((x, i) => x === solution[i])) win();
  }

  function hint() {
    if (gameState !== 'play') return;
    if (hintsLeft <= 0) { statusEl.textContent = 'No hints left.'; return; }
    // Prefer the selected cell; otherwise pick any empty or wrong one.
    let target = (sel >= 0 && !given[sel] && grid[sel] !== solution[sel]) ? sel : -1;
    if (target === -1) {
      const options = [];
      for (let i = 0; i < 81; i++) if (!given[i] && grid[i] !== solution[i]) options.push(i);
      if (!options.length) return;
      target = options[Math.floor(Math.random() * options.length)];
    }
    pushHistory();
    grid[target] = solution[target];
    notes[target].clear();
    forPeers(target, p => notes[p].delete(solution[target]));
    given[target] = true;
    sel = target;
    hintsLeft--;
    updateHintBtn();
    updateEmpty();
    statusEl.textContent = 'Filled one cell for you. ' + hintsLeft + ' hint' + (hintsLeft === 1 ? '' : 's') + ' left.';
    draw();
    if (grid.every((x, i) => x === solution[i])) win();
  }

  function win() {
    gameState = 'won';
    clearInterval(timer);
    overTitle.textContent = 'Solved';
    overMsg.textContent = 'Finished in ' + timeEl.textContent + ' on ' + diffEl.textContent.toLowerCase() + '.';
    overlay.classList.add('show');
    statusEl.textContent = 'Solved.';
  }

  /* ---------- drawing ---------- */

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shakeTimer > 0) {
      const mag = (shakeTimer / 14) * 5;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect(OX, OY, BOARD, BOARD);

    const bad = conflicts();
    const selV = sel >= 0 ? grid[sel] : 0;

    for (let i = 0; i < 81; i++) {
      const r = (i / 9) | 0, c = i % 9;
      const x = OX + c * CELL, y = OY + r * CELL;

      if (sel >= 0) {
        const sr = (sel / 9) | 0, sc = sel % 9;
        const sameBox = ((r / 3) | 0) === ((sr / 3) | 0) && ((c / 3) | 0) === ((sc / 3) | 0);
        let tint = null;
        if (i === sel) tint = 'rgba(139,92,246,0.34)';
        else if (selV && grid[i] === selV) tint = 'rgba(6,212,247,0.16)';
        else if (r === sr || c === sc || sameBox) tint = 'rgba(139,92,246,0.10)';
        if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, CELL, CELL); }
      }

      const v = grid[i];
      if (!v) {
        if (notes[i] && notes[i].size) {
          ctx.font = Math.round(CELL * 0.2) + 'px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(190,200,255,0.6)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let n = 1; n <= 9; n++) {
            if (!notes[i].has(n)) continue;
            const nr = ((n - 1) / 3) | 0, nc = (n - 1) % 3;
            ctx.fillText(n, x + CELL * (nc + 0.5) / 3, y + CELL * (nr + 0.5) / 3);
          }
        }
        continue;
      }
      ctx.font = (given[i] ? 'bold ' : '') + Math.round(CELL * 0.56) + 'px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bad.has(i) ? '#ef4444' : (given[i] ? '#e8ecff' : '#06d4f7');
      ctx.fillText(v, x + CELL / 2, y + CELL / 2 + 1);
    }

    // flash a wrong entry red
    if (flashCell >= 0 && flashTimer > 0) {
      const fr = (flashCell / 9) | 0, fc = flashCell % 9;
      ctx.fillStyle = 'rgba(239,68,68,' + (0.35 * (flashTimer / 20)) + ')';
      ctx.fillRect(OX + fc * CELL, OY + fr * CELL, CELL, CELL);
    }

    // grid lines — heavier every third line to mark the boxes
    for (let k = 0; k <= 9; k++) {
      const heavy = k % 3 === 0;
      ctx.strokeStyle = heavy ? 'rgba(210,218,255,0.8)' : 'rgba(190,200,255,0.18)';
      ctx.lineWidth = heavy ? 3 : 1;
      ctx.beginPath();
      ctx.moveTo(OX + k * CELL, OY);
      ctx.lineTo(OX + k * CELL, OY + BOARD);
      ctx.moveTo(OX, OY + k * CELL);
      ctx.lineTo(OX + BOARD, OY + k * CELL);
      ctx.stroke();
    }

    // particle bursts for completed rows/cols/boxes
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /* ---------- input ---------- */

  canvas.addEventListener('mousedown', e => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width) - OX;
    const y = (e.clientY - r.top) * (H / r.height) - OY;
    if (x < 0 || y < 0 || x >= BOARD || y >= BOARD) return;
    sel = ((y / CELL) | 0) * 9 + ((x / CELL) | 0);
    draw();
  });

  document.addEventListener('keydown', e => {
    if (gameState !== 'play') return;
    if (e.key >= '1' && e.key <= '9') {
      if (notesMode) toggleNote(+e.key); else place(+e.key);
      e.preventDefault(); return;
    }
    if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { place(0); e.preventDefault(); return; }
    if (e.key === 'n' || e.key === 'N') { toggleNotesMode(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { undo(); e.preventDefault(); return; }
    if (sel < 0) return;
    let r = (sel / 9) | 0, c = sel % 9;
    if (e.key === 'ArrowUp') r = (r + 8) % 9;
    else if (e.key === 'ArrowDown') r = (r + 1) % 9;
    else if (e.key === 'ArrowLeft') c = (c + 8) % 9;
    else if (e.key === 'ArrowRight') c = (c + 1) % 9;
    else return;
    e.preventDefault();
    sel = r * 9 + c;
    draw();
  });

  document.getElementById('startBtn').addEventListener('click', newPuzzle);
  document.getElementById('restartOverlay').addEventListener('click', newPuzzle);
  document.getElementById('hintBtn').addEventListener('click', hint);
  const notesBtn = document.getElementById('notesBtn');
  if (notesBtn) notesBtn.addEventListener('click', toggleNotesMode);
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  levelSel.addEventListener('change', newPuzzle);

  function loop() {
    if (shakeTimer > 0) shakeTimer--;
    if (flashTimer > 0) flashTimer--; else flashCell = -1;
    draw();
    requestAnimationFrame(loop);
  }

  newPuzzle();
  updateNotesBtn();
  gameState = 'play';
  overlay.classList.add('show');
  loop();
})();
