(() => {
  const S = Stage3D({key: 'strikezone', bg: 0x06050f, sky: ['#120a2b', '#06050f'], fog: [14, 46], fov: 38, bestHud: 4, exposure: 1.1});
  if (!S) return;
  const {scene, camera} = S;

  const HW = .8, BALL_R = .2, PIN_R = .1;
  const TUNE = {mBall: 7, rest: .45, pinRest: .5, damp: 3, tipBall: .8, tipPin: .8, tipLoss: .75};
  const START_Z = 4.2, PIN_Z = -8, ROW = .4, SPAC = .46, END_Z = -10.6;

  // ---- scoring ----
  function totalScore(r) {
    let t = 0, i = 0;
    for (let f = 0; f < 10 && i < r.length; f++) {
      if (r[i] === 10) { t += 10 + (r[i + 1] || 0) + (r[i + 2] || 0); i++; }
      else if (i + 1 < r.length && r[i] + r[i + 1] === 10) { t += 10 + (r[i + 2] || 0); i += 2; }
      else { t += r[i] + (r[i + 1] || 0); i += 2; }
    }
    return t;
  }

  // ---- room ----
  scene.add(new THREE.AmbientLight(0x7a6fd0, .5));
  const key = new THREE.DirectionalLight(0xfff0d8, .9); key.position.set(2.5, 7, 3); key.target.position.set(0, 0, -7);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left: -4, right: 4, top: 6, bottom: -6, near: .5, far: 20}); scene.add(key, key.target);
  const spot = new THREE.SpotLight(0xffe2b0, 1.6, 30, .6, .6); spot.position.set(0, 6, -5); spot.target.position.set(0, 0, -8.5); scene.add(spot, spot.target);
  const pink = new THREE.PointLight(0xff3da6, 1.1, 18); pink.position.set(-4, 2.5, -8); scene.add(pink);
  const cyan = new THREE.PointLight(0x22d3ee, 1.1, 18); cyan.position.set(4, 2.5, -8); scene.add(cyan);

  function woodTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const x = c.getContext('2d');
    for (let i = 0; i < 32; i++) { x.fillStyle = `hsl(${30 + (i * 7) % 9},${62 + (i * 5) % 12}%,${54 + (i * 11) % 9}%)`; x.fillRect(i * 8, 0, 8, 1024); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(i * 8, 0, 1, 1024); }
    x.fillStyle = 'rgba(60,25,5,.55)';
    for (let i = 0; i < 7; i++) { const px = 128 + (i - 3) * 30, py = 250 + Math.abs(i - 3) * 46; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 8, py + 34); x.lineTo(px + 8, py + 34); x.fill(); }
    for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(128 + (i - 2) * 38, 120 + r * 60, 3.5, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  const LEN = 17, laneMid = (START_Z + 3 + END_Z) / 2;
  const lane = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, .1, START_Z + 3 - END_Z), new THREE.MeshStandardMaterial({map: woodTex(), roughness: .18, metalness: .1}));
  lane.position.set(0, -.05, laneMid); lane.receiveShadow = true; scene.add(lane);
  [-1, 1].forEach(s => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, START_Z + 3 - END_Z), new THREE.MeshStandardMaterial({color: 0x15151f, roughness: .5, metalness: .3}));
    g.position.set(s * (HW + .15), -.09, laneMid); scene.add(g);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, START_Z + 3 - END_Z), new THREE.MeshBasicMaterial({color: s < 0 ? 0xff3da6 : 0x22d3ee}));
    rail.position.set(s * (HW + .33), .0, laneMid); scene.add(rail);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({color: 0x0b0a18, roughness: .35, metalness: .5}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.2; scene.add(floor);
  const pit = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + .9, 1.6, .2), new THREE.MeshStandardMaterial({color: 0x050508}));
  pit.position.set(0, .6, END_Z - .1); scene.add(pit);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 2.2, 1.1, .3), new THREE.MeshStandardMaterial({color: 0x1b1033, roughness: .5}));
  mask.position.set(0, 3.0, END_Z + .6); scene.add(mask);
  function sign(text, color) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#0b0618'; x.fillRect(0, 0, 512, 128); x.font = '800 70px "Space Grotesk",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = color; x.shadowBlur = 26; x.fillStyle = '#fff'; x.fillText(text, 256, 68); x.fillText(text, 256, 68);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    return new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({map: t}));
  }
  const neon = sign('STRIKE ZONE', '#ff3da6'); neon.position.set(0, 1.95, END_Z + .5); scene.add(neon);
  for (let i = 0; i < 6; i++) { // ceiling light bars
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, .06, .25), new THREE.MeshBasicMaterial({color: i % 2 ? 0x22d3ee : 0xff3da6}));
    b.position.set(0, 4.2, 3 - i * 3.2); scene.add(b);
  }
  [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.BoxGeometry(.2, 5, 24), new THREE.MeshStandardMaterial({color: 0x140a2e, roughness: .6})); w.position.set(s * 4.2, 2.3, -3); scene.add(w); });

  // ---- pins & ball ----
  const profile = [[0, 0], [.055, 0], [.075, .03], [.095, .1], [.1, .17], [.09, .26], [.065, .36], [.05, .42], [.055, .47], [.07, .52], [.07, .56], [.05, .6], [0, .62]].map(([r, y]) => new THREE.Vector2(r, y));
  const pinGeo = new THREE.LatheGeometry(profile, 20), ringGeo = new THREE.TorusGeometry(.068, .009, 6, 20);
  const pinMat = new THREE.MeshStandardMaterial({color: 0xfafafa, roughness: .22, metalness: .05}), stripeMat = new THREE.MeshStandardMaterial({color: 0xe11d48, roughness: .3});
  function makePin() {
    const g = new THREE.Group(), m = new THREE.Mesh(pinGeo, pinMat); m.castShadow = true; g.add(m);
    [.46, .5].forEach(y => { const r = new THREE.Mesh(ringGeo, stripeMat); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); });
    return g;
  }
  const marble = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 128); g.addColorStop(0, '#1d4ed8'); g.addColorStop(.5, '#6d28d9'); g.addColorStop(1, '#0ea5e9'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 3;
    for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(0, Math.random() * 128); x.bezierCurveTo(80, Math.random() * 128, 170, Math.random() * 128, 256, Math.random() * 128); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  })();
  const ballMesh = new THREE.Group(), ballBody = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 24), new THREE.MeshStandardMaterial({map: marble, roughness: .1, metalness: .35}));
  ballBody.castShadow = true; ballMesh.add(ballBody);
  [[.05, .19, .02], [-.05, .19, .02], [0, .17, -.07]].forEach(p => { const h = new THREE.Mesh(new THREE.CircleGeometry(.025, 10), new THREE.MeshBasicMaterial({color: 0x000000})); h.position.set(...p); h.lookAt(0, 0, 0); h.rotateY(Math.PI); ballBody.add(h); });
  scene.add(ballMesh);
  const aimLine = new THREE.Mesh(new THREE.PlaneGeometry(.06, 10).translate(0, 5, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xfde68a, transparent: true, opacity: .55, depthWrite: false}));
  aimLine.position.y = .01; scene.add(aimLine);
  S.polish();
  camera.position.set(0, 1.05, START_Z + 2.7);

  // ---- state ----
  let pins = [], ball = {x: 0, z: START_Z, vx: 0, vz: 0, gutter: false, done: false};
  let phase = 'idle', t = 0, phaseT = 0, posX = 0, aim = 0, power = 0, rolls = [], frame = 0, rollNo = 0, rackFresh = true, rollT = 0, settleT = 0, T = 0, sweepT = 0;

  const meter = document.createElement('div');
  meter.style.cssText = 'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:min(70%,320px);text-align:center;pointer-events:none;font:700 13px "Space Grotesk",sans-serif;color:#fff;text-shadow:0 1px 4px #000';
  meter.innerHTML = '<div id="bzLabel" style="margin-bottom:6px;letter-spacing:.08em">TAP TO LOCK POSITION</div><div style="height:12px;border-radius:8px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);overflow:hidden"><div id="bzFill" style="height:100%;width:0;background:linear-gradient(90deg,#22c55e,#facc15,#ef4444)"></div></div>';
  S.wrap.appendChild(meter);
  const label = meter.querySelector('#bzLabel'), fill = meter.querySelector('#bzFill');

  function rack(keepStanding) {
    pins.forEach(p => scene.remove(p.mesh)); pins = [];
    let k = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++, k++) {
      const m = makePin(), hx = (c - r / 2) * SPAC, hz = PIN_Z - r * ROW;
      m.position.set(hx, 1.2 + Math.random() * .4, hz); scene.add(m);
      pins.push({x: hx, z: hz, vx: 0, vz: 0, down: false, mesh: m, fallT: -1, dir: [0, -1], dropping: true});
    }
    S.polish();
  }
  function clearFallen() { pins = pins.filter(p => { if (p.down) { scene.remove(p.mesh); return false; } return true; }); }

  function newBall() {
    ball = {x: 0, z: START_Z, vx: 0, vz: 0, gutter: false, done: false}; ballMesh.visible = true; ballMesh.rotation.set(0, 0, 0);
    phase = 'pos'; phaseT = 0; label.textContent = '1/3 · TAP TO LOCK POSITION'; fill.style.width = '0%'; aimLine.visible = true;
    S.hud(1, frame + 1); S.hud(2, rollNo + 1); S.hud(3, totalScore(rolls));
    S.status(`Frame ${frame + 1}, roll ${rollNo + 1}. Tap to lock your position.`);
  }

  function start() {
    rolls = []; frame = 0; rollNo = 0; rackFresh = true; rack(); newBall();
  }

  function advance() {
    if (phase === 'pos') { posX = ball.x; phase = 'aim'; phaseT = 0; label.textContent = '2/3 · TAP TO LOCK AIM'; S.beep(500, .06, 'triangle'); }
    else if (phase === 'aim') { aim = aimAngle(phaseT); phase = 'power'; phaseT = 0; label.textContent = '3/3 · TAP FOR POWER'; S.beep(600, .06, 'triangle'); }
    else if (phase === 'power') {
      power = powerAt(phaseT); const sp = 6.5 + power * 8;
      ball.vx = Math.sin(aim) * sp; ball.vz = -Math.cos(aim) * sp; phase = 'roll'; rollT = 0; settleT = 0; aimLine.visible = false;
      label.textContent = ''; fill.style.width = '0%'; S.beep(180, .25, 'sawtooth', .04);
    }
  }
  const aimAngle = tt => .034 * Math.sin(tt * 3.1);
  const powerAt = tt => 1 - Math.abs(Math.sin(tt * 2.2));

  // ---- physics ----
  // elastic-ish circle collision; returns the impact speed (0 if no contact)
  function resolve(a, b, ma, mb, rad, e) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1e-6, nx = dx / d, nz = dz / d;
    if (d >= rad) return 0;
    const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    const over = rad - d, tot = ma + mb;
    a.x -= nx * over * (mb / tot); a.z -= nz * over * (mb / tot); b.x += nx * over * (ma / tot); b.z += nz * over * (ma / tot);
    if (rv >= 0) return 0;
    const j = -(1 + e) * rv / (1 / ma + 1 / mb);
    a.vx -= j * nx / ma; a.vz -= j * nz / ma; b.vx += j * nx / mb; b.vz += j * nz / mb;
    return -rv;
  }
  function topple(p, speed, dx, dz) {
    if (p.down) return;
    p.down = true; p.fallT = T; const l = Math.hypot(dx, dz) || 1; p.dir = [dx / l, dz / l];
    p.vx *= TUNE.tipLoss; p.vz *= TUNE.tipLoss;
    S.beep(300 + Math.random() * 200, .05, 'square', .02);
  }
  function physics(dt) {
    const n = 5, h = dt / n;
    for (let s = 0; s < n; s++) {
      if (!ball.done) {
        ball.x += ball.vx * h; ball.z += ball.vz * h;
        if (!ball.gutter && Math.abs(ball.x) > HW - .02) { ball.gutter = true; ball.vx = 0; S.beep(110, .3, 'sawtooth', .03); }
        if (ball.gutter) ball.x = Math.sign(ball.x || 1) * (HW + .15);
        if (ball.z < END_Z + .25) { ball.done = true; ball.vz = 0; ballMesh.visible = false; }
      }
      for (const p of pins) {
        p.x += p.vx * h; p.z += p.vz * h; const k = Math.max(0, 1 - TUNE.damp * h); p.vx *= k; p.vz *= k;
        if (Math.abs(p.x) > HW + .05 && !p.down) topple(p, 1, p.vx, p.vz);
        if (Math.abs(p.x) > HW + .3) { p.x = Math.sign(p.x) * (HW + .3); p.vx = 0; }
        if (p.z < END_Z + .1) { p.z = END_Z + .1; p.vz = 0; if (!p.down) topple(p, 1, 0, -1); }
        if (!ball.done && !ball.gutter) {
          const imp = resolve(ball, p, TUNE.mBall, 1, BALL_R + PIN_R, TUNE.rest);
          if (imp > TUNE.tipBall) topple(p, imp, p.vx - ball.vx * .05, p.vz - ball.vz * .05);
        }
      }
      for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
        const a = pins[i], b = pins[j], imp = resolve(a, b, 1, 1, PIN_R * 2, TUNE.pinRest);
        if (imp > TUNE.tipPin) { topple(a, imp, a.x - b.x, a.z - b.z); topple(b, imp, b.x - a.x, b.z - a.z); }
      }
    }
  }

  function settled() { return ball.done && pins.every(p => Math.hypot(p.vx, p.vz) < .05); }

  function finishRoll() {
    const knockedNow = pins.filter(p => p.down).length; // pins from earlier rolls were already removed
    rolls.push(knockedNow);
    const isStrike = rackFresh && knockedNow === 10, isSpare = !rackFresh && !isStrike && pins.every(p => p.down) && rollNo >= 1;
    S.hud(3, totalScore(rolls));
    let msg = knockedNow === 0 ? (ball.gutter ? 'GUTTER BALL' : 'MISS') : String(knockedNow);
    if (isStrike) { msg = 'STRIKE!'; S.shake(.5); S.beep(880, .2, 'triangle'); setTimeout(() => S.beep(1175, .3, 'triangle'), 160); S.burst(new THREE.Vector3(0, .8, PIN_Z - .5), 0xfacc15, 60, 7); }
    else if (isSpare) { msg = 'SPARE!'; S.beep(700, .2, 'triangle'); S.burst(new THREE.Vector3(0, .8, PIN_Z - .5), 0x22d3ee, 36, 5); }
    S.flash(msg, 1300); S.status(`Frame ${frame + 1}: ${knockedNow} pin${knockedNow === 1 ? '' : 's'} down.`);

    // decide what comes next
    let resetRack = false, nextFrame = false, over = false;
    const standing = pins.filter(p => !p.down).length;
    if (frame < 9) {
      if (rollNo === 0 && knockedNow < 10) rollNo = 1; else { nextFrame = true; resetRack = true; }
    } else {
      if (rollNo === 0) { rollNo = 1; resetRack = knockedNow === 10; }
      else if (rollNo === 1) {
        const first = rolls[rolls.length - 2], second = knockedNow;
        if (first === 10 || first + second === 10) { rollNo = 2; resetRack = standing === 0; } else over = true;
      } else over = true;
    }
    phase = 'sweep'; sweepT = 0;
    pins.forEach(p => { if (p.down) p.sweep = true; });
    setTimeout(() => {
      if (over) return endGame();
      if (nextFrame) { frame++; rollNo = 0; }
      if (resetRack) { rack(); rackFresh = true; } else { clearFallen(); rackFresh = false; }
      newBall();
    }, 1700);
  }

  function endGame() {
    phase = 'idle'; const sc = totalScore(rolls), isNew = S.best(sc);
    S.show('Game over', `Final score ${sc}${isNew ? ' — new best!' : '.'} ${sc >= 250 ? 'Pro level!' : sc >= 150 ? 'Solid game.' : 'Keep rolling!'}`, 'Bowl again');
  }

  // ---- loop ----
  S.loop(dt => {
    T += dt; t += dt;
    // pins: drop-in, fall animation, sweep
    pins.forEach(p => {
      const m = p.mesh;
      if (p.dropping) { m.position.y = Math.max(0, m.position.y - dt * 5); if (m.position.y <= 0) p.dropping = false; }
      m.position.x = p.x; m.position.z = p.z;
      if (p.down) {
        const a = Math.min(1, (T - p.fallT) / .4) * 1.5;
        m.quaternion.setFromAxisAngle(new THREE.Vector3(p.dir[1], 0, -p.dir[0]), a);
        if (!p.dropping) m.position.y = Math.sin(a) * .1;
        if (p.sweep) { m.position.y -= Math.max(0, sweepT - .7) * 3; }
      }
    });
    if (phase === 'sweep') sweepT += dt;

    meter.style.visibility = phase === 'pos' || phase === 'aim' || phase === 'power' ? 'visible' : 'hidden';
    if (phase === 'pos') { phaseT += dt; ball.x = .62 * Math.sin(phaseT * 2.4); }
    if (phase === 'aim') { phaseT += dt; ball.x = posX; }
    if (phase === 'power') { phaseT += dt; fill.style.width = (powerAt(phaseT) * 100).toFixed(0) + '%'; }
    if (phase === 'pos' || phase === 'aim' || phase === 'power') {
      const a = phase === 'pos' ? 0 : phase === 'aim' ? aimAngle(phaseT) : aim;
      ballMesh.position.set(ball.x, BALL_R, ball.z);
      aimLine.position.set(ball.x, .012, ball.z); aimLine.rotation.y = -a;
    }
    if (phase === 'roll') {
      rollT += dt; physics(dt);
      ballMesh.position.set(ball.x, BALL_R, ball.z); ballMesh.rotation.x -= Math.hypot(ball.vx, ball.vz) * dt / BALL_R;
      if ((settled() && rollT > .8) || rollT > 9) { settleT += dt; if (settleT > .5 || rollT > 9) finishRoll(); } else settleT = 0;
    }

    // camera
    let cx, cy, cz, lx, ly, lz;
    if (phase === 'roll' && !ball.done) {
      cz = Math.max(ball.z + 3.2, PIN_Z + 4.4); cx = ball.x * .35; cy = 1.1 + Math.max(0, (ball.z - PIN_Z) / 14) * .5; lx = ball.x * .2; ly = .3; lz = Math.max(ball.z - 7, PIN_Z - 1);
    } else if (phase === 'roll' || phase === 'sweep') {
      cz = PIN_Z + 4.4; cx = 0; cy = 1.25; lx = 0; ly = .25; lz = PIN_Z - 1;
    } else {
      cz = START_Z + 2.7; cx = ball.x * .5; cy = 1.05; lx = 0; ly = .3; lz = -4.5;
    }
    const k = Math.min(1, dt * 4);
    camera.position.x += (cx - camera.position.x) * k; camera.position.y += (cy - camera.position.y) * k; camera.position.z += (cz - camera.position.z) * k;
    camera.lookAt(lx, ly, lz);
  });

  const press = () => { if (phase === 'pos' || phase === 'aim' || phase === 'power') advance(); };
  document.addEventListener('keydown', e => { if (e.code === 'Space' || e.key === 'Enter') { if (document.activeElement) document.activeElement.blur(); e.preventDefault(); press(); } });
  S.el.addEventListener('pointerdown', press);

  S.onStart(start);
  S.hud(4, S.bestScore()); S.hud(1, 1); S.hud(2, 1);
  rack(); ballMesh.position.set(0, BALL_R, START_Z); aimLine.visible = false;
})();
