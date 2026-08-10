(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const discsEl = document.getElementById('discs');
  const movesEl = document.getElementById('moves');
  const parEl = document.getElementById('par');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const countSel = document.getElementById('count');

  const COLORS = [
    '#ef4444', '#f97316', '#fbbf24', '#a3e635',
    '#22c55e', '#06d4f7', '#8b5cf6'
  ];

  const BASE_Y = H - 46;
  // tall enough for a full stack of 7 discs plus the lifted-disc slot above it
  const PEG_H = 244;
  const DISC_H = 22;

  let pegs, n, moves, held, gameState, flash;

  function pegX(i) { return W * (i + 1) / 4; }

  function reset() {
    n = +countSel.value || 4;
    pegs = [[], [], []];
    // largest disc at the bottom of the first peg
    for (let i = n; i >= 1; i--) pegs[0].push(i);
    moves = 0;
    held = -1;
    flash = 0;
    gameState = 'play';
    discsEl.textContent = n;
    movesEl.textContent = 0;
    parEl.textContent = Math.pow(2, n) - 1;
    overlay.classList.remove('show');
    statusEl.textContent = 'Click a peg to lift its top disc, then click where to drop it.';
    draw();
  }

  function click(p) {
    if (gameState !== 'play' || p < 0) return;
    if (held === -1) {
      if (!pegs[p].length) { statusEl.textContent = 'That peg is empty.'; return; }
      held = p;
      statusEl.textContent = 'Now click the peg to drop it on.';
    } else if (held === p) {
      held = -1;
      statusEl.textContent = 'Put it back.';
    } else {
      const disc = pegs[held][pegs[held].length - 1];
      const target = pegs[p];
      if (target.length && target[target.length - 1] < disc) {
        statusEl.textContent = "You can't stack a bigger disc on a smaller one.";
        flash = 14;
        held = -1;
      } else {
        pegs[held].pop();
        target.push(disc);
        held = -1;
        moves++;
        movesEl.textContent = moves;
        statusEl.textContent = 'Moved.';
        if (pegs[2].length === n) { draw(); setTimeout(win, 200); return; }
      }
    }
    draw();
  }

  function win() {
    gameState = 'won';
    const par = Math.pow(2, n) - 1;
    overTitle.textContent = moves === par ? 'Perfect' : 'Solved';
    overMsg.textContent = moves === par
      ? 'Done in the fewest possible ' + par + ' moves.'
      : moves + ' moves. The fewest possible is ' + par + '.';
    overlay.classList.add('show');
    statusEl.textContent = 'Solved.';
  }

  /* ---------- drawing ---------- */

  function discWidth(size) {
    const max = W / 3.6;
    const min = 46;
    return min + (max - min) * ((size - 1) / Math.max(1, n - 1));
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // base
    ctx.fillStyle = 'rgba(139,92,246,0.28)';
    ctx.fillRect(24, BASE_Y, W - 48, 12);
    ctx.fillStyle = 'rgba(190,200,255,0.12)';
    ctx.fillRect(24, BASE_Y, W - 48, 3);

    for (let i = 0; i < 3; i++) {
      const x = pegX(i);
      // peg
      ctx.fillStyle = 'rgba(190,200,255,0.22)';
      ctx.fillRect(x - 5, BASE_Y - PEG_H, 10, PEG_H);
      ctx.fillStyle = 'rgba(190,200,255,0.34)';
      ctx.beginPath();
      ctx.arc(x, BASE_Y - PEG_H, 5, 0, Math.PI * 2);
      ctx.fill();

      if (i === held) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.strokeRect(x - W / 7.6, BASE_Y - PEG_H - 12, W / 3.8, PEG_H + 24);
        ctx.setLineDash([]);
      }

      const stack = pegs[i];
      for (let k = 0; k < stack.length; k++) {
        const size = stack[k];
        const lifted = i === held && k === stack.length - 1;
        const w = discWidth(size);
        const y = lifted ? BASE_Y - PEG_H - 6 : BASE_Y - (k + 1) * DISC_H;
        disc(x, y, w, COLORS[(size - 1) % COLORS.length], size);
      }

      // target marker under the last peg
      if (i === 2) {
        ctx.fillStyle = 'rgba(190,200,255,0.32)';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GOAL', x, BASE_Y + 30);
      }
    }

    if (flash > 0) {
      ctx.fillStyle = 'rgba(239,68,68,' + (flash / 60) + ')';
      ctx.fillRect(0, 0, W, H);
      flash--;
      requestAnimationFrame(draw);
    }
  }

  function disc(cx, y, w, colour, label) {
    const x = cx - w / 2;
    const r = DISC_H / 2 - 1;
    const grad = ctx.createLinearGradient(0, y, 0, y + DISC_H);
    grad.addColorStop(0, shade(colour, 34));
    grad.addColorStop(0.5, colour);
    grad.addColorStop(1, shade(colour, -42));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x + r, y + 1);
    ctx.lineTo(x + w - r, y + 1);
    ctx.arcTo(x + w, y + 1, x + w, y + DISC_H - 1, r);
    ctx.arcTo(x + w, y + DISC_H - 1, x + w - r, y + DISC_H - 1, r);
    ctx.lineTo(x + r, y + DISC_H - 1);
    ctx.arcTo(x, y + DISC_H - 1, x, y + 1, r);
    ctx.arcTo(x, y + 1, x + r, y + 1, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + r, y + 3, w - r * 2, 3);

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, y + DISC_H / 2);
  }

  function shade(hex, amt) {
    const v = parseInt(hex.slice(1), 16);
    const cl = x => Math.max(0, Math.min(255, x));
    return '#' + ((cl(((v >> 16) & 255) + amt) << 16) | (cl(((v >> 8) & 255) + amt) << 8) | cl((v & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  /* ---------- input ---------- */

  function at(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const x = (p.clientX - r.left) * (W / r.width);
    // nearest peg, as long as the click is roughly in its column
    let bestI = -1, bestD = 1e9;
    for (let i = 0; i < 3; i++) {
      const d = Math.abs(x - pegX(i));
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestD < W / 6 ? bestI : -1;
  }

  canvas.addEventListener('mousedown', e => click(at(e)));
  canvas.addEventListener('touchstart', e => { e.preventDefault(); click(at(e)); }, {passive: false});
  document.addEventListener('keydown', e => {
    if (e.key >= '1' && e.key <= '3') click(+e.key - 1);
  });

  document.getElementById('startBtn').addEventListener('click', reset);
  document.getElementById('restartOverlay').addEventListener('click', reset);
  countSel.addEventListener('change', reset);

  reset();
  gameState = 'play';
  overlay.classList.add('show');
})();
