(() => {
  const S = Stage3D({key: 'neontunnel', bg: 0x07041a, fog: [25, 150], fov: 72, bestHud: 4, exposure: 1.1});
  if (!S) return;
  const {scene, camera} = S;
  const R = 5, SHIP_R = R - 1.0, SPACING = 26, FAR = -160, TURN = 3.1;
  const TAU = Math.PI * 2;
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  // ---- tunnel wall: scrolling neon grid ----
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#0a0620'; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = '#8b5cf6'; c.lineWidth = 5; c.strokeRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(34,211,238,.45)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(128, 128); c.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.encoding = THREE.sRGBEncoding;
  tex.repeat.set(16, 200); tex.anisotropy = 4;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R + .15, R + .15, 400, 48, 1, true).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({map: tex, side: THREE.BackSide}));
  tube.position.z = -170; scene.add(tube);

  // ---- speed streaks ----
  const N = 260, sp = new Float32Array(N * 3);
  const place = (i, z) => { const a = Math.random() * TAU, r = 1 + Math.random() * (R - 1.6); sp.set([Math.cos(a) * r, Math.sin(a) * r, z], i * 3); };
  for (let i = 0; i < N; i++) place(i, FAR * Math.random());
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const streaks = new THREE.Points(sg, new THREE.PointsMaterial({color: 0x9be7ff, size: .12, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false}));
  streaks.frustumCulled = false; scene.add(streaks);

  // ---- ship ----
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.5, 5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({color: 0xe0f2fe, metalness: .6, roughness: .25, emissive: 0x0b4a6f}));
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, .07, .55), new THREE.MeshStandardMaterial({color: 0x22d3ee, metalness: .5, roughness: .3, emissive: 0x0e7490}));
  wing.position.z = .35;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshBasicMaterial({color: 0x67e8f9, transparent: true, opacity: .9, blending: THREE.AdditiveBlending}));
  glow.position.z = .85;
  const engine = new THREE.PointLight(0x22d3ee, 1.4, 16); engine.position.set(0, .5, .8);
  ship.add(hull, wing, glow, engine); ship.scale.setScalar(1.3); scene.add(ship);
  scene.add(new THREE.AmbientLight(0x6d5bd0, .5));

  // ---- gates & orbs ----
  const gates = [], orbs = [];
  const orbGeo = new THREE.SphereGeometry(.34, 16, 12);
  let gateIdx = 0, lastGap = 0;
  let theta = -Math.PI / 2, camTheta = theta, omega = 0;
  let playing = false, dist = 0, orbCount = 0, shields = 3, invuln = 0, speed = 14, t = 0;
  const keys = {};

  function spawnGate(z) {
    const half = Math.max(.5, 1.2 - dist / 2500);
    const maxShift = Math.min(2.2, TURN * (SPACING / Math.max(speed, 30)) * .7);
    lastGap += (Math.random() * 2 - 1) * maxShift;
    const a0 = lastGap + half, a1 = lastGap - half + TAU;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, R + .2, a0, a1, false); shape.absarc(0, 0, R - 3.4, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(shape, {depth: .8, bevelEnabled: false, curveSegments: 28});
    const col = new THREE.Color().setHSL((gateIdx++ * .08) % 1, .9, .55);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color: col, emissive: col.clone().multiplyScalar(.3), roughness: .4, metalness: .3}));
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({color: 0xffffff})));
    const gs = new THREE.Shape(); gs.absarc(0, 0, R + .2, lastGap - half, lastGap + half, false); gs.absarc(0, 0, R - 3.4, lastGap + half, lastGap - half, true);
    const gapGeo = new THREE.ShapeGeometry(gs, 20), glowCol = new THREE.Color(0x67e8f9);
    const glow = new THREE.Mesh(gapGeo, new THREE.MeshBasicMaterial({color: glowCol, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    glow.position.z = .4; mesh.add(glow);
    mesh.position.z = z; scene.add(mesh);
    gates.push({mesh, geo, gapGeo, gap: lastGap, half, hit: false});
    if (Math.random() < .8) {
      const om = new THREE.Mesh(orbGeo, new THREE.MeshStandardMaterial({color: 0xfbbf24, emissive: 0xf59e0b, roughness: .2}));
      om.position.set(Math.cos(lastGap) * SHIP_R, Math.sin(lastGap) * SHIP_R, z + 9); scene.add(om);
      orbs.push({mesh: om, gap: lastGap});
    }
    S.polish();
  }

  function dropGate(g) { scene.remove(g.mesh); g.geo.dispose(); g.gapGeo.dispose(); g.mesh.material.dispose(); }

  function clearWorld() {
    gates.forEach(dropGate);
    orbs.forEach(o => scene.remove(o.mesh));
    gates.length = orbs.length = 0;
  }

  function fill() {
    let z = gates.length ? gates[gates.length - 1].mesh.position.z - SPACING : -90;
    while (z > FAR) { spawnGate(z); z -= SPACING; }
  }

  function start() {
    clearWorld(); gateIdx = 0; lastGap = theta; dist = 0; orbCount = 0; shields = 3; invuln = 0; playing = true;
    fill(); S.hud(2, shields); S.hud(1, 0); S.status('Steer around the tunnel wall. Aim for the gaps.'); S.beep(520, .12, 'triangle');
  }

  function end() {
    playing = false;
    const score = Math.floor(dist / 10) + orbCount * 50;
    const isNew = S.best(score);
    S.burst(ship.position, 0xff6b6b, 50, 7); S.shake(.8); S.beep(110, .5, 'sawtooth', .08);
    S.show('Ship destroyed', `Score ${score}${isNew ? ' — new best!' : ''}. Distance ${Math.floor(dist)} · ${orbCount} orbs`, 'Fly again');
  }

  function hit() {
    shields--; invuln = 1.6; S.hud(2, Math.max(0, shields));
    S.shake(.6); S.burst(ship.position, 0xff8a5c, 28, 6); S.beep(150, .25, 'square', .07);
    if (shields <= 0) end();
  }

  S.loop(dt => {
    t += dt;
    speed = playing ? 32 + Math.min(36, dist / 45) : 14;
    const dz = speed * dt;
    if (playing) dist += dz;
    tex.offset.y = (tex.offset.y - dz / 2) % 1;

    // steering
    if (playing) {
      const dir = (keys.ArrowRight || keys.d || keys.holdR ? 1 : 0) - (keys.ArrowLeft || keys.a || keys.holdL ? 1 : 0);
      omega += (dir * TURN - omega) * Math.min(1, dt * 9);
      theta += omega * dt;
    } else {
      const g = gates.find(q => q.mesh.position.z < -4);
      if (g) { const d = angDiff(g.gap, theta); omega = Math.max(-TURN * .6, Math.min(TURN * .6, d * 3)); theta += omega * dt; }
    }
    camTheta += angDiff(theta, camTheta) * Math.min(1, dt * 7);

    // world
    for (let i = gates.length - 1; i >= 0; i--) {
      const g = gates[i], z0 = g.mesh.position.z; g.mesh.position.z += dz;
      const z1 = g.mesh.position.z;
      if (playing && !g.hit && z1 + .8 >= -.4 && z0 <= .4) {
        g.hit = true;
        if (invuln <= 0 && Math.abs(angDiff(theta, g.gap)) > g.half - .13) hit();
      }
      if (z1 > 8) { dropGate(g); gates.splice(i, 1); }
    }
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i]; o.mesh.position.z += dz; o.mesh.rotation.y += dt * 3;
      o.mesh.scale.setScalar(1 + Math.sin(t * 6 + i) * .12);
      if (playing && Math.abs(o.mesh.position.z) < 1.2 && Math.abs(angDiff(theta, o.gap)) < .3) {
        orbCount++; S.burst(o.mesh.position, 0xfbbf24, 20, 4); S.beep(880 + orbCount % 5 * 110, .1, 'triangle');
        if (orbCount % 5 === 0 && shields < 3) { shields++; S.hud(2, shields); S.flash('SHIELD +1', 700); }
        scene.remove(o.mesh); orbs.splice(i, 1);
      } else if (o.mesh.position.z > 8) { scene.remove(o.mesh); orbs.splice(i, 1); }
    }
    if (gates.length && gates[gates.length - 1].mesh.position.z > FAR + SPACING) { spawnGate(FAR); }
    for (let i = 0; i < N; i++) { sp[i * 3 + 2] += dz * 1.15; if (sp[i * 3 + 2] > 8) place(i, FAR); }
    sg.attributes.position.needsUpdate = true;

    // ship + camera
    invuln = Math.max(0, invuln - dt);
    const cx = Math.cos(theta), sy = Math.sin(theta);
    ship.position.set(cx * SHIP_R, sy * SHIP_R, 0);
    ship.rotation.z = theta + Math.PI / 2 - omega * .1;
    ship.visible = invuln <= 0 || Math.floor(t * 14) % 2 === 0;
    const ccx = Math.cos(camTheta), csy = Math.sin(camTheta);
    camera.up.set(-ccx, -csy, 0);
    camera.position.set(ccx * (SHIP_R - 1.5), csy * (SHIP_R - 1.5), 5.4);
    camera.fov += ((62 + speed * .32) - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
    camera.lookAt(ccx * 1.6, csy * 1.6, -30);

    if (playing) { S.hud(1, Math.floor(dist / 10) + orbCount * 50); S.hud(3, Math.round(speed * 3.6)); }
  });

  const setKey = (e, v) => { keys[e.key] = v; keys[e.key.toLowerCase()] = v; if (e.key.startsWith('Arrow')) e.preventDefault(); };
  document.addEventListener('keydown', e => setKey(e, true));
  document.addEventListener('keyup', e => setKey(e, false));
  let dragX = null, startX = 0;
  S.el.addEventListener('pointerdown', e => {
    dragX = startX = e.clientX; const r = S.el.getBoundingClientRect();
    keys.holdR = e.clientX - r.left > r.width / 2; keys.holdL = !keys.holdR;
  });
  window.addEventListener('pointerup', () => { dragX = null; keys.holdL = keys.holdR = false; });
  window.addEventListener('pointermove', e => {
    if (dragX == null || !playing) return;
    if (Math.abs(e.clientX - startX) > 8) { keys.holdL = keys.holdR = false; theta += (e.clientX - dragX) * .011; }
    dragX = e.clientX;
  });

  S.onStart(start);
  S.hud(4, S.bestScore()); S.hud(2, 3); S.hud(3, 0);
  fill();
})();
