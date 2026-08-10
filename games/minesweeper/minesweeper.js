(() => {
  const board = document.getElementById('board');
  const mineCountEl = document.getElementById('mineCount');
  const flagCountEl = document.getElementById('flagCount');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const diffSel = document.getElementById('difficulty');

  const PRESETS = {
    easy:   {cols: 9, rows: 9, mines: 10},
    medium: {cols: 14, rows: 14, mines: 30},
    hard:   {cols: 18, rows: 14, mines: 50}
  };

  let grid, cols, rows, mines, flags, revealed, gameState, startTime, timer, firstClick;
  // gameState: 'play' | 'win' | 'lose'

  function newGame() {
    const cfg = PRESETS[diffSel.value];
    cols = cfg.cols; rows = cfg.rows; mines = cfg.mines;
    grid = Array.from({length: rows}, () => Array.from({length: cols}, () => ({
      mine: false, revealed: false, flag: false, n: 0
    })));
    flags = 0; revealed = 0;
    gameState = 'play'; firstClick = true;
    mineCountEl.textContent = mines;
    flagCountEl.textContent = 0;
    timeEl.textContent = '0s';
    clearInterval(timer); startTime = null;
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Reveal all safe cells.';
    render();
  }

  function placeMines(safeR, safeC) {
    const positions = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
        positions.push([r, c]);
      }
    // shuffle
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    for (let i = 0; i < mines; i++) {
      const [r, c] = positions[i];
      grid[r][c].mine = true;
    }
    // compute neighbor counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (grid[nr][nc].mine) n++;
          }
        grid[r][c].n = n;
      }
    }
  }

  function render() {
    board.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    board.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const el = document.createElement('div');
        el.className = 'ms-cell';
        el.dataset.r = r;
        el.dataset.c = c;
        if (cell.revealed) {
          el.classList.add('revealed');
          if (cell.mine) { el.classList.add('mine'); el.textContent = '💣'; }
          else if (cell.n > 0) { el.classList.add('n' + cell.n); el.textContent = cell.n; }
        } else if (cell.flag) {
          el.classList.add('flag');
          el.textContent = '🚩';
        }
        el.addEventListener('click', () => onLeft(r, c));
        el.addEventListener('contextmenu', e => { e.preventDefault(); onRight(r, c); });
        // long-press for touch
        let pressTimer;
        el.addEventListener('touchstart', e => {
          pressTimer = setTimeout(() => { onRight(r, c); pressTimer = null; }, 350);
        });
        el.addEventListener('touchend', e => {
          if (pressTimer) { clearTimeout(pressTimer); }
        });
        el.addEventListener('touchmove', () => { if (pressTimer) clearTimeout(pressTimer); });
        board.appendChild(el);
      }
    }
  }

  function onLeft(r, c) {
    if (gameState !== 'play') return;
    const cell = grid[r][c];
    if (cell.flag || cell.revealed) return;
    if (firstClick) {
      firstClick = false;
      placeMines(r, c);
      startTime = Date.now();
      timer = setInterval(() => {
        const s = Math.floor((Date.now() - startTime) / 1000);
        timeEl.textContent = s + 's';
      }, 250);
    }
    if (cell.mine) {
      cell.revealed = true;
      revealAllMines();
      gameOver(false);
      return;
    }
    flood(r, c);
    render();
    checkWin();
  }

  function onRight(r, c) {
    if (gameState !== 'play') return;
    const cell = grid[r][c];
    if (cell.revealed) return;
    cell.flag = !cell.flag;
    flags += cell.flag ? 1 : -1;
    flagCountEl.textContent = flags;
    render();
  }

  function flood(r, c) {
    const stack = [[r, c]];
    while (stack.length) {
      const [r0, c0] = stack.pop();
      const cell = grid[r0][c0];
      if (cell.revealed || cell.flag) continue;
      cell.revealed = true;
      revealed++;
      if (cell.n === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r0 + dr, nc = c0 + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            if (!grid[nr][nc].revealed) stack.push([nr, nc]);
          }
      }
    }
  }

  function revealAllMines() {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c].mine) grid[r][c].revealed = true;
    render();
  }

  function checkWin() {
    const total = rows * cols - mines;
    if (revealed >= total) gameOver(true);
  }

  function gameOver(won) {
    gameState = won ? 'win' : 'lose';
    clearInterval(timer);
    const s = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    if (won) {
      overTitle.textContent = 'You Win!';
      overMsg.textContent = `Cleared in ${s}s with ${flags} flags.`;
      statusEl.innerHTML = 'Board cleared!';
    } else {
      overTitle.textContent = 'Boom!';
      overMsg.textContent = `You hit a mine after ${s}s.`;
      statusEl.innerHTML = 'Hit a mine.';
    }
    overlay.classList.add('show');
  }

  // prevent context menu on entire board
  board.addEventListener('contextmenu', e => e.preventDefault());

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);
  diffSel.addEventListener('change', newGame);

  newGame();
})();
