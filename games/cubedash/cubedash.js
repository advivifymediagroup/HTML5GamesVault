(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const spdEl = document.getElementById('spd');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050514);
  scene.fog = new THREE.Fog(0x050514, 30, 90);

  const camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);
  if (window.SceneKit) SceneKit.enhance(renderer, scene);

  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(container);

  scene.add(new THREE.AmbientLight(0x8888ff, 0.6));
  const key = new THREE.PointLight(0x8b5cf6, 1.2, 40); key.position.set(0, 4, 6); scene.add(key);
  const key2 = new THREE.PointLight(0x06d4f7, 1.2, 40); key2.position.set(0, -4, 6); scene.add(key2);

  // ---- Tunnel rings ----
  const rings = [];
  const RING_COUNT = 20;
  const RING_SPACING = 6;
  const ringGeom = new THREE.TorusGeometry(6.5, 0.13, 8, 40);
  for (let i = 0; i < RING_COUNT; i++) {
    const hue = (i * 18) % 360;
    const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(`hsl(${hue}, 80%, 55%)`)});
    const ring = new THREE.Mesh(ringGeom, mat);
    ring.position.z = -i * RING_SPACING - 6;
    scene.add(ring);
    rings.push({mesh: ring, baseHue: hue});
  }

  // ---- Starfield (background points) ----
  const starGeom = new THREE.BufferGeometry();
  const starCount = 400;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3]     = (Math.random() - 0.5) * 60;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    starPositions[i * 3 + 2] = -Math.random() * 120;
  }
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeom, new THREE.PointsMaterial({color: 0xffffff, size: 0.12, sizeAttenuation: true}));
  scene.add(stars);

  // ---- Ship (arrow ahead of camera, small) ----
  const ship = new THREE.Group();
  const shipBody = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1.0, 8),
    new THREE.MeshStandardMaterial({color: 0x06d4f7, emissive: 0x06d4f7, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.2})
  );
  shipBody.rotation.x = -Math.PI / 2;
  ship.add(shipBody);
  const wingMat = new THREE.MeshStandardMaterial({color: 0x8b5cf6, emissive: 0x8b5cf6, emissiveIntensity: 0.5});
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.35), wingMat);
  wingL.position.set(-0.3, -0.05, 0.05);
  const wingR = wingL.clone(); wingR.position.x = 0.3;
  ship.add(wingL, wingR);
  ship.position.set(0, -0.6, -2.6);
  scene.add(ship);

  // ---- Obstacles ----
  const OBS_COUNT = 14;
  const SPAWN_Z = -110;
  const RECYCLE_Z = 4;
  const obstacles = [];
  for (let i = 0; i < OBS_COUNT; i++) {
    const size = 0.6 + Math.random() * 0.9;
    const hue = Math.random() * 360;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(`hsl(${hue}, 85%, 55%)`),
      emissive: new THREE.Color(`hsl(${hue}, 90%, 40%)`),
      emissiveIntensity: 0.4,
      metalness: 0.3,
      roughness: 0.4
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    randomPlace(cube, i);
    scene.add(cube);
    obstacles.push({mesh: cube, size, spin: {
      x: (Math.random() - 0.5) * 0.04,
      y: (Math.random() - 0.5) * 0.04,
      z: (Math.random() - 0.5) * 0.04
    }});
  }
  function randomPlace(mesh, i) {
    mesh.position.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 5,
      SPAWN_Z + (i / OBS_COUNT) * 100
    );
  }

  // ---- Game state ----
  let ship_targetX = 0, ship_targetY = -0.6;
  let speed, score, best, gameState, elapsed;
  best = +localStorage.getItem('cubedash-best') || 0;
  bestEl.textContent = best;

  function reset() {
    speed = 0.28;
    score = 0;
    elapsed = 0;
    scoreEl.textContent = 0;
    spdEl.textContent = '1×';
    ship.position.set(0, -0.6, -2.6);
    ship_targetX = 0; ship_targetY = -0.6;
    obstacles.forEach((o, i) => randomPlace(o.mesh, i));
    gameState = 'ready';
    overTitle.textContent = 'Ready?';
    overMsg.textContent = 'Move with mouse or arrow keys. Dodge the cubes.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
  }
  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Fly!';
  }
  function gameOver() {
    gameState = 'over';
    if (score > best) {
      best = score;
      localStorage.setItem('cubedash-best', best);
      bestEl.textContent = best;
      overTitle.textContent = 'New Best!';
      overMsg.textContent = `${score} pts.`;
    } else {
      overTitle.textContent = 'Boom!';
      overMsg.textContent = `Score ${score} · Best ${best}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Try again.';
  }

  const clock = new THREE.Clock();

  // keep newly-created meshes visually consistent
  let __polishTick = 0;
  function __polish() {
    if (window.SceneKit && (__polishTick++ % 30 === 0)) SceneKit.polishMaterials(scene);
  }


  function update() {
    const dt = clock.getDelta();

    // ship follow
    ship.position.x += (ship_targetX - ship.position.x) * 0.22;
    ship.position.y += (ship_targetY - ship.position.y) * 0.22;
    // tilt based on movement
    ship.rotation.z = -(ship_targetX - ship.position.x) * 0.6;
    ship.rotation.x = (ship_targetY - ship.position.y) * 0.3;

    if (gameState === 'play') {
      elapsed += dt;
      speed = Math.min(0.75, 0.28 + elapsed * 0.006);
      spdEl.textContent = (speed / 0.28).toFixed(1) + '×';
      score = Math.floor(elapsed * 14 * (speed / 0.28));
      scoreEl.textContent = score;
    }

    // move tunnel rings
    rings.forEach(r => {
      r.mesh.position.z += speed;
      r.mesh.rotation.z += 0.005;
      if (r.mesh.position.z > 4) {
        r.mesh.position.z -= RING_COUNT * RING_SPACING;
      }
    });

    // starfield
    const pos = stars.geometry.attributes.position;
    for (let i = 0; i < starCount; i++) {
      pos.array[i * 3 + 2] += speed * 0.6;
      if (pos.array[i * 3 + 2] > 5) pos.array[i * 3 + 2] -= 120;
    }
    pos.needsUpdate = true;

    // move obstacles + collide
    if (gameState === 'play') {
      for (const o of obstacles) {
        o.mesh.position.z += speed;
        o.mesh.rotation.x += o.spin.x;
        o.mesh.rotation.y += o.spin.y;
        o.mesh.rotation.z += o.spin.z;
        if (o.mesh.position.z > RECYCLE_Z) {
          o.mesh.position.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, SPAWN_Z);
        }
        // sphere vs box (approx)
        const dx = o.mesh.position.x - ship.position.x;
        const dy = o.mesh.position.y - ship.position.y;
        const dz = o.mesh.position.z - ship.position.z;
        const rr = o.size * 0.45 + 0.25;
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          return gameOver();
        }
      }
    }

    __polish();

    renderer.render(scene, camera);
  }

  function loop() {
    update();
    requestAnimationFrame(loop);
  }

  // ---- Input ----
  document.addEventListener('keydown', e => {
    if (gameState !== 'play') return;
    const step = 0.7;
    const k = e.key.toLowerCase();
    if (['arrowleft','a'].includes(k)) { e.preventDefault(); ship_targetX = Math.max(-3.8, ship_targetX - step); }
    else if (['arrowright','d'].includes(k)) { e.preventDefault(); ship_targetX = Math.min(3.8, ship_targetX + step); }
    else if (['arrowup','w'].includes(k)) { e.preventDefault(); ship_targetY = Math.min(2.2, ship_targetY + step); }
    else if (['arrowdown','s'].includes(k)) { e.preventDefault(); ship_targetY = Math.max(-2.4, ship_targetY - step); }
  });

  container.addEventListener('mousemove', e => {
    if (gameState !== 'play') return;
    const rect = container.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    ship_targetX = nx * 3.8;
    ship_targetY = ny * 2.2 - 0.2;
  });
  container.addEventListener('touchmove', e => {
    if (gameState !== 'play') return;
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const t = e.touches[0];
    const nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((t.clientY - rect.top) / rect.height) * 2 - 1);
    ship_targetX = nx * 3.8;
    ship_targetY = ny * 2.2 - 0.2;
  }, {passive: false});

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);

  reset();
  loop();
})();
