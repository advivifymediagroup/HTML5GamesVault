(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const scoreEl = document.getElementById('score');
  const foundEl = document.getElementById('found');
  const rankEl = document.getElementById('rank');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const WORDS = (window.WORDS || []).filter(w => w.length >= 4);
  const byFirst = {};
  for (const w of WORDS) {
    const key = w[0];
    (byFirst[key] = byFirst[key] || []).push(w);
  }

  const RANKS = [
    {at: 0, name: 'Beginner'}, {at: 2, name: 'Good Start'}, {at: 5, name: 'Moving Up'},
    {at: 8, name: 'Good'}, {at: 15, name: 'Solid'}, {at: 25, name: 'Nice'},
    {at: 40, name: 'Great'}, {at: 55, name: 'Amazing'}, {at: 70, name: 'Genius'}
  ];

  let letters, center, valid, pangrams, found, score, maxScore, current, gameState, shakeT;

  /* ---------- generation ----------

     Pick a real pangram (a word using exactly 7 distinct letters), scatter
     those letters onto the hex, then collect every dictionary word that can
     be spelled from them containing the required middle letter. That
     guarantees at least one solution and a healthy word list. */

  function pickPangram() {
    const cands = WORDS.filter(w => w.length >= 7 && new Set(w).size === 7);
    return cands[Math.floor(Math.random() * cands.length)];
  }

  function wordsFrom(letterSet, must) {
    const set = new Set(letterSet);
    const out = [];
    for (const w of WORDS) {
      if (!w.includes(must)) continue;
      let ok = true;
      for (const ch of w) if (!set.has(ch)) { ok = false; break; }
      if (ok) out.push(w);
    }
    return out;
  }

  function newHive() {
    let base;
    for (let i = 0; i < 30; i++) {
      base = pickPangram();
      if (base) break;
    }
    const set = [...new Set(base.split(''))];
    center = set[Math.floor(Math.random() * set.length)];
    letters = [center, ...set.filter(c => c !== center)];
    // shuffle the six outer letters
    for (let i = letters.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * (i - 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    valid = wordsFrom(letters, center);
    pangrams = new Set(valid.filter(w => new Set(w).size === 7));
    maxScore = valid.reduce((s, w) => s + wordScore(w), 0);
    found = new Set();
    score = 0;
    current = '';
    gameState = 'play';
    shakeT = 0;
    scoreEl.textContent = 0;
    foundEl.textContent = '0/' + valid.length;
    rank();
    overlay.classList.remove('show');
    statusEl.textContent = 'Type or click letters, then press Enter.';
    draw();
  }

  function wordScore(w) {
    if (w.length === 4) return 1;
    return w.length + (new Set(w).size === 7 ? 7 : 0);
  }

  function rank() {
    let name = 'Beginner';
    for (const r of RANKS) if (score >= Math.round(r.at / 100 * maxScore)) name = r.name;
    rankEl.textContent = name;
  }

  function submit() {
    if (gameState !== 'play') return;
    const w = current.toLowerCase();
    current = '';
    if (w.length < 4) { reject('Too short'); return; }
    if (!w.includes(center)) { reject('Missing middle letter'); return; }
    const set = new Set(letters);
    for (const ch of w) if (!set.has(ch)) { reject('Bad letters'); return; }
    if (found.has(w)) { reject('Already found'); return; }
    if (!valid.includes(w)) { reject('Not in word list'); return; }

    found.add(w);
    const pts = wordScore(w);
    score += pts;
    scoreEl.textContent = score;
    foundEl.textContent = found.size + '/' + valid.length;
    rank();
    statusEl.textContent = pangrams.has(w)
      ? 'Pangram. +' + pts + ' points.'
      : '+' + pts + (pts === 1 ? ' point.' : ' points.');
    if (found.size === valid.length) finish();
    draw();
  }

  function reject(why) {
    shakeT = 10;
    statusEl.textContent = why + '.';
    current = '';
    draw();
  }

  function finish() {
    gameState = 'won';
    overTitle.textContent = 'Every word found';
    overMsg.textContent = score + ' points across ' + found.size + ' words.';
    overlay.classList.add('show');
  }

  /* ---------- layout ---------- */

  function hexCenters() {
    const cx = W / 2, cy = H / 2 - 30, r = 62;
    const out = [{x: cx, y: cy}];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      out.push({x: cx + Math.cos(a) * r * 1.9, y: cy + Math.sin(a) * r * 1.9});
    }
    return out;
  }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // typed word
    ctx.font = 'bold 26px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const dx = shakeT > 0 ? Math.sin(shakeT * 2) * 6 : 0;
    ctx.fillStyle = current ? '#e8ecff' : 'rgba(200,208,240,0.4)';
    let disp = '';
    for (const ch of current.toLowerCase()) disp += ch === center ? ch.toUpperCase() : ch;
    ctx.fillText(disp || 'Type a word', W / 2 + dx, 66);
    if (shakeT > 0) shakeT--;

    const centers = hexCenters();
    const r = 46;
    for (let i = 0; i < centers.length; i++) {
      const p = centers[i];
      const isMid = i === 0;
      hex(p.x, p.y, r, isMid ? '#8b5cf6' : 'rgba(255,255,255,0.06)', isMid);
      ctx.fillStyle = isMid ? '#ffffff' : '#cdd4f5';
      ctx.font = 'bold 24px "Space Grotesk", sans-serif';
      ctx.fillText(letters[i].toUpperCase(), p.x, p.y + 1);
    }

    if (shakeT > 0) requestAnimationFrame(draw);
  }

  function hex(cx, cy, r, fill, glow) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    if (glow) { ctx.shadowColor = '#8b5cf6'; ctx.shadowBlur = 18; }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(190,200,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* ---------- input ---------- */

  function hitLetter(mx, my) {
    const centers = hexCenters();
    for (let i = 0; i < centers.length; i++) {
      if (Math.hypot(mx - centers[i].x, my - centers[i].y) < 46) return i;
    }
    return -1;
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {x: (c.clientX - r.left) * (W / r.width), y: (c.clientY - r.top) * (H / r.height)};
  }

  canvas.addEventListener('mousedown', e => {
    const p = pos(e);
    const i = hitLetter(p.x, p.y);
    if (i >= 0) { current += letters[i]; draw(); }
  });
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const p = pos(e);
    const i = hitLetter(p.x, p.y);
    if (i >= 0) { current += letters[i]; draw(); }
  }, {passive: false});

  function shuffleOuter() {
    const outer = letters.slice(1);
    for (let i = outer.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [outer[i], outer[j]] = [outer[j], outer[i]];
    }
    letters = [letters[0], ...outer];
    draw();
  }

  document.addEventListener('keydown', e => {
    if (gameState !== 'play') return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); current = current.slice(0, -1); draw(); return; }
    if (e.key === ' ') { e.preventDefault(); shuffleOuter(); return; }
    if (/^[a-zA-Z]$/.test(e.key) && letters.includes(e.key.toLowerCase())) {
      current += e.key.toLowerCase();
      draw();
    }
  });

  document.getElementById('enterBtn').addEventListener('click', submit);
  document.getElementById('delBtn').addEventListener('click', () => { current = current.slice(0, -1); draw(); });
  document.getElementById('shuffleBtn').addEventListener('click', shuffleOuter);
  document.getElementById('startBtn').addEventListener('click', newHive);
  document.getElementById('restartOverlay').addEventListener('click', newHive);

  newHive();
})();
