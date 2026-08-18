(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const wordsEl = document.getElementById('words');
  const lettersEl = document.getElementById('letters');
  const parEl = document.getElementById('par');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const WORDS = new Set((window.WORDS || []).filter(w => w.length >= 3));
  const byFirst = {};
  for (const w of WORDS) (byFirst[w[0]] = byFirst[w[0]] || []).push(w);

  // sides[i] is a 3-letter string; letterSide[ch] gives its side index (0-3)
  let sides, letterSide, solutionPar, path, chain, usedLetters, gameState, shakeT;

  /* ---------- generation ----------

     Find a pair of words that between them use exactly twelve distinct
     letters and chain (word B starts with the last letter of word A), then
     split those letters across four sides of three so no two consecutive
     letters of either word land on the same side. That pair is then a
     guaranteed two-word solution for the puzzle. */

  function buildEdges(words) {
    const edges = [];
    for (const w of words) {
      for (let i = 0; i + 1 < w.length; i++) {
        if (w[i] !== w[i + 1]) edges.push([w[i], w[i + 1]]);
      }
    }
    return edges;
  }

  function partition(letters, edges) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const pool = letters.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const groups = [pool.slice(0, 3), pool.slice(3, 6), pool.slice(6, 9), pool.slice(9, 12)];
      const side = {};
      groups.forEach((g, i) => g.forEach(ch => { side[ch] = i; }));
      if (edges.every(([a, b]) => side[a] !== side[b])) return groups;
    }
    return null;
  }

  function makePuzzle() {
    const longish = [...WORDS].filter(w => w.length >= 5 && w.length <= 9);
    for (let attempt = 0; attempt < 4000; attempt++) {
      const a = longish[Math.floor(Math.random() * longish.length)];
      const list = byFirst[a[a.length - 1]] || [];
      if (!list.length) continue;
      const b = list[Math.floor(Math.random() * list.length)];
      if (b === a) continue;
      const set = [...new Set((a + b).split(''))];
      if (set.length !== 12) continue;
      const edges = buildEdges([a, b]);
      if (edges.some(([x, y]) => x === y)) continue;
      const groups = partition(set, edges);
      if (groups) return {sides: groups.map(g => g.join('')), par: 2};
    }
    return null;
  }

  function newPuzzle() {
    let p = makePuzzle();
    if (!p) p = makePuzzle(); // one retry; generation is fast and rarely fails twice
    sides = p.sides;
    solutionPar = p.par;
    letterSide = {};
    sides.forEach((s, i) => { for (const ch of s) letterSide[ch] = i; });
    path = [];
    chain = [];
    usedLetters = new Set();
    gameState = 'play';
    parEl.textContent = solutionPar;
    wordsEl.textContent = 0;
    updateLetters();
    overlay.classList.remove('show');
    statusEl.textContent = 'Click letters to spell a word, then press Enter.';
    shakeT = 0;
    draw();
  }

  function updateLetters() {
    lettersEl.textContent = usedLetters.size + '/12';
  }

  function allChars() {
    return sides.join('').split('');
  }

  function currentWord() {
    return path.map(p => allChars()[p]).join('');
  }

  function lastSide() {
    if (!path.length) return -1;
    return letterSide[allChars()[path[path.length - 1]]];
  }

  function canPick(i) {
    if (path.length && path[path.length - 1] === i) return false;
    const ch = allChars()[i];
    const s = letterSide[ch];
    if (path.length) {
      const prevCh = allChars()[path[path.length - 1]];
      if (letterSide[prevCh] === s) return false;
    }
    return true;
  }

  function click(i) {
    if (gameState !== 'play' || i < 0) return;
    if (!path.length) {
      // must continue from the last letter of the previous word, if any
      const required = chain.length ? chain[chain.length - 1].slice(-1) : null;
      if (required && allChars()[i] !== required) {
        reject('Start with ' + required.toUpperCase());
        return;
      }
      path.push(i);
      draw();
      return;
    }
    if (!canPick(i)) { return; }
    path.push(i);
    draw();
  }

  function submitWord() {
    if (gameState !== 'play') return;
    const w = currentWord();
    if (w.length < 3) { reject('Too short'); path = []; draw(); return; }
    if (!WORDS.has(w)) { reject('Not a word'); path = []; draw(); return; }

    chain.push(w);
    for (const ch of w) usedLetters.add(ch);
    wordsEl.textContent = chain.length;
    updateLetters();
    path = [];
    statusEl.textContent = '"' + w + '" accepted.';
    draw();

    if (usedLetters.size === 12) finish();
  }

  function reject(why) {
    shakeT = 10;
    statusEl.textContent = why + '.';
    draw();
  }

  function finish() {
    gameState = 'won';
    overTitle.textContent = chain.length <= solutionPar ? 'Solved at par' : 'Solved';
    overMsg.textContent = 'All 12 letters used in ' + chain.length + ' word' + (chain.length === 1 ? '' : 's') +
      ': ' + chain.join(', ') + '.';
    overlay.classList.add('show');
    statusEl.textContent = 'Box solved.';
  }

  /* ---------- layout ---------- */

  function layout() {
    const cx = W / 2, cy = H / 2, s = 190;
    // 3 letters per side, evenly spaced, box corners implicit
    const positions = [];
    const sidePts = [
      {from: [cx - s / 2, cy - s / 2], to: [cx + s / 2, cy - s / 2]}, // top
      {from: [cx + s / 2, cy - s / 2], to: [cx + s / 2, cy + s / 2]}, // right
      {from: [cx + s / 2, cy + s / 2], to: [cx - s / 2, cy + s / 2]}, // bottom
      {from: [cx - s / 2, cy + s / 2], to: [cx - s / 2, cy - s / 2]}  // left
    ];
    for (let si = 0; si < 4; si++) {
      const {from, to} = sidePts[si];
      for (let k = 0; k < 3; k++) {
        const t = (k + 1) / 4;
        positions.push({x: from[0] + (to[0] - from[0]) * t, y: from[1] + (to[1] - from[1]) * t});
      }
    }
    return positions;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const dx = shakeT > 0 ? Math.sin(shakeT * 2) * 5 : 0;
    if (shakeT > 0) shakeT--;

    // current word
    ctx.font = 'bold 22px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = path.length ? '#e8ecff' : 'rgba(200,208,240,0.4)';
    ctx.fillText(currentWord().toUpperCase() || 'Click letters to spell a word', W / 2 + dx, 48);

    // chain so far
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(200,208,240,0.65)';
    ctx.fillText(chain.join('  →  '), W / 2, 74);

    const cx = W / 2, cy = H / 2, s = 190;
    ctx.strokeStyle = 'rgba(139,92,246,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);

    // path lines
    if (path.length > 1) {
      const pts = layout();
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      path.forEach((i, k) => {
        const p = pts[i];
        k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.stroke();
    }

    const pts = layout();
    const chars = allChars();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const ch = chars[i];
      const isUsed = usedLetters.has(ch);
      const isCur = path.includes(i);
      const r = 22;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isCur ? '#8b5cf6' : (isUsed ? 'rgba(6,212,247,0.28)' : 'rgba(255,255,255,0.08)');
      if (isCur) { ctx.shadowColor = '#8b5cf6'; ctx.shadowBlur = 14; }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(190,200,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = isCur ? '#ffffff' : '#cdd4f5';
      ctx.font = 'bold 18px "Space Grotesk", sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch.toUpperCase(), p.x, p.y + 1);
    }

    if (shakeT > 0) requestAnimationFrame(draw);
  }

  /* ---------- input ---------- */

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }

  function hit(mx, my) {
    const pts = layout();
    for (let i = 0; i < pts.length; i++) {
      if (Math.hypot(mx - pts[i].x, my - pts[i].y) < 24) return i;
    }
    return -1;
  }

  canvas.addEventListener('mousedown', e => { const p = pos(e); click(hit(p.x, p.y)); });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); const p = pos(e); click(hit(p.x, p.y)); }, {passive: false});

  // Same legality rules click() enforces, so the keyboard path can't
  // sidestep the side-adjacency or chain-start rules.
  function validIndexForChar(ch) {
    const chars = allChars();
    if (!path.length) {
      const required = chain.length ? chain[chain.length - 1].slice(-1) : null;
      if (required && required !== ch) return -1;
      return chars.indexOf(ch);
    }
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === ch && canPick(i)) return i;
    }
    return -1;
  }

  document.addEventListener('keydown', e => {
    if (gameState !== 'play') return;
    if (e.key === 'Enter') { e.preventDefault(); submitWord(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); path.pop(); draw(); return; }
    if (/^[a-zA-Z]$/.test(e.key)) {
      const i = validIndexForChar(e.key.toLowerCase());
      if (i >= 0) { path.push(i); draw(); }
    }
  });

  document.getElementById('enterBtn').addEventListener('click', submitWord);
  document.getElementById('delBtn').addEventListener('click', () => { path.pop(); draw(); });
  document.getElementById('restartBtn').addEventListener('click', () => {
    path = []; chain = []; usedLetters = new Set();
    wordsEl.textContent = 0; updateLetters();
    statusEl.textContent = 'Box reset.';
    draw();
  });
  document.getElementById('startBtn').addEventListener('click', newPuzzle);
  document.getElementById('restartOverlay').addEventListener('click', newPuzzle);

  newPuzzle();
})();
