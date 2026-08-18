(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const chainEl = document.getElementById('chain');
  const bestEl = document.getElementById('bestchain');
  const leftEl = document.getElementById('left');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const sizeSel = document.getElementById('size');

  // Three layers per tile. A pair matches if they agree on any one layer.
  const BG = ['#7c3aed', '#0e7490', '#b45309', '#be123c', '#15803d', '#4338ca'];
  const PATTERN = ['dots', 'stripes', 'grid', 'waves', 'chevron', 'rings'];
  const SHAPE = ['circle', 'triangle', 'square', 'diamond', 'star', 'hexagon'];
  const SHAPE_INK = 'rgba(255,255,255,0.92)';

  let N, tiles, sel, chain, best, gameState, fx;

  best = +localStorage.getItem('tiles-best') || 0;
  bestEl.textContent = best;

  function cellPx() { return Math.floor((Math.min(W, H) - 30) / N); }
  function originX() { return Math.floor((W - cellPx() * N) / 2); }
  function originY() { return Math.floor((H - cellPx() * N) / 2); }

  /* ---------- board ---------- */

  // Every layer value is dealt an even number of times, so in principle each
  // one can be paired off and the board taken all the way down.
  function deal(n) {
    const total = n * n;
    const cols = [BG, PATTERN, SHAPE];
    const layers = cols.map(pool => {
      const vals = [];
      const kinds = Math.min(pool.length, Math.max(3, Math.round(total / 6)));
      while (vals.length < total) {
        const v = vals.length % kinds;
        vals.push(v, v);
      }
      vals.length = total;
      // an odd tail would strand one value, so mirror the last entry
      if (vals.filter(x => x === vals[total - 1]).length % 2 === 1) {
        vals[total - 1] = vals[total - 2];
      }
      for (let i = vals.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vals[i], vals[j]] = [vals[j], vals[i]];
      }
      return vals;
    });

    const out = [];
    for (let i = 0; i < total; i++) {
      out.push({
        layers: [
          {slot: 0, v: layers[0][i]},
          {slot: 1, v: layers[1][i]},
          {slot: 2, v: layers[2][i]}
        ],
        gone: false,
        pop: 0
      });
    }
    return out;
  }

  function shared(a, b) {
    for (const la of a.layers) {
      for (const lb of b.layers) {
        if (la.slot === lb.slot && la.v === lb.v) return la;
      }
    }
    return null;
  }

  function anyMoveLeft() {
    const live = tiles.filter(t => !t.gone);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        if (shared(live[i], live[j])) return true;
      }
    }
    return false;
  }

  function newBoard() {
    N = +sizeSel.value || 6;
    tiles = deal(N);
    sel = -1;
    chain = 0;
    fx = [];
    gameState = 'play';
    chainEl.textContent = 0;
    updateLeft();
    overlay.classList.remove('show');
    statusEl.textContent = 'Click a tile, then click another that shares a layer.';
    draw();
  }

  function updateLeft() {
    leftEl.textContent = tiles.filter(t => !t.gone).length;
  }

  function finish(cleared) {
    gameState = 'over';
    if (chain > best) { best = chain; localStorage.setItem('tiles-best', best); bestEl.textContent = best; }
    overTitle.textContent = cleared ? 'Board cleared' : 'No moves left';
    const remain = tiles.filter(t => !t.gone).length;
    overMsg.textContent = cleared
      ? 'Every tile gone. Best chain this board: ' + chain + '.'
      : remain + ' tiles stranded with nothing to pair them with.';
    overlay.classList.add('show');
    statusEl.textContent = cleared ? 'Cleared.' : 'Stuck.';
  }

  function pick(i) {
    if (gameState !== 'play' || i < 0 || tiles[i].gone) return;
    if (sel === -1) { sel = i; draw(); return; }
    if (sel === i) { sel = -1; draw(); return; }

    const a = tiles[sel], b = tiles[i];
    const hit = shared(a, b);
    if (!hit) {
      chain = 0;
      chainEl.textContent = 0;
      statusEl.textContent = 'No layer in common. Chain reset.';
      sel = i;
      draw();
      return;
    }

    // strip the matched layer off both tiles
    for (const t of [a, b]) {
      t.layers = t.layers.filter(l => !(l.slot === hit.slot && l.v === hit.v));
      if (!t.layers.length) { t.gone = true; t.pop = 12; }
    }
    chain++;
    chainEl.textContent = chain;
    if (chain > best) { best = chain; localStorage.setItem('tiles-best', best); bestEl.textContent = best; }
    fx.push({a: sel, b: i, life: 10});
    sel = -1;
    updateLeft();
    statusEl.textContent = 'Matched. Chain ' + chain + '.';
    draw();

    if (tiles.every(t => t.gone)) { setTimeout(() => finish(true), 260); return; }
    if (!anyMoveLeft()) { setTimeout(() => finish(false), 260); }
  }

  /* ---------- drawing ---------- */

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0b22');
    g.addColorStop(1, '#141336');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const cp = cellPx(), ox = originX(), oy = originY();
    let animating = false;

    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      const r = (i / N) | 0, c = i % N;
      const x = ox + c * cp, y = oy + r * cp;
      if (t.gone) {
        if (t.pop > 0) {
          const k = t.pop / 12;
          ctx.globalAlpha = k;
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 3;
          const grow = (1 - k) * cp * 0.35;
          ctx.strokeRect(x + 3 - grow / 2, y + 3 - grow / 2, cp - 6 + grow, cp - 6 + grow);
          ctx.globalAlpha = 1;
          t.pop--;
          animating = true;
        }
        continue;
      }
      tile(x, y, cp, t, i === sel);
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life--;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      animating = true;
      const pa = centre(f.a, cp, ox, oy), pb = centre(f.b, cp, ox, oy);
      ctx.globalAlpha = f.life / 10;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (animating) requestAnimationFrame(draw);
  }

  function centre(i, cp, ox, oy) {
    return {x: ox + (i % N) * cp + cp / 2, y: oy + ((i / N) | 0) * cp + cp / 2};
  }

  function tile(x, y, cp, t, isSel) {
    const pad = 3;
    const s = cp - pad * 2;
    const bx = x + pad, by = y + pad;
    const bg = t.layers.find(l => l.slot === 0);
    const pat = t.layers.find(l => l.slot === 1);
    const shp = t.layers.find(l => l.slot === 2);

    ctx.save();
    roundRect(bx, by, s, s, 8);
    ctx.clip();

    // layer 1 - background colour
    if (bg) {
      const grad = ctx.createLinearGradient(bx, by, bx + s, by + s);
      grad.addColorStop(0, BG[bg.v]);
      grad.addColorStop(1, shade(BG[bg.v], -40));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
    }
    ctx.fillRect(bx, by, s, s);

    // layer 2 - pattern
    if (pat) drawPattern(bx, by, s, PATTERN[pat.v]);
    ctx.restore();

    // layer 3 - shape
    if (shp) drawShape(bx + s / 2, by + s / 2, s * 0.28, SHAPE[shp.v]);

    roundRect(bx, by, s, s, 8);
    ctx.lineWidth = isSel ? 3 : 1.5;
    ctx.strokeStyle = isSel ? '#fde047' : 'rgba(190,200,255,0.28)';
    ctx.stroke();
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

  function drawPattern(x, y, s, kind) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    const step = s / 5;
    ctx.beginPath();
    if (kind === 'dots') {
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          ctx.moveTo(x + step * (a + 1) + 2.5, y + step * (b + 1));
          ctx.arc(x + step * (a + 1), y + step * (b + 1), 2.5, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      return;
    }
    if (kind === 'stripes') {
      for (let a = -5; a < 10; a++) {
        ctx.moveTo(x + a * step, y);
        ctx.lineTo(x + a * step + s, y + s);
      }
    } else if (kind === 'grid') {
      for (let a = 1; a < 5; a++) {
        ctx.moveTo(x + a * step, y); ctx.lineTo(x + a * step, y + s);
        ctx.moveTo(x, y + a * step); ctx.lineTo(x + s, y + a * step);
      }
    } else if (kind === 'waves') {
      for (let a = 1; a < 5; a++) {
        ctx.moveTo(x, y + a * step);
        for (let b = 0; b <= s; b += 6) {
          ctx.lineTo(x + b, y + a * step + Math.sin(b / 5) * 3);
        }
      }
    } else if (kind === 'chevron') {
      for (let a = 0; a < 6; a++) {
        ctx.moveTo(x, y + a * step - step / 2);
        ctx.lineTo(x + s / 2, y + a * step + step / 2);
        ctx.lineTo(x + s, y + a * step - step / 2);
      }
    } else if (kind === 'rings') {
      for (let a = 1; a <= 3; a++) {
        ctx.moveTo(x + s / 2 + a * step * 0.7, y + s / 2);
        ctx.arc(x + s / 2, y + s / 2, a * step * 0.7, 0, Math.PI * 2);
      }
    }
    ctx.stroke();
  }

  function drawShape(cx, cy, r, kind) {
    ctx.fillStyle = SHAPE_INK;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (kind === 'circle') {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    } else if (kind === 'square') {
      ctx.rect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
    } else if (kind === 'triangle') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.9, cy + r * 0.75);
      ctx.lineTo(cx - r * 0.9, cy + r * 0.75);
      ctx.closePath();
    } else if (kind === 'diamond') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
    } else if (kind === 'star') {
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 ? r * 0.45 : r;
        const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    } else if (kind === 'hexagon') {
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / 3;
        const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, v));
    return '#' + ((cl(((n >> 16) & 255) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt))
      .toString(16).padStart(6, '0');
  }

  /* ---------- input ---------- */

  function at(e) {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const cp = cellPx();
    const x = (p.clientX - rect.left) * (W / rect.width) - originX();
    const y = (p.clientY - rect.top) * (H / rect.height) - originY();
    if (x < 0 || y < 0) return -1;
    const c = (x / cp) | 0, r = (y / cp) | 0;
    if (c >= N || r >= N) return -1;
    return r * N + c;
  }

  canvas.addEventListener('mousedown', e => pick(at(e)));
  canvas.addEventListener('touchstart', e => { e.preventDefault(); pick(at(e)); }, {passive: false});

  document.getElementById('startBtn').addEventListener('click', newBoard);
  document.getElementById('restartOverlay').addEventListener('click', newBoard);
  sizeSel.addEventListener('change', newBoard);

  newBoard();
  overlay.classList.add('show');
})();
