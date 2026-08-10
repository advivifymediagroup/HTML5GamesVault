(() => {
  if (window.__hasWebGL === false) return;
  const container = document.getElementById('game3d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('overTitle');
  const overMsg = document.getElementById('overMsg');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);
  scene.fog = new THREE.Fog(0x050510, 40, 90);

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200);
  camera.position.set(0, 2, 12);
  camera.lookAt(0, 0, -20);

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
  const key = new THREE.PointLight(0xffffff, 1.1, 60); key.position.set(0, 8, 12); scene.add(key);
  const rim = new THREE.PointLight(0x06d4f7, 0.8, 50); rim.position.set(0, -6, -20); scene.add(rim);

  // starfield
  const starGeom = new THREE.BufferGeometry();
  const N = 500;
  const sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    sp[i*3] = (Math.random() - 0.5) * 70;
    sp[i*3+1] = (Math.random() - 0.5) * 45;
    sp[i*3+2] = -Math.random() * 120;
  }
  starGeom.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeom, new THREE.PointsMaterial({color: 0xffffff, size: 0.15}));
  scene.add(stars);

  // ---- Ship ----
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 2, 12),
    new THREE.MeshStandardMaterial({color: 0x06d4f7, emissive: 0x06d4f7, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.2})
  );
  hull.rotation.x = -Math.PI / 2;
  ship.add(hull);
  const finMat = new THREE.MeshStandardMaterial({color: 0x8b5cf6, emissive: 0x8b5cf6, emissiveIntensity: 0.4});
  const finL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.6), finMat);
  finL.position.set(0, -0.1, 0.6);
  ship.add(finL);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshBasicMaterial({color: 0xfde047}));
  glow.position.set(0, 0, 1.1);
  ship.add(glow);
  ship.position.set(0, 0, 8);
  scene.add(ship);

  // ---- Pools ----
  const lasers = [];
  const asteroids = [];
  const debris = [];

  const laserGeom = new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8);
  const laserMat = new THREE.MeshBasicMaterial({color: 0xfde047});

  function spawnAsteroid(size, x, y, z) {
    const s = size || (1 + Math.random() * 1.2);
    const geom = new THREE.IcosahedronGeometry(s, 0);
    const hue = 250 + Math.random() * 60;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(`hsl(${hue}, 40%, 55%)`),
      roughness: 0.9, metalness: 0.1,
      flatShading: true
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      x !== undefined ? x : (Math.random() - 0.5) * 16,
      y !== undefined ? y : (Math.random() - 0.5) * 9,
      z !== undefined ? z : -80 - Math.random() * 20
    );
    scene.add(mesh);
    asteroids.push({
      mesh, size: s,
      vz: 0.13 + Math.random() * 0.07,
      spin: {x: (Math.random()-0.5)*0.04, y: (Math.random()-0.5)*0.04}
    });
  }

  let ship_tx = 0, ship_ty = 0;
  let score, best, lives, gameState, spawnTimer, fireCooldown;
  best = +localStorage.getItem('shooter-best') || 0;
  bestEl.textContent = best;

  function reset() {
    lasers.forEach(l => scene.remove(l.mesh)); lasers.length = 0;
    asteroids.forEach(a => scene.remove(a.mesh)); asteroids.length = 0;
    debris.forEach(d => scene.remove(d.mesh)); debris.length = 0;
    ship.position.set(0, 0, 8);
    ship_tx = 0; ship_ty = 0;
    score = 0; lives = 3;
    scoreEl.textContent = 0;
    updateLives();
    spawnTimer = 0; fireCooldown = 0;
    gameState = 'ready';
    overTitle.textContent = 'Ready?';
    overMsg.textContent = 'Move to aim. Click / Space to fire.';
    overlay.classList.add('show');
    statusEl.innerHTML = 'Press Start.';
    // seed a few asteroids
    for (let i = 0; i < 4; i++) spawnAsteroid();
  }
  function updateLives() { livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '—'; }

  function start() {
    reset();
    gameState = 'play';
    overlay.classList.remove('show');
    statusEl.innerHTML = 'Blast them!';
  }
  function gameOver() {
    gameState = 'over';
    if (score > best) {
      best = score; localStorage.setItem('shooter-best', best); bestEl.textContent = best;
      overTitle.textContent = 'New Best!'; overMsg.textContent = `${score} pts.`;
    } else {
      overTitle.textContent = 'Destroyed'; overMsg.textContent = `Score: ${score} · Best ${best}.`;
    }
    overlay.classList.add('show');
    statusEl.innerHTML = 'Shields down.';
  }

  function fire() {
    if (gameState !== 'play' || fireCooldown > 0) return;
    fireCooldown = 12;   // gentle fire rate
    const l = new THREE.Mesh(laserGeom, laserMat);
    l.rotation.x = Math.PI / 2;
    l.position.copy(ship.position);
    l.position.z -= 1;
    scene.add(l);
    lasers.push({mesh: l, vz: -1.6});
    glow.scale.set(1.6, 1.6, 1.6);
  }

  function explode(pos, color, count) {
    for (let i = 0; i < count; i++) {
      const d = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.25, 0.25),
        new THREE.MeshBasicMaterial({color})
      );
      d.position.copy(pos);
      scene.add(d);
      debris.push({
        mesh: d,
        v: new THREE.Vector3((Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6, (Math.random()-0.5)*0.6),
        life: 30
      });
    }
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
    ship.position.x += (ship_tx - ship.position.x) * 0.2;
    ship.position.y += (ship_ty - ship.position.y) * 0.2;
    ship.rotation.z = -(ship_tx - ship.position.x) * 0.4;
    ship.rotation.x = -0.15 + (ship_ty - ship.position.y) * 0.2;
    glow.scale.lerp(new THREE.Vector3(1,1,1), 0.2);

    // stars drift
    const pos = stars.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      pos.array[i*3+2] += 0.15;
      if (pos.array[i*3+2] > 12) pos.array[i*3+2] -= 120;
    }
    pos.needsUpdate = true;

    if (fireCooldown > 0) fireCooldown--;

    if (gameState === 'play') {
      spawnTimer--;
      if (spawnTimer <= 0) {
        spawnAsteroid();
        // spawn interval eases down slowly
        spawnTimer = Math.max(70, 140 - Math.floor(score / 300) * 5);
      }
    }

    // lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.mesh.position.z += l.vz;
      if (l.mesh.position.z < -90) { scene.remove(l.mesh); lasers.splice(i, 1); }
    }

    // asteroids
    if (gameState === 'play') {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.mesh.position.z += a.vz;
        a.mesh.rotation.x += a.spin.x;
        a.mesh.rotation.y += a.spin.y;
        // passed the ship?
        if (a.mesh.position.z > 11) {
          scene.remove(a.mesh); asteroids.splice(i, 1);
          lives--; updateLives();
          statusEl.innerHTML = `Asteroid got through! (${lives} left)`;
          if (lives <= 0) return gameOver();
          continue;
        }
        // laser hits
        let hit = false;
        for (let j = lasers.length - 1; j >= 0; j--) {
          const l = lasers[j];
          if (l.mesh.position.distanceTo(a.mesh.position) < a.size + 0.4) {
            scene.remove(l.mesh); lasers.splice(j, 1);
            hit = true;
            break;
          }
        }
        if (hit) {
          explode(a.mesh.position, a.mesh.material.color.getHex(), 10);
          score += Math.round(a.size * 15);
          scoreEl.textContent = score;
          scene.remove(a.mesh); asteroids.splice(i, 1);
          // split big asteroids (only if far enough from the ship to be fair)
          if (a.size > 1.4 && a.mesh.position.z < -12) {
            for (let k = 0; k < 2; k++) {
              spawnAsteroid(a.size * 0.55, a.mesh.position.x + (Math.random()-0.5)*2, a.mesh.position.y + (Math.random()-0.5)*2, a.mesh.position.z);
            }
          }
        }
      }
    }

    // debris
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.mesh.position.add(d.v);
      d.life--;
      d.mesh.material.opacity = d.life / 30;
      d.mesh.material.transparent = true;
      if (d.life <= 0) { scene.remove(d.mesh); debris.splice(i, 1); }
    }

    __polish();

    renderer.render(scene, camera);
  }

  function loop() { update(); requestAnimationFrame(loop); }

  // ---- Input ----
  container.addEventListener('mousemove', e => {
    const rect = container.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    ship_tx = nx * 8;
    ship_ty = ny * 4.5;
  });
  container.addEventListener('mousedown', fire);
  container.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const t = e.touches[0];
    const nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((t.clientY - rect.top) / rect.height) * 2 - 1);
    ship_tx = nx * 8;
    ship_ty = ny * 4.5;
  }, {passive: false});
  container.addEventListener('touchstart', e => { fire(); }, {passive: true});

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); fire(); }
    else if (['arrowleft','a'].includes(k)) { e.preventDefault(); ship_tx = Math.max(-8, ship_tx - 1); }
    else if (['arrowright','d'].includes(k)) { e.preventDefault(); ship_tx = Math.min(8, ship_tx + 1); }
    else if (['arrowup','w'].includes(k)) { e.preventDefault(); ship_ty = Math.min(4.5, ship_ty + 1); }
    else if (['arrowdown','s'].includes(k)) { e.preventDefault(); ship_ty = Math.max(-4.5, ship_ty - 1); }
  });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartOverlay').addEventListener('click', start);
  document.getElementById('fireBtn').addEventListener('click', fire);

  reset();
  loop();
})();
