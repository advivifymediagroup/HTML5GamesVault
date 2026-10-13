(() => {
  const A = Arcade2D({key: 'trailblaze', w: 420, h: 640, bg: '#071225', bestHud: 3});
  const {W, H, ctx, p, rnd, clamp} = A;
  const M = 12, HR = 9;
  let pts, total, len, ang, head, orbs, mines, hunters, score, orbCount, combo, comboT, mode, T = 0, deadT = 0, why = '', spawnT = 0;
  const wrap = a => { while (a > Math.PI) a -= 6.283; while (a < -Math.PI) a += 6.283; return a; };
  const hue = i => (190 + i * 140) % 360;

  function start() {
    head = {x: W / 2, y: H * .65}; ang = -Math.PI / 2; pts = [{x: head.x, y: head.y + 90, d: 0}, {x: head.x, y: head.y, d: 90}]; total = 90; len = 130;
    orbs = []; mines = []; hunters = []; score = 0; orbCount = 0; combo = 0; comboT = 0; mode = 'play'; T = 0; spawnT = 0;
    for (let i = 0; i < 3; i++) addOrb(); addMine();
    A.hud(1, 0); A.hud(2, 0); A.status('Steer toward your finger. Collect orbs, never touch your trail, the walls or the red things.');
  }
  function addOrb() { for (let k = 0; k < 20; k++) { const o = {x: rnd(M + 24, W - M - 24), y: rnd(M + 24, H - M - 24), t: rnd(0, 6)}; if (Math.hypot(o.x - head.x, o.y - head.y) > 90) { orbs.push(o); return; } } }
  function addMine() {
    for (let k = 0; k < 20; k++) {
      const m = {x: rnd(40, W - 40), y: rnd(40, H - 40), a: rnd(0, 6.283), v: rnd(70, 120) + score / 8, r: 13, born: 0, spin: rnd(-3, 3)};
      if (Math.hypot(m.x - head.x, m.y - head.y) > 190) { mines.push(m); return; }
    }
  }
  function die(msg) {
    if (mode !== 'play') return; mode = 'dead'; why = msg; deadT = 0; A.shake(14); A.beep(110, .4, 'sawtooth', .08);
    for (let i = 0; i < pts.length; i += 3) A.burst(pts[i].x, pts[i].y, `hsl(${hue(i / pts.length)},90%,65%)`, 2, 140, 3);
  }
  const hit = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < r * r;

  A.loop(dt => {
    T += dt;
    const bgG = ctx.createLinearGradient(0, 0, 0, H); bgG.addColorStop(0, '#0b1d3a'); bgG.addColorStop(1, '#06101f'); ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(80,140,255,.07)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = '#38bdf8'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.strokeRect(M - 3, M - 3, W - 2 * M + 6, H - 2 * M + 6); ctx.shadowBlur = 0;

    if (mode === 'play') {
      // steering: turn toward the finger (mouse hover or touch contact), otherwise keep going straight
      if (p.down || p.type === 'mouse') { const da = wrap(Math.atan2(p.y - head.y, p.x - head.x) - ang); if (Math.hypot(p.x - head.x, p.y - head.y) > 14) ang += clamp(da, -7.5 * dt, 7.5 * dt); }
      const v = 150 + Math.min(90, len / 5) + score / 14, nx = head.x + Math.cos(ang) * v * dt, ny = head.y + Math.sin(ang) * v * dt, d = Math.hypot(nx - head.x, ny - head.y);
      head.x = nx; head.y = ny; pts.push({x: nx, y: ny, d}); total += d;
      while (total > len && pts.length > 2) { total -= pts[1].d; pts.shift(); }
      // collisions
      if (head.x < M + HR * .4 || head.x > W - M - HR * .4 || head.y < M + HR * .4 || head.y > H - M - HR * .4) die('You hit the wall!');
      let run = 0; for (let i = pts.length - 1; i > 0; i--) { run += pts[i].d; if (run > 46 && hit(head, pts[i - 1], 8.5)) { die('You crossed your own trail!'); break; } }
      mines.forEach(m => { m.born += dt; m.x += Math.cos(m.a) * m.v * dt; m.y += Math.sin(m.a) * m.v * dt; if (m.x < M + m.r || m.x > W - M - m.r) { m.a = Math.PI - m.a; m.x = clamp(m.x, M + m.r, W - M - m.r); } if (m.y < M + m.r || m.y > H - M - m.r) { m.a = -m.a; m.y = clamp(m.y, M + m.r, H - M - m.r); } if (m.born > 1 && hit(head, m, m.r + HR - 2)) die('Boom! You hit a mine.'); if (m.born > 1) for (let i = 0; i < pts.length; i += 4) if (hit(pts[i], m, m.r + 5)) { m.a += 3.14; break; } });
      hunters.forEach(h => { const a = Math.atan2(head.y - h.y, head.x - h.x); h.x += Math.cos(a) * h.v * dt; h.y += Math.sin(a) * h.v * dt; h.t += dt; if (h.t > 1 && hit(head, h, 14 + HR - 4)) die('A hunter caught you!'); });
      orbs.forEach(o => { o.t += dt; });
      for (let i = orbs.length - 1; i >= 0; i--) if (hit(head, orbs[i], 20)) {
        combo = comboT > 0 ? combo + 1 : 1; comboT = 2; orbCount++; len += 26; score += 10 * Math.min(combo, 6);
        A.burst(orbs[i].x, orbs[i].y, '#fde047', 14, 150, 2.5); A.beep(500 + Math.min(combo, 8) * 80, .08, 'triangle'); if (combo > 2) A.flash('x' + Math.min(combo, 6), 350);
        orbs.splice(i, 1); addOrb(); A.hud(1, score); A.hud(2, orbCount);
        if (orbCount % 4 === 0 && mines.length < 8) addMine(); if (score > 110 && hunters.length < Math.min(3, Math.floor(score / 110))) hunters.push({x: Math.random() < .5 ? -10 : W + 10, y: rnd(60, H - 60), v: 62 + score / 30, t: 0});
      }
      comboT = Math.max(0, comboT - dt); A.hud(1, score);
    } else if (mode === 'dead') { deadT += dt; if (deadT > .8) { mode = 'over'; const isNew = A.best(score); A.show('Trail ended', `${why} Score ${score}${isNew ? ' — new best!' : '.'}`, 'Blaze again'); } }

    // draw orbs, mines, hunters
    orbs.forEach(o => { const s = 1 + Math.sin(o.t * 5) * .15; ctx.save(); ctx.translate(o.x, o.y); ctx.shadowColor = '#fde047'; ctx.shadowBlur = 20; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, 0, 8 * s, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff7c2'; ctx.beginPath(); ctx.arc(-2, -2, 3, 0, 6.283); ctx.fill(); ctx.restore(); });
    mines.forEach(m => { ctx.save(); ctx.translate(m.x, m.y); ctx.globalAlpha = Math.min(1, m.born); ctx.rotate(T * m.spin); ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 16; ctx.fillStyle = '#f43f5e'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? m.r * .72 : m.r * 1.28, a = i / 16 * 6.283; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.arc(0, 0, m.r * .45, 0, 6.283); ctx.fill(); ctx.restore(); });
    hunters.forEach(h => { ctx.save(); ctx.translate(h.x, h.y); ctx.globalAlpha = Math.min(1, h.t); ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 18; ctx.fillStyle = '#a855f7'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff'; [-5, 5].forEach(x => { ctx.beginPath(); ctx.arc(x, -2, 4, 0, 6.283); ctx.fill(); }); const a = Math.atan2(head.y - h.y, head.x - h.x); ctx.fillStyle = '#2e1065'; [-5, 5].forEach(x => { ctx.beginPath(); ctx.arc(x + Math.cos(a) * 1.8, -2 + Math.sin(a) * 1.8, 2, 0, 6.283); ctx.fill(); }); ctx.restore(); });

    // trail
    if (pts && pts.length > 1) {
      ctx.lineCap = ctx.lineJoin = 'round';
      const tail = pts[0], g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y); g.addColorStop(0, 'rgba(34,211,238,.15)'); g.addColorStop(.5, '#38bdf8'); g.addColorStop(1, '#f472b6');
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.strokeStyle = 'rgba(244,114,182,.18)'; ctx.lineWidth = 22; ctx.stroke(); ctx.strokeStyle = g; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.save(); ctx.translate(head.x, head.y); ctx.rotate(ang); ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, HR + 1, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#0b1d3a'; [-4, 4].forEach(y => { ctx.beginPath(); ctx.arc(3, y, 2.2, 0, 6.283); ctx.fill(); }); ctx.restore();
    }
    if (mode === 'play' && combo > 1 && comboT > 0) A.text('combo x' + Math.min(combo, 6), W / 2, 40, 18, `rgba(253,224,71,${Math.min(1, comboT)})`);
    if (mode === 'dead') { ctx.fillStyle = `rgba(244,63,94,${Math.max(0, .35 - deadT * .4)})`; ctx.fillRect(0, 0, W, H); }
    if (!mode) A.text('Steer with your finger', W / 2, H / 2, 26, 'rgba(255,255,255,.55)');
  });

  A.onStart(start);
  A.hud(3, A.bestScore()); head = {x: W / 2, y: H * .65}; ang = -Math.PI / 2; pts = [{x: head.x, y: head.y + 120, d: 0}, {x: head.x, y: head.y, d: 120}]; orbs = []; mines = []; hunters = []; mode = 0;
})();
