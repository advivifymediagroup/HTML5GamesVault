(() => {
  const S = Stage3D({key: 'orbitslingshot', bg: 0x03030f, fog: [60, 140], fov: 50, bestHud: 4});
  if (!S) return;
  const {scene, camera} = S;
  const DT = 1 / 120, EPS = .8, MAXPULL = 6, POWER = 2.4, GOAL_R = 1.25;

  // body: [x, z, radius, gravity, colour, kind, orbit?]  kind: p planet, s star, h black hole
  const orb = (cx, cz, rad, w, ph) => ({cx, cz, rad, w, ph});
  const LEVELS = [
    {s: [-17, 3], g: [17, 3], b: [[0, -5, 1.4, 70, 0x4ea8ff, 'p']]},
    {s: [-17, 8], g: [17, -8], b: [[-3, 0, 1.6, 90, 0xff9f5a, 'p'], [9, -1, 1.0, 40, 0xc084fc, 'p']]},
    {s: [-17, -8], g: [17, -8], b: [[0, -3, 2.2, 240, 0xffd166, 's']]},
    {s: [-17, 0], g: [17, 0], b: [[-6, -5, 1.3, 70, 0x34d399, 'p'], [-6, 5, 1.3, 70, 0xf472b6, 'p'], [8, 0, 1.8, 110, 0x60a5fa, 'p']]},
    {s: [-17, -9], g: [17, 9], b: [[0, 0, 2, 200, 0xffd166, 's'], [0, 0, 1.1, 60, 0xa78bfa, 'p', orb(0, 0, 8, .55, 0)]]},
    {s: [-17, 9], g: [17, -9], b: [[0, 0, 2.4, 320, 0x000000, 'h'], [-9, 6, 1.2, 60, 0xfb7185, 'p'], [9, -6, 1.2, 60, 0x38bdf8, 'p']]},
    {s: [-17, 0], g: [17, 0], b: [[0, 0, 1.2, 100, 0xf59e0b, 'p', orb(0, 0, 6, .6, 0)], [0, 0, 1.2, 100, 0x22d3ee, 'p', orb(0, 0, 6, .6, Math.PI)]]},
    {s: [-17, -10], g: [17, 10], b: [[-8, -4, 2, 190, 0xffd166, 's'], [8, 5, 2, 280, 0x000000, 'h'], [0, 8, 1.2, 60, 0xc084fc, 'p', orb(0, 8, 3, .8, 0)]]}
  ];

  const pos = (b, t) => b[6] ? [b[6].cx + Math.cos(b[6].ph + b[6].w * t) * b[6].rad, b[6].cz + Math.sin(b[6].ph + b[6].w * t) * b[6].rad] : [b[0], b[1]];
  const killR = b => b[5] === 'h' ? 1.0 : b[2] * .92;

  function acc(lv, x, z, t) {
    let ax = 0, az = 0;
    for (const b of lv.b) {
      const [bx, bz] = pos(b, t), dx = bx - x, dz = bz - z, d2 = dx * dx + dz * dz + EPS, k = b[3] / (d2 * Math.sqrt(d2));
      ax += dx * k; az += dz * k;
    }
    return [ax, az];
  }
  // velocity-Verlet step; returns null while flying, else 'win' | 'crash' | 'lost'
  function step(lv, p) {
    const [a0x, a0z] = acc(lv, p.x, p.z, p.t);
    p.x += p.vx * DT + .5 * a0x * DT * DT; p.z += p.vz * DT + .5 * a0z * DT * DT; p.t += DT;
    const [a1x, a1z] = acc(lv, p.x, p.z, p.t);
    p.vx += .5 * (a0x + a1x) * DT; p.vz += .5 * (a0z + a1z) * DT;
    if (Math.hypot(p.x - lv.g[0], p.z - lv.g[1]) < GOAL_R) return 'win';
    for (const b of lv.b) { const [bx, bz] = pos(b, p.t); if (Math.hypot(p.x - bx, p.z - bz) < killR(b)) return 'crash'; }
    if (Math.abs(p.x) > 27 || Math.abs(p.z) > 18) return 'lost';
    return null;
  }
  function simulate(lv, vx, vz, t0) {
    const p = {x: lv.s[0], z: lv.s[1], vx, vz, t: t0 || 0};
    for (let i = 0; i < 2600; i++) { const r = step(lv, p); if (r) return r; }
    return 'lost';
  }

  // ---- scene dressing ----
  const halo = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  })();
  const planetTex = hex => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    const base = new THREE.Color(hex), css = `rgb(${base.r * 255 | 0},${base.g * 255 | 0},${base.b * 255 | 0})`;
    x.fillStyle = css; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 18; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.18)'; x.fillRect(0, Math.random() * 128, 256, 3 + Math.random() * 12); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 128, 8 + Math.random() * 18, 4 + Math.random() * 8, 0, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  };
  const mkHalo = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: halo, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .85}));
    s.scale.set(size, size, 1); return s;
  };
  const starPts = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2, u = Math.random() * .9 + .05, r = 120;
    starPts.set([Math.cos(a) * r * Math.sqrt(1 - u * u), -10 + u * r, Math.sin(a) * r * Math.sqrt(1 - u * u) - 40], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(starPts, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color: 0xffffff, size: .9, sizeAttenuation: false, transparent: true, opacity: .8})));
  scene.add(new THREE.AmbientLight(0x4455aa, .6));

  // spacetime grid that dips under every mass
  const GX = 100, GZ = 70, gridPos = new Float32Array((GX + 1) * (GZ + 1) * 3), idx = [];
  for (let j = 0; j <= GZ; j++) for (let i = 0; i <= GX; i++) {
    const k = j * (GX + 1) + i; gridPos.set([i - GX / 2, 0, j - GZ / 2], k * 3);
    if (i < GX) idx.push(k, k + 1); if (j < GZ) idx.push(k, k + GX + 1);
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gridPos, 3)); gg.setIndex(idx);
  const gridCol = new Float32Array((GX + 1) * (GZ + 1) * 3); gg.setAttribute('color', new THREE.BufferAttribute(gridCol, 3));
  const grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: .75}));
  grid.position.y = -.6; grid.frustumCulled = false; scene.add(grid);
  function warp(t) {
    const a = gg.attributes.position, col = gg.attributes.color, bs = lvl.b.map(b => ({p: pos(b, t), r: b[2], m: b[3]}));
    for (let k = 0; k < a.count; k++) {
      const x = a.getX(k), z = a.getZ(k); let y = 0;
      for (const b of bs) { const dx = x - b.p[0], dz = z - b.p[1]; y -= b.m * .085 / Math.sqrt(dx * dx + dz * dz + b.r * b.r * .6 + 1); }
      y = Math.max(y, -9); a.setY(k, y);
      const w = Math.min(1, -y / 3.2), edge = Math.max(0, 1 - Math.hypot(x, z * 1.4) / 50);
      col.setXYZ(k, Math.pow((.1 + w * .75) * edge, 2.2), Math.pow((.18 + w * .6) * edge, 2.2), Math.pow((.62 + w * .3) * edge, 2.2));
    }
    a.needsUpdate = true; col.needsUpdate = true;
  }

  // ---- per-level objects ----
  const level = new THREE.Group(); scene.add(level);
  const probe = new THREE.Mesh(new THREE.SphereGeometry(.32, 16, 12), new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0x7dd3fc, roughness: .3}));
  probe.add(mkHalo(0x7dd3fc, 2.2)); scene.add(probe);
  const TR = 260, trail = new Float32Array(TR * 3), trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trail, 3));
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({color: 0x7dd3fc, transparent: true, opacity: .8}));
  trailLine.frustumCulled = false; scene.add(trailLine);
  const PR = 90, predPos = new Float32Array(PR * 3), predGeo = new THREE.BufferGeometry();
  predGeo.setAttribute('position', new THREE.BufferAttribute(predPos, 3));
  const pred = new THREE.Points(predGeo, new THREE.PointsMaterial({color: 0xfde68a, size: .22, transparent: true, opacity: .9}));
  pred.frustumCulled = false; scene.add(pred);
  const pullGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const pullLine = new THREE.Line(pullGeo, new THREE.LineBasicMaterial({color: 0xfde68a})); pullLine.visible = false; pullLine.frustumCulled = false; scene.add(pullLine);

  let lvl, li = 0, bodyMeshes = [], goal, rings = [];
  let state = 'idle', p = null, T = 0, shots = 0, total = 0, trailN = 0, pull = null, nextAt = 0;

  function buildLevel(i) {
    level.children.slice().forEach(o => { level.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); });
    lvl = LEVELS[i]; bodyMeshes = []; rings = [];
    lvl.b.forEach(b => {
      const g = new THREE.Group(), r = b[2];
      if (b[5] === 's') {
        g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.MeshBasicMaterial({color: b[4]})), mkHalo(0xffb347, r * 7));
        const l = new THREE.PointLight(0xffd9a0, 2, 40); g.add(l);
      } else if (b[5] === 'h') {
        g.add(new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 24), new THREE.MeshBasicMaterial({color: 0x000000})), mkHalo(0xff7a18, r * 4));
        const disc = new THREE.Mesh(new THREE.RingGeometry(1.3, r * 1.9, 64), new THREE.MeshBasicMaterial({color: 0xff8a2a, side: THREE.DoubleSide, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false}));
        disc.rotation.x = -Math.PI / 2 + .35; g.add(disc); rings.push(disc);
      } else {
        const planet = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), new THREE.MeshStandardMaterial({map: planetTex(b[4]), roughness: .6, metalness: .1}));
        g.add(planet, mkHalo(b[4], r * 4.2)); rings.push(planet);
        if (r > 1.25) { const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 1.9, 48), new THREE.MeshBasicMaterial({color: b[4], side: THREE.DoubleSide, transparent: true, opacity: .35})); rg.rotation.x = -Math.PI / 2 + .5; g.add(rg); }
      }
      g.position.set(...(([x, z]) => [x, r * .3, z])(pos(b, T))); level.add(g); bodyMeshes.push(g);
    });
    goal = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(GOAL_R, .13, 12, 40), new THREE.MeshStandardMaterial({color: 0x4ade80, emissive: 0x22c55e, roughness: .3}));
    ring.rotation.x = Math.PI / 2; goal.add(ring, mkHalo(0x4ade80, 5));
    goal.position.set(lvl.g[0], .3, lvl.g[1]); level.add(goal);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(.7, .06, 8, 32), new THREE.MeshBasicMaterial({color: 0x7dd3fc}));
    pad.rotation.x = Math.PI / 2; pad.position.set(lvl.s[0], 0, lvl.s[1]); level.add(pad);
    S.polish(); S.hud(1, i + 1); S.hud(2, shots);
    resetProbe();
  }
  function resetProbe() {
    p = null; state = 'aim'; trailN = 0; trail.fill(0); trailGeo.attributes.position.needsUpdate = true;
    probe.position.set(lvl.s[0], .3, lvl.s[1]); probe.visible = true; pred.visible = false;
  }

  function start() { li = 0; shots = 0; total = 0; T = 0; S.hud(3, 0); buildLevel(0); S.status('Drag back from the probe, release to launch.'); }
  function fail(msg) {
    S.flash(msg, 800); S.burst(probe.position, 0xff8a5c, 24, 5); S.beep(130, .35, 'sawtooth', .06); S.shake(.4);
    probe.visible = false; state = 'wait'; nextAt = T + .9; pred.visible = false;
  }
  function win() {
    state = 'won'; probe.visible = false; S.burst(goal.position, 0x4ade80, 50, 7); S.flash('WARP!', 900); S.beep(660, .15, 'triangle'); setTimeout(() => S.beep(990, .25, 'triangle'), 150);
    if (S.best(li + 1)) { /* new best level */ }
    nextAt = T + 1.2;
  }

  // ---- input ----
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.3), hit = new THREE.Vector3();
  function worldAt(e) {
    const r = S.el.getBoundingClientRect();
    ray.setFromCamera({x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1}, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit : null;
  }
  function updatePull(e) {
    const w = worldAt(e); if (!w) return;
    let dx = lvl.s[0] - w.x, dz = lvl.s[1] - w.z, L = Math.hypot(dx, dz);
    if (L > MAXPULL) { dx *= MAXPULL / L; dz *= MAXPULL / L; L = MAXPULL; }
    pull = {vx: dx * POWER, vz: dz * POWER, L};
  }
  S.el.addEventListener('pointerdown', e => { if (state !== 'aim') return; S.el.setPointerCapture(e.pointerId); updatePull(e); });
  S.el.addEventListener('pointermove', e => { if (pull && state === 'aim') updatePull(e); });
  const release = () => {
    if (!pull) return;
    const pl = pull; pull = null; pullLine.visible = false;
    if (state === 'aim' && pl.L > .5) { p = {x: lvl.s[0], z: lvl.s[1], vx: pl.vx, vz: pl.vz, t: T, t0: T}; state = 'fly'; shots++; total++; S.hud(2, shots); S.hud(3, total); S.beep(300 + pl.L * 40, .15, 'triangle'); }
  };
  S.el.addEventListener('pointerup', release); S.el.addEventListener('pointercancel', () => { pull = null; pullLine.visible = false; });

  // ---- loop ----
  let acc2 = 0;
  S.loop(dt => {
    T += dt;
    camera.position.set(0, 33, 17); camera.lookAt(0, 0, 1);
    if (!lvl) return;
    bodyMeshes.forEach((m, i) => { const [x, z] = pos(lvl.b[i], T); m.position.x = x; m.position.z = z; m.rotation.y += dt * .3; });
    rings.forEach(r => { r.rotation.z += dt * .5; });
    goal.rotation.y += dt * 1.5; goal.children[0].rotation.z += dt * 2;
    warp(T);

    if (state === 'aim') {
      if (pull) {
        const pts = [new THREE.Vector3(lvl.s[0], .3, lvl.s[1]), new THREE.Vector3(lvl.s[0] - pull.vx / POWER, .3, lvl.s[1] - pull.vz / POWER)];
        pullGeo.setFromPoints(pts); pullLine.visible = true;
        const q = {x: lvl.s[0], z: lvl.s[1], vx: pull.vx, vz: pull.vz, t: T};
        let n = 0, res = null;
        for (let i = 0; i < 90 * 8 && n < PR && !res; i++) { res = step(lvl, q); if (i % 8 === 0) predPos.set([q.x, .3, q.z], n++ * 3); }
        predGeo.setDrawRange(0, n); predGeo.attributes.position.needsUpdate = true; pred.visible = true;
      } else pred.visible = false;
    } else if (state === 'fly') {
      acc2 += dt; let res = null;
      while (acc2 >= DT && !res) { acc2 -= DT; res = step(lvl, p); }
      probe.position.set(p.x, .3, p.z);
      trail.copyWithin(3, 0, (TR - 1) * 3); trail.set([p.x, .3, p.z], 0); trailN = Math.min(TR, trailN + 1);
      trailGeo.setDrawRange(0, trailN); trailGeo.attributes.position.needsUpdate = true;
      if (res === 'win') win();
      else if (res) fail(res === 'crash' ? 'CRASHED' : 'LOST IN SPACE');
      else if (p.t - p.t0 > 40) fail("LOST IN SPACE");
    } else if ((state === 'wait' || state === 'won') && T >= nextAt) {
      if (state === 'won') {
        if (++li >= LEVELS.length) { state = 'idle'; S.show('Galaxy cleared!', `All ${LEVELS.length} systems cleared in ${total} shots. Beat that!`, 'Play again'); return; }
        shots = 0; buildLevel(li);
      } else resetProbe();
    }
  });

  S.onStart(start);
  S.hud(4, S.bestScore()); S.hud(2, 0); S.hud(3, 0); lvl = LEVELS[0]; buildLevel(0); state = 'idle';
})();
