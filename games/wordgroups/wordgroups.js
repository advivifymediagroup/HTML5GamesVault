(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const groupsEl = document.getElementById('groups');
  const mistakesEl = document.getElementById('mistakes');
  const puzEl = document.getElementById('puz');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const PUZZLES = window.GROUP_PUZZLES || [];
  const COLORS = ['#eab308', '#22c55e', '#3b82f6', '#a855f7'];
  const COLOR_NAMES = ['Yellow', 'Green', 'Blue', 'Purple'];
  const MAX_MISTAKES = 4;

  let puzIndex, groups, tiles, order, selected, solved, mistakes, gameState, shakeT, popT;

  function newPuzzle() {
    puzIndex = Math.floor(Math.random() * PUZZLES.length);
    groups = PUZZLES[puzIndex].groups;
    tiles = [];
    groups.forEach((g, gi) => g.words.forEach(w => tiles.push({word: w, group: gi})));
    shuffleTiles();
    selected = new Set();
    solved = [];
    mistakes = 0;
    gameState = 'play';
    shakeT = 0; popT = 0;
    puzEl.textContent = puzIndex + 1;
    groupsEl.textContent = '0/4';
    mistakesEl.textContent = '0/' + MAX_MISTAKES;
    overlay.classList.remove('show');
    statusEl.textContent = 'Pick four words that share something, then submit.';
    draw();
  }

  function shuffleTiles() {
    order = tiles.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }

  /* ---------- layout ---------- */

  function activeOrder() {
    return order.filter(i => !tiles[i].done);
  }

  function layout() {
    const live = activeOrder();
    const cols = 4;
    const rowsNeeded = Math.ceil(live.length / cols);
    const pad = 16, gap = 10;
    const gridW = W - pad * 2;
    const cw = (gridW - gap * (cols - 1)) / cols;
    const ch = 62;
    const solvedRows = solved.length;
    const topY = 16 + solvedRows * (ch + gap);
    const map = {};
    live.forEach((tileIdx, i) => {
      const r = (i / cols) | 0, c = i % cols;
      map[tileIdx] = {x: pad + c * (cw + gap), y: topY + r * (ch + gap), w: cw, h: ch};
    });
    return {map, cw, ch, pad, gap, topY};
  }

  /* ---------- game flow ---------- */

  function toggle(tileIdx) {
    if (gameState !== 'play' || tiles[tileIdx].done) return;
    if (selected.has(tileIdx)) selected.delete(tileIdx);
    else if (selected.size < 4) selected.add(tileIdx);
    draw();
  }

  function submit() {
    if (gameState !== 'play' || selected.size !== 4) return;
    const sel = [...selected];
    const gset = new Set(sel.map(i => tiles[i].group));
    if (gset.size === 1) {
      const gi = [...gset][0];
      sel.forEach(i => { tiles[i].done = true; });
      solved.push(gi);
      selected = new Set();
      groupsEl.textContent = solved.length + '/4';
      statusEl.textContent = groups[gi].name + '.';
      popT = 14;
      draw();
      if (solved.length === 4) { setTimeout(() => finish(true), 500); return; }
    } else {
      mistakes++;
      mistakesEl.textContent = mistakes + '/' + MAX_MISTAKES;
      shakeT = 10;
      const counts = {};
      sel.forEach(i => { counts[tiles[i].group] = (counts[tiles[i].group] || 0) + 1; });
      const closest = Math.max(...Object.values(counts));
      statusEl.textContent = closest === 3 ? 'One away.' : 'Not a group.';
      draw();
      if (mistakes >= MAX_MISTAKES) setTimeout(() => finish(false), 500);
    }
  }

  function finish(won) {
    gameState = 'over';
    if (!won) {
      // reveal everything so the player sees what they missed
      tiles.forEach(t => { t.done = true; });
      groups.forEach((g, gi) => { if (!solved.includes(gi)) solved.push(gi); });
    }
    overTitle.textContent = won ? 'Solved' : 'Out of guesses';
    overMsg.textContent = won
      ? 'All four groups found with ' + mistakes + ' mistake' + (mistakes === 1 ? '' : 's') + '.'
      : 'The groups are revealed below.';
    overlay.classList.add('show');
    draw();
  }

  /* ---------- drawing ---------- */

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // solved group bars
    solved.forEach((gi, row) => {
      const y = 16 + row * 72;
      const x = 16, w = W - 32, h = 62;
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, COLORS[gi]);
      grad.addColorStop(1, shade(COLORS[gi], -30));
      roundRect(x, y, w, h, 10);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.font = 'bold 13px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(groups[gi].name.toUpperCase(), x + w / 2, y + 18);
      ctx.font = '12px "Space Grotesk", sans-serif';
      ctx.fillText(groups[gi].words.join(', '), x + w / 2, y + 40);
    });

    const {map, cw, ch} = layout();
    const dx = shakeT > 0 ? Math.sin(shakeT * 2) * 5 : 0;
    if (shakeT > 0) shakeT--;
    if (popT > 0) popT--;

    activeOrder().forEach(tileIdx => {
      const t = tiles[tileIdx];
      const box = map[tileIdx];
      if (!box) return;
      const isSel = selected.has(tileIdx);
      roundRect(box.x + dx, box.y, box.w, box.h, 10);
      ctx.fillStyle = isSel ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = isSel ? '#8b5cf6' : 'rgba(190,200,255,0.25)';
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.stroke();
      ctx.fillStyle = '#e8ecff';
      ctx.font = 'bold 13px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(t.word, box.x + box.w / 2 + dx, box.y + box.h / 2, box.w - 10);
    });

    if (shakeT > 0 || popT > 0) requestAnimationFrame(draw);
  }

  function fitText(text, cx, cy, maxW) {
    let size = 13;
    ctx.font = 'bold ' + size + 'px "Space Grotesk", sans-serif';
    while (ctx.measureText(text).width > maxW && size > 9) {
      size--;
      ctx.font = 'bold ' + size + 'px "Space Grotesk", sans-serif';
    }
    ctx.fillText(text, cx, cy);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    return '#' + ((cl(((n >> 16) & 255) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  /* ---------- input ---------- */

  canvas.addEventListener('mousedown', e => {
    if (gameState !== 'play') return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width);
    const y = (e.clientY - r.top) * (H / r.height);
    const {map} = layout();
    for (const [idxStr, box] of Object.entries(map)) {
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        toggle(+idxStr);
        break;
      }
    }
  });

  document.getElementById('submitBtn').addEventListener('click', submit);
  document.getElementById('clearBtn').addEventListener('click', () => { selected = new Set(); draw(); });
  document.getElementById('shuffleBtn').addEventListener('click', () => { shuffleTiles(); draw(); });
  document.getElementById('startBtn').addEventListener('click', newPuzzle);
  document.getElementById('restartOverlay').addEventListener('click', newPuzzle);

  newPuzzle();
})();
