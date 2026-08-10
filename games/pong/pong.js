(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scorePEl = document.getElementById('scoreP');
  const scoreAEl = document.getElementById('scoreA');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');
  const diffSel = document.getElementById('difficulty');

  // Table dimensions (world units). X = width (left/right), Z = depth (player near +Z, AI far -Z)
  const TABLE_W = 14, TABLE_D = 20;
  const HALF_W = TABLE_W / 2, HALF_D = TABLE_D / 2;
  const PADDLE_W = 3.4, PADDLE_T = 0.7;
  const BALL_R = 0.5;
  const TARGET = 5;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080820);
  scene.fog = new THREE.Fog(0x080820, 26, 50);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 22.6, 0.01);
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

  scene.add(new THREE.AmbientLight(0x8888cc, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(0, 20, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  scene.add(sun);

  // table
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_W, 0.6, TABLE_D),
    new THREE.MeshStandardMaterial({color: 0x0d1030, roughness: 0.7, metalness: 0.1})
  );
  table.position.y = -0.4; table.receiveShadow = true;
  scene.add(table);

  // center line (dashed neon)
  for (let i = -HALF_W + 1; i < HALF_W; i += 2) {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.02, 0.3),
      new THREE.MeshStandardMaterial({color: 0x8b5cf6, emissive: 0x8b5cf6, emissiveIntensity: 0.7})
    );
    dash.position.set(i, -0.08, 0);
    scene.add(dash);
  }
  // side rails
  const railMat = new THREE.MeshStandardMaterial({color: 0x312e81, roughness: 0.5, emissive: 0x1e1b4b, emissiveIntensity: 0.3});
  [-1, 1].forEach(s => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, TABLE_D + 1), railMat);
    rail.position.set(s * (HALF_W + 0.25), 0.1, 0);
    rail.castShadow = true; rail.receiveShadow = true;
    scene.add(rail);
  });

  function makePaddle(color, emissive) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(PADDLE_W, 1, PADDLE_T),
      new THREE.MeshStandardMaterial({color, emissive, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.3})
    );
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(PADDLE_W, 0.15, PADDLE_T + 0.1),
      new THREE.MeshStandardMaterial({color: 0xffffff, emissive: color, emissiveIntensity: 0.6})
    );
    top.position.y = 0.55;
    g.add(top);
    return g;
  }
  const player = makePaddle(0x06d4f7, 0x0369a1);
  player.position.set(0, 0.2, HALF_D - 1);
  scene.add(player);
  const ai = makePaddle(0xec4899, 0x9d174d);
  ai.position.set(0, 0.2, -HALF_D + 1);
  scene.add(ai);

  // ball
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 20, 16),
    new THREE.MeshStandardMaterial({color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3})
  );
  ball.castShadow = true;
  scene.add(ball);
  const ballLight = new THREE.PointLight(0xfde047, 0.6, 8);
  scene.add(ballLight);

  // ---- State ----
  let bx, bz, bvx, bvz, bspeed, scoreP, scoreA, gameState;
  let playerTargetX = 0;
  const keys = {left: false, right: false};

  function reset(full = true) {
    if (full) { scoreP = 0; scoreA = 0; scorePEl.textContent = 0; scoreAEl.textContent = 0; }
    player.position.x = 0; ai.position.x = 0;
    serveBall();
    gameState = 'serve';
    overTitle.textContent = 'Ready';
    overMsg.textContent = 'Press Space or click to serve.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press <strong>Space</strong> to serve.';
  }
  function serveBall() {
    bx = 0; bz = 0;
    bspeed = 0.14;
    const ang = (Math.random() - 0.5) * 0.8;
    const towardPlayer = Math.random() < 0.5 ? 1 : -1;
    bvx = Math.sin(ang) * bspeed;
    bvz = towardPlayer * Math.cos(ang) * bspeed;
    ball.position.set(0, 0.5, 0);
  }
  function serve() {
    if (gameState === 'over') return reset(true);
    if (gameState !== 'serve') return;
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'In play';
  }

  function aiThink() {
    const cfg = {
      easy: {speed: 0.09, err: 3.2}, medium: {speed: 0.14, err: 1.8}, hard: {speed: 0.2, err: 0.7}
    }[diffSel.value];
    let target = bz < 0 ? bx : 0;   // only react when ball heads toward AI
    target += (Math.random() - 0.5) * cfg.err;
    const d = target - ai.position.x;
    ai.position.x += Math.max(-cfg.speed * 8, Math.min(cfg.speed * 8, d)) * 0.25;
    ai.position.x = Math.max(-HALF_W + PADDLE_W / 2, Math.min(HALF_W - PADDLE_W / 2, ai.position.x));
  }

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function update() {
    // player movement
    if (keys.left) playerTargetX -= 0.4;
    if (keys.right) playerTargetX += 0.4;
    playerTargetX = Math.max(-HALF_W + PADDLE_W / 2, Math.min(HALF_W - PADDLE_W / 2, playerTargetX));
    player.position.x += (playerTargetX - player.position.x) * 0.35;

    if (gameState === 'play') {
      aiThink();
      bx += bvx; bz += bvz;

      // side walls
      if (bx < -HALF_W + BALL_R) { bx = -HALF_W + BALL_R; bvx = Math.abs(bvx); }
      if (bx > HALF_W - BALL_R) { bx = HALF_W - BALL_R; bvx = -Math.abs(bvx); }

      // player paddle (near, +Z)
      if (bz > player.position.z - PADDLE_T && bvz > 0) {
        if (Math.abs(bx - player.position.x) < PADDLE_W / 2 + BALL_R) {
          bz = player.position.z - PADDLE_T;
          bounce(player);
        } else if (bz > HALF_D) {
          scoreA++; scoreAEl.textContent = scoreA; point('AI');
        }
      }
      // ai paddle (far, -Z)
      if (bz < ai.position.z + PADDLE_T && bvz < 0) {
        if (Math.abs(bx - ai.position.x) < PADDLE_W / 2 + BALL_R) {
          bz = ai.position.z + PADDLE_T;
          bounce(ai);
        } else if (bz < -HALF_D) {
          scoreP++; scorePEl.textContent = scoreP; point('Player');
        }
      }

      ball.position.set(bx, 0.5, bz);
    }
    ballLight.position.set(ball.position.x, 1.5, ball.position.z);

    __polish();

    renderer.render(scene, camera);
  }

  function bounce(paddle) {
    const offset = (bx - paddle.position.x) / (PADDLE_W / 2);
    bspeed = Math.min(bspeed * 1.04, 0.3);
    const ang = offset * (Math.PI / 3.2);
    const dirZ = paddle === player ? -1 : 1;
    bvx = Math.sin(ang) * bspeed;
    bvz = dirZ * Math.abs(Math.cos(ang) * bspeed);
    // squash the paddle a touch
    paddle.scale.z = 1.6; setTimeout(() => paddle.scale.z = 1, 90);
  }

  function point(who) {
    if (scoreP >= TARGET || scoreA >= TARGET) {
      gameState = 'over';
      const won = scoreP >= TARGET;
      overTitle.textContent = won ? '🏆 You Win!' : '🤖 AI Wins';
      overMsg.textContent = `${scoreP} – ${scoreA}. Press Start for a rematch.`;
      overlay.classList.add('show');
      statusEl.innerHTML = won ? '✨ Match won!' : '🤖 AI took it.';
    } else {
      gameState = 'serve';
      serveBall();
      overTitle.textContent = `${who} scored!`;
      overMsg.textContent = `${scoreP} – ${scoreA}. Press Space.`;
      overlay.classList.add('show');
      statusEl.innerHTML = `${who} scored — <strong>Space</strong> to serve.`;
    }
  }

  function loop() { update(); requestAnimationFrame(loop); }

  // input
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { e.preventDefault(); keys.left = true; }
    if (k === 'arrowright' || k === 'd') { e.preventDefault(); keys.right = true; }
    if (k === 'arrowup' || k === 'w') { e.preventDefault(); keys.left = true; }   // up/left both nudge -x for intuitive feel
    if (k === 'arrowdown' || k === 's') { e.preventDefault(); keys.right = true; }
    if (e.key === ' ') { e.preventDefault(); serve(); }
  });
  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (['arrowleft','a','arrowup','w'].includes(k)) keys.left = false;
    if (['arrowright','d','arrowdown','s'].includes(k)) keys.right = false;
  });
  // mouse: map horizontal position to paddle X via raycast onto table plane
  const raycaster = new THREE.Raycaster();
  const planeY0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pointerToX(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(planeY0, hit);
    if (hit) playerTargetX = Math.max(-HALF_W + PADDLE_W / 2, Math.min(HALF_W - PADDLE_W / 2, hit.x));
  }
  container.addEventListener('mousemove', e => pointerToX(e.clientX, e.clientY));
  container.addEventListener('click', serve);
  container.addEventListener('touchmove', e => { e.preventDefault(); pointerToX(e.touches[0].clientX, e.touches[0].clientY); }, {passive: false});
  container.addEventListener('touchstart', serve);

  document.getElementById('startBtn').addEventListener('click', () => reset(true));
  document.getElementById('restartOverlay').addEventListener('click', () => { if (gameState === 'over') reset(true); else serve(); });

  reset(true);
  loop();
})();
