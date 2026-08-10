(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const lenEl = document.getElementById('len');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const COLS = 17, ROWS = 17;
  const CELL = 1;                       // world units per cell
  const HALF = (COLS - 1) / 2;

  // ---- Three.js scaffold ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 22, 46);

  const camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 21.7, 0.01);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  if (window.SceneKit) SceneKit.enhance(renderer, scene);

  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);

  scene.add(new THREE.AmbientLight(0x8899cc, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-8, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
  scene.add(sun);

  // ---- Board ----
  const boardW = COLS * CELL, boardH = ROWS * CELL;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(boardW, 0.6, boardH),
    new THREE.MeshStandardMaterial({color: 0x1e1b4b, roughness: 0.9})
  );
  board.position.y = -0.35;
  board.receiveShadow = true;
  scene.add(board);

  // checkerboard tiles
  const tileGeo = new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96);
  const tileMatA = new THREE.MeshStandardMaterial({color: 0x27235c, roughness: 0.85});
  const tileMatB = new THREE.MeshStandardMaterial({color: 0x211d52, roughness: 0.85});
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = new THREE.Mesh(tileGeo, (r + c) % 2 ? tileMatA : tileMatB);
    t.rotation.x = -Math.PI / 2;
    t.position.set(cellToWorldX(c), -0.04, cellToWorldZ(r));
    t.receiveShadow = true;
    scene.add(t);
  }

  // glowing border walls
  const wallMat = new THREE.MeshStandardMaterial({color: 0x8b5cf6, emissive: 0x6d28d9, emissiveIntensity: 0.5, roughness: 0.4});
  const wallThick = 0.5, wallHt = 0.9;
  function addWall(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallHt, d), wallMat);
    m.position.set(x, wallHt / 2 - 0.1, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  const edge = HALF + 0.5;
  addWall(0, -edge - 0.2, boardW + wallThick * 2, wallThick);
  addWall(0, edge + 0.2, boardW + wallThick * 2, wallThick);
  addWall(-edge - 0.2, 0, wallThick, boardH + wallThick * 2);
  addWall(edge + 0.2, 0, wallThick, boardH + wallThick * 2);

  function cellToWorldX(c) { return (c - HALF) * CELL; }
  function cellToWorldZ(r) { return (r - HALF) * CELL; }

  // ---- Snake character ----
  const snakeGroup = new THREE.Group();
  scene.add(snakeGroup);
  const bodySegs = [];   // meshes
  const bodyMatBase = {roughness: 0.45, metalness: 0.05};

  function bodyColor(t) {
    // t: 0 head → 1 tail. green→teal gradient with scale sheen
    const col = new THREE.Color();
    col.setHSL(0.36 - t * 0.06, 0.65, 0.42 + Math.sin(t * 20) * 0.03);
    return col;
  }

  // Head group with eyes + tongue
  const head = new THREE.Group();
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 20, 16),
    new THREE.MeshStandardMaterial({color: 0x22c55e, roughness: 0.4, metalness: 0.1})
  );
  headMesh.scale.set(1.05, 0.85, 1.25);
  headMesh.castShadow = true;
  head.add(headMesh);
  // eyes
  const eyeWhiteMat = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.3});
  const pupilMat = new THREE.MeshStandardMaterial({color: 0x0a0a0a, roughness: 0.2});
  function makeEye(sx) {
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), eyeWhiteMat);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pupilMat);
    p.position.set(0, 0, 0.11);
    g.add(w, p);
    g.position.set(sx, 0.28, 0.42);
    return g;
  }
  const eyeL = makeEye(-0.26), eyeR = makeEye(0.26);
  head.add(eyeL, eyeR);
  // nostrils / brow ridge
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial({color: 0x16a34a, roughness: 0.5}));
  brow.scale.set(1.0, 0.5, 0.7); brow.position.set(0, 0.18, 0.15);
  head.add(brow);
  // tongue
  const tongue = new THREE.Group();
  const tongueMat = new THREE.MeshStandardMaterial({color: 0xef4444, roughness: 0.3, emissive: 0x7f1d1d, emissiveIntensity: 0.2});
  const tongueBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), tongueMat);
  tongueBase.rotation.x = Math.PI / 2; tongueBase.position.z = 0.9;
  const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.28, 5), tongueMat);
  forkL.rotation.set(Math.PI / 2, 0, 0.4); forkL.position.set(-0.07, 0, 1.18);
  const forkR = forkL.clone(); forkR.rotation.z = -0.4; forkR.position.x = 0.07;
  tongue.add(tongueBase, forkL, forkR);
  head.add(tongue);
  head.castShadow = true;
  snakeGroup.add(head);

  // ---- Apple ----
  const apple = new THREE.Group();
  const appleBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 20, 16),
    new THREE.MeshStandardMaterial({color: 0xef4444, roughness: 0.25, metalness: 0.15, emissive: 0x991b1b, emissiveIntensity: 0.35})
  );
  appleBody.scale.set(1, 0.92, 1);
  appleBody.castShadow = true;
  apple.add(appleBody);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 6), new THREE.MeshStandardMaterial({color: 0x7c4a1e, roughness: 0.8}));
  stem.position.y = 0.5; apple.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshStandardMaterial({color: 0x22c55e, roughness: 0.5}));
  leaf.scale.set(1.6, 0.25, 0.8); leaf.position.set(0.18, 0.52, 0); leaf.rotation.z = 0.5;
  apple.add(leaf);
  const appleGlow = new THREE.PointLight(0xff5555, 0.8, 4);
  apple.add(appleGlow);
  scene.add(apple);

  // ---- Game state ----
  let cells, prevCells, dir, nextDir, foodCell, score, best, tickMs, moveAcc, running, paused, dead;
  const HEAD_Y = 0.55;

  best = +localStorage.getItem('snake3d-best') || 0;
  bestEl.textContent = best;

  function reset() {
    const midR = Math.floor(ROWS / 2);
    cells = [{c: 9, r: midR}, {c: 8, r: midR}, {c: 7, r: midR}];
    prevCells = cells.map(o => ({...o}));
    dir = {c: 1, r: 0};
    nextDir = {c: 1, r: 0};
    score = 0;
    tickMs = 200;
    moveAcc = 0;
    running = false; paused = false; dead = false;
    scoreEl.textContent = 0;
    lenEl.textContent = cells.length;
    placeFood();
    buildBody();
    layoutSnake(1);
    overTitle.textContent = 'Snake 3D';
    overMsg.textContent = 'Guide the snake, eat apples, don\'t crash.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
  }

  function placeFood() {
    while (true) {
      const c = Math.floor(Math.random() * COLS);
      const r = Math.floor(Math.random() * ROWS);
      if (!cells.some(s => s.c === c && s.r === r)) { foodCell = {c, r}; return; }
    }
  }

  function buildBody() {
    // ensure we have (cells.length - 1) body segments (head is separate)
    while (bodySegs.length < cells.length - 1) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshStandardMaterial(bodyMatBase));
      m.castShadow = true;
      snakeGroup.add(m);
      bodySegs.push(m);
    }
    while (bodySegs.length > cells.length - 1) {
      const m = bodySegs.pop();
      snakeGroup.remove(m);
    }
    // color + taper
    bodySegs.forEach((m, i) => {
      const t = (i + 1) / cells.length;
      m.material.color = bodyColor(t);
      const s = 1.0 - t * 0.45;
      m.scale.setScalar(s);
    });
  }

  function start() {
    reset();
    running = true; paused = false;
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Slither!';
  }

  function tick() {
    dir = nextDir;
    const h = cells[0];
    const nc = h.c + dir.c, nr = h.r + dir.r;
    // wall
    if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) return gameOver();
    // self
    if (cells.some(s => s.c === nc && s.r === nr)) return gameOver();

    prevCells = cells.map(o => ({...o}));
    cells.unshift({c: nc, r: nr});

    if (nc === foodCell.c && nr === foodCell.r) {
      score += 10;
      scoreEl.textContent = score;
      lenEl.textContent = cells.length;
      tickMs = Math.max(95, 200 - Math.floor(score / 40) * 10);
      // prevCells needs a matching tail entry so new tail grows smoothly
      prevCells.push({...prevCells[prevCells.length - 1]});
      placeFood();
      buildBody();
      pulseApple();
    } else {
      cells.pop();
    }
  }

  // interpolate all segments between prevCells and cells by t
  function layoutSnake(t) {
    const wave = 0.14;
    // head
    const hp = lerpCell(prevCells[0] || cells[0], cells[0], t);
    head.position.set(hp.x, HEAD_Y, hp.z);
    // face travel direction
    const ang = Math.atan2(dir.c, dir.r);
    head.rotation.y = smoothAngle(head.rotation.y, ang, 0.35);

    for (let i = 0; i < bodySegs.length; i++) {
      const ci = i + 1;
      const prev = prevCells[ci] || prevCells[prevCells.length - 1] || cells[ci] || cells[cells.length - 1];
      const cur = cells[ci] || cells[cells.length - 1];
      const p = lerpCell(prev, cur, t);
      const bob = Math.sin(performance.now() * 0.004 + i * 0.7) * wave;
      bodySegs[i].position.set(p.x, HEAD_Y + bob * 0.5, p.z);
    }
  }

  function lerpCell(a, b, t) {
    return {
      x: THREE.MathUtils.lerp(cellToWorldX(a.c), cellToWorldX(b.c), t),
      z: THREE.MathUtils.lerp(cellToWorldZ(a.r), cellToWorldZ(b.r), t)
    };
  }
  function smoothAngle(cur, target, k) {
    let d = target - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return cur + d * k;
  }

  function gameOver() {
    running = false; dead = true;
    if (score > best) {
      best = score; localStorage.setItem('snake3d-best', best); bestEl.textContent = best;
      overTitle.textContent = 'New Best!'; overMsg.textContent = `${score} points.`;
    } else {
      overTitle.textContent = 'Game Over'; overMsg.textContent = `Score ${score} · Best ${best}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Crashed. Press Start.';
  }

  function turn(c, r) {
    if (cells.length > 1 && c === -dir.c && r === -dir.r) return;
    nextDir = {c, r};
  }

  let applePulse = 0;
  function pulseApple() { applePulse = 1; }

  const clock = new THREE.Clock();

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }

  function animate() {
    // clamp dt so a long/throttled frame can't run many ticks at once (prevents instant crash)
    const dt = Math.min(clock.getDelta(), 0.05);

    // apple bob + spin
    apple.position.set(cellToWorldX(foodCell.c), 0.55 + Math.sin(performance.now() * 0.003) * 0.12, cellToWorldZ(foodCell.r));
    apple.rotation.y += 0.02;
    const ps = 1 + applePulse * 0.4;
    apple.scale.setScalar(ps);
    applePulse *= 0.9;
    appleGlow.intensity = 0.7 + Math.sin(performance.now() * 0.006) * 0.3;

    // tongue flick + blink
    const flick = (Math.sin(performance.now() * 0.006) > 0.6) ? 1 : 0;
    tongue.scale.z = 0.4 + flick * 0.9;
    tongue.visible = flick > 0;
    const blink = (Math.sin(performance.now() * 0.0016) > 0.97) ? 0.15 : 1;
    eyeL.scale.y = blink; eyeR.scale.y = blink;

    if (running && !paused) {
      moveAcc += dt * 1000;
      let guard = 0;
      while (moveAcc >= tickMs && guard++ < 3) {
        moveAcc -= tickMs;
        tick();
        if (!running) break;
      }
      if (moveAcc > tickMs) moveAcc = tickMs; // drop backlog
      const t = running ? Math.min(1, moveAcc / tickMs) : 1;
      layoutSnake(t);
    } else {
      layoutSnake(1);
    }

    __polish();

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // ---- Input ----
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowup','w'].includes(k)) { e.preventDefault(); turn(0, -1); }
    else if (['arrowdown','s'].includes(k)) { e.preventDefault(); turn(0, 1); }
    else if (['arrowleft','a'].includes(k)) { e.preventDefault(); turn(-1, 0); }
    else if (['arrowright','d'].includes(k)) { e.preventDefault(); turn(1, 0); }
    else if (k === ' ') { e.preventDefault(); if (running) paused = !paused; }
  });
  document.querySelectorAll('.dpad-btn').forEach(b => b.addEventListener('click', () => {
    const d = b.dataset.d;
    if (d === 'up') turn(0, -1); else if (d === 'down') turn(0, 1);
    else if (d === 'left') turn(-1, 0); else if (d === 'right') turn(1, 0);
  }));
  let ts = null;
  container.addEventListener('touchstart', e => { ts = {x: e.touches[0].clientX, y: e.touches[0].clientY}; }, {passive: true});
  container.addEventListener('touchend', e => {
    if (!ts) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - ts.x, dy = t.clientY - ts.y;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
    else turn(0, dy > 0 ? 1 : -1);
    ts = null;
  });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);
  document.getElementById('pauseBtn').addEventListener('click', () => { if (running) paused = !paused; });

  reset();
  animate();
})();
