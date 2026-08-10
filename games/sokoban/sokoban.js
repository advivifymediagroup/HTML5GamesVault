(() => {
  // Map legend:
  //  # = wall
  //  . = floor
  //  $ = box
  //  * = box on target
  //  @ = player
  //  + = player on target
  //  T = target (empty)
  //  ' ' (space) = outside / void

  const LEVELS = [
    // Level 1 — gentle intro
    [
      '#####',
      '#@..#',
      '#.$.#',
      '#..T#',
      '#####'
    ],
    // Level 2 — two boxes, one path
    [
      '#######',
      '#..T..#',
      '#.$.$.#',
      '#..@..#',
      '#..T..#',
      '#######'
    ],
    // Level 3 — corridor push
    [
      '########',
      '#@.....#',
      '#.$.#.T#',
      '#.....##',
      '########'
    ],
    // Level 4 — two targets, careful order
    [
      '########',
      '#T....T#',
      '#.$..$.#',
      '#......#',
      '#...@..#',
      '########'
    ],
    // Level 5 — small room with obstacles
    [
      '#######',
      '##.T..#',
      '#..#$.#',
      '#.$@..#',
      '#..T#.#',
      '##....#',
      '#######'
    ],
    // Level 6 — trickier
    [
      '########',
      '#......#',
      '#.####.#',
      '#.$..$.#',
      '#T@..T.#',
      '#......#',
      '########'
    ]
  ];

  const boardEl = document.getElementById('board');
  const levelNumEl = document.getElementById('levelNum');
  const movesEl = document.getElementById('moves');
  const boxesEl = document.getElementById('boxes');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  let levelIdx = 0;
  let walls, targets, boxes, player, rows, cols;
  let moves, history;
  let finished;

  function loadLevel(idx) {
    levelIdx = Math.max(0, Math.min(LEVELS.length - 1, idx));
    const map = LEVELS[levelIdx];
    rows = map.length;
    cols = Math.max(...map.map(r => r.length));
    walls = Array.from({length: rows}, () => Array(cols).fill(false));
    targets = Array.from({length: rows}, () => Array(cols).fill(false));
    boxes = [];
    player = {r: 0, c: 0};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = map[r][c] || ' ';
        switch (ch) {
          case '#': walls[r][c] = true; break;
          case '.': break;
          case 'T': targets[r][c] = true; break;
          case '$': boxes.push({r, c}); break;
          case '*': boxes.push({r, c}); targets[r][c] = true; break;
          case '@': player = {r, c}; break;
          case '+': player = {r, c}; targets[r][c] = true; break;
          case ' ': walls[r][c] = true; break;
        }
      }
    }
    moves = 0;
    history = [];
    finished = false;
    overlay.classList.remove('show');
    levelNumEl.textContent = `${levelIdx + 1}/${LEVELS.length}`;
    movesEl.textContent = 0;
    statusEl.innerHTML = `Level ${levelIdx + 1} — push boxes onto .`;
    render();
  }

  function boxAt(r, c) {
    return boxes.find(b => b.r === r && b.c === c);
  }

  function canMove(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols && !walls[r][c];
  }

  function move(dr, dc) {
    if (finished) return;
    const nr = player.r + dr, nc = player.c + dc;
    if (!canMove(nr, nc)) return;
    const box = boxAt(nr, nc);
    if (box) {
      const br = nr + dr, bc = nc + dc;
      if (!canMove(br, bc) || boxAt(br, bc)) return; // blocked
      history.push({player: {...player}, box: {idx: boxes.indexOf(box), r: box.r, c: box.c}});
      box.r = br; box.c = bc;
    } else {
      history.push({player: {...player}, box: null});
    }
    player.r = nr; player.c = nc;
    moves++;
    movesEl.textContent = moves;
    render();
    if (checkWin()) win();
  }

  function undo() {
    if (finished) return;
    const last = history.pop();
    if (!last) return;
    player = last.player;
    if (last.box) {
      boxes[last.box.idx].r = last.box.r;
      boxes[last.box.idx].c = last.box.c;
    }
    moves = Math.max(0, moves - 1);
    movesEl.textContent = moves;
    render();
  }

  function checkWin() {
    return boxes.every(b => targets[b.r][b.c]);
  }

  function win() {
    finished = true;
    statusEl.innerHTML = `Level ${levelIdx + 1} done in ${moves} moves!`;
    overTitle.textContent = levelIdx === LEVELS.length - 1 ? '🏆 All Levels Done!' : '✨ Level Complete!';
    overMsg.textContent = `${moves} moves.`;
    overlay.classList.add('show');
  }

  function render() {
    boardEl.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    boardEl.innerHTML = '';
    const onTarget = boxes.filter(b => targets[b.r][b.c]).length;
    boxesEl.textContent = `${onTarget}/${boxes.length}`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'sb-cell';
        if (walls[r][c]) cell.classList.add('wall');
        else cell.classList.add('floor');
        if (targets[r][c]) cell.classList.add('target');
        const box = boxAt(r, c);
        if (box) {
          cell.classList.add(targets[r][c] ? 'box-on' : 'box');
          const icon = document.createElement('span');
          icon.className = 'box-icon';
          icon.textContent = '📦';
          cell.appendChild(icon);
        }
        if (player.r === r && player.c === c) {
          const p = document.createElement('span');
          p.className = 'player';
          p.textContent = '🧑';
          cell.appendChild(p);
        }
        boardEl.appendChild(cell);
      }
    }
  }

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'w'].includes(k)) { e.preventDefault(); move(-1, 0); }
    else if (['arrowdown', 's'].includes(k)) { e.preventDefault(); move(1, 0); }
    else if (['arrowleft', 'a'].includes(k)) { e.preventDefault(); move(0, -1); }
    else if (['arrowright', 'd'].includes(k)) { e.preventDefault(); move(0, 1); }
    else if (k === 'u') { e.preventDefault(); undo(); }
    else if (k === 'r') { e.preventDefault(); loadLevel(levelIdx); }
  });

  document.querySelectorAll('.dpad-btn').forEach(b => {
    b.addEventListener('click', () => {
      const d = b.dataset.d;
      if (d === 'up') move(-1, 0);
      else if (d === 'down') move(1, 0);
      else if (d === 'left') move(0, -1);
      else if (d === 'right') move(0, 1);
    });
  });

  document.getElementById('resetBtn').addEventListener('click', () => loadLevel(levelIdx));
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('prevBtn').addEventListener('click', () => loadLevel(levelIdx - 1));
  document.getElementById('nextBtn').addEventListener('click', () => loadLevel(levelIdx + 1));
  document.getElementById('restartOverlay').addEventListener('click', () => {
    if (levelIdx < LEVELS.length - 1) loadLevel(levelIdx + 1);
    else loadLevel(0);
  });

  loadLevel(0);
})();
