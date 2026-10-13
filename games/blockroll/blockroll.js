(() => {
  const S = Stage3D({key: 'blockroll', bg: 0x0a0722, sky: ['#3b1a7a', '#150b3a', '#07041a'], fog: [18, 55], fov: 45, bestHud: 4, exposure: 1.05});
  if (!S) return;
  const {scene, camera} = S;

  // '#' tile  'F' fragile (breaks if the block stands on it)  'S' start  'G' goal hole  '.' void
  const MAPS = [
    ['.S##....', '.###....', '.####...', '..#####.', '...###G.'],
    ['S###....', '####....', '..####..', '...####.', '....##G.'],
    ['..###....', '..S####..', '..######.', '###..###.', '###...#..', '###...G..'],
    ['.####...', '.#S##...', '.####...', '..FF##..', '...####.', '....##G.'],
    ['..###...', '.##S##..', '.#####..', '..F#F...', '.##F###.', '.####G#.'],
    ['S##.....', '###F....', '.####...', '..F####.', '...####G'],
    ['...S#....', '...##....', '..#######', '..####...', '...F#G...', '...#F....'],
    ['.###.....', '.S##F....', '.#F###F#F', '..##..###', '####..#G#', '.........']
  ];
  const parse = rows => {
    const t = new Map(); let s, g;
    rows.forEach((r, z) => [...r].forEach((c, x) => {
      if (c === '.') return;
      t.set(x + ',' + z, c === 'F' ? 'F' : c === 'G' ? 'G' : '#');
      if (c === 'S') s = {x, z, o: 0};
      if (c === 'G') g = {x, z};
    }));
    return {tiles: t, start: s, goal: g, w: rows[0].length, h: rows.length};
  };
  const cellsOf = s => s.o === 0 ? [[s.x, s.z]] : s.o === 1 ? [[s.x, s.z], [s.x + 1, s.z]] : [[s.x, s.z], [s.x, s.z + 1]];
  function roll(s, dx, dz) {
    if (s.o === 0) return dx ? {x: s.x + (dx > 0 ? 1 : -2), z: s.z, o: 1} : {x: s.x, z: s.z + (dz > 0 ? 1 : -2), o: 2};
    if (s.o === 1) return dx ? {x: s.x + (dx > 0 ? 2 : -1), z: s.z, o: 0} : {x: s.x, z: s.z + dz, o: 1};
    return dz ? {x: s.x, z: s.z + (dz > 0 ? 2 : -1), o: 0} : {x: s.x + dx, z: s.z, o: 2};
  }
  // 'ok' | 'fall' | 'win'
  function verdict(lv, s) {
    const cs = cellsOf(s);
    for (const [x, z] of cs) if (!lv.tiles.has(x + ',' + z)) return 'fall';
    if (s.o === 0) { const t = lv.tiles.get(s.x + ',' + s.z); if (t === 'F') return 'fall'; if (t === 'G') return 'win'; }
    return 'ok';
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function solve(lv) { // BFS -> min moves or -1
    const key = s => s.x + ',' + s.z + ',' + s.o, seen = new Set([key(lv.start)]);
    let q = [lv.start], d = 0;
    while (q.length) {
      const nq = []; d++;
      for (const s of q) for (const [dx, dz] of DIRS) {
        const n = roll(s, dx, dz), v = verdict(lv, n);
        if (v === 'win') return d;
        if (v === 'ok' && !seen.has(key(n))) { seen.add(key(n)); nq.push(n); }
      }
      q = nq;
    }
    return -1;
  }

  // ---- world ----
  scene.add(new THREE.AmbientLight(0x8a7bd8, .55));
  const sun = new THREE.DirectionalLight(0xffffff, .95); sun.position.set(5, 12, 7); scene.add(sun);
  const rim = new THREE.PointLight(0xff6bd6, .9, 30); rim.position.set(-8, 4, -6); scene.add(rim);
  const sp = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) { const a = Math.random() * 6.28, r = 40 + Math.random() * 60; sp.set([Math.cos(a) * r, (Math.random() - .5) * 90, Math.sin(a) * r - 20], i * 3); }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sgeo, new THREE.PointsMaterial({color: 0xffffff, size: 1, sizeAttenuation: false, transparent: true, opacity: .7})));
  const shards = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(.4 + Math.random() * .8), new THREE.MeshStandardMaterial({color: [0x7c3aed, 0x22d3ee, 0xf472b6][i % 3], roughness: .3, metalness: .4, emissive: 0x111133}));
    const a = Math.random() * 6.28, r = 12 + Math.random() * 14; m.position.set(Math.cos(a) * r, -3 - Math.random() * 12, Math.sin(a) * r - 4);
    m.userData.s = Math.random() + .3; scene.add(m); shards.push(m);
  }

  const levelG = new THREE.Group(); scene.add(levelG);
  const block = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0xfbbf24, roughness: .28, metalness: .35, emissive: 0x4a2a00}));
  block.add(new THREE.LineSegments(new THREE.EdgesGeometry(block.geometry), new THREE.LineBasicMaterial({color: 0xfff1c2})));
  scene.add(block);

  let lv, li = 0, tiles = [], st, moves = 0, falls = 0, mode = 'idle', t0 = 0, T = 0, anim = null, queued = null, fallV = 0, center = new THREE.Vector3(), dist = 12;
  const ease = t => t * t * (3 - 2 * t);
  const dims = o => o === 0 ? [1, 2, 1] : o === 1 ? [2, 1, 1] : [1, 1, 2];
  const centerOf = s => s.o === 0 ? [s.x, 1, s.z] : s.o === 1 ? [s.x + .5, .5, s.z] : [s.x, .5, s.z + .5];
  function place(s) {
    const [cx, cy, cz] = centerOf(s), d = dims(s.o);
    block.scale.set(...d); block.position.set(cx, cy, cz); block.quaternion.identity();
  }

  function build(i) {
    levelG.children.slice().forEach(o => { levelG.remove(o); o.traverse(m => m.geometry && m.geometry.dispose()); });
    tiles = []; lv = parse(MAPS[i]); st = {...lv.start}; moves = 0; mode = 'drop'; t0 = T; anim = queued = null;
    lv.tiles.forEach((type, k) => {
      const [x, z] = k.split(',').map(Number), g = new THREE.Group();
      const col = type === 'F' ? 0xe0801a : ((x + z) % 2 ? 0x3d4a98 : 0x4a58aa);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(.96, .3, .96), new THREE.MeshStandardMaterial({color: col, roughness: .5, metalness: .2, emissive: type === 'F' ? 0x4a2200 : 0x0a0f2e}));
      slab.position.y = -.15; g.add(slab);
      if (type === 'G') {
        const hole = new THREE.Mesh(new THREE.BoxGeometry(.7, .32, .7), new THREE.MeshBasicMaterial({color: 0x000000})); hole.position.y = -.15; g.add(hole);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.42, .05, 8, 28), new THREE.MeshStandardMaterial({color: 0x4ade80, emissive: 0x22c55e}));
        ring.rotation.x = Math.PI / 2; ring.position.y = .02; g.add(ring); g.userData.ring = ring;
      }
      if (type === 'F') slab.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({color: 0xffd08a})));
      g.position.set(x, -14, z); g.userData = {...g.userData, x, z, type, delay: (x + z) * .05 + Math.random() * .12, fall: 0};
      levelG.add(g); tiles.push(g);
    });
    center.set((lv.w - 1) / 2, 0, (lv.h - 1) / 2); dist = Math.max(lv.w, lv.h) * 1.15 + 5;
    S.polish(); S.hud(1, i + 1); S.hud(2, 0); S.hud(3, falls);
    place(st); block.position.y += 14; block.visible = true;
  }

  function start() { li = 0; falls = 0; build(0); S.status('Roll the block to the glowing hole and finish standing up.'); }
  function restart() { falls++; build(li); }

  function tryMove(dx, dz) {
    if (mode !== 'play') { if (mode === 'roll') queued = [dx, dz]; return; }
    const n = roll(st, dx, dz), bx0 = st.x - .5, bx1 = st.x + (st.o === 1 ? 1 : 0) + .5, bz0 = st.z - .5, bz1 = st.z + (st.o === 2 ? 1 : 0) + .5;
    const pivot = new THREE.Vector3(dx > 0 ? bx1 : bx0, 0, dz > 0 ? bz1 : bz0);
    if (dx) pivot.z = (bz0 + bz1) / 2; else pivot.x = (bx0 + bx1) / 2;
    const axis = dx ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), ang = dx ? (dx > 0 ? -1 : 1) * Math.PI / 2 : (dz > 0 ? 1 : -1) * Math.PI / 2;
    anim = {n, pivot, axis, ang, c0: block.position.clone(), t: 0, dims: dims(st.o)}; mode = 'roll'; moves++; S.hud(2, moves); S.beep(220 + (moves % 4) * 30, .05, 'square', .03);
  }

  function finishRoll() {
    st = anim.n; place(st); anim = null;
    const v = verdict(lv, st);
    S.beep(150, .06, 'triangle', .05); S.shake(.05);
    if (v === 'win') { mode = 'win'; t0 = T; S.flash('LEVEL CLEAR', 900); S.burst(block.position, 0x4ade80, 40, 5); S.beep(660, .15, 'triangle'); setTimeout(() => S.beep(990, .25, 'triangle'), 150); S.best(li + 1); }
    else if (v === 'fall') {
      mode = 'fall'; t0 = T; fallV = 0; S.beep(100, .4, 'sawtooth', .05); S.shake(.3);
      if (st.o === 0) { const tl = tiles.find(q => q.userData.x === st.x && q.userData.z === st.z); if (tl && tl.userData.type === 'F') tl.userData.fall = 1; }
    } else {
      mode = 'play';
      if (queued) { const [dx, dz] = queued; queued = null; tryMove(dx, dz); }
    }
  }

  S.loop(dt => {
    T += dt;
    const ang = T * .15, camR = dist;
    camera.position.set(center.x + Math.sin(ang) * 2.2, dist * .78, center.z + camR * .72);
    camera.lookAt(center.x, -.5, center.z - .3);
    shards.forEach(m => { m.rotation.x += dt * m.userData.s; m.rotation.y += dt * .6 * m.userData.s; });
    if (!lv) return;
    const lt = T - t0;
    tiles.forEach(g => {
      const u = g.userData;
      let y = 0;
      if (mode === 'drop' || (lt < 1.5 && mode === 'play')) y = -14 * Math.pow(1 - Math.min(1, Math.max(0, (lt - u.delay) / .55)), 3);
      if (u.fall) { u.fall += dt * 4; y -= u.fall * u.fall * .8; }
      if (mode === 'win' && lt > .9) { const k = lt - .9 - u.delay * .4; if (k > 0) y -= k * k * 14; }
      g.position.y = y;
      if (u.ring) u.ring.rotation.z += dt * 2;
    });

    if (mode === 'drop') {
      const k = Math.min(1, Math.max(0, (lt - .6) / .6)); place(st); block.position.y += 14 * Math.pow(1 - k, 3);
      if (lt > 1.25) { mode = 'play'; place(st); }
    } else if (mode === 'roll') {
      anim.t = Math.min(1, anim.t + dt / .2);
      const q = new THREE.Quaternion().setFromAxisAngle(anim.axis, anim.ang * ease(anim.t));
      block.scale.set(...anim.dims);
      block.position.copy(anim.c0).sub(anim.pivot).applyQuaternion(q).add(anim.pivot); block.quaternion.copy(q);
      if (anim.t >= 1) finishRoll();
    } else if (mode === 'fall') {
      fallV += dt * 22; block.position.y -= fallV * dt; block.rotation.z += dt * 2.2; block.rotation.x += dt * 1.4;
      if (lt > 1.1) { S.flash('FELL!', 500); restart(); }
    } else if (mode === 'win') {
      if (lt < .5) block.position.y -= dt * 3.2;
      block.rotation.y += dt * 4;
      if (lt > 1.9) { if (++li >= MAPS.length) { mode = 'idle'; S.show('All levels cleared!', `Finished ${MAPS.length} levels with ${falls} falls. Nice rolling!`, 'Play again'); } else build(li); }
    }
  });

  const KEYS = {ArrowRight: [1, 0], d: [1, 0], ArrowLeft: [-1, 0], a: [-1, 0], ArrowDown: [0, 1], s: [0, 1], ArrowUp: [0, -1], w: [0, -1]};
  document.addEventListener('keydown', e => {
    const k = KEYS[e.key.length > 1 ? e.key : e.key.toLowerCase()];
    if (k) { e.preventDefault(); tryMove(...k); } else if (e.key.toLowerCase() === 'r' && lv && (mode === 'play' || mode === 'roll')) restart();
  });
  let sx, sy;
  S.el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  S.el.addEventListener('pointerup', e => {
    if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    Math.abs(dx) > Math.abs(dy) ? tryMove(dx > 0 ? 1 : -1, 0) : tryMove(0, dy > 0 ? 1 : -1);
  });

  S.onStart(start);
  S.hud(4, S.bestScore());
  build(0); mode = 'idle';
})();
