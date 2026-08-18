(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const filledEl = document.getElementById('filled');
  const timeEl = document.getElementById('time');
  const puzEl = document.getElementById('puz');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const GRIDS = window.CROSSWORDS || [];
  const CLUES = window.CLUES || {};

  const PAD = 40;
  const BOARD = Math.min(W, H) - PAD * 2 - 40; // leave room for the clue line
  const CELL = BOARD / 5;
  const OX = (W - BOARD) / 2, OY = PAD;

  let idx, solution, entries, fill, block, sel, dir, startedAt, timer, gameState, gridIndex, cellNumber;

  function key(r, c) { return r * 5 + c; }

  function loadGrid(gi) {
    gridIndex = gi;
    const g = GRIDS[gi];
    block = new Array(25).fill(false);
    solution = new Array(25).fill('');
    g.grid.forEach((row, r) => {
      for (let c = 0; c < 5; c++) {
        const ch = row[c];
        if (ch === '#') block[key(r, c)] = true;
        else solution[key(r, c)] = ch;
      }
    });
    entries = g.entries.map(e => ({
      dir: e.dir, r: e.r, c: e.c, word: e.word,
      clue: CLUES[e.word] || e.word.toUpperCase(),
      cells: entryCells(e)
    }));
    // distinct starting cells, in reading order — that's what the little
    // corner numbers count, not the entries themselves (across+down often
    // share a start cell and must not be numbered twice)
    const starts = [...new Set(entries.map(e => e.cells[0]))].sort((a, b) => a - b);
    cellNumber = {};
    starts.forEach((cellIdx, i) => { cellNumber[cellIdx] = i + 1; });
  }

  function entryCells(e) {
    const out = [];
    for (let k = 0; k < e.word.length; k++) {
      out.push(e.dir === 'A' ? key(e.r, e.c + k) : key(e.r + k, e.c));
    }
    return out;
  }

  function newPuzzle() {
    idx = Math.floor(Math.random() * GRIDS.length);
    loadGrid(idx);
    fill = new Array(25).fill('');
    sel = firstOpenCell();
    dir = 'A';
    if (!entryAt(sel, dir)) dir = 'D';
    gameState = 'play';
    puzEl.textContent = idx + 1;
    startedAt = Date.now();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    timeEl.textContent = '0:00';
    overlay.classList.remove('show');
    statusEl.textContent = 'Click a square and type. Click again to switch direction.';
    updateFilled();
    draw();
  }

  function firstOpenCell() {
    for (let i = 0; i < 25; i++) if (!block[i]) return i;
    return 0;
  }

  function tick() {
    if (gameState !== 'play') return;
    const s = Math.floor((Date.now() - startedAt) / 1000);
    timeEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function updateFilled() {
    const have = fill.filter((v, i) => !block[i] && v).length;
    const need = 25 - block.filter(Boolean).length;
    filledEl.textContent = have + '/' + need;
  }

  function entryAt(cellIdx, direction) {
    return entries.find(e => e.dir === direction && e.cells.includes(cellIdx));
  }

  function activeEntry() {
    return entryAt(sel, dir) || entryAt(sel, dir === 'A' ? 'D' : 'A');
  }

  function place(ch) {
    if (gameState !== 'play' || block[sel]) return;
    fill[sel] = ch;
    updateFilled();
    advance(1);
    draw();
    if (fill.every((v, i) => block[i] || v === solution[i])) finish();
  }

  function clear() {
    if (gameState !== 'play' || block[sel]) return;
    if (fill[sel]) { fill[sel] = ''; }
    else advance(-1);
    updateFilled();
    draw();
  }

  function advance(delta) {
    const e = activeEntry();
    if (!e) return;
    if (entryAt(sel, dir)) dir = entryAt(sel, dir).dir;
    const i = e.cells.indexOf(sel);
    const ni = i + delta;
    if (ni >= 0 && ni < e.cells.length) sel = e.cells[ni];
  }

  function nextEntry() {
    const list = entries.filter(e => e.dir === dir);
    const cur = entryAt(sel, dir);
    let i = cur ? list.indexOf(cur) : -1;
    i = (i + 1) % list.length;
    sel = list[i].cells[0];
  }

  function finish() {
    gameState = 'won';
    clearInterval(timer);
    overTitle.textContent = 'Solved';
    overMsg.textContent = 'Finished puzzle ' + (idx + 1) + ' in ' + timeEl.textContent + '.';
    overlay.classList.add('show');
    statusEl.textContent = 'Solved.';
  }

  function check() {
    if (gameState !== 'play') return;
    let wrong = 0;
    for (let i = 0; i < 25; i++) if (!block[i] && fill[i] && fill[i] !== solution[i]) wrong++;
    statusEl.textContent = wrong ? wrong + ' square' + (wrong === 1 ? '' : 's') + ' look wrong.' : 'Everything filled in so far is correct.';
    draw();
  }

  function reveal() {
    if (gameState !== 'play' || block[sel]) return;
    fill[sel] = solution[sel];
    updateFilled();
    draw();
    if (fill.every((v, i) => block[i] || v === solution[i])) finish();
  }

  /* ---------- drawing ---------- */

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const activeE = activeEntry();
    const activeCells = activeE ? new Set(activeE.cells) : new Set();
    const bad = new Set();
    for (let i = 0; i < 25; i++) if (!block[i] && fill[i] && fill[i] !== solution[i]) bad.add(i);

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const i = key(r, c);
        const x = OX + c * CELL, y = OY + r * CELL;
        if (block[i]) {
          ctx.fillStyle = '#05050f';
          ctx.fillRect(x, y, CELL, CELL);
          continue;
        }
        let bgc = 'rgba(255,255,255,0.045)';
        if (i === sel) bgc = 'rgba(139,92,246,0.4)';
        else if (activeCells.has(i)) bgc = 'rgba(139,92,246,0.14)';
        ctx.fillStyle = bgc;
        ctx.fillRect(x, y, CELL, CELL);

        if (cellNumber[i]) {
          ctx.fillStyle = 'rgba(200,208,240,0.6)';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(String(cellNumber[i]), x + 3, y + 2);
        }

        if (fill[i]) {
          ctx.fillStyle = bad.has(i) ? '#ef4444' : '#e8ecff';
          ctx.font = 'bold ' + Math.round(CELL * 0.5) + 'px "Space Grotesk", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(fill[i].toUpperCase(), x + CELL / 2, y + CELL / 2 + 3);
        }
      }
    }

    ctx.strokeStyle = 'rgba(190,200,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k <= 5; k++) {
      ctx.beginPath();
      ctx.moveTo(OX + k * CELL, OY); ctx.lineTo(OX + k * CELL, OY + BOARD);
      ctx.moveTo(OX, OY + k * CELL); ctx.lineTo(OX + BOARD, OY + k * CELL);
      ctx.stroke();
    }

    // active clue
    ctx.textAlign = 'center';
    ctx.font = '15px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#cdd4f5';
    const clueText = activeE ? (activeE.dir === 'A' ? 'Across: ' : 'Down: ') + activeE.clue : '';
    wrapText(clueText, W / 2, OY + BOARD + 26, W - 40, 18);
  }

  function wrapText(text, cx, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', lines = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
  }

  /* ---------- input ---------- */

  canvas.addEventListener('mousedown', e => {
    if (gameState !== 'play') return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width) - OX;
    const y = (e.clientY - r.top) * (H / r.height) - OY;
    if (x < 0 || y < 0 || x >= BOARD || y >= BOARD) return;
    const c = (x / CELL) | 0, row = (y / CELL) | 0;
    const i = key(row, c);
    if (block[i]) return;
    if (i === sel) dir = dir === 'A' ? 'D' : 'A';
    if (!entryAt(i, dir)) dir = dir === 'A' ? 'D' : 'A';
    sel = i;
    draw();
  });

  document.addEventListener('keydown', e => {
    if (gameState !== 'play') return;
    if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); place(e.key.toLowerCase()); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); clear(); return; }
    if (e.key === 'Tab') { e.preventDefault(); nextEntry(); draw(); return; }
    const r = (sel / 5) | 0, c = sel % 5;
    let nr = r, nc = c;
    if (e.key === 'ArrowUp') nr = Math.max(0, r - 1);
    else if (e.key === 'ArrowDown') nr = Math.min(4, r + 1);
    else if (e.key === 'ArrowLeft') nc = Math.max(0, c - 1);
    else if (e.key === 'ArrowRight') nc = Math.min(4, c + 1);
    else return;
    e.preventDefault();
    const ni = key(nr, nc);
    if (!block[ni]) { sel = ni; draw(); }
  });

  document.getElementById('startBtn').addEventListener('click', newPuzzle);
  document.getElementById('restartOverlay').addEventListener('click', newPuzzle);
  document.getElementById('checkBtn').addEventListener('click', check);
  document.getElementById('revealBtn').addEventListener('click', reveal);

  newPuzzle();
})();
