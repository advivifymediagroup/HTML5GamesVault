(() => {
  const S = Stage3D({key: 'towerguard', bg: 0xb4d4f5, sky: ['#3f86e0', '#9fcdfb', '#ffe6c2'], fog: [22, 60], fov: 40, bestHud: 4, exposure: .92, envIntensity: .28});
  if (!S) return;
  const {scene, camera, $} = S;
  const COLS = 12, ROWS = 8, WAVES = 15;
  const cellPos = (c, r) => new THREE.Vector3(c - (COLS - 1) / 2, 0, r - (ROWS - 1) / 2);

  // ---- path ----
  const WAY = [[0, 1], [9, 1], [9, 3], [2, 3], [2, 5], [10, 5], [10, 7]];
  const pathCells = [];
  for (let i = 0; i < WAY.length - 1; i++) {
    const [a, b] = [WAY[i], WAY[i + 1]], dc = Math.sign(b[0] - a[0]), dr = Math.sign(b[1] - a[1]);
    for (let c = a[0], r = a[1]; ; c += dc, r += dr) { if (!pathCells.length || pathCells[pathCells.length - 1][0] !== c || pathCells[pathCells.length - 1][1] !== r) pathCells.push([c, r]); if (c === b[0] && r === b[1]) break; }
  }
  const pathSet = new Set(pathCells.map(p => p.join(',')));
  const TREES = ['1,0', '4,0', '7,0', '11,2', '0,4', '5,4', '8,4', '0,7', '4,7', '7,7', '11,0', '6,2'].filter(k => !pathSet.has(k));
  const blocked = new Set(TREES);

  // ---- world ----
  scene.add(new THREE.AmbientLight(0xcfe3ff, .5));
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.05); sun.position.set(-6, 14, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -9, right: 9, top: 7, bottom: -7, near: 1, far: 40}); scene.add(sun);
  const island = new THREE.Mesh(new THREE.BoxGeometry(COLS + 1, 3, ROWS + 1), new THREE.MeshStandardMaterial({color: 0x6b4f3a, roughness: .9}));
  island.position.y = -1.6; scene.add(island);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const isPath = pathSet.has(c + ',' + r), t = new THREE.Mesh(new THREE.BoxGeometry(.98, isPath ? .12 : .2, .98),
      new THREE.MeshStandardMaterial({color: isPath ? 0xcfae72 : ((c + r) % 2 ? 0x4da63a : 0x56b142), roughness: .85}));
    t.position.copy(cellPos(c, r)); t.position.y = isPath ? -.06 : -.1; t.receiveShadow = true; scene.add(t);
  }
  TREES.forEach(k => {
    const [c, r] = k.split(',').map(Number), g = new THREE.Group(), s = .8 + Math.random() * .5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, .3, 6), new THREE.MeshStandardMaterial({color: 0x7a4a24}));
    const top = new THREE.Mesh(new THREE.ConeGeometry(.3, .7, 7), new THREE.MeshStandardMaterial({color: 0x1f8a4c, roughness: .8}));
    trunk.position.y = .15; top.position.y = .6; top.castShadow = trunk.castShadow = true; g.add(trunk, top); g.scale.setScalar(s);
    g.position.copy(cellPos(c, r)); scene.add(g);
  });
  const clouds = [];
  for (let i = 0; i < 7; i++) { // clouds
    const cl = new THREE.Group();
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.8 + Math.random() * .8, 10, 8), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .85})); b.position.set(k * .9, Math.random() * .3, Math.random() * .5); cl.add(b); }
    cl.position.set(-16 + i * 5.5, -4 - Math.random() * 3, -8 + Math.random() * 14); cl.userData.s = .15 + Math.random() * .2; scene.add(cl); clouds.push(cl);
  }
  const portal = new THREE.Mesh(new THREE.TorusGeometry(.5, .08, 10, 28), new THREE.MeshStandardMaterial({color: 0xc084fc, emissive: 0x9333ea}));
  portal.position.copy(cellPos(...pathCells[0])); portal.position.y = .55; portal.rotation.y = Math.PI / 2; scene.add(portal);
  const keep = new THREE.Group();
  const kb = new THREE.Mesh(new THREE.BoxGeometry(.9, .6, .9), new THREE.MeshStandardMaterial({color: 0xcbd5e1, roughness: .6})); kb.position.y = .3;
  [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]].forEach(([x, z]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .9, 8), new THREE.MeshStandardMaterial({color: 0xe2e8f0})); t.position.set(x, .45, z); const cn = new THREE.Mesh(new THREE.ConeGeometry(.2, .3, 8), new THREE.MeshStandardMaterial({color: 0xdc2626})); cn.position.set(x, 1.05, z); keep.add(t, cn); });
  keep.add(kb); keep.position.copy(cellPos(...pathCells[pathCells.length - 1])); keep.position.y = 0; scene.add(keep);
  keep.traverse(o => { o.castShadow = true; });
  const hoverBox = new THREE.Mesh(new THREE.BoxGeometry(.98, .06, .98), new THREE.MeshBasicMaterial({color: 0x4ade80, transparent: true, opacity: .55})); hoverBox.visible = false; hoverBox.material.__sk = true; scene.add(hoverBox);
  const rangeRing = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: .6, side: THREE.DoubleSide})); rangeRing.visible = false; scene.add(rangeRing);

  // ---- definitions ----
  const TOWER = {
    cannon: {name: 'Cannon', cost: 50, dmg: 12, rate: .7, range: 2.8, color: 0x9ca3af},
    frost: {name: 'Frost', cost: 70, dmg: 5, rate: 1.0, range: 2.4, color: 0x7dd3fc},
    laser: {name: 'Laser', cost: 110, dmg: 21, rate: 0, range: 3.1, color: 0xe879f9}
  };
  const ENEMY = {
    grunt: {hp: 48, speed: 1.1, reward: 7, dmg: 1, gap: .85},
    runner: {hp: 30, speed: 2.1, reward: 6, dmg: 1, gap: .45},
    brute: {hp: 230, speed: .75, reward: 18, dmg: 3, gap: 1.2},
    boss: {hp: 1700, speed: .6, reward: 110, dmg: 10, gap: 2}
  };
  const upCost = t => Math.round(TOWER[t.type].cost * .8 * t.lvl);
  const dmgOf = t => TOWER[t.type].dmg * Math.pow(1.45, t.lvl - 1);
  const rangeOf = t => TOWER[t.type].range + (t.lvl - 1) * .15;
  function waveList(n) {
    const l = [];
    for (let i = 0; i < 5 + 2 * n; i++) l.push('grunt');
    if (n >= 3) for (let i = 0; i < 2 * n - 4; i++) l.push('runner');
    if (n >= 5) for (let i = 0; i < Math.floor((n - 3) / 2); i++) l.push('brute');
    if (n % 5 === 0) for (let i = 0; i < (n === 15 ? 2 : 1); i++) l.push('boss');
    return l;
  }

  // ---- state ----
  let gold, lives, wave, mode = 'idle', tower = 'cannon', countdown = 0, queue = [], spawnT = 0, T = 0;
  let towers = [], enemies = [], shots = [], occ = new Map(), hover = null;

  const bar = new THREE.PlaneGeometry(.7, .09), barFg = new THREE.PlaneGeometry(.7, .09).translate(.35, 0, 0);
  const barBgMat = new THREE.MeshBasicMaterial({color: 0x111827, depthTest: false, transparent: true}), barFgMat = new THREE.MeshBasicMaterial({color: 0x4ade80, depthTest: false, transparent: true});

  function reset() {
    towers.forEach(t => scene.remove(t.mesh)); enemies.forEach(e => { scene.remove(e.mesh); scene.remove(e.bar); }); shots.forEach(s => scene.remove(s.mesh));
    towers = []; enemies = []; shots = []; occ.clear(); gold = 170; lives = 20; wave = 0; queue = []; mode = 'prep'; countdown = 18;
    syncHud(); S.status('Pick a tower (1-3) and click a green tile beside the road. Space sends the first wave.');
  }
  function syncHud() {
    S.hud(1, Math.floor(gold)); S.hud(2, Math.max(wave, 0) + '/' + WAVES); S.hud(3, lives);
    ['cannon', 'frost', 'laser'].forEach((k, i) => { const b = $('t' + (i + 1)); if (!b) return; b.style.opacity = gold >= TOWER[k].cost ? 1 : .5; b.style.outline = tower === k ? '2px solid #4ade80' : 'none'; });
    const wb = $('waveBtn'); if (wb) { wb.disabled = mode !== 'prep'; wb.style.opacity = mode === 'prep' ? 1 : .5; wb.textContent = mode === 'prep' ? `Send wave ${wave + 1}` : 'Wave in progress'; }
  }

  // ---- towers ----
  function buildTower(type, c, r) {
    const def = TOWER[type];
    if (gold < def.cost) { S.flash('NEED $' + def.cost, 500); S.beep(120, .15, 'square', .04); return; }
    gold -= def.cost;
    const g = new THREE.Group(), mat = col => new THREE.MeshStandardMaterial({color: col, roughness: .45, metalness: .3});
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.34, .4, .26, 14), mat(0x64748b)); base.position.y = .13; g.add(base);
    const t = {type, c, r, lvl: 1, cd: 0, mesh: g, invested: def.cost, pivot: null, beam: null, spin: null, pips: new THREE.Group()};
    if (type === 'cannon') {
      const piv = new THREE.Group(); piv.position.y = .42;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .2, 12), mat(0x374151));
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, .55, 10).rotateX(Math.PI / 2), mat(0x111827)); barrel.position.z = -.3;
      piv.add(head, barrel); g.add(piv); t.pivot = piv;
    } else if (type === 'frost') {
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.3).scale(1, 1.7, 1), new THREE.MeshStandardMaterial({color: 0x9be3ff, emissive: 0x1b78b8, roughness: .1, metalness: .2, transparent: true, opacity: .92}));
      cr.position.y = .78; g.add(cr); t.spin = cr;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.26, .03, 6, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({color: 0xbae6fd})); ring.position.y = .3; g.add(ring);
    } else {
      const pil = new THREE.Mesh(new THREE.ConeGeometry(.2, .9, 8), mat(0x7c3aed)); pil.position.y = .6; g.add(pil);
      const em = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), new THREE.MeshStandardMaterial({color: 0xf5d0fe, emissive: 0xd946ef})); em.position.y = 1.1; g.add(em); t.spin = em;
      t.beam = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 6).rotateX(Math.PI / 2).translate(0, 0, -.5), new THREE.MeshBasicMaterial({color: 0xf0abfc, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false}));
      t.beam.visible = false; t.beam.frustumCulled = false; scene.add(t.beam);
    }
    g.add(t.pips); g.position.copy(cellPos(c, r)); g.position.y = 0; g.traverse(o => { o.castShadow = true; }); scene.add(g);
    towers.push(t); occ.set(c + ',' + r, t); pips(t); S.polish(); S.beep(420, .08, 'triangle'); S.burst(g.position.clone().setY(.4), 0xffffff, 12, 2); syncHud();
  }
  function pips(t) {
    while (t.pips.children.length) t.pips.remove(t.pips.children[0]);
    for (let i = 0; i < t.lvl; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshStandardMaterial({color: 0xfacc15, emissive: 0xb45309})); const a = (i - (t.lvl - 1) / 2) * .5; p.position.set(Math.sin(a) * .36, .14, Math.cos(a) * .36 + .02); t.pips.add(p); }
    S.polish();
  }
  function upgrade(t) {
    if (t.lvl >= 3) { S.flash('MAX LEVEL', 500); return; }
    const c = upCost(t); if (gold < c) { S.flash('NEED $' + c, 500); S.beep(120, .15, 'square', .04); return; }
    gold -= c; t.invested += c; t.lvl++; t.mesh.scale.setScalar(1 + (t.lvl - 1) * .12); pips(t); S.beep(600, .1, 'triangle'); setTimeout(() => S.beep(800, .12, 'triangle'), 90);
    S.burst(t.mesh.position.clone().setY(.6), 0xfacc15, 20, 3); syncHud();
  }
  function sell(t) {
    gold += Math.floor(t.invested * .6); scene.remove(t.mesh); if (t.beam) scene.remove(t.beam); towers.splice(towers.indexOf(t), 1); occ.delete(t.c + ',' + t.r); S.beep(300, .15, 'sawtooth', .04); syncHud();
  }

  // ---- enemies ----
  function spawn(type) {
    const def = ENEMY[type], g = new THREE.Group(), hpMul = 1 + .5 * (wave - 1);
    const col = {grunt: 0xef4444, runner: 0xfacc15, brute: 0x8b5cf6, boss: 0x1f2937}[type];
    let body;
    if (type === 'runner') body = new THREE.Mesh(new THREE.OctahedronGeometry(.26), new THREE.MeshStandardMaterial({color: col, roughness: .4}));
    else if (type === 'boss') body = new THREE.Mesh(new THREE.IcosahedronGeometry(.55), new THREE.MeshStandardMaterial({color: col, emissive: 0xb91c1c, roughness: .35, metalness: .4}));
    else { const s = type === 'brute' ? .62 : .42; body = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({color: col, roughness: .5})); }
    body.castShadow = true; g.add(body);
    if (type !== 'runner') [-1, 1].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(type === 'boss' ? .1 : .06, 8, 6), new THREE.MeshBasicMaterial({color: type === 'boss' ? 0xfef08a : 0xffffff})); const s = type === 'boss' ? .55 : type === 'brute' ? .62 : .42; e.position.set(x * s * .25, s * .1, -s * .5); g.add(e); });
    const b = new THREE.Group(), bg = new THREE.Mesh(bar, barBgMat), fg = new THREE.Mesh(barFg, barFgMat.clone()); fg.position.set(-.35, 0, .001); b.add(bg, fg); b.renderOrder = 10; bg.renderOrder = 10; fg.renderOrder = 11; scene.add(b);
    const e = {type, d: 0, hp: def.hp * hpMul, max: def.hp * hpMul, speed: def.speed, slow: 0, mesh: g, bar: b, fg, lift: type === 'boss' ? 1.2 : type === 'brute' ? .95 : .7};
    g.position.copy(cellPos(...pathCells[0])); scene.add(g); enemies.push(e); S.polish();
  }
  function posAt(d, out) {
    const i = Math.min(Math.floor(d), pathCells.length - 2), f = Math.min(1, d - i), a = pathCells[i], b = pathCells[i + 1];
    return out.set(a[0] + (b[0] - a[0]) * f - (COLS - 1) / 2, 0, a[1] + (b[1] - a[1]) * f - (ROWS - 1) / 2);
  }
  function hurt(e, dmg) {
    if (e.dead) return; e.hp -= dmg;
    if (e.hp <= 0) { e.dead = true; gold += ENEMY[e.type].reward; S.burst(e.mesh.position.clone().setY(.5), e.type === 'boss' ? 0xff4d4d : 0xfacc15, e.type === 'boss' ? 60 : 12, e.type === 'boss' ? 7 : 3); S.beep(700 + Math.random() * 200, .05, 'triangle', .03); if (e.type === 'boss') S.shake(.5); syncHud(); }
  }
  function removeEnemy(e) { scene.remove(e.mesh); scene.remove(e.bar); enemies.splice(enemies.indexOf(e), 1); }

  function startWave() {
    if (mode !== 'prep') return;
    gold += Math.floor(countdown) * 2; wave++; mode = 'wave'; queue = waveList(wave); spawnT = 0;
    if (wave % 5 === 0) S.flash('BOSS WAVE ' + wave, 1200); else S.flash('WAVE ' + wave, 800);
    S.beep(220, .3, 'sawtooth', .05); syncHud(); S.status(`Wave ${wave} of ${WAVES}. Click a tower to upgrade it, right-click to sell.`);
  }
  function endGame(won) {
    mode = 'over'; const reached = won ? WAVES : wave; S.best(reached); syncHud();
    S.show(won ? 'Keep defended!' : 'The keep has fallen', won ? `All ${WAVES} waves repelled with ${lives} lives left.` : `You held out until wave ${reached}.`, 'Play again');
  }

  // ---- input ----
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hp = new THREE.Vector3();
  function cellAt(e) {
    const r = S.el.getBoundingClientRect();
    ray.setFromCamera({x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1}, camera);
    if (!ray.ray.intersectPlane(plane, hp)) return null;
    const c = Math.round(hp.x + (COLS - 1) / 2), rr = Math.round(hp.z + (ROWS - 1) / 2);
    return c >= 0 && c < COLS && rr >= 0 && rr < ROWS ? [c, rr] : null;
  }
  function describe() {
    if (!hover) return;
    const k = hover.join(','), t = occ.get(k);
    if (t) S.status(`${TOWER[t.type].name} level ${t.lvl}: ${t.lvl < 3 ? `click to upgrade ($${upCost(t)})` : 'max level'}, right-click to sell ($${Math.floor(t.invested * .6)}).`);
    else if (pathSet.has(k) || blocked.has(k)) S.status('Can\'t build here — pick a green tile beside the road.');
    else S.status(`Build ${TOWER[tower].name} ($${TOWER[tower].cost}).`);
  }
  S.el.addEventListener('pointermove', e => { hover = cellAt(e); describe(); });
  S.el.addEventListener('pointerleave', () => { hover = null; });
  S.el.addEventListener('pointerdown', e => {
    if (mode === 'idle' || mode === 'over' || e.button === 2) return;
    hover = cellAt(e); if (!hover) return; const k = hover.join(','), t = occ.get(k);
    if (t) upgrade(t); else if (!pathSet.has(k) && !blocked.has(k)) buildTower(tower, hover[0], hover[1]);
  });
  S.el.addEventListener('contextmenu', e => { e.preventDefault(); hover = cellAt(e); const t = hover && occ.get(hover.join(',')); if (t && mode !== 'over') sell(t); });
  const pick = k => { tower = k; syncHud(); S.status(`${TOWER[k].name} selected ($${TOWER[k].cost}).`); };
  ['cannon', 'frost', 'laser'].forEach((k, i) => $('t' + (i + 1)).addEventListener('click', () => pick(k)));
  $('waveBtn').addEventListener('click', startWave);
  document.addEventListener('keydown', e => {
    if (e.key === '1') pick('cannon'); else if (e.key === '2') pick('frost'); else if (e.key === '3') pick('laser');
    else if (e.code === 'Space') { if (document.activeElement) document.activeElement.blur(); e.preventDefault(); startWave(); }
    else if (e.key.toLowerCase() === 'x' && hover) { const t = occ.get(hover.join(',')); if (t) sell(t); }
  });

  // ---- loop ----
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  S.loop(rawDt => {
    const dt = rawDt; T += rawDt;
    camera.position.set(0, 13.5, 11); camera.lookAt(0, 0, .6);
    clouds.forEach(c => { c.position.x += c.userData.s * rawDt; if (c.position.x > 20) c.position.x = -20; });
    portal.rotation.z += rawDt * 2; keep.rotation.y = Math.sin(T * .3) * .05;
    if (mode === 'idle') return;

    // hover visuals
    hoverBox.visible = rangeRing.visible = false;
    if (hover && mode !== 'over') {
      const k = hover.join(','), t = occ.get(k), ok = !pathSet.has(k) && !blocked.has(k);
      hoverBox.visible = true; hoverBox.position.copy(cellPos(...hover)); hoverBox.position.y = .1;
      hoverBox.material.color.set(t ? 0xfacc15 : ok && gold >= TOWER[tower].cost ? 0x4ade80 : 0xef4444).convertSRGBToLinear();
      if (t || ok) { rangeRing.visible = true; rangeRing.position.copy(hoverBox.position); rangeRing.position.y = .05; rangeRing.scale.setScalar(t ? rangeOf(t) : TOWER[tower].range); }
    }

    if (mode === 'prep') { countdown -= dt; if (wave > 0 && countdown <= 0) startWave(); if (wave === 0 && countdown < 0) countdown = 0; syncHud(); }
    if (mode === 'wave') {
      spawnT -= dt;
      if (queue.length && spawnT <= 0) { const ty = queue.shift(); spawn(ty); spawnT = ENEMY[ty].gap; }
      if (!queue.length && !enemies.length) {
        if (wave >= WAVES) return endGame(true);
        mode = 'prep'; countdown = 10; gold += 15 + wave * 3; S.flash('WAVE CLEARED', 900); S.beep(880, .2, 'triangle'); syncHud();
      }
    }

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dead) { removeEnemy(e); continue; }
      e.slow = Math.max(0, e.slow - dt);
      e.d += e.speed * (e.slow > 0 ? .5 : 1) * dt;
      if (e.d >= pathCells.length - 1) { lives -= ENEMY[e.type].dmg; removeEnemy(e); S.shake(.35); S.beep(110, .25, 'sawtooth', .06); syncHud(); if (lives <= 0) { lives = 0; syncHud(); return endGame(false); } continue; }
      const prev = e.mesh.position.clone(); posAt(e.d, e.mesh.position);
      if (prev.distanceToSquared(e.mesh.position) > 1e-6) e.mesh.rotation.y = Math.atan2(-(e.mesh.position.x - prev.x), -(e.mesh.position.z - prev.z));
      e.mesh.position.y = e.lift * .5 + Math.abs(Math.sin(T * 7 + i)) * .1;
      e.mesh.children[0].rotation.y += e.type === 'runner' || e.type === 'boss' ? dt * 3 : 0;
      e.bar.position.set(e.mesh.position.x, e.lift + .5, e.mesh.position.z); e.bar.quaternion.copy(camera.quaternion);
      e.fg.scale.x = Math.max(.001, e.hp / e.max); e.fg.material.color.setHSL(.33 * e.hp / e.max, .8, .5).convertSRGBToLinear();
    }

    // towers
    towers.forEach(t => {
      const rng = rangeOf(t), tp = t.mesh.position; let tgt = null, best = -1;
      for (const e of enemies) { if (e.dead) continue; const dx = e.mesh.position.x - tp.x, dz = e.mesh.position.z - tp.z; if (dx * dx + dz * dz <= rng * rng && e.d > best) { best = e.d; tgt = e; } }
      if (t.spin) { t.spin.rotation.y += dt * 2; if (t.type === 'frost') t.spin.position.y = .78 + Math.sin(T * 2 + t.c) * .05; }
      if (t.type === 'laser') {
        t.beam.visible = !!tgt;
        if (tgt) {
          tmp.copy(tp).setY(1.1); tmp2.copy(tgt.mesh.position).setY(tgt.lift * .5);
          t.beam.position.copy(tmp); t.beam.lookAt(tmp2); t.beam.scale.set(1, 1, tmp.distanceTo(tmp2)); t.beam.scale.x = t.beam.scale.y = 1 + Math.sin(T * 40) * .25;
          hurt(tgt, dmgOf(t) * dt);
        }
        return;
      }
      t.cd -= dt;
      if (!tgt) return;
      if (t.pivot) t.pivot.rotation.y = Math.atan2(-(tgt.mesh.position.x - tp.x), -(tgt.mesh.position.z - tp.z));
      if (t.cd <= 0) {
        t.cd = TOWER[t.type].rate * (t.type === 'frost' ? Math.pow(.9, t.lvl - 1) : 1);
        const m = new THREE.Mesh(new THREE.SphereGeometry(t.type === 'frost' ? .12 : .1, 8, 6), new THREE.MeshStandardMaterial({color: t.type === 'frost' ? 0xbae6fd : 0x1f2937, emissive: t.type === 'frost' ? 0x38bdf8 : 0xf97316, roughness: .3}));
        m.position.copy(tp).setY(.55); scene.add(m); shots.push({mesh: m, tgt, dmg: dmgOf(t), type: t.type, lvl: t.lvl, last: tgt.mesh.position.clone()}); S.polish();
        S.beep(t.type === 'frost' ? 900 : 160, .06, t.type === 'frost' ? 'sine' : 'square', .025);
      }
    });

    // projectiles
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; if (!s.tgt.dead) s.last.copy(s.tgt.mesh.position); s.last.y = .4;
      const dir = tmp.copy(s.last).sub(s.mesh.position), dist = dir.length(), step = 11 * dt;
      if (dist <= step + .15) {
        if (!s.tgt.dead) hurt(s.tgt, s.dmg);
        if (s.type === 'frost') { enemies.forEach(e => { if (!e.dead && e.mesh.position.distanceTo(s.last) < 1.2 + (s.lvl - 1) * .2) { e.slow = 1.6 + s.lvl * .4; if (e !== s.tgt) hurt(e, s.dmg * .5); } }); S.burst(s.last, 0x7dd3fc, 14, 3); }
        else S.burst(s.last, 0xf97316, 8, 2.5);
        scene.remove(s.mesh); shots.splice(i, 1);
      } else s.mesh.position.addScaledVector(dir.normalize(), step);
    }
  });

  S.polish();
  S.onStart(reset);
  S.hud(4, S.bestScore()); S.hud(1, 160); S.hud(2, '0/' + WAVES); S.hud(3, 20);
})();
