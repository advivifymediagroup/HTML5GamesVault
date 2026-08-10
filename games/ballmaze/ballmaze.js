(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const levelEl = document.getElementById('level');
  const bestEl = document.getElementById('best');
  const timeEl = document.getElementById('time');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 17.7, 0.01);
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);

  scene.add(new THREE.AmbientLight(0xaaaaff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(8, 18, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.left = -12; dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 12; dir.shadow.camera.bottom = -12;
  scene.add(dir);

  const SIZE = 14;         // board is SIZE x SIZE
  const HALF = SIZE / 2;
  const WALL_H = 0.8;
  const BALL_R = 0.5;

  // ---- Board group (tilts) ----
  const board = new THREE.Group();
  scene.add(board);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(SIZE, 0.5, SIZE),
    new THREE.MeshStandardMaterial({color: 0x312e81, roughness: 0.85})
  );
  floor.receiveShadow = true;
  board.add(floor);

  // border walls
  const wallMat = new THREE.MeshStandardMaterial({color: 0x6366f1, roughness: 0.6});
  function addWall(x, z, w, d) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
    wall.position.set(x, WALL_H / 2 + 0.25, z);
    wall.castShadow = true; wall.receiveShadow = true;
    board.add(wall);
    return {x, z, w, d};
  }

  let walls = [];
  const borderWalls = []; // collision data for the 4 outer walls, built once, never cleared
  let holes = [];         // {x, z, r}
  let goal;               // {x, z}
  let goalMesh, ballMesh, startPos;
  const innerWalls = [];  // meshes to clean up
  const holeMeshes = [];

  // ---- Ball ----
  ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 24, 18),
    new THREE.MeshStandardMaterial({color: 0xfde047, roughness: 0.2, metalness: 0.5, emissive: 0xf59e0b, emissiveIntensity: 0.25})
  );
  ballMesh.castShadow = true;
  board.add(ballMesh);

  // goal pad
  goalMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.15, 24),
    new THREE.MeshStandardMaterial({color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5})
  );
  board.add(goalMesh);

  // ---- State ----
  let ballX, ballZ, ballVX, ballVZ;
  let tiltX = 0, tiltZ = 0;
  let targetTiltX = 0, targetTiltZ = 0;
  let level, best, gameState, startTime, timer;
  let keys = {};

  best = +localStorage.getItem('maze-best') || 1;
  bestEl.textContent = best;

  function clearMaze() {
    innerWalls.forEach(m => board.remove(m));
    innerWalls.length = 0;
    holeMeshes.forEach(m => board.remove(m));
    holeMeshes.length = 0;
    // outer border collision data must survive across levels — only rebuilt from borderWalls
    walls = [...borderWalls];
    holes = [];
  }

  function buildBorders() {
    borderWalls.push(addWall(0, -HALF + 0.25, SIZE, 0.5));
    borderWalls.push(addWall(0, HALF - 0.25, SIZE, 0.5));
    borderWalls.push(addWall(-HALF + 0.25, 0, 0.5, SIZE));
    borderWalls.push(addWall(HALF - 0.25, 0, 0.5, SIZE));
  }

  function addInnerWall(x, z, w, d) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
    wall.position.set(x, WALL_H / 2 + 0.25, z);
    wall.castShadow = true; wall.receiveShadow = true;
    board.add(wall);
    innerWalls.push(wall);
    walls.push({x, z, w, d});
  }

  function addHole(x, z) {
    const r = 0.9;
    const hole = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.52, 20),
      new THREE.MeshStandardMaterial({color: 0x050514})
    );
    hole.position.set(x, 0.26, z);
    board.add(hole);
    holeMeshes.push(hole);
    holes.push({x, z, r});
  }

  function newLevel(keepLevel = false) {
    clearMaze();
    // border walls are static children [floor, 4 borders]; rebuild inner content only
    // (borders added once at init below)

    // Start ball at a corner, goal at opposite
    startPos = {x: -HALF + 1.6, z: -HALF + 1.6};
    goal = {x: HALF - 1.6, z: HALF - 1.6};
    goalMesh.position.set(goal.x, 0.35, goal.z);

    // Number of walls/holes scales with level
    const nWalls = 3 + Math.min(level, 6);
    const nHoles = Math.min(1 + Math.floor(level / 2), 5);

    for (let i = 0; i < nWalls; i++) {
      const horizontal = Math.random() < 0.5;
      const len = 3 + Math.random() * 5;
      let x = (Math.random() - 0.5) * (SIZE - 4);
      let z = (Math.random() - 0.5) * (SIZE - 4);
      // keep clear of start & goal
      if (dist(x, z, startPos.x, startPos.z) < 2.5 || dist(x, z, goal.x, goal.z) < 2.5) continue;
      if (horizontal) addInnerWall(x, z, len, 0.5);
      else addInnerWall(x, z, 0.5, len);
    }
    for (let i = 0; i < nHoles; i++) {
      let x = (Math.random() - 0.5) * (SIZE - 4);
      let z = (Math.random() - 0.5) * (SIZE - 4);
      if (dist(x, z, startPos.x, startPos.z) < 3 || dist(x, z, goal.x, goal.z) < 3) continue;
      addHole(x, z);
    }

    resetBall();
  }

  function resetBall() {
    ballX = startPos.x; ballZ = startPos.z;
    ballVX = 0; ballVZ = 0;
    ballMesh.position.set(ballX, BALL_R + 0.25, ballZ);
    tiltX = tiltZ = targetTiltX = targetTiltZ = 0;
    board.rotation.set(0, 0, 0);
  }

  function dist(x1, z1, x2, z2) { return Math.hypot(x1 - x2, z1 - z2); }

  function startGame() {
    level = 1;
    levelEl.textContent = 1;
    newLevel();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Tilt to roll!';
    startTime = Date.now();
    clearInterval(timer);
    timer = setInterval(() => {
      if (gameState === 'play') timeEl.textContent = Math.floor((Date.now() - startTime) / 1000) + 's';
    }, 250);
  }

  function nextLevel() {
    level++;
    levelEl.textContent = level;
    if (level > best) { best = level; localStorage.setItem('maze-best', best); bestEl.textContent = best; }
    newLevel();
    statusEl.innerHTML = `Level ${level}!`;
  }

  function fellInHole() {
    statusEl.innerHTML = 'Fell in! Restarting level.';
    resetBall();
  }

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function update() {
    // smooth tilt
    let tx = targetTiltX, tz = targetTiltZ;
    if (keys.up) tx = -0.22;
    if (keys.down) tx = 0.22;
    if (keys.left) tz = 0.22;
    if (keys.right) tz = -0.22;
    tiltX += (tx - tiltX) * 0.12;
    tiltZ += (tz - tiltZ) * 0.12;
    board.rotation.x = tiltX;
    board.rotation.z = tiltZ;

    if (gameState === 'play') {
      // acceleration from tilt (gravity component)
      const ACC = 0.013;
      ballVX += Math.sin(tiltZ) * ACC * -1;
      ballVZ += Math.sin(tiltX) * ACC;
      // friction (stronger drag for a calmer, more controllable roll)
      ballVX *= 0.965;
      ballVZ *= 0.965;
      ballX += ballVX;
      ballZ += ballVZ;

      // wall collisions (AABB vs ball)
      for (const w of walls) {
        const hw = w.w / 2 + BALL_R, hd = w.d / 2 + BALL_R;
        if (Math.abs(ballX - w.x) < hw && Math.abs(ballZ - w.z) < hd) {
          // push out along smaller overlap
          const ox = hw - Math.abs(ballX - w.x);
          const oz = hd - Math.abs(ballZ - w.z);
          if (ox < oz) {
            ballX = w.x + Math.sign(ballX - w.x) * hw;
            ballVX *= -0.4;
          } else {
            ballZ = w.z + Math.sign(ballZ - w.z) * hd;
            ballVZ *= -0.4;
          }
        }
      }

      // clamp to board
      const lim = HALF - BALL_R - 0.5;
      ballX = Math.max(-lim, Math.min(lim, ballX));
      ballZ = Math.max(-lim, Math.min(lim, ballZ));

      // holes
      for (const h of holes) {
        if (dist(ballX, ballZ, h.x, h.z) < h.r - 0.1) { fellInHole(); break; }
      }

      // goal
      if (dist(ballX, ballZ, goal.x, goal.z) < 1.0) nextLevel();

      ballMesh.position.set(ballX, BALL_R + 0.25, ballZ);
      // rolling rotation
      ballMesh.rotation.x += ballVZ * 1.2;
      ballMesh.rotation.z -= ballVX * 1.2;
    }

    // pulse goal
    goalMesh.material.emissiveIntensity = 0.4 + Math.sin(Date.now() * 0.005) * 0.2;

    __polish();

    renderer.render(scene, camera);
  }

  function loop() { update(); requestAnimationFrame(loop); }

  // ---- Input ----
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowup','w'].includes(k)) { e.preventDefault(); keys.up = true; }
    else if (['arrowdown','s'].includes(k)) { e.preventDefault(); keys.down = true; }
    else if (['arrowleft','a'].includes(k)) { e.preventDefault(); keys.left = true; }
    else if (['arrowright','d'].includes(k)) { e.preventDefault(); keys.right = true; }
  });
  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (['arrowup','w'].includes(k)) keys.up = false;
    else if (['arrowdown','s'].includes(k)) keys.down = false;
    else if (['arrowleft','a'].includes(k)) keys.left = false;
    else if (['arrowright','d'].includes(k)) keys.right = false;
  });

  // drag to tilt
  let dragging = false;
  function tiltFromPointer(cx, cy) {
    const rect = container.getBoundingClientRect();
    const nx = ((cx - rect.left) / rect.width) * 2 - 1;
    const ny = ((cy - rect.top) / rect.height) * 2 - 1;
    targetTiltX = ny * 0.28;
    targetTiltZ = -nx * 0.28;
  }
  container.addEventListener('mousedown', e => { dragging = true; tiltFromPointer(e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => { if (dragging) tiltFromPointer(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { dragging = false; targetTiltX = 0; targetTiltZ = 0; });
  container.addEventListener('touchstart', e => { dragging = true; tiltFromPointer(e.touches[0].clientX, e.touches[0].clientY); }, {passive: true});
  container.addEventListener('touchmove', e => { e.preventDefault(); if (dragging) tiltFromPointer(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
  container.addEventListener('touchend', () => { dragging = false; targetTiltX = 0; targetTiltZ = 0; });

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartOverlay').addEventListener('click', startGame);
  document.getElementById('nextBtn').addEventListener('click', () => { if (gameState === 'play') newLevel(); });

  // init: build static borders once, show a preview maze
  buildBorders();
  level = 1;
  newLevel();
  gameState = 'ready';
  loop();
})();
