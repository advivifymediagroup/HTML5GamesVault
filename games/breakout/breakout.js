(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  // Field on X (width) / Z (depth). Paddle near +Z, bricks far -Z.
  const FIELD_W = 16, FIELD_D = 22;
  const HALF_W = FIELD_W / 2, HALF_D = FIELD_D / 2;
  const PADDLE_W = 4, BALL_R = 0.45;
  const COLS = 9;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070718);
  scene.fog = new THREE.Fog(0x070718, 28, 52);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 24.9, 0.01);
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

  scene.add(new THREE.AmbientLight(0x8888cc, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-6, 22, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
  scene.add(sun);

  // floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(FIELD_W, 0.5, FIELD_D), new THREE.MeshStandardMaterial({color: 0x0d1030, roughness: 0.8}));
  floor.position.y = -0.35; floor.receiveShadow = true; scene.add(floor);
  // rails
  const railMat = new THREE.MeshStandardMaterial({color: 0x312e81, emissive: 0x1e1b4b, emissiveIntensity: 0.3, roughness: 0.5});
  [-1,1].forEach(s => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, FIELD_D), railMat); r.position.set(s*(HALF_W+0.25), 0.3, 0); r.castShadow = true; r.receiveShadow = true; scene.add(r); });
  const backRail = new THREE.Mesh(new THREE.BoxGeometry(FIELD_W + 1, 1.4, 0.5), railMat);
  backRail.position.set(0, 0.3, -HALF_D - 0.25); backRail.castShadow = true; scene.add(backRail);

  // paddle
  const paddle = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(PADDLE_W, 0.9, 1), new THREE.MeshStandardMaterial({color: 0x06d4f7, emissive: 0x0369a1, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.3}));
  pBody.castShadow = true; pBody.receiveShadow = true;
  const pTop = new THREE.Mesh(new THREE.BoxGeometry(PADDLE_W, 0.15, 1.1), new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0x06d4f7, emissiveIntensity: 0.6}));
  pTop.position.y = 0.5;
  paddle.add(pBody, pTop);
  paddle.position.set(0, 0.3, HALF_D - 1.5);
  scene.add(paddle);

  // ball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 16), new THREE.MeshStandardMaterial({color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.3}));
  ball.castShadow = true; scene.add(ball);
  const ballLight = new THREE.PointLight(0xfde047, 0.7, 9); scene.add(ballLight);

  const BRICK_COLORS = [0xef4444, 0xf97316, 0xfbbf24, 0x34d399, 0x06d4f7, 0x8b5cf6];
  let bricks = [];

  // ---- State ----
  let bx, bz, bvx, bvz, launched, score, lives, level, gameState;
  let paddleTargetX = 0;
  const keys = {left: false, right: false};

  function buildBricks() {
    bricks.forEach(b => scene.remove(b.mesh));
    bricks = [];
    const rows = 4 + Math.min(level - 1, 3);
    const bw = (FIELD_W - 2) / COLS - 0.25;
    const bh = 0.9, bd = 1.1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = BRICK_COLORS[r % BRICK_COLORS.length];
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, bd),
          new THREE.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 0.18, roughness: 0.45, metalness: 0.1})
        );
        const x = -HALF_W + 1 + bw / 2 + c * (bw + 0.25);
        const z = -HALF_D + 2 + r * (bd + 0.25);
        mesh.position.set(x, 0.5, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        bricks.push({mesh, x, z, w: bw, d: bd, alive: true, points: (rows - r) * 5});
      }
    }
  }

  function reset(full = true) {
    if (full) { score = 0; lives = 3; level = 1; scoreEl.textContent = 0; livesEl.textContent = 3; levelEl.textContent = 1; }
    paddle.position.x = 0; paddleTargetX = 0;
    bvx = 0.08 * (Math.random() < 0.5 ? -1 : 1); bvz = -0.16;
    launched = false;
    buildBricks();
    overlay.classList.remove('show');
    positionBallOnPaddle();
  }
  function positionBallOnPaddle() {
    bx = paddle.position.x; bz = paddle.position.z - 1;
    ball.position.set(bx, 0.5, bz);
  }

  function launch() { if (!launched && gameState === 'play') launched = true; }

  function start() {
    reset(true);
    gameState = 'play';
    statusEl.innerHTML = 'Press <strong>Space</strong> to launch.';
    overlay.classList.remove('show');
  }

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function update() {
    if (keys.left) paddleTargetX -= 0.45;
    if (keys.right) paddleTargetX += 0.45;
    paddleTargetX = Math.max(-HALF_W + PADDLE_W / 2, Math.min(HALF_W - PADDLE_W / 2, paddleTargetX));
    paddle.position.x += (paddleTargetX - paddle.position.x) * 0.35;

    if (gameState === 'play') {
      if (!launched) { positionBallOnPaddle(); }
      else {
        bx += bvx; bz += bvz;
        // side walls
        if (bx < -HALF_W + BALL_R) { bx = -HALF_W + BALL_R; bvx = Math.abs(bvx); }
        if (bx > HALF_W - BALL_R) { bx = HALF_W - BALL_R; bvx = -Math.abs(bvx); }
        // back wall
        if (bz < -HALF_D + BALL_R) { bz = -HALF_D + BALL_R; bvz = Math.abs(bvz); }
        // fell past paddle
        if (bz > HALF_D + 1) {
          lives--; livesEl.textContent = lives;
          if (lives <= 0) return gameOver();
          launched = false; bvx = 0.08 * (Math.random() < 0.5 ? -1 : 1); bvz = -0.16;
          statusEl.innerHTML = `Life lost — ${lives} left. <strong>Space</strong> to launch.`;
          positionBallOnPaddle();
        }
        // paddle collision
        if (bz + BALL_R >= paddle.position.z - 0.5 && bz - BALL_R <= paddle.position.z + 0.5 &&
            Math.abs(bx - paddle.position.x) <= PADDLE_W / 2 + BALL_R && bvz > 0) {
          bz = paddle.position.z - 0.5 - BALL_R;
          const offset = (bx - paddle.position.x) / (PADDLE_W / 2);
          const speed = Math.min(Math.hypot(bvx, bvz) * 1.02, 0.28);
          const ang = offset * (Math.PI / 3);
          bvx = Math.sin(ang) * speed;
          bvz = -Math.abs(Math.cos(ang) * speed);
          paddle.scale.y = 1.4; setTimeout(() => paddle.scale.y = 1, 90);
        }
        // bricks
        for (const br of bricks) {
          if (!br.alive) continue;
          if (Math.abs(bx - br.x) < br.w / 2 + BALL_R && Math.abs(bz - br.z) < br.d / 2 + BALL_R) {
            br.alive = false; br.mesh.visible = false;
            score += br.points; scoreEl.textContent = score;
            // pop animation via quick scale (mesh hidden, spawn shards optional)
            const prevX = bx - bvx, prevZ = bz - bvz;
            const outsideX = prevX + BALL_R <= br.x - br.w / 2 || prevX - BALL_R >= br.x + br.w / 2;
            if (outsideX) bvx *= -1; else bvz *= -1;
            break;
          }
        }
        if (bricks.every(b => !b.alive)) {
          level++; levelEl.textContent = level;
          statusEl.innerHTML = `Level ${level - 1} cleared!`;
          paddle.position.x = 0; paddleTargetX = 0;
          bvx = 0.09 * (Math.random() < 0.5 ? -1 : 1); bvz = -0.17;
          launched = false; buildBricks(); positionBallOnPaddle();
        }
        ball.position.set(bx, 0.5, bz);
      }
    }
    ballLight.position.set(ball.position.x, 1.6, ball.position.z);
    __polish();
    renderer.render(scene, camera);
  }

  function gameOver() {
    gameState = 'over';
    overTitle.textContent = 'Game Over';
    overMsg.textContent = `Final score: ${score} · Level ${level}`;
    overlay.classList.add('show');
    statusEl.innerHTML = 'Game over.';
  }

  function loop() { update(); requestAnimationFrame(loop); }

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { e.preventDefault(); keys.left = true; }
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { e.preventDefault(); keys.right = true; }
    if (e.key === ' ') { e.preventDefault(); launch(); }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') keys.right = false;
  });
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pointerX(cx, cy) {
    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -(((cy - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) paddleTargetX = Math.max(-HALF_W + PADDLE_W / 2, Math.min(HALF_W - PADDLE_W / 2, hit.x));
  }
  container.addEventListener('mousemove', e => pointerX(e.clientX, e.clientY));
  container.addEventListener('click', launch);
  container.addEventListener('touchmove', e => { e.preventDefault(); pointerX(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
  container.addEventListener('touchstart', launch);

  document.getElementById('startBtn').addEventListener('click', launch);
  document.getElementById('newBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  gameState = 'play';
  reset(true);
  loop();
})();
