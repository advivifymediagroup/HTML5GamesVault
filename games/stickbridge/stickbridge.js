(() => {
  const A = Arcade2D({key: 'stickbridge', w: 420, h: 640, bg: '#2b1055', bestHud: 3});
  const {W, H, ctx, p, rnd, clamp} = A;
  const GY = 440, HW = 12, STICK_MAX = 520;
  let pillars = [], ci = 0, camX = 0, camTo = 0, stick = {len: 0, a: -Math.PI / 2}, hero = {x: 0, y: 0, vy: 0, rot: 0, walk: 0}, phase = 'idle', score = 0, perfects = 0, fallT = 0, goal = 0, ok = false, deadT = 0, T = 0, held = false, stars = [];
  for (let i = 0; i < 60; i++) stars.push({x: rnd(0, W), y: rnd(0, GY - 80), r: rnd(.5, 1.6), t: rnd(0, 6)});
  const ease = t => t * t;

  function makePillar(prev) {
    const gap = rnd(48, Math.min(250, 110 + score * 7)), w = Math.max(30, rnd(46, 118) - score * 1.6);
    return {x: prev.x + prev.w + gap, w};
  }
  function start() {
    pillars = [{x: 30, w: 90}]; pillars.push(makePillar(pillars[0])); ci = 0; score = 0; perfects = 0; camX = 0; camTo = 0; stick = {len: 0, a: -Math.PI / 2}; phase = 'wait'; held = false; T = 0;
    hero.x = pillars[0].x + pillars[0].w - HW - 4; hero.y = GY - 11; hero.vy = 0; hero.rot = 0;
    A.hud(1, 0); A.hud(2, 0); A.status('Hold to grow the bridge, release to drop it. Land on the red dot for a perfect!');
  }
  const base = () => pillars[ci].x + pillars[ci].w;
  const endX = () => base() + stick.len * Math.cos(stick.a), endY = () => GY + stick.len * Math.sin(stick.a);

  function finishRoll() {
    const nx = pillars[ci + 1], e = base() + stick.len;
    ok = e >= nx.x && e <= nx.x + nx.w;
    phase = 'walk'; goal = ok ? nx.x + nx.w - HW - 4 : Math.min(e, base() + stick.len) + 2;
    if (ok && Math.abs(e - (nx.x + nx.w / 2)) <= 6) { score += 2; perfects++; A.flash('PERFECT +2', 700); A.burst(e - camX, GY, '#fde047', 26, 200, 3); A.beep(1040, .16, 'triangle'); setTimeout(() => A.beep(1320, .2, 'triangle'), 110); }
    else if (ok) score++;
    A.hud(1, score); A.hud(2, perfects);
  }
  function gameOver() {
    phase = 'over'; const isNew = A.best(score); A.show('Splash!', `You crossed ${score} point${score === 1 ? '' : 's'} worth of bridges${isNew ? ' — new best!' : '.'}`, 'Try again');
  }

  A.loop(dt => {
    T += dt;
    // sky, stars, parallax mountains
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b0b3d'); g.addColorStop(.5, '#6b2a8a'); g.addColorStop(1, '#ff8f6b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${.35 + Math.sin(T * 2 + s.t) * .3})`; ctx.fillRect(s.x, s.y, s.r, s.r); });
    ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(320, 150, 34, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(253,230,138,.18)'; ctx.beginPath(); ctx.arc(320, 150, 62, 0, 6.283); ctx.fill();
    [[.15, '#3a1a63', 230, 120], [.3, '#2a1050', 300, 90]].forEach(([par, col, baseY, hgt]) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); for (let x = -40; x <= W + 40; x += 20) { const wx = x + camX * par; ctx.lineTo(x, baseY + 220 - hgt * (.5 + .5 * Math.sin(wx * .012) * Math.sin(wx * .0047 + 1))); } ctx.lineTo(W + 40, H); ctx.closePath(); ctx.fill();
    });

    // camera
    camX += (camTo - camX) * Math.min(1, dt * 5);
    const sx = x => x - camX;

    // input
    if (phase === 'wait' && p.justDown) { phase = 'grow'; held = true; }
    if (phase === 'grow') { stick.len = Math.min(STICK_MAX, stick.len + 300 * dt); if (Math.floor(T * 22) % 3 === 0 && Math.random() < .2) A.beep(200 + stick.len, .03, 'square', .015); if (!p.down) { phase = 'fall'; fallT = 0; A.beep(180, .1, 'square', .05); } }
    if (phase === 'fall') { fallT += dt; const t = clamp(fallT / .5, 0, 1); stick.a = -Math.PI / 2 + (Math.PI / 2) * ease(t); if (t >= 1) { stick.a = 0; A.shake(3); A.beep(120, .08, 'square', .05); finishRoll(); } }
    if (phase === 'walk') {
      const dir = Math.sign(goal - hero.x), sp = 260; hero.walk += dt * 14;
      if (Math.abs(goal - hero.x) <= sp * dt) {
        hero.x = goal;
        if (ok) { phase = 'scroll'; ci++; pillars.push(makePillar(pillars[pillars.length - 1])); camTo = pillars[ci].x + pillars[ci].w - 130; }
        else { phase = 'drop'; deadT = 0; hero.vy = 0; A.beep(300, .35, 'sawtooth', .05); }
      } else hero.x += dir * sp * dt;
    }
    if (phase === 'scroll') { stick = {len: 0, a: -Math.PI / 2}; if (Math.abs(camTo - camX) < 2) { phase = 'wait'; if (pillars.length > 6) { pillars.shift(); ci--; } } }
    if (phase === 'drop') {
      deadT += dt; hero.vy += 1500 * dt; hero.y += hero.vy * dt; hero.rot += dt * 9; stick.a = Math.min(Math.PI / 2, stick.a + dt * 3.2);
      if (hero.y > H + 40 && deadT > .5) gameOver();
    }
    if (phase !== 'drop' && phase !== 'over') hero.y = GY - 11 - (phase === 'walk' ? Math.abs(Math.sin(hero.walk)) * 3 : 0);

    // pillars
    pillars.forEach((pl, i) => {
      const x = sx(pl.x); if (x > W + 20 || x + pl.w < -20) return;
      const pg = ctx.createLinearGradient(0, GY, 0, H); pg.addColorStop(0, '#2a1a3d'); pg.addColorStop(1, '#0d0618'); ctx.fillStyle = pg; ctx.fillRect(x, GY, pl.w, H - GY);
      ctx.fillStyle = '#4b2f6b'; ctx.fillRect(x, GY, pl.w, 6); ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let y = GY + 24; y < H; y += 28) ctx.fillRect(x + 4, y, pl.w - 8, 2);
      if (i > ci) { ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; ctx.fillRect(x + pl.w / 2 - 5, GY, 10, 6); ctx.shadowBlur = 0; }
    });
    // stick
    if (stick.len > 0 && pillars[ci]) {
      ctx.save(); ctx.translate(sx(base()), GY); ctx.rotate(stick.a); ctx.fillStyle = '#c08a4b'; ctx.fillRect(0, -3.5, stick.len, 7); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, -3.5, stick.len, 2); ctx.restore();
    }
    // hero (little ninja)
    if (phase !== 'over' && pillars[ci]) {
      ctx.save(); ctx.translate(sx(hero.x), hero.y); ctx.rotate(hero.rot);
      ctx.fillStyle = '#0f0a1a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.fillRect(-11, -5, 22, 5); ctx.fillStyle = '#fff'; [-4, 4].forEach(x => { ctx.beginPath(); ctx.arc(x, -2.5, 2.2, 0, 6.283); ctx.fill(); });
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-20, -6 + Math.sin(T * 12) * 3); ctx.lineTo(-10, 1); ctx.fill(); ctx.restore();
    }
    if (phase === 'wait' && score === 0) A.text(p.type === 'touch' ? 'Press and hold' : 'Hold the mouse button', W / 2, 90, 22, 'rgba(255,255,255,.75)');
    if (phase === 'grow') A.text(Math.round(stick.len) + ' px', sx(base()) + 6, GY - stick.len - 14, 14, 'rgba(255,255,255,.7)', 'left');
    A.text(String(score), W / 2, 56, 44, 'rgba(255,255,255,.9)');
  });

  A.onStart(start);
  A.hud(3, A.bestScore()); pillars = [{x: 30, w: 90}, {x: 220, w: 70}]; hero.x = 108; hero.y = GY - 11;
})();
