(() => {
  const S = Stage3D({key: 'pinballpulse', bg: 0x07040f, sky: ['#241046', '#0b0620', '#05030c'], fog: [30, 90], fov: 44, bestHud: 4, exposure: 1.15});
  if (!S) return;
  const {scene, camera, wrap} = S;
  const TAU = Math.PI * 2, BALL_R = .3, G = 13, SUB = 10, MAXV = 30;
  const FL = {len: 1.5, r: .17, rest: .49, up: -.52, speed: 18};
  const PIV = [[-1.9, 5.7], [1.9, 5.7]];
  const LANE_X = 4.62, LANE_Z = 7.3;

  // ---- static geometry: wall segments [ax, az, bx, bz, restitution] ----
  const walls = [];
  const seg = (ax, az, bx, bz, e, col) => walls.push({ax, az, bx, bz, e: e || .45, col: col || 0x22d3ee});
  for (let i = 0; i < 28; i++) { // arch
    const a0 = Math.PI + (i / 28) * Math.PI, a1 = Math.PI + ((i + 1) / 28) * Math.PI;
    seg(5 * Math.cos(a0), -4 + 5 * Math.sin(a0), 5 * Math.cos(a1), -4 + 5 * Math.sin(a1), .5);
  }
  seg(-5, -4, -5, 4.2);                  // left wall
  seg(-5, 4.2, -2.05, 5.72, .35, 0xa78bfa); // left guide rail
  seg(4.25, -3.0, 4.25, 4.3);            // lane inner wall (upper)
  seg(4.25, 4.3, 2.05, 5.72, .35, 0xa78bfa); // right guide rail
  seg(5, -4, 5, 7.8);                    // right outer wall
  seg(4.25, 4.3, 4.25, 7.8);             // lane inner wall (lower)
  seg(4.25, 7.8, 5, 7.8, .2, 0xf472b6);  // lane floor
  seg(-3.6, 0.4, -2.5, 2.9, .4, 0xf472b6); seg(3.6, 0.4, 2.5, 2.9, .4, 0xf472b6); // inlane deflectors
  const bumpers = [{x: -1.7, z: -4.2, r: .62, col: 0xfbbf24}, {x: 1.7, z: -4.2, r: .62, col: 0xf472b6}, {x: 0, z: -2.1, r: .62, col: 0x22d3ee}];
  const posts = [{x: -3.5, z: -1.2, r: .26}, {x: 3.3, z: -1.2, r: .26}, {x: -3.4, z: 2.2, r: .26}];
  const targets = [-1.5, 0, 1.5].map(x => ({x, z: -6.5, w: .5, down: false, y: 0}));

  // ---- scene ----
  scene.add(new THREE.AmbientLight(0x6a5fd0, .75));
  const sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(-4, 14, 6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -8, right: 8, top: 12, bottom: -12, near: 1, far: 40}); scene.add(sun);

  function fieldTex() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 1024; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 1024); g.addColorStop(0, '#1a0b3d'); g.addColorStop(.5, '#10163f'); g.addColorStop(1, '#0a0f2a'); x.fillStyle = g; x.fillRect(0, 0, 512, 1024);
    const px = X => (X + 5) / 10 * 512, pz = Z => (Z + 9) / 17 * 1024;
    x.lineWidth = 3;
    [...bumpers].forEach(b => { for (let k = 1; k <= 3; k++) { x.strokeStyle = `rgba(${k % 2 ? '34,211,238' : '244,114,182'},${.5 - k * .1})`; x.beginPath(); x.arc(px(b.x), pz(b.z), (b.r + k * .45) * 51.2, 0, TAU); x.stroke(); } });
    x.strokeStyle = 'rgba(167,139,250,.5)'; x.lineWidth = 5;
    x.beginPath(); x.arc(px(0), pz(-4), 4.1 * 51.2, Math.PI, TAU); x.stroke();
    x.fillStyle = 'rgba(250,204,21,.85)'; x.font = '800 54px "Space Grotesk",sans-serif'; x.textAlign = 'center'; x.fillText('PULSE', px(0), pz(1.2));
    x.strokeStyle = 'rgba(34,211,238,.8)'; x.lineWidth = 4; x.strokeRect(px(-4.5), pz(-8.5), 9 * 51.2, 1.2 * 51.2);
    for (let i = 0; i < 6; i++) { x.fillStyle = `hsla(${180 + i * 30},90%,60%,.7)`; x.beginPath(); x.moveTo(px(-1.5 + i * .6), pz(3.9)); x.lineTo(px(-1.2 + i * .6), pz(4.4)); x.lineTo(px(-1.8 + i * .6), pz(4.4)); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  const field = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 17.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({map: fieldTex(), roughness: .25, metalness: .15}));
  field.position.set(0, 0, -.5); field.receiveShadow = true; scene.add(field);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.2, 19), new THREE.MeshStandardMaterial({color: 0x120a24, roughness: .5, metalness: .4}));
  cab.position.set(0, -.65, -.5); scene.add(cab);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: 0x0a0618, roughness: .6, metalness: .3})); floor.position.y = -1.3; scene.add(floor);

  walls.forEach(w => {
    const L = Math.hypot(w.bx - w.ax, w.bz - w.az), m = new THREE.Mesh(new THREE.BoxGeometry(L + .12, .5, .16), new THREE.MeshStandardMaterial({color: 0x15163a, emissive: w.col, emissiveIntensity: .7, roughness: .3, metalness: .4}));
    m.position.set((w.ax + w.bx) / 2, .25, (w.az + w.bz) / 2); m.rotation.y = -Math.atan2(w.bz - w.az, w.bx - w.ax); m.castShadow = true; scene.add(m);
  });
  const bumpMeshes = bumpers.map(b => {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r * 1.1, .55, 28), new THREE.MeshStandardMaterial({color: 0x1b1340, roughness: .35, metalness: .5}));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(b.r * .72, b.r * .72, .12, 28), new THREE.MeshStandardMaterial({color: b.col, emissive: b.col, emissiveIntensity: .5, roughness: .2}));
    cap.position.y = .32; const rng = new THREE.Mesh(new THREE.TorusGeometry(b.r * .95, .05, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({color: b.col})); rng.position.y = .22;
    const l = new THREE.PointLight(b.col, .8, 6); l.position.y = 1; g.add(body, cap, rng, l); g.position.set(b.x, .27, b.z); body.castShadow = true; scene.add(g); b.flash = 0; return {g, cap, l};
  });
  const postMeshes = posts.map(p => { const m = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, .5, 14), new THREE.MeshStandardMaterial({color: 0xe5e7eb, emissive: 0xfb7185, emissiveIntensity: .4, metalness: .6, roughness: .25})); m.position.set(p.x, .25, p.z); m.castShadow = true; scene.add(m); p.flash = 0; return m; });
  const targetMeshes = targets.map((t, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(t.w * 1.9, .55, .22), new THREE.MeshStandardMaterial({color: [0xf472b6, 0xfbbf24, 0x22d3ee][i], emissive: [0xf472b6, 0xfbbf24, 0x22d3ee][i], emissiveIntensity: .6, roughness: .3})); m.position.set(t.x, .27, t.z); m.castShadow = true; scene.add(m); return m; });
  const flipMeshes = [0, 1].map(i => {
    const g = new THREE.Group(), s = i ? -1 : 1, bar = new THREE.Mesh(new THREE.BoxGeometry(FL.len, .36, FL.r * 1.9), new THREE.MeshStandardMaterial({color: 0xfbbf24, emissive: 0x7a4a00, metalness: .5, roughness: .3}));
    bar.position.x = s * FL.len / 2; bar.castShadow = true; const cap = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .4, 16), new THREE.MeshStandardMaterial({color: 0xe5e7eb, metalness: .7, roughness: .2}));
    g.add(bar, cap); g.position.set(PIV[i][0], .3, PIV[i][1]); scene.add(g); return g;
  });
  const plunger = new THREE.Mesh(new THREE.BoxGeometry(.5, .4, 1.2), new THREE.MeshStandardMaterial({color: 0xd1d5db, metalness: .8, roughness: .25})); plunger.position.set(LANE_X, .25, 8.3); scene.add(plunger);

  // backglass
  const glassC = document.createElement('canvas'); glassC.width = 1024; glassC.height = 512; const gx = glassC.getContext('2d');
  const glassTex = new THREE.CanvasTexture(glassC); glassTex.encoding = THREE.sRGBEncoding;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({map: glassTex}));
  glass.position.set(0, 3.1, -10); glass.rotation.x = -.18; scene.add(glass);
  function drawGlass() {
    const g = gx.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#2a0f55'); g.addColorStop(1, '#0a0620'); gx.fillStyle = g; gx.fillRect(0, 0, 1024, 512);
    gx.textAlign = 'center'; gx.shadowColor = '#f472b6'; gx.shadowBlur = 30; gx.fillStyle = '#fff'; gx.font = '800 96px "Space Grotesk",sans-serif'; gx.fillText('PINBALL PULSE', 512, 130);
    gx.shadowColor = '#22d3ee'; gx.fillStyle = '#a5f3fc'; gx.font = '700 150px "JetBrains Mono",monospace'; gx.fillText(String(score).padStart(7, '0'), 512, 330);
    gx.shadowBlur = 14; gx.font = '700 48px "Space Grotesk",sans-serif'; gx.fillStyle = '#fde68a'; gx.fillText(`BALL ${Math.min(3, 4 - balls)}   ·   MULTIPLIER x${multi}`, 512, 440);
    glassTex.needsUpdate = true;
  }

  // ball
  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), new THREE.MeshStandardMaterial({color: 0xf1f5f9, metalness: 1, roughness: .1})); ballMesh.castShadow = true; scene.add(ballMesh);
  S.polish();

  // ---- state ----
  let score = 0, balls = 3, multi = 1, mode = 'idle', power = 0, charging = false, dirty = true, glassT = 0, idleT = 0, resetTargetsAt = 0, T = 0, slowT = 0, drainAt = 0;
  const ball = {x: LANE_X, z: LANE_Z, vx: 0, vz: 0};
  const fl = [{a: FL.rest, w: 0}, {a: FL.rest, w: 0}], keys = {};
  S.status('Hold Space to charge the plunger, release to launch.');

  const add = base => { score += base * multi; dirty = true; S.hud(1, score); };
  function newBall() { Object.assign(ball, {x: LANE_X, z: LANE_Z, vx: 0, vz: 0}); mode = 'ready'; power = 0; ballMesh.visible = true; S.hud(2, balls); dirty = true; S.status('Hold Space (or Launch) to charge the plunger, release to launch.'); }
  function start() { score = 0; balls = 3; multi = 1; targets.forEach(t => { t.down = false; }); S.hud(1, 0); S.hud(3, 'x1'); newBall(); }
  function end() { mode = 'idle'; ballMesh.visible = false; const isNew = S.best(score); S.show('Table over', `Final score ${score.toLocaleString()}${isNew ? ' — new best!' : '.'}`, 'Play again'); }
  function launch() {
    if (mode !== 'ready' || power < .08) { power = 0; return; }
    ball.vz = -(12 + power * 17); ball.vx = 0; mode = 'play'; slowT = 0; S.beep(180 + power * 200, .25, 'sawtooth', .05); power = 0;
  }

  // ---- physics ----
  function hitSeg(ax, az, bx, bz, rad, e, vs) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = ((ball.x - ax) * dx + (ball.z - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cz = az + dz * t; let nx = ball.x - cx, nz = ball.z - cz; const d = Math.hypot(nx, nz);
    if (d >= rad) return 0;
    if (d < 1e-6) { nx = -dz; nz = dx; const l = Math.hypot(nx, nz); nx /= l; nz /= l; } else { nx /= d; nz /= d; }
    ball.x += nx * (rad - d); ball.z += nz * (rad - d);
    const rvx = ball.vx - (vs ? vs[0] * t * Math.sqrt(l2) : 0), rvz = ball.vz - (vs ? vs[1] * t * Math.sqrt(l2) : 0), vn = rvx * nx + rvz * nz;
    if (vn < 0) { ball.vx -= (1 + e) * vn * nx; ball.vz -= (1 + e) * vn * nz; return -vn; }
    return 0;
  }
  function physics(dt) {
    const h = dt / SUB;
    for (let s = 0; s < SUB; s++) {
      // flippers
      for (let i = 0; i < 2; i++) {
        const f = fl[i], want = (i ? (keys.ArrowRight || keys.d || keys.m || keys.R) : (keys.ArrowLeft || keys.a || keys.z || keys.L)) ? FL.up : FL.rest;
        const da = Math.max(-FL.speed * h, Math.min(FL.speed * h, want - f.a)); f.a += da; f.w = da / h;
      }
      ball.vz += G * h; ball.x += ball.vx * h; ball.z += ball.vz * h;
      const sp = Math.hypot(ball.vx, ball.vz); if (sp > MAXV) { ball.vx *= MAXV / sp; ball.vz *= MAXV / sp; }
      walls.forEach(w => { const hit = hitSeg(w.ax, w.az, w.bx, w.bz, BALL_R, w.e); if (hit > 4) S.beep(500 + Math.random() * 100, .03, 'square', .015); });
      bumpers.forEach(b => {
        const dx = ball.x - b.x, dz = ball.z - b.z, d = Math.hypot(dx, dz);
        if (d < BALL_R + b.r) {
          const nx = dx / d, nz = dz / d; ball.x = b.x + nx * (BALL_R + b.r); ball.z = b.z + nz * (BALL_R + b.r);
          const vn = ball.vx * nx + ball.vz * nz, k = Math.max(9.5, -vn * .9 + 6); ball.vx = nx * k + (ball.vx - vn * nx) * .3; ball.vz = nz * k + (ball.vz - vn * nz) * .3;
          b.flash = 1; add(100); S.beep(700 + Math.random() * 300, .09, 'triangle', .05); S.shake(.04);
        }
      });
      posts.forEach(p => {
        const dx = ball.x - p.x, dz = ball.z - p.z, d = Math.hypot(dx, dz);
        if (d < BALL_R + p.r) { const nx = dx / d, nz = dz / d; ball.x = p.x + nx * (BALL_R + p.r); ball.z = p.z + nz * (BALL_R + p.r); const vn = ball.vx * nx + ball.vz * nz; if (vn < 0) { ball.vx -= 1.9 * vn * nx; ball.vz -= 1.9 * vn * nz; } p.flash = 1; add(20); S.beep(1000, .04, 'square', .03); }
      });
      targets.forEach((t, i) => {
        if (t.down) return;
        if (hitSeg(t.x - t.w, t.z, t.x + t.w, t.z, BALL_R + .1, .3) > 1.5) {
          t.down = true; add(250); S.beep(600 + i * 150, .12, 'triangle', .06); S.burst(new THREE.Vector3(t.x, .5, t.z + .3), 0xfbbf24, 14, 3);
          if (targets.every(q => q.down)) { resetTargetsAt = T + 1.1; multi = Math.min(5, multi + 1); S.hud(3, 'x' + multi); add(1500); S.flash('MULTIPLIER x' + multi, 900); S.beep(880, .2, 'triangle'); dirty = true; }
        }
      });
      for (let i = 0; i < 2; i++) {
        const f = fl[i], sg = i ? -1 : 1, ca = Math.cos(f.a), sa = Math.sin(f.a);
        const bx = PIV[i][0] + sg * ca * FL.len, bz = PIV[i][1] + sa * FL.len;
        const ux = sg * ca, uz = sa, vs = [-sg * sa * f.w, ca * f.w]; // surface velocity per unit length from pivot
        const imp = hitSeg(PIV[i][0], PIV[i][1], bx, bz, BALL_R + FL.r, .35, vs.map(v => v / 1));
        if (imp > 3) S.beep(260, .04, 'square', .03);
      }
    }
  }

  const meter = document.createElement('div');
  meter.style.cssText = 'position:absolute;right:10px;bottom:12px;width:90px;pointer-events:none;font:700 11px "Space Grotesk",sans-serif;color:#fff;text-align:center;opacity:0;transition:opacity .2s;text-shadow:0 1px 3px #000';
  meter.innerHTML = 'LAUNCH<div style="height:9px;margin-top:4px;border-radius:6px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.4);overflow:hidden"><div id="plFill" style="height:100%;width:0;background:linear-gradient(90deg,#22c55e,#facc15,#ef4444)"></div></div>';
  wrap.appendChild(meter); const fill = meter.querySelector('#plFill');

  S.loop(dt => {
    T += dt; idleT += dt;
    if (mode === 'ready') {
      if (charging || keys[' ']) power = Math.min(1, power + dt * 1.1);
      ball.x = LANE_X; ball.z = LANE_Z; ball.vx = ball.vz = 0;
    }
    if (mode === 'play') {
      physics(dt);
      const sp = Math.hypot(ball.vx, ball.vz);
      if (ball.x > 4.3 && ball.z > 6.9 && sp < 1.5) { mode = 'ready'; power = 0; }
      slowT = sp < .35 && ball.z < 7 ? slowT + dt : 0;
      if (slowT > 2.5) { ball.vx += (Math.random() - .5) * 5; ball.vz -= 3; slowT = 0; }
      if (ball.z > 8.2 && ball.x < 4.2 || ball.z > 10 || ball.z < -10.5) {
        mode = 'drain'; drainAt = T + 1.1; balls--; multi = 1; S.hud(3, 'x1'); dirty = true; ballMesh.visible = false; S.beep(110, .5, 'sawtooth', .07); S.shake(.3);
        S.flash(balls > 0 ? 'BALL LOST' : 'GAME OVER', 900);
      }
    }
    if (mode === 'drain' && T > drainAt) { if (balls > 0) newBall(); else end(); }
    if (resetTargetsAt && T > resetTargetsAt) { targets.forEach(t => { t.down = false; }); resetTargetsAt = 0; }

    // visuals
    ballMesh.position.set(ball.x, BALL_R, ball.z); ballMesh.rotation.x += ball.vz * dt / BALL_R; ballMesh.rotation.z -= ball.vx * dt / BALL_R;
    flipMeshes.forEach((g, i) => { g.rotation.y = i ? fl[i].a : -fl[i].a; });
    bumpers.forEach((b, i) => { b.flash = Math.max(0, b.flash - dt * 5); const m = bumpMeshes[i]; m.cap.material.emissiveIntensity = .5 + b.flash * 2; m.g.scale.setScalar(1 + b.flash * .12); m.l.intensity = .8 + b.flash * 3; });
    posts.forEach((p, i) => { p.flash = Math.max(0, p.flash - dt * 5); postMeshes[i].material.emissiveIntensity = .4 + p.flash * 2; });
    targets.forEach((t, i) => { t.y += ((t.down ? -.6 : 0) - t.y) * Math.min(1, dt * 12); targetMeshes[i].position.y = .27 + t.y; });
    plunger.position.z = 8.3 + power * 1.0;
    glassT -= dt; if (dirty && glassT <= 0) { drawGlass(); dirty = false; glassT = .1; }
    const cx = mode === 'play' ? ball.x * .12 : Math.sin(idleT * .3) * .6;
    camera.position.set(cx, 16.2, 15.8); camera.lookAt(0, 0, .5);
    meter.style.opacity = mode === 'ready' ? 1 : 0; fill.style.width = (power * 100) + '%';
  });

  // ---- input ----
  const setKey = (e, v) => {
    const k = e.key.length > 1 ? e.key : e.key.toLowerCase();
    if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'z', 'm'].includes(k)) e.preventDefault();
    if (k === ' ' && !v && keys[' ']) { keys[' '] = false; launch(); return; }
    keys[k] = v;
  };
  document.addEventListener('keydown', e => { if (e.repeat && e.key === ' ') { e.preventDefault(); return; } if (e.key === ' ' && document.activeElement) document.activeElement.blur(); setKey(e, true); });
  document.addEventListener('keyup', e => setKey(e, false));
  S.el.addEventListener('pointerdown', e => { const r = S.el.getBoundingClientRect(); keys[(e.clientX - r.left) < r.width / 2 ? 'L' : 'R'] = true; if (mode === 'ready' && e.clientY - r.top > r.height * .6 && e.clientX - r.left > r.width * .7) charging = true; });
  window.addEventListener('pointerup', () => { keys.L = keys.R = false; if (charging) { charging = false; launch(); } });
  document.getElementById('launchBtn').addEventListener('pointerdown', e => { e.preventDefault(); if (mode === 'ready') charging = true; });

  S.onStart(start);
  S.hud(4, S.bestScore()); S.hud(2, 3); S.hud(3, 'x1'); ballMesh.position.set(LANE_X, BALL_R, LANE_Z);
})();
