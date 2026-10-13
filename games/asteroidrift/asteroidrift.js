(() => {
  const S = Stage3D({key: 'asteroidrift', bg: 0x050514, sky: ['#1b0f4a', '#0a0a2a', '#02020a'], fog: [40, 190], fov: 64, bestHud: 4, exposure: 1.1});
  if (!S) return;
  const {scene, camera} = S;
  const XR = 6.5, YR = 3.6, FAR = -180;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---- backdrop: stars, distant planet, near speed-streaks ----
  scene.add(new THREE.AmbientLight(0x6a6fc0, .65));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.2); sun.position.set(-8, 10, 6); scene.add(sun);
  const bgPts = new Float32Array(700 * 3);
  for (let i = 0; i < 700; i++) { const a = rnd(0, 6.28), u = rnd(-.3, .9), r = 300; bgPts.set([Math.cos(a) * r * Math.sqrt(1 - u * u), u * r, Math.sin(a) * r * Math.sqrt(1 - u * u) - 120], i * 3); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bgPts, 3));
  scene.add(new THREE.Points(bg, new THREE.PointsMaterial({color: 0xffffff, size: 1.3, sizeAttenuation: false, fog: false})));
  const planet = new THREE.Group();
  const pm = new THREE.Mesh(new THREE.SphereGeometry(42, 40, 30), new THREE.MeshStandardMaterial({color: 0x7c3aed, roughness: .8, fog: false}));
  const ring = new THREE.Mesh(new THREE.RingGeometry(58, 80, 80).rotateX(-Math.PI / 2 + .35), new THREE.MeshBasicMaterial({color: 0xc4b5fd, transparent: true, opacity: .35, side: THREE.DoubleSide, fog: false}));
  planet.add(pm, ring); planet.position.set(-90, 38, -330); scene.add(planet);

  const N = 220, sp = new Float32Array(N * 3);
  const place = (i, z) => sp.set([rnd(-22, 22), rnd(-14, 14), z], i * 3);
  for (let i = 0; i < N; i++) place(i, rnd(FAR, 10));
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(Object.assign(new THREE.Points(sg, new THREE.PointsMaterial({color: 0xbfe3ff, size: .1, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false})), {frustumCulled: false}));

  // ---- ship ----
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({color: 0xe2e8f0, metalness: .6, roughness: .25, emissive: 0x0b2540});
  const hull = new THREE.Mesh(new THREE.ConeGeometry(.32, 1.6, 6).rotateX(-Math.PI / 2), hullMat);
  const wings = new THREE.Mesh(new THREE.BoxGeometry(1.7, .06, .7), new THREE.MeshStandardMaterial({color: 0x38bdf8, metalness: .5, roughness: .3, emissive: 0x0b4a7a}));
  wings.position.z = .35;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(.06, .45, .5), hullMat); fin.position.set(0, .25, .5);
  const cock = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 8), new THREE.MeshStandardMaterial({color: 0x7dd3fc, emissive: 0x38bdf8, roughness: .1})); cock.position.set(0, .13, -.1);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), new THREE.MeshBasicMaterial({color: 0x67e8f9, transparent: true, opacity: .9, blending: THREE.AdditiveBlending})); glow.position.z = .85;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.16, 1.2, 8).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({color: 0x38bdf8, transparent: true, opacity: .55, blending: THREE.AdditiveBlending})); flame.position.z = 1.4;
  const engine = new THREE.PointLight(0x38bdf8, 1.4, 14); engine.position.z = 1;
  ship.add(hull, wings, fin, cock, glow, flame, engine); scene.add(ship);

  // ---- state ----
  const rocks = [], pickups = [], rockGeos = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    const bump = new Map(); // same position -> same offset, so faces stay joined
    for (let k = 0; k < p.count; k++) {
      const key = p.getX(k).toFixed(3) + p.getY(k).toFixed(3) + p.getZ(k).toFixed(3);
      if (!bump.has(key)) bump.set(key, 1 + rnd(-.22, .22));
      const s = bump.get(key); p.setXYZ(k, p.getX(k) * s, p.getY(k) * s, p.getZ(k) * s);
    }
    g.computeVertexNormals(); rockGeos.push(g);
  }
  const rockCols = [0x6b6275, 0x7a6a5a, 0x5a5f78, 0x8a7a6e];
  const target = {x: 0, y: 0}, pos = {x: 0, y: 0}, vel = {x: 0, y: 0};
  let playing = false, dist = 0, bonus = 0, shields = 3, invuln = 0, speed = 24, spawnT = 0, pickT = 18, T = 0, boost = false, streak = 0;
  const keys = {};

  function spawnRock(z) {
    const aimed = Math.random() < .35, r = rnd(.6, 2.3);
    const x = aimed ? pos.x + rnd(-1.5, 1.5) : rnd(-XR * 1.5, XR * 1.5), y = aimed ? pos.y + rnd(-1, 1) : rnd(-YR * 1.7, YR * 1.7);
    const m = new THREE.Mesh(rockGeos[Math.floor(Math.random() * rockGeos.length)], new THREE.MeshStandardMaterial({color: rockCols[Math.floor(Math.random() * 4)], roughness: .9, flatShading: true}));
    m.scale.setScalar(r); m.position.set(x, y, z == null ? FAR : z); m.userData = {r, rx: rnd(-1, 1), ry: rnd(-1, 1), passed: false};
    scene.add(m); rocks.push(m); S.polish();
  }
  function spawnPickup() {
    const m = new THREE.Mesh(new THREE.TorusGeometry(.6, .12, 10, 24), new THREE.MeshStandardMaterial({color: 0x38bdf8, emissive: 0x0ea5e9, roughness: .2}));
    m.add(new THREE.PointLight(0x38bdf8, 1, 10));
    m.position.set(rnd(-XR, XR), rnd(-YR, YR), FAR); scene.add(m); pickups.push(m); S.polish();
  }
  const clear = () => { rocks.concat(pickups).forEach(o => scene.remove(o)); rocks.length = pickups.length = 0; };

  function start() {
    clear(); for (let i = 0; i < 18; i++) spawnRock(rnd(-165, -28)); dist = bonus = 0; shields = 3; invuln = 0; spawnT = 0; pickT = 18; streak = 0; pos.x = pos.y = target.x = target.y = 0; playing = true;
    S.hud(2, shields); S.hud(1, 0); S.status('Dodge the rocks. Skim them for bonus points.'); S.beep(520, .12, 'triangle');
  }
  function end() {
    playing = false; const score = Math.floor(dist / 10) + bonus, isNew = S.best(score);
    S.burst(ship.position, 0xff8a5c, 60, 8); S.shake(.9); S.beep(100, .6, 'sawtooth', .08);
    S.show('Hull breached', `You drifted ${score} light units${isNew ? ' — new best!' : '.'}`, 'Fly again');
  }

  S.loop(dt => {
    T += dt; boost = playing && (keys[' '] || keys.shift);
    speed += (((playing ? 24 + Math.min(40, dist / 90) : 12) * (boost ? 1.6 : 1)) - speed) * Math.min(1, dt * 3);
    const dz = speed * dt; if (playing) dist += dz * (boost ? 1.5 : 1);

    // steering
    const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), ky = (keys.ArrowUp || keys.w ? 1 : 0) - (keys.ArrowDown || keys.s ? 1 : 0);
    if (kx || ky) { target.x += kx * 11 * dt; target.y += ky * 8 * dt; }
    if (!playing) { target.x = Math.sin(T * .7) * 3; target.y = Math.cos(T * .9) * 1.6; }
    target.x = Math.max(-XR, Math.min(XR, target.x)); target.y = Math.max(-YR, Math.min(YR, target.y));
    const px = pos.x, py = pos.y;
    pos.x += (target.x - pos.x) * Math.min(1, dt * 7); pos.y += (target.y - pos.y) * Math.min(1, dt * 7);
    vel.x = (pos.x - px) / dt; vel.y = (pos.y - py) / dt;
    invuln = Math.max(0, invuln - dt);
    ship.position.set(pos.x, pos.y, 0); ship.rotation.set(vel.y * .035, 0, -vel.x * .055);
    ship.visible = invuln <= 0 || Math.floor(T * 14) % 2 === 0;
    flame.scale.z = (boost ? 2.2 : 1) * (1 + Math.sin(T * 40) * .2); glow.scale.setScalar(1 + Math.sin(T * 30) * .15);
    camera.position.set(pos.x * .65, pos.y * .65 + 1.7, 7.4);
    camera.fov += ((62 + speed * .22) - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
    camera.lookAt(pos.x * .3, pos.y * .3, -30);
    planet.rotation.y += dt * .02;

    // spawning
    if (playing) {
      spawnT -= dt; if (spawnT <= 0) { spawnRock(); spawnT = Math.max(.14, .5 - dist / 4200) * rnd(.6, 1.3); }
      pickT -= dt; if (pickT <= 0) { spawnPickup(); pickT = rnd(16, 26); }
    } else { spawnT -= dt; if (spawnT <= 0) { spawnRock(); spawnT = .9; } }

    // rocks
    for (let i = rocks.length - 1; i >= 0; i--) {
      const m = rocks[i], u = m.userData, z0 = m.position.z; m.position.z += dz; m.rotation.x += u.rx * dt; m.rotation.y += u.ry * dt;
      const d2 = (m.position.x - pos.x) ** 2 + (m.position.y - pos.y) ** 2;
      if (playing && z0 < 1 && m.position.z > -1) { // crossing the ship plane
        if (!u.passed && d2 < (u.r + .55) ** 2 && invuln <= 0) {
          u.passed = true; shields--; invuln = 1.6; streak = 0; S.hud(2, Math.max(0, shields)); S.burst(m.position, 0xffb36b, 30, 6); S.shake(.55); S.beep(140, .3, 'square', .07);
          scene.remove(m); rocks.splice(i, 1); if (shields <= 0) end(); continue;
        }
        if (!u.passed && d2 < (u.r + 1.9) ** 2) { u.passed = true; streak++; const b = 10 + streak * 5; bonus += b; S.flash(streak > 1 ? `CLOSE CALL x${streak}` : 'CLOSE CALL', 450); S.beep(900 + streak * 60, .08, 'triangle'); }
      }
      if (m.position.z > 12) { scene.remove(m); rocks.splice(i, 1); }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const m = pickups[i]; m.position.z += dz; m.rotation.y += dt * 2; m.rotation.x += dt;
      if (playing && Math.abs(m.position.z) < 1.2 && Math.hypot(m.position.x - pos.x, m.position.y - pos.y) < 1.3) {
        if (shields < 5) { shields++; S.hud(2, shields); S.flash('SHIELD +1', 600); } else bonus += 50;
        S.burst(m.position, 0x38bdf8, 24, 5); S.beep(700, .1, 'triangle'); setTimeout(() => S.beep(1000, .15, 'triangle'), 90); scene.remove(m); pickups.splice(i, 1);
      } else if (m.position.z > 12) { scene.remove(m); pickups.splice(i, 1); }
    }
    for (let i = 0; i < N; i++) { sp[i * 3 + 2] += dz * 1.1; if (sp[i * 3 + 2] > 10) place(i, FAR); }
    sg.attributes.position.needsUpdate = true;
    if (playing) { S.hud(1, Math.floor(dist / 10) + bonus); S.hud(3, Math.round(speed * 4)); }
  });

  const setKey = (e, v) => { const k = e.key.length > 1 ? e.key : e.key.toLowerCase(); keys[k] = v; if (k.startsWith('Arrow') || k === ' ') e.preventDefault(); };
  document.addEventListener('keydown', e => setKey(e, true)); document.addEventListener('keyup', e => setKey(e, false));
  let down = false;
  const aim = e => { const r = S.el.getBoundingClientRect(); target.x = ((e.clientX - r.left) / r.width * 2 - 1) * XR; target.y = -((e.clientY - r.top) / r.height * 2 - 1) * YR * 1.15; };
  S.el.addEventListener('pointerdown', e => { down = true; if (playing) aim(e); });
  S.el.addEventListener('pointermove', e => { if (playing && (e.pointerType === 'mouse' || down)) aim(e); });
  window.addEventListener('pointerup', () => { down = false; });

  S.onStart(start);
  S.hud(4, S.bestScore()); S.hud(2, 3); S.hud(3, 0);
  for (let i = 0; i < 10; i++) spawnRock(rnd(-165, -28));
})();
