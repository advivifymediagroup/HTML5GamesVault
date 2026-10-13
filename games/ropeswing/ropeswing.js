(() => {
  const A = Arcade2D({key: 'ropeswing', w: 420, h: 640, bg: '#0b1030', bestHud: 3});
  const {W, H, ctx, p, rnd, clamp} = A;
  const G = 1050, R = 11, LAVA = H - 50;
  let hero, rope, anchors, coins, camX, mode = 'idle', score, coinCount, T = 0, deadT = 0, trail = [], why = '';
  const stars = Array.from({length: 70}, () => ({x: rnd(0, W), y: rnd(0, 330), r: rnd(.5, 1.7), t: rnd(0, 6)}));

  function genAnchors(fromX) {
    let x = fromX;
    while (anchors.length < 3 || anchors[anchors.length - 1].x < camX + W + 500) {
      x += rnd(150, 235) + Math.min(60, score / 6);
      const a = {x, y: rnd(105, 245)}; anchors.push(a);
      if (Math.random() < .55) coins.push({x: x - rnd(40, 90), y: rnd(250, 420), got: false, t: rnd(0, 6)});
      if (Math.random() < .25) coins.push({x: x + rnd(20, 70), y: rnd(300, 450), got: false, t: rnd(0, 6)});
    }
  }
  function start() {
    hero = {x: 100, y: 300, vx: 0, vy: 0}; rope = null; anchors = [{x: 190, y: 150}]; coins = []; camX = 0; score = 0; coinCount = 0; trail = []; deadT = 0; T = 0;
    genAnchors(190); mode = 'ready';
    A.hud(1, 0); A.hud(2, 0); A.status('Press and hold to throw your rope to the next hook. Release to let go and fly!');
  }
  function die(msg) { if (mode !== 'play') return; mode = 'dead'; why = msg; deadT = 0; rope = null; A.shake(12); A.beep(100, .4, 'sawtooth', .08); A.burst(hero.x - camX, hero.y, '#fb923c', 36, 220, 3); }
  const target = () => anchors.filter(a => a.x > hero.x - 25 && a.y < hero.y - 28 && Math.hypot(a.x - hero.x, a.y - hero.y) < 330).sort((a, b) => a.x - b.x)[0];
  function attach() {
    const a = target(); if (!a) return false;
    rope = {a, L: Math.max(70, Math.hypot(a.x - hero.x, a.y - hero.y))}; A.beep(380, .06, 'triangle', .05); return true;
  }
  const sc = () => Math.floor(Math.max(0, hero.x - 100) / 40) + coinCount * 5;

  function physics(dt) {
    hero.vy += G * dt; hero.x += hero.vx * dt; hero.y += hero.vy * dt;
    if (rope) {
      const dx = hero.x - rope.a.x, dy = hero.y - rope.a.y, d = Math.hypot(dx, dy);
      if (d > rope.L) { const nx = dx / d, ny = dy / d; hero.x = rope.a.x + nx * rope.L; hero.y = rope.a.y + ny * rope.L; const vr = hero.vx * nx + hero.vy * ny; if (vr > 0) { hero.vx -= vr * nx; hero.vy -= vr * ny; } }
      // gentle pump so swings keep their energy
      const tx = -(hero.y - rope.a.y), ty = hero.x - rope.a.x, tl = Math.hypot(tx, ty) || 1, sp = hero.vx * tx / tl + hero.vy * ty / tl; hero.vx += tx / tl * Math.sign(sp) * 38 * dt; hero.vy += ty / tl * Math.sign(sp) * 38 * dt;
    } else hero.vx *= Math.pow(.97, dt);
    if (hero.y < R) { hero.y = R; hero.vy = Math.abs(hero.vy) * .4; }
  }

  A.loop(dt => {
    T += dt;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1030'); bg.addColorStop(.6, '#2d1b69'); bg.addColorStop(1, '#7c2d12'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${.3 + Math.sin(T * 2 + s.t) * .3})`; ctx.fillRect(s.x, s.y, s.r, s.r); });
    [[.12, '#1d1450', 380, 150], [.3, '#150d3b', 440, 110]].forEach(([par, col, by, hg]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H); for (let x = -30; x <= W + 30; x += 15) { const wx = x + camX * par; ctx.lineTo(x, by - hg * (.45 + .55 * Math.abs(Math.sin(wx * .011) * Math.sin(wx * .0043 + 2)))); } ctx.lineTo(W + 30, H); ctx.closePath(); ctx.fill(); });

    if (mode === 'ready') { hero.x = 100; hero.y = 300 + Math.sin(T * 3) * 6; if (p.justDown) { mode = 'play'; hero.vx = 190; hero.vy = -140; attach(); A.status('Release to fly, hold to swing again. Stay out of the lava!'); } }
    if (mode === 'play') {
      if (p.down && !rope) attach();
      if (!p.down && rope) { rope = null; A.beep(520, .05, 'square', .03); }
      const steps = Math.ceil(dt / (1 / 120)); for (let i = 0; i < steps; i++) physics(dt / steps);
      camX += (hero.x - 125 - camX) * Math.min(1, dt * 6); genAnchors(anchors[anchors.length - 1].x);
      anchors = anchors.filter(a => a.x > camX - 80 || (rope && rope.a === a)); coins = coins.filter(c => c.x > camX - 40 && !c.got);
      coins.forEach(c => { c.t += dt; if (Math.hypot(c.x - hero.x, c.y - hero.y) < R + 12) { c.got = true; coinCount++; A.burst(c.x - camX, c.y, '#fde047', 10, 120, 2.5); A.beep(900 + coinCount % 6 * 70, .07, 'triangle'); A.hud(2, coinCount); } });
      trail.push({x: hero.x, y: hero.y, t: 1}); if (trail.length > 28) trail.shift();
      if (hero.y > LAVA - R) die('You fell into the lava!'); else if (hero.x < camX - 30) die('You got left behind!');
      A.hud(1, sc());
    } else if (mode === 'dead') {
      deadT += dt; if (deadT > .8) { mode = 'over'; const s = sc(), isNew = A.best(s); A.show('Burned!', `${why} Score ${s}${isNew ? ' — new best!' : '.'}`, 'Swing again'); }
    }
    const sx = x => x - camX;

    // lava
    const lg = ctx.createLinearGradient(0, LAVA - 20, 0, H); lg.addColorStop(0, '#ff9a3c'); lg.addColorStop(1, '#b91c1c'); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, LAVA + Math.sin((x + camX) * .045 + T * 3) * 5 + Math.sin((x + camX) * .09 - T * 2) * 3); ctx.lineTo(W, H); ctx.closePath(); ctx.shadowColor = '#f97316'; ctx.shadowBlur = 24; ctx.fill(); ctx.shadowBlur = 0;

    // anchors
    const tg = mode !== 'dead' && mode !== 'over' && !rope ? target() : null;
    anchors.forEach(a => {
      const x = sx(a.x); if (x < -30 || x > W + 30) return; const isT = a === tg || (rope && rope.a === a);
      if (isT) { ctx.strokeStyle = `rgba(103,232,249,${.5 + Math.sin(T * 8) * .3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, a.y, 17 + Math.sin(T * 8) * 2, 0, 6.283); ctx.stroke(); }
      ctx.save(); ctx.shadowColor = '#fde047'; ctx.shadowBlur = 14; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(x, a.y, 6, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, a.y, 10, Math.PI, 0); ctx.stroke(); ctx.restore();
    });
    coins.forEach(c => { const x = sx(c.x); if (x < -20 || x > W + 20) return; const w = Math.abs(Math.cos(c.t * 4)) * 8 + 2; ctx.save(); ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12; ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.ellipse(x, c.y, w, 9, 0, 0, 6.283); ctx.fill(); ctx.restore(); });

    // rope, trail, hero
    if (mode !== 'over') {
      trail.forEach((q, i) => { ctx.fillStyle = `rgba(251,146,60,${i / trail.length * .35})`; ctx.beginPath(); ctx.arc(sx(q.x), q.y, R * i / trail.length, 0, 6.283); ctx.fill(); });
      if (rope) { ctx.strokeStyle = '#67e8f9'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 10; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx(rope.a.x), rope.a.y); ctx.lineTo(sx(hero.x), hero.y); ctx.stroke(); ctx.shadowBlur = 0; }
      if (mode !== 'dead') {
        ctx.save(); ctx.translate(sx(hero.x), hero.y); ctx.rotate(Math.atan2(hero.vy, hero.vx) * .3);
        ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 14; ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; [-4, 4].forEach(x => { ctx.beginPath(); ctx.arc(x + 2, -2, 3.4, 0, 6.283); ctx.fill(); }); ctx.fillStyle = '#1b0b2b'; [-4, 4].forEach(x => { ctx.beginPath(); ctx.arc(x + 3, -2, 1.6, 0, 6.283); ctx.fill(); });
        ctx.restore();
      }
    }
    if (mode === 'ready') A.text('Press & hold to swing', W / 2, 90, 24, 'rgba(255,255,255,.8)');
    if (mode === 'play') A.text(String(sc()), W / 2, 56, 40, 'rgba(255,255,255,.85)');
  });

  A.onStart(start);
  A.hud(3, A.bestScore()); hero = {x: 100, y: 300, vx: 0, vy: 0}; anchors = [{x: 190, y: 150}]; coins = []; camX = 0; score = 0; coinCount = 0; genAnchors(190);
})();
