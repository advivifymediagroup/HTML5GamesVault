(() => {
  const A = Arcade2D({key: 'chompmaze', w: 420, h: 640, bg: '#150b30', bestHud: 3});
  const {W, H, ctx, p, rnd, clamp} = A;
  const ROW = 165, WALL = 26, FR = 13, LIFT_MAX = .65, REGRAB = 90;
  const finger = {x: W / 2, y: H * .78}, grab = {dx: 0, dy: 0};
  let rows = [], gems = [], mode = 'idle', grabbed = false, lift = 0, scroll = 0, speed = 70, gemCount = 0, deadT = 0, killer = null, why = '', T = 0;
  const bokeh = Array.from({length: 26}, () => ({x: rnd(0, W), y: rnd(0, H), r: rnd(8, 34), s: rnd(8, 30), h: rnd(250, 330)}));
  const MON_COL = ['#fb7185', '#fbbf24', '#a78bfa', '#38bdf8'];
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const diff = () => scroll / 40;

  // ---- level generation ----
  function makeRow(y, easy) {
    const gapW = Math.max(88, 156 - diff() * .9), r = {y, walls: [], teeth: null, mons: [], jaw: null}, kind = easy ? 0 : [0, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)];
    const last = rows.length ? rows[rows.length - 1].cx : W / 2;
    const cx = clamp(last + rnd(-190, 190), gapW / 2 + 18, W - gapW / 2 - 18); r.cx = cx;
    const mid = WALL + (ROW - WALL) / 2;
    if (kind === 3) { // two small gaps with roaming monsters between
      const w = gapW * .78, g1 = {x: w / 2 + 22, w}, g2 = {x: W - w / 2 - 22, w};
      r.gaps = [g1, g2]; r.cx = Math.random() < .5 ? g1.x : g2.x;
      for (let i = 0; i < 2; i++) r.mons.push({x: rnd(120, 300), y: y + mid + rnd(-26, 26), vx: (Math.random() < .5 ? -1 : 1) * (60 + diff() * .4), vy: (Math.random() < .5 ? -1 : 1) * 38, r: 19, c: MON_COL[i + 2], roam: true});
    } else {
      const w = kind === 2 ? gapW + 26 : gapW; r.gaps = [{x: cx, w}];
      if (kind === 1) r.mons.push({x: rnd(60, 360), y: y + mid, vx: (Math.random() < .5 ? -1 : 1) * (74 + diff() * .5), vy: 0, r: 21, c: MON_COL[Math.floor(Math.random() * 4)], patrol: true});
      if (kind === 2) r.jaw = {x: cx, w, ph: rnd(0, 2)};
    }
    let x0 = 0; r.gaps.slice().sort((a, b) => a.x - b.x).forEach(g => { r.walls.push({x: x0, w: g.x - g.w / 2 - x0}); x0 = g.x + g.w / 2; }); r.walls.push({x: x0, w: W - x0});
    if (Math.random() < .7) { const oy = Math.random() < .5 ? WALL / 2 : mid + rnd(-40, 40); gems.push({row: r, x: Math.random() < .5 ? r.cx + rnd(-20, 20) : rnd(40, W - 40), oy, y: y + oy, got: false}); }
    return r;
  }
  const jawC = j => { const t = (T * 1 + j.ph * 1.1) % 2.1; return t < 1.1 ? 0 : t < 1.32 ? (t - 1.1) / .22 : t < 1.82 ? 1 : 1 - (t - 1.82) / .28; };
  function fill() { while (!rows.length || rows[rows.length - 1].y > -ROW + 10) rows.push(makeRow(rows.length ? rows[rows.length - 1].y - ROW : H * .38 - ROW, rows.length < 3)); }

  function start() {
    rows = []; gems = []; scroll = 0; speed = 70; gemCount = 0; grabbed = false; lift = 0; deadT = 0; killer = null; T = 0;
    finger.x = W / 2; finger.y = H * .8; mode = 'ready'; fill();
    A.hud(1, 0); A.hud(2, 0); A.status('Press and hold the glowing fingertip, then slide it through. Never let go!');
  }
  function die(msg, by) {
    if (mode !== 'play') return; mode = 'dead'; why = msg; killer = by; deadT = 0; grabbed = false;
    A.shake(14); A.beep(120, .35, 'sawtooth', .08); A.burst(finger.x, finger.y, '#fda4af', 40, 220, 3);
  }
  const score = () => Math.floor(scroll / 40) + gemCount * 25;

  // ---- drawing ----
  function drawMon(m, near) {
    const open = clamp(1 - near / 120, 0, 1), t = T * 6 + m.x;
    ctx.save(); ctx.translate(m.x, m.y);
    ctx.fillStyle = m.c; ctx.shadowColor = m.c; ctx.shadowBlur = 16;
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 + t * .15; ctx.beginPath(); ctx.arc(Math.cos(a) * m.r, Math.sin(a) * m.r, 5 + Math.sin(t + i) * 1.5, 0, 6.283); ctx.fill(); }
    ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, m.r, 0, 6.283); ctx.fill();
    const dx = finger.x - m.x, dy = finger.y - m.y, d = Math.hypot(dx, dy) || 1, ex = dx / d * 3.2, ey = dy / d * 3.2;
    ctx.fillStyle = '#fff'; [-7, 7].forEach(x => { ctx.beginPath(); ctx.arc(x, -5, 6, 0, 6.283); ctx.fill(); });
    ctx.fillStyle = '#1b0b2b'; [-7, 7].forEach(x => { ctx.beginPath(); ctx.arc(x + ex, -5 + ey, 3, 0, 6.283); ctx.fill(); });
    ctx.fillStyle = '#2a0a1f'; ctx.beginPath(); ctx.ellipse(0, 8, 8 + open * 4, 2 + open * 8, 0, 0, 6.283); ctx.fill();
    if (open > .3) { ctx.fillStyle = '#fff'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5 - 2, 8 - open * 7); ctx.lineTo(i * 5 + 2, 8 - open * 7); ctx.lineTo(i * 5, 8 - open * 7 + 4); ctx.fill(); } }
    ctx.restore();
  }
  function drawWall(x, y, w) {
    if (w <= 0) return;
    const g = ctx.createLinearGradient(0, y, 0, y + WALL); g.addColorStop(0, '#34d399'); g.addColorStop(1, '#0f766e');
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(16,185,129,.55)'; ctx.shadowBlur = 14; rr(x, y, w, WALL, 10); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 5, y + 3, Math.max(0, w - 10), 5, 3); ctx.fill();
  }
  function drawFinger(alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(finger.x, finger.y);
    ctx.shadowColor = '#fbcfe8'; ctx.shadowBlur = grabbed ? 22 : 12 + Math.sin(T * 8) * 8;
    ctx.fillStyle = '#fdd9c4'; ctx.beginPath(); ctx.arc(0, 0, FR, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#f9a8b8'; ctx.beginPath(); ctx.ellipse(0, -3, 7, 6, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-2.5, -5.5, 2.6, 1.7, -.5, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  A.loop(dt => {
    T += dt;
    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#25104d'); bg.addColorStop(1, '#0e0722'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    bokeh.forEach(b => { b.y += b.s * dt * (mode === 'play' ? 1 + speed / 70 : .6); if (b.y - b.r > H) { b.y = -b.r; b.x = rnd(0, W); } ctx.fillStyle = `hsla(${b.h},80%,60%,.07)`; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); });

    // input
    const near = Math.hypot(p.x - finger.x, p.y - finger.y);
    if ((mode === 'ready' || mode === 'play') && !grabbed && p.down && (p.justDown || near < 40) && near < REGRAB) {
      grabbed = true; grab.dx = finger.x - p.x; grab.dy = finger.y - p.y; lift = 0;
      if (mode === 'ready') { mode = 'play'; A.beep(520, .1, 'triangle'); A.status('Slide through the gaps. Letting go for too long gets you chomped!'); }
    }
    if (grabbed && !p.down) grabbed = false;

    if (mode === 'play') {
      speed = 70 + Math.min(120, diff() * 1.6); scroll += speed * dt;
      rows.forEach(r => { r.y += speed * dt; r.mons.forEach(m => { m.x += m.vx * dt; if (m.roam) m.y += m.vy * dt; if (m.x < m.r + 6 || m.x > W - m.r - 6) m.vx *= -1, m.x = clamp(m.x, m.r + 6, W - m.r - 6); if (m.roam) { const mid = r.y + WALL + (ROW - WALL) / 2 + 0; if (Math.abs(m.y - mid) > 40) m.vy = -Math.sign(m.y - mid) * Math.abs(m.vy); } }); });
      // roam monsters keep their relative y: stored as absolute y, so move with rows
      rows.forEach(r => r.mons.forEach(m => { m.y += speed * dt; }));
      gems.forEach(g => { g.y = g.row.y + g.oy; });
      rows = rows.filter(r => r.y < H + 40); gems = gems.filter(g => g.row.y < H + 40 && !g.got); fill();
      if (grabbed) { const tx = p.x + grab.dx, ty = p.y + grab.dy; finger.x += (tx - finger.x) * Math.min(1, dt * 22); finger.y += (ty - finger.y) * Math.min(1, dt * 22); }
      else { lift += dt; if (lift > LIFT_MAX) { die('You let go! The monsters chomped your finger.', null); } }
      finger.x = clamp(finger.x, FR, W - FR);
      if (finger.y < FR) finger.y = FR;
      // walls push the finger; jaws and monsters bite
      let squashed = false;
      rows.forEach(r => {
        const push = (x, y, w, h) => {
          const cx = clamp(finger.x, x, x + w), cy = clamp(finger.y, y, y + h); let dx = finger.x - cx, dy = finger.y - cy, d = Math.hypot(dx, dy);
          if (d >= FR) return false;
          if (d < 1e-4) { const l = finger.x - x, rr2 = x + w - finger.x, t = finger.y - y, b = y + h - finger.y, m = Math.min(l, rr2, t, b); if (m === b) finger.y = y + h + FR; else if (m === t) finger.y = y - FR; else if (m === l) finger.x = x - FR; else finger.x = x + w + FR; }
          else { finger.x += dx / d * (FR - d); finger.y += dy / d * (FR - d); }
          return true;
        };
        for (let k = 0; k < 2; k++) r.walls.forEach(w => { if (push(w.x, r.y, w.w, WALL)) { if (finger.y > H - FR + 1) squashed = true; } });
        if (r.jaw) {
          const c = jawC(r.jaw), half = r.jaw.w / 2, t = c * half, y0 = r.y - 2, h = WALL + 18;
          if (t > 1) [[r.jaw.x - half, t], [r.jaw.x + half - t, t]].forEach(([x, w]) => { const cx = clamp(finger.x, x, x + w), cy = clamp(finger.y, y0, y0 + h); if (Math.hypot(finger.x - cx, finger.y - cy) < FR - 1) die('Snap! The jaws closed on your finger.', r.jaw); });
        }
        r.mons.forEach(m => { if (Math.hypot(finger.x - m.x, finger.y - m.y) < m.r + FR - 3) die('Chomp! A monster got your finger.', m); });
      });
      if (finger.y > H + 4 || squashed) die('Squashed against the bottom!', null);
      gems.forEach(g => { if (!g.got && Math.hypot(finger.x - g.x, finger.y - g.y) < FR + 11) { g.got = true; gemCount++; A.burst(g.x, g.y, '#fde047', 12, 120, 2.5); A.beep(900 + gemCount % 5 * 90, .08, 'triangle'); A.hud(2, gemCount); } });
      A.hud(1, score());
    } else if (mode === 'dead') {
      deadT += dt; if (deadT > .75) { mode = 'over'; const isNew = A.best(score()); A.show('Chomped!', `${why} Score ${score()}${isNew ? ' — new best!' : '.'}`, 'Try again'); }
    } else if (mode === 'idle') { if (!rows.length) { fill(); } }

    // draw world
    gems.forEach(g => { if (g.got) return; const s = 1 + Math.sin(T * 6 + g.x) * .12; ctx.save(); ctx.translate(g.x, g.y); ctx.scale(s, s); ctx.shadowColor = '#fde047'; ctx.shadowBlur = 14; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 0); ctx.lineTo(0, 9); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill(); ctx.restore(); });
    rows.forEach(r => {
      r.walls.forEach(w => drawWall(w.x, r.y, w.w));
      if (r.jaw) {
        const c = jawC(r.jaw), half = r.jaw.w / 2, t = c * half;
        ctx.fillStyle = '#c026d3'; ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 14;
        [[r.jaw.x - half, 1], [r.jaw.x + half, -1]].forEach(([x, dir]) => {
          const len = Math.max(t, 4); ctx.beginPath(); ctx.moveTo(x, r.y - 2); ctx.lineTo(x + dir * len, r.y - 2); ctx.lineTo(x + dir * len, r.y + WALL + 6);
          for (let k = 0; k < 4; k++) { ctx.lineTo(x + dir * (len - (k + .5) * len / 4), r.y + WALL + 18); ctx.lineTo(x + dir * (len - (k + 1) * len / 4), r.y + WALL + 6); }
          ctx.closePath(); ctx.fill();
        });
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(r.jaw.x + s * 14, r.y - 12, 8, 0, 6.283); ctx.fill(); }); ctx.fillStyle = '#1b0b2b'; [-1, 1].forEach(s => { ctx.beginPath(); ctx.arc(r.jaw.x + s * 14 + clamp((finger.x - r.jaw.x) / 40, -3, 3), r.y - 11, 3.5, 0, 6.283); ctx.fill(); });
      }
      r.mons.forEach(m => drawMon(m, Math.hypot(finger.x - m.x, finger.y - m.y)));
    });
    // finger + lift warning
    if (mode === 'ready') { ctx.strokeStyle = `rgba(253,224,71,${.5 + Math.sin(T * 6) * .4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(finger.x, finger.y, 26 + Math.sin(T * 6) * 4, 0, 6.283); ctx.stroke(); A.text('HOLD HERE', finger.x, finger.y + 46, 14, '#fde68a'); }
    if (mode === 'play' && !grabbed) { const k = 1 - lift / LIFT_MAX; ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(finger.x, finger.y, 18 + k * 18, 0, 6.283); ctx.stroke(); A.text('TOUCH ME!', finger.x, finger.y - 44, 15, '#fecdd3'); }
    if (mode !== 'over') drawFinger(mode === 'play' && !grabbed ? .55 : 1);
    if (mode === 'dead' && killer && killer.r) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(killer.x, killer.y, killer.r + 6 + deadT * 40, 0, 6.283); ctx.globalAlpha = Math.max(0, 1 - deadT * 1.6); ctx.stroke(); ctx.globalAlpha = 1; }
    if (mode === 'dead') A.text('CHOMP!', W / 2, H * .42, 56 + deadT * 20, `rgba(255,255,255,${Math.max(0, 1 - deadT * 1.2)})`);
    if (mode === 'idle') { A.text('Hold. Slide. Survive.', W / 2, H * .22, 28, 'rgba(255,255,255,.55)'); }
  });

  A.onStart(start);
  A.hud(3, A.bestScore()); fill();
})();
