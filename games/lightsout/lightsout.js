(() => {
  const board = document.getElementById('board');
  const movesEl = document.getElementById('moves');
  const bestEl = document.getElementById('best');
  const litEl = document.getElementById('lit');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const sizeSel = document.getElementById('size');

  let N, grid, moves, finished;

  function bestKey() { return `lights-best-${N}`; }

  function loadBest() {
    const b = +localStorage.getItem(bestKey());
    bestEl.textContent = b > 0 ? b : '—';
  }

  function newGame() {
    N = +sizeSel.value;
    grid = Array.from({length: N}, () => Array(N).fill(false));
    moves = 0; finished = false;
    movesEl.textContent = 0;
    overlay.classList.remove('show');
    loadBest();
    // scramble by random clicks (always solvable)
    const scrambleCount = N * N;
    for (let i = 0; i < scrambleCount; i++) {
      const r = Math.floor(Math.random() * N);
      const c = Math.floor(Math.random() * N);
      toggle(r, c);
    }
    render();
    statusEl.innerHTML = 'Click a tile — it and its 4 neighbors flip.';
  }

  function toggle(r, c) {
    const drs = [0, 0, 0, 1, -1];
    const dcs = [0, 1, -1, 0, 0];
    for (let i = 0; i < 5; i++) {
      const nr = r + drs[i], nc = c + dcs[i];
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
        grid[nr][nc] = !grid[nr][nc];
      }
    }
  }

  function countLit() {
    let n = 0;
    for (const row of grid) for (const c of row) if (c) n++;
    return n;
  }

  function onClick(r, c) {
    if (finished) return;
    toggle(r, c);
    moves++;
    movesEl.textContent = moves;
    render();
    if (countLit() === 0) win();
  }

  function win() {
    finished = true;
    const prev = +localStorage.getItem(bestKey()) || Infinity;
    let isNew = false;
    if (moves < prev) {
      localStorage.setItem(bestKey(), moves);
      isNew = true;
      loadBest();
    }
    overTitle.textContent = isNew ? '🏆 New Best!' : '🎉 All Lights Out!';
    overMsg.textContent = `Solved in ${moves} moves.`;
    overlay.classList.add('show');
    statusEl.innerHTML = `Cleared in ${moves} moves.`;
  }

  function render() {
    board.style.gridTemplateColumns = `repeat(${N}, auto)`;
    board.innerHTML = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.className = 'lo-cell' + (grid[r][c] ? ' on' : '');
        cell.addEventListener('click', () => onClick(r, c));
        board.appendChild(cell);
      }
    }
    litEl.textContent = countLit();
  }

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);
  sizeSel.addEventListener('change', newGame);

  newGame();
})();
