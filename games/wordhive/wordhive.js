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

  let letters, center, valid, pangrams, found, score, maxScore, current, gameState, shakeT, shakeMag;
  const chipsEl = document.getElementById('chips');
  const bursts = [];

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
    // center letter: whichever of the 7 appears in the most candidate
    // words, so the hive stays as flexible (word-rich) as possible
    let bestLetter = set[0], bestCount = -1;
    for (const ch of set) {
      const n = wordsFrom(set, ch).length;
      if (n > bestCount) { bestCount = n; bestLetter = ch; }
    }
    center = bestLetter;
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
    shakeMag = 0;
    bursts.length = 0;
    if (chipsEl) chipsEl.innerHTML = '';
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
    const isPangram = pangrams.has(w);
    const origin = hexCenters()[0];
    if (isPangram) {
      shakeT = 16; shakeMag = 12;
      pop(origin.x, origin.y, '#fbbf24', 42, 6.5);
      statusEl.textContent = 'Pangram! +' + pts + ' points.';
    } else {
      shakeT = 8; shakeMag = 5;
      pop(origin.x, origin.y, '#8b5cf6', 14, 4);
      statusEl.textContent = '+' + pts + (pts === 1 ? ' point.' : ' points.');
    }
    addChip(w, isPangram);
    if (found.size === valid.length) finish();
    draw();
  }

  function addChip(w, isPangram) {
    if (!chipsEl) return;
    const span = document.createElement('span');
    span.className = 'word-chip' + (isPangram ? ' pangram' : '');
    span.textContent = w;
    chipsEl.appendChild(span);
  }

  function reject(why) {
    shakeT = 10;
    shakeMag = 6;
    statusEl.textContent = why + '.';
    current = '';
    draw();
  }

  function pop(x, y, color, count, spread) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = spread * (0.4 + Math.random() * 0.6);
      bursts.push({x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30, max: 30, c: color});
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    return '#' + ((cl(((n >> 16) & 255) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt))
      .toString(16).padStart(6, '0');
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

    // typed word, with the compulsory center letter picked out in gold
    ctx.font = 'bold 26px "Space Grotesk", sans-serif';
    ctx.textBaseline = 'middle';
    const dx = shakeT > 0 ? Math.sin(shakeT * 2) * shakeMag : 0;
    if (shakeT > 0) shakeT--;
    if (!current) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,208,240,0.4)';
      ctx.fillText('Type a word', W / 2 + dx, 66);
    } else {
      const chars = [...current.toLowerCase()];
      const widths = chars.map(ch => ctx.measureText(ch.toUpperCase()).width);
      const total = widths.reduce((a, b) => a + b, 0);
      ctx.textAlign = 'left';
      let x = W / 2 + dx - total / 2;
      for (let k = 0; k < chars.length; k++) {
        ctx.fillStyle = chars[k] === center ? '#fbbf24' : '#e8ecff';
        ctx.fillText(chars[k].toUpperCase(), x, 66);
        x += widths[k];
      }
      ctx.textAlign = 'center';
    }

    const centers = hexCenters();
    const r = 46;
    for (let i = 0; i < centers.length; i++) {
      const p = centers[i];
      const isMid = i === 0;
      const rad = isMid ? r * 1.18 : r;
      hex(p.x, p.y, rad, isMid ? '#fbbf24' : 'rgba(255,255,255,0.06)', isMid);
      ctx.fillStyle = isMid ? '#1a1400' : '#cdd4f5';
      ctx.font = `bold ${isMid ? 27 : 24}px "Space Grotesk", sans-serif`;
      ctx.fillText(letters[i].toUpperCase(), p.x, p.y + 1);
    }

    // particle bursts (word / pangram feedback)
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (shakeT > 0 || bursts.length) requestAnimationFrame(draw);
  }

  function hex(cx, cy, r, fill, glow) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    if (glow) {
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      g.addColorStop(0, '#fff8e1');
      g.addColorStop(0.4, fill);
      g.addColorStop(1, shade(fill, -50));
      ctx.fillStyle = g;
      ctx.shadowColor = fill;
      ctx.shadowBlur = 20;
    } else {
      ctx.fillStyle = fill;
    }
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
      const rad = i === 0 ? 46 * 1.18 : 46;
      if (Math.hypot(mx - centers[i].x, my - centers[i].y) < rad) return i;
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
