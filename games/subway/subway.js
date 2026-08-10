(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const coinsEl = document.getElementById('coins');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  // ---- Three.js setup ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 22, 65);

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 5.5, 8);
  camera.lookAt(0, 1.5, -10);

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

  // resize handling
  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);

  // ---- Lights ----
  scene.add(new THREE.AmbientLight(0x8888dd, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-8, 20, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  // ---- Track ----
  const LANES = [-2.2, 0, 2.2];
  const TRACK_TILES = 12;
  const TILE_LEN = 6;
  const tiles = [];
  const tileGeom = new THREE.BoxGeometry(7, 0.4, TILE_LEN);
  const tileMat1 = new THREE.MeshStandardMaterial({color: 0x6366f1, roughness: 0.85, metalness: 0.05});
  const tileMat2 = new THREE.MeshStandardMaterial({color: 0x4c1d95, roughness: 0.85, metalness: 0.05});
  for (let i = 0; i < TRACK_TILES; i++) {
    const t = new THREE.Mesh(tileGeom, i % 2 === 0 ? tileMat1 : tileMat2);
    t.position.set(0, -0.2, -i * TILE_LEN);
    t.receiveShadow = true;
    scene.add(t);
    tiles.push(t);
  }

  // Lane dividers
  const dividerGeom = new THREE.BoxGeometry(0.08, 0.05, TRACK_TILES * TILE_LEN);
  const dividerMat = new THREE.MeshStandardMaterial({color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.4});
  for (const x of [-1.1, 1.1]) {
    const d = new THREE.Mesh(dividerGeom, dividerMat);
    d.position.set(x, 0.03, -TRACK_TILES * TILE_LEN / 2 + TILE_LEN / 2);
    scene.add(d);
  }

  // Side walls (visual only, moving effect via tile motion)
  const wallGeom = new THREE.BoxGeometry(0.4, 3, TRACK_TILES * TILE_LEN);
  const wallMat = new THREE.MeshStandardMaterial({color: 0x1e1b4b, roughness: 0.9});
  const wallL = new THREE.Mesh(wallGeom, wallMat);
  wallL.position.set(-3.7, 1.3, -TRACK_TILES * TILE_LEN / 2 + TILE_LEN / 2);
  wallL.castShadow = true; wallL.receiveShadow = true;
  const wallR = wallL.clone();
  wallR.position.x = 3.7;
  scene.add(wallL, wallR);

  // Distant tunnel arches for depth
  const archGroup = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(4.5, 0.15, 8, 20, Math.PI),
      new THREE.MeshStandardMaterial({color: 0x312e81, emissive: 0x312e81, emissiveIntensity: 0.3})
    );
    arch.rotation.z = Math.PI;
    arch.position.set(0, 3.5, -i * 8 - 4);
    archGroup.add(arch);
  }
  scene.add(archGroup);

  // ---- Player ----
  const player = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color: 0x06d4f7, roughness: 0.3, metalness: 0.5, emissive: 0x06d4f7, emissiveIntensity: 0.25});
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.7), bodyMat);
  body.position.y = 0.9;
  body.castShadow = true;
  player.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 12),
    new THREE.MeshStandardMaterial({color: 0xfef3c7, roughness: 0.5})
  );
  head.position.y = 1.9;
  head.castShadow = true;
  player.add(head);
  // simple "eyes"
  const eyeMat = new THREE.MeshStandardMaterial({color: 0x050514});
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
  eyeL.position.set(-0.12, 1.95, 0.3);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.12;
  player.add(eyeL, eyeR);
  // arms
  const armMat = new THREE.MeshStandardMaterial({color: 0x6366f1});
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), armMat);
  armL.position.set(-0.55, 1.0, 0);
  armL.castShadow = true;
  const armR = armL.clone(); armR.position.x = 0.55;
  player.add(armL, armR);

  player.position.set(LANES[1], 0, 3);
  scene.add(player);

  // ---- Obstacles pool ----
  const OBSTACLE_TYPES = {
    barrier: { // low, must jump over
      geom: new THREE.BoxGeometry(1.5, 0.8, 0.6),
      color: 0xef4444,
      y: 0.4,
      height: 0.8
    },
    top: { // high, must slide under
      geom: new THREE.BoxGeometry(1.5, 0.7, 0.6),
      color: 0xf59e0b,
      y: 1.7,
      height: 0.7
    },
    tall: { // full block, dodge to another lane
      geom: new THREE.BoxGeometry(1.5, 2.2, 0.6),
      color: 0x8b5cf6,
      y: 1.1,
      height: 2.2
    }
  };
  const obstacles = [];
  function makeObstacle(type, lane, z) {
    const cfg = OBSTACLE_TYPES[type];
    const mat = new THREE.MeshStandardMaterial({color: cfg.color, roughness: 0.5, metalness: 0.2, emissive: cfg.color, emissiveIntensity: 0.15});
    const mesh = new THREE.Mesh(cfg.geom, mat);
    mesh.castShadow = true;
    mesh.position.set(LANES[lane], cfg.y, z);
    scene.add(mesh);
    return {mesh, type, lane, height: cfg.height, hit: false};
  }

  // ---- Coins ----
  const coinGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20);
  const coinMat = new THREE.MeshStandardMaterial({color: 0xfde047, metalness: 0.9, roughness: 0.15, emissive: 0xfacc15, emissiveIntensity: 0.55});
  const coinsArr = [];
  function makeCoin(lane, z, y = 1.0) {
    const c = new THREE.Mesh(coinGeom, coinMat);
    c.position.set(LANES[lane], y, z);
    c.rotation.x = Math.PI / 2;
    scene.add(c);
    return {mesh: c, lane, collected: false};
  }

  // ---- Game state ----
  let laneIdx, targetLaneX, playerY, playerVY, sliding, slideTimer;
  let speed, distance, coinCount, score, best, gameState;
  best = +localStorage.getItem('subway-best') || 0;
  bestEl.textContent = best;

  function reset() {
    obstacles.forEach(o => scene.remove(o.mesh));
    obstacles.length = 0;
    coinsArr.forEach(c => scene.remove(c.mesh));
    coinsArr.length = 0;
    laneIdx = 1;
    targetLaneX = LANES[1];
    player.position.set(LANES[1], 0, 3);
    playerY = 0;
    playerVY = 0;
    sliding = false;
    slideTimer = 0;
    body.scale.set(1, 1, 1);
    body.position.y = 0.9;
    speed = 0.2;
    distance = 0;
    coinCount = 0;
    score = 0;
    scoreEl.textContent = 0;
    coinsEl.textContent = 0;
    // pre-populate some obstacles ahead
    spawnAt(-30);
    spawnAt(-45);
    spawnAt(-60);
    gameState = 'ready';
    overTitle.textContent = 'Ready to Run?';
    overMsg.textContent = 'Left/Right to switch lanes. Up to jump. Down to slide.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start or an arrow key.';
  }

  function spawnAt(z) {
    // pick a set of lane contents that aren't all-blocked
    const layout = pickLayout();
    layout.forEach((cell, laneI) => {
      if (cell === 'B') obstacles.push(makeObstacle('barrier', laneI, z));
      else if (cell === 'T') obstacles.push(makeObstacle('top', laneI, z));
      else if (cell === 'X') obstacles.push(makeObstacle('tall', laneI, z));
      else if (cell === 'C') {
        // coin trail — 3 coins along z
        for (let k = 0; k < 3; k++) coinsArr.push(makeCoin(laneI, z + k * 1.5, 1.0));
      }
    });
  }

  function pickLayout() {
    // Guaranteed at least one clear-through lane (no tall, or a low/top you can jump/slide)
    const layouts = [
      // format: [lane -2, lane 0, lane +2]
      ['C', 'X', '.'],
      ['X', '.', 'C'],
      ['.', 'B', '.'],   // one barrier, side lanes clear
      ['T', '.', 'T'],
      ['.', 'C', '.'],
      ['X', '.', 'X'],
      ['B', 'C', 'B'],   // center is coins (jump B then keep collecting)
      ['.', 'T', '.'],
      ['C', '.', 'X'],
      ['.', '.', 'C'],
      ['X', 'C', '.'],
      ['B', '.', 'T']
    ];
    return layouts[Math.floor(Math.random() * layouts.length)];
  }

  function jump() {
    if (gameState !== 'play') return;
    if (playerY <= 0.01) {
      playerVY = 0.32;
    }
  }
  function slide() {
    if (gameState !== 'play') return;
    if (sliding) return;
    sliding = true;
    slideTimer = 40; // frames
    body.scale.y = 0.4;
    body.position.y = 0.4;
    head.position.y = 1.0;
    eyeL.position.y = 1.05; eyeR.position.y = 1.05;
    armL.scale.y = 0.6; armR.scale.y = 0.6;
    armL.position.y = 0.5; armR.position.y = 0.5;
  }
  function unslide() {
    sliding = false;
    body.scale.y = 1;
    body.position.y = 0.9;
    head.position.y = 1.9;
    eyeL.position.y = 1.95; eyeR.position.y = 1.95;
    armL.scale.y = 1; armR.scale.y = 1;
    armL.position.y = 1.0; armR.position.y = 1.0;
  }

  function switchLane(dir) {
    if (gameState !== 'play') return;
    laneIdx = Math.max(0, Math.min(2, laneIdx + dir));
    targetLaneX = LANES[laneIdx];
  }

  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Run!';
  }

  function gameOver() {
    gameState = 'over';
    if (score > best) {
      best = score;
      localStorage.setItem('subway-best', best);
      bestEl.textContent = best;
      overTitle.textContent = 'New Best!';
      overMsg.textContent = `${score} pts · ${coinCount} coins.`;
    } else {
      overTitle.textContent = 'Crashed!';
      overMsg.textContent = `Score: ${score} · Coins: ${coinCount}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start to run again.';
  }

  let clock = new THREE.Clock();
  let obstacleTimer = 0;
  let armSwing = 0;

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function update() {
    const dt = clock.getDelta();

    // player lane smoothing
    player.position.x += (targetLaneX - player.position.x) * 0.22;

    // gravity / jump
    if (gameState === 'play') {
      playerVY -= 0.019;
      playerY += playerVY;
      if (playerY < 0) { playerY = 0; playerVY = 0; }
      player.position.y = playerY;
    }

    // slide timer
    if (sliding) {
      slideTimer--;
      if (slideTimer <= 0) unslide();
    }

    // run animation
    if (gameState === 'play') {
      armSwing += dt * 12;
      const amp = playerY > 0.1 ? 0.6 : Math.sin(armSwing) * 0.7;
      armL.rotation.x = amp;
      armR.rotation.x = -amp;
      body.rotation.z = Math.sin(armSwing) * 0.05;
    }

    if (gameState !== 'play') { renderer.render(scene, camera); return; }

    // move world (illusion of running forward)
    tiles.forEach(t => {
      t.position.z += speed;
      if (t.position.z > TILE_LEN) t.position.z -= TRACK_TILES * TILE_LEN;
    });
    archGroup.children.forEach(a => {
      a.position.z += speed;
      if (a.position.z > 6) a.position.z -= 64;
    });

    obstacleTimer += speed;
    if (obstacleTimer > 14) {
      obstacleTimer = 0;
      spawnAt(-70);
    }

    // move obstacles + coins
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.mesh.position.z += speed;
      if (o.mesh.position.z > 6) {
        scene.remove(o.mesh);
        obstacles.splice(i, 1);
      }
    }
    for (let i = coinsArr.length - 1; i >= 0; i--) {
      const c = coinsArr[i];
      c.mesh.position.z += speed;
      c.mesh.rotation.z += 0.12;
      if (c.mesh.position.z > 6) {
        scene.remove(c.mesh);
        coinsArr.splice(i, 1);
      }
    }

    // collisions
    const px = player.position.x, py = playerY + (sliding ? 0.3 : 0.9), pz = player.position.z;
    const phalf = 0.4;
    const pyHalf = sliding ? 0.3 : 0.9;

    for (const o of obstacles) {
      if (o.hit) continue;
      const dx = Math.abs(o.mesh.position.x - px);
      const dz = Math.abs(o.mesh.position.z - pz);
      if (dx < phalf + 0.75 && dz < 0.3 + 0.4) {
        // check y overlap
        const oy = o.mesh.position.y;
        const oyHalf = o.height / 2;
        if (Math.abs(oy - py) < oyHalf + pyHalf) {
          o.hit = true;
          return gameOver();
        }
      }
    }

    for (let i = coinsArr.length - 1; i >= 0; i--) {
      const c = coinsArr[i];
      const dx = Math.abs(c.mesh.position.x - px);
      const dz = Math.abs(c.mesh.position.z - pz);
      const dy = Math.abs(c.mesh.position.y - py);
      if (dx < 0.6 && dz < 0.6 && dy < 0.9) {
        scene.remove(c.mesh);
        coinsArr.splice(i, 1);
        coinCount++;
        coinsEl.textContent = coinCount;
        score += 10;
      }
    }

    // distance-based scoring
    distance += speed;
    score = Math.floor(distance) + coinCount * 10;
    scoreEl.textContent = score;

    // slow speed ramp (very gentle for playability)
    speed = Math.min(0.5, speed + 0.00005);

    __polish();

    renderer.render(scene, camera);
  }

  function loop() {
    update();
    requestAnimationFrame(loop);
  }

  // Input
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowleft','a'].includes(k)) { e.preventDefault(); switchLane(-1); }
    else if (['arrowright','d'].includes(k)) { e.preventDefault(); switchLane(1); }
    else if (['arrowup','w',' '].includes(k)) { e.preventDefault(); jump(); }
    else if (['arrowdown','s'].includes(k)) { e.preventDefault(); slide(); }
  });

  document.querySelectorAll('.dpad-btn').forEach(b => {
    b.addEventListener('click', () => {
      const d = b.dataset.d;
      if (d === 'left') switchLane(-1);
      else if (d === 'right') switchLane(1);
      else if (d === 'up') jump();
      else if (d === 'down') slide();
    });
  });

  // Swipe controls
  let touchStart = null;
  container.addEventListener('touchstart', e => {
    const t = e.touches[0];
    touchStart = {x: t.clientX, y: t.clientY};
  });
  container.addEventListener('touchend', e => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 25) switchLane(dx > 0 ? 1 : -1);
    } else {
      if (Math.abs(dy) > 25) (dy > 0 ? slide() : jump());
    }
    touchStart = null;
  });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
