(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  // Bird flies along +X world? We keep bird at x=0 and move pipes toward +X (toward camera-right).
  // Vertical axis Y. Depth Z fixed. Side-scroller viewed from the side.
  const GRAVITY = 0.011;
  const FLAP = 0.20;
  const MAX_FALL = 0.28;
  const GAP = 5.2;
  const PIPE_W = 1.6;
  const PIPE_SPEED = 0.08;
  const SPAWN_X = 22;
  const BIRD_X = -4;
  const TOP = 9, BOTTOM = -8;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x38bdf8);
  scene.fog = new THREE.Fog(0x38bdf8, 30, 70);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(-4, 1, 20);
  camera.lookAt(-1, 0, 0);

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

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(6, 18, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  scene.add(sun);

  // ground (water)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({color: 0x0891b2, roughness: 1}));
  ground.rotation.x = -Math.PI / 2; ground.position.y = BOTTOM - 0.5; ground.receiveShadow = true;
  scene.add(ground);
  // grass strip
  const grass = new THREE.Mesh(new THREE.BoxGeometry(200, 1, 6), new THREE.MeshStandardMaterial({color: 0x16a34a, roughness: 0.9}));
  grass.position.set(0, BOTTOM, 3); grass.receiveShadow = true; scene.add(grass);

  // clouds
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1});
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random(), 10, 8), cloudMat);
      puff.position.set(j * 1.3 - 1.3, Math.random() * 0.5, 0);
      c.add(puff);
    }
    c.position.set(Math.random() * 60 - 20, 3 + Math.random() * 6, -8 - Math.random() * 6);
    cloudGroup.add(c);
  }
  scene.add(cloudGroup);

  // ---- Bird character ----
  const bird = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({color: 0xfde047, roughness: 0.45, metalness: 0.05});
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 18), bodyMat);
  body.scale.set(1.05, 0.95, 1);
  body.castShadow = true;
  bird.add(body);
  // belly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 14), new THREE.MeshStandardMaterial({color: 0xfef9c3, roughness: 0.5}));
  belly.scale.set(0.9, 0.85, 0.9); belly.position.set(0, -0.15, 0.35);
  bird.add(belly);
  // head tuft
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 6), new THREE.MeshStandardMaterial({color: 0xf59e0b}));
  tuft.position.set(-0.1, 0.95, 0); tuft.rotation.z = 0.3; bird.add(tuft);
  // eyes
  function eye(sx) {
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.3}));
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({color: 0x111111}));
    p.position.set(0.1, 0, 0.16);
    g.add(w, p); g.position.set(0.45, 0.35, sx);
    return g;
  }
  const eyeF = eye(0.34), eyeB = eye(-0.34);
  bird.add(eyeF, eyeB);
  // beak
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 8), new THREE.MeshStandardMaterial({color: 0xf97316, roughness: 0.4}));
  beak.rotation.z = -Math.PI / 2; beak.position.set(1.0, 0.12, 0); bird.add(beak);
  // wings (animated)
  const wingMat = new THREE.MeshStandardMaterial({color: 0xf59e0b, roughness: 0.5});
  const wingGeo = new THREE.BoxGeometry(0.9, 0.12, 1.5);
  const wingL = new THREE.Mesh(wingGeo, wingMat); wingL.castShadow = true;
  const wingR = new THREE.Mesh(wingGeo, wingMat); wingR.castShadow = true;
  const wingPivotL = new THREE.Group(); wingPivotL.position.set(-0.1, 0.15, 0.7); wingPivotL.add(wingL); wingL.position.set(0, 0, 0.75);
  const wingPivotR = new THREE.Group(); wingPivotR.position.set(-0.1, 0.15, -0.7); wingPivotR.add(wingR); wingR.position.set(0, 0, -0.75);
  bird.add(wingPivotL, wingPivotR);
  // tail
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 4), new THREE.MeshStandardMaterial({color: 0xf59e0b}));
  tail.rotation.z = Math.PI / 2; tail.position.set(-0.95, 0.1, 0); tail.scale.set(1, 1, 0.4); bird.add(tail);
  bird.position.set(BIRD_X, 2, 0);
  scene.add(bird);

  // ---- Pipes ----
  const pipes = [];
  const pipeMat = new THREE.MeshStandardMaterial({color: 0x22c55e, roughness: 0.5, metalness: 0.05, emissive: 0x14532d, emissiveIntensity: 0.15});
  const capMat = new THREE.MeshStandardMaterial({color: 0x16a34a, roughness: 0.5});
  function makePipe(x) {
    const gapY = (Math.random() - 0.5) * 6;
    const group = new THREE.Group();
    const topH = TOP - (gapY + GAP / 2);
    const botH = (gapY - GAP / 2) - BOTTOM;
    const topPipe = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_W, PIPE_W, topH, 20), pipeMat);
    topPipe.position.set(0, gapY + GAP / 2 + topH / 2, 0); topPipe.castShadow = true; topPipe.receiveShadow = true;
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_W + 0.25, PIPE_W + 0.25, 0.6, 20), capMat);
    topCap.position.set(0, gapY + GAP / 2 + 0.3, 0); topCap.castShadow = true;
    const botPipe = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_W, PIPE_W, botH, 20), pipeMat);
    botPipe.position.set(0, gapY - GAP / 2 - botH / 2, 0); botPipe.castShadow = true; botPipe.receiveShadow = true;
    const botCap = new THREE.Mesh(new THREE.CylinderGeometry(PIPE_W + 0.25, PIPE_W + 0.25, 0.6, 20), capMat);
    botCap.position.set(0, gapY - GAP / 2 - 0.3, 0); botCap.castShadow = true;
    group.add(topPipe, topCap, botPipe, botCap);
    group.position.x = x;
    scene.add(group);
    pipes.push({group, gapY, passed: false});
  }

  // ---- State ----
  let birdY, birdVY, speed, score, best, gameState, spawnAcc;
  best = +localStorage.getItem('flappy3d2-best') || 0;
  bestEl.textContent = best;

  function reset() {
    pipes.forEach(p => scene.remove(p.group)); pipes.length = 0;
    birdY = 2; birdVY = 0; speed = PIPE_SPEED; score = 0; spawnAcc = 0;
    scoreEl.textContent = 0;
    bird.position.set(BIRD_X, birdY, 0);
    bird.rotation.z = 0;
    for (let i = 0; i < 4; i++) makePipe(SPAWN_X * 0.4 + i * 7);
    gameState = 'ready';
    overTitle.textContent = 'Ready?';
    overMsg.textContent = 'Click / Space to flap. Fly between the pipes.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
  }
  function start() { reset(); gameState = 'play'; overlay.classList.remove('show'); statusEl.innerHTML = 'Flap!'; }
  function gameOver() {
    gameState = 'over';
    if (score > best) { best = score; localStorage.setItem('flappy3d2-best', best); bestEl.textContent = best; overTitle.textContent = 'New Best!'; overMsg.textContent = `${score} pipes.`; }
    else { overTitle.textContent = 'Crashed!'; overMsg.textContent = `${score} pipes · Best ${best}.`; }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start to fly again.';
  }
  let flapPulse = 0;
  function flap() {
    if (gameState === 'over') return start();
    if (gameState === 'ready') return start();
    birdVY = FLAP; flapPulse = 1;
  }

  let wingPhase = 0;

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }

  function update() {
    wingPhase += 0.35;
    const base = Math.sin(wingPhase) * 0.5;
    const beat = flapPulse * 0.9;
    wingPivotL.rotation.x = base + beat;
    wingPivotR.rotation.x = -(base + beat);
    flapPulse *= 0.85;

    // clouds drift
    cloudGroup.children.forEach(c => { c.position.x -= 0.02; if (c.position.x < -30) c.position.x = 40; });

    if (gameState === 'ready') {
      bird.position.y = 2 + Math.sin(performance.now() * 0.003) * 0.4;
      bird.rotation.z = Math.sin(performance.now() * 0.003) * 0.1;
    }

    if (gameState === 'play') {
      birdVY = Math.max(birdVY - GRAVITY, -MAX_FALL);
      birdY += birdVY;
      bird.position.y = birdY;
      bird.rotation.z = Math.max(-0.5, Math.min(0.6, birdVY * 2.2));

      // pipes move toward bird (−X)
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.group.position.x -= speed;
        if (!p.passed && p.group.position.x < BIRD_X) {
          p.passed = true; score++; scoreEl.textContent = score; statusEl.innerHTML = `${score}`;
        }
        if (p.group.position.x < -26) { scene.remove(p.group); pipes.splice(i, 1); }
        // collision
        if (Math.abs(p.group.position.x - BIRD_X) < PIPE_W + 0.6) {
          if (birdY > p.gapY + GAP / 2 - 0.6 || birdY < p.gapY - GAP / 2 + 0.6) return gameOver();
        }
      }
      while (pipes.length < 4) {
        const maxX = Math.max(...pipes.map(p => p.group.position.x), BIRD_X);
        makePipe(maxX + 7);
      }
      // bounds
      if (birdY < BOTTOM + 1) return gameOver();
      if (birdY > TOP) { birdY = TOP; birdVY = 0; }

      speed = Math.min(0.13, speed + 0.00002);
    }

    // camera gentle follow
    camera.position.y += ((bird.position.y * 0.3 + 1) - camera.position.y) * 0.05;
    camera.lookAt(-1, bird.position.y * 0.3, 0);

    __polish();

    renderer.render(scene, camera);
  }

  function loop() { update(); requestAnimationFrame(loop); }

  container.addEventListener('mousedown', flap);
  container.addEventListener('touchstart', e => { e.preventDefault(); flap(); }, {passive: false});
  document.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { e.preventDefault(); flap(); } });
  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
