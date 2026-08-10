(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const levelEl = document.getElementById('level');
  const bestEl = document.getElementById('best');
  const comboEl = document.getElementById('combo');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  // ---- Three.js setup ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a25);
  scene.fog = new THREE.Fog(0x0a0a25, 16, 38);

  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 11);
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

  scene.add(new THREE.AmbientLight(0xaaaaff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(6, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  const rim = new THREE.PointLight(0x8b5cf6, 0.6, 26);
  rim.position.set(-6, 2, 6);
  scene.add(rim);
  const rim2 = new THREE.PointLight(0x06d4f7, 0.4, 26);
  rim2.position.set(6, -4, 6);
  scene.add(rim2);

  // ---- Central pillar (spins with the tower for a cohesive look) ----
  const tower = new THREE.Group();
  scene.add(tower);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 400, 24),
    new THREE.MeshStandardMaterial({color: 0x312e81, roughness: 0.55, metalness: 0.25})
  );
  tower.add(pillar);

  const RING_GAP = 3.2;
  const RING_RADIUS = 4.2;
  const SEGMENTS_PER_RING = 8;
  const RING_TOP = 0.3;          // top surface offset from ring center
  const BALL_R = 0.65;
  const BALL_REST = RING_TOP + BALL_R;
  const rings = []; // {group, segments, index, passed}

  const platformColors = [0x8b5cf6, 0x06d4f7, 0x22c55e, 0xf59e0b, 0xec4899];

  function buildRingMeshes(group, index) {
    while (group.children.length) group.remove(group.children[0]);
    const segs = [];
    const gapStart = Math.floor(Math.random() * SEGMENTS_PER_RING);
    const gapWidth = Math.random() < 0.5 ? 1 : 2;
    const gapSet = new Set();
    for (let g = 0; g < gapWidth; g++) gapSet.add((gapStart + g) % SEGMENTS_PER_RING);
    let deadlySlot = -1;
    // no danger for the first few rings, eases in gradually after
    const deadlyChance = index <= 4 ? 0 : Math.min(0.4, 0.14 + index * 0.012);
    if (Math.random() < deadlyChance) {
      do { deadlySlot = Math.floor(Math.random() * SEGMENTS_PER_RING); }
      while (gapSet.has(deadlySlot));
    }
    const idx = ((index % platformColors.length) + platformColors.length) % platformColors.length;
    const baseColor = platformColors[idx];
    const arc = (Math.PI * 2) / SEGMENTS_PER_RING;
    for (let s = 0; s < SEGMENTS_PER_RING; s++) {
      if (gapSet.has(s)) { segs.push({mesh: null, deadly: false, isGap: true}); continue; }
      const isDeadly = s === deadlySlot;
      const geom = new THREE.CylinderGeometry(RING_RADIUS, RING_RADIUS, 0.6, 16, 1, false, s * arc + 0.04, arc - 0.08);
      const mat = new THREE.MeshStandardMaterial({
        color: isDeadly ? 0xef4444 : baseColor,
        roughness: 0.42, metalness: 0.22,
        emissive: isDeadly ? 0x7f1d1d : baseColor,
        emissiveIntensity: isDeadly ? 0.5 : 0.1
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      segs.push({mesh, deadly: isDeadly, isGap: false});
    }
    return segs;
  }

  function makeRing(index, yPos) {
    const group = new THREE.Group();
    group.position.y = yPos;
    tower.add(group);
    const segments = buildRingMeshes(group, index);
    return {group, segments, index, passed: false};
  }

  const RING_COUNT = 16;
  function buildTower() {
    rings.forEach(r => tower.remove(r.group));
    rings.length = 0;
    for (let i = 0; i < RING_COUNT; i++) rings.push(makeRing(i, -i * RING_GAP));
  }

  function recycleRings() {
    // any ring well above the current view gets moved below the lowest ring and rebuilt
    const threshold = camY + 9;
    for (const r of rings) {
      if (r.group.position.y > threshold) {
        let lowest = Infinity;
        for (const rr of rings) lowest = Math.min(lowest, rr.group.position.y);
        r.group.position.y = lowest - RING_GAP;
        r.index += RING_COUNT;
        r.segments = buildRingMeshes(r.group, r.index);
        r.passed = false;
      }
    }
  }

  // ---- Ball ----
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 28, 20),
    new THREE.MeshStandardMaterial({color: 0xfde047, roughness: 0.2, metalness: 0.5, emissive: 0xf59e0b, emissiveIntensity: 0.4})
  );
  ball.castShadow = true;
  scene.add(ball);

  // ---- Game state ----
  let ballVY, ballY, level, best, combo, gameState, targetRot, camY;
  best = +localStorage.getItem('helix-best') || 0;
  bestEl.textContent = best;

  const BOUNCE_V = 0.18; // rise height stays well under RING_GAP so the ball never overshoots into the ring above
  const G = 0.009;

  function reset() {
    buildTower();
    tower.rotation.y = 0;
    targetRot = 0;
    ballVY = 0;
    ballY = 2.3;
    ball.position.set(0, ballY, RING_RADIUS - 1.0);
    camY = 0;
    camera.position.y = camY;
    camera.lookAt(0, camY, 0);
    level = 1; combo = 0;
    levelEl.textContent = 1;
    comboEl.textContent = 0;
    gameState = 'ready';
    overTitle.textContent = 'Helix Jump';
    overMsg.textContent = 'Drag left/right to spin. Fall through the gaps.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
  }

  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Spin and drop!';
  }

  function gameOver() {
    gameState = 'over';
    if (level > best) {
      best = level;
      localStorage.setItem('helix-best', best);
      bestEl.textContent = best;
      overTitle.textContent = 'New Best!';
      overMsg.textContent = `Reached level ${level}.`;
    } else {
      overTitle.textContent = 'Splat!';
      overMsg.textContent = `Level ${level}. Best is ${best}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Hit a red platform.';
  }

  // Which segment slot is under the ball, given tower rotation
  function slotUnderBall(ring) {
    const arc = (Math.PI * 2) / SEGMENTS_PER_RING;
    let localAngle = (-tower.rotation.y) % (Math.PI * 2);
    if (localAngle < 0) localAngle += Math.PI * 2;
    const slot = Math.floor(localAngle / arc) % SEGMENTS_PER_RING;
    return ring.segments[slot];
  }

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function update() {
    // smooth tower rotation (visual spin control)
    tower.rotation.y += (targetRot - tower.rotation.y) * 0.2;

    // ball idle spin
    ball.rotation.x += 0.05;

    if (gameState !== 'play') { renderer.render(scene, camera); return; }

    // physics — pure world-space, no artificial clamping
    const prevY = ballY;
    ballVY -= G;
    ballY += ballVY;

    // detect the ring surface actually crossed this frame
    if (ballVY < 0) {
      let hitRing = null, hitSurfaceY = -Infinity;
      for (const r of rings) {
        const surfaceY = r.group.position.y + BALL_REST;
        if (surfaceY <= prevY && surfaceY > ballY && surfaceY > hitSurfaceY) {
          hitSurfaceY = surfaceY;
          hitRing = r;
        }
      }
      if (hitRing) {
        const slot = slotUnderBall(hitRing);
        if (slot.isGap) {
          // fall through — ring cleared
          if (!hitRing.passed) { hitRing.passed = true; level++; levelEl.textContent = level; }
          combo++;
          comboEl.textContent = combo;
        } else if (slot.deadly) {
          ballY = hitSurfaceY;
          ball.position.y = ballY;
          __polish();
          renderer.render(scene, camera);
          return gameOver();
        } else {
          // bounce
          ballY = hitSurfaceY;
          ballVY = BOUNCE_V;
          combo = 0;
          comboEl.textContent = 0;
        }
      }
    }

    // fell off the bottom of the world (missed everything) — shouldn't normally happen but guard anyway
    if (ballY < camY - 30) return gameOver();

    ball.position.y = ballY;

    // camera smoothly follows the ball's height, always looking level (no tilt)
    const targetCamY = ballY - 1.0;
    camY += (targetCamY - camY) * 0.08;
    camera.position.y = camY;
    camera.lookAt(0, camY, 0);

    recycleRings();

    renderer.render(scene, camera);
  }

  function loop() {
    update();
    requestAnimationFrame(loop);
  }

  // ---- Input ----
  let dragging = false, lastX = 0;
  container.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    targetRot += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
  });
  window.addEventListener('mouseup', () => dragging = false);

  container.addEventListener('touchstart', e => { dragging = true; lastX = e.touches[0].clientX; }, {passive: true});
  container.addEventListener('touchmove', e => {
    if (!dragging) return;
    e.preventDefault();
    targetRot += (e.touches[0].clientX - lastX) * 0.014;
    lastX = e.touches[0].clientX;
  }, {passive: false});
  container.addEventListener('touchend', () => dragging = false);

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'a'].includes(k)) { e.preventDefault(); targetRot += 0.32; }
    else if (['arrowright', 'd'].includes(k)) { e.preventDefault(); targetRot -= 0.32; }
  });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
