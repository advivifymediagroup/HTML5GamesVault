(() => {
  const S = Stage3D({key: 'labyrinth', bg: 0x05030a, fog: [2, 24], fov: 72, bestHud: 4, exposure: 1.25, env: false});
  if (!S) return;
  const {scene, camera, wrap} = S;
  const B = 2.4, WALL_H = 3, EYE = 1.55, PR = .45, LEVELS = 7, TAU = Math.PI * 2;

  scene.add(new THREE.AmbientLight(0x2a2050, .55));
  const torch = new THREE.PointLight(0xffa24d, 2.2, 16, 1.6); scene.add(torch);

  function tex(draw, size, repeat) {
    const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; if (repeat) t.repeat.set(repeat, repeat); return t;
  }
  const brick = tex((x, s) => {
    x.fillStyle = '#4b4350'; x.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const bx = c * 64 + (r % 2 ? 32 : 0), by = r * 32, l = 30 + Math.random() * 22;
      x.fillStyle = `hsl(${268 + Math.random() * 14},${10 + Math.random() * 10}%,${l}%)`; x.fillRect(bx + 2, by + 2, 60, 28);
    }
    for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); }
  }, 256);
  const flagstone = tex((x, s) => {
    x.fillStyle = '#2b2733'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = `hsl(265,8%,${16 + Math.random() * 9}%)`; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  }, 256);
  const wallMat = new THREE.MeshStandardMaterial({map: brick, roughness: .95, metalness: 0});
  const floorMat = new THREE.MeshStandardMaterial({map: flagstone, roughness: .8, metalness: .05});
  const ceilMat = new THREE.MeshStandardMaterial({color: 0x15111c, roughness: 1});

  // ---- overlays: vignette, danger pulse, minimap ----
  const mk = (css, tag) => { const e = document.createElement(tag || 'div'); e.style.cssText = css; wrap.appendChild(e); return e; };
  mk('position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75) 100%)');
  const danger = mk('position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(220,20,20,.65) 100%);transition:opacity .15s');
  const hit = mk('position:absolute;inset:0;pointer-events:none;opacity:0;background:rgba(200,0,0,.55);transition:opacity .5s');
  const mini = mk('position:absolute;top:10px;right:10px;width:124px;height:124px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.55);pointer-events:none', 'canvas');
  mini.width = mini.height = 124; const mctx = mini.getContext('2d');

  // ---- state ----
  let level = 0, lives = 3, grid, W, group, wallInst, relics = [], found = 0, exit, ghost = null, ghostLight, seen, gate, gateLight, start;
  const P = {x: 0, z: 0, yaw: 0, phase: 0}, keys = {}, joy = {mx: 0, mz: 0};
  let mode = 'idle', T = 0, pathT = 0, ghostPath = [], beatT = 0, toLevel = 0;

  // ---- maze ----
  function genMaze(N) {
    W = 2 * N + 1; const g = Array.from({length: W}, () => Array(W).fill(1)), st = [[1, 1]]; g[1][1] = 0;
    while (st.length) {
      const [x, y] = st[st.length - 1];
      const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx > 0 && ny > 0 && nx < W - 1 && ny < W - 1 && g[ny][nx] === 1);
      if (!nb.length) { st.pop(); continue; }
      const [nx, ny, dx, dy] = nb[Math.floor(Math.random() * nb.length)]; g[y + dy / 2][x + dx / 2] = 0; g[ny][nx] = 0; st.push([nx, ny]);
    }
    for (let k = 0; k < N * 1.2; k++) { // knock out a few walls so there are loops
      const x = 1 + Math.floor(Math.random() * (W - 2)), y = 1 + Math.floor(Math.random() * (W - 2));
      if (g[y][x] === 1 && ((x % 2 === 0) !== (y % 2 === 0))) g[y][x] = 0;
    }
    return g;
  }
  function bfs(sx, sy) { // distance map over open blocks
    const d = Array.from({length: W}, () => Array(W).fill(-1)); d[sy][sx] = 0; const q = [[sx, sy]];
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (grid[ny] && grid[ny][nx] === 0 && d[ny][nx] < 0) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); } }); }
    return d;
  }
  const blk = v => Math.round(v / B);
  const wpos = (x, y) => [x * B, y * B];

  function build(lv) {
    if (group) { scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    group = new THREE.Group(); scene.add(group);
    const N = Math.min(15, 5 + 2 * (lv + 1)), g = grid = genMaze(N); seen = new Set();
    const walls = []; for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (g[y][x]) walls.push([x, y]);
    wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(B, WALL_H, B), wallMat, walls.length);
    const m = new THREE.Matrix4(); walls.forEach(([x, y], i) => { m.setPosition(x * B, WALL_H / 2, y * B); wallInst.setMatrixAt(i, m); }); wallInst.frustumCulled = false; group.add(wallInst);
    const size = W * B, floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), floorMat.clone()), ceil = new THREE.Mesh(new THREE.PlaneGeometry(size, size), ceilMat);
    floor.material.map = flagstone.clone(); floor.material.map.needsUpdate = true; floor.material.map.repeat.set(W * 2, W * 2);
    floor.rotation.x = -Math.PI / 2; ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
    floor.position.set((W - 1) * B / 2, 0, (W - 1) * B / 2); ceil.position.copy(floor.position); ceil.position.y = WALL_H; group.add(floor, ceil);

    start = [1, 1]; const d = bfs(1, 1), cells = [];
    for (let y = 1; y < W; y += 2) for (let x = 1; x < W; x += 2) if (d[y][x] > 0) cells.push({x, y, d: d[y][x]});
    cells.sort((a, b) => b.d - a.d); exit = cells[0];
    const pool = cells.slice(1, Math.max(8, Math.floor(cells.length * .7))).sort(() => Math.random() - .5), picks = [];
    for (const c of pool) if (picks.every(p => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) > 6) && Math.abs(c.x - exit.x) + Math.abs(c.y - exit.y) > 4) { picks.push(c); if (picks.length === 3) break; }
    while (picks.length < 3) picks.push(pool[picks.length]);
    relics = picks.map(c => {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(.32), new THREE.MeshStandardMaterial({color: 0x7dd3fc, emissive: 0x38bdf8, roughness: .15}));
      const l = new THREE.PointLight(0x7dd3fc, 1.1, 8, 2); mesh.add(l); mesh.userData.l = l; mesh.position.set(c.x * B, 1.1, c.y * B); group.add(mesh); return {mesh, x: c.x, y: c.y, got: false};
    });
    // gate
    gate = new THREE.Group(); const fm = new THREE.MeshStandardMaterial({color: 0x6b5b7b, roughness: .6});
    [[-1, 0], [1, 0]].forEach(([s]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(.35, 2.6, .35), fm); p.position.set(s * 1.0, 1.3, 0); gate.add(p); });
    const lint = new THREE.Mesh(new THREE.BoxGeometry(2.35, .35, .35), fm); lint.position.y = 2.6; gate.add(lint);
    gate.userData.pane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), new THREE.MeshBasicMaterial({color: 0xdc2626, transparent: true, opacity: .55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false}));
    gate.userData.pane.position.y = 1.25; gate.add(gate.userData.pane);
    gateLight = new THREE.PointLight(0xdc2626, 1.2, 9, 2); gateLight.position.y = 1.5; gate.add(gateLight);
    gate.position.set(exit.x * B, 0, exit.y * B); // orient to the open side
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => g[exit.y + dy] && g[exit.y + dy][exit.x + dx] === 0);
    gate.rotation.y = open && open[0] !== 0 ? Math.PI / 2 : 0; group.add(gate);
    if (ghost) { scene.remove(ghost); ghost = null; }
    P.x = B; P.z = B;
    const o0 = [[1, 0], [0, 1]].find(([dx, dy]) => g[1 + dy][1 + dx] === 0) || [1, 0]; P.yaw = o0[0] ? -Math.PI / 2 : Math.PI;
    found = 0; ghostPath = []; S.polish(); hudSync(); S.status(`Level ${lv + 1}: find the 3 relics, then reach the gate.`);
  }
  const hudSync = () => { S.hud(1, level + 1); S.hud(2, found + '/3'); S.hud(3, '♥'.repeat(Math.max(0, lives))); };

  function spawnGhost() {
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({color: 0xe8f0ff, emissive: 0x6aa0ff, emissiveIntensity: .8, transparent: true, opacity: .78, roughness: .4});
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.18, .52, 1.5, 14, 4, true), mat); body.material.side = THREE.DoubleSide; body.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 14, 10), mat); head.position.y = 1.85;
    [-1, 1].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshBasicMaterial({color: 0x000000})); e.position.set(x * .13, 1.9, -.29); g.add(e); });
    const l = new THREE.PointLight(0x7aa8ff, 1.3, 9, 2); l.position.y = 1.4; g.add(body, head, l);
    const far = bfs(blk(P.x), blk(P.z)); let best = null; for (let y = 1; y < W; y += 2) for (let x = 1; x < W; x += 2) if (!best || far[y][x] > far[best[1]][best[0]]) best = [x, y];
    g.position.set(best[0] * B, 0, best[1] * B); scene.add(g); ghost = g; S.polish(); S.flash('IT HAS AWAKENED', 1200); S.beep(70, .8, 'sawtooth', .07);
  }

  // ---- movement & collision ----
  function collide(nx, nz) {
    const gx = blk(nx), gz = blk(nz);
    for (let y = gz - 1; y <= gz + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) {
      if (!grid[y] || grid[y][x] !== 1) continue;
      const cx = Math.max(x * B - B / 2, Math.min(nx, x * B + B / 2)), cz = Math.max(y * B - B / 2, Math.min(nz, y * B + B / 2));
      const dx = nx - cx, dz = nz - cz, d = Math.hypot(dx, dz);
      if (d < PR) { if (d < 1e-6) { nx += PR; continue; } nx += dx / d * (PR - d); nz += dz / d * (PR - d); }
    }
    return [nx, nz];
  }
  function ghostStep(dt) {
    pathT -= dt;
    const gx = blk(ghost.position.x), gz = blk(ghost.position.z);
    if (pathT <= 0) { // BFS from player to ghost, then walk downhill
      pathT = .35; const d = bfs(blk(P.x), blk(P.z)); ghostPath = [];
      let x = gx, y = gz; for (let i = 0; i < 400 && d[y][x] > 0; i++) { const nxt = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => d[y + dy] && d[y + dy][x + dx] === d[y][x] - 1); if (!nxt) break; x += nxt[0]; y += nxt[1]; ghostPath.push([x, y]); }
    }
    const speed = Math.min(3.4, 1.9 + level * .25), tgt = ghostPath.length ? wpos(...ghostPath[0]) : [P.x, P.z];
    const dx = tgt[0] - ghost.position.x, dz = tgt[1] - ghost.position.z, dd = Math.hypot(dx, dz);
    if (dd < .15 && ghostPath.length) ghostPath.shift();
    else if (dd > 1e-4) { ghost.position.x += dx / dd * Math.min(dd, speed * dt); ghost.position.z += dz / dd * Math.min(dd, speed * dt); }
    ghost.rotation.y = Math.atan2(P.x - ghost.position.x, P.z - ghost.position.z) + Math.PI;
    ghost.position.y = Math.sin(T * 3) * .12;
  }

  function caught() {
    lives--; hudSync(); hit.style.opacity = 1; setTimeout(() => { hit.style.opacity = 0; }, 120); S.beep(90, .5, 'sawtooth', .08); S.shake(.5);
    if (lives <= 0) { mode = 'over'; if (document.pointerLockElement) document.exitPointerLock(); S.best(level); S.show('Lost forever', `The wraith caught you on level ${level + 1}.`, 'Try again'); return; }
    S.flash('CAUGHT!', 900); P.x = B; P.z = B; if (ghost) { const far = bfs(1, 1); let best = [1, 1]; for (let y = 1; y < W; y += 2) for (let x = 1; x < W; x += 2) if (far[y][x] > far[best[1]][best[0]]) best = [x, y]; ghost.position.x = best[0] * B; ghost.position.z = best[1] * B; ghostPath = []; }
  }

  function drawMini() {
    const s = mini.width, cs = s / W; mctx.clearRect(0, 0, s, s);
    seen.forEach(k => { const [x, y] = k.split(',').map(Number); mctx.fillStyle = grid[y][x] ? '#3b3350' : '#9a8fbd'; mctx.fillRect(x * cs, y * cs, cs + .5, cs + .5); });
    relics.forEach(r => { if (!r.got && seen.has(r.x + ',' + r.y)) { mctx.fillStyle = '#7dd3fc'; mctx.fillRect(r.x * cs - 1, r.y * cs - 1, cs + 2, cs + 2); } });
    if (seen.has(exit.x + ',' + exit.y)) { mctx.fillStyle = found === 3 ? '#4ade80' : '#ef4444'; mctx.fillRect(exit.x * cs - 1, exit.y * cs - 1, cs + 2, cs + 2); }
    mctx.save(); mctx.translate(P.x / B * cs + cs / 2, P.z / B * cs + cs / 2); mctx.rotate(-P.yaw); mctx.fillStyle = '#fde68a'; mctx.beginPath(); mctx.moveTo(0, -4); mctx.lineTo(3.2, 3.5); mctx.lineTo(-3.2, 3.5); mctx.fill(); mctx.restore();
  }

  function begin() { level = 0; lives = 3; build(0); mode = 'play'; if (S.el.requestPointerLock) S.el.requestPointerLock(); }

  S.loop(dt => {
    T += dt; if (!grid) return;
    relics.forEach((r, i) => { if (!r.got) { r.mesh.rotation.y += dt * 1.6; r.mesh.position.y = 1.1 + Math.sin(T * 2 + i) * .12; } });
    if (gate) gate.userData.pane.material.opacity = .4 + Math.sin(T * 4) * .15;
    torch.intensity = 2.1 + Math.sin(T * 17) * .18 + Math.sin(T * 7.3) * .12;
    if (mode === 'idle') { P.yaw += dt * .25; }
    if (mode === 'play') {
      const turn = (keys.ArrowRight ? 1 : 0) + (keys.e ? 1 : 0) - (keys.ArrowLeft ? 1 : 0) - (keys.q ? 1 : 0);
      P.yaw -= turn * 2.0 * dt;
      const fwd = (keys.w || keys.ArrowUp ? 1 : 0) - (keys.s || keys.ArrowDown ? 1 : 0) + joy.mz, str = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + joy.mx;
      const mag = Math.hypot(fwd, str), sp = mag > 1 ? 3.5 / mag : 3.5 * mag;
      const sx = -Math.sin(P.yaw), sz = -Math.cos(P.yaw);
      let nx = P.x + (sx * fwd + Math.cos(P.yaw) * str) * sp * dt, nz = P.z + (sz * fwd - Math.sin(P.yaw) * str) * sp * dt;
      [nx, nz] = collide(nx, nz); const moved = Math.hypot(nx - P.x, nz - P.z); P.x = nx; P.z = nz; P.phase += moved * 2.6;
      const bx = blk(P.x), bz = blk(P.z);
      for (let y = bz - 2; y <= bz + 2; y++) for (let x = bx - 2; x <= bx + 2; x++) if (grid[y] && grid[y][x] !== undefined) seen.add(x + ',' + y);
      relics.forEach(r => { if (!r.got && Math.hypot(P.x - r.x * B, P.z - r.y * B) < 1.0) { r.got = true; r.mesh.material.visible = false; r.mesh.userData.l.intensity = 0; found++; hudSync(); S.beep(880, .15, 'triangle'); setTimeout(() => S.beep(1320, .25, 'triangle'), 120); S.burst(r.mesh.position, 0x7dd3fc, 30, 4);
        if (found === 1 && !ghost) spawnGhost();
        if (found === 3) { gate.userData.pane.material.color.set(0x22c55e).convertSRGBToLinear(); gateLight.color.set(0x22c55e); S.flash('GATE UNLOCKED', 1100); S.status('The gate is open! Find it before the wraith finds you.'); } else S.flash(`RELIC ${found}/3`, 800); } });
      if (found === 3 && Math.hypot(P.x - exit.x * B, P.z - exit.y * B) < 1.1) {
        level++; S.beep(660, .2, 'triangle'); if (level >= LEVELS) { mode = 'over'; if (document.pointerLockElement) document.exitPointerLock(); S.best(LEVELS); S.show('You escaped!', `All ${LEVELS} labyrinths conquered with ${lives} ${lives === 1 ? 'life' : 'lives'} left.`, 'Play again'); }
        else { S.best(level); S.flash('LEVEL ' + (level + 1), 1000); build(level); }
      }
      if (ghost) {
        ghostStep(dt); const gd = Math.hypot(P.x - ghost.position.x, P.z - ghost.position.z);
        danger.style.opacity = Math.max(0, Math.min(1, (9 - gd) / 7));
        beatT -= dt; if (gd < 9 && beatT <= 0) { beatT = .35 + gd * .09; S.beep(60, .12, 'sine', .08); }
        if (gd < .95) caught();
      } else danger.style.opacity = 0;
    }
    camera.position.set(P.x, EYE + Math.sin(P.phase) * .04, P.z); camera.rotation.order = 'YXZ'; camera.rotation.set(0, P.yaw, 0);
    torch.position.set(P.x - Math.sin(P.yaw) * .3, EYE + .15, P.z - Math.cos(P.yaw) * .3);
    if (mode !== 'idle') drawMini();
  });

  // ---- input ----
  const setKey = (e, v) => { const k = e.key.length > 1 ? e.key : e.key.toLowerCase(); keys[k] = v; if (k.startsWith('Arrow')) e.preventDefault(); };
  document.addEventListener('keydown', e => setKey(e, true)); document.addEventListener('keyup', e => setKey(e, false));
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === S.el && mode === 'play') P.yaw -= e.movementX * .0023; });
  S.el.addEventListener('click', () => { if (mode === 'play' && S.el.requestPointerLock && document.pointerLockElement !== S.el) S.el.requestPointerLock(); });
  let look = null; const touches = {};
  S.el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { look = e.clientX; return; } const r = S.el.getBoundingClientRect(); touches[e.pointerId] = {x: e.clientX, y: e.clientY, left: e.clientX - r.left < r.width / 2}; });
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { if (look != null && document.pointerLockElement !== S.el && mode === 'play') { P.yaw -= (e.clientX - look) * .005; look = e.clientX; } return; }
    const t = touches[e.pointerId]; if (!t || mode !== 'play') return;
    if (t.left) { joy.mx = Math.max(-1, Math.min(1, (e.clientX - t.x) / 50)); joy.mz = Math.max(-1, Math.min(1, -(e.clientY - t.y) / 50)); }
    else { P.yaw -= (e.clientX - t.x) * .008; t.x = e.clientX; }
  });
  window.addEventListener('pointerup', e => { look = null; const t = touches[e.pointerId]; if (t && t.left) joy.mx = joy.mz = 0; delete touches[e.pointerId]; });

  S.onStart(begin);
  S.hud(4, S.bestScore()); build(0); mode = 'idle'; S.hud(3, '♥♥♥');
  S.show('Lost Labyrinth', 'Find the relics, unlock the gate, outrun the wraith. Click the view to capture the mouse.', 'Enter the maze');
})();
