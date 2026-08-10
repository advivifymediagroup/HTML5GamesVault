(() => {
  const board = document.getElementById('board');
  const movesEl = document.getElementById('moves');
  const bestEl = document.getElementById('best');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const sizeSel = document.getElementById('size');

  let N, tiles, emptyIdx, moves, finished, startTime, timer;

  function bestKey() { return `f15-best-${N}`; }
  function loadBest() {
    const b = +localStorage.getItem(bestKey());
    bestEl.textContent = b > 0 ? b : '—';
  }

  function newGame() {
    N = +sizeSel.value;
    tiles = Array.from({length: N * N}, (_, i) => i + 1);
    tiles[N * N - 1] = 0;
    emptyIdx = N * N - 1;
    moves = 0; finished = false;
    movesEl.textContent = 0; timeEl.textContent = '0s';
    overlay.classList.remove('show');
    clearInterval(timer); startTime = null;
    loadBest();
    shuffle();
    render();
    statusEl.innerHTML = 'Slide tiles to order 1 → ' + (N * N - 1) + '.';
  }

  function shuffle() {
    // Make ~N^3 random moves from solved — guaranteed solvable
    const count = N * N * N * 2;
    let last = -1;
    for (let i = 0; i < count; i++) {
      const neighbors = neighborsOf(emptyIdx).filter(n => n !== last);
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      last = emptyIdx;
      slide(pick, false);
    }
  }

  function neighborsOf(idx) {
    const r = Math.floor(idx / N), c = idx % N;
    const out = [];
    if (r > 0) out.push(idx - N);
    if (r < N - 1) out.push(idx + N);
    if (c > 0) out.push(idx - 1);
    if (c < N - 1) out.push(idx + 1);
    return out;
  }

  function slide(idx, counted = true) {
    if (!neighborsOf(emptyIdx).includes(idx)) return false;
    tiles[emptyIdx] = tiles[idx];
    tiles[idx] = 0;
    emptyIdx = idx;
    if (counted) {
      moves++;
      movesEl.textContent = moves;
      if (!startTime) {
        startTime = Date.now();
        timer = setInterval(() => {
          const s = Math.floor((Date.now() - startTime) / 1000);
          timeEl.textContent = s + 's';
        }, 250);
      }
    }
    return true;
  }

  function isSolved() {
    for (let i = 0; i < N * N - 1; i++) if (tiles[i] !== i + 1) return false;
    return true;
  }

  function onClick(idx) {
    if (finished) return;
    if (slide(idx, true)) {
      render();
      if (isSolved()) win();
    }
  }

  function win() {
    finished = true;
    clearInterval(timer);
    const s = Math.floor((Date.now() - startTime) / 1000);
    const prev = +localStorage.getItem(bestKey()) || Infinity;
    let isNew = false;
    if (moves < prev) {
      localStorage.setItem(bestKey(), moves);
      isNew = true;
      loadBest();
    }
    overTitle.textContent = isNew ? '🏆 New Best!' : '🎉 Solved!';
    overMsg.textContent = `${moves} moves · ${s}s.`;
    overlay.classList.add('show');
    statusEl.innerHTML = `Sorted in ${moves} moves.`;
  }

  function render() {
    board.style.gridTemplateColumns = `repeat(${N}, auto)`;
    board.className = 'f15-board size-' + N;
    board.innerHTML = '';
    tiles.forEach((v, i) => {
      const t = document.createElement('div');
      const correct = v === i + 1 || (v === 0 && i === N * N - 1);
      t.className = 'f15-tile' + (v === 0 ? ' empty' : '') + (correct ? ' correct' : '');
      t.textContent = v === 0 ? '' : v;
      t.addEventListener('click', () => onClick(i));
      board.appendChild(t);
    });
  }

  document.addEventListener('keydown', e => {
    if (finished) return;
    const er = Math.floor(emptyIdx / N), ec = emptyIdx % N;
    // arrows slide the tile INTO the empty space (from opposite direction)
    let target = -1;
    if (e.key === 'ArrowUp' && er < N - 1) target = emptyIdx + N;
    else if (e.key === 'ArrowDown' && er > 0) target = emptyIdx - N;
    else if (e.key === 'ArrowLeft' && ec < N - 1) target = emptyIdx + 1;
    else if (e.key === 'ArrowRight' && ec > 0) target = emptyIdx - 1;
    if (target >= 0) { e.preventDefault(); onClick(target); }
  });

  document.getElementById('newBtn').addEventListener('click', newGame);
  document.getElementById('restartOverlay').addEventListener('click', newGame);
  sizeSel.addEventListener('change', newGame);

  newGame();
})();
