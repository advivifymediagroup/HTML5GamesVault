(() => {
  const A = Arcade2D({key: 'handslap', w: 420, h: 640, bg: '#1b1330', bestHud: 4});
  const {W, H, ctx, p, rnd, clamp} = A;
  const FR = 13;
  const finger = {x: W / 2, y: H * .72};
  let slaps = [], pickups = [], rings = [], mode = 'idle', T = 0, lives = 3, stars = 0, invuln = 0, nextAt = 0, heartAt = 0, starAt = 0, time = 0, hand = false;
  const score = () => Math.floor(time) * 10 + stars * 50;

  // ---- drawing ----
  function drawHand(x, y, rot, s, shade) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    const skin = ctx.createLinearGradient(0, -60, 0, 60); skin.addColorStop(0, '#ffd9b8'); skin.addColorStop(1, '#f0a77c');
    ctx.fillStyle = skin; ctx.strokeStyle = '#7a3b1d'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    const pill = (x0, y0, w, h) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, w, h, w / 2) : ctx.rect(x0, y0, w, h); ctx.fill(); ctx.stroke(); };
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-38, -14, 76, 66, 20) : ctx.rect(-38, -14, 76, 66); ctx.fill(); ctx.stroke();       // palm
    [[-34, -66, 18, 62], [-12, -78, 20, 72], [11, -74, 20, 68], [32, -58, 18, 54]].forEach(f => pill(...f));                            // fingers
    ctx.save(); ctx.translate(-44, 12); ctx.rotate(-.9); pill(-9, -30, 20, 46); ctx.restore();                                         // thumb
    ctx.shadowColor = 'transparent'; ctx.fillStyle = 'rgba(255,255,255,.5)'; [[-25, -62], [-2, -74], [21, -70], [41, -54]].forEach(([nx, ny]) => { ctx.beginPath(); ctx.ellipse(nx, ny, 5, 7, 0, 0, 6.283); ctx.fill(); }); // nails
    ctx.fillStyle = shade || '#ef4444'; ctx.strokeStyle = '#7f1d1d'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-44, 46, 88, 34, 8) : ctx.rect(-44, 46, 88, 34); ctx.fill(); ctx.stroke(); // cuff
    ctx.restore();
  }
  function warn(x, y, w, h, prog, circle, r) {
    ctx.save(); const a = .18 + .28 * Math.abs(Math.sin(T * 14)) * (.4 + prog); ctx.fillStyle = `rgba(239,68,68,${a})`; ctx.strokeStyle = `rgba(254,202,202,${.5 + prog * .5})`; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    if (circle) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(x, y, r * (1 - prog), 0, 6.283); ctx.stroke(); }
    else { ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); }
    ctx.restore();
  }

  // ---- slaps ----
  function spawnSlap() {
    const d = time, kinds = ['slam', 'slam'];
    if (d > 10) kinds.push('sweepH', 'sweepV'); if (d > 22) kinds.push('pincer'); if (d > 35) kinds.push('slam3');
    const k = kinds[Math.floor(Math.random() * kinds.length)], tele = Math.max(.5, .95 - d / 90);
    if (k === 'slam') { const aim = Math.random() < .55; slaps.push({k, t: 0, tele, x: aim ? finger.x + rnd(-40, 40) : rnd(70, W - 70), y: aim ? finger.y + rnd(-40, 40) : rnd(120, H - 80), r: 62}); }
    else if (k === 'slam3') for (let i = 0; i < 3; i++) slaps.push({k: 'slam', t: -i * .22, tele, x: i === 0 ? finger.x : rnd(70, W - 70), y: i === 0 ? finger.y : rnd(120, H - 80), r: 58});
    else if (k === 'sweepH') slaps.push({k, t: 0, tele: tele + .1, y: clamp(finger.y + rnd(-60, 60), 60, H - 60), dir: Math.random() < .5 ? 1 : -1, h: 84});
    else if (k === 'sweepV') slaps.push({k, t: 0, tele: tele + .1, x: clamp(finger.x + rnd(-60, 60), 50, W - 50), dir: Math.random() < .5 ? 1 : -1, w: 84});
    else slaps.push({k: 'pincer', t: 0, tele: tele + .2, x: rnd(110, W - 110), slot: 96});
  }
  function hurtFinger() {
    if (invuln > 0 || mode !== 'play') return; lives--; invuln = 1.3; A.hud(2, lives); A.shake(16); A.burst(finger.x, finger.y, '#fecaca', 26, 220, 3); A.beep(110, .3, 'sawtooth', .08); A.flash('OUCH!', 500);
    if (lives <= 0) { mode = 'over'; const sc = score(), isNew = A.best(sc); A.show('Slapped silly!', `You lasted ${Math.floor(time)}s with ${stars} stars — score ${sc}${isNew ? ' (new best!)' : ''}.`, 'Try again'); }
  }
  const hits = (x0, y0, w, h) => finger.x + FR * .7 > x0 && finger.x - FR * .7 < x0 + w && finger.y + FR * .7 > y0 && finger.y - FR * .7 < y0 + h;

  function start() { slaps = []; pickups = []; rings = []; time = 0; lives = 3; stars = 0; invuln = 0; nextAt = 1.1; heartAt = 18; starAt = 2.5; finger.x = W / 2; finger.y = H * .72; mode = 'play'; A.hud(1, 0); A.hud(2, 3); A.hud(3, 0); A.status('Move your finger away from the red zones before the hands land!'); }

  A.loop(dt => {
    T += dt;
    // table + carpet pattern
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * .75); g.addColorStop(0, '#3b2a6b'); g.addColorStop(1, '#150e2c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.035)'; for (let i = 0; i < 9; i++) for (let j = 0; j < 14; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 52, j * 52, 52, 52);

    // finger follows pointer (mouse hover or touch contact)
    if (mode === 'play' && (p.down || p.type === 'mouse')) { finger.x += (clamp(p.x, FR, W - FR) - finger.x) * Math.min(1, dt * 22); finger.y += (clamp(p.y, FR, H - FR) - finger.y) * Math.min(1, dt * 22); }
    if (mode === 'play') {
      time += dt; invuln = Math.max(0, invuln - dt);
      nextAt -= dt; if (nextAt <= 0) { spawnSlap(); nextAt = Math.max(.42, 1.45 - time / 40) * rnd(.75, 1.15); }
      starAt -= dt; if (starAt <= 0) { pickups.push({k: 'star', x: rnd(40, W - 40), y: rnd(100, H - 60), t: 0}); starAt = rnd(3, 5.5); }
      heartAt -= dt; if (heartAt <= 0) { pickups.push({k: 'heart', x: rnd(40, W - 40), y: rnd(100, H - 60), t: 0}); heartAt = rnd(22, 32); }
      A.hud(1, score());
    }

    pickups.forEach(q => { q.t += dt; });
    pickups = pickups.filter(q => {
      if (mode === 'play' && Math.hypot(finger.x - q.x, finger.y - q.y) < FR + 14) {
        if (q.k === 'star') { stars++; A.hud(3, stars); A.beep(880 + stars % 6 * 80, .09, 'triangle'); } else if (lives < 5) { lives++; A.hud(2, lives); A.beep(520, .15, 'triangle'); A.flash('+1 LIFE', 500); }
        A.burst(q.x, q.y, q.k === 'star' ? '#fde047' : '#fb7185', 14, 130, 2.5); return false;
      }
      return q.t < 7;
    });

    // update + draw slaps
    slaps = slaps.filter(s => {
      s.t += dt; const prog = clamp(s.t / s.tele, 0, 1), after = s.t - s.tele;
      if (s.k === 'slam') {
        if (s.t < 0) return true;
        if (after < 0) warn(s.x, s.y, 0, 0, prog, true, s.r);
        else {
          const drop = clamp(1 - after / .12, 0, 1), lift = clamp((after - .5) / .25, 0, 1);
          if (after >= .12 && !s.hit) { s.hit = true; A.shake(10); A.beep(90, .18, 'square', .07); A.burst(s.x, s.y, '#ffe4c4', 18, 190, 3); rings.push({x: s.x, y: s.y, r: s.r * .6, t: 0, R: s.r * 1.9}); if (Math.hypot(finger.x - s.x, finger.y - s.y) < s.r + FR * .3) hurtFinger(); }
          ctx.globalAlpha = 1 - lift; drawHand(s.x, s.y - 4, 0, 1.25 * (1 + drop * 1.1), '#ef4444'); ctx.globalAlpha = 1;
        }
        return after < .75;
      }
      if (s.k === 'sweepH' || s.k === 'sweepV') {
        const horiz = s.k === 'sweepH';
        if (after < 0) { if (horiz) warn(0, s.y - s.h / 2, W, s.h, prog); else warn(s.x - s.w / 2, 0, s.w, H, prog); A.text(horiz ? (s.dir > 0 ? '▶▶▶' : '◀◀◀') : (s.dir > 0 ? '▼▼▼' : '▲▲▲'), horiz ? W / 2 : s.x, horiz ? s.y : H / 2, 26, 'rgba(255,255,255,.7)'); return true; }
        const u = clamp(after / .42, 0, 1), span = (horiz ? W : H) + 220, pos = (s.dir > 0 ? -110 : (horiz ? W : H) + 110) + s.dir * span * u;
        const hx = horiz ? pos : s.x, hy = horiz ? s.y : pos, rot = horiz ? (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (s.dir > 0 ? Math.PI : 0);
        drawHand(hx, hy, rot, .95, '#3b82f6');
        if (horiz ? hits(hx - 60, hy - 52, 120, 104) : hits(hx - 52, hy - 60, 104, 120)) hurtFinger();
        if (u < 1 && Math.random() < .5) A.burst(hx, hy, '#ffe4c4', 1, 80, 2);
        return u < 1;
      }
      // pincer: two hands close together around a safe slot
      if (after < 0) { warn(0, 0, s.x - s.slot / 2, H, prog); warn(s.x + s.slot / 2, 0, W - s.x - s.slot / 2, H, prog); ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.strokeRect(s.x - s.slot / 2, 6, s.slot, H - 12); return true; }
      const u = clamp(after / .22, 0, 1), e = u * u, sl = s.x - s.slot / 2, sr = s.x + s.slot / 2, tipL = -40 + e * (sl + 40), tipR = W + 40 - e * (W + 40 - sr);
      for (let i = 0; i < 5; i++) { const y = 64 + i * 128; drawHand(tipL - 125, y, Math.PI / 2, 1.6, '#a855f7'); drawHand(tipR + 125, y, -Math.PI / 2, 1.6, '#a855f7'); }
      if (finger.x < tipL + 6 || finger.x > tipR - 6) hurtFinger();
      if (u >= 1 && !s.hit) { s.hit = true; A.shake(14); A.beep(80, .2, 'square', .08); }
      return after < .6;
    });
    rings = rings.filter(r => { r.t += dt * 3.2; if (r.t >= 1) return false; ctx.strokeStyle = `rgba(255,228,196,${1 - r.t})`; ctx.lineWidth = 6 * (1 - r.t); ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.R - r.r) * r.t, 0, 6.283); ctx.stroke(); return true; });

    pickups.forEach(q => {
      const b = 1 + Math.sin(q.t * 7) * .12; ctx.save(); ctx.translate(q.x, q.y); ctx.scale(b, b); ctx.shadowColor = q.k === 'star' ? '#fde047' : '#fb7185'; ctx.shadowBlur = 16;
      if (q.k === 'star') { ctx.fillStyle = '#fde047'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-22, -2, -10, -18, 0, -6); ctx.bezierCurveTo(10, -18, 22, -2, 0, 12); ctx.fill(); }
      ctx.restore();
    });

    // finger
    if (mode !== 'over') {
      const blink = invuln > 0 && Math.floor(T * 14) % 2 === 0; if (!blink) {
        ctx.save(); ctx.translate(finger.x, finger.y); ctx.shadowColor = '#fbcfe8'; ctx.shadowBlur = 18; ctx.fillStyle = '#fdd9c4'; ctx.beginPath(); ctx.arc(0, 0, FR, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#f9a8b8'; ctx.beginPath(); ctx.ellipse(0, -3, 7, 6, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-2.5, -5.5, 2.6, 1.7, -.5, 0, 6.283); ctx.fill(); ctx.restore();
      }
    }
    if (mode === 'idle') A.text('Dodge the hands!', W / 2, H * .3, 30, 'rgba(255,255,255,.6)');
  });

  A.onStart(start);
  A.hud(4, A.bestScore());
})();
