(() => {
  const COLS = 7, ROWS = 6;
  const HUMAN = 'R', CPU = 'Y';
  const colsEl = document.getElementById('cols');
  const boardEl = document.getElementById('board');
  const winsPEl = document.getElementById('winsP');
  const winsCEl = document.getElementById('winsC');
  const drawsEl = document.getElementById('draws');
  const statusEl = document.getElementById('status');
  const diffSel = document.getElementById('difficulty');

  let grid, turn, gameOver, scoreP = 0, scoreC = 0, draws = 0, busy = false;

  function buildUI() {
    colsEl.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const b = document.createElement('button');
      b.className = 'col-btn';
      b.textContent = '▼';
      b.dataset.c = c;
      b.addEventListener('click', () => onCol(c));
      colsEl.appendChild(b);
    }
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'c4-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        boardEl.appendChild(cell);
      }
  }

  function newRound() {
    grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));
    turn = HUMAN;
    gameOver = false;
    busy = false;
    [...boardEl.querySelectorAll('.c4-cell')].forEach(c => c.innerHTML = '');
    [...colsEl.children].forEach(b => b.disabled = false);
    statusEl.innerHTML = 'Your turn';
  }

  function findOpenRow(g, c) {
    for (let r = ROWS - 1; r >= 0; r--) if (!g[r][c]) return r;
    return -1;
  }

  function onCol(c) {
    if (gameOver || busy || turn !== HUMAN) return;
    const r = findOpenRow(grid, c);
    if (r < 0) return;
    drop(r, c, HUMAN);
  }

  function drop(r, c, who) {
    grid[r][c] = who;
    const cell = boardEl.children[r * COLS + c];
    const piece = document.createElement('div');
    piece.className = 'c4-piece ' + (who === HUMAN ? 'red' : 'yellow');
    cell.appendChild(piece);

    const winCells = winLine(grid, who);
    if (winCells) return setTimeout(() => endRound(who, winCells), 450);
    if (isFull(grid)) return setTimeout(() => endRound(null, []), 450);

    if (grid[0][c]) colsEl.children[c].disabled = true;

    turn = who === HUMAN ? CPU : HUMAN;
    if (turn === CPU) {
      busy = true;
      statusEl.innerHTML = 'CPU thinking...';
      setTimeout(() => {
        const move = pickAI();
        const rr = findOpenRow(grid, move);
        if (rr < 0) { busy = false; return; }
        drop(rr, move, CPU);
        busy = false;
      }, 450);
    } else {
      statusEl.innerHTML = 'Your turn';
    }
  }

  function endRound(winner, cells) {
    gameOver = true;
    [...colsEl.children].forEach(b => b.disabled = true);
    if (winner === HUMAN) { scoreP++; winsPEl.textContent = scoreP; statusEl.innerHTML = 'You won!'; }
    else if (winner === CPU) { scoreC++; winsCEl.textContent = scoreC; statusEl.innerHTML = 'CPU wins.'; }
    else { draws++; drawsEl.textContent = draws; statusEl.innerHTML = 'Draw.'; }
    cells.forEach(([r, c]) => {
      const cell = boardEl.children[r * COLS + c];
      const piece = cell.querySelector('.c4-piece');
      if (piece) piece.classList.add('win');
    });
  }

  function isFull(g) {
    for (let c = 0; c < COLS; c++) if (!g[0][c]) return false;
    return true;
  }

  // Win detection — returns list of 4 cells if found, else null
  function winLine(g, who) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (g[r][c] !== who) continue;
        for (const [dr, dc] of dirs) {
          const cells = [[r,c]];
          for (let k = 1; k < 4; k++) {
            const nr = r + dr*k, nc = c + dc*k;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
            if (g[nr][nc] !== who) break;
            cells.push([nr, nc]);
          }
          if (cells.length === 4) return cells;
        }
      }
    return null;
  }

  // ---- AI ----
  function validCols(g) {
    const out = [];
    for (let c = 0; c < COLS; c++) if (!g[0][c]) out.push(c);
    return out;
  }
  function tryMove(g, c, who) {
    const r = findOpenRow(g, c);
    if (r < 0) return null;
    g[r][c] = who;
    return r;
  }
  function undo(g, r, c) { g[r][c] = null; }

  function pickAI() {
    const diff = diffSel.value;
    const valid = validCols(grid);
    // 1. take immediate win
    for (const c of valid) {
      const r = tryMove(grid, c, CPU);
      if (winLine(grid, CPU)) { undo(grid, r, c); return c; }
      undo(grid, r, c);
    }
    // 2. block opponent win
    for (const c of valid) {
      const r = tryMove(grid, c, HUMAN);
      if (winLine(grid, HUMAN)) { undo(grid, r, c); return c; }
      undo(grid, r, c);
    }
    if (diff === 'easy') {
      // prefer center, otherwise random
      const order = [3, 2, 4, 1, 5, 0, 6].filter(c => valid.includes(c));
      // 60% pick from preferred order, 40% random
      if (Math.random() < 0.6) return order[Math.floor(Math.random() * Math.min(3, order.length))];
      return valid[Math.floor(Math.random() * valid.length)];
    }
    if (diff === 'medium') {
      // 1-ply: pick column that maximizes a simple score
      let best = -Infinity, bestC = valid[Math.floor(Math.random() * valid.length)];
      for (const c of valid) {
        const r = tryMove(grid, c, CPU);
        const sc = score(grid, CPU) - score(grid, HUMAN);
        undo(grid, r, c);
        if (sc > best) { best = sc; bestC = c; }
      }
      return bestC;
    }
    // hard — minimax with alpha-beta
    let best = -Infinity, bestC = valid[Math.floor(Math.random() * valid.length)];
    const order = [3, 2, 4, 1, 5, 0, 6].filter(c => valid.includes(c));
    for (const c of order) {
      const r = tryMove(grid, c, CPU);
      const sc = minimax(grid, 4, -Infinity, Infinity, false);
      undo(grid, r, c);
      if (sc > best) { best = sc; bestC = c; }
    }
    return bestC;
  }

  function score(g, who) {
    let s = 0;
    // center preference
    for (let r = 0; r < ROWS; r++) if (g[r][3] === who) s += 3;
    // count 2/3 in-row lines
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        for (const [dr, dc] of dirs) {
          let myCount = 0, oppCount = 0;
          for (let k = 0; k < 4; k++) {
            const nr = r + dr*k, nc = c + dc*k;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) { myCount = -1; break; }
            if (g[nr][nc] === who) myCount++;
            else if (g[nr][nc]) oppCount++;
          }
          if (myCount === -1 || oppCount > 0) continue;
          if (myCount === 4) s += 1000;
          else if (myCount === 3) s += 10;
          else if (myCount === 2) s += 3;
        }
    return s;
  }

  function minimax(g, depth, alpha, beta, maximizing) {
    if (winLine(g, CPU)) return 100000;
    if (winLine(g, HUMAN)) return -100000;
    if (depth === 0 || validCols(g).length === 0)
      return score(g, CPU) - score(g, HUMAN);
    const order = [3, 2, 4, 1, 5, 0, 6].filter(c => !g[0][c]);
    if (maximizing) {
      let best = -Infinity;
      for (const c of order) {
        const r = tryMove(g, c, CPU);
        best = Math.max(best, minimax(g, depth - 1, alpha, beta, false));
        undo(g, r, c);
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const c of order) {
        const r = tryMove(g, c, HUMAN);
        best = Math.min(best, minimax(g, depth - 1, alpha, beta, true));
        undo(g, r, c);
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  document.getElementById('newBtn').addEventListener('click', newRound);
  diffSel.addEventListener('change', newRound);

  buildUI();
  newRound();
})();
